import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { withWriteContext } from '../../lib/write-context';
import { SignalTreeRollbackError } from '../../lib/types';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

/**
 * Rolling back a transaction that EDITED an existing row, after SETTLED later
 * work removed that row (even a plain removeOne), skips the row's field
 * compensation: the row is gone, so there is nothing to restore. The rest of
 * the transaction reverses and the row stays absent. Owner decision for
 * 15.4.4, extending the 15.4.2 supersession rule (PROPOSAL-REJECTION-0 PR-A:
 * a pending-CREATED row that settled work removed) to field writes on an
 * existing row — as scalar and omission supersession already behave.
 *
 * On npm 15.4.3 the rollback refused with later-confirmed-dependency: the
 * removal path read as a parent of the field path, and the erased-by-settled-
 * work check ran only for add/rekey. The transaction's other writes were
 * stranded with no way to reject them. Found by the v15 known-issues audit
 * (x05).
 *
 * Still refused: an UNSETTLED removal (later-pending-dependency), later work
 * that edited the row and KEPT it, and a pending REMOVE whose key newer truth
 * re-occupied (unchanged rules).
 */
type Row = { id: string; n: number; tag?: string };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  x: 0,
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
  other: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;

const configurations = [
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const;

const SEEDED: Row[] = [
  { id: 'z', n: 0 },
  { id: 'a', n: 1 },
  { id: 'c', n: 3 },
];
const seed = async (tree: Tree) => {
  for (const row of SEEDED) tree.$.rows.addOne({ ...row });
  await flush();
};
const state = (tree: Tree) => ({
  x: tree.$.x(),
  rows: tree.$.rows.all(),
  other: tree.$.other.all(),
});
const refusalKind = (run: () => void): string | undefined => {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(SignalTreeRollbackError);
    return (error as { cause?: { kind?: string } }).cause?.kind;
  }
  return undefined;
};

const edits: Record<string, (tree: Tree) => void> = {
  updateOne: (tree) => tree.$.rows.updateOne('a', { n: 5 }),
  'updateOne twice, adding a field': (tree) => {
    tree.$.rows.updateOne('a', { n: 5 });
    tree.$.rows.updateOne('a', { tag: 't' });
  },
  replaceOne: (tree) => tree.$.rows.replaceOne('a', { id: 'a', n: 6 }),
  'field set through byId': (tree) =>
    (tree.$.rows.byId('a') as unknown as { n: (n: number) => void }).n(7),
};

const settledRemovals: Record<string, (tree: Tree) => void> = {
  'plain removeOne': (tree) => tree.$.rows.removeOne('a'),
  'confirmed transaction removal': (tree) =>
    tree.transaction(() => tree.$.rows.removeOne('a')).confirm(),
  'plain edit, then plain removal': (tree) => {
    tree.$.rows.updateOne('a', { n: 8 });
    tree.$.rows.removeOne('a');
  },
  'confirmed edit, then plain removal': (tree) => {
    tree.transaction(() => tree.$.rows.updateOne('a', { n: 8 })).confirm();
    tree.$.rows.removeOne('a');
  },
  'removeMany with another row': (tree) => tree.$.rows.removeMany(['a', 'c']),
  clear: (tree) => tree.$.rows.clear(),
};

