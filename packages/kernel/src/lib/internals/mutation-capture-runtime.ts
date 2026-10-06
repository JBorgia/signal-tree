import { isTraversableNode } from '../utils';
import type { WriteMetadata } from '../mutation-types';

/**
 * One collection operation's order change. With subjects: an order change
 * of surviving rows (setAll, prependMany's move), with the orders around it.
 * Without: a FRONTIER-ONLY transition, published once per operation that
 * replaced the collection's order frontier (an add, a remove, a move), so a
 * turn's first and last frontier on the collection are known in time order.
 */
export type CollectionOrderCapture = {
  readonly owner: number;
  readonly ownerPath: string;
  readonly beforeSubjects?: readonly number[];
  readonly afterSubjects?: readonly number[];
  readonly beforeFrontier: unknown;
  readonly afterFrontier: unknown;
  readonly meta?: WriteMetadata;
};

/** A capture that carries the orders (an order change of surviving rows). */
export type OrderChangeCapture = CollectionOrderCapture & {
  readonly beforeSubjects: readonly number[];
  readonly afterSubjects: readonly number[];
};

/** Transient committed source evidence; consumers retain their own authority. */
export type CommittedEntityMutation = {
  readonly subject: number;
  /** Actual row values; undefined means the lifetime is not a current member. */
  readonly before: unknown;
  readonly after: unknown;
  /** Membership/key changes claim the lifetime, rather than just value fields. */
  readonly structural: boolean;
};

export type CommittedEntityCapture = {
  readonly owner: number;
  readonly ownerPath: string;
  readonly changes: readonly CommittedEntityMutation[];
  readonly meta?: WriteMetadata;
};

export const MUTATION_CAPTURE_RUNTIME = Symbol.for(
  'SignalTree:MutationCaptureRuntime'
);

export interface MutationCaptureRuntime {
  hasCommittedEntityObservers?(): boolean;
  publishCommittedEntity?(capture: CommittedEntityCapture): void;
  subscribeCommittedEntity?(
    listener: (capture: CommittedEntityCapture) => void
  ): () => void;
  isCaptureActive(): boolean;
  activateCapture(): () => void;
  publishCollectionOrder?(capture: CollectionOrderCapture): void;
  subscribeCollectionOrder?(
    listener: (capture: CollectionOrderCapture) => void
  ): () => void;
}

export function createMutationCaptureRuntime(): MutationCaptureRuntime {
  let activeCount = 0;
  const entityListeners = new Set<(capture: CommittedEntityCapture) => void>();
  const collectionOrderListeners = new Set<
    (capture: CollectionOrderCapture) => void
  >();

  return {
    hasCommittedEntityObservers(): boolean {
      return activeCount > 0 && entityListeners.size > 0;
    },
    publishCommittedEntity(capture): void {
      if (activeCount === 0) return;
      for (const listener of [...entityListeners]) {
        try {
          listener(capture);
        } catch {
          /* committed truth cannot be un-applied by an observer */
        }
      }
    },
    subscribeCommittedEntity(listener): () => void {
      entityListeners.add(listener);
      return () => {
        entityListeners.delete(listener);
      };
    },
    isCaptureActive(): boolean {
      return activeCount > 0;
    },
    activateCapture(): () => void {
      activeCount += 1;
      let released = false;

      return () => {
        if (released) {
          return;
        }

        released = true;
        activeCount = Math.max(0, activeCount - 1);
      };
    },
    publishCollectionOrder(capture): void {
      if (activeCount === 0) {
        return;
      }
      for (const listener of [...collectionOrderListeners]) {
        listener(capture);
      }
    },
    subscribeCollectionOrder(listener): () => void {
      collectionOrderListeners.add(listener);
      return () => collectionOrderListeners.delete(listener);
    },
  };
}

export function getMutationCaptureRuntime(
  node: unknown
): MutationCaptureRuntime | undefined {
  if (!isTraversableNode(node)) {
    return undefined;
  }

  return (node as Record<symbol, MutationCaptureRuntime | undefined>)[
    MUTATION_CAPTURE_RUNTIME
  ];
}
