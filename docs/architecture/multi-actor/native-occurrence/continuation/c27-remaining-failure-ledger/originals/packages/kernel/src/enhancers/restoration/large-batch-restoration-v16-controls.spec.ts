// v16 controls: restoration call sites past V8's call-argument limit.
//
// v16 integration slice 5, split from lib/entity-large-batches-v16-controls
// so these 130k-row trees get their own worker. `target.push(...items)` throws
// "Maximum call stack size exceeded" past ~1.2e5 items. jumpTo drives the
// directed turn transition in both directions; a truncated turn releases its
// restoration claims (v15 c2f72e6e's site).
import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { restoration } from './restoration';
import { restorationReader } from '../../lib/internals/restoration-reader';
import {
  clearProductionSubstrateStatsForTesting,
  installProductionSubstrateStatsForTesting,
  resetProductionSubstrateStatsForTesting,
} from '../../lib/internals/production-substrate-stats';

type Row = { id: number; n: number };
const rows = (count: number, offset = 0): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: i + offset, n: i }));
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const LARGE = 130_000;

describe('v16 restoration of turns larger than the argument limit', () => {
  // The two restoration cases below use one large clear() turn rather than a
  // replacement: they need >1.2e5 effects in one turn, not 3x that many rows.
  // A replacement's or addMany's redo also reaches other v16 scale limits
  // (retention across jumps; deriveStructuralTargetOrder's per-addition
  // search), which are not call-argument limits; see PROGRESS.md slice 5.
  it('jumps across a turn that cleared more rows than the argument limit', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>() },
      { enhancers: [restoration()] }
    );
    try {
      tree.$.rows.setAll(rows(LARGE));
      await flush();
      undoable(() => tree.$.rows.updateOne(0, { n: -1 }));
      await flush();
      undoable(() => tree.$.rows.clear());
      await flush();
      // Two entries, through the restoration reader rather than
      // `getRestorationHistory()`: materializing that one's snapshots for a
      // 130k-row clear grows faster than linearly (20.6 s here alone; slice
      // 8c, open item) and is not what this case is about.
      expect(restorationReader(tree)?.snapshot().entries).toHaveLength(2);
      expect(tree.getCurrentIndex()).toBe(1);
      // Counted work, not wall-clock time (slice 8c): each jump touches each
      // row a bounded number of times, so it cannot become the timeout this
      // case used to hit under load. Measured: jumpTo(0) writes every row
      // once and reads 2 publication dependencies per row; jumpTo(1)
      // tombstones every row once and reads 9 per row. The read bounds (3
      // and 12 per row) leave room for constant-factor changes while still
      // failing any per-row growth with the collection's size.
      const stats = installProductionSubstrateStatsForTesting();
      try {
        tree.jumpTo(0);
        expect(stats.valueStoreWrites).toBe(LARGE);
        expect(stats.publicationDependencyReads).toBeLessThanOrEqual(3 * LARGE);
        const ids = tree.$.rows.ids();
        expect(ids.length).toBe(LARGE);
        expect(ids[0]).toBe(0);
        expect(ids[LARGE - 1]).toBe(LARGE - 1);
        expect(tree.$.rows.byId(0)?.()?.n).toBe(-1);
        resetProductionSubstrateStatsForTesting(stats);
        tree.jumpTo(1);
        expect(stats.structuralSubjectTombstones).toBe(LARGE);
        expect(stats.publicationDependencyReads).toBeLessThanOrEqual(
          12 * LARGE
        );
        expect(tree.$.rows.count()).toBe(0);
      } finally {
        clearProductionSubstrateStatsForTesting();
      }
    } finally {
      tree.destroy();
    }
  }, 120_000);

  it('releases the claims of a truncated turn that cleared more rows than the argument limit', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>() },
      { enhancers: [restoration({ maxHistorySize: 1 })] }
    );
    try {
      tree.$.rows.setAll(rows(LARGE));
      await flush();
      undoable(() => tree.$.rows.clear());
      await flush();
      undoable(() => tree.$.rows.addOne({ id: -1, n: -1 }));
      await flush();
      expect(tree.getRestorationHistory()).toHaveLength(1);
      tree.undo();
      expect(tree.$.rows.count()).toBe(0);
      expect(tree.canUndo()).toBe(false);
    } finally {
      tree.destroy();
    }
  }, 120_000);
});
