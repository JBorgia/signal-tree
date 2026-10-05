import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * `addMany(rows, { mode: 'overwrite' })` replaces an existing row IN PLACE: the
 * storage commit is a `replace-value` of the row's existing lifetime, and the
 * row keeps its position. It was nevertheless announced as a structural `add`
 * with no previous value, so every reversal treated the row as created by the
 * call. Reproduced on npm 15.4.3:
 *
 *     rows.addOne({ id: 'a', n: 1 });
 *     undoable(() => rows.addMany([{ id: 'a', n: 9 }, { id: 'b', n: 2 }],
 *                                 { mode: 'overwrite' }));
 *     undo();      // rows.all() === []                — expected [{ id: 'a', n: 1 }]
 *
 * `transaction(...).rollback()` deleted the row the same way, and redo
 * re-added it after the rows appended by the call instead of where it was.
 *
 * Every other replacement of an existing row (`updateOne`, `replaceOne`,
 * `upsertOne`, `upsertMany`, `setAll`) announces the new value with the
 * previous one and no structural effect; an overwrite now does the same. A
 * fresh row's predecessor is the previous FRESH row of the call, else the last
 * row before it — an overwritten row stays where it was and is no anchor for
 * the rows appended after it.
 */
type Row = { id: string; n: number; tag?: string };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
// Typed with both enhancers; each test installs the list it names.
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;
const make = (enhancers: readonly unknown[]): Tree =>
  signalTree(declaration(), {
    enhancers: enhancers as never,
  }) as unknown as Tree;

const SEEDED: Row[] = [
  { id: 'z', n: 0 },
  { id: 'a', n: 1, tag: 't' },
  { id: 'c', n: 3 },
];
const seed = async (tree: Tree) => {
  for (const row of SEEDED) tree.$.rows.addOne({ ...row });
  await flush();
};

const overwrite = (rows: Row[]) => (tree: Tree) => {
  tree.$.rows.addMany(rows, { mode: 'overwrite' });
};

