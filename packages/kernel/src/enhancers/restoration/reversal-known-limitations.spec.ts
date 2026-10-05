import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * TRACKING — reversal failures that are PRE-EXISTING ON npm 15.4.3 and are not
 * fixed by the update-then-remove / addMany-overwrite repairs. Each is written
 * as the CORRECT behaviour and marked `it.fails`, so this file stays green
 * while the defect stands and turns RED the moment one is fixed — at which
 * point flip that case to `it` and move it to a carrier file.
 *
 * Found while probing those repairs; reproduced identically on d63166c9.
 */
type Row = { id: string; n: number };
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
  { id: 'a', n: 1 },
  { id: 'c', n: 3 },
];
const seed = async (tree: Tree) => {
  for (const row of SEEDED) tree.$.rows.addOne({ ...row });
  await flush();
};

const undoConfigurations = [
  ['restoration()', () => [restoration()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const;
const rollbackConfigurations = [
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const;

describe.each(undoConfigurations)(
  'known pre-existing undo/redo failures (%s)',
  (_name, enhancers) => {
    // PRE-EXISTING ON 15.4.3. Values come back right, ORDER does not:
    // [a, c, z]. The notifier batches by path, so the removal of `rows.a` is
    // delivered in the slot of the earlier `rows.a` update; the turn's
    // removals are then out of order and the restore anchoring depends on it.
    it.fails('updateOne then clear: undo restores the order', async () => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        undoable(() => {
          tree.$.rows.updateOne('a', { n: 2 });
          tree.$.rows.clear();
        });
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toEqual(SEEDED);
      } finally {
        tree.destroy();
      }
    });

    // PRE-EXISTING ON 15.4.3. Undo throws "Unsupported scoped undo effect at
    // structural-drift": the rekey-then-remove composition keeps the rekey's
    // earlier slot, so the reversed turn reverses the field before the row is
    // back.
    it.fails('changeId, updateOne, removeOne: undo restores', async () => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        undoable(() => {
          tree.$.rows.changeId('a', 'a2');
          tree.$.rows.updateOne('a2', { n: 2 });
          tree.$.rows.removeOne('a2');
        });
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toEqual(SEEDED);
      } finally {
        tree.destroy();
      }
    });

    // PRE-EXISTING ON 15.4.3. Undo is correct; redo throws "Collection
    // structural target has no live placement anchor".
    it.fails(
      'add x and y, update x, removeMany a and c: redo reapplies',
      async () => {
        const tree = make(enhancers());
        try {
          await seed(tree);
          undoable(() => {
            tree.$.rows.addOne({ id: 'x', n: 1 });
            tree.$.rows.addOne({ id: 'y', n: 1 });
            tree.$.rows.updateOne('x', { n: 9 });
            tree.$.rows.removeMany(['a', 'c']);
          });
          await flush();
          const after = tree.$.rows.all();
          tree.undo();
          await flush();
          tree.redo();
          await flush();
          expect(tree.$.rows.all()).toEqual(after);
        } finally {
          tree.destroy();
        }
      }
    );
  }
);

describe.each(rollbackConfigurations)(
  'known pre-existing rollback failures (%s)',
  (_name, enhancers) => {
    // PRE-EXISTING ON 15.4.3. The declarative rollback target applies the
    // field reversal of a row created in the turn AFTER that row's removal
    // and refuses with "Value effect has no active subject" (the mirror of
    // update-then-remove: the reversal must precede the removal, or be
    // dropped as the pending planner does).
    it.fails(
      'removeOne a, re-add a, updateOne a: rollback restores',
      async () => {
        const tree = make(enhancers());
        try {
          await seed(tree);
          const pending = tree.transaction(() => {
            tree.$.rows.removeOne('a');
            tree.$.rows.addOne({ id: 'a', n: 5 });
            tree.$.rows.updateOne('a', { n: 6 });
          });
          await flush();
          pending.rollback();
          await flush();
          expect(tree.$.rows.all()).toEqual(SEEDED);
        } finally {
          tree.destroy();
        }
      }
    );

    // PRE-EXISTING ON 15.4.3, same cause as above.
    it.fails(
      'add x and y, update x, removeMany a and c: rollback restores',
      async () => {
        const tree = make(enhancers());
        try {
          await seed(tree);
          const pending = tree.transaction(() => {
            tree.$.rows.addOne({ id: 'x', n: 1 });
            tree.$.rows.addOne({ id: 'y', n: 1 });
            tree.$.rows.updateOne('x', { n: 9 });
            tree.$.rows.removeMany(['a', 'c']);
          });
          await flush();
          pending.rollback();
          await flush();
          expect(tree.$.rows.all()).toEqual(SEEDED);
        } finally {
          tree.destroy();
        }
      }
    );
  }
);

type NestedRow = { id: string; n: number; nest?: { x: number } };
const nestedDeclaration = () => ({
  rows: entityMap<NestedRow, string>({ selectId: (row) => row.id }),
});
const typedNested = () =>
  signalTree(nestedDeclaration(), {
    enhancers: [transactions(), restoration()],
  });
type NestedTree = ReturnType<typeof typedNested>;

describe.each(undoConfigurations)(
  'known pre-existing undo failure: object-valued field (%s)',
  (_name, enhancers) => {
    // PRE-EXISTING ON 15.4.3 (found while probing the repairs, not on the
    // original list). Undo of a replacement that DROPS an object-valued field
    // throws "Unsupported scoped undo effect at rows.a.nest"; a primitive field
    // undoes correctly, and transactions() rollback restores both.
    it.fails('replaceOne dropping an object field: undo restores', async () => {
      const tree = signalTree(nestedDeclaration(), {
        enhancers: enhancers() as never,
      }) as unknown as NestedTree;
      try {
        tree.$.rows.addOne({ id: 'a', n: 1, nest: { x: 1 } });
        await flush();
        undoable(() => tree.$.rows.replaceOne('a', { id: 'a', n: 2 }));
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toEqual([{ id: 'a', n: 1, nest: { x: 1 } }]);
      } finally {
        tree.destroy();
      }
    });
  }
);
