import type { WritableCell } from './cell-runtime';

/**
 * What a framework must supply so kernel scalar truth can be OBSERVED.
 *
 * SCALAR-REALIZATION-SEAM-0 — outcome **SR-A**. The Angular scalar runtime used
 * to own orchestration too: slot bookkeeping, the `!changed` publication rule,
 * production accounting, membership dormancy and reactivation. All of that is
 * kernel semantics, and its presence in a framework file was what forced SEVEN
 * kernel modules to import the adapter.
 *
 * Measured: `AngularScalarSlotMutationFrame` contained NO Angular code at all —
 * pure delegation plus a publish call.
 *
 * So the adapter's real job is only these two mechanisms:
 *
 *   OBSERVATION TOKEN  something a reader can depend upon, and that the kernel
 *                      can invalidate when truth changes. The kernel decides
 *                      WHEN to invalidate; the framework decides what a
 *                      dependency IS.
 *
 *   READ-THROUGH LEAF  a writable cell whose value comes from `compute`. The
 *                      kernel supplies `compute` and replaces `set`/`update`
 *                      with its own semantics, so the adapter never learns what
 *                      a write MEANS.
 *
 * The discriminator this contract is designed against:
 *
 *     COULD `@signal-tree/fake-reactive` IMPLEMENT THIS WITH A TINY FAKE
 *     PRIMITIVE AND NOTHING ELSE FROM THE KERNEL?
 *
 * Nothing here mentions slots, commit clocks, membership, position ids,
 * revisions or production counters — the internals the old adapter imported.
 */
export interface ObservationToken {
  /** Establish a dependency on this token from the current computation. */
  observe(): void;
  /** Truth changed: anything depending on this token must re-read. */
  invalidate(): void;
}

export interface ScalarLeafRealization {
  createToken(): ObservationToken;
  /** A writable cell that reads through `compute`. Write semantics are the
   *  kernel's and are installed over the result. */
  createLeaf<T>(compute: () => T): WritableCell<T>;
  /** Deliver one committed operation's dependency invalidations atomically. */
  runInvalidationGroup(run: () => void): void;
}

/** Neutral realization: correct truth, no framework, no dependency graph. */
export const NEUTRAL_SCALAR_LEAF_REALIZATION: ScalarLeafRealization = {
  createToken: () => ({
    observe: () => undefined,
    invalidate: () => undefined,
  }),
  createLeaf: <T,>(compute: () => T): WritableCell<T> => {
    const cell = (() => compute()) as WritableCell<T>;
    cell.set = () => undefined;
    cell.update = () => undefined;
    cell.asReadonly = () => cell;
    return cell;
  },
  runInvalidationGroup: (run) => run(),
};
