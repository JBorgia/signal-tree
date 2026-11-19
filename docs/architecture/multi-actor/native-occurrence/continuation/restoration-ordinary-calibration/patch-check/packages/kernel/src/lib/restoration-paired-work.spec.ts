import { expect, it } from 'vitest';
import { entityMap, restoration, signalTree, undoable } from '../index';
import {
  clearProductionSubstrateStatsForTesting,
  installProductionSubstrateStatsForTesting,
  resetProductionSubstrateStatsForTesting,
} from './internals/production-substrate-stats';

const drain = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
// Leaving the temporal view reads RestorationManager.currentIndex once.
// This fixture acquires no restoration reader, so it has no reader lifecycle read.
const TEMPORAL_MANAGER_READS = 1;
for (const count of [3, 32, 256]) {
  it(`paired restoration installs ${count} physical rows once`, async () => {
    const tree = signalTree(
      { rows: entityMap<{ id: number; n: number }, number>() },
      { enhancers: [restoration()] }
    );
    try {
      tree.$.rows.setAll(Array.from({ length: count }, (_, id) => ({ id, n: id })));
      await drain();
      undoable(() => tree.$.rows.updateOne(0, { n: -1 }));
      await drain();
      undoable(() => tree.$.rows.clear());
      await drain();
      const stats = installProductionSubstrateStatsForTesting();
      try {
        tree.jumpTo(0);
        expect(stats.valueStoreWrites).toBe(count);
        expect(stats.publicationDependencyReads).toBeLessThanOrEqual(3 * count);
        expect(tree.$.rows.all()).toEqual(
          Array.from({ length: count }, (_, id) => ({ id, n: id === 0 ? -1 : id }))
        );
        resetProductionSubstrateStatsForTesting(stats);
        tree.jumpTo(1);
        expect(stats.structuralSubjectTombstones).toBe(count);
        expect(stats.publicationDependencyReads).toBeLessThanOrEqual(
          12 * count + TEMPORAL_MANAGER_READS
        );
        expect(tree.$.rows.all()).toEqual([]);
      } finally {
        clearProductionSubstrateStatsForTesting();
      }
    } finally {
      tree.destroy();
    }
  });
}
