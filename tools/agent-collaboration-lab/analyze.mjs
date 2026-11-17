#!/usr/bin/env node
import assert from 'node:assert/strict';
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
assert.equal(result.planned, 136); assert.equal(result.completed, 136);
assert.equal(schedule.schedule.length, 136); assert.equal(result.children.length, 136);
const bindings = { [resultPath]: sha(resultPath), [schedulePath]: sha(schedulePath), [fileURLToPath(import.meta.url)]: sha(fileURLToPath(import.meta.url)) };
for (const [path, expected] of Object.entries(schedule.bindings)) assert.equal(sha(path), expected, `Input drift: ${path}`);
// The collector admits both receipts before execution. Re-admit their identities
// here so an edited results label cannot misattribute otherwise intact children.
const sourceDirectory = dirname(fileURLToPath(import.meta.url));
for (const [key, file] of Object.entries({ runnerSha256: 'measure.mjs', browserMetricsSha256: 'browser-metrics.mjs', protocolSha256: 'metrics-protocol.md', inputResolverSha256: 'historical-inputs.mjs' })) {
  assert.equal(result.sourceIdentity[key], schedule.bindings[join(sourceDirectory, file)], `Source identity: ${key}`);
}
for (const [mode, count] of [['controls', 9], ['calibrate', 12]]) {
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
  assert.deepEqual(sample.errors, []); return sample;
});
const quantile = (values, q) => {
  if (!values.length) return null;
  assert(values.every(value => typeof value === 'number' && Number.isFinite(value)));
  return [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * q) - 1)];
};
const stats = values => {
  const present = values.filter(value => value !== null);
  const ordered = [...present].sort((a, b) => a - b);
  const median = ordered.length ? (ordered[Math.floor((ordered.length - 1) / 2)] + ordered[Math.floor(ordered.length / 2)]) / 2 : null;
  return { n: present.length, missing: values.length - present.length, median, min: present.length ? Math.min(...present) : null, max: present.length ? Math.max(...present) : null };
};
function metrics(sample) {
  const values = {};
  const add = (name, value, unit, signed = false, allowMissing = false) => {
    assert((allowMissing && value === null) || (Number.isFinite(value) && (signed || value >= 0)), `Bad ${name}`);
    values[name] = { value, unit, signed };
  };
  assert.deepEqual(Object.keys(sample.context).sort(), ['full', 'selected']);
  assert.equal(sample.context.selected.rows, 50); assert.equal(sample.context.full.rows, sample.rows);
  assert.deepEqual(sample.pressure.map(value => value.staged.count), [8, 32, 128]);
  assert.deepEqual(sample.pressure.map(value => value.settled.count), [8, 32, 128]);
  // Groups retain kind: forced-GC startup observations never enter timing groups.
  for (const name of ['seed', 'factory', 'bootstrapToLayout', 'navigationToLayout']) add(`startup.${name}`, sample.startup[name], 'ms');
  if (sample.kind === 'timing') {
    for (const [name, context] of Object.entries(sample.context)) {
      assert.equal(context.repeated.length, 20);
      add(`context.${name}.bytes`, context.bytes, 'bytes');
      for (const phase of ['materializeMs', 'serializeMs', 'totalMs']) {
        add(`context.${name}.first.${phase}`, context.first[phase], 'ms');
        add(`context.${name}.repeated.p50.${phase}`, quantile(context.repeated.map(value => value[phase]), 0.5), 'ms');
        add(`context.${name}.repeated.p95.${phase}`, quantile(context.repeated.map(value => value[phase]), 0.95), 'ms');
      }
    }
    for (const pressure of sample.pressure) for (const phase of ['staged', 'settled']) {
      const value = pressure[phase]; assert.equal(value.samples.length, value.count);
      add(`pressure.${value.count}.${phase}.elapsed`, value.elapsedMs, 'ms');
      add(`pressure.${value.count}.${phase}.p95`, quantile(value.samples, 0.95), 'ms');
    }
    const run = sample.interleaved;
    assert.equal(run.rounds, 20); assert.equal(run.checkedCommands, 180); assert.equal(run.user.length, 20);
    assert.equal(run.context.length, 20); assert.equal(run.visibility, 'visible');
    add('interleaved.complete.elapsed', run.elapsedMs, 'ms');
    add('interleaved.checkedCommandsPerSecond', run.commandsPerSecond, 'commands/second');
    assert.equal(run.commandsPerSecond, 180000 / run.elapsedMs);
    for (const name of ['enqueueToHandlerMs', 'handlerToLayoutMs', 'clickToLayoutMs', 'enqueueToLayoutMs']) {
      add(`interleaved.user.p95.${name}`, quantile(run.user.map(value => value[name]), 0.95), 'ms');
      add(`interleaved.user.maximum.${name}`, Math.max(...run.user.map(value => value[name])), 'ms');
    }
    add('interleaved.context.p95', quantile(run.context.map(value => value.elapsedMs), 0.95), 'ms');
    add('frames.baseline.medianGap', quantile(run.refreshBaselineGapsMs, 0.5), 'ms');
    add('frames.active.sampleCount', run.frameGapsMs.length, 'observations');
    add('frames.active.p95Gap', quantile(run.frameGapsMs, 0.95), 'ms', false, true);
    add('frames.active.maximumGap', run.frameGapsMs.length ? Math.max(...run.frameGapsMs) : null, 'ms', false, true);
    assert.deepEqual(Object.keys(sample.browserDurationSeconds).sort(), ['LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration']);
    for (const [name, value] of Object.entries(sample.browserDurationSeconds)) add(`browser.${name}`, value, 'seconds');
  } else {
    assert.equal(sample.kind, 'memory');
    for (const [name, context] of Object.entries(sample.context)) {
      assert.deepEqual(context.repeated, []);
      add(`context.${name}.bytes`, context.bytes, 'bytes');
      for (const phase of ['materializeMs', 'serializeMs', 'totalMs']) add(`context.${name}.first.${phase}`, context.first[phase], 'ms');
    }
    const heap = Object.fromEntries(sample.heap.map(point => [point.name, point.usedSize]));
    assert.equal(sample.heap.length, Object.keys(heap).length);
    assert.deepEqual(Object.keys(heap), ['blank', 'populated', 'after-contexts-dropped', ...[8, 32, 128].flatMap(count => [`populated-${count}`, `pending-${count}`, `settled-${count}`]), 'destroyed']);
    for (const [name, value] of Object.entries(heap)) add(`heap.${name}`, value, 'bytes');
    add('heap.populatedAboveBlank', heap.populated - heap.blank, 'bytes', true);
    add('heap.contextCacheDelta', heap['after-contexts-dropped'] - heap.populated, 'bytes', true);
    for (const count of [8, 32, 128]) {
      add(`heap.pending${count}AbovePopulated`, heap[`pending-${count}`] - heap[`populated-${count}`], 'bytes', true);
      add(`heap.settled${count}AbovePopulated`, heap[`settled-${count}`] - heap[`populated-${count}`], 'bytes', true);
    }
    add('heap.destroyedAboveBlank', heap.destroyed - heap.blank, 'bytes', true);
  }
  return values;
}
for (const sample of samples) sample.metrics = metrics(sample);
const arms = ['native', 'ngrx', 'v15', 'v16', 'tanstack', 'tanstack-variant'];
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
  for (const [left, right] of [['v15', 'native'], ['v15', 'ngrx'], ['v16', 'v15'], ['v16', 'native'], ['tanstack', 'native'], ['tanstack-variant', 'tanstack']]) pairs.push({ rows, kind, numerator: left, denominator: right, metrics: pairMetrics(cohort[left], cohort[right]) });
  const aa = [0, 1].map(member => samples.filter(sample => sample.rows === rows && sample.kind === kind && sample.aa && sample.member === member).sort((a, b) => a.round - b.round));
  assert.deepEqual(aa.map(list => list.map(sample => sample.round)), [[0, 1], [0, 1]]);
  sameArm.push({ rows, kind, arm: 'v15', metrics: pairMetrics(aa[1], aa[0]) });
}
mkdirSync(output, { recursive: true });
const summary = { source: result.sourceIdentity, bindings, groups, pairs, sameArm, limits: ['Five descriptive fresh-process samples per arm/profile/kind; no population confidence interval.', 'Per-child p95s summarized across children, never pooled.', 'Memory includes library/framework/application and in-memory service logs; contexts are dropped before GC.', 'Whole trace throughput and browser durations include validation/service work. Browser duration categories overlap and must not be summed.', 'Frame callback gaps are observations, not dropped-frame counts; absent samples retain null/missing statistics.', 'Model/network latency, actual agent reasoning, token cost, durable backend recovery and general production security are not measured.'] };
writeFileSync(join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log(join(output, 'summary.json'));
