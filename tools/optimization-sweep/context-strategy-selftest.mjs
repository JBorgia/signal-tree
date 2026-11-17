#!/usr/bin/env node
// Synthetic helper controls only. No browser, package build or measurement.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { admitRun, assertNewOutput, faults, hashText, here, lines, read, save, scheduleFor, sha, sourceBindings, strategies } from './context-strategy-common.mjs';
import { extractMetrics, stats, summarize } from './context-strategy-analyze.mjs';
import { contextStrategyProbe } from './context-strategy-probe.mjs';
import { verifyExecution } from './context-strategy-execution.mjs';

const out = resolve(process.argv[2] ?? ''); assert(process.argv[2]); assertNewOutput(out); mkdirSync(out, { recursive: true });
const checks = [];
const check = async (name, work) => { await work(); checks.push({ name, passed: true }); };
const expected = (rows, phase = 'initial') => Array.from({ length: rows }, (_, i) => ({ id: `J-${i}`, instance: i === 0 && phase === 'replacement' ? 'context-replacement' : `initial-${i}`, title: `Inspect ${i % 3 === 0 ? 'pump' : 'valve'} ${i}`, owner: i === 0 && phase === 'accepted' ? 'Context Owner' : i === 0 && phase === 'replacement' ? 'Replacement Owner' : `Operator ${i % 10}`, status: 'queued', active: i % 2 === 0, ownerRevision: i === 0 && phase === 'accepted' ? 11 : i === 0 && phase === 'replacement' ? 40 : 10, statusRevision: i === 0 && phase === 'replacement' ? 40 : 10 }));
await check('fixed schedule and unique paired cohort identities', () => {
  assert.equal(scheduleFor('controls').length, 36); assert.equal(scheduleFor('calibrate').length, 12);
  const schedule = scheduleFor('compare'); assert.equal(schedule.length, 152);
  const main = schedule.filter(value => !value.aa), aa = schedule.filter(value => value.aa); assert.equal(main.length, 120); assert.equal(aa.length, 32);
  assert.equal(new Set(main.map(value => `${value.arm}:${value.strategy}:${value.rows}:${value.round}:${value.kind}`)).size, 120);
  for (const rows of [1000, 10000]) for (let round = 0; round < 5; round++) for (const arm of lines) {
    const order = main.filter(value => value.rows === rows && value.round === round && value.arm === arm && value.kind === 'timing').map(value => value.strategy);
    assert.deepEqual(order, strategies.map((_, index) => strategies[(index + round + lines.indexOf(arm)) % 3]));
  }
  for (const rows of [1000, 10000]) for (const arm of lines) for (const kind of ['timing', 'memory']) for (const round of [0, 1]) assert.deepEqual(aa.filter(value => value.rows === rows && value.arm === arm && value.kind === kind && value.round === round).map(value => value.member), [0, 1]);
});
await check('actual selected50 probe stays point while full retrieval changes', async () => {
  const rows = expected(1000);
  for (const strategy of strategies) {
    const counts = { point: 0, bulk: 0, ordered: 0 };
    const get = id => rows[Number(id.slice(2))];
    globalThis.window = { lab: { row: id => { counts.point++; return get(id); }, contextRows: ids => { counts.bulk++; return ids.map(get); }, contextRowsOrdered: ids => { counts.ordered++; return ids.map(get); } } };
    const result = await contextStrategyProbe({ rows: 1000, repetitions: 2, strategy });
    assert.equal(result.full.repeated.length, 2); assert.equal(result.selected.rows, 50);
    assert.deepEqual(counts, strategy === 'point' ? { point: 3150, bulk: 0, ordered: 0 } : strategy === 'bulk' ? { point: 150, bulk: 3, ordered: 0 } : { point: 150, bulk: 0, ordered: 3 });
    for (const fault of ['context-truncated', 'context-corrupt']) await assert.rejects(contextStrategyProbe({ rows: 1000, repetitions: 0, strategy, fault }), /context-content-oracle/);
  }
  delete globalThis.window;
});
const sampleCache = new Map();
function context(rows, phase, repeats) {
  const key = `${rows}:${phase}`;
  if (!sampleCache.has(key)) { const data = expected(rows, phase), json = JSON.stringify(data), canonical = JSON.stringify(data.map(row => Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))))); sampleCache.set(key, { rows, bytes: Buffer.byteLength(json), sha256: hashText(json), canonicalSha256: hashText(canonical) }); }
  return { ...sampleCache.get(key), first: { materializeMs: 1, serializeMs: 2, totalMs: 3 }, repeated: Array.from({ length: repeats }, () => ({ materializeMs: 1, serializeMs: 2, totalMs: 3 })) };
}
function synthetic(sample, index) {
  const repeats = sample.kind === 'timing' ? 20 : 0, rows = sample.rows;
  return { sample, index, passed: true, browser: 'synthetic-browser', errors: [], startup: { seed: 1, factory: 1, bootstrapToLayout: 2, navigationToLayout: 3 }, contexts: { initial: { selected: context(50, 'initial', repeats), full: context(rows, 'initial', repeats) }, accepted: { full: context(rows, 'accepted', repeats) }, replacement: { full: context(rows, 'replacement', repeats) } }, warm: { selected: context(50, 'initial', 0), full: context(rows, 'initial', 0) }, mutations: [{ passed: true, phase: 'accepted' }, { passed: true, phase: 'replacement' }], telemetry: Object.fromEntries(['initial', 'accepted', 'replacement'].map(phase => [phase, { TaskDuration: 0.01, ScriptDuration: 0.005, LayoutDuration: 0, RecalcStyleDuration: 0 }])), heap: sample.kind === 'memory' ? ['blank', 'initial.populated', 'initial.afterDropped', 'post.populated', 'post.warmed', 'post.accepted.beforeRead', 'post.accepted.afterRead', 'post.replacement.beforeRead', 'post.replacement.afterRead', 'destroyed'].map((name, index) => ({ name, usedSize: 10000 - index * 10 })) : [] };
}
const samples = scheduleFor('compare').map(synthetic);
await check('complete analyzer, exact pairs and signed heap differences', () => {
  const summary = summarize(samples); assert.equal(summary.groups.length, 24); assert.equal(summary.pairs.length, 16); assert.equal(summary.sameArm.length, 8);
  assert(summary.pairs.every(pair => pair.metrics['initial.full.first.materializeMs'].differences.median === 0));
  assert(summary.pairs.filter(pair => pair.kind === 'memory').every(pair => pair.metrics['heap.initialContextDelta'].ratios === null));
  assert.deepEqual(stats([null, 1, 3]), { n: 2, missing: 1, median: 2, min: 1, max: 3 });
  const reversed = summarize([...samples].reverse()); assert.deepEqual(reversed, summary);
});
for (const [name, alter] of [
  ['missing phase', value => { delete value.contexts.accepted; }],
  ['missing replacement rows', value => { delete value.contexts.replacement.full; }],
  ['wrong canonical identity', value => { value.contexts.initial.full.canonicalSha256 = '0'.repeat(64); }],
  ['missing repeat', value => { value.contexts.initial.full.repeated.pop(); }],
  ['invalid duration', value => { value.contexts.initial.full.first.totalMs = -1; }],
  ['missing actual edit result', value => { value.mutations.pop(); }],
]) await check(`analyzer rejects ${name}`, () => { const value = structuredClone(samples.find(child => child.sample.kind === 'timing')); alter(value); assert.throws(() => extractMetrics(value)); });
await check('missing main sample cannot become a report', () => assert.throws(() => summarize(samples.slice(1))));
await check('zero duration has missing ratios rather than infinity', () => {
  const zero = structuredClone(samples);
  for (const child of zero) { child.contexts.initial.full.first = { materializeMs: 0, serializeMs: 2, totalMs: 2 }; }
  const summary = summarize(zero); assert(summary.pairs.every(pair => pair.metrics['initial.full.first.materializeMs'].ratios.n === 0));
});
await check('receipt admission rejects identity and payload corruption', () => {
  const directory = join(out, 'synthetic-receipt'); mkdirSync(directory);
  const identity = { syntheticOnly: true, execution: { browser: { version: 'synthetic-browser' } } }, schedule = scheduleFor('controls');
  const schedulePath = join(directory, 'schedule.json'); save(schedulePath, { mode: 'controls', schedule, identity, bindings: {} });
  const children = schedule.map((sample, index) => {
    const path = `child-${index}.json`; save(join(directory, path), { sample, index, passed: true, browser: 'synthetic-browser', errors: [], expectedControlObserved: sample.fault !== null, detectedOracle: faults[sample.fault], conformance: sample.fault === null ? { passed: true, destroyed: true } : undefined });
    return { index, path, passed: true, sha256: sha(join(directory, path)) };
  });
  const resultPath = join(directory, 'results.json'); save(resultPath, { mode: 'controls', identity, planned: schedule.length, completed: schedule.length, passed: true, scheduleSha256: sha(schedulePath), children });
  admitRun(resultPath, 'controls', identity);
  assert.throws(() => admitRun(resultPath, 'controls', { wrong: true }));
  const first = join(directory, 'child-0.json'); writeFileSync(first, '{}\n'); assert.throws(() => admitRun(resultPath, 'controls', identity), /AssertionError/);
  // Preserve deliberately corrupted synthetic fixture as a control, not evidence.
});
await check('calibration requires complete metrics before comparison admission', () => {
  const identity = { syntheticOnly: true, execution: { browser: { version: 'synthetic-browser' } } };
  const cases = [
    ['complete', () => {}],
    ['missing-startup', child => { delete child.startup.factory; }],
    ['missing-context', child => { delete child.contexts.accepted; }],
    ['missing-cdp', child => { delete child.telemetry.accepted.ScriptDuration; }],
    ['missing-heap', child => { child.heap.pop(); }],
    ['wrong-browser', child => { child.browser = 'different-executable-version'; }],
  ];
  for (const [name, alter] of cases) {
    const directory = join(out, 'calibration-' + name); mkdirSync(directory);
    const schedule = scheduleFor('calibrate'), schedulePath = join(directory, 'schedule.json');
    save(schedulePath, { mode: 'calibrate', identity, schedule, bindings: {} });
    const affected = schedule.findIndex(sample => sample.kind === (name === 'missing-heap' ? 'memory' : 'timing'));
    const children = schedule.map((sample, index) => {
      const child = synthetic(sample, index); if (index === affected) alter(child);
      const path = `child-${index}.json`; save(join(directory, path), child);
      return { index, path, passed: true, sha256: sha(join(directory, path)) };
    });
    const resultPath = join(directory, 'results.json'); save(resultPath, { mode: 'calibrate', identity, planned: schedule.length, completed: schedule.length, passed: true, scheduleSha256: sha(schedulePath), children });
    if (name === 'complete') {
      admitRun(resultPath, 'calibrate', identity, extractMetrics);
      assert.throws(() => admitRun(resultPath, 'calibrate', identity), /complete metric validator/);
    } else assert.throws(() => admitRun(resultPath, 'calibrate', identity, extractMetrics));
  }
});
await check('execution identity rejects altered Node, browser and helper digests', () => {
  const execution = read(join(here, 'context-strategy-config.json')).execution;
  verifyExecution(execution);
  const node = structuredClone(execution); node.node.sha256 = '0'.repeat(64);
  assert.throws(() => verifyExecution(node, false), /Node executable bytes drift/);
  const browser = structuredClone(execution); browser.browser.executableSha256 = '0'.repeat(64);
  assert.throws(() => verifyExecution(browser, false), /Headless executable bytes drift/);
  const helper = structuredClone(execution); helper.packages.playwright.files['package.json'] = '0'.repeat(64);
  assert.throws(() => verifyExecution(helper), /Installed playwright closure drift/);
});
save(join(out, 'receipt.json'), { passed: true, checks, sourceBindings: sourceBindings(), command: [process.execPath, ...process.argv.slice(1)], scope: 'Synthetic/helper verification only. No browser, app, package or performance admission.' });
console.log(JSON.stringify({ passed: true, checks: checks.length }));
