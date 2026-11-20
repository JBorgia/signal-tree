import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gateEntry, gateParameters, loadBudgets } from '../runner/budgets.ts';
import { DEFINITIONS } from '../scenarios/index.ts';

const { budgets } = loadBudgets();

test('every definition has a gate in budgets.json and every gate has a definition', () => {
  const gateIds = Object.entries(budgets.gates).flatMap(([id, gate]) => (gate.parts ? Object.keys(gate.parts) : [id]));
  assert.deepEqual([...gateIds].sort(), DEFINITIONS.map((d) => d.id).sort());
});

test('every metric a condition reads is a metric its scenario reports', () => {
  for (const definition of DEFINITIONS) {
    if (definition.kind !== 'scenario') continue;
    for (const condition of gateEntry(budgets, definition.id).conditions ?? []) {
      if (!condition.metric) continue;
      const declared = Object.keys(definition.metrics);
      const found = condition.op === 'ownerBound' ? declared.some((m) => m.startsWith(`${condition.metric}@`)) : declared.includes(condition.metric);
      assert.ok(found, `${condition.id} reads ${condition.metric}, which ${definition.id} does not report`);
    }
    for (const reported of gateEntry(budgets, definition.id).reported ?? []) {
      assert.ok(reported.metric in definition.metrics, `${definition.id} does not report ${reported.metric}`);
    }
  }
});

test('composite gates compare scenarios that exist, and parameter $refs resolve', () => {
  for (const definition of DEFINITIONS) {
    if (definition.kind === 'composite') for (const id of definition.compare.scenarios) assert.ok(DEFINITIONS.some((d) => d.id === id && d.kind === 'scenario'));
    if (definition.kind !== 'external') assert.doesNotThrow(() => gateParameters(budgets, definition.id));
  }
  assert.equal(gateParameters(budgets, 'S2')['rows'], 50000);
  assert.equal(gateParameters(budgets, 'S1')['formBoundFields'], 500);
});

const FIVE = 5;
const runsOf = (values: number[], metric = 'm') => values.map((v) => ({ [metric]: v }));
const evidence = (values: number[], median: number, metric = 'm') => ({ median: { [metric]: median }, runs: runsOf(values, metric), requiredRuns: FIVE });

test('median conditions pass or fail on the median', async () => {
  const { evaluateCondition } = await import('../runner/budgets.ts');
  const le = { id: 'x', text: '', metric: 'm', op: '<=', value: 2 } as const;
  assert.equal(evaluateCondition(le, evidence([1, 2, 2, 3, 3], 2)).pass, true);
  assert.equal(evaluateCondition(le, evidence([1, 2, 3, 3, 3], 3)).pass, false);
  assert.equal(evaluateCondition({ ...le, op: '>=', value: 0.95 }, evidence([1, 1, 0.9, 0.9, 0.9], 0.9)).pass, false);
  assert.equal(evaluateCondition({ ...le, op: 'withinRelative', value: 0.1 }, evidence([-0.1, -0.1, -0.1, 0, 0], -0.1)).pass, true);
  assert.equal(evaluateCondition({ ...le, op: 'withinRelative', value: 0.1 }, evidence([0.11, 0.11, 0.11, 0, 0], 0.11)).pass, false);
});

test('an every-run condition fails when one run fails, names it, and reports the worst run', async () => {
  const { evaluateCondition } = await import('../runner/budgets.ts');
  const never = { id: 'S2.longTasks', text: '', metric: 'm', op: '==', value: 0, judge: 'every-run' } as const;
  const planted = evaluateCondition(never, evidence([0, 0, 3, 0, 1], 0));
  assert.equal(planted.pass, false, 'the median is 0, but runs 3 and 5 are not');
  assert.equal(planted.actual, 3);
  assert.match(planted.detail!, /runs 3, 5 of 5/);
  assert.equal(evaluateCondition(never, evidence([0, 0, 0, 0, 0], 0)).pass, true);
  const median = evaluateCondition({ ...never, judge: undefined }, evidence([0, 0, 3, 0, 1], 0));
  assert.equal(median.pass, true, 'judged on the median, the same runs would pass');
});

