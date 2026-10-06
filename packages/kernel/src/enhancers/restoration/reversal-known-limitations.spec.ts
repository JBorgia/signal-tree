import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { SignalTreeRollbackError } from '../../lib/types';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * TRACKING — reversal failures found PRE-EXISTING ON npm 15.4.3 while probing
 * the update-then-remove / addMany-overwrite repairs.
 *
 * All but one are repaired for 15.4.4; their rows below are ordinary `it`
 * carriers now, each marked FIXED with what it did on 15.4.3. The remaining
 * pair — an order delta plus another structural change in one turn — is a
 * design-level gap, reported rather than decided, and keeps the convention:
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
    // FIXED (was pre-existing on 15.4.3: undo restored [a, c, z]).
    it('updateOne then clear: undo restores [z, a, c]', async () => {
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
    });

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
    // FIXED (was pre-existing on 15.4.3: undo threw "Unsupported scoped undo
    // effect at rows.a.nest").
    it('replaceOne dropping an object field: undo restores', async () => {
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
    });
  }
);

// ── An order delta plus another structural change in ONE turn ────────────────
// setAll (survivors reordered) and prependMany (an overwritten row moved to the
// front) record their ORDER change as a collection order delta whose endpoints
// are the order just before and just after that call. A turn that also adds or
// removes rows of the same collection before or after it leaves the delta's
// endpoints off the turn's endpoints, and the declarative reversal refuses
// rather than guess. PRE-EXISTING ON 15.4.3 for setAll. Reported as a
// design-level gap (how an order capture composes with other structural
// effects in a turn), not repaired here.
//
// The prependMany shape did not refuse on 15.4.3: its move was unrecorded and
// its overwrite read as an add, so undo AND rollback reported success and
// deleted the overwritten row (`c` gone, measured on 15.4.3 and on the v16
// integration head). Recording the move turns that silent loss into this
// refusal, with state unchanged.
const reorderThenRemove = (tree: Tree) => {
  tree.$.rows.setAll([
    { id: 'c', n: 3 },
    { id: 'z', n: 0 },
    { id: 'a', n: 1 },
  ]);
  tree.$.rows.removeOne('a');
};
const addThenPrependOverwrite = (tree: Tree) => {
  tree.$.rows.addOne({ id: 'w', n: 4 });
  tree.$.rows.prependMany([{ id: 'c', n: 30 }], { mode: 'overwrite' });
};

describe.each(undoConfigurations)(
  'known design-level limitation: order delta composition, undo (%s)',
  (_name, enhancers) => {
    it.each([
      ['setAll reorder, then removeOne', reorderThenRemove],
      [
        'addOne, then prependMany overwrite moving a row',
        addThenPrependOverwrite,
      ],
    ] as const)(
      'KNOWN LIMITATION (design-level; setAll pre-existing on 15.4.3): %s — current behaviour: undo refuses and changes nothing',
      async (_case, act) => {
        const tree = make(enhancers());
        try {
          await seed(tree);
          undoable(() => act(tree));
          await flush();
          const after = tree.$.rows.all();
          const error = thrownBy(() => tree.undo());
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toMatch(
            /^(collection order frontier does not match the transition endpoint|Collection order does not match active SubjectIds)$/
          );
          await flush();
          expect(tree.$.rows.all()).toStrictEqual(after);
        } finally {
          tree.destroy();
        }
      }
    );

    it.fails.each([
      ['setAll reorder, then removeOne', reorderThenRemove],
      [
        'addOne, then prependMany overwrite moving a row',
        addThenPrependOverwrite,
      ],
    ] as const)(
      'KNOWN LIMITATION (design-level; setAll pre-existing on 15.4.3): %s — desired: undo restores',
      async (_case, act) => {
        const tree = make(enhancers());
        try {
          await seed(tree);
          undoable(() => act(tree));
          await flush();
          tree.undo();
          await flush();
          expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        } finally {
          tree.destroy();
        }
      }
    );
  }
);

describe.each(rollbackConfigurations)(
  'known design-level limitation: order delta composition, rollback (%s)',
  (_name, enhancers) => {
    const begin = (tree: Tree, act: (tree: Tree) => void) =>
      tree.transaction(() => act(tree));

    it.each([
      ['setAll reorder, then removeOne', reorderThenRemove],
      [
        'addOne, then prependMany overwrite moving a row',
        addThenPrependOverwrite,
      ],
    ] as const)(
      'KNOWN LIMITATION (design-level; setAll pre-existing on 15.4.3): %s — current behaviour: rollback refuses and changes nothing',
      async (_case, act) => {
        const tree = make(enhancers());
        try {
          await seed(tree);
          const proposal = begin(tree, act);
          await flush();
          const after = tree.$.rows.all();
          const error = thrownBy(() => proposal.rollback());
          expect(error).toBeInstanceOf(SignalTreeRollbackError);
          expect((error as { cause?: { kind?: string } }).cause?.kind).toBe(
            'effect-validation-failed'
          );
          await flush();
          expect(tree.$.rows.all()).toStrictEqual(after);
        } finally {
          tree.destroy();
        }
      }
    );

    it.fails.each([
      ['setAll reorder, then removeOne', reorderThenRemove],
      [
        'addOne, then prependMany overwrite moving a row',
        addThenPrependOverwrite,
      ],
    ] as const)(
      'KNOWN LIMITATION (design-level; setAll pre-existing on 15.4.3): %s — desired: rollback restores',
      async (_case, act) => {
        const tree = make(enhancers());
        try {
          await seed(tree);
          const proposal = begin(tree, act);
          await flush();
          proposal.rollback();
          await flush();
          expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        } finally {
          tree.destroy();
        }
      }
    );
  }
);