const cases: Record<string, { act: (tree: Tree) => void; after: Row[] }> = {
  'one overwritten row, one new row': {
    act: overwrite([
      { id: 'a', n: 9 },
      { id: 'b', n: 2 },
    ]),
    after: [
      { id: 'z', n: 0 },
      { id: 'a', n: 9 },
      { id: 'c', n: 3 },
      { id: 'b', n: 2 },
    ],
  },
  'only overwritten rows': {
    act: overwrite([
      { id: 'c', n: 30 },
      { id: 'a', n: 9, tag: 'u' },
    ]),
    after: [
      { id: 'z', n: 0 },
      { id: 'a', n: 9, tag: 'u' },
      { id: 'c', n: 30 },
    ],
  },
  'new rows interleaved with overwritten rows': {
    act: overwrite([
      { id: 'a', n: 9 },
      { id: 'x', n: 4 },
      { id: 'z', n: 7 },
      { id: 'y', n: 5 },
    ]),
    after: [
      { id: 'z', n: 7 },
      { id: 'a', n: 9 },
      { id: 'c', n: 3 },
      { id: 'x', n: 4 },
      { id: 'y', n: 5 },
    ],
  },
  'overwrite of the last row, then new rows': {
    act: overwrite([
      { id: 'c', n: 30 },
      { id: 'w', n: 6 },
      { id: 'v', n: 8 },
    ]),
    after: [
      { id: 'z', n: 0 },
      { id: 'a', n: 1, tag: 't' },
      { id: 'c', n: 30 },
      { id: 'w', n: 6 },
      { id: 'v', n: 8 },
    ],
  },
};

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('addMany overwrite undo/redo (%s)', (_name, enhancers) => {
  it('the reported case: undo brings the overwritten row back', async () => {
    const tree = make(enhancers());
    try {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      await flush();
      undoable(() =>
        tree.$.rows.addMany(
          [
            { id: 'a', n: 9 },
            { id: 'b', n: 2 },
          ],
          { mode: 'overwrite' }
        )
      );
      await flush();
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual([{ id: 'a', n: 1 }]);
    } finally {
      tree.destroy();
    }
  });

  it.each(Object.entries(cases))(
    '%s: undo restores values and order, redo reapplies them',
    async (_case, { act, after }) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        undoable(() => act(tree));
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(after);
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        tree.redo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(after);
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      } finally {
        tree.destroy();
      }
    }
  );

  it('a later turn undone first leaves the overwrite in place', async () => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      undoable(() => overwrite([{ id: 'a', n: 9 }])(tree));
      await flush();
      undoable(() => tree.$.rows.updateOne('c', { n: 33 }));
      await flush();
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual([
        { id: 'z', n: 0 },
        { id: 'a', n: 9 },
        { id: 'c', n: 3 },
      ]);
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(SEEDED);
    } finally {
      tree.destroy();
    }
  });

  // Controls: unchanged by the repair.
  it('skip mode: undo removes only the rows the call added', async () => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      undoable(() =>
        tree.$.rows.addMany(
          [
            { id: 'a', n: 9 },
            { id: 'b', n: 2 },
          ],
          { mode: 'skip' }
        )
      );
      await flush();
      const after = tree.$.rows.all();
      expect(after).toStrictEqual([...SEEDED, { id: 'b', n: 2 }]);
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      tree.redo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(after);
    } finally {
      tree.destroy();
    }
  });

  it('strict mode: a duplicate throws and records nothing', async () => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      const before = tree.canUndo();
      expect(() =>
        tree.$.rows.addMany([
          { id: 'b', n: 2 },
          { id: 'a', n: 9 },
        ])
      ).toThrow('Entity with id a already exists');
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      expect(tree.canUndo()).toBe(before);
    } finally {
      tree.destroy();
    }
  });

  it('plain addOne undo/redo', async () => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      undoable(() => tree.$.rows.addOne({ id: 'b', n: 2 }));
      await flush();
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      tree.redo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual([...SEEDED, { id: 'b', n: 2 }]);
    } finally {
      tree.destroy();
    }
  });
});

describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('addMany overwrite rollback (%s)', (_name, enhancers) => {
  it.each(Object.entries(cases))(
    '%s: rollback restores values and order',
    async (_case, { act, after }) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        const pending = tree.transaction(() => act(tree));
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(after);
        pending.rollback();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      } finally {
        tree.destroy();
      }
    }
  );

  it('control: skip mode rollback removes only the added row', async () => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      const pending = tree.transaction(() =>
        tree.$.rows.addMany(
          [
            { id: 'a', n: 9 },
            { id: 'b', n: 2 },
          ],
          { mode: 'skip' }
        )
      );
      await flush();
      pending.rollback();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(SEEDED);
    } finally {
      tree.destroy();
    }
  });

  it('control: plain removeOne rollback', async () => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      const pending = tree.transaction(() => tree.$.rows.removeOne('a'));
      await flush();
      pending.rollback();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(SEEDED);
    } finally {
      tree.destroy();
    }
  });
});

describe('addMany overwrite forward behaviour (control)', () => {
  it.each([
    ['no enhancers', () => []],
    ['restoration()', () => [restoration()]],
    ['transactions()', () => [transactions()]],
  ] as const)(
    '%s: replaces in place, appends new rows, returns every id',
    async (_name, enhancers) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        const ids = tree.$.rows.addMany(
          [
            { id: 'a', n: 9 },
            { id: 'x', n: 4 },
          ],
          { mode: 'overwrite' }
        );
        await flush();
        expect(ids).toStrictEqual(['a', 'x']);
        expect(tree.$.rows.ids()).toStrictEqual(['z', 'a', 'c', 'x']);
        expect(tree.$.rows.byId('a')?.()).toStrictEqual({ id: 'a', n: 9 });
      } finally {
        tree.destroy();
      }
    }
  );
});
