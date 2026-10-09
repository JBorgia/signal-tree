import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * `upsertMany` rows it ADDS must reverse like `addMany`'s. On npm 15.4.3 they
 * were announced as bare values with no structural effect: undo threw
 * "Unsupported scoped undo effect at rows.x", and rollback left the new row —
 * and the same call's updates — in place. `upsertOne` was unaffected (it adds
 * through `addOne`).
 */
type Row = { id: string; n: number; p?: number };
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
];
const seed = async (tree: Tree) => {
  for (const row of SEEDED) tree.$.rows.addOne({ ...row });
  await flush();
};

const cases: Record<string, { act: (tree: Tree) => void; after: Row[] }> = {
  'one new row': {
    act: (tree) => tree.$.rows.upsertMany([{ id: 'x', n: 1 }]),
    after: [...SEEDED, { id: 'x', n: 1 }],
  },
  'a new row and an updated row': {
    act: (tree) =>
      tree.$.rows.upsertMany([
        { id: 'x', n: 1 },
        { id: 'a', n: 4, p: 4 },
      ]),
    after: [
      { id: 'z', n: 0 },
      { id: 'a', n: 4, p: 4 },
      { id: 'x', n: 1 },
    ],
  },
  'several new rows around an update keep their order': {
    act: (tree) =>
      tree.$.rows.upsertMany([
        { id: 'x', n: 1 },
        { id: 'z', n: 9 },
        { id: 'y', n: 2 },
        { id: 'w', n: 3 },
      ]),
    after: [
      { id: 'z', n: 9 },
      { id: 'a', n: 1 },
      { id: 'x', n: 1 },
      { id: 'y', n: 2 },
      { id: 'w', n: 3 },
    ],
  },
};

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('upsertMany undo/redo (%s)', (_name, enhancers) => {
  it.each(Object.keys(cases))('%s: undo, redo, undo exact', async (name) => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      undoable(() => cases[name].act(tree));
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(cases[name].after);
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      tree.redo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(cases[name].after);
      tree.undo();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(SEEDED);
    } finally {
      tree.destroy();
    }
  });
});

describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('upsertMany rollback (%s)', (_name, enhancers) => {
  it.each(Object.keys(cases))('%s: rollback exact', async (name) => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      const pending = tree.transact(() => cases[name].act(tree));
      await flush();
      pending.rollback();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(SEEDED);
    } finally {
      tree.destroy();
    }
  });
});
