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

test('the fake subject enforces refuse, queue and merge holds, transactions and selective undo', async () => {
  const { testFake } = await import('../subjects/test-fake.ts');
  const tree = testFake.createTree({ a: { b: 0 } });
  const leaf = tree.leaf<number>(['a', 'b']);
  const user = { writer: 'user', origin: 'user' };
  const agent = { writer: 'agent:planner', origin: 'agent' };

  const release = tree.hold!(['a', 'b'], user);
  assert.throws(() => tree.as!(agent, () => leaf.set(1)), /refused/);
  tree.as!(user, () => leaf.set(2));
  release();
  const queue = tree.hold!(['a', 'b'], user, { kind: 'queue' });
  tree.as!(agent, () => leaf.set(3));
  assert.equal(leaf(), 2, 'queued while held');
  queue();
  assert.equal(leaf(), 3, 'applied when the hold ends');
  const merge = tree.hold!(['a', 'b'], user, { kind: 'merge', merge: (current, incoming) => (current as number) + (incoming as number) });
  tree.as!(agent, () => leaf.set(10));
  assert.equal(leaf(), 13);
  merge();

  const tx = tree.as!(agent, () => tree.transact!(() => leaf.set(20)));
  assert.deepEqual(tx.inspect(), [{ location: 'a/b', status: 'current' }]);
  tx.rollback();
  assert.equal(leaf(), 13);

  tree.as!(user, () => tree.undoable!(() => leaf.set(30)));
  const other = tree.leaf<number>(['a', 'c']);
  tree.as!(agent, () => tree.undoable!(() => other.set(5)));
  tree.undo!({ writer: agent.writer });
  assert.equal(other(), undefined);
  assert.equal(leaf(), 30, "the user's write survives the agent's undo");
});
