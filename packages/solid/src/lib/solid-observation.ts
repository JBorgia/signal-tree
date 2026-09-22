import { batch, createMemo, createRoot, createSignal } from 'solid-js';

import type {
  EpochHandle,
  ObservationAdapter,
  ObservationToken,
} from '@signal-tree/kernel/adapter';

/**
 * The setter lives on the handle itself rather than in a side table: a
 * `WeakMap` entry per subject is exactly the per-entity allocation the epoch
 * design exists to avoid.
 */
const EPOCH_BUMP = Symbol('signaltree.solid.epoch');

interface SolidReadonlyCell<T> {
  (): T;
}

interface SolidWritableCell<T> extends SolidReadonlyCell<T> {
  set(value: T): void;
  update(update: (current: T) => T): void;
  asReadonly(): SolidReadonlyCell<T>;
}

/**
 * Solid observation for kernel-owned state.
 *
 * Solid's `createSignal` returns exactly the two halves this seam asks for — a
 * tracked getter and a setter — so the adapter is close to a direct expression
 * of the contract rather than an adaptation of it.
 *
 * Signals are created with `equals: false` because the kernel, not Solid, owns
 * equality. The value a consumer reads comes from the kernel; the signal here
 * is a dependency edge, and letting Solid suppress a notification on value
 * equality would drop invalidations the kernel had decided to publish.
 */
export const createSolidObservationAdapter = (): ObservationAdapter => {
  const createObservationToken = (): ObservationToken => {
    const [track, bump] = createSignal(0, { equals: false });
    return {
      observe: () => void track(),
      invalidate: () => bump((value) => value + 1),
    };
  };

  return {
    createToken: createObservationToken,

    createWritableCell: <T>(read: () => T) => {
      const [track, bump] = createSignal(0, { equals: false });
      let published = read();
      const cell = (() => {
        track();
        return published;
      }) as SolidWritableCell<T>;
      // A placeholder the kernel replaces in `createWritable`. Nothing here may
      // depend on it working: see `advanceEpoch` for why that matters.
      cell.set = () => undefined;
      cell.update = (update) => cell.set(update(published));
      cell.asReadonly = () => cell;
      return {
        cell,
        peek: read,
        token: {
          observe: () => void track(),
          invalidate: () => {
            published = read();
            bump((value) => value + 1);
          },
        },
      };
    },

    /**
     * `SOLID-ADAPTER-0`. A per-subject invalidation anchor, realized as one
     * Solid signal and a reader.
     *
     * Supplied as a PAIR with `advanceEpoch`, which is the load-bearing part:
     * Solid creates the handle and Solid advances it, so the kernel never
     * writes it. A design where the kernel wrote the adapter's cell directly
     * shipped once and left Vue's entity invalidation silently dead, because
     * Vue's `cell.set` is a placeholder awaiting kernel assignment. The pair
     * makes that class of defect unexpressible.
     */
    createEpoch: () => {
      const [track, bump] = createSignal(0, { equals: false });
      const epoch = (() => track()) as EpochHandle & {
        [EPOCH_BUMP]?: () => void;
      };
      epoch[EPOCH_BUMP] = () => bump((value) => value + 1);
      return epoch;
    },

    advanceEpoch: (epoch) => {
      (epoch as EpochHandle & { [EPOCH_BUMP]?: () => void })[EPOCH_BUMP]?.();
    },

    createWritableProjection: <T>(computeValue: () => T) => {
      const cell = (() => computeValue()) as SolidWritableCell<T>;
      cell.set = () => undefined;
      cell.update = (update) => cell.set(update(computeValue()));
      cell.asReadonly = () => cell;
      return { cell, peek: computeValue };
    },

    /**
     * Lazy on purpose, and this is a real difference between frameworks rather
     * than a style choice.
     *
     * Solid's `createMemo` evaluates its computation EAGERLY at creation, where
     * Angular's and Vue's `computed` are lazy. The kernel builds derived cells
     * while a collection is still initializing, so an eager memo runs the
     * computation before `structuralStore` exists and dies in the temporal dead
     * zone. Deferring creation to first read puts the first evaluation after
     * initialization, where every other adapter already puts it.
     *
     * The root is still explicit: a memo created outside one is never disposed,
     * which would leak a computation per derived leaf.
     */
    createReadonlyCell: <T>(computeValue: () => T) => {
      let memo: (() => T) | undefined;
      return (() =>
        (memo ??= createRoot(() =>
          createMemo(computeValue)
        ))()) as SolidReadonlyCell<T>;
    },

    runInvalidationGroup(run): void {
      batch(run);
    },
  };
};
