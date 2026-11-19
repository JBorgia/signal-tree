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

test('the evaluator passes, fails, or reports a missing metric for each kind of condition', async () => {
  const { evaluateCondition } = await import('../runner/budgets.ts');
  const { exitCode, verdict } = await import('../runner/harness.ts');
  const le = { id: 'x', text: '', metric: 'm', op: '<=', value: 2 } as const;
  assert.equal(evaluateCondition(le, { m: 2 }).pass, true);
  assert.equal(evaluateCondition(le, { m: 2.01 }).pass, false);
  assert.equal(evaluateCondition(le, {}).pass, null);
  assert.equal(evaluateCondition({ ...le, op: '==', value: 0 }, { m: 0 }).pass, true);
  assert.equal(evaluateCondition({ ...le, op: '==', value: 0 }, { m: 1e-9 }).pass, false);
  assert.equal(evaluateCondition({ ...le, op: '>=', value: 0.95 }, { m: 0.9 }).pass, false);
  assert.equal(evaluateCondition({ ...le, op: 'withinRelative', value: 0.1 }, { m: -0.1 }).pass, true);
  assert.equal(evaluateCondition({ ...le, op: 'withinRelative', value: 0.1 }, { m: 0.11 }).pass, false);
  const bound = { id: 'b', text: '', metric: 'c', op: 'ownerBound', coefficientUs: 0.5 } as const;
  assert.equal(evaluateCondition(bound, { 'c@1': 1, 'c@2': 1.9, 'c@8': 5, 'c@32': 17 }).pass, true);
  assert.equal(evaluateCondition(bound, { 'c@1': 1, 'c@2': 2.1, 'c@8': 5, 'c@32': 17 }).pass, false);
  assert.equal(evaluateCondition(bound, { 'c@2': 1 }).pass, null);
  assert.equal(verdict([{ id: 'a', text: '', pass: true, actual: 1 }, { id: 'b', text: '', pass: null, actual: null }]), null);
  assert.equal(verdict([{ id: 'a', text: '', pass: false, actual: 1 }]), false);
  const ran = { id: 'M1', title: '', status: 'ran' as const, pass: false };
  assert.equal(exitCode({ M1: ran }, false), 1);
  assert.equal(exitCode({ M1: ran }, true), 0);
  assert.equal(exitCode({ S3: { id: 'S3', title: '', status: 'not-applicable' } }, false), 0);
  assert.equal(exitCode({ M1: { ...ran, pass: true, regressions: [{ metric: 'm', baseline: 1, current: 2, worseBy: 1, threshold: 0.03, regressed: true }] } }, true), 1);
});
