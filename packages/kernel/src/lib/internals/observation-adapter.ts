import type { ReadableCell, WritableCell } from './cell-runtime';

/** A framework-owned dependency token for kernel-owned locations. */
export interface ObservationToken {
  /** Establish a dependency from the current framework computation. */
  observe(): void;
  /** Notify framework dependents that committed truth changed. */
  invalidate(): void;
}

/**
 * The complete framework observation contract.
 *
 * The kernel owns values, dependency propagation, equality, and publication
 * timing. A framework supplies only its dependency token and invalidation-group
 * mechanism; it never owns or mirrors location state.
 */
export interface ObservationAdapter {
  createToken(): ObservationToken;
  createWritableCell?<T>(read: () => T): {
    readonly cell: WritableCell<T>;
    readonly token: ObservationToken;
    readonly peek: () => T;
    /**
     * Publish a value the kernel has ALREADY committed, without pulling it back
     * through `read()`.
     *
     * `NATIVE-STORAGE-0`. A scalar write stored twice with a read in between:
     * the kernel assigned its slot, then `token.invalidate()` called `read()`
     * — dormancy check, slot assertion, stats, array read — to fetch the value
     * the caller already had. Measured at ~8.4 ns per write, 35% of the write.
     *
     * Optional: an adapter that cannot publish a supplied value keeps using
     * `token.invalidate()`, and the neutral runtime is unaffected.
     */
    readonly commit?: (next: T) => void;
  };
  createWritableProjection?<T>(compute: () => T): {
    readonly cell: WritableCell<T>;
    readonly peek: () => T;
  };
  createReadonlyCell?<T>(compute: () => T): ReadableCell<T>;
  runInvalidationGroup(run: () => void): void;
}

export const NEUTRAL_OBSERVATION_ADAPTER: ObservationAdapter = {
  createToken: () => ({
    observe: () => undefined,
    invalidate: () => undefined,
  }),
  runInvalidationGroup: (run) => run(),
};
