import { type StudioTreeId } from '@signal-tree/studio-query';

import { REALIZATION_CAPABILITY } from '../capabilities';
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
  isPaused(): boolean;
  pause(): void;
  resume(): void;
  clear(): void;
  /** Idempotent. */
  dispose(): void;
}

export interface StartCaptureOptions {
  readonly maxEffects?: number;
  readonly maxBytes?: number;
}

/**
 * ⚠️ CARRIES THE REFUSAL, NOT JUST THE FACT OF ONE. A caller that flattens
 * every capture failure to one code makes the bridge state a wrong reason for a
 * correctly detected condition — which is how "leaf observation unavailable"
 * once surfaced as "tree not found".
 */
export class StudioCaptureError extends Error {
  constructor(
    readonly error:
      | StudioBridgeError
      | { readonly code: 'STUDIO_CAPTURE_ALREADY_ACTIVE' }
  ) {
    super(error.code);
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
    //
    // ⚠️ The capability named is the one actually missing. `support.reason`
    // ('leaf-observation-unavailable') is the mechanism; `realizations` is the
    // capability, and the caller renders the capability.
    throw new StudioCaptureError({
      code: 'STUDIO_CAPABILITY_UNAVAILABLE',
      capability: REALIZATION_CAPABILITY,
    });
  }

  if (active.has(target.treeId)) {
    // Ref-counted sharing is deliberately deferred to the hub work; one
    // consumer must not be able to dispose another's observation by accident.
    throw new StudioCaptureError({ code: 'STUDIO_CAPTURE_ALREADY_ACTIVE' });
  }

  const create = () => createRealizationCapture({
    treeId: target.treeId, ownerId: target.ownerId,
    maxEffects: options.maxEffects, maxBytes: options.maxBytes,
  });
  let capture: RealizationCapture = create();
  let uninstall: (() => void) | undefined = target.observe((frame) => capture.accept(frame));
  let disposed = false;
  let interrupted = false;
  const lease: RealizationLease = {
    snapshot: () => {
      const snapshot = capture.snapshot();
      return interrupted ? {...snapshot, coverage: {...snapshot.coverage, interrupted: true}} : snapshot;
    },
    isPaused: () => !uninstall,
    pause() {
      if (disposed || !uninstall) return;
      uninstall(); uninstall = undefined; interrupted = true;
    },
    resume() {
      if (!disposed && !uninstall) uninstall = target.observe((frame) => capture.accept(frame));
    },
    clear() {
      if (disposed) return;
      capture.dispose(); capture = create(); interrupted = !uninstall;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      uninstall?.(); uninstall = undefined;
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
  const lease = active.get(treeId);
  return lease !== undefined && !lease.isPaused();
}

/**
 * The live lease for a tree, or `undefined`.
 *
 *     ONE AUTHORITY FOR "IS THIS TREE BEING CAPTURED".
 *
 * ⚠️ EXISTS SO CALLERS DO NOT KEEP THEIR OWN MAP. The bridge used to track its
 * panel-driven leases separately, which made "capture active" answerable two
 * ways. Destruction disposed the lease here and left the bridge's copy behind,
 * so `readRealizations` would report `capture: 'active'` for a tree whose
 * observer was already gone.
 */
export function peekCapture(treeId: StudioTreeId): RealizationLease | undefined {
  return active.get(treeId);
}

/**
 * Stop capturing for this tree, if it is. Idempotent; returns whether there was
 * anything to stop.
 *
 * ⚠️ LIFECYCLE BELONGS BELOW THE UI. Studio must never keep charging writes for
 * a tree it has stopped presenting, and "the panel remembers to press Stop
 * first" is not a mechanism — detach and destroy are not user actions.
 */
export function disposeCapture(treeId: StudioTreeId): boolean {
  const lease = active.get(treeId);
  lease?.dispose();
  return lease !== undefined;
}
