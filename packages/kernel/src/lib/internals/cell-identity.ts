/**
 * Is this callable a SignalTree CELL, or an ordinary function held as state?
 *
 * CELL-IDENTITY-CARRIER-0. `utils.ts` asked this six times through Angular's
 * `isSignal()`, which was quietly doing TWO jobs: framework identity, and
 * SignalTree cell identity. v15 separates them — the kernel must answer this
 * one with no framework present.
 *
 * The law it protects is FUNCTION-AS-STATE: a function stored as state stays a
 * function value through snapshot and apply. A structural test cannot decide
 * this — `() => 42` with a `.set` bolted on is shape-identical to a leaf — so
 * identity is RECORDED at creation, never inferred.
 *
 *     A MARKER SHOULD CLASSIFY ONE FACT. DO NOT TURN DERIVED PROVENANCE INTO
 *     GENERAL CELL IDENTITY.
 *
 * `DERIVED_STAMP` was rejected as the carrier for exactly that reason: a
 * writable source leaf is a cell but not derived, so one marker cannot mean
 * both.
 *
 * WHY A WEAK REGISTRY, NOT A PROPERTY. Registration leaves the cell object
 * physically untouched, which keeps S1's native-cell identity exact: the object
 * Angular made is the object SignalTree hands out, with no added own property
 * to perturb hidden classes, allocation size, or `@angular/core` interop. A
 * WeakSet also releases retired cells rather than pinning them.
 *
 *     MEASURE THE HOT REPRESENTATION BEFORE SUBSTITUTING IT.
 *
 * This is INTERNAL. It is not exported from the barrel and is not a public
 * concept; it replaces no public API. `isAnySignal` — which conflated these
 * same facts under a vague name — was deleted rather than renamed.
 */
const CELL_MARK = Symbol('SignalTree:Cell');

/** Record that `cell` is a SignalTree cell. Returns it unchanged. */
export function markTreeCell<T extends object>(cell: T): T {
  Object.defineProperty(cell, CELL_MARK, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: true,
  });
  return cell;
}

/**
 * True for a callable SignalTree treats as a cell.
 *
 * Two sources, and the split matters:
 *
 *   REGISTERED   a cell some semantic authority in this kernel acquired. This
 *                is the only question asked about the kernel's OWN state, and
 *                it needs no framework.
 *
 *   FOREIGN      a reactive value the CONSUMER created and stored as state
 *                (`signal()` / `computed()` held in a tree). The kernel cannot
 *                recognise a foreign framework object, and it should not try:
 *                only the adapter knows its own values. Such objects exist ONLY
 *                when an adapter is installed, so consulting it here degrades
 *                to `false` with no framework and stays correct.
 *
 * This is NOT the kernel asking an adapter whether its own state exists — the
 * failure that cost 151 tests. Registered cells never reach the second clause.
 */
/**
 * True ONLY for a callable a SignalTree authority explicitly acquired.
 *
 * Deliberately narrow, and deliberately framework-blind. A consumer-created
 * `signal()` stored as state is FOREIGN REACTIVE STATE, not a SignalTree cell —
 * folding it in here would rebuild the `isAnySignal` conflation this file
 * exists to remove. Walkers that need "cell OR foreign reactive" combine the
 * two facts at their own boundary; this module never asks an adapter anything.
 *
 *     OWNED/ACQUIRED CELL   recorded here, needs no framework
 *     FOREIGN REACTIVE      adapter's knowledge, asked elsewhere
 *     FUNCTION-AS-STATE     neither — ordinary data
 */
export function isTreeCell(value: unknown): boolean {
  return (
    typeof value === 'function' &&
    (value as unknown as Record<symbol, unknown>)[CELL_MARK] === true
  );
}
