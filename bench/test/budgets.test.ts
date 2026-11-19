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
