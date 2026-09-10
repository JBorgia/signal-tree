import { type StudioTreeId } from '@signal-tree/studio-query';

import { type StudioBridgeError } from '../errors';
import {
  createRealizationCapture,
  type ObservedFrame,
  type RealizationCapture,
} from './capture';
import { realizationSupport, type TreeStructure } from './support';
import { type RealizationCaptureSnapshot } from './types';

/** What the lease needs from a live tree. Injected, so no kernel dependency. */
export interface CaptureTarget {
  readonly treeId: StudioTreeId;
  readonly ownerId: number;
  readonly structure: TreeStructure;
  /** Install an observer. Returns an uninstall function. */
  readonly observe: (onFrame: (frame: ObservedFrame) => void) => () => void;
  /** Register a callback for tree destruction, if the target supports it. */
  readonly onDestroy?: (dispose: () => void) => void;
}

export interface RealizationLease {
  snapshot(): RealizationCaptureSnapshot;
  /** Idempotent. */
  dispose(): void;
}

export interface StartCaptureOptions {
  readonly maxEffects?: number;
}

export class StudioCaptureError extends Error {
  constructor(readonly error: StudioBridgeError | { code: string; reason?: string }) {
    super(`${(error as { code: string }).code}`);
    this.name = 'StudioCaptureError';
  }
}

/** One active realization capture per tree, for now. */
const active = new Map<StudioTreeId, RealizationLease>();

/**
 * Begin bounded realization capture.
 *
 *     ATTACHMENT IS NOT CAPTURE.
 *
 * `attachStudio` means *this tree may be inspected*. This means *start paying
 * runtime and memory to retain evidence the kernel does not otherwise keep*.
 * Keeping them separate preserves the property S1 earned: an attached tree with
 * no capture requested has no observer, no retention and no per-write cost.
 *
 * ⚠️ REFUSES BEFORE INSTALLING ANYTHING. Support is decided structurally from
 * the tree's construction (`causal-runtime`), never by listening to see whether
 * frames arrive — that cannot distinguish "cannot observe" from "nothing has
 * happened yet". There is no partial start.
 */
export function startRealizationCapture(
  target: CaptureTarget,
  options: StartCaptureOptions = {}
): RealizationLease {
  const support = realizationSupport(target.structure);
  if (support.state === 'unsupported') {
    // Nothing is installed and nothing is registered on this path.
    throw new StudioCaptureError({
      code: 'STUDIO_CAPABILITY_UNAVAILABLE',
      reason: support.reason,
    });
  }

  if (active.has(target.treeId)) {
    // Ref-counted sharing is deliberately deferred to the hub work; one
    // consumer must not be able to dispose another's observation by accident.
    throw new StudioCaptureError({ code: 'STUDIO_CAPTURE_ALREADY_ACTIVE' });
  }

  const capture: RealizationCapture = createRealizationCapture({
    treeId: target.treeId,
    ownerId: target.ownerId,
    maxEffects: options.maxEffects,
  });

  const uninstall = target.observe((frame) => capture.accept(frame));

  let disposed = false;
  const lease: RealizationLease = {
    snapshot: () => capture.snapshot(),
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      uninstall();
      capture.dispose();
      active.delete(target.treeId);
    },
  };

  active.set(target.treeId, lease);
  // A destroyed tree must not leave an observer installed or a lease listed.
  target.onDestroy?.(() => lease.dispose());
  return lease;
}

/** Whether a capture is currently active for this tree. Never creates one. */
export function isCaptureActive(treeId: StudioTreeId): boolean {
  return active.has(treeId);
}