test('a gated metric that is missing or short of the required runs fails, never null', async () => {
  const { evaluateCondition } = await import('../runner/budgets.ts');
  const le = { id: 'x', text: '', metric: 'm', op: '<=', value: 2 } as const;
  const missing = evaluateCondition(le, { median: {}, runs: [{}, {}, {}, {}, {}], requiredRuns: FIVE });
  assert.equal(missing.pass, false);
  const short = evaluateCondition(le, { median: { m: 1 }, runs: runsOf([1, 1, 1, Number.NaN]), requiredRuns: FIVE });
  assert.equal(short.pass, false);
  assert.match(short.detail!, /3 of the 5 required runs/);
  const everyRunShort = evaluateCondition({ ...le, judge: 'every-run' }, { median: { m: 1 }, runs: runsOf([1, 1]), requiredRuns: FIVE });
  assert.equal(everyRunShort.pass, false);
  const bound = { id: 'b', text: '', metric: 'c', op: 'ownerBound', coefficientUs: 0.5 } as const;
  const points = { 'c@1': 1, 'c@2': 1.9, 'c@8': 5, 'c@32': 17 };
  assert.equal(evaluateCondition(bound, { median: points, runs: Array(5).fill(points), requiredRuns: FIVE }).pass, true);
  assert.equal(evaluateCondition(bound, { median: { ...points, 'c@2': 2.1 }, runs: Array(5).fill(points), requiredRuns: FIVE }).pass, false);
  assert.equal(evaluateCondition(bound, { median: points, runs: [points], requiredRuns: FIVE }).pass, false, 'one run of five');
  assert.equal(evaluateCondition(bound, { median: { 'c@2': 1 }, runs: Array(5).fill({ 'c@2': 1 }), requiredRuns: FIVE }).pass, false, 'no cost(1)');
});

test('the zero and never budgets are judged on every run', () => {
  const judged = Object.values(budgets.gates)
    .flatMap((gate) => [...(gate.conditions ?? []), ...Object.values(gate.parts ?? {}).flatMap((part) => part.conditions ?? [])])
    .filter((condition) => condition.judge === 'every-run')
    .map((condition) => condition.id)
    .sort();
  assert.deepEqual(judged, ['M1.alloc', 'S2.longTasks', 'S4c.held', 'S5.caps', 'S8.allAlloc', 'S8.byIdAlloc']);
});

test('every compared metric that can read 0 has a noise floor, and every floor names one', () => {
  const floors = Object.keys(budgets.noiseFloors).filter((key) => !key.startsWith('$'));
  const needed: string[] = [];
  for (const definition of DEFINITIONS) {
    if (definition.kind !== 'scenario') continue;
    for (const [metric, spec] of Object.entries(definition.metrics)) {
      if (spec.zeroable && spec.better !== 'none') needed.push(`${definition.id}.${metric}`);
    }
  }
  assert.deepEqual(floors.sort(), needed.sort());
});

test('record-only is honored only while budgets.json is unapproved, and red gates then fail the run', async () => {
  const { exitCode, resolveRecordOnly, verdict } = await import('../runner/harness.ts');
  assert.deepEqual(resolveRecordOnly(true, false), { recordOnly: true });
  const approved = resolveRecordOnly(true, true);
  assert.equal(approved.recordOnly, false);
  assert.match(approved.notice!, /ignored/);
  const red = { id: 'M1', title: '', status: 'ran' as const, pass: false, conditions: [], regressions: [] };
  assert.equal(exitCode({ M1: red }, resolveRecordOnly(true, false).recordOnly), 0);
  assert.equal(exitCode({ M1: red }, approved.recordOnly), 1, 'approved budgets: the flag no longer hides a red gate');
  assert.equal(exitCode({ S3: { id: 'S3', title: '', status: 'not-applicable', conditions: [], regressions: [] } }, false), 0);
  const regressed = { metric: 'm', mode: 'relative' as const, baseline: 1, current: 2, worseBy: 1, threshold: 0.03, regressed: true };
  assert.equal(exitCode({ M1: { ...red, pass: true, regressions: [regressed] } }, true), 1);
  assert.equal(verdict([]), false, 'no conditions is not a pass');
});
