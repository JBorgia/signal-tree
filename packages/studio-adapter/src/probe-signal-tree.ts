import { confirmedTurnReader, treeRuntimeId } from '@signal-tree/kernel/internals';

import { type StudioTreeProbe } from './attach-studio-probe';

/**
 * The minimum a tree must structurally be for Studio to attach to it.
 *
 * ⚠️ NOT `unknown` FOLLOWED BY RUNTIME SPELUNKING. Studio asks the kernel for
 * facts through supported accessors; it does not go looking for private shapes
 * on an object it was handed.
 */
export interface StudioAttachableTree {
  readonly $: object;
  registerCleanup(fn: () => void): void;
}

/**
 * Compose kernel primitives into the adapter's internal probe.
 *
 *     KERNEL EXPOSES FACTS. THE ADAPTER DECIDES WHICH ONES STUDIO NEEDS.
 *
 * This is the one place that knows both sides, which is why it lives here and
 * not in the kernel (which should not know what Studio wants) or in the panel
 * (which must not know tree lifecycle at all). No new kernel mechanism was
 * added to make it tidy — `confirmedTurnReader`, `treeRuntimeId` and
 * `registerCleanup` already existed.
 */
export function probeSignalTree(tree: StudioAttachableTree): StudioTreeProbe {
  // Cast once, at the boundary: the kernel accessors are generic over the tree
  // type, and the adapter deliberately does not depend on that generic surface.
  const kernelTree = tree as never;

  return {
    runtimeTreeId: treeRuntimeId(kernelTree) ?? tree,
    // Capability is DERIVED here and nowhere else. A caller cannot assert a
    // capability the tree does not have — see attachStudio's `require`, which
    // can only tighten expectations, never fabricate them.
    confirmedTurnReader: confirmedTurnReader(kernelTree),
    onDestroy: (evict) => tree.registerCleanup(evict),
  };
}
