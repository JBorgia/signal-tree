/**
 * A branch node in the tree: a plain callable object with child keys hung off
 * it. Leaves are Angular signals; branch nodes are not.
 */
export interface NodeAccessor<T> {
  /** Read: unwraps this node and everything under it. */
  (): T;
  /**
   * Write: WHOLE-VALUE ASSIGNMENT. Supplies the next value of this location.
   *
   * ⚠️ `T`, NOT `Partial<T>` — GREENFIELD-BRANCH-WRITE-0.
   *
   *     THE STATE TYPE DEFINES ITS OWN STRICTNESS.
   *     THE MUTATION API MUST NOT WEAKEN IT.
   *
   *     `Partial<T>` DESCRIBES THE SHAPE OF STATE.
   *     IT DOES NOT MEAN PARTIAL-WRITE SEMANTICS.
   *
   * An author who wants a partial-SHAPED STATE may declare `Partial<User>` as
   * `T`. A value call still assigns the WHOLE VALUE of that location — it is
   * never a patch operation; a partial object simply IS a complete value of
   * that particular type.
   *
   * Measured: weakening this parameter to `Partial<T>` also erases an author's
   * own `{ name: string; age?: number }` requirement on `name` — so it does not
   * merely add convenience, it deletes distinctions the author drew.
   *
   * To patch, derive: `node(current => ({ ...current, x: 1 }))`.
   */
  (value: T): void;
  /** Write: receives the current unwrapped value; the result is the next whole value. */
  (updater: (current: T) => T): void;
}
