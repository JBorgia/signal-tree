import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * Strict mode refusing an id that ALREADY EXISTS in the collection — alone,
 * after a new id in the same call, or named twice — throws before anything is
 * intercepted or written, records no history, and leaves earlier work in the
 * same undo entry or transaction exactly reversible.
 *
 * batch-duplicate-ids.spec.ts covers a NEW id named twice; this is the
 * existing-id half the 15.4.4 review found untested.
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
];
const WITH_W: Row[] = [...SEEDED, { id: 'w', n: 4 }];
const seed = async (tree: Tree) => {
  for (const row of SEEDED) tree.$.rows.addOne({ ...row });
  await flush();
};

const refusals = {
  'addMany, an existing id after a new one': (tree: Tree) =>
    tree.$.rows.addMany([
      { id: 'x', n: 1 },
      { id: 'a', n: 9 },
    ]),
  'addMany, an existing id twice': (tree: Tree) =>
    tree.$.rows.addMany([
      { id: 'a', n: 9 },
      { id: 'a', n: 10 },
    ]),
  'prependMany, an existing id after a new one': (tree: Tree) =>
    tree.$.rows.prependMany([
      { id: 'x', n: 1 },
      { id: 'a', n: 9 },
    ]),
  'prependMany, an existing id twice': (tree: Tree) =>
    tree.$.rows.prependMany([
      { id: 'a', n: 9 },
      { id: 'a', n: 10 },
    ]),
  'prependOne, an existing id': (tree: Tree) =>
    tree.$.rows.prependOne({ id: 'a', n: 9 }),
};
type Refusal = keyof typeof refusals;
const names = Object.keys(refusals) as Refusal[];

const watchHooks = (tree: Tree) => {
  const calls: string[] = [];
  tree.$.rows.intercept({ onAdd: (row) => void calls.push(`i:${row.id}`) });
  tree.$.rows.tap({ onAdd: (row) => void calls.push(`t:${row.id}`) });
  return calls;
};

describe.each([
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('strict refusal of an existing id: undo (%s)', (_name, enhancers) => {
  it.each(names)(
    '%s — no interceptor, no history; undo and redo of the earlier entry exact',
    async (name) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        undoable(() => tree.$.rows.addOne({ id: 'w', n: 4 }));
        await flush();
        const entries = tree.getRestorationHistory().length;
        const calls = watchHooks(tree);
        expect(() => undoable(() => refusals[name](tree))).toThrow(
          'Entity with id a already exists'
        );
        await flush();
        expect(calls).toStrictEqual([]);
        expect(tree.$.rows.all()).toStrictEqual(WITH_W);
        expect(tree.getRestorationHistory()).toHaveLength(entries);
        expect(tree.canRedo()).toBe(false);
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        tree.redo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(WITH_W);
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      } finally {
        tree.destroy();
      }
    }
  );

  it.each(names)(
    '%s — caught inside the undo entry: the entry holds only the earlier write',
    async (name) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        undoable(() => {
          tree.$.rows.addOne({ id: 'w', n: 4 });
          expect(() => refusals[name](tree)).toThrow(
            'Entity with id a already exists'
          );
        });
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(WITH_W);
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        tree.redo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(WITH_W);
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
] as const)(
  'strict refusal of an existing id: rollback (%s)',
  (_name, enhancers) => {
    it.each(names)(
      '%s — caught inside the transaction: rollback restores the seed exactly',
      async (name) => {
        const tree = make(enhancers());
        try {
          await seed(tree);
          const calls = watchHooks(tree);
          const pending = tree.transaction(() => {
            tree.$.rows.addOne({ id: 'w', n: 4 });
            expect(() => refusals[name](tree)).toThrow(
              'Entity with id a already exists'
            );
          });
          await flush();
          expect(calls).toStrictEqual(['i:w', 't:w']);
          expect(tree.$.rows.all()).toStrictEqual(WITH_W);
          pending.rollback();
          await flush();
          expect(tree.$.rows.all()).toStrictEqual(SEEDED);
          expect(tree.$.rows.ids()).toStrictEqual(['z', 'a']);
        } finally {
          tree.destroy();
        }
      }
    );

    it.each(names)(
      '%s — thrown out of the transaction: nothing from it survives',
      async (name) => {
        const tree = make(enhancers());
        try {
          await seed(tree);
          expect(() =>
            tree.transaction(() => {
              tree.$.rows.addOne({ id: 'w', n: 4 });
              refusals[name](tree);
            })
          ).toThrow('Entity with id a already exists');
          await flush();
          expect(tree.$.rows.all()).toStrictEqual(SEEDED);
          expect(tree.$.rows.ids()).toStrictEqual(['z', 'a']);
        } finally {
          tree.destroy();
        }
      }
    );
  }
);
