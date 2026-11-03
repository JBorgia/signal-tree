import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * `prependMany` is `addMany` followed by a move to the front. The move was not
 * recorded in any turn (pre-existing on npm 15.4.3): redo re-appended the
 * prepended rows at the END, and with 'overwrite' an overwritten row stayed at
 * the front on undo and rollback. It is now recorded as one order change per
 * call, so undo, redo, rollback and jumpTo restore the order exactly.
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;
const make = (enhancers: readonly unknown[]): Tree =>
  signalTree(declaration(), {
    enhancers: enhancers as never,
  }) as unknown as Tree;

const SEEDED: Row[] = [
  { id: 'z', n: 0 },
  { id: 'a', n: 1 },
  { id: 'c', n: 3 },
];
const seed = async (tree: Tree) => {
  for (const row of SEEDED) tree.$.rows.addOne({ ...row });
  await flush();
};

const turns: Record<string, (tree: Tree) => void> = {
  'prependMany of fresh rows': (tree) =>
    tree.$.rows.prependMany([
      { id: 'x', n: 1 },
      { id: 'y', n: 2 },
    ]),
  'prependMany into an empty collection': (tree) => {
    tree.$.rows.removeMany(['z', 'a', 'c']);
    tree.$.rows.prependMany([
      { id: 'x', n: 1 },
      { id: 'y', n: 2 },
    ]);
  },
  'prependMany skip with an existing row': (tree) =>
    tree.$.rows.prependMany(
      [
        { id: 'c', n: 30 },
        { id: 'x', n: 1 },
      ],
      { mode: 'skip' }
    ),
  'prependMany overwrite of the last row': (tree) =>
    tree.$.rows.prependMany(
      [
        { id: 'c', n: 30 },
        { id: 'x', n: 1 },
      ],
      { mode: 'overwrite' }
    ),
  'prependMany, then updateOne of a prepended row': (tree) => {
    tree.$.rows.prependMany([
      { id: 'x', n: 1 },
      { id: 'y', n: 2 },
    ]);
    tree.$.rows.updateOne('y', { n: 20 });
  },
  'prependMany twice in one turn': (tree) => {
    tree.$.rows.prependMany([{ id: 'x', n: 1 }]);
    tree.$.rows.prependMany([{ id: 'y', n: 2 }]);
  },
  'addOne, then prependMany in one turn': (tree) => {
    tree.$.rows.addOne({ id: 'w', n: 4 });
    tree.$.rows.prependMany([{ id: 'x', n: 1 }]);
  },
  'prependMany, then removeOne of an old row': (tree) => {
    tree.$.rows.prependMany([{ id: 'x', n: 1 }]);
    tree.$.rows.removeOne('a');
  },
  'control: prependOne': (tree) => {
    tree.$.rows.prependOne({ id: 'x', n: 1 });
  },
};

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('prependMany order: undo/redo/jumpTo (%s)', (_name, enhancers) => {
  it.each(Object.keys(turns))(
    '%s: undo, redo, undo, jumpTo(last) exact',
    async (name) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        undoable(() => turns[name](tree));
        await flush();
        const after = tree.$.rows.all();
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        tree.redo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(after);
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        tree.jumpTo(tree.getRestorationHistory().length - 1);
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(after);
      } finally {
        tree.destroy();
      }
    }
  );
});

describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('prependMany order: rollback (%s)', (_name, enhancers) => {
  it.each(Object.keys(turns))('%s: rollback exact', async (name) => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      const pending = tree.transact(() => turns[name](tree));
      await flush();
      pending.rollback();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(SEEDED);
    } finally {
      tree.destroy();
    }
  });
});

describe('prependMany forward behaviour (control)', () => {
  it.each([
    ['no enhancers', () => []],
    ['restoration()', () => [restoration()]],
    ['transactions()', () => [transactions()]],
  ] as const)(
    '%s: rows land at the front in the order given',
    async (_n, enhancers) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        expect(
          tree.$.rows.prependMany(
            [
              { id: 'a', n: 9 },
              { id: 'x', n: 1 },
            ],
            { mode: 'overwrite' }
          )
        ).toStrictEqual(['a', 'x']);
        expect(tree.$.rows.ids()).toStrictEqual(['a', 'x', 'z', 'c']);
      } finally {
        tree.destroy();
      }
    }
  );
});
