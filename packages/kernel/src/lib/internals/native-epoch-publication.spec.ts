import { describe, expect, it } from 'vitest';

import { createNativeLocationRuntime } from './native-location-realization';
import type { ObservationAdapter } from './observation-adapter';

/**
 * `SUBJECT-EPOCH-0`. An epoch must publish through the adapter's TOKEN, never
 * by writing to the adapter's cell.
 *
 * This exists because the first implementation did the latter and shipped. It
 * returned `realized.cell` and called `.update()` on it, which works on Angular
 * only by accident: Angular's cell is a real `WritableSignal`. An adapter's raw
 * cell is not writable by contract — the kernel is what makes it writable, by
 * assigning `cell.set = binding.replace` inside `createWritable`. Vue ships
 * `cell.set = () => undefined` as a placeholder awaiting exactly that, so on
 * Vue the epoch never advanced and entity invalidation was silently dead.
 *
 * Nothing in the kernel or Angular suites could see it: the kernel builds trees
 * on `NEUTRAL_LOCATION_RUNTIME` and never runs this file, and Angular's cell
 * happens to work. One Vue test caught it, and only after HEAD was made
 * buildable from a clean checkout.
 *
 * So the adapter here is deliberately hostile in the way Vue is honest: its
 * `cell.set` and `cell.update` are inert. An epoch that depends on them fails.
 */
function inertCellAdapter(): {
  adapter: ObservationAdapter;
  invalidations: () => number;
  cellWrites: () => number;
} {
  let invalidations = 0;
  let cellWrites = 0;
  const adapter: ObservationAdapter = {
    createToken: () => ({
      observe: () => undefined,
      invalidate: () => void (invalidations += 1),
    }),
    createWritableCell: <T>(read: () => T) => {
      // Inert, exactly as the Vue adapter ships it: a placeholder the kernel is
      // expected to replace. Writing here must NOT be how an epoch publishes.
      const cell = (() => read()) as unknown as {
        (): T;
        set(value: T): void;
        update(fn: (current: T) => T): void;
        asReadonly(): unknown;
      };
      cell.set = () => void (cellWrites += 1);
      cell.update = () => void (cellWrites += 1);
      cell.asReadonly = () => cell;
      return {
        cell: cell as never,
        peek: read,
        token: {
          observe: () => undefined,
          invalidate: () => void (invalidations += 1),
        },
      };
    },
    createWritableProjection: <T>(compute: () => T) => ({
      cell: (() => compute()) as never,
      peek: compute,
    }),
    createReadonlyCell: <T>(compute: () => T) => compute as never,
    runInvalidationGroup: (run: () => void) => run(),
  };
  return {
    adapter,
    invalidations: () => invalidations,
    cellWrites: () => cellWrites,
  };
}

describe('native epoch publishes through the token, not the cell', () => {
  it('advances against an adapter whose cell is inert', () => {
    const { adapter, invalidations, cellWrites } = inertCellAdapter();
    const runtime = createNativeLocationRuntime(adapter);
    const epoch = runtime.createEpoch?.();
    expect(epoch).toBeDefined();

    expect(epoch?.()).toBe(0);
    epoch?.update((v) => v + 1);

    // The observable effect is an invalidation. If the implementation writes to
    // the cell instead, this is 0 and the epoch is dead on Vue.
    expect(invalidations()).toBeGreaterThan(0);
    expect(epoch?.()).toBe(1);
    expect(cellWrites()).toBe(0);
  });

  it('is a no-op when the value does not change', () => {
    const { adapter, invalidations } = inertCellAdapter();
    const epoch = createNativeLocationRuntime(adapter).createEpoch?.();
    epoch?.update((v) => v + 1);
    const after = invalidations();
    epoch?.set(epoch?.() as number);
    expect(invalidations()).toBe(after);
  });

  it('defers publication inside an invalidation group', () => {
    const { adapter, invalidations } = inertCellAdapter();
    const runtime = createNativeLocationRuntime(adapter);
    const epoch = runtime.createEpoch?.();

    runtime.runInvalidationGroup(() => {
      epoch?.update((v) => v + 1);
      epoch?.update((v) => v + 1);
      // Returning the bare cell opted the epoch out of grouping entirely, so
      // advances landed immediately and out of order with every other
      // publication in the same batch.
      expect(invalidations()).toBe(0);
    });
    expect(invalidations()).toBeGreaterThan(0);
  });
});
