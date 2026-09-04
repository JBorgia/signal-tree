/**
 * `@signal-tree/kernel/adapter` — the FRAMEWORK-ADAPTER SDK.
 *
 * Advanced surface for authoring a realization package such as
 * `@signal-tree/angular`. It is NOT ordinary SignalTree user API and is NOT
 * re-exported from the kernel root.
 *
 * It was refused as speculative until a real consumer existed. That consumer
 * now does: `@signal-tree/angular` must install its realizations across an npm
 * boundary, and deep-importing kernel source is not a contract.
 *
 * WHAT THIS DELIBERATELY IS NOT. Every export below is a realization CONTRACT
 * or its installer. None of these appear, and adding one means the seam is
 * wrong rather than the SDK incomplete:
 *
 *     member-membership · PhysicalCommitClock · the physical scalar-slot
 *     runtime · production substrate stats · CellIdentity · subject machinery ·
 *     entity contracts · restoration internals
 *
 * The discriminator:
 *
 *     COULD A `@signal-tree/fake-reactive` PACKAGE BE WRITTEN AGAINST ONLY
 *     THIS SURFACE, PLUS A TINY FAKE REACTIVE PRIMITIVE?
 *
 * If an adapter needs a kernel internal to answer a question, the question was
 * kernel semantics and belongs on the kernel side of the boundary.
 */

import { acquireObservation } from './lib/internals/observation-substrate';
import { observeOwnerInvalidationInternal } from './lib/internals/owner-invalidation';
import { readCanonicalSnapshotInternal } from './lib/internals/canonical-snapshot';

interface OwnerInvalidationTarget {
  readonly $: object;
  readonly destroyed: () => boolean;
}

/**
 * Observe coherent publication by one SignalTree owner.
 *
 * The callback is invalidation only: it carries no value, path, metadata, or
 * framework concept. Read current truth from the owner after it fires.
 */
export function observeOwnerInvalidation(
  owner: OwnerInvalidationTarget,
  callback: () => void
): () => void {
  return observeOwnerInvalidationInternal(
    owner,
    callback,
    () => acquireObservation(owner.$)
  );
}

/**
 * Read the kernel-owned canonical whole-tree snapshot for a framework adapter.
 *
 * The tree controller and root `$` facade are not public snapshot functions.
 * Pair this read with `observeOwnerInvalidation` when adapting an external
 * observation runtime.
 */
export function readCanonicalSnapshot<T>(
  owner: { readonly $: object }
): T {
  return readCanonicalSnapshotInternal<T>(owner);
}

export type {
  ObservationAdapter,
  ObservationToken,
} from './lib/internals/observation-adapter';
export { createSignalTreeFactory } from './lib/signal-tree';
export { replaceLocation } from './lib/internals/location-runtime';

/**
 * SEMANTIC INGRESS — the one export here that is not a realization contract.
 *
 * `toWritableSignal` (the Angular Signal Forms bridge) wraps its writes in this
 * so a user's form edit becomes a restoration-eligible causal turn. The kernel
 * CANNOT infer that: only the integration knows a write originated from a human
 * editing a control rather than from program logic.
 *
 * RULED: it stays here. It does not go on the kernel root, it is not
 * deep-imported, and the behaviour is not removed from `toWritableSignal`. That
 * revises this SDK's definition to: realization contracts PLUS the minimum
 * semantic facts only an integration can truthfully assert. It is the only
 * earned example today; adjacent history/restoration internals do NOT follow it
 * in. The final spelling is open until the pre-freeze surface pass.
 *
 * DO NOT mark this export with the internal-marker tag, or mention that tag as
 * a bare token in this docblock: the build runs `stripInternal`, which erases
 * the export from the emitted declarations and breaks the Angular package's
 * compile — measured, twice.
 */
export { withRestorationDesignation } from './lib/internals/restoration-eligibility';

export type { ISignalTree, SignalTreeFactory } from './lib/types';
export { isNodeAccessor } from './lib/internals/node-shape';
