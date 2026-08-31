import { getPositionRegistry } from './position-registry';
import {
  hasOpenCommitScope,
  onCommitScopesSettled,
} from './commit-consequence';
import { installOwnerInvalidationDispatch } from './owner-invalidation-port';
import { readCanonicalSnapshotInternal } from './canonical-snapshot';

interface OwnerInvalidationTarget {
  readonly $: object;
  readonly destroyed: () => boolean;
}

interface OwnerInvalidationState {
  readonly owner: OwnerInvalidationTarget;
  active: boolean;
  pending: boolean;
  requested: number;
  readonly listeners: Set<{ readonly callback: () => void }>;
  readonly releaseObservation: () => void;
  releaseSettlement: () => void;
}

let states: Map<number, OwnerInvalidationState> | undefined;

const ownerIdFor = (owner: OwnerInvalidationTarget | object) => {
  const direct = getPositionRegistry(owner)?.id;
  if (direct !== undefined) return direct;
  const stateRoot = (owner as { readonly $?: object }).$;
  return stateRoot ? getPositionRegistry(stateRoot)?.id : undefined;
};

export function observeOwnerInvalidationInternal(
  owner: OwnerInvalidationTarget,
  listener: () => void,
  activateObservation: () => () => void
): () => void {
  if (owner.destroyed()) return () => undefined;

  const ownerId = ownerIdFor(owner);
  if (ownerId === undefined) {
    throw new Error(
      'observeOwnerInvalidation: owner must be a SignalTree root.'
    );
  }

  let state = states?.get(ownerId);
  if (!state) {
    const nextState: OwnerInvalidationState = {
      owner,
      active: true,
      pending: false,
      requested: 0,
      listeners: new Set(),
      releaseObservation: activateObservation(),
      releaseSettlement: () => undefined,
    };
    nextState.releaseSettlement = onCommitScopesSettled(owner.$, () => {
      if (nextState.requested > 0) scheduleInvalidation(ownerId, nextState);
    });
    state = nextState;
    (states ??= new Map()).set(ownerId, state);
  }
  const subscription = { callback: listener };
  state.listeners.add(subscription);

  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    if (!state?.active) return;

    state.listeners.delete(subscription);
    if (state.listeners.size > 0) return;

    state.active = false;
    state.pending = false;
    state.releaseObservation();
    state.releaseSettlement();
    states?.delete(ownerId);
    if (states?.size === 0) states = undefined;
  };
}

export function markOwnerInvalidated(ownerId: number | undefined): void {
  if (ownerId === undefined) return;
  const state = states?.get(ownerId);
  if (!state?.active) return;
  state.requested++;
  if (!hasOpenCommitScope(state.owner.$)) scheduleInvalidation(ownerId, state);
}

export function markOwnerInvalidatedFrom(owner: object): void {
  markOwnerInvalidated(ownerIdFor(owner));
}

function scheduleInvalidation(
  ownerId: number,
  state: OwnerInvalidationState
): void {
  if (!state.active || state.pending) return;
  state.pending = true;
  const requested = state.requested;

  // Mutation observers and enhancer consequences scheduled in the write stack
  // settle before an adapter is told to reread externally visible truth.
  queueMicrotask(() => queueMicrotask(() => {
    if (!state.active || states?.get(ownerId) !== state) return;
    if (state.requested !== requested) {
      state.pending = false;
      scheduleInvalidation(ownerId, state);
      return;
    }
    state.pending = false;
    state.requested = 0;
    readCanonicalSnapshotInternal(state.owner);
    for (const subscription of [...state.listeners]) {
      try {
        subscription.callback();
      } catch {
        // One observer cannot fail invalidation or starve another observer.
      }
    }
  }));
}

export function terminateOwnerInvalidation(owner: object): void {
  const ownerId = ownerIdFor(owner);
  if (ownerId === undefined) return;
  const state = states?.get(ownerId);
  if (!state) return;

  state.active = false;
  state.pending = false;
  state.requested = 0;
  state.listeners.clear();
  state.releaseObservation();
  state.releaseSettlement();
  states?.delete(ownerId);
  if (states?.size === 0) states = undefined;
}

/** Test-only state view. */
export function ownerInvalidationStateForTesting(owner: object): {
  active: boolean;
  subscribers: number;
  pending: boolean;
} {
  const ownerId = ownerIdFor(owner);
  const state = ownerId === undefined ? undefined : states?.get(ownerId);
  return {
    active: state?.active ?? false,
    subscribers: state?.listeners.size ?? 0,
    pending: state?.pending ?? false,
  };
}

installOwnerInvalidationDispatch({
  mark: markOwnerInvalidated,
  markFrom: markOwnerInvalidatedFrom,
  terminate: terminateOwnerInvalidation,
});
