import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { read, sha, save, verify } from './common.mjs';

const [cohortArg, outputArg] = process.argv.slice(2), cohort = resolve(cohortArg);
const completion = read(join(cohort, 'result.json')), plan = read(join(cohort, 'plan.json'));
assert.equal(completion.passed, true); assert.equal(completion.bindingsUnchanged, true); assert.equal(completion.sameObservableWork, true);
assert.equal(completion.kind, 'cpu'); assert.equal(plan.kind, 'cpu'); assert.equal(plan.episodes, 12);
assert.equal(completion.children, 112); assert.equal(plan.samples.length, 112);
assert.equal(completion.packetSha256, plan.packetSha256); assert.equal(sha(plan.packetPath), plan.packetSha256); verify(plan.bindings);
const timingMetrics = timing => ({ wallMs: timing.wallNs / 1e6, cpuMs: (timing.userUs + timing.systemUs) / 1000 });
const results = [];
for (const [index, sample] of plan.samples.entries()) {
  assert.equal(sample.index, index); assert.equal(sample.fault, undefined);
  const receiptPath = join(cohort, `receipt-${index}.json`), receipt = read(receiptPath);
  const resultPath = join(cohort, `result-${index}.json`), result = read(resultPath);
  assert.deepEqual(receipt.sample, sample); assert.deepEqual(result.sample, sample);
  assert.equal(receipt.exitCode, 0); assert.equal(receipt.passed, true); assert.equal(result.passed, true);
  for (const [path, hash] of [[resultPath, receipt.resultSha256], [resultPath + '.stdout', receipt.stdoutSha256], [resultPath + '.stderr', receipt.stderrSha256], [join(cohort, `input-${index}.json`), receipt.inputSha256]]) assert.equal(sha(path), hash);
  assert.deepEqual(result.episodes.map(value => value.episode), Array.from({ length: 12 }, (_, i) => i));
  const metrics = {};
  for (const [group, episodes] of Object.entries({ cold: result.episodes.slice(0, 1), warmed11: result.episodes.slice(1), all12: result.episodes })) {
    for (const episode of episodes) {
      assert.deepEqual(episode.oracles, result.episodes[0].oracles);
      for (const [stage, timing] of Object.entries(episode.stages)) for (const [unit, value] of Object.entries(timingMetrics(timing)))
        metrics[`${group}.${stage}.${unit}`] = (metrics[`${group}.${stage}.${unit}`] ?? 0) + value;
    }
    for (const unit of ['wallMs', 'cpuMs']) metrics[`${group}.allFactories.${unit}`] = metrics[`${group}.firstFactory.${unit}`] + metrics[`${group}.remainingFactories.${unit}`];
  }
  for (const [name, timing] of Object.entries({ moduleImport: result.import, repeatedIncludingChecks: result.repeatedIncludingChecks }))
    for (const [unit, value] of Object.entries(timingMetrics(timing))) metrics[`${name}.${unit}`] = value;
  for (const value of Object.values(metrics)) assert(Number.isFinite(value));
  results.push({ sample, metrics, oracles: result.episodes.map(value => value.oracles), receipt: receiptPath, receiptSha256: sha(receiptPath) });
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const stats = samples => ({ samples, median: median(samples), min: Math.min(...samples), max: Math.max(...samples) });
const report = [];
for (const carrier of ['neutral', 'angular']) for (const profile of ['ordinary', 'late-root']) {
  const rows = results.filter(value => value.sample.carrier === carrier && value.sample.profile.id === profile);
  assert.equal(rows.length, 28);
  const find = (arm, round, control) => {
    const matches = rows.filter(value => value.sample.arm === arm && value.sample.round === round && value.sample.control === control);
    assert.equal(matches.length, 1); return matches[0];
  };
  const baseline = Array.from({ length: 7 }, (_, round) => find('baseline', round));
  for (const row of rows) assert.deepEqual(row.oracles, baseline[0].oracles);
  for (const metric of Object.keys(baseline[0].metrics)) {
    const b = baseline.map(value => value.metrics[metric]);
    const aa = b.map((value, round) => find('baseline', round, 'AA').metrics[metric] - value);
    const noiseMaxAbsolute = Math.max(...aa.map(Math.abs)), comparisons = {};
    for (const arm of ['planning', 'lazy']) {
      const values = b.map((_, round) => find(arm, round).metrics[metric]), differences = values.map((value, round) => value - b[round]);
      comparisons[arm] = { values: stats(values), pairedDifferences: stats(differences), pairedRatios: values.map((value, round) => b[round] === 0 ? null : value / b[round]),
        allLower: differences.every(value => value < 0), allHigher: differences.every(value => value > 0),
        medianMagnitudeExceedsMaxObservedAA: Math.abs(median(differences)) > noiseMaxAbsolute };
    }
    report.push({ carrier, profile, metric, baseline: stats(b), aaDifferences: stats(aa), aaRatios: b.map((value, round) => value === 0 ? null : find('baseline', round, 'AA').metrics[metric] / value),
      noiseMaxAbsolute, comparisons, lazyVsPlanning: stats(b.map((_, round) => find('lazy', round).metrics[metric] - find('planning', round).metrics[metric])) });
  }
}
save(resolve(outputArg), { kind: 'repeated-lifetimes-cpu', cohort, analyzerSha256: sha(new URL(import.meta.url)), completedCohortSha256: sha(join(cohort, 'result.json')), packetSha256: plan.packetSha256,
  receipts: results.map(value => ({ path: value.receipt, sha256: value.receiptSha256 })), report,
  limits: 'Seven paired differences; A/A ranges are descriptive, not confidence intervals. Cold episode, warmed eleven lifetime sums and all twelve reported separately. Independent fresh processes, repeated store lifetimes inside each. Original adverse cohort remains evidence; no application-throughput or one-long-lived-store claim.' });
console.log(JSON.stringify({ children: results.length, rows: report.length, output: resolve(outputArg) }));
