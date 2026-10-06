import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * The rejection rebase on the ORDER side (re-review of 23b750f0, item 2,
 * folded into (a)+(d)). A turn recorded while a transaction was pending
 * holds an order delta that names the transaction's rows and frontier tokens
 * the transaction and its compensation replaced. After the transaction is
 * rolled back, history, undo and redo of that turn threw ("Collection order
 * does not match active SubjectIds", "collection order frontier does not
 * match the transition endpoint"). Now the rows come out of the delta, the
 * first later transition starts from the token the transaction replaced and
 * the last one ends where the compensation left the collection
 * (`rebaseOrdersOntoRejection`); a later turn left with no operation is
 * dropped and its token transition spliced out of the chain.
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const typed = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
    { enhancers: [transactions(), restoration()] }
  );
type Tree = ReturnType<typeof typed>;
const rows = (ids: string, n = 0): Row[] =>
  [...ids].map((id) => ({ id, n: 'qrs'.includes(id) ? 1 : n }));

const historyIds = (tree: Tree) =>
  tree
    .getRestorationHistory()
    .map(({ state }) =>
      (state as unknown as { rows: { all: Row[] } }).rows.all
        .map(({ id }) => id)
        .join('')
    );
const ids = (tree: Tree) => tree.$.rows.ids().join('');

// [seed, rows the transaction adds, the later setAll, state after rollback]
const shapes = [
  ['za', 'r', 'az', 'az'],
  ['az', 'r', 'za', 'za'],
  ['za', 'rq', 'aqz', 'az'],
  ['az', 'rq', 'zaq', 'za'],
  ['abc', 'r', 'cab', 'cab'],
  ['abc', 'rs', 'csab', 'cab'],
  // The rejected row keeps its place in W's longest common order: only an
  // explicit participant can come out of the delta.
  ['abc', 'r', 'cabr', 'cab'],
] as const;

describe.each([
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('order records after a rejection (%s)', (_name, enhancers) => {
  const make = async (seed: string): Promise<Tree> => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
      { enhancers: enhancers() as never }
    ) as unknown as Tree;
    for (const row of rows(seed)) tree.$.rows.addOne(row);
    await flush();
    return tree;
  };

  it.each(shapes)(
    'seed %s, the transaction adds %s, a later undoable setAll(%s): history, undo, redo',
    async (seed, added, target, rejectedState) => {
      const tree = await make(seed);
      try {
        const pending = tree.transaction(() => {
          for (const row of rows(added)) tree.$.rows.addOne(row);
        });
        await flush();
        undoable(() => tree.$.rows.setAll(rows(target)));
        await flush();
        pending.rollback();
        await flush();
        expect(ids(tree)).toBe(rejectedState);
        expect(historyIds(tree)).toStrictEqual([rejectedState]);
        tree.undo();
        await flush();
        expect(ids(tree)).toBe(seed);
        expect(historyIds(tree)).toStrictEqual([rejectedState]);
        tree.redo();
        await flush();
        expect(ids(tree)).toBe(rejectedState);
        tree.undo();
        await flush();
        expect(ids(tree)).toBe(seed);
      } finally {
        tree.destroy();
      }
    }
  );

  it('a later turn that only removed the rejected row is dropped; the earlier order change still undoes', async () => {
    const tree = await make('abc');
    try {
      undoable(() => tree.$.rows.setAll(rows('cba')));
      await flush();
      const pending = tree.transaction(() =>
        tree.$.rows.addOne({ id: 'r', n: 1 })
      );
      await flush();
      undoable(() => tree.$.rows.removeOne('r'));
      await flush();
      pending.rollback();
      await flush();
      expect(ids(tree)).toBe('cba');
      expect(historyIds(tree)).toStrictEqual(['cba']);
      tree.undo();
      await flush();
      expect(ids(tree)).toBe('abc');
      tree.redo();
      await flush();
      expect(ids(tree)).toBe('cba');
    } finally {
      tree.destroy();
    }
  });

  it('a later delta that only moved the rejected row keeps its token transition', async () => {
    const tree = await make('ab');
    try {
      undoable(() => tree.$.rows.setAll(rows('ba')));
      await flush();
      const pending = tree.transaction(() =>
        tree.$.rows.addOne({ id: 'r', n: 1 })
      );
      await flush();
      undoable(() => {
        tree.$.rows.setAll(rows('rba'));
        tree.$.rows.updateOne('a', { n: 5 });
      });
      await flush();
      pending.rollback();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual([
        { id: 'b', n: 0 },
        { id: 'a', n: 5 },
      ]);
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(rows('ba'));
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(rows('ab'));
      expect(historyIds(tree)).toStrictEqual(['ba', 'ba']);
    } finally {
      tree.destroy();
    }
  });

  it('...and with a later turn after it, the chain is spliced', async () => {
    const tree = await make('abc');
    try {
      undoable(() => tree.$.rows.setAll(rows('cba')));
      await flush();
      const pending = tree.transaction(() =>
        tree.$.rows.addOne({ id: 'r', n: 1 })
      );
      await flush();
      undoable(() => tree.$.rows.removeOne('r'));
      await flush();
      undoable(() => tree.$.rows.addOne({ id: 'x', n: 0 }));
      await flush();
      pending.rollback();
      await flush();
      expect(ids(tree)).toBe('cbax');
      expect(historyIds(tree)).toStrictEqual(['cba', 'cbax']);
      tree.undo();
      await flush();
      expect(ids(tree)).toBe('cba');
      tree.undo();
      await flush();
      expect(ids(tree)).toBe('abc');
      tree.redo();
      await flush();
      tree.redo();
      await flush();
      expect(ids(tree)).toBe('cbax');
    } finally {
      tree.destroy();
    }
  });
});
