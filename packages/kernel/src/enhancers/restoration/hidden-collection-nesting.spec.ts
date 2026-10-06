import { afterEach, describe, expect, it } from 'vitest';
import {
  entityMap,
  external,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../../index';

/**
 * v16 integration slice 8c, slice 8b open item 6: entity collections hidden
 * by an omitted branch more than one level up, and several collections under
 * the one member that a reversal re-adds. Undo, redo, jumpTo (single and
 * declarative path) and pending rollback, in both enhancer orders.
 *
 * Rules (slices 8b and 8c):
 * - ordinary omission: the reversal re-adds the outermost hidden member with
 *   only the way to its locations; collections become current with their
 *   branch, and other state locations stay absent;
 * - external omission: refused with ST1034, nothing written;
 * - pending rollback: the rest rolls back, and the hidden collections hold the
 *   pre-image (no rejected value can come back on a later re-add).
 */

type Row = { id: string; n: number };
const trees: Array<{ destroy(): void }> = [];
afterEach(() => {
  for (const tree of trees.splice(0)) tree.destroy();
});
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const historyOrders = {
  'transactions first': () => [transactions(), restoration()],
  'restoration first': () => [restoration(), transactions()],
};
const rollbackOrders = {
  'transactions alone': () => [transactions()],
  ...historyOrders,
};

function make(
  enhancers: ReturnType<(typeof rollbackOrders)['transactions alone']>
) {
  const tree = signalTree(
    {
      g: {
        h: { rows: entityMap<Row, string>(), k: 0 },
        other: entityMap<Row, string>(),
        j: 0,
      },
      count: 0,
    },
    { enhancers }
  );
  trees.push(tree);
  const rows = tree.$.g.h.rows;
  const other = tree.$.g.other;
  rows.setAll([
    { id: 'a', n: 0 },
    { id: 'b', n: 0 },
  ]);
  // The enhancer list is chosen at runtime; the history surface is asserted
  // by the cases that use it.
  const history = tree as typeof tree & {
    undo(): void;
    redo(): void;
    jumpTo(index: number): void;
    getCurrentIndex(): number;
  };
  return { tree: history, rows, other };
}
type Made = ReturnType<typeof make>;
const ids = (collection: Made['rows']) => collection.ids();

/** The turn: a nested update, a reorder, and an add in a sibling collection. */
const change = (t: Made) => {
  t.rows.updateOne('a', { n: 1 });
  t.rows.setAll([
    { id: 'b', n: 0 },
    { id: 'a', n: 1 },
  ]);
  t.other.addOne({ id: 'x', n: 9 });
  t.tree.$.count(1);
};
const omit = (t: Made) => t.tree.$({ count: t.tree.$.count() } as never);
const before = {
  g: {
    h: {
      rows: {
        all: [
          { id: 'a', n: 0 },
          { id: 'b', n: 0 },
        ],
      },
    },
    other: { all: [] },
  },
  count: 0,
};

describe('ordinary omission of a branch two levels above its collections', () => {
  for (const [order, enhancers] of Object.entries(historyOrders)) {
    it(`undo re-adds the way to both collections; redo and undo stay symmetric (${order})`, async () => {
      const t = make(enhancers() as never);
      await flush();
      undoable(() => change(t));
      await flush();
      omit(t);
      await flush();
      expect(t.tree.$()).toEqual({ count: 1 });
      t.tree.undo();
      expect(t.tree.$()).toEqual(before);
      t.tree.redo();
      expect(ids(t.rows)).toEqual(['b', 'a']);
      expect(t.rows.byId('a')?.()).toEqual({ id: 'a', n: 1 });
      expect(ids(t.other)).toEqual(['x']);
      expect(t.tree.$.count()).toBe(1);
      t.tree.undo();
      expect(t.tree.$()).toEqual(before);
    });

    it(`redo after the omission re-adds with the after-image (${order})`, async () => {
      const t = make(enhancers() as never);
      await flush();
      undoable(() => change(t));
      await flush();
      t.tree.undo();
      await flush();
      omit(t);
      await flush();
      t.tree.redo();
      expect(t.tree.$()).toEqual({
        g: {
          h: {
            rows: {
              all: [
                { id: 'b', n: 0 },
                { id: 'a', n: 1 },
              ],
            },
          },
          other: { all: [{ id: 'x', n: 9 }] },
        },
        count: 1,
      });
    });

    it(`jumpTo re-adds the way to both collections (${order})`, async () => {
      const t = make(enhancers() as never);
      await flush();
      undoable(() => t.tree.$.count(5));
      await flush();
      undoable(() => change(t));
      await flush();
      omit(t);
      await flush();
      t.tree.jumpTo(0);
      expect(t.tree.getCurrentIndex()).toBe(0);
      expect(t.tree.$()).toEqual({ ...before, count: 5 });
    });
  }
});

describe('external omission of a branch two levels above its collections', () => {
  for (const [order, enhancers] of Object.entries(historyOrders))
    for (const operation of ['undo', 'redo', 'jumpTo'] as const)
      it(`${operation} refuses, nothing written (${order})`, async () => {
        const t = make(enhancers() as never);
        await flush();
        if (operation === 'jumpTo') {
          undoable(() => t.tree.$.count(5));
          await flush();
        }
        undoable(() => change(t));
        await flush();
        if (operation === 'redo') {
          t.tree.undo();
          await flush();
        }
        external(() => omit(t));
        await flush();
        const rowsBefore = t.rows.all();
        const otherBefore = t.other.all();
        const index = t.tree.getCurrentIndex();
        expect(() =>
          operation === 'jumpTo' ? t.tree.jumpTo(0) : t.tree[operation]()
        ).toThrow(/ST1034.*'g'/);
        expect(t.tree.$()).toEqual({ count: t.tree.$.count() });
        expect(t.rows.all()).toEqual(rowsBefore);
        expect(t.other.all()).toEqual(otherBefore);
        expect(t.tree.getCurrentIndex()).toBe(index);
      });
});

describe('pending rollback under a branch two levels above its collections', () => {
  for (const [order, enhancers] of Object.entries(rollbackOrders))
    for (const omission of ['ordinary', 'external'] as const)
      it(`${omission} omission: the rest rolls back and the hidden collections hold the pre-image (${order})`, async () => {
        const t = make(enhancers() as never);
        await flush();
        const pending = (
          t.tree as unknown as {
            transact(fn: () => void): { rollback(): void };
          }
        ).transact(() => change(t));
        await flush();
        if (omission === 'external') external(() => omit(t));
        else omit(t);
        await flush();
        pending.rollback();
        expect(t.tree.$()).toEqual({ count: 0 });
        // Detached handles read the retained collections: the rejected
        // update, reorder and add are gone from them.
        expect(ids(t.rows)).toEqual(['a', 'b']);
        expect(t.rows.byId('a')?.()).toEqual({ id: 'a', n: 0 });
        expect(ids(t.other)).toEqual([]);
      });
});

describe('review follow-up (slice 8c)', () => {
  for (const [order, enhancers] of Object.entries(historyOrders)) {
    it(`a collection omitted below an omitted branch is refused, not reported as restored (${order})`, async () => {
      const t = make(enhancers() as never);
      await flush();
      undoable(() => {
        t.rows.updateOne('a', { n: 1 });
        t.tree.$.count(1);
      });
      await flush();
      // An ordinary write omits the collection from `h`, then another omits `g`.
      (t.tree.$.g.h as unknown as (value: unknown) => void)({ k: 0 });
      omit(t);
      await flush();
      const index = t.tree.getCurrentIndex();
      let message = '';
      try {
        t.tree.undo();
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toBe(
        "Unsupported scoped undo effect at 'g.h.rows.a.n': its enclosing member 'g.h.rows' was omitted and cannot be re-added, because it is not a plain state location (an entity collection, for example). Nothing was changed; the history position is unmoved."
      );
      expect(t.tree.$()).toEqual({ count: 1 });
      expect(t.rows.byId('a')?.()).toEqual({ id: 'a', n: 1 });
      expect(t.tree.getCurrentIndex()).toBe(index);
    });

    it(`undo of a designated omission of a branch holding collections re-adds it (${order})`, async () => {
      const t = make(enhancers() as never);
      await flush();
      undoable(() => omit(t));
      await flush();
      expect(t.tree.$()).toEqual({ count: 0 });
      t.tree.undo();
      expect(t.tree.$()).toEqual({
        g: {
          h: {
            rows: {
              all: [
                { id: 'a', n: 0 },
                { id: 'b', n: 0 },
              ],
            },
            k: 0,
          },
          other: { all: [] },
          j: 0,
        },
        count: 0,
      });
      t.tree.redo();
      expect(t.tree.$()).toEqual({ count: 0 });
    });
  }

  for (const [order, enhancers] of Object.entries(rollbackOrders))
    it(`the documented rollback order: the newer omission of a branch holding collections settles first (${order})`, async () => {
      const t = make(enhancers() as never);
      await flush();
      type Pending = { rollback(): void };
      const transact = (fn: () => void) =>
        (t.tree as unknown as { transact(fn: () => void): Pending }).transact(
          fn
        );
      const older = transact(() => t.rows.updateOne('a', { n: 1 }));
      await flush();
      const newer = transact(() => omit(t));
      await flush();
      expect(() => older.rollback()).toThrow(/later-confirmed-dependency/);
      newer.rollback();
      expect(t.rows.byId('a')?.()).toEqual({ id: 'a', n: 1 });
      expect(Object.keys(t.tree.$())).toContain('g');
      older.rollback();
      expect(t.tree.$()).toEqual({
        g: {
          h: {
            rows: {
              all: [
                { id: 'a', n: 0 },
                { id: 'b', n: 0 },
              ],
            },
            k: 0,
          },
          other: { all: [] },
          j: 0,
        },
        count: 0,
      });
    });
});
