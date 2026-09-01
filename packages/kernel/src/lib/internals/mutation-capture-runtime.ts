import { isTraversableNode } from '../utils';
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

export const MUTATION_CAPTURE_RUNTIME = Symbol.for(
  'SignalTree:MutationCaptureRuntime'
);

export interface MutationCaptureRuntime {
  isCaptureActive(): boolean;
  activateCapture(): () => void;
  publishCollectionOrder?(capture: CollectionOrderCapture): void;
  subscribeCollectionOrder?(
    listener: (capture: CollectionOrderCapture) => void
  ): () => void;
}

export function createMutationCaptureRuntime(): MutationCaptureRuntime {
  let activeCount = 0;
  const collectionOrderListeners = new Set<
    (capture: CollectionOrderCapture) => void
  >();

  return {
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
