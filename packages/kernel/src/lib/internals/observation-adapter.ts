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
