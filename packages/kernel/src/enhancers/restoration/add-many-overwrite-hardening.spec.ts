import { afterEach, describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { getPathNotifier } from '../../lib/path-notifier';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * Follow-up carriers for the `addMany(..., { mode: 'overwrite' })` repair (see
 * add-many-overwrite-reversal.spec.ts) and for update-then-remove shapes it
 * meets: overwrites combined with other writes in one turn, duplicate ids in
 * one call, a field dropped before the row is removed, interceptors, taps and
 * `prependMany`.
 *
 * What npm 15.4.3 (d63166c9) did differs by row, so each case states what was
 * measured there. Rows marked `control` and the tap characterization behave
 * the same on 15.4.3.
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
const overwrite = (tree: Tree, rows: Row[]) =>
  tree.$.rows.addMany(
    rows.map((row) => ({ ...row })),
    { mode: 'overwrite' }
  );

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

// One turn each. Duplicate ids in one call: both entries replace the same
// row, the last one wins, and the batched notifier coalesces the two
// announcements (first previous value, last new value). 15.4.3: every
// duplicate-id row LOST the overwritten row on undo and on rollback.
const turns: Record<string, (tree: Tree) => void> = {
  'duplicate id in one call: a=5 then a=7': (tree) =>
    overwrite(tree, [
      { id: 'a', n: 5, tag: 't' },
      { id: 'a', n: 7, tag: 't' },
    ]),
  'duplicate id in one call, the second back to the original value': (tree) =>
    overwrite(tree, [
      { id: 'a', n: 5, tag: 't' },
      { id: 'a', n: 1, tag: 't' },
    ]),
  'duplicate id in one call, a field added then dropped': (tree) =>
    overwrite(tree, [
      { id: 'a', n: 5, tag: 'x' },
      { id: 'a', n: 7 },
    ]),
  'duplicate id in one call around a fresh row': (tree) =>
    overwrite(tree, [
      { id: 'a', n: 5, tag: 't' },
      { id: 'b', n: 2 },
      { id: 'a', n: 7, tag: 't' },
    ]),
  // 15.4.3: lost the row on undo and rollback.
  'overwrite keeping every field, then removeOne of that row': (tree) => {
    overwrite(tree, [
      { id: 'a', n: 9, tag: 't' },
      { id: 'b', n: 2 },
    ]);
    tree.$.rows.removeOne('a');
  },
  // The re-added row (as removed) lacks `tag`, so reversing the drop has to
  // RE-CREATE the field on it. c775278e refused this with structural-drift;
  // 15.4.3 lost the row on undo and rollback.
  'overwrite dropping a field, then removeOne of that row': (tree) => {
    overwrite(tree, [
      { id: 'a', n: 9 },
      { id: 'b', n: 2 },
    ]);
    tree.$.rows.removeOne('a');
  },
  // Same shape without an overwrite. 15.4.3: rollback restored the
  // intermediate row ({ id: 'a', n: 9 }, no `tag`) and undo refused
  // (structural-drift); c775278e: both refused.
  'replaceOne dropping a field, then removeOne': (tree) => {
    tree.$.rows.replaceOne('a', { id: 'a', n: 9 });
    tree.$.rows.removeOne('a');
  },
  // Declarative rollback target (two re-adds with outside anchors). 15.4.3:
  // rollback refused ("Value effect has no active subject"); undo was right.
  'replaceOne dropping a field, then removeMany': (tree) => {
    tree.$.rows.replaceOne('a', { id: 'a', n: 9 });
    tree.$.rows.removeMany(['a', 'c']);
  },
  // 15.4.3: lost the row on undo and rollback.
  'overwrite, then changeId of the overwritten row': (tree) => {
    overwrite(tree, [{ id: 'a', n: 9 }]);
    tree.$.rows.changeId('a', 'a2');
  },
  // 15.4.3: undo and rollback left { id: 'a2', n: 9 } (neither the value nor
  // the key reversed) and dropped `b`.
  'changeId, then overwrite under the new key': (tree) => {
    tree.$.rows.changeId('a', 'a2');
    overwrite(tree, [
      { id: 'a2', n: 9 },
      { id: 'b', n: 2 },
    ]);
  },
  // Control: correct on 15.4.3 as well (no overwrite involved).
  'control: removeOne, re-add the same key, removeOne again': (tree) => {
    tree.$.rows.removeOne('a');
    tree.$.rows.addOne({ id: 'a', n: 5 });
    tree.$.rows.removeOne('a');
  },
  // Update-then-remove, then the key reused by a lifetime created and removed
  // in the same turn. 15.4.3: rollback restored the UPDATED row (n: 2); undo
  // was right.
  'updateOne, removeOne, re-add, removeOne again': (tree) => {
    tree.$.rows.updateOne('a', { n: 2 });
    tree.$.rows.removeOne('a');
    tree.$.rows.addOne({ id: 'a', n: 5 });
    tree.$.rows.removeOne('a');
  },
};

describe.each(undoConfigurations)(
  'overwrite hardening: undo/redo (%s)',
  (_name, enhancers) => {
    it.each(Object.keys(turns))(
      '%s: undo restores, redo reapplies, undo again restores',
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
        } finally {
          tree.destroy();
        }
      }
    );
  }
);

