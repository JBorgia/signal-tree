import { describe, expect, it } from 'vitest';

import {
  entityMap,
  link,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';
import { getPathNotifier } from './path-notifier';
import { withWriteContext } from './write-context';

/**
 * LINK-COLLECTION-SORT-COMPARER (15.4.4). A collection endpoint receives
 * exactly `all()` (LINK-COLLECTION-TYPE-0: "the endpoint receives exactly
 * all()"), and `all()` of an `entityMap({ sortComparer })` is sorted.
 *
 * Link sent the collection's storage order instead, so with a comparer the
 * endpoint could hold `[b, a]` while `all()` returned `[a, b]`, and an edit of
 * the sort field never moved the row at the endpoint. Link now orders a
 * comparer collection's eligible rows with the same comparer, on the
 * ELIGIBLE row values: an inspection edit of a sort field moves nothing that
 * reaches the endpoint.
 */
type Row = { id: string; rank: number };
const byRank = (a: Row, b: Row) => a.rank - b.rank;
const r = (id: string, rank: number): Row => ({ id, rank });
const ids = (value: readonly Row[]) => value.map((row) => row.id).join('');
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const INSPECTION = {
  intent: 'system',
  origin: 'devtools',
  participation: 'inspection',
} as const;

const make = () =>
  signalTree(
    {
      rows: entityMap<Row, string>({ sortComparer: byRank }),
      data: {
        rows: entityMap<Row, string>({ sortComparer: byRank }),
        label: 'x',
      },
    },
    { enhancers: [transactions(), restoration()] }
  );
type Tree = ReturnType<typeof make>;

async function linked(tree: Tree) {
  // Storage order deliberately differs from sorted order.
  tree.$.rows.setAll([r('C', 3), r('A', 1), r('B', 2)]);
  await flush();
  const sent: string[] = [];
  const connection = link(tree.$.rows, {
    set: (value) => void sent.push(ids(value)),
  });
  return { sent, connection };
}

const operations: Array<[string, (t: Tree) => void]> = [
  ['addOne', (t) => void t.$.rows.addOne(r('D', 0))],
  ['addMany', (t) => void t.$.rows.addMany([r('E', 5), r('D', 0)])],
  ['updateOne of the sort field', (t) => t.$.rows.updateOne('A', { rank: 4 })],
  [
    'setAll of unsorted rows',
    (t) => t.$.rows.setAll([r('B', 2), r('A', 9), r('C', 1)]),
  ],
  [
    'setAll reordering storage only',
    (t) => t.$.rows.setAll([r('B', 2), r('C', 3), r('A', 1)]),
  ],
  ['prependOne', (t) => void t.$.rows.prependOne(r('Z', 26))],
  ['removeOne', (t) => t.$.rows.removeOne('A')],
  ['changeId', (t) => void t.$.rows.changeId('A', 'Q')],
];

describe('a comparer collection endpoint receives all()', () => {
  it.each(operations)('after %s', async (_label, op) => {
    const tree = make();
    const { sent, connection } = await linked(tree);
    try {
      op(tree);
      await flush();
      await connection.settled();
      expect(sent.at(-1) ?? 'ABC').toBe(ids(tree.$.rows.all()));
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it.each(operations)(
    'after the undo and the redo of %s',
    async (_label, op) => {
      const tree = make();
      const { sent, connection } = await linked(tree);
      try {
        undoable(() => op(tree));
        await flush();
        await connection.settled();
        tree.undo();
        await flush();
        await connection.settled();
        expect(sent.at(-1) ?? 'ABC').toBe(ids(tree.$.rows.all()));
        tree.redo();
        await flush();
        await connection.settled();
        expect(sent.at(-1) ?? 'ABC').toBe(ids(tree.$.rows.all()));
      } finally {
        connection.dispose();
        tree.destroy();
      }
    }
  );

  it.each(operations)('after the rollback of %s', async (_label, op) => {
    const tree = make();
    const { sent, connection } = await linked(tree);
    try {
      const pending = tree.transaction(() => op(tree));
      await flush();
      pending.rollback();
      await flush();
      await connection.settled();
      expect(sent.at(-1) ?? 'ABC').toBe(ids(tree.$.rows.all()));
      expect(ids(tree.$.rows.all())).toBe('ABC');
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('a head run restored by undo arrives sorted', async () => {
    const tree = make();
    const { sent, connection } = await linked(tree);
    try {
      undoable(() => tree.$.rows.removeMany(['C', 'A']));
      await flush();
      tree.undo();
      await flush();
      await connection.settled();
      expect(sent.at(-1)).toBe('ABC');
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});

describe('a comparer orders ELIGIBLE values', () => {
  it('an inspection edit of the sort field moves nothing at the endpoint', async () => {
    const tree = make();
    const { sent, connection } = await linked(tree);
    try {
      withWriteContext(INSPECTION, () =>
        tree.$.rows.updateOne('C', { rank: 0 })
      );
      await flush();
      expect(ids(tree.$.rows.all())).toBe('CAB');
      tree.$.rows.updateOne('B', { rank: 2 });
      tree.$.rows.updateOne('A', { rank: 1 });
      tree.$.rows.addOne(r('D', 4));
      await flush();
      await connection.settled();
      // Eligible C still has rank 3: it sorts after B, not first.
      expect(sent.at(-1)).toBe('ABCD');
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});

describe('comparer collections inside branch and root Links', () => {
  it('a nested comparer collection through a branch Link', async () => {
    const tree = make();
    tree.$.data.rows.setAll([r('C', 3), r('A', 1), r('B', 2)]);
    await flush();
    const sent: Array<{ rows: { all: Row[] } }> = [];
    const connection = link(tree.$.data as never, {
      set: ((value: { rows: { all: Row[] } }) =>
        void sent.push(value)) as never,
    });
    try {
      tree.$.data.rows.addOne(r('D', 0));
      await flush();
      await connection.settled();
      expect(ids(sent.at(-1)!.rows.all)).toBe(ids(tree.$.data.rows.all()));
      expect(ids(sent.at(-1)!.rows.all)).toBe('DABC');
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('a comparer collection through the root Link', async () => {
    const tree = make();
    tree.$.rows.setAll([r('C', 3), r('A', 1), r('B', 2)]);
    await flush();
    const sent: Array<{ rows: { all: Row[] } }> = [];
    const connection = link(tree.$ as never, {
      set: ((value: { rows: { all: Row[] } }) =>
        void sent.push(value)) as never,
    });
    try {
      tree.$.rows.updateOne('A', { rank: 4 });
      await flush();
      await connection.settled();
      expect(ids(sent.at(-1)!.rows.all)).toBe('BCA');
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});
