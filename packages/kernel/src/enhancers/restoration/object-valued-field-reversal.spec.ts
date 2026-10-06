import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * A row field whose value is an object or array on one side of a write and
 * absent (or a primitive) on the other is captured as ONE field effect
 * carrying the whole value. restoration refused every such effect before
 * application ("Unsupported scoped undo effect at rows.a.nest", pre-existing
 * on 15.4.3): its support check required scalar before/after values for any
 * subject-scoped write. transactions() rollback restored the same effects.
 */
type Row = {
  id: string;
  n: number;
  nest?: { x: number; deep?: { y: number } } | null;
  list?: number[];
  tag?: string | { label: string };
};
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
  { id: 'a', n: 1, nest: { x: 1, deep: { y: 2 } }, list: [1, 2], tag: 't' },
  { id: 'c', n: 3 },
];
const seed = async (tree: Tree) => {
  for (const row of SEEDED) tree.$.rows.addOne(structuredClone(row));
  await flush();
};

const writes: Record<string, (tree: Tree) => void> = {
  'replaceOne dropping an object field': (tree) =>
    tree.$.rows.replaceOne('a', { id: 'a', n: 2, list: [1, 2], tag: 't' }),
  'replaceOne dropping an array field': (tree) =>
    tree.$.rows.replaceOne('a', {
      id: 'a',
      n: 1,
      nest: { x: 1, deep: { y: 2 } },
      tag: 't',
    }),
  'replaceOne dropping every non-key field': (tree) =>
    tree.$.rows.replaceOne('a', { id: 'a', n: 1 }),
  'updateOne adding an object field to another row': (tree) =>
    tree.$.rows.updateOne('z', { nest: { x: 9 } }),
  'updateOne replacing an object field with null': (tree) =>
    tree.$.rows.updateOne('a', { nest: null }),
  'updateOne replacing a primitive field with an object': (tree) =>
    tree.$.rows.updateOne('a', { tag: { label: 'L' } }),
  'updateOne replacing an array field': (tree) =>
    tree.$.rows.updateOne('a', { list: [3] }),
  'replaceOne dropping an object field, then removeOne': (tree) => {
    tree.$.rows.replaceOne('a', { id: 'a', n: 2, list: [1, 2], tag: 't' });
    tree.$.rows.removeOne('a');
  },
};

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('object-valued field undo/redo (%s)', (_name, enhancers) => {
  it.each(Object.keys(writes))(
    '%s: undo restores, redo reapplies, undo again restores',
    async (name) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        undoable(() => writes[name](tree));
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
] as const)('object-valued field rollback (%s)', (_name, enhancers) => {
  it.each(Object.keys(writes))('%s: rollback restores', async (name) => {
    const tree = make(enhancers());
    try {
      await seed(tree);
      const pending = tree.transaction(() => writes[name](tree));
      await flush();
      pending.rollback();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(SEEDED);
    } finally {
      tree.destroy();
    }
  });
});
