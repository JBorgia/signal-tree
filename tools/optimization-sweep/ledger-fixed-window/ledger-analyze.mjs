#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arms, expectedFaults, read, schedule, sha, verify, write } from './ledger-common.mjs';

const [inputArg, outputArg] = process.argv.slice(2);
assert.ok(inputArg && outputArg, 'RESULTS_JSON OUTPUT_JSON');
const input = resolve(inputArg), output = resolve(outputArg);
assert.ok(!existsSync(output), 'Preserve prior analysis');
const results = read(input), plan = read(results.planPath), packet = read(plan.packetPath);
assert(['heap','controls'].includes(plan.cohort), 'This follow-up analyzes no CPU cohort');
assert.equal(sha(results.planPath), results.planSha256);
assert.equal(sha(plan.packetPath), plan.packetSha256);
verify(results.bindings); verify(plan.bindings); verify(packet.bindings);
assert.deepEqual(results.bindings, plan.bindings);
assert.equal(plan.bindings[plan.packetPath], plan.packetSha256);
for (const [path, hash] of Object.entries(packet.bindings)) assert.equal(plan.bindings[path], hash, 'Complete packet binding closure');
assert.deepEqual(plan.node, packet.node);
assert.deepEqual(plan.schedule, schedule(plan.cohort));
assert.equal(results.passed, true); assert.equal(results.results.length, plan.schedule.length);
const ids = (start, count) => Array.from({ length: count }, (_, i) => start + i);
const keep = (xs, H) => H > 0 ? xs.slice(-H) : [];
const phaseNames = ['factory', 'pendingSetup', 'ordinaryFlushes', 'settlementAndDrain', 'destroy'];
const rows = [];
for (let i = 0; i < plan.schedule.length; i++) {
  const sample = plan.schedule[i], invocation = results.results[i];
  assert.deepEqual(invocation.sample, sample); assert.equal(invocation.passed, true);
  assert.equal(invocation.signal, null); assert.equal(invocation.processError, undefined);
  assert.deepEqual(read(join(dirname(input), `invocation-${String(sample.index).padStart(3, '0')}.json`)), invocation, 'Exact invocation sidecar');
  assert.equal(sha(invocation.resultPath), invocation.resultSha256); assert.equal(sha(invocation.logPath), invocation.logSha256);
  const child = read(invocation.resultPath), fault = expectedFaults[sample.fault];
  assert.deepEqual(child.sample, sample); assert.deepEqual(child.node, packet.node);
  assert.equal(child.packetSha256, plan.packetSha256); assert.equal(child.packetPath, plan.packetPath);
  assert.equal(child.bundleSha256, packet.bundles[sample.arm].sha256);
  assert.equal(child.runnerSha256, packet.bindings[packet.runner]);
  assert.ok(Number.isSafeInteger(child.pid) && child.pid > 0, 'Child PID');
  assert.equal(Object.hasOwn(child, 'cleanupError'), false);
  assert.equal(invocation.admissionError, undefined);
  if (fault) {
    assert.equal(invocation.exitCode, 1); assert.equal(child.passed, false); assert.ok(child.error.includes(fault));
    rows.push({ sample, expectedFailure: fault }); continue;
  }
  assert.equal(invocation.exitCode, 0); assert.equal(child.passed, true); assert.equal(Object.hasOwn(child, 'error'), false);
  if (sample.kind === 'overlap-control') {
    assert.deepEqual(child.oracles, { overlapRefused: true, rollbackValues: [2, 1, 0], pending: 0 });
    rows.push({ sample, oracles: child.oracles }); continue;
  }
  const { P, H, E, N } = sample.profile, ordinary = ids(P + 1, N);
  const expectedHeld = P ? ordinary : keep(ordinary, H);
  const expectedSettled = keep(sample.settlement === 'confirm' ? ids(1, P + N) : ordinary, H);
  assert.deepEqual(child.oracles.held.ids, expectedHeld);
  assert.deepEqual(child.oracles.settled.ids, expectedSettled);
  for (const key of ['held', 'settled']) {
    const oracle = child.oracles[key];
    assert.equal(oracle.effects, oracle.ids.reduce((n, id) => n + (id <= P ? 1 : E), 0));
    assert.equal(oracle.retention.firstAvailableTurnId, oracle.ids[0]);
    assert.match(oracle.digest, /^[a-f0-9]{64}$/);
  }
  const row = { sample, oracles: child.oracles };
  if (sample.kind === 'cpu') {
    assert.deepEqual(Object.keys(child.stages), phaseNames);
    assert.equal(child.operationSamples.length, N);
    for (const stage of [...Object.values(child.stages), ...child.operationSamples]) {
      for (const n of [stage.elapsedNs, stage.cpuMs, stage.cpuMicroseconds.user, stage.cpuMicroseconds.system]) assert.ok(Number.isFinite(n) && n >= 0);
      assert.equal(stage.cpuMs, (stage.cpuMicroseconds.user + stage.cpuMicroseconds.system) / 1000);
    }
    for (const key of ['elapsedNs', 'user', 'system']) {
      const actual = key === 'elapsedNs' ? child.stages.ordinaryFlushes.elapsedNs : child.stages.ordinaryFlushes.cpuMicroseconds[key];
      const expected = child.operationSamples.reduce((n, x) => n + (key === 'elapsedNs' ? x.elapsedNs : x.cpuMicroseconds[key]), 0);
      assert.equal(actual, expected, 'Recomputed raw interval sum');
    }
    row.stages = Object.fromEntries(phaseNames.map(name => [name, { elapsedMs: child.stages[name].elapsedNs / 1e6, cpuMs: child.stages[name].cpuMs }]));
    row.stages.measuredPhaseSum = { elapsedMs: Object.values(row.stages).reduce((n, x) => n + x.elapsedMs, 0), cpuMs: Object.values(row.stages).reduce((n, x) => n + x.cpuMs, 0) };
  } else assert.deepEqual(child.stages, {});
  if (sample.kind === 'heap' || sample.kind === 'heap-control') {
    const names = ['moduleReady', 'held', 'settled', ...Array.from({length:8}, (_, i) => `settledExtra${i}`), 'destroyedHeld', 'helperReturned'];
    if (sample.control === 'pin-release') names.push('pinReleased');
    assert.deepEqual(Object.keys(child.checkpoints), names);
    for (const point of Object.values(child.checkpoints)) assert.ok(Number.isSafeInteger(point.heapUsed) && point.heapUsed > 0);
    assert.equal(child.checkpoints.held.alive.tree, true); assert.equal(child.checkpoints.held.alive.current, true);
    assert.equal(child.checkpoints.settled.alive.tree, true); assert.equal(child.checkpoints.settled.alive.current, true);
    assert.equal(child.checkpoints.destroyedHeld.alive.tree, true);
    assert.equal(child.checkpoints.helperReturned.alive.tree, false);
    assert.equal(child.checkpoints.helperReturned.alive.current, false);
    assert.equal(child.checkpoints.helperReturned.alive.first, sample.control === 'pin-release');
    if (sample.control === 'pin-release') assert.equal(child.checkpoints.pinReleased.alive.first, false);
    const expectedFirst = sample.control === 'pin-release' || child.oracles.settled.ids.includes(sample.profile.P + 1) || child.oracles.settled.ids.includes(sample.profile.P + 2);
    assert.equal(child.expectedSettledFirstAlive, expectedFirst);
    assert.equal(child.strictSettledReleasePassed, child.checkpoints.settled.alive.first === expectedFirst);
    assert.equal(child.checkpoints.settledExtra7.alive.first, expectedFirst);
    assert.equal(child.checkpoints.settledExtra7.alive.tree, true);
    assert.equal(child.checkpoints.settledExtra7.alive.current, true);
    row.strictSettledReleasePassed = child.strictSettledReleasePassed;
    row.checkpoints = child.checkpoints;
    row.heapDeltas = Object.fromEntries(Object.entries(child.checkpoints).map(([name, point]) => [name, point.heapUsed - child.checkpoints.moduleReady.heapUsed]));
  }
  rows.push(row);
}
const median = xs => { const sorted = xs.slice().sort((a, b) => a - b), m = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2; };
const distribution = xs => ({ values: xs, min: Math.min(...xs), median: median(xs), max: Math.max(...xs) });
const summary = { cohort: plan.cohort, admitted: rows.length, profiles: {}, sameArm: [] };
if (plan.cohort === 'cpu') {
  for (const profile of [...new Set(rows.map(row => row.sample.profile.id))]) {
    const primary = rows.filter(row => row.sample.profile.id === profile && !row.sample.control), phases = [...phaseNames, 'measuredPhaseSum'];
    const byArm = {};
    for (const arm of arms) {
      const samples = primary.filter(row => row.sample.arm === arm).sort((a, b) => a.sample.round - b.sample.round);
      assert.deepEqual(samples.map(row => row.sample.round), [0, 1, 2]);
      byArm[arm] = Object.fromEntries(phases.map(phase => [phase, Object.fromEntries(['elapsedMs', 'cpuMs'].map(metric =>
        [metric, distribution(samples.map(row => row.stages[phase][metric]))]))]));
    }
    const paired = {};
    for (const arm of arms.slice(1)) paired[arm] = Object.fromEntries(phases.map(phase => [phase, Object.fromEntries(['elapsedMs', 'cpuMs'].map(metric =>
      [metric, distribution([0, 1, 2].map(round => primary.find(row => row.sample.arm === arm && row.sample.round === round).stages[phase][metric] - primary.find(row => row.sample.arm === 'C1' && row.sample.round === round).stages[phase][metric]))]))]));
    summary.profiles[profile] = { byArm, pairedCandidateMinusC1: paired };
  }
  for (const profile of ['pending-long', 'wide']) for (const pair of [0, 1]) {
    const samples = rows.filter(row => row.sample.control === 'AA' && row.sample.profile.id === profile && row.sample.round === pair).sort((a, b) => a.sample.repeat - b.sample.repeat);
    assert.equal(samples.length, 2);
    summary.sameArm.push({ profile, pair, differenceSecondMinusFirst: Object.fromEntries([...phaseNames, 'measuredPhaseSum'].map(phase => [phase, {
      elapsedMs: samples[1].stages[phase].elapsedMs - samples[0].stages[phase].elapsedMs,
      cpuMs: samples[1].stages[phase].cpuMs - samples[0].stages[phase].cpuMs,
    }])) });
  }
} else if (plan.cohort === 'heap') {
  for (const profile of [...new Set(rows.map(row => row.sample.profile.id))]) {
    const primary = rows.filter(row => row.sample.profile.id === profile && !row.sample.control);
    assert.deepEqual(primary.map(row => row.sample.arm).sort(), arms.slice().sort());
    summary.profiles[profile] = Object.fromEntries(primary.map(row => [row.sample.arm, { checkpoints: row.checkpoints, moduleRelativeBytes: row.heapDeltas }]));
  }
  summary.sameArm = rows.filter(row => row.sample.control === 'AA');
}
write(output, { passed: true, input, inputSha256: sha(input), analyzer: fileURLToPath(import.meta.url), analyzerSha256: sha(fileURLToPath(import.meta.url)),
  commonSha256: sha(fileURLToPath(new URL('./ledger-common.mjs', import.meta.url))), planPath: results.planPath, planSha256: results.planSha256,
  summary, rows, limits: 'All registered children admitted; three CPU rounds are exploratory, no significance claim. MeasuredPhaseSum excludes untimed inputs/oracles/gaps. Heap diagnostic is a separate finite whole-heap study.' });
console.log(JSON.stringify({ passed: true, output, count: rows.length }));
