import type { WritableCell } from './cell-runtime';

import { emitOwnedMutation } from './owned-mutation';
import { getOwnedOwnerPath } from './owned-metadata';
import { getPositionRegistry } from './position-registry';
import { isTraversableNode } from './node-shape';
import { observeIntrinsicMutations } from './intrinsic-mutation';

/**
 * THE DORMANT OBSERVATION SUBSTRATE.
 *
 * `link()` is a POST-CONSTRUCTION operation: nothing tells `signalTree()` that a
 * relationship will exist later. So an ordinary leaf must be observable on
 * demand, without the caller having predicted Link usage when the tree was
 * built, and without paying for observation nobody asked for.
 *
 * Two rejected designs bound this one:
 *
 *   Making the observation capabilities baseline taxes the ordinary write hot
 *   path for every tree, including those that never link or persist.
 *
 *   Installing interception LATER cannot work: a `set`/`update` reference that
 *   escaped to application code keeps the original write path, and
 *   `WritableLeaf` extends Angular's `WritableSignal`, so retaining
 *   one is ordinary use of a public object.
 *
 * Hence: the interception point exists BEFORE anything can escape and is never
 * replaced; only the ARM it consults changes. Dormant, the write is the raw
 * write. Armed, it publishes. Expensive identity — the PositionId — is
 * allocated on first activation and retained for the source's lifetime, because
 * the source does not die when its last observer leaves.
 *
 *   ESCAPED-CALLABLE RULE      a callable that escaped must keep working, and
 *                              must observe once armed
 *   DORMANCY RULE              interception exists before escape; cost does not
 *   OWNER-DISCOVERABILITY RULE activation reads everything from the SOURCE
 *   CLAIMS COMPOSE BY LEAF     overlapping scopes share one installation
 *   SHARED OBSERVATION,        one publication, many consumers, each owning its
 *   SEPARATE AUTHORITY         own eligible-authority projection
 *
 * ⚠️ Only leaves that did NOT receive `mutation-capture` get this. A tree built
 * with that capability already intercepts its writes, and double-wrapping would
 * publish twice.
 */

/**
 * Deliberately only what is not already reachable from the location.
 */
type LeafObservation = {
  claims: number;
  /** Allocated on first activation, retained for the source's lifetime. */
  positionId: number | undefined;
  releaseMutationObserver: () => void;
};

const OBSERVATION = new WeakMap<object, LeafObservation>();

/**
 * @internal Install the stable interception point on an ordinary leaf.
 *
 * Called during materialization, before any consumer can hold a reference to
 * `set` or `update`. The functions installed here are the ones that must live
 * for the leaf's lifetime.
 */
export function installDormantObservation<T>(leaf: WritableCell<T>): void {
  OBSERVATION.set(leaf as object, {
    claims: 0,
    positionId: undefined,
    releaseMutationObserver: () => undefined,
  });
}

/** Claim observation for one leaf, or `undefined` if it is not one. */
function claimLeaf(node: object): (() => void) | undefined {
  const state = OBSERVATION.get(node);
  if (!state) return undefined;

  const registry = getPositionRegistry(node);
  const ownerPath = getOwnedOwnerPath(node);
  if (!registry || ownerPath === undefined) return undefined;

  if (state.claims === 0) {
    if (state.positionId === undefined) {
      state.positionId = registry.allocate();
    }
    const positionIds = [state.positionId];
    state.releaseMutationObserver =
      observeIntrinsicMutations(node, (mutation) => {
        if (!mutation.changed) return;
        emitOwnedMutation(
          { path: ownerPath, positionIds, ownerId: registry.id },
          mutation.before,
          mutation.after,
          mutation.intent
        );
      }) ?? (() => undefined);
  }
  state.claims++;

  let released = false;
  return () => {
    if (released) return; // dispose is idempotent
    released = true;
    state.claims--;
    if (state.claims === 0) {
      state.releaseMutationObserver();
      state.releaseMutationObserver = () => undefined;
    }
  };
}

/**
 * @internal Claim observation for a source and everything beneath it, returning
 * an idempotent release.
 *
 * ACTIVATION FOLLOWS SOURCE SCOPE: only leaves inside the source are armed, so
 * a relationship on one branch does not convert unrelated state into observed
 * state. Leaves already intercepted by `mutation-capture` are skipped — they
 * publish already, and claiming them would double-wrap.
 */
export function acquireObservation(source: unknown): () => void {
  const releases: Array<() => void> = [];
  const seen = new Set<unknown>();

  const visit = (node: unknown): void => {
    if (!isTraversableNode(node)) return;
    if (seen.has(node)) return;
    seen.add(node);

    const claim = claimLeaf(node as object);
    if (claim) {
      releases.push(claim);
      return;
    }
    for (const key of Object.keys(node as Record<string, unknown>)) {
      visit((node as Record<string, unknown>)[key]);
    }
  };
  visit(source);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const release of releases) release();
  };
}

/** @internal Test-only view of a leaf's observation state. */
export function observationStateForTesting(node: unknown): {
  claims: number;
  positionId: number | undefined;
  observable: boolean;
} {
  const state = OBSERVATION.get(node as object);
  return {
    claims: state?.claims ?? 0,
    positionId: state?.positionId,
    observable: state !== undefined,
  };
}

