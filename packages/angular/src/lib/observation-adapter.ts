import {
  computed,
  linkedSignal,
  signal,
  untracked,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import type {
  ObservationAdapter,
  ObservationToken,
} from '@signal-tree/kernel/adapter';

// A group defers native publication, not explicit SignalTree reads. Track the
// real Angular carrier first; only its SignalTree view reads through to truth.
// External computed/effect timing remains Angular's. No private signal fields.
let invalidationGroupDepth = 0;
const currentView = <T, S extends Signal<T>>(source: S, read: () => T): S =>
  new Proxy(source, {
    apply(target) {
      if (invalidationGroupDepth === 0) return target();
      // The native carrier can still cache an error from before the group.
      // Read it for tracking, but current SignalTree truth decides the result
      // (including whether to throw) until native publication catches up.
      try {
        target();
      } catch {
        // Canonical read below either recovers or throws its current error.
      }
      return untracked(read);
    },
  });

const writableView = <T>(source: WritableSignal<T>, read: () => T) => {
  const nativeReadonly = source.asReadonly.bind(source);
  let readonly: Signal<T> | undefined;
  const cell = currentView(source, read);
  cell.asReadonly = () => (readonly ??= currentView(nativeReadonly(), read));
  return cell;
};

/** Angular dependency tracking for kernel-owned locations. */
export const ANGULAR_OBSERVATION_ADAPTER: ObservationAdapter = {
  createToken(): ObservationToken {
    const revision = signal(0);
    return {
      observe: () => void revision(),
      invalidate: () => revision.update((value) => value + 1),
    };
  },

  createWritableCell: <T>(read: () => T) => {
    const source = signal(read());
    const publish = source.set.bind(source);
    const cell = writableView(source, read);
    return {
      cell,
      peek: read,
      // The committed value, published without pulling it back out of the
      // kernel. `invalidate` remains for callers that only know a slot changed.
      commit: publish,
      token: {
        observe: () => void cell(),
        invalidate: () => publish(read()),
      },
    };
  },

  createReadonlyCell: <T>(compute: () => T) =>
    currentView(computed(compute), compute),

  createWritableProjection: <T>(compute: () => T) => {
    const cell = writableView(linkedSignal(compute), compute);
    return {
      cell,
      peek: () => untracked(cell),
    };
  },

  /**
   * `ANGULAR-NATIVE-EPOCH-0`. A per-subject invalidation anchor, realized as a
   * bare Angular signal and nothing else.
   *
   * A signal already IS "take a dependency / invalidate everyone who did", so
   * the epoch needs no wrapper, no token record and no writable-cell
   * realization. Measured, that is the difference between 562 B/entity and
   * ~750 B for the same job.
   *
   * Paired with `advanceEpoch` deliberately: the kernel never writes to this
   * handle, because an adapter whose cell is a placeholder (Vue ships
   * `cell.set = () => undefined` for the kernel to replace) would silently stop
   * invalidating. This adapter creates the handle and this adapter advances it.
   */
  createEpoch: () => signal(0),

  advanceEpoch: (epoch) =>
    (epoch as unknown as WritableSignal<number>).update((value) => value + 1),

  runInvalidationGroup(run): void {
    invalidationGroupDepth += 1;
    try {
      run();
    } finally {
      invalidationGroupDepth -= 1;
    }
  },
};
