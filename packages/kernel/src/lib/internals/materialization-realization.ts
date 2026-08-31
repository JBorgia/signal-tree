/**
 * The one operation marker materialization needs from a reactive framework.
 *
 * WHY THIS EXISTS. `materialize-markers.ts` owns framework-NEUTRAL concerns:
 * the processor registry, marker registration and its validation, the hydrate
 * and error contracts, and the tree walk. It reached into a framework for
 * exactly two things, which is what stopped it — and therefore the whole
 * extension SDK built on top of it — from living in a framework-neutral
 * package.
 *
 * WHAT THIS IS NOT. This is not a generic signals abstraction, and it must not
 * become one. There is no `signal()`, no `computed()`, no `effect()`. Imitating
 * a framework's reactive primitives inside the semantic layer would recreate
 * the coupling one level down while pretending to have removed it. These two
 * methods are named for the SEMANTIC question the materializer is asking, not
 * for the Angular call that currently answers it:
 *
 *   isReactiveNode   "has this node already been realized by the adapter?"
 *                    A structural predicate. The materializer uses it to avoid
 *                    walking into, or re-processing, a node the adapter owns.
 *                    It never creates anything.
 *
 * Snapshot identity is kernel-owned read semantics. It is deliberately absent
 * here: framework dependency tracking must never be required to make snapshot
 * caching or structural sharing correct.
 *
 * A framework package supplies this operation through its construction-bound
 * `TreeRealization`; the neutral package uses the implementation below.
 */

export interface MaterializationRealization {
  /** True when the adapter has already realized this node as a reactive node. */
  isReactiveNode(node: unknown): boolean;
}

export const NEUTRAL_MATERIALIZATION_REALIZATION: MaterializationRealization = {
  isReactiveNode: () => false,
};

