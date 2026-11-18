import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { read, sha, save, schedule } from './common.mjs';

const [cohortArg, outputArg] = process.argv.slice(2), cohort = resolve(cohortArg);
const completion = read(join(cohort, 'result.json')), plan = read(join(cohort, 'plan.json'));
assert.equal(completion.passed, true); assert.equal(completion.bindingsUnchanged, true);
assert.equal(completion.kind, plan.kind); assert.equal(completion.packetSha256, plan.packetSha256);
assert.equal(sha(plan.packetPath), plan.packetSha256);
assert.deepEqual(plan.samples, schedule(plan.kind));
assert.equal(completion.children, plan.samples.length);
assert(['cpu', 'heap'].includes(plan.kind));
const results = [];
for (const sample of plan.samples) {
  const receiptPath = join(cohort, `receipt-${sample.index}.json`), receipt = read(receiptPath);
  const resultPath = join(cohort, `result-${sample.index}.json`), result = read(resultPath);
  assert.deepEqual(receipt.sample, sample); assert.deepEqual(result.sample, sample);
  assert.equal(receipt.exitCode, 0); assert.equal(receipt.passed, true); assert.equal(result.passed, true);
  assert.equal(sha(resultPath), receipt.resultSha256);
  assert.equal(sha(resultPath + '.stdout'), receipt.stdoutSha256);
  assert.equal(sha(resultPath + '.stderr'), receipt.stderrSha256);
  assert.equal(sha(join(cohort, `input-${sample.index}.json`)), receipt.inputSha256);
  const metrics = {};
  if (plan.kind === 'cpu') {
    for (const [name, value] of Object.entries({ moduleImport: result.import, ...result.stages })) {
      metrics[name + '.wallMs'] = value.wallNs / 1e6;
      metrics[name + '.cpuMs'] = (value.userUs + value.systemUs) / 1000;
    }
    for (const suffix of ['wallMs', 'cpuMs']) metrics['allFactories.' + suffix] = metrics['firstFactory.' + suffix] + metrics['remainingFactories.' + suffix];
  } else {
    assert.deepEqual(result.stages, {}); assert.equal(result.import, undefined);
    for (const [name, checkpoint] of Object.entries(result.checkpoints)) {
      metrics[name + '.heapBytes'] = checkpoint.heapBytes;
      metrics[name + '.aboveModuleBytes'] = checkpoint.heapBytes - result.checkpoints.moduleReady.heapBytes;
    }
    assert.deepEqual(result.checkpoints.helperReturned.alive, { tree: false, snapshot: false });
  }
  for (const value of Object.values(metrics)) assert(Number.isFinite(value));
  results.push({ sample, metrics, oracles: result.oracles, receipt: receiptPath, receiptSha256: sha(receiptPath) });
}
const quantile = (values, q) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(q * values.length) - 1)];
const stats = values => ({ samples: values, min: Math.min(...values), median: quantile(values, 0.5), max: Math.max(...values), p10: quantile(values, 0.1), p90: quantile(values, 0.9) });
const report = [];
for (const carrier of ['neutral', 'angular']) {
  const profiles = [...new Set(results.filter(value => value.sample.carrier === carrier).map(value => value.sample.profile.id))];
  for (const profile of profiles) {
    const rows = results.filter(value => value.sample.carrier === carrier && value.sample.profile.id === profile);
    const find = (arm, round, control) => {
      const matches = rows.filter(value => value.sample.arm === arm && value.sample.round === round && value.sample.control === control);
      assert.equal(matches.length, 1); return matches[0];
    };
    const baseline = Array.from({ length: 5 }, (_, round) => find('baseline', round));
    for (const row of rows) assert.deepEqual(row.oracles, baseline[0].oracles);
    for (const metric of Object.keys(baseline[0].metrics)) {
      const b = baseline.map(value => value.metrics[metric]);
      const aa = baseline.map((value, round) => find('baseline', round, 'AA').metrics[metric] - value.metrics[metric]);
      const aaRatios = baseline.map((value, round) => value.metrics[metric] === 0 ? null : find('baseline', round, 'AA').metrics[metric] / value.metrics[metric]);
      const noiseMaxAbsolute = Math.max(...aa.map(Math.abs));
      const comparisons = {};
      for (const arm of ['planning', 'lazy']) {
        const values = baseline.map((_, round) => find(arm, round).metrics[metric]);
        const differences = values.map((value, round) => value - b[round]);
        const ratios = values.map((value, round) => b[round] === 0 ? null : value / b[round]);
        comparisons[arm] = { values: stats(values), pairedDifferences: stats(differences), pairedRatios: ratios,
          allLower: differences.every(value => value < 0), allHigher: differences.every(value => value > 0),
          medianMagnitudeExceedsMaxObservedAA: Math.abs(quantile(differences, 0.5)) > noiseMaxAbsolute };
      }
      const lazyVsPlanning = baseline.map((_, round) => find('lazy', round).metrics[metric] - find('planning', round).metrics[metric]);
      report.push({ carrier, profile, metric, baseline: stats(b), aaDifferences: stats(aa), aaRatios, noiseMaxAbsolute,
        comparisons, lazyVsPlanning: stats(lazyVsPlanning) });
    }
  }
}
save(resolve(outputArg), { kind: plan.kind, cohort, analyzerSha256: sha(new URL(import.meta.url)), completedCohortSha256: sha(join(cohort, 'result.json')), packetSha256: plan.packetSha256,
  receipts: results.map(value => ({ path: value.receipt, sha256: value.receiptSha256 })), report,
  limits: 'Five paired differences per profile/carrier. A/A observed ranges are descriptive, not confidence intervals. Below-noise timing shifts are not evidence of a speedup. Heap is signed whole-process delta; ratios of negative/near-zero heap increments are not meaningful percentages. No cross-profile score or budget compensation.' });
console.log(JSON.stringify({ kind: plan.kind, children: results.length, rows: report.length, output: resolve(outputArg) }));
