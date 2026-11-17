#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { admitRun, arms, baselineFor, families, phaseNames, profiles, sha, write } from './bucket-cost-common.mjs';
const [resultsArg, outputArg] = process.argv.slice(2); assert.ok(resultsArg && outputArg, 'RESULTS_JSON OUTPUT_JSON');
const input = resolve(resultsArg), output = resolve(outputArg), analyzer = fileURLToPath(import.meta.url);
assert.ok(!existsSync(output), 'Preserve previous analysis');
const admitted = admitRun(input), { plan, packet, children } = admitted;
assert.equal(sha(analyzer), packet.bindings[analyzer], 'Use frozen analyzer');
const median = values => { const sorted = values.slice().sort((a, b) => a - b), m = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2; };
const distribution = values => ({ values, min: Math.min(...values), median: median(values), max: Math.max(...values) });
const rows = children.map(child => {
  const row = { sample: child.sample, oracles: child.oracles };
  if (child.sample.kind === 'cpu') {
    row.stages = Object.fromEntries(phaseNames.map(name => [name, { elapsedMs: child.stages[name].elapsedNs / 1e6, cpuMs: child.stages[name].cpuMs }]));
    const sum = names => ({ elapsedMs: names.reduce((n, key) => n + row.stages[key].elapsedMs, 0), cpuMs: names.reduce((n, key) => n + row.stages[key].cpuMs, 0) });
    row.stages.openWithDrain = sum(['openAll', 'openDrain']);
    row.stages.settlementWithDrain = sum(['settlementCalls', 'settlementDrain']);
    row.stages.measuredPhaseSum = sum(phaseNames);
  }
  if (child.sample.kind === 'heap' || child.sample.kind === 'heap-control') {
    row.checkpoints = child.checkpoints;
    row.heapDeltasFromModule = Object.fromEntries(Object.entries(child.checkpoints).map(([name, point]) => [name, point.heapUsed - child.checkpoints.moduleReady.heapUsed]));
  }
  if (child.sample.fault) row.expectedFailure = child.detectedOracle;
  return row;
});
const summary = { cohort: plan.cohort, admitted: rows.length, profiles: {}, sameArm: [] };
if (plan.cohort === 'cpu') {
  const phases = [...phaseNames, 'openWithDrain', 'settlementWithDrain', 'measuredPhaseSum'];
  for (const profile of profiles) {
    const primary = rows.filter(row => row.sample.profile.id === profile.id && !row.sample.control), byArm = {}, paired = {};
    for (const arm of arms) {
      const samples = primary.filter(row => row.sample.arm === arm).sort((a, b) => a.sample.round - b.sample.round);
      assert.deepEqual(samples.map(row => row.sample.round), [0, 1, 2]);
      byArm[arm] = Object.fromEntries(phases.map(phase => [phase, Object.fromEntries(['cpuMs', 'elapsedMs'].map(metric => [metric, distribution(samples.map(row => row.stages[phase][metric]))]))]));
    }
    for (const arm of ['O16', 'K16', 'K15']) paired[arm] = Object.fromEntries(phases.map(phase => [phase, Object.fromEntries(['cpuMs', 'elapsedMs'].map(metric => [metric, distribution([0, 1, 2].map(round =>
      primary.find(row => row.sample.arm === arm && row.sample.round === round).stages[phase][metric] - primary.find(row => row.sample.arm === baselineFor(arm) && row.sample.round === round).stages[phase][metric]))]))]));
    summary.profiles[profile.id] = { byArm, pairedCandidateMinusOwnLineBaseline: paired };
  }
  for (const arm of ['C1', 'V15']) for (const shape of ['scalar', 'entity']) {
    const samples = rows.filter(row => row.sample.control === 'AA' && row.sample.arm === arm && row.sample.profile.shape === shape).sort((a, b) => a.sample.repeat - b.sample.repeat);
    assert.equal(samples.length, 2);
    summary.sameArm.push({ arm, shape, differenceSecondMinusFirst: Object.fromEntries(phases.map(phase => [phase, Object.fromEntries(['cpuMs', 'elapsedMs'].map(metric => [metric, samples[1].stages[phase][metric] - samples[0].stages[phase][metric]]))])) });
  }
} else if (plan.cohort === 'heap') {
  for (const profile of profiles) {
    const primary = rows.filter(row => row.sample.profile.id === profile.id && !row.sample.control);
    assert.deepEqual(primary.map(row => row.sample.arm).sort(), arms.slice().sort());
    summary.profiles[profile.id] = Object.fromEntries(primary.map(row => [row.sample.arm, { checkpoints: row.checkpoints, moduleRelativeBytes: row.heapDeltasFromModule }]));
  }
  summary.sameArm = rows.filter(row => row.sample.control === 'AA');
}
write(output, { passed: true, input, inputSha256: sha(input), analyzer, analyzerSha256: sha(analyzer), commonSha256: sha(fileURLToPath(new URL('./bucket-cost-common.mjs', import.meta.url))),
  planPath: admitted.result.planPath, planSha256: admitted.result.planSha256, packetPath: plan.packetPath, packetSha256: plan.packetSha256, families,
  summary, rows, limits: 'Three CPU rounds are exploratory; paired within-line differences and A/A variability are observations, not confidence intervals. Measured sums exclude intermediate oracle gaps. Heap is a separate finite whole-heap assay; source constructor census and payload reachability do not establish retained-byte attribution or universal boundedness. v15 and v16 semantics are not asserted equivalent beyond this task.' });
console.log(JSON.stringify({ passed: true, output, admitted: rows.length }));
