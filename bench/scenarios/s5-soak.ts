import type { ScenarioDefinition } from '../runner/types.ts';
import { collectionShape, loadedGrid, sleep, withBenchPage } from './page.ts';

/** Harness choices S5 does not take from budgets.json. */
export const S5_SETUP = { fieldsPerUpdate: 3, seed: 11, heapSampleEveryMs: 5 * 60_000, compressedSamples: 20, pollMs: 1000 } as const;

/**
 * S5: soak at 4× CPU throttle. S2 traffic (server row updates) plus S4 traffic
 * (user edits, agent batches in transactions, confirmed or rolled back, and
 * selective undo where restoration exists) with every plugin the subject has
 * installed. Full mode runs `sessionHours` of real time; compressed mode
 * (nightly) runs the traffic back to back until `minWrites` field writes.
 * Heap: CDP-forced GC then Runtime.getHeapUsage at regular samples (by time
 * in full mode, by writes in compressed mode); growth over the final half =
 * (last sample - sample at the half-way point) / that sample.
 */
export const S5: ScenarioDefinition = {
  id: 'S5',
  title: 'Soak: S2 + S4 traffic with the installed plugins',
  environment: 'browser',
  requires: ['collection', 'writers', 'transactions', 'pluginCollectionSizes'],
  metrics: {
    heapGrowthFinalHalf: { unit: 'ratio', better: 'lower', description: 'heap growth over the final half of the run', zeroable: true },
    collectionsOverCap: { unit: 'count', better: 'lower', description: 'plugin collections seen above their configured cap', zeroable: true },
    writes: { unit: 'writes', better: 'none', description: 'field writes applied' },
    markEntriesMax: { unit: 'entries', better: 'none', description: 'most signal-tree: entries the harness found at one drain (bounded by the turns between drains)' },
    durationMs: { unit: 'ms', better: 'none', description: 'run length' },
  },
  run: (ctx) =>
    withBenchPage(ctx, async (page) => {
      const p = ctx.params as { sessionHours: number; nightlyCompression: { minWrites: number }; plugins: { restoration: { retain: number } } };
      const caps = ctx.subject.capabilities;
      const plugins = {
        transactions: true,
        ...(caps.has('restoration') ? { restoration: p.plugins.restoration } : {}),
        ...(caps.has('hold') ? { writers: true } : {}),
      };
      ctx.note('plugins', Object.keys(plugins).join(','));
      ctx.note('mode', ctx.s5Compressed ? 'compressed' : 'full');
      const shape = collectionShape(ctx);
      const scale = ctx.scale as {
        sustainedServerUpdates: { rowUpdatesPerSecond: number; batchEveryMs: number };
        agentBatch: { fieldEdits: number; rows: number };
      };
      await loadedGrid(page, ctx, shape, plugins);
      await page.invoke('soak.start', {
        compressed: ctx.s5Compressed,
        rows: shape.rows,
        fields: shape.fields,
        rowUpdatesPerSecond: scale.sustainedServerUpdates.rowUpdatesPerSecond,
        batchEveryMs: scale.sustainedServerUpdates.batchEveryMs,
        fieldsPerUpdate: S5_SETUP.fieldsPerUpdate,
        fieldEdits: scale.agentBatch.fieldEdits,
        agentRows: scale.agentBatch.rows,
        seed: S5_SETUP.seed,
      });
      const start = Date.now();
      const durationMs = p.sessionHours * 3_600_000;
      const minWrites = p.nightlyCompression.minWrites;
      const samples: { at: number; writes: number; heap: number }[] = [];
      let overCap = 0;
      let markEntriesMax = 0;
      // The harness's own buffers (turn measures, frames) must not grow over the soak:
      // every drain clears what it read, and anything left is a harness defect.
      const drain = async () => {
        const drained = await page.drainPerf();
        markEntriesMax = Math.max(markEntriesMax, drained.markEntries);
        if (drained.markEntriesLeft > 0) throw new Error(`harness defect: ${drained.markEntriesLeft} signal-tree: entries stayed in the performance buffer after a drain`);
      };
      const sample = async () => {
        await drain();
        const status = await page.invoke<{ writes: number; collections: { size: number; cap: number }[] }>('soak.status');
        overCap += status.collections.filter((collection) => collection.size > collection.cap).length;
        samples.push({ at: Date.now() - start, writes: status.writes, heap: await page.heapUsed() });
      };
      await sample();
      if (ctx.s5Compressed) {
        // Compressed: samples at every 1/compressedSamples of the writes; "half" is by writes.
        for (let k = 1; k <= S5_SETUP.compressedSamples; k++) {
          await page.invoke('soak.runUntil', { writes: (minWrites * k) / S5_SETUP.compressedSamples });
          await sample();
        }
      } else {
        // Full: real time, a sample every heapSampleEveryMs; "half" is by time.
        let nextSampleAt = S5_SETUP.heapSampleEveryMs;
        while (Date.now() - start < durationMs) {
          await sleep(S5_SETUP.pollMs);
          await drain();
          if (Date.now() - start >= nextSampleAt) {
            await sample();
            nextSampleAt += S5_SETUP.heapSampleEveryMs;
          }
        }
      }
      const final = await page.invoke<{ writes: number }>('soak.stop');
      await sample();
      const axis = (s: { at: number; writes: number }) => (ctx.s5Compressed ? s.writes : s.at);
      const last = samples[samples.length - 1]!;
      const half = samples.reduce((best, s) => (Math.abs(axis(s) - axis(last) / 2) < Math.abs(axis(best) - axis(last) / 2) ? s : best), samples[0]!);
      return {
        heapGrowthFinalHalf: (last.heap - half.heap) / half.heap,
        collectionsOverCap: overCap,
        writes: final.writes,
        durationMs: last.at,
        markEntriesMax,
      };
    }),
};
