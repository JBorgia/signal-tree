import { useRef, useSyncExternalStore } from 'react';

// eslint-disable-next-line @nx/enforce-module-boundaries -- REACT-OBSERVATION-0 proof; delete when an authorized adapter seam replaces it.
import { acquireObservation } from '../../../../packages/kernel/src/lib/internals/observation-substrate';
// eslint-disable-next-line @nx/enforce-module-boundaries -- REACT-OBSERVATION-0 proof; delete when an authorized adapter seam replaces it.
import { getPositionRegistry } from '../../../../packages/kernel/src/lib/internals/position-registry';
// eslint-disable-next-line @nx/enforce-module-boundaries -- REACT-OBSERVATION-0 proof; delete when an authorized adapter seam replaces it.
import { getPathNotifier } from '../../../../packages/kernel/src/lib/path-notifier';

type SignalTreeOwner = object &
  (() => unknown) & {
    destroyed(): boolean;
    registerCleanup(cleanup: () => void): void;
  };

interface OwnerPublicationSource {
  subscribe(onStoreChange: () => void): () => void;
  observerCount(): number;
  publicationCount(): number;
}

const publicationSources = new WeakMap<SignalTreeOwner, OwnerPublicationSource>();

const publicationSourceFor = (owner: SignalTreeOwner) => {
  const existing = publicationSources.get(owner);
  if (existing) return existing;

  const registry = getPositionRegistry(owner);
  if (!registry) {
    throw new Error('REACT-OBSERVATION-0: owner has no publication identity');
  }

  const listeners = new Set<() => void>();
  let releaseObservation: (() => void) | undefined;
  let unsubscribeMutations: (() => void) | undefined;
  let unsubscribeFlush: (() => void) | undefined;
  let dirty = false;
  let cleanupRegistered = false;
  let publications = 0;
  let retired = owner.destroyed();

  const deactivate = () => {
    releaseObservation?.();
    unsubscribeMutations?.();
    unsubscribeFlush?.();
    releaseObservation = undefined;
    unsubscribeMutations = undefined;
    unsubscribeFlush = undefined;
    dirty = false;
  };

  const retire = () => {
    retired = true;
    deactivate();
    listeners.clear();
  };

  const activate = () => {
    if (retired || owner.destroyed()) {
      retired = true;
      return;
    }
    const notifier = getPathNotifier();
    unsubscribeMutations = notifier.subscribe(
      '**',
      (_value, _previous, _path, _ownerPath, _origin, _subjectIds, _positionIds, meta) => {
        if (meta?.ownerId === registry.id) dirty = true;
      }
    );
    unsubscribeFlush = notifier.onFlush(() => {
      if (!dirty) return;
      dirty = false;
      publications++;
      for (const listener of listeners) listener();
    });
    releaseObservation = acquireObservation(owner);

    if (!cleanupRegistered) {
      cleanupRegistered = true;
      owner.registerCleanup(retire);
    }
  };

  const source: OwnerPublicationSource = {
    subscribe(onStoreChange) {
      if (retired || owner.destroyed()) {
        retired = true;
        return () => undefined;
      }
      listeners.add(onStoreChange);
      if (listeners.size === 1) activate();

      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        listeners.delete(onStoreChange);
        if (listeners.size === 0) deactivate();
      };
    },
    observerCount: () => listeners.size,
    publicationCount: () => publications,
  };

  publicationSources.set(owner, source);
  return source;
};

/**
 * REACT-OBSERVATION-0 proof only. This is not a proposed package API.
 *
 * It deliberately reaches internal owner publication machinery so the
 * greenfield app can test the candidate before any public seam is authorized.
 */
export function useSignalTree<T>(
  owner: SignalTreeOwner,
  getSnapshot: () => T,
  equal: (previous: T, next: T) => boolean = Object.is
): T {
  const cache = useRef<
    | {
        owner: SignalTreeOwner;
        getSnapshot: () => T;
        equal: (previous: T, next: T) => boolean;
        value: T;
      }
    | undefined
  >(undefined);
  const getStableSnapshot = () => {
    const next = getSnapshot();
    if (
      cache.current?.owner === owner &&
      cache.current.getSnapshot === getSnapshot &&
      cache.current.equal === equal &&
      equal(cache.current.value, next)
    ) {
      return cache.current.value;
    }
    cache.current = { owner, getSnapshot, equal, value: next };
    return next;
  };

  return useSyncExternalStore(
    publicationSourceFor(owner).subscribe,
    getStableSnapshot,
    getStableSnapshot
  );
}

export const observerCountForTesting = (owner: SignalTreeOwner): number =>
  publicationSourceFor(owner).observerCount();

export const publicationCountForTesting = (owner: SignalTreeOwner): number =>
  publicationSourceFor(owner).publicationCount();
