import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { signalTree, entityMap, transactions, link } from '../index';
import { withWriteContext } from './write-context';
const tick = async () => {
  for (let i = 0; i < 100; i++) await Promise.resolve();
};
describe('indexed ordinary endpoint handoff', () => {
  it('restores the separately captured ordinary order and preserves it on later field edits', async () => {
    const t = signalTree(
      { rows: entityMap<{ id: string; n: number }, string>() },
      { enhancers: [transactions()] }
    );
    const r = t.$.rows,
      sent: unknown[] = [];
    let connection: ReturnType<typeof link> | undefined;
    try {
      r.setAll([
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
        { id: 'c', n: 3 },
      ]);
      await tick();
      connection = link(r, {
        set: (v) => {
          sent.push(structuredClone(v));
        },
      });
      const order = (ids: string) =>
        r.setAll([...ids].map((id) => r.byIdOrFail(id)()));
      withWriteContext({ participation: 'inspection' }, () => order('cba'));
      await tick();
      await connection.settled();
      assert.equal(sent.length, 0);
      const p = t.transact(() => order('acb'));
      await tick();
      p.rollback();
      await tick();
      await connection.settled();
      r.updateOne('b', { n: 4 });
      await tick();
      await connection.settled();
      assert.deepEqual(sent.at(-1), [
        { id: 'a', n: 1 },
        { id: 'b', n: 4 },
        { id: 'c', n: 3 },
      ]);
      assert.deepEqual(sent.at(-2), [
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
        { id: 'c', n: 3 },
      ]);
    } finally {
      connection?.dispose();
      t.destroy();
    }
  });
});
