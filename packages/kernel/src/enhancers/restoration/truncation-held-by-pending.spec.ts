import { afterEach, describe, expect, it } from 'vitest';

import { getOrCreateSubjectRestorationClaims } from '../../lib/internals/subject-restoration-claims';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * Rollback/rebase review, items 1 (MAJOR) and 4 (MINOR), and item 9.
 *
 * 1. 4ce92b3a held a truncated redo future until the NEW entry took its
 *    claims, but only for addEntry: a PENDING entry (an undoable
 *    transaction) released it at once, before the transaction's claims and
 *    before its own at confirm. Undo of `setAll(DCBA); undo();
 *    undoable(() => transaction(removeMany A, B).confirm())` threw "Subject 1
 *    cannot enter the structural target". The future is now held until the
 *    pending entry is confirmed or discarded.
 * 4. A throw after truncating (in buildTurn, or beforeInsert) left the future
 *    held for good: its claims outlived destroy, and after a reset its
 *    `restoration:<id>` owner could release a new entry's claims. Released on
 *    every exit, and by reset and destroy.
 * 9. getRestorationHistory() threw after a NON-undoable transaction (confirmed
 *    or rolled back) stood after an undone reorder; it reads now (the redo
 *    then refuses legibly while the transaction's removal stands).
 */
const realSort = Array.prototype.sort;
afterEach(() => {
  Array.prototype.sort = realSort;
});
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const rows = (ids: string): Row[] =>
  [...ids].map((id) => ({ id, n: id.charCodeAt(0) }));
const typed = () =>
  signalTree(
    { rows: entityMap<Row, string>() },
    { enhancers: [transactions(), restoration()] }
  );
type Tree = ReturnType<typeof typed>;
const ids = (tree: Tree) => tree.$.rows.ids().join('');
const claimsOf = (tree: Tree) =>
  (
    getOrCreateSubjectRestorationClaims(tree) as unknown as {
      snapshot(): { owners: number; claimedSubjects: number };
    }
  ).snapshot();

describe.each([
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)(
  'a truncated future and a pending entry (%s)',
  (_name, enhancers) => {
    const make = async (): Promise<Tree> => {
      const tree = signalTree(
        { rows: entityMap<Row, string>() },
        { enhancers: enhancers() as never }
      ) as unknown as Tree;
      tree.$.rows.setAll(rows('ABCD'));
      await flush();
      undoable(() => tree.$.rows.setAll(rows('DCBA')));
      await flush();
      tree.undo();
      await flush();
      return tree;
    };

    it('an undoable transaction confirmed: undo and redo of its removal', async () => {
      const tree = await make();
      try {
        undoable(() =>
          tree.transaction(() => tree.$.rows.removeMany(['A', 'B'])).confirm()
        );
        await flush();
        expect(ids(tree)).toBe('CD');
        // The truncated future is released once the entry took its claims:
        // only the confirmed entry owns claims now.
        expect(claimsOf(tree).owners).toBe(1);
        tree.undo();
        await flush();
        expect(ids(tree)).toBe('ABCD');
        tree.redo();
        await flush();
        expect(ids(tree)).toBe('CD');
      } finally {
        tree.destroy();
      }
      expect(claimsOf(tree)).toStrictEqual({ owners: 0, claimedSubjects: 0 });
    });

    it('an undoable transaction rolled back: the future is released, nothing leaks', async () => {
      const tree = await make();
      try {
        let pending: ReturnType<Tree['transaction']> | undefined;
        undoable(() => {
          pending = tree.transaction(() => tree.$.rows.removeMany(['A', 'B']));
        });
        await flush();
        pending?.rollback();
        await flush();
        expect(ids(tree)).toBe('ABCD');
        expect(claimsOf(tree)).toStrictEqual({ owners: 0, claimedSubjects: 0 });
        expect(() => tree.getRestorationHistory()).not.toThrow();
      } finally {
        tree.destroy();
      }
      expect(claimsOf(tree)).toStrictEqual({ owners: 0, claimedSubjects: 0 });
    });

    it.each(['confirm', 'rollback'] as const)(
      'a NON-undoable transaction (%s) after the undone reorder: history reads',
      async (settle) => {
        const tree = await make();
        try {
          const pending = tree.transaction(() =>
            tree.$.rows.removeMany(['A', 'B'])
          );
          await flush();
          if (settle === 'confirm') pending.confirm();
          else pending.rollback();
          await flush();
          expect(() => tree.getRestorationHistory()).not.toThrow();
          expect(tree.getRestorationHistory()).toHaveLength(1);
        } finally {
          tree.destroy();
        }
      }
    );

    it('a throw while recording after truncating leaks no claim past destroy', async () => {
      const tree = await make();
      try {
        // The next sort inside restoration's buildTurn throws, after the redo
        // future was truncated.
        Array.prototype.sort = function (
          this: unknown[],
          compare?: (left: unknown, right: unknown) => number
        ) {
          const frames = (new Error().stack ?? '').split('\n');
          if (
            frames.some(
              (frame) =>
                frame.includes('buildTurn') &&
                frame.includes('restoration/restoration.ts')
            )
          ) {
            Array.prototype.sort = realSort;
            throw new Error('INJECTED buildTurn');
          }
          return realSort.call(this, compare as never);
        } as typeof realSort;
        undoable(() => tree.$.rows.addOne({ id: 'G', n: 1 }));
        await flush();
        Array.prototype.sort = realSort;
        // Released at once, not at destroy.
        expect(claimsOf(tree)).toStrictEqual({ owners: 0, claimedSubjects: 0 });
      } finally {
        tree.destroy();
      }
      expect(claimsOf(tree)).toStrictEqual({ owners: 0, claimedSubjects: 0 });
    });

    it('a reset while a pending entry holds a truncated future releases it', async () => {
      const tree = await make();
      try {
        let pending: ReturnType<Tree['transaction']> | undefined;
        undoable(() => {
          pending = tree.transaction(() => tree.$.rows.removeMany(['A', 'B']));
        });
        await flush();
        tree.resetRestorationHistory();
        await flush();
        pending?.confirm();
        await flush();
        expect(claimsOf(tree)).toStrictEqual({ owners: 0, claimedSubjects: 0 });
      } finally {
        tree.destroy();
      }
    });
  }
);
