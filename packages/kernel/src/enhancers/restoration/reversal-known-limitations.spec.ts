import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * TRACKING — reversal failures that are PRE-EXISTING ON npm 15.4.3 and are not
 * fixed by the update-then-remove / addMany-overwrite repairs. Found while
 * probing those repairs; reproduced identically on d63166c9.
 *
 * Each limitation is a PAIR:
 *
 * - `... — current behaviour` is an ordinary passing test that pins the
 *   SPECIFIC failure today (the exact error, or the exact wrong state), so an
 *   unrelated throw, a typo or a different regression cannot hide behind the
 *   tracking test. It is EXPECTED TO START FAILING when the defect is fixed;
 *   delete it then.
 * - `... — desired` states the correct behaviour and is marked `it.fails`.
 *   It turns red when the defect is fixed; flip it to `it` then.
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
const thrownBy = (run: () => void): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('expected a throw, none happened');
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

// ── updateOne then clear: undo order ─────────────────────────────────────────
// The notifier batches by path, so the removal of `rows.a` is delivered in the
// slot of the earlier `rows.a` update; the turn's removals are out of order
// and the restore anchoring depends on it. Values come back right.
const updateThenClear = (tree: Tree) =>
  undoable(() => {
    tree.$.rows.updateOne('a', { n: 2 });
    tree.$.rows.clear();
  });

// ── changeId, updateOne, removeOne: undo throws ──────────────────────────────
// The rekey-then-remove composition keeps the rekey's earlier slot, so the
// reversed turn reverses the field before the row is back.
const changeIdUpdateRemove = (tree: Tree) =>
  undoable(() => {
    tree.$.rows.changeId('a', 'a2');
    tree.$.rows.updateOne('a2', { n: 2 });
    tree.$.rows.removeOne('a2');
  });

// ── add x and y, update x, removeMany a and c: redo throws ───────────────────
const addUpdateRemoveMany = (tree: Tree) => {
  tree.$.rows.addOne({ id: 'x', n: 1 });
  tree.$.rows.addOne({ id: 'y', n: 1 });
  tree.$.rows.updateOne('x', { n: 9 });
  tree.$.rows.removeMany(['a', 'c']);
};
const ADDED_AND_REMOVED: Row[] = [
  { id: 'z', n: 0 },
  { id: 'x', n: 9 },
  { id: 'y', n: 1 },
];

describe.each(undoConfigurations)(
  'known pre-existing undo/redo limitations (%s)',
  (_name, enhancers) => {
    it('KNOWN LIMITATION (pre-existing on 15.4.3): updateOne then clear — current behaviour: undo restores [a, c, z]', async () => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        updateThenClear(tree);
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual([
          { id: 'a', n: 1 },
          { id: 'c', n: 3 },
          { id: 'z', n: 0 },
        ]);
      } finally {
        tree.destroy();
      }
    });

    it.fails(
      'KNOWN LIMITATION (pre-existing on 15.4.3): updateOne then clear — desired: undo restores [z, a, c]',
      async () => {
        const tree = make(enhancers());
        try {
          await seed(tree);
          updateThenClear(tree);
          await flush();
          tree.undo();
          await flush();
          expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        } finally {
          tree.destroy();
        }
      }
    );

    // FIXED (was pre-existing on 15.4.3: undo refused as structural drift).
    it('changeId, updateOne, removeOne: undo restores', async () => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        changeIdUpdateRemove(tree);
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      } finally {
        tree.destroy();
      }
    });

    // FIXED (was pre-existing on 15.4.3: redo threw "Collection structural
    // target has no live placement anchor" — x was anchored to c, which the
    // same transition removes).
    it('add x and y, update x, removeMany: redo reapplies', async () => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        undoable(() => addUpdateRemoveMany(tree));
        await flush();
        tree.undo();
        await flush();
        tree.redo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(ADDED_AND_REMOVED);
      } finally {
        tree.destroy();
      }
    });
  }
);

// ── Declarative rollback of add-then-update refuses ──────────────────────────
// The declarative rollback target applies the field reversal of a row created
// in the turn AFTER that row's removal ("Value effect has no active subject"):
// the mirror of update-then-remove. The reversal must precede the removal, or
// be dropped as the pending planner does.
const removeReAddUpdate = (tree: Tree) => {
  tree.$.rows.removeOne('a');
  tree.$.rows.addOne({ id: 'a', n: 5 });
  tree.$.rows.updateOne('a', { n: 6 });
};
describe.each(rollbackConfigurations)(
  'known pre-existing rollback limitations (%s)',
  (_name, enhancers) => {
    // FIXED (was pre-existing on 15.4.3: the declarative rollback target
    // applied the field reversal of a row created in the turn AFTER that row's
    // removal and refused with "Value effect has no active subject").
    it.each([
      ['removeOne a, re-add a, updateOne a', removeReAddUpdate],
      ['add x and y, update x, removeMany a and c', addUpdateRemoveMany],
    ] as const)('%s: rollback restores', async (_case, act) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        const pending = tree.transaction(() => act(tree));
        await flush();
        pending.rollback();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      } finally {
        tree.destroy();
      }
    });
  }
);

// ── Undo of a replacement that drops an OBJECT-valued field ──────────────────
// Found while probing the repairs, not on the original list. A primitive field
// undoes correctly, and transactions() rollback restores both.
type NestedRow = { id: string; n: number; nest?: { x: number } };
const nestedDeclaration = () => ({
  rows: entityMap<NestedRow, string>({ selectId: (row) => row.id }),
});
const typedNested = () =>
  signalTree(nestedDeclaration(), {
    enhancers: [transactions(), restoration()],
  });
type NestedTree = ReturnType<typeof typedNested>;
const makeNested = (enhancers: readonly unknown[]): NestedTree =>
  signalTree(nestedDeclaration(), {
    enhancers: enhancers as never,
  }) as unknown as NestedTree;
const dropObjectField = async (tree: NestedTree) => {
  tree.$.rows.addOne({ id: 'a', n: 1, nest: { x: 1 } });
  await flush();
  undoable(() => tree.$.rows.replaceOne('a', { id: 'a', n: 2 }));
  await flush();
};

describe.each(undoConfigurations)(
  'known pre-existing undo limitation: object-valued field (%s)',
  (_name, enhancers) => {
    it('KNOWN LIMITATION (pre-existing on 15.4.3): replaceOne dropping an object field — current behaviour: undo refuses at the field and changes nothing', async () => {
      const tree = makeNested(enhancers());
      try {
        await dropObjectField(tree);
        const error = thrownBy(() => tree.undo());
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(
          'Unsupported scoped undo effect at rows.a.nest'
        );
        await flush();
        expect(tree.$.rows.all()).toStrictEqual([{ id: 'a', n: 2 }]);
        expect(tree.canUndo()).toBe(true);
      } finally {
        tree.destroy();
      }
    });

    it.fails(
      'KNOWN LIMITATION (pre-existing on 15.4.3): replaceOne dropping an object field — desired: undo restores',
      async () => {
        const tree = makeNested(enhancers());
        try {
          await dropObjectField(tree);
          tree.undo();
          await flush();
          expect(tree.$.rows.all()).toStrictEqual([
            { id: 'a', n: 1, nest: { x: 1 } },
          ]);
        } finally {
          tree.destroy();
        }
      }
    );
  }
);
