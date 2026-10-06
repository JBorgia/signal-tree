import { describe, expect, it, vi } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { SignalTreeRollbackError } from '../../lib/types';
import { undoable } from '../../lib/undoable';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

/**
 * The invariant behind the order-delta review's CRITICAL: composing a turn's
 * order never throws out of `transaction()` or a flush. Records it cannot
 * compose (forced here) are kept as an UNRECORDED order change:
 * `transaction()` returns its handle, the rollback refuses with nothing
 * changed, undo refuses with nothing changed, and history still reads.
 */
vi.mock('../../lib/internals/causal-runtime/net-order-delta', async (load) => ({
  ...(await load<
    typeof import('../../lib/internals/causal-runtime/net-order-delta')
  >()),
  composeTurnOrderEndpoints: () => {
    throw new Error('Collection structural target contains an anchor cycle');
  },
}));

type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const rows = (ids: string): Row[] => [...ids].map((id) => ({ id, n: 0 }));
const typed = () =>
  signalTree(
    { rows: entityMap<Row, string>() },
    { enhancers: [transactions(), restoration()] }
  );
type Tree = ReturnType<typeof typed>;

describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)(
  'an order change that cannot be composed (%s)',
  (_name, enhancers) => {
    const make = async (): Promise<Tree> => {
      const tree = signalTree(
        { rows: entityMap<Row, string>() },
        { enhancers: enhancers() as never }
      ) as unknown as Tree;
      tree.$.rows.setAll(rows('ABC'));
      await flush();
      return tree;
    };

    it('transaction() returns; the rollback refuses and changes nothing', async () => {
      const tree = await make();
      try {
        const pending = tree.transaction(() => tree.$.rows.setAll(rows('CBA')));
        await flush();
        let error: unknown;
        try {
          pending.rollback();
        } catch (thrown) {
          error = thrown;
        }
        expect(error).toBeInstanceOf(SignalTreeRollbackError);
        expect((error as Error).message).toContain(
          'collection order change was not recorded'
        );
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(['C', 'B', 'A']);
        expect(() => pending.confirm()).not.toThrow();
      } finally {
        tree.destroy();
      }
    });
  }
);

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)(
  'an undoable order change that cannot be composed (%s)',
  (_name, enhancers) => {
    it('undo refuses and changes nothing; history reads', async () => {
      const tree = signalTree(
        { rows: entityMap<Row, string>() },
        { enhancers: enhancers() as never }
      ) as unknown as Tree;
      try {
        tree.$.rows.setAll(rows('ABC'));
        await flush();
        undoable(() => tree.$.rows.setAll(rows('CBA')));
        await flush();
        undoable(() => tree.$.rows.addOne({ id: 'D', n: 0 }));
        await flush();
        expect(tree.getRestorationHistory()).toHaveLength(2);
        tree.undo();
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(['C', 'B', 'A']);
        expect(() => tree.undo()).toThrow(
          'collection order change was not recorded'
        );
        await flush();
        expect(tree.$.rows.ids()).toStrictEqual(['C', 'B', 'A']);
        expect(tree.canUndo()).toBe(true);
        expect(tree.getRestorationHistory()).toHaveLength(2);
      } finally {
        tree.destroy();
      }
    });
  }
);
