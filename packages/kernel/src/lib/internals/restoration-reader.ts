import type { ISignalTree } from '../types';
import type { ToolingTree } from './tooling-tree';
import type { TreeId } from './position-registry';
import { StudioTreeDestroyedError } from './confirmed-turn-view';

/** IDs are scoped by the snapshot/event treeId, and never reused after reset. */
export type RestorationEntryId = `restoration-entry:${number}`;
export type RestorationOperationId = `restoration-operation:${number}`;

export interface RestorationEntryView {
  readonly entryId: RestorationEntryId;
  /** Only relations explicitly recorded by the restoration owner. */
  readonly transactionIds: readonly number[];
  readonly status: 'applied' | 'unapplied' | 'inconsistent';
}

export interface RestorationReaderState {
  readonly entries: readonly RestorationEntryView[];
  readonly currentIndex: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface RestorationReaderSnapshot extends RestorationReaderState {
  readonly treeId: TreeId;
  readonly sequence: number;
}

export type RestorationReaderChange =
  | { readonly kind: 'history-changed' }
  | {
      readonly kind: 'operation';
      readonly operationId: RestorationOperationId;
      readonly operation: 'undo' | 'redo' | 'jump';
      readonly outcome: 'applied' | 'noop' | 'refused' | 'failed';
      readonly affectedEntryIds: readonly RestorationEntryId[];
    };

export type RestorationReaderEvent = RestorationReaderChange & {
  readonly treeId: TreeId;
  readonly sequence: number;
};

export type RestorationReaderListener = (
  event: RestorationReaderEvent,
  snapshot: RestorationReaderSnapshot
) => void;

export interface RestorationReader {
  readonly treeId: TreeId;
  snapshot(): RestorationReaderSnapshot;
  subscribe(listener: RestorationReaderListener): () => void;
}

type Subscription = { readonly listener: RestorationReaderListener };
type Delivery = {
  readonly event: RestorationReaderEvent;
  readonly snapshot: RestorationReaderSnapshot;
  readonly audience: readonly Subscription[];
};
type Feed = {
  reader: RestorationReader;
  supply?: () => RestorationReaderState;
  publish(change: RestorationReaderChange): void;
};
const FEEDS = new WeakMap<object, Feed>();

function createFeed<T>(
  tree: ISignalTree<T>,
  treeId: TreeId,
  supply: () => RestorationReaderState
): Feed {
  const key = tree.$;
  const existing = FEEDS.get(key);
  if (existing) return existing;
  let sequence = 0;
  let destroyed = tree.destroyed();
  let dispatching = false;
  const listeners = new Set<Subscription>();
  const queue: Delivery[] = [];
  const snapshot = (): RestorationReaderSnapshot => {
    if (destroyed || tree.destroyed() || !feed.supply)
      throw new StudioTreeDestroyedError();
    const state = feed.supply();
    return Object.freeze({
      treeId,
      sequence,
      entries: Object.freeze(
        state.entries.map((entry) =>
          Object.freeze({
            entryId: entry.entryId,
            transactionIds: Object.freeze([...entry.transactionIds]),
            status: entry.status,
          })
        )
      ),
      currentIndex: state.currentIndex,
      canUndo: state.canUndo,
      canRedo: state.canRedo,
    });
  };
  const feed: Feed = {
    supply: destroyed ? undefined : supply,
    reader: Object.freeze({
      treeId,
      snapshot,
      subscribe(listener: RestorationReaderListener): () => void {
        if (destroyed || tree.destroyed()) throw new StudioTreeDestroyedError();
        const subscription = { listener };
        listeners.add(subscription);
        return () => {
          listeners.delete(subscription);
        };
      },
    }),
    publish(change): void {
      if (destroyed || tree.destroyed()) return;
      sequence++;
      if (listeners.size === 0) return;
      const event: RestorationReaderEvent = Object.freeze({
        ...change,
        ...(change.kind === 'operation'
          ? {
              affectedEntryIds: Object.freeze([...change.affectedEntryIds]),
            }
          : {}),
        treeId,
        sequence,
      });
      // This queue exists only while callbacks are on the stack. In particular,
      // a subscriber added during delivery cannot receive a queued past event.
      queue.push({ event, snapshot: snapshot(), audience: [...listeners] });
      if (dispatching) return;
      dispatching = true;
      try {
        while (!destroyed && queue.length) {
          const delivery = queue.shift();
          if (!delivery) break;
          for (const subscription of delivery.audience) {
            if (destroyed) break;
            if (!listeners.has(subscription)) continue;
            try {
              subscription.listener(delivery.event, delivery.snapshot);
            } catch {
              /* Tooling cannot change application operation outcomes. */
            }
          }
        }
      } finally {
        queue.length = 0;
        dispatching = false;
      }
    },
  };
  FEEDS.set(key, feed);
  if (!destroyed)
    tree.registerCleanup(() => {
      destroyed = true;
      listeners.clear();
      queue.length = 0;
      feed.supply = undefined;
    });
  return feed;
}

/** Read current owner facts without installing restoration or retaining history. */
export function restorationReader<T, TAccum = unknown>(
  tree: ToolingTree<T, TAccum>
): RestorationReader | undefined {
  if ((tree.destroyed as () => boolean)()) throw new StudioTreeDestroyedError();
  return FEEDS.get(tree.$)?.reader;
}

/** @internal Only the restoration owner installs the current-state supplier. */
export function installRestorationReader<T>(
  tree: ISignalTree<T>,
  treeId: TreeId,
  supply: () => RestorationReaderState
): (change: RestorationReaderChange) => void {
  const feed = createFeed(tree, treeId, supply);
  return (change) => feed.publish(change);
}
