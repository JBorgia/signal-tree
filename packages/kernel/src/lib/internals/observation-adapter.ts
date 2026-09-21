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
/**
 * An opaque per-subject invalidation anchor. Callable to take a dependency; the
 * value it returns is a nonce and is never read. Only the adapter that created
 * it may advance it.
 */
export type EpochHandle = { (): unknown };

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
  /**
   * `ANGULAR-NATIVE-EPOCH-0`. The framework's cheapest read-dependency
   * primitive, for a per-subject invalidation anchor that carries no value
   * anyone reads.
   *
   * Supplied as a PAIR with {@link advanceEpoch}, and that is the whole point.
   * The kernel must never assume an adapter's handle is writable — assuming
   * exactly that is what silently killed Vue's entity invalidation, because
   * Vue ships `cell.set` as an inert placeholder. Here the adapter that creates
   * the handle is the adapter that advances it, so no such assumption exists.
   *
   * An adapter supplying neither keeps the portable token-based epoch.
   * Supplying only one is ignored: both or neither.
   */
  createEpoch?(): EpochHandle;
  advanceEpoch?(epoch: EpochHandle): void;
  runInvalidationGroup(run: () => void): void;
}

export const NEUTRAL_OBSERVATION_ADAPTER: ObservationAdapter = {
  createToken: () => ({
    observe: () => undefined,
    invalidate: () => undefined,
  }),
  runInvalidationGroup: (run) => run(),
};
