import {
  observeWrites,
  treeCapabilities,
  treeRuntimeId,
} from '@signal-tree/kernel/internals';
import { type StudioTreeId } from '@signal-tree/studio-query';

import { type CaptureTarget } from './lease';

/** The minimum a real tree must structurally be. */
export interface LiveTree {
  readonly $: object;
  readonly destroyed: () => boolean;
  registerCleanup(fn: () => void): void;
}

/**
 * Build a `CaptureTarget` from a real SignalTree.
 *
 *     THE ONE PLACE THAT KNOWS BOTH SIDES.
 *
 * The kernel exposes generic truths — capabilities, runtime identity, a
 * process-global write stream — and this translates them into Studio's capture
 * model. No Studio concept leaks into the kernel; no kernel internals leak into
 * `studio-query` or the UI.
 *
 * ⚠️ `observeWrites` is PROCESS-GLOBAL and delivers other trees' writes. The
 * filtering below is not an optimization, it is the correctness boundary
 * (`NOTIFIER-SCOPE-0`).
 */
export function liveCaptureTarget(
  tree: LiveTree,
  treeId: StudioTreeId
): CaptureTarget | undefined {
  const kernelTree = tree as never;
  const ownerId = treeRuntimeId(kernelTree);
  if (typeof ownerId !== 'number') {
    // No runtime identity means nothing could be attributed to this tree.
    return undefined;
  }

  return {
    treeId,
    ownerId,
    structure: { capabilities: treeCapabilities(kernelTree) },
    observe: (onFrame) =>
      observeWrites((frame) => {
        // Only the semantic class S2 owns. Positive predicate on purpose:
        // `!== 'authored'` would sweep in `inspection` and any future member.
        if (frame.participation !== 'realized') {
          return;
        }
        onFrame({
          path: frame.path,
          ownerPath: frame.ownerPath,
          before: frame.before,
          after: frame.after,
          origin: frame.origin,
          participation: 'realized',
          // Passed through unchanged — the lease decides what an absent owner
          // means, and it degrades scopeIntegrity rather than guessing.
          ownerId: frame.ownerId,
          transactionId: frame.transactionId,
          subjectIds: frame.subjectIds,
          positionIds: frame.positionIds,
        });
      }),
    onDestroy: (dispose) => tree.registerCleanup(dispose),
  };
}
