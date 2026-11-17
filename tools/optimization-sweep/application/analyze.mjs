#!/usr/bin/env node
import assert from 'node:assert/strict';
import { metrics } from './metrics-schema.mjs';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [inputArg, outputArg] = process.argv.slice(2);
assert(inputArg && outputArg);
const input = resolve(inputArg), output = resolve(outputArg);
assert(!existsSync(output), 'Preserve previous analysis');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const resultPath = join(input, 'results.json'), schedulePath = join(input, 'schedule.json');
const result = read(resultPath), schedule = read(schedulePath);
assert.equal(result.mode, 'compare'); assert.equal(result.passed, true);
assert.equal(schedule.mode, 'compare');
assert.equal(result.planned, 176); assert.equal(result.completed, 176);
assert.equal(schedule.schedule.length, 176); assert.equal(result.children.length, 176);
const expectedSchedule = [], expectedArms = ['native', 'ngrx', 'v15-before', 'v15', 'v16-before', 'v16', 'tanstack', 'tanstack-variant'];
for (const rows of [1000, 10000]) for (let round = 0; round < 5; round++) {
  for (const arm of expectedArms.map((_, index) => expectedArms[(index + round) % expectedArms.length])) for (const kind of ['timing', 'memory']) expectedSchedule.push({ arm, rows, round, kind });
  if (round < 2) for (const member of [0, 1]) for (const kind of ['timing', 'memory']) expectedSchedule.push({ arm: 'v15', rows, round, kind, aa: true, member });
}
assert.deepEqual(schedule.schedule, expectedSchedule, 'Exact registered cohort');
const bindings = { [resultPath]: sha(resultPath), [schedulePath]: sha(schedulePath), [fileURLToPath(import.meta.url)]: sha(fileURLToPath(import.meta.url)) };
for (const [path, expected] of Object.entries(schedule.bindings)) assert.equal(sha(path), expected, `Input drift: ${path}`);
// The collector admits both receipts before execution. Re-admit their identities
// here so an edited results label cannot misattribute otherwise intact children.
const sourceDirectory = dirname(fileURLToPath(import.meta.url));
for (const [key, file] of Object.entries({ runnerSha256: 'measure.mjs', browserMetricsSha256: 'browser-metrics.mjs', protocolSha256: 'metrics-protocol.md', inputResolverSha256: 'historical-inputs.mjs', metricSchemaSha256: 'metrics-schema.mjs' })) {
  assert.equal(result.sourceIdentity[key], schedule.bindings[join(sourceDirectory, file)], `Source identity: ${key}`);
}
for (const [pathKey, digestKey] of [['planPath', 'planSha256'], ['buildPath', 'buildSha256'], ['conformancePath', 'conformanceSha256'], ['contextControlsPath', 'contextControlsSha256']]) {
  const path = result.sourceIdentity[pathKey]; assert.equal(typeof path, 'string');
  assert.equal(schedule.bindings[path], result.sourceIdentity[digestKey], `Actual bound ${pathKey} identity`);
  assert.equal(sha(path), result.sourceIdentity[digestKey]);
}
const actualPlan = read(result.sourceIdentity.planPath), actualBuild = read(result.sourceIdentity.buildPath);
assert.deepEqual(actualPlan.arms, expectedArms); assert.equal(actualBuild.planSha256, result.sourceIdentity.planSha256);
assert.deepEqual(Object.keys(actualBuild.arms).sort(), [...expectedArms].sort());
const required = { ...actualPlan.inputs };
for (const arm of Object.values(actualBuild.arms)) Object.assign(required, arm.dependencies, arm.served);
for (const [path, expected] of Object.entries(required)) assert.equal(schedule.bindings[path], expected, `Mandatory source/dependency/served binding: ${path}`);
for (const [mode, count] of [['controls', 9], ['calibrate', 16]]) {
  const receipts = Object.keys(schedule.bindings).filter(path => path.endsWith('/results.json')).map(read).filter(value => value.mode === mode && value.sourceIdentity?.runnerSha256 === result.sourceIdentity.runnerSha256);
  assert.equal(receipts.length, 1, `Expected one admitted ${mode} receipt`);
  const receipt = receipts[0];
  assert.equal(receipt.passed, true); assert.equal(receipt.completed, count); assert.equal(receipt.planned, count);
  assert.deepEqual(result.sourceIdentity, receipt.sourceIdentity, `Source identity differs from ${mode}`);
}
const samples = result.children.map((entry, index) => {
  assert.equal(entry.index, index); assert.equal(entry.passed, true);
  const path = join(input, entry.path); assert.equal(sha(path), entry.sha256, `Child payload mismatch: ${entry.index}`); bindings[path] = entry.sha256;
  const sample = read(path); assert.equal(sample.passed, true); assert.equal(sample.index, index);
  for (const [key, value] of Object.entries(schedule.schedule[index])) assert.deepEqual(sample[key], value);
  assert(sample.aa === undefined || sample.aa === true, 'Unexpected A/A classification');
  if (sample.aa === true) assert.equal(sample.arm, 'v15');
  else assert.equal(sample.member, undefined);
  assert.deepEqual(sample.errors, []); assert(!Object.hasOwn(sample, 'cleanupError')); assert(!Object.hasOwn(sample, 'failure')); return sample;
});
const stats = values => {
  const present = values.filter(value => value !== null);
  const ordered = [...present].sort((a, b) => a - b);
  const median = ordered.length ? (ordered[Math.floor((ordered.length - 1) / 2)] + ordered[Math.floor(ordered.length / 2)]) / 2 : null;
  return { n: present.length, missing: values.length - present.length, median, min: present.length ? Math.min(...present) : null, max: present.length ? Math.max(...present) : null };
};
for (const sample of samples) sample.metrics = metrics(sample);
const arms = ['native', 'ngrx', 'v15-before', 'v15', 'v16-before', 'v16', 'tanstack', 'tanstack-variant'];
const groups = [], pairs = [], sameArm = [];
function pairMetrics(left, right) {
  assert.equal(left.length, right.length);
  return Object.fromEntries(Object.keys(left[0].metrics).map(name => {
    const first = left[0].metrics[name];
    assert(right.every(sample => sample.metrics[name]?.unit === first.unit));
    const differences = left.map((sample, i) => sample.metrics[name].value === null || right[i].metrics[name].value === null ? null : sample.metrics[name].value - right[i].metrics[name].value);
    const ratios = first.signed ? null : left.map((sample, i) => sample.metrics[name].value === null || !(right[i].metrics[name].value > 0) ? null : sample.metrics[name].value / right[i].metrics[name].value);
    return [name, { unit: first.unit, difference: stats(differences), ratio: ratios ? stats(ratios) : null }];
  }));
}
for (const rows of [1000, 10000]) for (const kind of ['timing', 'memory']) {
  const cohort = {};
  for (const arm of arms) {
    const selected = samples.filter(sample => sample.rows === rows && sample.kind === kind && sample.arm === arm && !sample.aa).sort((a, b) => a.round - b.round);
    assert.deepEqual(selected.map(sample => sample.round), [0, 1, 2, 3, 4]); cohort[arm] = selected;
    const names = Object.keys(selected[0].metrics); for (const sample of selected) assert.deepEqual(Object.keys(sample.metrics), names);
    groups.push({ rows, kind, arm, metrics: Object.fromEntries(names.map(name => [name, { unit: selected[0].metrics[name].unit, signed: selected[0].metrics[name].signed, ...stats(selected.map(sample => sample.metrics[name].value)) }])) });
  }
  for (const [left, right] of [['v15', 'v15-before'], ['v16', 'v16-before'], ['v15', 'native'], ['v15', 'ngrx'], ['v16', 'v15'], ['v16', 'native'], ['tanstack', 'native'], ['tanstack-variant', 'tanstack']]) pairs.push({ rows, kind, numerator: left, denominator: right, metrics: pairMetrics(cohort[left], cohort[right]) });
  const aa = [0, 1].map(member => samples.filter(sample => sample.rows === rows && sample.kind === kind && sample.aa && sample.member === member).sort((a, b) => a.round - b.round));
  assert.deepEqual(aa.map(list => list.map(sample => sample.round)), [[0, 1], [0, 1]]);
  sameArm.push({ rows, kind, arm: 'v15', metrics: pairMetrics(aa[1], aa[0]) });
}
mkdirSync(output, { recursive: true });
const summary = { source: result.sourceIdentity, bindings, groups, pairs, sameArm, limits: ['Five descriptive fresh-process samples per arm/profile/kind; no population confidence interval.', 'Per-child p95s summarized across children, never pooled.', 'Memory includes library/framework/application and in-memory service logs; contexts are dropped before GC.', 'Whole trace throughput and browser durations include validation/service work. Browser duration categories overlap and must not be summed.', 'Frame callback gaps are observations, not dropped-frame counts; absent samples retain null/missing statistics.', 'Model/network latency, actual agent reasoning, token cost, durable backend recovery and general production security are not measured.'] };
writeFileSync(join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log(join(output, 'summary.json'));
