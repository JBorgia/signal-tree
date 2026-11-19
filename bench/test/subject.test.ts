import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFINITIONS } from '../scenarios/index.ts';
import { collectionSeed } from '../subjects/seed.ts';
import { missingCapabilities } from '../subjects/types.ts';
import { v15Shim } from '../subjects/v15-shim.ts';

test('on the 15.4.9 shim exactly M1, M2, M3, S1 and S2 are applicable', () => {
  const runnable = DEFINITIONS.filter((d) => d.kind !== 'external' && missingCapabilities(v15Shim, d.requires).length === 0).map((d) => d.id);
  assert.deepEqual(runnable, ['M1', 'M2', 'M3', 'S1', 'S2']);
});

test('the shim hands out native Angular leaves and collection cells', () => {
  const tree = v15Shim.createTree({ a: { b: 1 }, rows: collectionSeed('id') });
  const leaf = tree.leaf<number>(['a', 'b']);
  leaf.set(2);
  assert.equal(leaf(), 2);
  const rows = tree.collection<{ id: number; v: number }, number>(['rows']);
  rows.setAll([{ id: 1, v: 1 }]);
  const cell = rows.field(1, 'v');
  rows.updateOne(1, { v: 5 });
  assert.equal(cell(), 5);
  assert.equal(rows.count(), 1);
  tree.destroy();
});
