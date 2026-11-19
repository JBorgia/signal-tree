import assert from 'node:assert/strict';
import { signalTree, transactions, entityMap } from '@signal-tree/kernel';
import { transactionLifecycleReader } from '@signal-tree/kernel/internals';
import { withCleanup } from '../cleanup.mjs';
const results: { name: string; outcome: string }[] = [];
async function check(name: string, body: () => Promise<void>) { await body(); results.push({ name, outcome: 'PASS' }); }
await check('older overlap refuses without losing authority; newest-first retry settles both', async () => {
  const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
  await withCleanup(async () => {
    const reader = transactionLifecycleReader(tree)!;
    const p = tree.transact(() => { tree.$.x(1); tree.$.y(1); });
    const q = tree.transact(() => tree.$.y(2));
    const before = reader.snapshot().pending.map(x => x.transactionId);
    assert.throws(() => p.rollback());
    assert.deepEqual(reader.snapshot().pending.map(x => x.transactionId), before);
    assert.deepEqual(tree.$(), { x: 1, y: 2 });
    q.rollback(); p.rollback();
    assert.equal(reader.snapshot().pending.length, 0);
    assert.deepEqual(tree.$(), { x: 0, y: 0 });
  }, [() => tree.destroy()]);
});
await check('post-install removal observer error is terminal, not a retryable refusal', async () => {
  const tree = signalTree({ rows: entityMap<{ id: string; n: number }, string>() }, { enhancers: [transactions()] });
  const reader = transactionLifecycleReader(tree)!;
  const events: string[] = [];
  const off = reader.subscribe(e => events.push(e.kind));
  const p = tree.transact(() => tree.$.rows.addOne({ id: 'a', n: 1 }));
  const sentinel = new Error('observer after native removal');
  const untap = tree.$.rows.tap({ onRemove: () => { throw sentinel; } });
  await withCleanup(async () => {
    assert.throws(() => p.rollback(), e => e === sentinel);
    assert.deepEqual(tree.$.rows.ids(), []);
    assert.equal(reader.snapshot().pending.length, 0);
    assert.ok(events.includes('rolled-back'));
    p.rollback();
    assert.throws(() => p.confirm());
  }, [untap, off, () => tree.destroy()]);
});
console.log(JSON.stringify({ sourceHead: '5727cd8fcf701128358674411400c019b137a5e4', results }, null, 2));
