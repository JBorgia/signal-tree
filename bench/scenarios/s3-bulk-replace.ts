import type { ScenarioDefinition } from '../runner/types.ts';
import { collectionShape, loadedGrid, withBenchPage } from './page.ts';

/**
 * S3: replace the loaded 50k-row collection with 50k new rows through
 * setAll(rows, { chunk: 'auto' }) at 4× CPU throttle, the grid rendered.
 * Longest main-thread task = longest long animation frame in the window
 * (0 when none passed the API's 50 ms floor). The replace starts in a task of
 * the page's own (bench-api.ts), where the frames see its first chunk.
 */
export const S3: ScenarioDefinition = {
  id: 'S3',
  title: "Bulk replace of 50k rows with { chunk: 'auto' }",
  environment: 'browser',
  requires: ['collection', 'chunkedSetAll'],
  metrics: {
    maxMainThreadTaskMs: { unit: 'ms', better: 'lower', description: 'longest long animation frame during the replace', zeroable: true },
    totalMs: { unit: 'ms', better: 'lower', description: 'wall time of the chunked replace (reported)' },
    longAnimationFrames: { unit: 'frames', better: 'lower', description: 'long animation frames during the replace', zeroable: true },
  },
  run: (ctx) =>
    withBenchPage(ctx, async (page) => {
      const shape = { ...collectionShape(ctx), rows: ctx.params['rows'] as number, fields: ctx.params['fields'] as number };
      await loadedGrid(page, ctx, shape);
      const result = await page.invoke<{ totalMs: number }>('collection.setAllChunked', { rows: shape.rows, fields: shape.fields });
      await page.settle(3);
      const perf = await page.drainPerf();
      // The raw frames behind the verdict, for a failing gate and for the harness's own test.
      ctx.note('longFrames', JSON.stringify(perf.loaf.map(({ startTime, duration, blockingDuration }) => ({ startTime, duration, blockingDuration }))));
      return {
        maxMainThreadTaskMs: perf.loaf.reduce((max, frame) => Math.max(max, frame.duration), 0),
        totalMs: result.totalMs,
        longAnimationFrames: perf.loaf.length,
      };
    }),
};
