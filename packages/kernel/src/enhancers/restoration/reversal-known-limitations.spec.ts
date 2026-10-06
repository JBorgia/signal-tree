import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * TRACKING — reversal failures found PRE-EXISTING ON npm 15.4.3 while probing
 * the update-then-remove / addMany-overwrite repairs.
 *
 * All are repaired for 15.4.4; their rows below are ordinary `it` carriers
 * now, each marked FIXED with what it did on 15.4.3. The last two (an order
 * delta plus another structural change in ONE turn, and an order delta then
 * a LATER turn on the same collection) were tracked as a design-level pair
 * (a `current behaviour` row pinning the refusal beside an `it.fails`
 * `desired` row) until the owner's (a)+(d) decision repaired them.
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
// FIXED. setAll (survivors reordered) and prependMany (an overwritten row
// moved to the front) recorded their ORDER change as a collection order delta
// whose endpoints were the order just before and just after that call; a turn
// that also added or removed rows of the same collection left them off the
// turn's endpoints, and the reversal refused (setAll, PRE-EXISTING ON 15.4.3).
// The turn now records ONE net order delta per collection, composed from its
// order captures and its row changes, with the turn's own frontiers
// (`turn-order-record.ts`); the full matrix is
// `transactions/turn-order-delta.spec.ts`.
//
// The prependMany shape did not refuse on 15.4.3: its move was unrecorded and
// its overwrite read as an add, so undo AND rollback reported success and
// deleted the overwritten row (`c` gone, measured on 15.4.3 and on the v16
// integration head); earlier 15.4.4 work turned that loss into the refusal.
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
  'order delta composition in one turn, undo (%s)',
  (_name, enhancers) => {
    // FIXED (setAll: pre-existing on 15.4.3, undo refused; prependMany: undo
    // deleted the overwritten row on 15.4.3, then refused).
    it.each([
      ['setAll reorder, then removeOne', reorderThenRemove],
      [
        'addOne, then prependMany overwrite moving a row',
        addThenPrependOverwrite,
      ],
    ] as const)('%s: undo restores', async (_case, act) => {
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
    });
  }
);

describe.each(rollbackConfigurations)(
  'order delta composition in one turn, rollback (%s)',
  (_name, enhancers) => {
    const begin = (tree: Tree, act: (tree: Tree) => void) =>
      tree.transaction(() => act(tree));

    // FIXED (setAll: pre-existing on 15.4.3, rollback refused; prependMany:
    // rollback deleted the overwritten row on 15.4.3, then refused).
    it.each([
      ['setAll reorder, then removeOne', reorderThenRemove],
      [
        'addOne, then prependMany overwrite moving a row',
        addThenPrependOverwrite,
      ],
    ] as const)('%s: rollback restores', async (_case, act) => {
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
    });
  }
);

// ── An order delta, then a LATER turn that adds or removes a row ─────────────
// FIXED. An order delta applies only while the collection's order frontier is
// the exact token it recorded (the structural store issues a fresh token per
// order change; frontier = "causally allowed now",
// docs/architecture/causal-runtime-contract.md invariant 3). A later turn
// that added or removed a row replaced the token, and reversing that later
// turn issued yet another one, so the order change stayed irreversible even
// once the order was back to exactly the delta's endpoint (PRE-EXISTING ON
// 15.4.3 for setAll, also on the v16 integration head; the prependMany shapes
// reported success on 15.4.3 and deleted the overwritten row). Each turn now
// records its frontier transitions, and a reversal that lands where the
// collection is still at the token the turn left reinstates the token the
// turn replaced: identity is kept, since that is exactly the order the token
// named. Redo chains, jumpTo and history are in
// `transactions/turn-order-delta.spec.ts`.
const crossTurnShapes = [
  [
    'setAll reorder, then a separate removeOne',
    (tree: Tree) =>
      tree.$.rows.setAll([
        { id: 'c', n: 3 },
        { id: 'z', n: 0 },
        { id: 'a', n: 1 },
      ]),
    (tree: Tree) => tree.$.rows.removeOne('a'),
  ],
  [
    'setAll reorder, then a separate addOne',
    (tree: Tree) =>
      tree.$.rows.setAll([
        { id: 'c', n: 3 },
        { id: 'z', n: 0 },
        { id: 'a', n: 1 },
      ]),
    (tree: Tree) => tree.$.rows.addOne({ id: 'w', n: 4 }),
  ],
  [
    'prependMany overwrite moving a row, then a separate addOne',
    (tree: Tree) =>
      tree.$.rows.prependMany([{ id: 'c', n: 30 }], { mode: 'overwrite' }),
    (tree: Tree) => tree.$.rows.addOne({ id: 'w', n: 4 }),
  ],
  [
    'prependMany overwrite moving a row, then a separate removeOne',
    (tree: Tree) =>
      tree.$.rows.prependMany([{ id: 'c', n: 30 }], { mode: 'overwrite' }),
    (tree: Tree) => tree.$.rows.removeOne('a'),
  ],
] as const;

describe.each(undoConfigurations)(
  'order delta across turns, undo (%s)',
  (_name, enhancers) => {
    // FIXED (setAll: pre-existing on 15.4.3, the second undo refused;
    // prependMany: undo deleted the overwritten row on 15.4.3, then refused).
    it.each(crossTurnShapes)(
      '%s: undo twice restores',
      async (_case, order, later) => {
        const tree = make(enhancers());
        try {
          await seed(tree);
          undoable(() => order(tree));
          await flush();
          undoable(() => later(tree));
          await flush();
          tree.undo();
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
  'order delta across turns, rollback (%s)',
  (_name, enhancers) => {
    // FIXED (setAll: pre-existing on 15.4.3, the first rollback refused;
    // prependMany: rollback deleted the overwritten row on 15.4.3, then
    // refused).
    it.each(crossTurnShapes)(
      '%s: rolling back both restores',
      async (_case, order, later) => {
        const tree = make(enhancers());
        try {
          await seed(tree);
          const first = tree.transaction(() => order(tree));
          await flush();
          const second = tree.transaction(() => later(tree));
          await flush();
          second.rollback();
          await flush();
          first.rollback();
          await flush();
          expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        } finally {
          tree.destroy();
        }
      }
    );
  }
);
