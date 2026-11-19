import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertEvaluated, assertFails, condition, runOnFake } from './helpers.ts';

test('S7 measures every owner count and both link counts; owner and link costs fail it', async () => {
  const clean = await runOnFake('S7', []);
  assertEvaluated(clean);
  for (const n of [1, 2, 8, 32]) assert.ok(Number.isFinite(clean.median![`writeCostUs@${n}`]), `cost(${n})`);
  const planted = await runOnFake('S7', ['ownerCost', 'linksScan']);
  assertFails(planted, 'S7.bound', 'S7.links');
  assert.match(condition(planted, 'S7.bound').detail ?? '', /over bound/);
});
