#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { admitPacket, admitRun, assertNewOutput, hashText, lines, save, sha, strategies, verify } from './context-strategy-common.mjs';

export function stats(values) {
  const ordered = values.filter(value => value !== null).sort((a, b) => a - b);
  assert(ordered.every(Number.isFinite));
  return { n: ordered.length, missing: values.length - ordered.length, median: ordered.length ? (ordered[Math.floor((ordered.length - 1) / 2)] + ordered[Math.floor(ordered.length / 2)]) / 2 : null, min: ordered.length ? ordered[0] : null, max: ordered.length ? ordered.at(-1) : null };
}
const quantile = (values, q) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * q) - 1)];
function expectedContext(rows, phase) {
  const values = Array.from({ length: rows }, (_, index) => ({ id: `J-${index}`, instance: index === 0 && phase === 'replacement' ? 'context-replacement' : `initial-${index}`, title: `Inspect ${index % 3 === 0 ? 'pump' : 'valve'} ${index}`, owner: index === 0 && phase === 'accepted' ? 'Context Owner' : index === 0 && phase === 'replacement' ? 'Replacement Owner' : `Operator ${index % 10}`, status: 'queued', active: index % 2 === 0, ownerRevision: index === 0 && phase === 'accepted' ? 11 : index === 0 && phase === 'replacement' ? 40 : 10, statusRevision: index === 0 && phase === 'replacement' ? 40 : 10 }));
  return { canonicalSha256: hashText(JSON.stringify(values.map(value => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))))), bytes: Buffer.byteLength(JSON.stringify(values)) };
}
const expectedCache = new Map();
function checkContext(context, rows, phase, repeats) {
  const key = `${rows}:${phase}`;
  if (!expectedCache.has(key)) expectedCache.set(key, expectedContext(rows, phase));
  const expected = expectedCache.get(key);
  assert.equal(context.rows, rows); assert.equal(context.bytes, expected.bytes); assert.equal(context.canonicalSha256, expected.canonicalSha256);
  assert.match(context.sha256, /^[a-f0-9]{64}$/);
  assert.equal(context.repeated.length, repeats);
  for (const sample of [context.first, ...context.repeated]) {
    for (const name of ['materializeMs', 'serializeMs', 'totalMs']) assert(Number.isFinite(sample[name]) && sample[name] >= 0, `Invalid ${name}`);
    assert(Math.abs(sample.totalMs - sample.materializeMs - sample.serializeMs) < 0.00001, 'Context interval mismatch');
  }
}
export function extractMetrics(child) {
  const { rows, kind } = child.sample; assert(['timing', 'memory'].includes(kind));
  assert.deepEqual(Object.keys(child.contexts).sort(), ['accepted', 'initial', 'replacement']);
  assert.deepEqual(child.mutations, [{ passed: true, phase: 'accepted' }, { passed: true, phase: 'replacement' }]);
  assert.deepEqual(Object.keys(child.warm).sort(), ['full', 'selected']);
  checkContext(child.warm.selected, 50, 'initial', 0); checkContext(child.warm.full, rows, 'initial', 0);
  const output = {}, add = (key, value, unit, signed = false) => { assert(Number.isFinite(value) && (signed || value >= 0), `Invalid ${key}`); output[key] = { value, unit, signed }; };
  for (const key of ['seed', 'factory', 'bootstrapToLayout', 'navigationToLayout']) add(`startup.${key}`, child.startup[key], 'ms');
  for (const phase of ['initial', 'accepted', 'replacement']) {
    const contexts = child.contexts[phase]; assert.deepEqual(Object.keys(contexts).sort(), phase === 'initial' ? ['full', 'selected'] : ['full']);
    for (const [scope, context] of Object.entries(contexts)) {
      checkContext(context, scope === 'selected' ? 50 : rows, phase, kind === 'timing' ? 20 : 0);
      add(`${phase}.${scope}.bytes`, context.bytes, 'bytes');
      for (const metric of ['materializeMs', 'serializeMs', 'totalMs']) {
        add(`${phase}.${scope}.first.${metric}`, context.first[metric], 'ms');
        if (kind === 'timing') for (const [label, q] of [['p50', 0.5], ['p95', 0.95]]) add(`${phase}.${scope}.repeat.${label}.${metric}`, quantile(context.repeated.map(sample => sample[metric]), q), 'ms');
      }
    }
    assert.deepEqual(Object.keys(child.telemetry[phase]).sort(), ['LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration']);
    for (const [name, value] of Object.entries(child.telemetry[phase])) add(`${phase}.browser.${name}`, value, 'seconds');
  }
  if (kind === 'memory') {
    const names = ['blank', 'initial.populated', 'initial.afterDropped', 'post.populated', 'post.warmed', 'post.accepted.beforeRead', 'post.accepted.afterRead', 'post.replacement.beforeRead', 'post.replacement.afterRead', 'destroyed'];
    assert.deepEqual(child.heap.map(value => value.name), names);
    const heaps = Object.fromEntries(child.heap.map(value => [value.name, value.usedSize]));
    for (const [name, value] of Object.entries(heaps)) add(`heap.${name}`, value, 'bytes');
    add('heap.initialContextDelta', heaps['initial.afterDropped'] - heaps['initial.populated'], 'bytes', true);
    add('heap.postWarmDelta', heaps['post.warmed'] - heaps['post.populated'], 'bytes', true);
    for (const phase of ['accepted', 'replacement']) {
      add(`heap.${phase}.readDelta`, heaps[`post.${phase}.afterRead`] - heaps[`post.${phase}.beforeRead`], 'bytes', true);
      add(`heap.${phase}.abovePopulated`, heaps[`post.${phase}.afterRead`] - heaps['post.populated'], 'bytes', true);
    }
    add('heap.destroyedAboveBlank', heaps.destroyed - heaps.blank, 'bytes', true);
  } else assert.deepEqual(child.heap, []);
  return output;
}
export function summarize(children) {
  const samples = children.map(child => ({ ...child, metrics: extractMetrics(child) })), groups = [], pairs = [], sameArm = [];
  for (const rows of [1000, 10000]) for (const kind of ['timing', 'memory']) for (const arm of lines) {
    const select = strategy => samples.filter(child => child.sample.rows === rows && child.sample.kind === kind && child.sample.arm === arm && child.sample.strategy === strategy && !child.sample.aa).sort((a, b) => a.sample.round - b.sample.round);
    const point = select('point'); assert.deepEqual(point.map(child => child.sample.round), [0, 1, 2, 3, 4]);
    for (const strategy of strategies) {
      const chosen = select(strategy); assert.deepEqual(chosen.map(child => child.sample.round), [0, 1, 2, 3, 4]);
      const keys = Object.keys(chosen[0].metrics); for (const child of chosen) assert.deepEqual(Object.keys(child.metrics), keys);
      groups.push({ rows, kind, arm, strategy, metrics: Object.fromEntries(keys.map(key => [key, { unit: chosen[0].metrics[key].unit, signed: chosen[0].metrics[key].signed, ...stats(chosen.map(child => child.metrics[key].value)) }])) });
      if (strategy !== 'point') pairs.push({ rows, kind, arm, numerator: strategy, denominator: 'point', metrics: Object.fromEntries(keys.map(key => {
        const signed = chosen[0].metrics[key].signed, values = chosen.map((child, index) => ({ candidate: child.metrics[key].value, baseline: point[index].metrics[key].value }));
        return [key, { unit: chosen[0].metrics[key].unit, signed, differences: stats(values.map(value => value.candidate - value.baseline)), ratios: signed ? null : stats(values.map(value => value.baseline > 0 ? value.candidate / value.baseline : null)), pairs: values }];
      })) });
    }
    const aa = samples.filter(child => child.sample.rows === rows && child.sample.kind === kind && child.sample.arm === arm && child.sample.aa); assert.equal(aa.length, 4);
    const paired = [0, 1].map(round => [0, 1].map(member => { const found = aa.filter(child => child.sample.round === round && child.sample.member === member); assert.equal(found.length, 1); assert.equal(found[0].sample.strategy, 'point'); return found[0]; }));
    sameArm.push({ rows, kind, arm, strategy: 'point', metrics: Object.fromEntries(Object.keys(point[0].metrics).map(key => [key, { unit: point[0].metrics[key].unit, signed: point[0].metrics[key].signed, differences: stats(paired.map(([first, second]) => second.metrics[key].value - first.metrics[key].value)) }])) });
  }
  return { groups, pairs, sameArm };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [packetArg, inputArg, outputArg] = process.argv.slice(2); assert(packetArg && inputArg && outputArg);
  const packet = resolve(packetArg), input = resolve(inputArg), out = resolve(outputArg); assertNewOutput(out);
  const admitted = admitPacket(packet), run = admitRun(join(input, 'results.json'), 'compare', admitted.identity, extractMetrics);
  const bindings = { ...admitted.bindings, ...run.bindings };
  for (const mode of ['controls', 'calibration']) {
    const path = run.schedule.admissions[mode]; assert(path, `Missing ${mode} admission`);
    const receipt = admitRun(path, mode === 'calibration' ? 'calibrate' : mode, admitted.identity, extractMetrics);
    assert.equal(run.schedule.bindings[path], sha(path), `Unbound ${mode} receipt`); Object.assign(bindings, receipt.bindings);
  }
  const summary = { identity: admitted.identity, bindings, ...summarize(run.children), limits: ['Five descriptive fresh-process main samples per line/strategy/profile/kind; two same-build point pairs are not confidence intervals.', 'Materialization/serialization are browser elapsed intervals. CDP task/script/layout categories overlap and include context validation; not process CPU and not additive.', 'Memory uses separate forced-GC children; deltas include app/framework/kernel caches, context values are dropped, not allocation or universal leak evidence.', 'Initial and post-edit sessions use separate documents within the same child browser. Accepted and replacement phases share that post-edit store in stated order.', 'No competing-library ranking, general agent productivity, model quality, network or durable-server claims.'] };
  verify(bindings); mkdirSync(out, { recursive: true }); save(join(out, 'summary.json'), summary);
  const rows = summary.groups.filter(group => group.rows === 10000).map(group => `| ${group.arm} | ${group.strategy} | ${group.kind} | ${group.metrics['initial.full.first.materializeMs'].median.toFixed(3)} | ${group.metrics['accepted.full.first.materializeMs'].median.toFixed(3)} | ${group.metrics['replacement.full.first.materializeMs'].median.toFixed(3)} | ${group.metrics['heap.initialContextDelta']?.median ?? '—'} |`);
  writeFileSync(join(out, 'summary.md'), '# Context strategy comparison\n\n10,000 rows; five samples per cell. Milliseconds below are materialization elapsed, not CPU.\n\n| Line | Strategy | Kind | Initial first ms | After edit first ms | After replacement first ms | Post-context heap delta bytes |\n| --- | --- | --- | ---: | ---: | ---: | ---: |\n' + rows.join('\n') + '\n\n' + summary.limits.map(limit => '- ' + limit).join('\n') + '\n', { flag: 'wx' });
  save(join(out, 'receipt.json'), { identity: admitted.identity, bindings, summarySha256: sha(join(out, 'summary.json')), markdownSha256: sha(join(out, 'summary.md')), command: [process.execPath, ...process.argv.slice(1)] });
}
