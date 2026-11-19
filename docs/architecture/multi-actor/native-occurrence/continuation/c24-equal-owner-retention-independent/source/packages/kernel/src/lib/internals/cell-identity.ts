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
 * this — `() => 42` with a `.set` bolted on is shape-identical to a leaf.
 * LocationRuntime therefore records identity when it mints a universal
 * location. Externally supplied derived callables are marked explicitly at
 * their adoption boundary.
 *
 *     A MARKER SHOULD CLASSIFY ONE FACT. DO NOT TURN DERIVED PROVENANCE INTO
 *     GENERAL CELL IDENTITY.
 *
 * `DERIVED_STAMP` was rejected as the carrier for exactly that reason: a
 * writable source leaf is a cell but not derived, so one marker cannot mean
 * both.
 *
 * WHY A PRIVATE NON-ENUMERABLE SYMBOL. It gives runtime-minted locations nominal
 * identity without wrapping them or leaking into snapshots and object walks.
 * The accepted symbol carrier has flat retained memory and preserves object
 * identity across every framework facade.
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
 * True only for a callable minted or explicitly adopted as a SignalTree
 * location.
 *
 * Deliberately narrow, and deliberately framework-blind. A consumer-created
 * `signal()` stored as state is FOREIGN REACTIVE STATE, not a SignalTree cell —
 * folding it in here would rebuild the `isAnySignal` conflation this file
 * exists to remove. Walkers that need "cell OR foreign reactive" combine the
 * two facts at their own boundary; this module never asks an adapter anything.
 *
 *     KERNEL LOCATION       recorded here, needs no framework
 *     ADOPTED DERIVED       explicitly recorded at the ownership boundary
 *     FOREIGN REACTIVE      adapter's knowledge, asked elsewhere
 *     FUNCTION-AS-STATE     neither — ordinary data
 */
export function isTreeCell(value: unknown): boolean {
  return (
    typeof value === 'function' &&
    (value as unknown as Record<symbol, unknown>)[CELL_MARK] === true
  );
}
