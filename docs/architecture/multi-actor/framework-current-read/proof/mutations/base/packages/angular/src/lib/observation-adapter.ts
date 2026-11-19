import {
  computed,
  linkedSignal,
  signal,
  untracked,
  type WritableSignal,
  type Signal,
} from '@angular/core';

import type {
  ObservationAdapter,
  ObservationToken,
} from '@signal-tree/kernel/adapter';

/** One native producer per reader, with source-current direct reads. */
function currentReadonly<T>(readCurrent: () => T): Signal<T> {
  let active: { evaluated: boolean } | undefined;
  let computing = false;
  let nativeFault: { error: unknown } | undefined;
  let ownFailure: { error: unknown } | undefined;
  const pendingNativeFault = (): { error: unknown } | undefined => nativeFault;
  const source = computed(() => {
    if (active) active.evaluated = true;
    computing = true;
    nativeFault = undefined;
    try {
      const value = readCurrent();
      ownFailure = undefined;
      return value;
    } catch (error) {
      // Do not reclassify a nested native/cycle error as a source-owned error
      // merely because it propagated through the supplied recipe.
      const fault = pendingNativeFault();
      ownFailure = fault && Object.is(fault.error, error) ? undefined : { error };
      throw error;
    } finally { computing = false; }
  });
  return new Proxy(source, {
    apply() {
      const previous = active;
      const frame = { evaluated: false };
      active = frame;
      try {
        let value: T;
        try { value = source(); }
        catch (error) {
          if (!frame.evaluated && computing) {
            nativeFault = { error };
            throw error;
          }
          // Only this computation's remembered own-recipe failure qualifies.
          // Marker=false alone also describes fresh dependency/cycle failures.
          if (frame.evaluated || !ownFailure || !Object.is(ownFailure.error, error)) throw error;
          return readCurrent();
        }
        return frame.evaluated ? value : readCurrent();
      } finally { active = previous; }
    },
  });
}

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
  createCurrentReadonlyCell: currentReadonly,

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
