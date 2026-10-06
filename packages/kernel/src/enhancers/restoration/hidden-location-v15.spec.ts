import { afterEach, describe, expect, it } from 'vitest';
import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../../index';

/**
 * Carriers the 15.4.4 port of the v16 hidden-location work (integration
 * slices 8b-8e) needed beyond the ported v16 ones, found by mutation:
 *
 * 1. v15 only. The re-add through v15's SEQUENTIAL declarative derivation.
 *    v15 derives a reversal one application at a time when a collection has
 *    order deltas from more than one application (`jumpTo()` across several
 *    reorders); v16 has no such path, so its carriers never reach it. The
 *    re-add decided for the whole reversal must reach the first
 *    application's target there too.
 * 2. Not v15-specific (v16 has the same gap). One turn that omits a branch
 *    and writes under it with an UPDATER: the write's history records what
 *    storage held, as the ported carrier pins for a plain write
 *    (`absent-path-write.spec.ts`, "one turn that omits a branch and writes
 *    under it is reversed exactly").
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
  'restoration alone': () => [restoration()],
};
const A = { id: 'a', n: 0 };
const B = { id: 'b', n: 0 };
const C = { id: 'c', n: 0 };

function make(enhancers: readonly unknown[]) {
  const tree = signalTree(
    { g: { rows: entityMap<Row, string>(), k: 0 }, count: 0 },
    { enhancers: enhancers as never }
  );
  trees.push(tree);
  tree.$.g.rows.setAll([A, B, C]);
  const history = tree as typeof tree & {
    undo(): void;
    redo(): void;
    jumpTo(index: number): void;
    getCurrentIndex(): number;
  };
  return { tree: history, rows: tree.$.g.rows };
}
const omit = (t: ReturnType<typeof make>) =>
  t.tree.$({ count: t.tree.$.count() } as never);

describe('hidden-location re-add through the sequential derivation (v15)', () => {
  for (const [order, enhancers] of Object.entries(historyOrders)) {
    it(`jumpTo back across two reorders re-adds only the way to the collection (${order})`, async () => {
      const t = make(enhancers());
      await flush();
      undoable(() => t.tree.$.count(5));
      await flush();
      undoable(() => t.rows.setAll([C, B, A]));
      await flush();
      undoable(() => t.rows.setAll([B, A, C]));
      await flush();
      omit(t);
      await flush();
      expect(t.tree.$()).toEqual({ count: 5 });
      t.tree.jumpTo(0);
      await flush();
      // `k` is no location of the reversal: it stays absent.
      expect(t.tree.$()).toEqual({ g: { rows: { all: [A, B, C] } }, count: 5 });
      expect(t.rows.ids()).toEqual(['a', 'b', 'c']);
      t.tree.jumpTo(2);
      await flush();
      expect(t.tree.$()).toEqual({ g: { rows: { all: [B, A, C] } }, count: 5 });
    });

    it(`a reordering entry's slot travels with the re-add (${order})`, async () => {
      const t = make(enhancers());
      await flush();
      undoable(() => t.tree.$.count(5));
      await flush();
      undoable(() => {
        t.rows.setAll([C, B, A]);
        t.tree.$.g.k(1);
      });
      await flush();
      undoable(() => t.rows.setAll([B, A, C]));
      await flush();
      omit(t);
      await flush();
      t.tree.jumpTo(0);
      await flush();
      expect(t.tree.$()).toEqual({
        g: { rows: { all: [A, B, C] }, k: 0 },
        count: 5,
      });
      t.tree.jumpTo(2);
      await flush();
      expect(t.tree.$()).toEqual({
        g: { rows: { all: [B, A, C] }, k: 1 },
        count: 5,
      });
    });
  }
});

type Leaf = { (): unknown; (value: unknown): void };
const rollbackOrders = {
  'transactions alone': () => [transactions()],
  'transactions first': () => [transactions(), restoration()],
  'restoration first': () => [restoration(), transactions()],
};

describe('one turn that omits a branch and writes under it with an updater', () => {
  const initial = () => ({
    a: { b: { value: 0, keep: 0 }, side: 0 },
    count: 0,
  });
  const turn = ($: Leaf & Record<string, unknown>) => {
    $({ count: 0 });
    const a = $['a'] as Record<string, unknown>;
    const b = a['b'] as Record<string, Leaf>;
    // Absent, so the updater receives undefined; history records storage.
    b['keep'](((current: unknown) =>
      current === undefined ? 9 : 99) as unknown);
  };
  const reversedTo = { a: { b: { value: 0, keep: 0 }, side: 0 }, count: 0 };

  for (const [order, enhancers] of Object.entries(historyOrders))
    it(`undo and redo (${order})`, async () => {
      const tree = signalTree(initial(), { enhancers: enhancers() });
      trees.push(tree);
      const history = tree as typeof tree & { undo(): void; redo(): void };
      undoable(() => turn(tree.$ as never));
      await flush();
      expect(tree.$()).toEqual({ a: { b: { keep: 9 } }, count: 0 });
      history.undo();
      expect(tree.$()).toEqual(reversedTo);
      history.redo();
      expect(tree.$()).toEqual({ a: { b: { keep: 9 } }, count: 0 });
    });

  for (const [order, enhancers] of Object.entries(rollbackOrders))
    it(`rollback (${order})`, async () => {
      const tree = signalTree(initial(), { enhancers: enhancers() });
      trees.push(tree);
      const pending = (
        tree as unknown as {
          transaction(run: () => void): { rollback(): void };
        }
      ).transaction(() => turn(tree.$ as never));
      await flush();
      pending.rollback();
      await flush();
      expect(tree.$()).toEqual(reversedTo);
    });
});
