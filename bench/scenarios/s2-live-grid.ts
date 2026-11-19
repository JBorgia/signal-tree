import { framesOverlappingTurns } from '../runner/browser.ts';
import type { ScenarioDefinition } from '../runner/types.ts';
import { withBenchPage } from './page.ts';

/** Harness choices S2 does not take from budgets.json. */
export const S2_SETUP = { fieldsPerUpdate: 3, seed: 2026 } as const;

/**
 * S2: live grid at 4× CPU throttle. The collection holds `rows` × `fields`,
 * `rendered` rows are on screen, and the page applies `rowUpdatesPerSecond`
 * row updates in batches every `batchEveryMs` for `durationSeconds`. Each
 * batch is its own task (a server message) and one store turn; rows are drawn
 * uniformly from the whole collection; each row update changes
 * `fieldsPerUpdate` fields.
 *
 * - Long tasks attributed to the store: long animation frames in the window
 *   that overlap a `signal-tree:` turn measure (ruling 7).
 * - Store share: summed turn time / main-thread task time (CDP
 *   Performance.getMetrics TaskDuration) over the window.
 * - Heap overhead: CDP-forced GC, then Runtime.getHeapUsage. plain = heap with
 *   the generated rows minus heap before; overhead = heap with only the store
 *   holding the data minus heap with only the plain rows; measured after
 *   loading and after the window (grid unrendered); the larger counts.
 */
export const S2: ScenarioDefinition = {
  id: 'S2',
  title: 'Live grid: 50k × 20 collection, 1,000 rows rendered, 500 updates/s for 60 s',
  environment: 'browser',
  requires: ['collection'],
  metrics: {
    longTasksAttributedToStore: { unit: 'frames', better: 'lower', description: 'long animation frames overlapping a store turn' },
    storeShareOfMainThread: { unit: 'ratio', better: 'lower', description: 'store turn time / main-thread task time' },
    storeHeapOverheadRatio: { unit: 'x', better: 'lower', description: 'store heap overhead / retained plain rows' },
    storeHeapOverheadAfterLoadRatio: { unit: 'x', better: 'lower', description: 'overhead right after setAll' },
    storeHeapOverheadAfterRunRatio: { unit: 'x', better: 'lower', description: 'overhead after the update window' },
    storeShareOfWallTime: { unit: 'ratio', better: 'lower', description: 'store turn time / window wall time' },
    storeMsPerBatch: { unit: 'ms', better: 'lower', description: 'median store turn per batch' },
    storeMsMaxBatch: { unit: 'ms', better: 'lower', description: 'longest store turn' },
    longAnimationFrames: { unit: 'frames', better: 'lower', description: 'all long animation frames in the window' },
    mainThreadTaskMs: { unit: 'ms', better: 'none', description: 'main-thread task time in the window' },
    storeMs: { unit: 'ms', better: 'lower', description: 'summed store turn time in the window' },
    setAllMs: { unit: 'ms', better: 'lower', description: 'initial setAll turn' },
    plainRowsBytes: { unit: 'B', better: 'none', description: 'retained plain row objects' },
    batchesApplied: { unit: 'batches', better: 'none', description: 'batches applied in the window' },
    maxBatchLateMs: { unit: 'ms', better: 'none', description: 'largest delay of a batch past its due time' },
  },
  run: (ctx) =>
    withBenchPage(ctx, async (page) => {
      const p = ctx.params as Record<string, number>;
      await page.invoke('mount.collection', { variant: ctx.variant });
      const heapBefore = await page.heapUsed();
      await page.invoke('collection.generate', { rows: p['rows'], fields: p['fields'] });
      const heapPlain = await page.heapUsed();
      const load = await page.invoke<{ setAllMs: number }>('collection.load');
      const heapLoaded = await page.heapUsed();
      await page.invoke('collection.render', { rendered: p['rendered'], fields: p['fields'] });
      await page.settle(3);
      await page.drainPerf();

      const taskBefore = await page.mainThreadTaskMs();
      const stream = await page.invoke<{ batches: number; startMs: number; endMs: number; maxLateMs: number }>('collection.stream', {
        rowUpdatesPerSecond: p['rowUpdatesPerSecond'],
        batchEveryMs: p['batchEveryMs'],
        durationMs: p['durationSeconds']! * 1000,
        rows: p['rows'],
        fieldsPerUpdate: S2_SETUP.fieldsPerUpdate,
        seed: S2_SETUP.seed,
      });
      const taskAfter = await page.mainThreadTaskMs();
      const perf = await page.drainPerf();
      await page.invoke('collection.unrender');
      const heapAfter = await page.heapUsed();

      const inWindow = <T extends { startTime: number }>(entries: readonly T[]) =>
        entries.filter((entry) => entry.startTime >= stream.startMs && entry.startTime <= stream.endMs);
      const turns = inWindow(perf.turns).filter((turn) => turn.label === 'S2.batch');
      const frames = inWindow(perf.loaf);
      const storeMs = turns.reduce((sum, turn) => sum + turn.duration, 0);
      const mainThreadTaskMs = taskAfter - taskBefore;
      const plain = heapPlain - heapBefore;
      const afterLoad = (heapLoaded - heapPlain) / plain;
      const afterRun = (heapAfter - heapPlain) / plain;
      const sortedTurns = turns.map((turn) => turn.duration).sort((a, b) => a - b);
      return {
        longTasksAttributedToStore: framesOverlappingTurns(frames, turns).length,
        storeShareOfMainThread: storeMs / mainThreadTaskMs,
        storeHeapOverheadRatio: Math.max(afterLoad, afterRun),
        storeHeapOverheadAfterLoadRatio: afterLoad,
        storeHeapOverheadAfterRunRatio: afterRun,
        storeShareOfWallTime: storeMs / (stream.endMs - stream.startMs),
        storeMsPerBatch: sortedTurns[sortedTurns.length >> 1] ?? Number.NaN,
        storeMsMaxBatch: sortedTurns[sortedTurns.length - 1] ?? Number.NaN,
        longAnimationFrames: frames.length,
        mainThreadTaskMs,
        storeMs,
        setAllMs: load.setAllMs,
        plainRowsBytes: plain,
        batchesApplied: turns.length,
        maxBatchLateMs: stream.maxLateMs,
      };
    }),
};
