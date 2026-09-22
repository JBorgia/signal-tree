import {
  computed,
  linkedSignal,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';

import type {
  ObservationAdapter,
  ObservationToken,
} from '@signal-tree/kernel/adapter';

/** Angular dependency tracking for kernel-owned locations. */
export const ANGULAR_OBSERVATION_ADAPTER: ObservationAdapter = {
  createToken(): ObservationToken {
    const revision = signal(0);
    return {
      observe: () => void revision(),
      invalidate: () => revision.update((value) => value + 1),
    };
  },

  createWritableCell: <T,>(read: () => T) => {
    const cell = signal(read());
    const publish = cell.set.bind(cell);
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

  createReadonlyCell: <T,>(compute: () => T) => computed(compute),

  createWritableProjection: <T,>(compute: () => T) => {
    const cell = linkedSignal(compute);
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
    run();
  },
};
