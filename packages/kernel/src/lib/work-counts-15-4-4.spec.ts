import { afterEach, describe, expect, it } from 'vitest';

import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';
import {
  clearProductionSubstrateStatsForTesting,
  installProductionSubstrateStatsForTesting,
  resetProductionSubstrateStatsForTesting,
} from './internals/production-substrate-stats';

/**
 * Counted-work carriers for the performance review of 15.4.4 against
 * 15.4.3 (`.claude/evidence/perf-15.4.4/`). Each pins the work one
 * operation does, independent of the machine: a timing would not hold on a
 * loaded one.
 */
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
afterEach(() => clearProductionSubstrateStatsForTesting());

describe('undo and redo of row edits do not walk the tree (item 1)', () => {
  // `reconcileOrdinaryLifetimes` found each touched collection by walking
  // the whole tree (`visitTree(tree.$)`), on every undo, redo or jump that
  // touched a row: 870x 15.4.3 on a 2,000-key tree.
  it('a 2,000-key tree: no tree visits per step', async () => {
    const big: Record<string, unknown> = {};
    for (let i = 0; i < 2000; i++) big['k' + i] = { x: i, y: { z: i } };
    const tree = signalTree(
      { big, rows: entityMap<{ id: number; n: number }, number>() },
      { enhancers: [restoration()] }
    ) as unknown as {
      $: {
        rows: {
          setAll(rows: Array<{ id: number; n: number }>): void;
          updateOne(id: number, changes: { n: number }): void;
          byId(id: number): (() => { n: number }) | undefined;
        };
      };
      undo(): void;
      redo(): void;
      destroy(): void;
    };
    try {
      tree.$.rows.setAll(
        Array.from({ length: 100 }, (_, id) => ({ id, n: 0 }))
      );
      for (let i = 0; i < 20; i++) {
        undoable(() => tree.$.rows.updateOne(i, { n: 5 }));
        await flush();
      }
      const stats = installProductionSubstrateStatsForTesting();
      resetProductionSubstrateStatsForTesting(stats);
      for (let i = 0; i < 20; i++) tree.undo();
      for (let i = 0; i < 20; i++) tree.redo();
      expect(tree.$.rows.byId(19)?.().n).toBe(5);
      expect(stats.treeVisits).toBe(0);
    } finally {
      tree.destroy();
    }
  });

  // The walk followed enumerable keys only, so a collection an omission
  // hides was not found, and the lookup keeps that: the reversal then
  // decides as before. Found, these three undid or refused differently
  // (the first re-added nothing and dropped `g`; the others refused on a
  // key holder instead).
  const hidden: Record<string, Array<(tree: Hidden) => void>> = {
    'an add, then an ordinary removal of the row': [
      (tree) => undoable(() => tree.$.g.rows.addOne({ id: 'z', n: 2 })),
      (tree) => tree.$.g.rows.removeOne('z'),
    ],
    'a removal, then an ordinary add at its key': [
      (tree) => undoable(() => tree.$.g.rows.removeOne('a')),
      (tree) => tree.$.g.rows.addOne({ id: 'a', n: 9 }),
    ],
  };
  type Hidden = {
    $: ((value?: unknown) => unknown) & {
      g: {
        rows: {
          setAll(rows: Array<{ id: string; n: number }>): void;
          addOne(row: { id: string; n: number }): void;
          removeOne(id: string): void;
        };
      };
    };
    undo(): void;
    getCurrentIndex(): number;
    destroy(): void;
  };
  for (const [name, steps] of Object.entries(hidden))
    it(`${name}, then an omission of its collection: undo refuses and changes nothing`, async () => {
      const tree = signalTree(
        {
          g: { rows: entityMap<{ id: string; n: number }, string>(), k: 0 },
          count: 0,
        },
        { enhancers: [transactions(), restoration()] }
      ) as unknown as Hidden;
      try {
        tree.$.g.rows.setAll([
          { id: 'a', n: 0 },
          { id: 'b', n: 1 },
        ]);
        await flush();
        for (const step of steps) {
          step(tree);
          await flush();
        }
        tree.$({ count: 1 });
        await flush();
        const index = tree.getCurrentIndex();
        expect(() => tree.undo()).toThrow(
          /^Unsupported scoped undo effect at structural-drift$/
        );
        await flush();
        expect(tree.$()).toEqual({ count: 1 });
        expect(tree.getCurrentIndex()).toBe(index);
      } finally {
        tree.destroy();
      }
    });
});
