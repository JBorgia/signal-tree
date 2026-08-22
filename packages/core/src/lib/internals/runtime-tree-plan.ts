import type { TreeCapability } from '../types';

/**
 * THE FINALIZED BUILD PLAN, AS A RUNTIME QUESTION.
 *
 * `TreeBuildPlan` answers "what did we decide to install?" during construction.
 * Some subsystems have to ask the same question later — the retirement boundary
 * most of all, which needs to know whether anything in this tree could ever
 * restore a subject it is about to tombstone. This is that plan, narrowed to the
 * queries a running tree asks and frozen so it cannot answer differently twice.
 *
 * ## Why this is a VALUE and not a registry
 *
 * The v14 design for this was a mutable `Set` maintained at runtime, and it was
 * the right design for v14: `.with()` could attach `timeTravel` at any moment,
 * so "does this tree have a restoration owner?" was a question whose answer
 * could change between two writes. Every consumer therefore had to re-ask it,
 * and something had to keep it current.
 *
 * Declarative construction removed that. The enhancer set is fixed before the
 * tree's first write and there is no operation that adds one, so the answer is
 * decided once and cannot change. A registry would now be a mutable container
 * for an immutable fact — the kind of machinery that survives long after the
 * reason for it is gone. `Object.freeze` here is the assertion, not decoration.
 *
 * See docs/architecture/restoration-ownership-inventory.md, "AMENDMENT".
 */
export interface RuntimeTreePlan {
  /** Was this capability installed? Exact for a tree built by `signalTree`. */
  hasCapability(capability: TreeCapability): boolean;
  /**
   * Can ANYTHING in this tree restore a subject after it retires?
   *
   * True when the tree carries `causal-runtime` (what `transactions` requests,
   * and what `timeTravel` requests transitively) or `temporal-snapshots`. It is
   * deliberately broader than "an enhancer named timeTravel is attached":
   * requesting the causal runtime directly through `capabilities` installs the
   * machinery to drive restoration without an enhancer, and a reclamation
   * decision must be wrong in the safe direction.
   *
   * FALSE IS THE LOAD-BEARING VALUE. It licenses reclaiming a retired subject's
   * value backing immediately, because no history, turn, or transaction exists
   * that could ask for it back. True only means "retain" — it does not assert
   * that a restore will happen, or that any specific owner is present.
   */
  readonly hasRestorationAuthority: boolean;
}

const RESTORATION_CAPABILITIES: readonly TreeCapability[] = [
  'causal-runtime',
  'temporal-snapshots',
];

export function createRuntimeTreePlan(
  hasCapability: (capability: TreeCapability) => boolean
): RuntimeTreePlan {
  return Object.freeze({
    hasCapability,
    hasRestorationAuthority: RESTORATION_CAPABILITIES.some((capability) =>
      hasCapability(capability)
    ),
  });
}
