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
  runInvalidationGroup(run: () => void): void;
}

export const NEUTRAL_OBSERVATION_ADAPTER: ObservationAdapter = {
  createToken: () => ({
    observe: () => undefined,
    invalidate: () => undefined,
  }),
  runInvalidationGroup: (run) => run(),
};