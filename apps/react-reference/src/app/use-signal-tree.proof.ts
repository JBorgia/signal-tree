import { useRef, useSyncExternalStore } from 'react';
import {
  observeOwnerInvalidation,
  readCanonicalSnapshot,
} from '@signal-tree/kernel/adapter';

type SignalTreeOwner = object &
  {
    readonly $: object;
    destroyed(): boolean;
  };

interface OwnerInvalidationSource {
  subscribe(onStoreChange: () => void): () => void;
  observerCount(): number;
  invalidationCount(): number;
}

const invalidationSources = new WeakMap<SignalTreeOwner, OwnerInvalidationSource>();

const publicationSourceFor = (owner: SignalTreeOwner) => {
  const existing = invalidationSources.get(owner);
  if (existing) return existing;

  const listeners = new Set<() => void>();
  let releaseInvalidation: (() => void) | undefined;
  let invalidations = 0;

  const deactivate = () => {
    releaseInvalidation?.();
    releaseInvalidation = undefined;
  };

  const activate = () => {
    releaseInvalidation = observeOwnerInvalidation(owner, () => {
      invalidations++;
      for (const listener of listeners) listener();
    });
  };

  const source: OwnerInvalidationSource = {
    subscribe(onStoreChange) {
      if (owner.destroyed()) return () => undefined;
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
    observerCount: () => owner.destroyed() ? 0 : listeners.size,
    invalidationCount: () => invalidations,
  };

  invalidationSources.set(owner, source);
  return source;
};

/**
 * REACT-OBSERVATION-0 proof only. This is not a proposed package API.
 *
 * It consumes only the framework-neutral owner invalidation fact. Hook naming,
 * selectors, and caching remain unfrozen React-package questions.
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

export const readSignalTreeSnapshot = <T>(owner: SignalTreeOwner): T =>
  readCanonicalSnapshot<T>(owner);

export const observerCountForTesting = (owner: SignalTreeOwner): number =>
  publicationSourceFor(owner).observerCount();

export const invalidationCountForTesting = (owner: SignalTreeOwner): number =>
  publicationSourceFor(owner).invalidationCount();
