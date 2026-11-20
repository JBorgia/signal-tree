import type { ScenarioDefinition } from '../runner/types.ts';
import type { BuildArgs } from './micro.ts';

const MICRO = new URL('./micro.ts', import.meta.url).href;

/** Harness choices M3 does not take from budgets.json: state shape and warm-build count. */
export const M3_SETUP = { perBranch: 100, warmBuilds: 10 } as const;

/**
 * M3: build a tree from `leaves` leaves of initial state and access `accessed`
 * of them, in Node at 1× (ruling 1). Heap is gated; time is reported.
 * Time and heap are measured in separate fresh processes.
 */
export const M3: ScenarioDefinition = {
  id: 'M3',
  title: 'Build a tree from 100,000 leaves of initial state and access 10 of them',
  environment: 'node',
  requires: ['build', 'leaf'],
  metrics: {
    heapRatioVsPlainPlusCells: { unit: 'x', better: 'lower', description: 'tree heap / (plain state heap + 10 native cells)' },
    buildAndAccessMs: { unit: 'ms', better: 'lower', description: 'build and access, median of warm builds (reported, never gated)' },
    coldBuildAndAccessMs: { unit: 'ms', better: 'lower', description: 'first build in a fresh process (reported, never gated)' },
    treeBytes: { unit: 'B', better: 'lower', description: 'retained heap of the tree, state included' },
    plainStateBytes: { unit: 'B', better: 'none', description: 'retained heap of the plain state' },
    nativeCellsBytes: { unit: 'B', better: 'none', description: 'retained heap of 10 native cells' },
  },
  async run(ctx) {
    const args: BuildArgs = {
      subject: ctx.subject.id,
      variant: ctx.variant,
      leaves: ctx.params['leaves'] as number,
      accessed: ctx.params['accessed'] as number,
      ...M3_SETUP,
    };
    const time = await ctx.isolate<{ coldMs: number; warmMedianMs: number }>(MICRO, 'measureBuildTime', args);
    const heap = await ctx.isolate<{ plainBytes: number; cellsBytes: number; treeBytes: number }>(MICRO, 'measureBuildHeap', args);
    return {
      heapRatioVsPlainPlusCells: heap.treeBytes / (heap.plainBytes + heap.cellsBytes),
      buildAndAccessMs: time.warmMedianMs,
      coldBuildAndAccessMs: time.coldMs,
      treeBytes: heap.treeBytes,
      plainStateBytes: heap.plainBytes,
      nativeCellsBytes: heap.cellsBytes,
    };
  },
};
