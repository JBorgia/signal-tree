/**
 * A branch node in the tree: a plain callable object with child keys hung off
 * it. Leaves are Angular signals; branch nodes are not.
 */
export interface NodeAccessor<T> {
  /** Read: unwraps this node and everything under it. */
  (): T;
  /** Write: deep partial merge — keys not present are preserved. */
  (value: Partial<T>): void;
  /** Write: receives the current unwrapped value; the result is merged. */
  (updater: (current: T) => T): void;
}