describe.each(configurations)(
  'rollback after a settled removal of an edited row (%s)',
  (_name, enhancers) => {
    const make = (): Tree =>
      signalTree(declaration(), {
        enhancers: enhancers() as never,
      }) as unknown as Tree;

    for (const [editName, edit] of Object.entries(edits)) {
      it.each(Object.keys(settledRemovals))(
        `${editName}, then %s: rollback reverses the rest, the row stays absent`,
        async (removalName) => {
          const tree = make();
          try {
            await seed(tree);
            const proposal = tree.transaction(() => {
              edit(tree);
              tree.$.x(1);
            });
            await flush();
            settledRemovals[removalName](tree);
            await flush();
            const before = state(tree);
            expect(refusalKind(() => proposal.rollback())).toBeUndefined();
            await flush();
            expect(state(tree)).toStrictEqual({ ...before, x: 0 });
            expect(tree.$.rows.ids()).not.toContain('a');
          } finally {
            tree.destroy();
          }
        }
      );
    }

    it('the key re-occupied by a new row after the removal: the new row is untouched', async () => {
      const tree = make();
      try {
        await seed(tree);
        const proposal = tree.transaction(() => {
          tree.$.rows.updateOne('a', { n: 5 });
          tree.$.x(1);
        });
        await flush();
        tree.$.rows.removeOne('a');
        tree.$.rows.addOne({ id: 'a', n: 9 });
        await flush();
        const before = state(tree);
        expect(refusalKind(() => proposal.rollback())).toBeUndefined();
        await flush();
        expect(state(tree)).toStrictEqual({ ...before, x: 0 });
        expect(tree.$.rows.byId('a')?.()).toStrictEqual({ id: 'a', n: 9 });
      } finally {
        tree.destroy();
      }
    });

    // ── Still refused ──────────────────────────────────────────────────────
    it('still refuses while the removal is unsettled (later-pending-dependency)', async () => {
      const tree = make();
      try {
        await seed(tree);
        const proposal = tree.transaction(() => {
          tree.$.rows.updateOne('a', { n: 5 });
          tree.$.x(1);
        });
        await flush();
        const removal = tree.transaction(() => tree.$.rows.removeOne('a'));
        await flush();
        const refused = state(tree);
        expect(refusalKind(() => proposal.rollback())).toBe(
          'later-pending-dependency'
        );
        await flush();
        expect(state(tree)).toStrictEqual(refused);
        removal.confirm();
        await flush();
        expect(refusalKind(() => proposal.rollback())).toBeUndefined();
        await flush();
        expect(tree.$.x()).toBe(0);
      } finally {
        tree.destroy();
      }
    });

    it('still refuses when later work edited the row and kept it', async () => {
      const tree = make();
      try {
        await seed(tree);
        const proposal = tree.transaction(() => {
          tree.$.rows.updateOne('a', { n: 5 });
          tree.$.x(1);
        });
        await flush();
        tree.transaction(() => tree.$.rows.updateOne('a', { n: 8 })).confirm();
        await flush();
        const refused = state(tree);
        expect(refusalKind(() => proposal.rollback())).toBe(
          'later-confirmed-dependency'
        );
        await flush();
        expect(state(tree)).toStrictEqual(refused);
        expect(tree.$.rows.byId('a')?.()).toStrictEqual({ id: 'a', n: 8 });
      } finally {
        tree.destroy();
      }
    });

    it('still refuses a pending remove whose key newer truth re-occupied', async () => {
      const tree = make();
      try {
        await seed(tree);
        const proposal = tree.transaction(() => {
          tree.$.rows.removeOne('a');
          tree.$.x(1);
        });
        await flush();
        tree.$.rows.addOne({ id: 'a', n: 9 });
        await flush();
        const refused = state(tree);
        // A pending REMOVE whose key was re-occupied: a dependency (the
        // re-occupier rests on the vacated key), refused by the planner. It
        // surfaced from the failed re-add as effect-validation-failed until
        // 15.4.4 (proposal-rejection-0 case 15, the refusal-lifecycle gate).
        expect(refusalKind(() => proposal.rollback())).toBe(
          'later-confirmed-dependency'
        );
        await flush();
        expect(state(tree)).toStrictEqual(refused);
      } finally {
        tree.destroy();
      }
    });

    // Lifetimes are allocated per collection: another collection's row can
    // carry the same lifetime number. Its removal is not this row's.
    it('a settled removal in ANOTHER collection with the same lifetime number does not erase the row', async () => {
      const tree = make();
      try {
        await seed(tree);
        for (const row of SEEDED) tree.$.other.addOne({ ...row });
        await flush();
        const proposal = tree.transaction(() => {
          tree.$.rows.updateOne('a', { n: 5 });
          tree.$.x(1);
        });
        await flush();
        tree.$.other.removeOne('a');
        await flush();
        expect(refusalKind(() => proposal.rollback())).toBeUndefined();
        await flush();
        expect(state(tree)).toStrictEqual({
          x: 0,
          rows: SEEDED,
          other: SEEDED.filter((row) => row.id !== 'a'),
        });
      } finally {
        tree.destroy();
      }
    });
  }
);

// Later work arrives from three sources (authored turns, observed
// realizations, other open transactions). The final effect on the row decides,
// so they are merged in the order they happened, not grouped by source
// (reversal-engine review, item 4: a realized edit followed by a confirmed
// removal read as "edited and kept" and refused).
const realization = (fn: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, fn);

