import { describe, expect, it } from 'vitest';

import { external } from '../../lib/external';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

type Row = { id: string; n: number; opt?: string };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe.each([
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const)('rollback followed by undoable: %s', (_order, enhancers) => {
  const make = () =>
    signalTree({ rows: entityMap<Row, string>() }, { enhancers: enhancers() });

  it.each([2, 3])(
    'undo restores the committed baseline after immediate authored n=%s',
    async (n) => {
      const tree = make();
      try {
        tree.$.rows.addOne({ id: 'a', n: 1 });
        await flush();
        const pending = tree.transact(() => {
          tree.$.rows.updateOne('a', { opt: undefined });
          tree.$.rows.replaceOne('a', { id: 'a', n: 2 });
        });
        pending.rollback();
        expect(tree.$.rows.byIdOrFail('a')()).toStrictEqual({ id: 'a', n: 1 });

        // No intervening flush: the presence round trip is a net no-op, but
        // sibling work must start at the committed value, never speculative 2.
        undoable(() => {
          tree.$.rows.updateOne('a', { opt: undefined });
          tree.$.rows.replaceOne('a', { id: 'a', n });
        });
        await flush();
        expect(tree.canUndo()).toBe(true);
        tree.undo();
        expect(tree.$.rows.byIdOrFail('a')()).toStrictEqual({ id: 'a', n: 1 });
        tree.redo();
        expect(tree.$.rows.byIdOrFail('a')()).toStrictEqual({ id: 'a', n });
      } finally {
        tree.destroy();
      }
    }
  );

  it('does not turn compensation plus a presence-only net no-op into history', async () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      await flush();
      tree.transact(() => tree.$.rows.updateOne('a', { n: 2 })).rollback();
      undoable(() => {
        tree.$.rows.updateOne('a', { opt: undefined });
        tree.$.rows.replaceOne('a', { id: 'a', n: 1 });
      });
      await flush();
      expect(tree.canUndo()).toBe(false);
      expect(tree.$.rows.byIdOrFail('a')()).toStrictEqual({ id: 'a', n: 1 });
    } finally {
      tree.destroy();
    }
  });

  it.each([false, true])(
    'protects genuine external row truth after speculative rollback=%s',
    async (rollback) => {
      const tree = make();
      try {
        tree.$.rows.addOne({ id: 'a', n: 1 });
        await flush();
        undoable(() => tree.$.rows.updateOne('a', { n: 3 }));
        await flush();
        external(() => tree.$.rows.updateOne('a', { n: 7 }));
        await flush();
        if (rollback) {
          tree.transact(() => tree.$.rows.updateOne('a', { n: 9 })).rollback();
          await flush();
        }
        expect(() => tree.undo()).toThrow('ST1034');
        expect(tree.$.rows.byIdOrFail('a')()).toStrictEqual({ id: 'a', n: 7 });
      } finally {
        tree.destroy();
      }
    }
  );
});
