import type { CarrierKind } from '../types';
import { isToolingTreeDestroyed, type ToolingTree } from './tooling-tree';
import type { TreeId } from './position-registry';
import { StudioTreeDestroyedError } from './confirmed-turn-view';
import {
  getRestorationSource,
  isRestorationRefusal,
  type RestorationEntryId,
  type RestorationSource,
} from './restoration-source';

export type { RestorationEntryId } from './restoration-source';
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
const READERS = new WeakMap<object, RestorationReader>();

/**
 * One feed per tree, created when a reader first attaches. Sequences and
 * operation ids count from that attachment; there is no retrospective history.
 */
function createReader<T, C extends CarrierKind, TAccum>(
  tree: ToolingTree<T, C, TAccum>,
  source: RestorationSource
): RestorationReader {
  const treeId = source.treeId;
  let sequence = 0;
  let nextOperationId = 1;
  let destroyed = false;
  let dispatching = false;
  const listeners = new Set<Subscription>();
  const queue: Delivery[] = [];
  const live = () => !destroyed && !isToolingTreeDestroyed(tree);
  const snapshot = (): RestorationReaderSnapshot => {
    if (!live()) throw new StudioTreeDestroyedError();
    const state = source.read();
    return Object.freeze({
      treeId,
      sequence,
      entries: Object.freeze(
        state.entries.map((entry) => {
          const status = state.statusOf(entry.id);
          return Object.freeze({
            entryId: entry.entryId,
            transactionIds: Object.freeze(
              entry.__transactionId === undefined ? [] : [entry.__transactionId]
            ),
            status:
              status === 'applied' || status === 'unapplied'
                ? status
                : 'inconsistent',
          });
        })
      ),
      currentIndex: state.currentIndex,
      canUndo: state.canUndo,
      canRedo: state.canRedo,
    });
  };
  const publish = (change: RestorationReaderChange): void => {
    if (!live()) return;
    sequence++;
    if (listeners.size === 0) return;
    const event: RestorationReaderEvent = Object.freeze({
      ...change,
      ...(change.kind === 'operation'
        ? { affectedEntryIds: Object.freeze([...change.affectedEntryIds]) }
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
  };
  source.attach({
    historyChanged: () => publish({ kind: 'history-changed' }),
    operation(operation, applied, failure) {
      // An operation that completed reports what it applied, even if a
      // consumer threw afterwards. One that threw first is refused only when
      // restoration itself declined (an owner-made error) and nothing applied.
      const outcome = !failure
        ? applied.size
          ? 'applied'
          : 'noop'
        : applied.size === 0 && isRestorationRefusal(failure.error)
        ? 'refused'
        : 'failed';
      publish({
        kind: 'operation',
        operationId: `restoration-operation:${nextOperationId++}`,
        operation,
        outcome,
        affectedEntryIds: [...applied],
      });
    },
  });
  tree.registerCleanup(() => {
    destroyed = true;
    listeners.clear();
    queue.length = 0;
  });
  return Object.freeze({
    treeId,
    snapshot,
    subscribe(listener: RestorationReaderListener): () => void {
      if (!live()) throw new StudioTreeDestroyedError();
      const subscription = { listener };
      listeners.add(subscription);
      return () => {
        listeners.delete(subscription);
      };
    },
  });
}

/**
 * Read current owner facts without installing restoration or retaining history.
 * `undefined` when the tree has no (enabled) `restoration()`.
 */
export function restorationReader<
  T,
  C extends CarrierKind = CarrierKind,
  TAccum = unknown
>(tree: ToolingTree<T, C, TAccum>): RestorationReader | undefined {
  if (isToolingTreeDestroyed(tree)) throw new StudioTreeDestroyedError();
  const root = tree.$ as unknown as object;
  const existing = READERS.get(root);
  if (existing) return existing;
  const source = getRestorationSource(root);
  if (!source) return undefined;
  const reader = createReader(tree, source);
  READERS.set(root, reader);
  return reader;
}
