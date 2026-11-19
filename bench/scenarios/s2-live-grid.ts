import { framesChargedToStore, framesOverlappingTurns } from '../runner/browser.ts';
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
 * - Long tasks attributed to the store (#12, provisional): long animation
 *   frames in the window whose `signal-tree:` turn time is greater than the
 *   frame's duration minus the long-task threshold; turns include the
 *   adapter's lazy reads of the rendered cells. Frames that merely overlap a
 *   turn (ruling 7) are reported next to it.
 * - Store share: summed turn time / main-thread task time (CDP
 *   Performance.getMetrics TaskDuration) over the window.
 * - Heap overhead = (store heap - plain-row heap) / plain-row heap, from
 *   CDP-forced GC then Runtime.getHeapUsage. plain-row heap = heap with the
 *   generated rows minus heap before. The page drops its own reference to the
 *   rows inside the load (checked), so store heap = heap - heap before with
 *   only the store holding the data. Measured after loading and after the
 *   window (grid unrendered); the larger counts. A store that keeps the rows
 *   it was given reads about 0; one that also keeps a full copy, about 1.
 */
export const S2: ScenarioDefinition = {
  id: 'S2',
  title: 'Live grid: 50k × 20 collection, 1,000 rows rendered, 500 updates/s for 60 s',
  environment: 'browser',
  requires: ['collection'],
  metrics: {
    longTasksAttributedToStore: { unit: 'frames', better: 'lower', description: '#12: long frames that would not be long without the store', zeroable: true },
    longFramesOverlappingStore: { unit: 'frames', better: 'lower', description: 'long frames overlapping any store turn (reported)', zeroable: true },
    storeShareOfMainThread: { unit: 'ratio', better: 'lower', description: 'store turn time / main-thread task time', zeroable: true },
    storeHeapOverheadRatio: { unit: 'x', better: 'lower', description: 'store heap overhead / retained plain rows', zeroable: true },
    storeHeapOverheadAfterLoadRatio: { unit: 'x', better: 'lower', description: 'overhead right after setAll', zeroable: true },
    storeHeapOverheadAfterRunRatio: { unit: 'x', better: 'lower', description: 'overhead after the update window', zeroable: true },
    storeShareOfWallTime: { unit: 'ratio', better: 'lower', description: 'store turn time / window wall time', zeroable: true },
    storeMsPerBatch: { unit: 'ms', better: 'lower', description: 'median store turn per batch', zeroable: true },
    storeMsMaxBatch: { unit: 'ms', better: 'lower', description: 'longest store turn', zeroable: true },
    longAnimationFrames: { unit: 'frames', better: 'lower', description: 'all long animation frames in the window', zeroable: true },
    mainThreadTaskMs: { unit: 'ms', better: 'none', description: 'main-thread task time in the window' },
    storeMs: { unit: 'ms', better: 'lower', description: 'summed store turn time in the window', zeroable: true },
    setAllMs: { unit: 'ms', better: 'lower', description: 'initial setAll turn' },
    plainRowsBytes: { unit: 'B', better: 'none', description: 'retained plain row objects' },
    batchesApplied: { unit: 'batches', better: 'none', description: 'batches applied in the window' },
    maxBatchLateMs: { unit: 'ms', better: 'none', description: 'largest delay of a batch past its due time' },
  },
  run: (ctx) =>
    withBenchPage(ctx, async (page) => {
      const p = ctx.params as Record<string, number>; // #12's threshold arrives as params.storeCharge
      await page.invoke('mount.collection', { variant: ctx.variant });
      const heapBefore = await page.heapUsed();
      await page.invoke('collection.generate', { rows: p['rows'], fields: p['fields'] });
      const plain = (await page.heapUsed()) - heapBefore;
      const load = await page.invoke<{ setAllMs: number; harnessHoldsRows: boolean }>('collection.load');
      if (load.harnessHoldsRows) throw new Error('the page still holds the generated rows; the store heap would include them');
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
      const afterLoad = (heapLoaded - heapBefore - plain) / plain;
      const afterRun = (heapAfter - heapBefore - plain) / plain;
      const sortedTurns = turns.map((turn) => turn.duration).sort((a, b) => a - b);
      return {
        longTasksAttributedToStore: framesChargedToStore(frames, turns, (p['storeCharge'] as unknown as { longTaskMs: number }).longTaskMs).length,
        longFramesOverlappingStore: framesOverlappingTurns(frames, turns).length,
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