describe.each(configurations)(
  'rollback after later work from different sources, in time order (%s)',
  (_name, enhancers) => {
    const make = (): Tree =>
      signalTree(declaration(), {
        enhancers: enhancers() as never,
      }) as unknown as Tree;
    const open = (tree: Tree) =>
      tree.transaction(() => {
        tree.$.rows.updateOne('a', { n: 5 });
        tree.$.x(1);
      });

    it('a realized edit, then a confirmed removal: the row is erased, the rest reverses', async () => {
      const tree = make();
      try {
        await seed(tree);
        const proposal = open(tree);
        await flush();
        realization(() => tree.$.rows.updateOne('a', { n: 7 }));
        await flush();
        tree.transaction(() => tree.$.rows.removeOne('a')).confirm();
        await flush();
        const before = state(tree);
        expect(refusalKind(() => proposal.rollback())).toBeUndefined();
        await flush();
        expect(state(tree)).toStrictEqual({ ...before, x: 0 });
      } finally {
        tree.destroy();
      }
    });

    it('a confirmed edit, then a realized removal: the row is erased, the rest reverses', async () => {
      const tree = make();
      try {
        await seed(tree);
        const proposal = open(tree);
        await flush();
        tree.transaction(() => tree.$.rows.updateOne('a', { n: 7 })).confirm();
        await flush();
        realization(() => tree.$.rows.removeOne('a'));
        await flush();
        const before = state(tree);
        expect(refusalKind(() => proposal.rollback())).toBeUndefined();
        await flush();
        expect(state(tree)).toStrictEqual({ ...before, x: 0 });
      } finally {
        tree.destroy();
      }
    });

    // Rollback/rebase review, item 5: within one flush the authored record
    // was stamped when the flush closed it, after every realization of that
    // flush, so an authored edit followed by a realized removal read as the
    // removal first and refused. Effects are stamped as they are written.
    const sameFlush: Record<
      string,
      { write: (tree: Tree) => void; refused?: string }
    > = {
      'an authored edit, then a realized removal': {
        write: (tree) => {
          tree.$.rows.updateOne('a', { n: 7 });
          realization(() => tree.$.rows.removeOne('a'));
        },
      },
      'a realized edit, then an authored removal': {
        write: (tree) => {
          realization(() => tree.$.rows.updateOne('a', { n: 7 }));
          tree.$.rows.removeOne('a');
        },
      },
      'an authored removal of another row, then a realized edit of this one': {
        write: (tree) => {
          tree.$.rows.removeOne('c');
          realization(() => tree.$.rows.updateOne('a', { n: 7 }));
        },
        refused: 'later-confirmed-dependency',
      },
      'a realized removal of another row, then an authored edit of this one': {
        write: (tree) => {
          realization(() => tree.$.rows.removeOne('c'));
          tree.$.rows.updateOne('a', { n: 7 });
        },
        refused: 'later-confirmed-dependency',
      },
    };
    it.each(Object.keys(sameFlush))(
      'in one flush, %s: judged in the order written',
      async (name) => {
        const tree = make();
        try {
          await seed(tree);
          const proposal = open(tree);
          await flush();
          sameFlush[name].write(tree);
          await flush();
          const before = state(tree);
          expect(refusalKind(() => proposal.rollback())).toBe(
            sameFlush[name].refused
          );
          await flush();
          expect(state(tree)).toStrictEqual(
            sameFlush[name].refused ? before : { ...before, x: 0 }
          );
        } finally {
          tree.destroy();
        }
      }
    );

    it('a realized removal of another row, then a confirmed edit of this one: still refused', async () => {
      const tree = make();
      try {
        await seed(tree);
        const proposal = open(tree);
        await flush();
        realization(() => tree.$.rows.removeOne('c'));
        await flush();
        tree.transaction(() => tree.$.rows.updateOne('a', { n: 7 })).confirm();
        await flush();
        const refused = state(tree);
        expect(refusalKind(() => proposal.rollback())).toBe(
          'later-confirmed-dependency'
        );
        await flush();
        expect(state(tree)).toStrictEqual(refused);
      } finally {
        tree.destroy();
      }
    });
  }
);