describe.each(rollbackConfigurations)(
  'overwrite hardening: rollback (%s)',
  (_name, enhancers) => {
    it.each(Object.keys(turns))('%s: rollback restores', async (name) => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        const pending = tree.transaction(() => turns[name](tree));
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

// With batching off every announcement is delivered on its own, so the second
// entry of a duplicated id arrives with the pre-call row as its previous value
// rather than the first entry's value. Rollback reverses to each field's FIRST
// recorded previous value, which that is, so it is still exact. (Undo is not
// exercised here: with batching off `undoable()` records no turn for any
// mutation, on 15.4.3 as well.)
describe('overwrite hardening: rollback with notifier batching off', () => {
  afterEach(() => getPathNotifier().setBatchingEnabled(true));
  it.each(Object.keys(turns).filter((name) => name.startsWith('duplicate')))(
    '%s',
    async (name) => {
      getPathNotifier().setBatchingEnabled(false);
      const tree = make([transactions()]);
      try {
        await seed(tree);
        const pending = tree.transaction(() => turns[name](tree));
        pending.rollback();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      } finally {
        tree.destroy();
      }
    }
  );
});

// 15.4.3: undo and rollback lost the overwritten row.
describe.each(undoConfigurations)(
  'overwrite hardening: interceptor-transformed overwrite (%s)',
  (_name, enhancers) => {
    it('undo restores the original, redo the TRANSFORMED value', async () => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        tree.$.rows.intercept({
          onAdd: (row, ctx) => ctx.transform({ ...row, n: row.n * 10 }),
        });
        undoable(() =>
          overwrite(tree, [
            { id: 'a', n: 9 },
            { id: 'b', n: 2 },
          ])
        );
        await flush();
        const after = [
          { id: 'z', n: 0 },
          { id: 'a', n: 90 },
          { id: 'c', n: 3 },
          { id: 'b', n: 20 },
        ];
        expect(tree.$.rows.all()).toStrictEqual(after);
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
  }
);

describe.each(rollbackConfigurations)(
  'overwrite hardening: interceptor-transformed overwrite rollback (%s)',
  (_name, enhancers) => {
    it('rollback restores the original row', async () => {
      const tree = make(enhancers());
      try {
        await seed(tree);
        tree.$.rows.intercept({
          onAdd: (row, ctx) => ctx.transform({ ...row, n: row.n * 10 }),
        });
        const pending = tree.transaction(() =>
          overwrite(tree, [{ id: 'a', n: 9 }])
        );
        await flush();
        expect(tree.$.rows.byId('a')?.()).toStrictEqual({ id: 'a', n: 90 });
        pending.rollback();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(SEEDED);
      } finally {
        tree.destroy();
      }
    });
  }
);

// ⚠️ CHARACTERIZATION, NOT ENDORSEMENT. An overwritten row still fires `onAdd`
// and not `onUpdate`, as it did on 15.4.3; upsertOne/upsertMany/setAll fire
// `onUpdate` for a replaced row. Which tap an overwrite SHOULD fire is an open
// behaviour decision deliberately left unchanged in a patch release. This pins
// today's behaviour so a change to it is a visible decision.
describe('overwrite hardening: tap characterization', () => {
  it('an overwritten row fires onAdd, not onUpdate', async () => {
    const tree = make([restoration()]);
    try {
      await seed(tree);
      const added: Array<[string, Row]> = [];
      const updated: string[] = [];
      tree.$.rows.tap({
        onAdd: (row, id) => added.push([id, row]),
        onUpdate: (id) => updated.push(id),
      });
      overwrite(tree, [
        { id: 'a', n: 9 },
        { id: 'b', n: 2 },
      ]);
      expect(added).toStrictEqual([
        ['a', { id: 'a', n: 9 }],
        ['b', { id: 'b', n: 2 }],
      ]);
      expect(updated).toStrictEqual([]);
    } finally {
      tree.destroy();
    }
  });
});

// `prependMany` = `addMany` + `moveToFront`, and the move is not recorded in
// any turn (no order delta). The VALUES and membership reverse; the ORDER does
// not. Pre-existing on 15.4.3 for fresh rows too (redo re-appends them at the
// end); with 'overwrite', 15.4.3 deleted the overwritten row outright.
const prependOverwrite = (tree: Tree) =>
  tree.$.rows.prependMany(
    [
      { id: 'a', n: 9 },
      { id: 'b', n: 2 },
    ],
    { mode: 'overwrite' }
  );
const PREPENDED: Row[] = [
  { id: 'a', n: 9 },
  { id: 'b', n: 2 },
  { id: 'z', n: 0 },
  { id: 'c', n: 3 },
];
const byKey = (rows: readonly Row[]) =>
  [...rows].sort((left, right) => left.id.localeCompare(right.id));

// After undo, the overwritten row is back with its value but still at the
// front, and the new row is gone.
const UNDONE_AT_FRONT: Row[] = [
  { id: 'a', n: 1, tag: 't' },
  { id: 'z', n: 0 },
  { id: 'c', n: 3 },
];
// After redo, the overwrite is reapplied in place and the new row re-appended.
const REDONE_APPENDED: Row[] = [
  { id: 'a', n: 9 },
  { id: 'z', n: 0 },
  { id: 'c', n: 3 },
  { id: 'b', n: 2 },
];
const undoPrepend = async (tree: Tree) => {
  await seed(tree);
  undoable(() => prependOverwrite(tree));
  await flush();
  expect(tree.$.rows.all()).toStrictEqual(PREPENDED);
  tree.undo();
  await flush();
};

// KNOWN LIMITATION: `moveToFront` is unrecorded. The order part is
// PRE-EXISTING ON 15.4.3 (redo of a fresh `prependMany` re-appends its rows at
// the end there too); with 'overwrite', 15.4.3 lost the overwritten row
// instead, so the `current behaviour` tests below pin this line's state, not
// 15.4.3's. They are EXPECTED TO START FAILING when the move is recorded:
// delete them then and flip the matching `it.fails` to `it`.
describe.each(undoConfigurations)(
  'prependMany overwrite undo/redo (%s)',
  (_name, enhancers) => {
    it('undo restores the overwritten value and drops the new row; redo reapplies values', async () => {
      const tree = make(enhancers());
      try {
        await undoPrepend(tree);
        expect(byKey(tree.$.rows.all())).toStrictEqual(byKey(SEEDED));
        tree.redo();
        await flush();
        expect(byKey(tree.$.rows.all())).toStrictEqual(byKey(PREPENDED));
      } finally {
        tree.destroy();
      }
    });

    it('KNOWN LIMITATION (moveToFront unrecorded): undo — current behaviour: [a, z, c]', async () => {
      const tree = make(enhancers());
      try {
        await undoPrepend(tree);
        expect(tree.$.rows.all()).toStrictEqual(UNDONE_AT_FRONT);
      } finally {
        tree.destroy();
      }
    });

    it.fails(
      'KNOWN LIMITATION (moveToFront unrecorded): undo — desired: [z, a, c]',
      async () => {
        const tree = make(enhancers());
        try {
          await undoPrepend(tree);
          expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        } finally {
          tree.destroy();
        }
      }
    );

    it('KNOWN LIMITATION (moveToFront unrecorded): redo — current behaviour: [a, z, c, b]', async () => {
      const tree = make(enhancers());
      try {
        await undoPrepend(tree);
        tree.redo();
        await flush();
        expect(tree.$.rows.all()).toStrictEqual(REDONE_APPENDED);
      } finally {
        tree.destroy();
      }
    });

    it.fails(
      'KNOWN LIMITATION (moveToFront unrecorded): redo — desired: [a, b, z, c]',
      async () => {
        const tree = make(enhancers());
        try {
          await undoPrepend(tree);
          tree.redo();
          await flush();
          expect(tree.$.rows.all()).toStrictEqual(PREPENDED);
        } finally {
          tree.destroy();
        }
      }
    );
  }
);

describe.each(rollbackConfigurations)(
  'prependMany overwrite rollback (%s)',
  (_name, enhancers) => {
    const rollBackPrepend = async (tree: Tree) => {
      await seed(tree);
      const pending = tree.transaction(() => prependOverwrite(tree));
      await flush();
      pending.rollback();
      await flush();
    };

    it('rollback restores the overwritten value and drops the new row', async () => {
      const tree = make(enhancers());
      try {
        await rollBackPrepend(tree);
        expect(byKey(tree.$.rows.all())).toStrictEqual(byKey(SEEDED));
      } finally {
        tree.destroy();
      }
    });

    // Same limitation as above; same deletion rule for the pinned state.
    it('KNOWN LIMITATION (moveToFront unrecorded): rollback — current behaviour: [a, z, c]', async () => {
      const tree = make(enhancers());
      try {
        await rollBackPrepend(tree);
        expect(tree.$.rows.all()).toStrictEqual(UNDONE_AT_FRONT);
      } finally {
        tree.destroy();
      }
    });

    it.fails(
      'KNOWN LIMITATION (moveToFront unrecorded): rollback — desired: [z, a, c]',
      async () => {
        const tree = make(enhancers());
        try {
          await rollBackPrepend(tree);
          expect(tree.$.rows.all()).toStrictEqual(SEEDED);
        } finally {
          tree.destroy();
        }
      }
    );
  }
);
