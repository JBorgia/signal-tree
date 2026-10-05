import { isTraversableNode } from '../utils';
import { reportContainedObserverError } from './error-reporter';
import type { WriteMetadata } from '../mutation-types';

export type CollectionOrderCapture = {
  readonly owner: number;
  readonly ownerPath: string;
  readonly beforeSubjects: readonly number[];
  readonly afterSubjects: readonly number[];
  readonly beforeFrontier: unknown;
  readonly afterFrontier: unknown;
  readonly meta?: WriteMetadata;
};

/**
 * Transient committed source evidence; consumers retain their own authority.
 *
 * Published by an entity collection after a mutation's physical application
 * and before any notifier enqueue or delivery, so admission can see every row
 * of a multi-row commit before an observer of the first row can re-enter.
 */
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
  /** Pay-for-use: producers build committed evidence only when this is true. */
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
        } catch (error) {
          // Committed truth cannot be un-applied by an observer, and one
          // observer must not starve another of the same evidence. These
          // observers guard admission, so a failure is reported rather than
          // silently disabling that protection.
          reportContainedObserverError({
            error,
            operation: 'transaction:listener',
          });
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
