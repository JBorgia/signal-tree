import { markTreeCell } from './cell-identity';
import type { ReadableCell } from './cell-runtime';

/**
 * How a v15 runtime realizes a READONLY DERIVED VALUE.
 *
 * C6-DERIVED-REALIZATION-FIT-0 — outcome **FIT-B**. This is deliberately NOT
 * `MaterializationRealization.memoizeSnapshot`, whose declared law is narrower:
 *
 *     "Keyed by `node`; calling twice for the same node must return the same
 *      accessor."
 *
 * `entity-signal` derives twelve distinct slices from ONE entity node. Routing
 * them through a node-keyed cache was measured: a contract-faithful
 * implementation returns the FIRST accessor for every later derivation, so a
 * `doubled` slice computed emptiness instead. It only appears to work today
 * because the Angular install is `(_node, compute) => computed(compute)` — it
 * IGNORES `node`, making the implementation stronger than the contract it
 * claims to satisfy. Overloading it would have made that contract false while
 * looking green.
 *
 *     A COMPATIBLE RETURN TYPE DOES NOT PROVE A COMPATIBLE INVALIDATION LAW.
 *
 * So the v15 question was asked greenfield — *what does neutral truth require
 * from a derived value?* — not *how do we reproduce `computed()`?* The answer is
 * one operation, keyed per DERIVATION rather than per node:
 *
 *     kernel    the current value, computed on read
 *     Angular   `computed()` — real dependency tracking, real Signal identity
 *
 * An adapter may realize MORE than the neutral kernel does. The kernel does not
 * impersonate it: there is no scheduler, no subscription, no dependency graph
 * and no effect system here, and none may be added without a falsifier that
 * forces it.
 *
 *     DO NOT IMPORT ANGULAR'S MECHANISM INTO THE NEUTRAL CONTRACT BY VOCABULARY
 *     ALONE.
 */
export interface DerivedRuntime {
  createDerived<T>(compute: () => T): ReadableCell<T>;
}

/** The neutral default: recompute on read. Correct, with no framework. */
const PLAIN_DERIVED: DerivedRuntime = {
  createDerived: <T,>(compute: () => T): ReadableCell<T> =>
    markTreeCell((() => compute()) as ReadableCell<T>),
};

let installed: DerivedRuntime | undefined;

/** Install the adapter's derived realization. Once per process, by the package
 *  that owns the framework binding — never by the kernel. */
export function installDerivedRuntime(next: DerivedRuntime): void {
  installed = {
    createDerived: <T,>(compute: () => T) =>
      markTreeCell(next.createDerived(compute)),
  };
}

/** The derived realization in force. Never undefined: absent an adapter the
 *  kernel still produces correct values, just without memoization. */
export function getDerivedRuntime(): DerivedRuntime {
  return installed ?? PLAIN_DERIVED;
}
