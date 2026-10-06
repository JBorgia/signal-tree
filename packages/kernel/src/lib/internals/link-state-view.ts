import type { CarrierKind } from '../types';
import { isToolingTreeDestroyed, type ToolingTree } from './tooling-tree';
import { getPositionRegistry, type TreeId } from './position-registry';
import { getOwnedPositionIds } from './owned-metadata';
import { getLinkStateSlot, type LinkRecord } from './link-state-source';
import { StudioTreeDestroyedError } from './confirmed-turn-view';

/** Read-only activity of one relationship. IDs are scoped to its tree. */
export interface LinkStateView {
  readonly id: number;
  /** Diagnostic label, never an address or endpoint URL. */
  readonly path: string;
  readonly positions: readonly number[];
  readonly directions: {
    readonly get: boolean;
    readonly set: boolean;
    readonly subscribe: boolean;
  };
  /** An eligible change is marked and not yet handed to settlement. */
  readonly dirty: boolean;
  /**
   * Work handed to the settlement authority and not yet released: a flush
   * waiting behind an open transaction scope, or a send awaiting permission.
   */
  readonly held: boolean;
  /** Scheduled reconciliation jobs, not a FIFO of application values. */
  readonly queued: number;
  /** An endpoint call is in flight; never a held or queued send. */
  readonly sending: boolean;
  readonly retrieving: number;
  readonly disposed: boolean;
}

export interface LinkStateEvent {
  readonly treeId: TreeId;
  readonly sequence: number;
  readonly kind:
    | 'created'
    | 'changed'
    | 'send-failed'
    | 'retrieve-failed'
    | 'disposed';
  readonly link: LinkStateView;
}

export interface LinkStateSnapshot {
  readonly treeId: TreeId;
  readonly sequence: number;
  readonly links: readonly LinkStateView[];
}

/** No retrospective event history; snapshots describe active relationships only. */
export interface LinkStateReader {
  snapshot(): LinkStateSnapshot;
  subscribe(listener: (event: LinkStateEvent) => void): () => void;
}

type Subscription = { listener: (event: LinkStateEvent) => void };
type Delivery = {
  event: LinkStateEvent;
  audience: readonly Subscription[];
};
type State = {
  sequence: number;
  closed: boolean;
  delivering: boolean;
  deliveries: Delivery[];
  listeners: Set<Subscription>;
};
const states = new WeakMap<object, State>();

/** The read-only view of one relationship, from its facts at this moment. */
function viewOf(record: LinkRecord): LinkStateView {
  const [dirty, held, queued, sending, retrieving, disposed] =
    record.activity();
  return {
    id: record.id,
    path: record.path,
    positions: getOwnedPositionIds(record.source) ?? [],
    directions: {
      get: !!record.endpoint.get,
      set: !!record.endpoint.set,
      subscribe: !!record.endpoint.subscribe,
    },
    dirty,
    held,
    queued,
    sending,
    retrieving,
    disposed,
  };
}
function detach(view: LinkStateView): LinkStateView {
  return {
    ...view,
    positions: [...view.positions],
    directions: { ...view.directions },
  };
}

function publish(
  state: State,
  treeId: TreeId,
  record: LinkRecord,
  kind: LinkStateEvent['kind']
): void {
  if (state.closed) return;
  const sequence = ++state.sequence;
  // No event allocation or retained payload when nobody is listening.
  if (state.listeners.size === 0) return;
  state.deliveries.push({
    event: { treeId, sequence, kind, link: viewOf(record) },
    audience: [...state.listeners],
  });
  if (state.delivering) return;
  state.delivering = true;
  try {
    // Reentrant operations enqueue behind this fact for every observer.
    // Audience is captured at publication, so new listeners receive no past.
    for (let index = 0; index < state.deliveries.length; index++) {
      const { event, audience } = state.deliveries[index];
      for (const subscription of audience) {
        if (state.closed || !state.listeners.has(subscription)) continue;
        try {
          subscription.listener({ ...event, link: detach(event.link) });
        } catch {
          /* Observation cannot fail synchronization. */
        }
      }
    }
  } finally {
    state.deliveries.length = 0;
    state.delivering = false;
  }
}

/**
 * Observe active Link relationships owned by this tree. Reading creates no Link,
 * performs no I/O and grants no mutation authority. Destroyed trees refuse reads.
 * Sequences count from the first reader of the tree; there is no event history.
 */
export function linkStateReader<
  T,
  C extends CarrierKind = CarrierKind,
  TAccum = unknown
>(tree: ToolingTree<T, C, TAccum>): LinkStateReader {
  const registry = getPositionRegistry(tree.$);
  if (!registry)
    throw new Error('Link observation requires an owned SignalTree.');
  if (isToolingTreeDestroyed(tree)) throw new StudioTreeDestroyedError();
  const slot = getLinkStateSlot(registry);
  let existing = states.get(registry);
  if (!existing) {
    const state: State = {
      sequence: 0,
      closed: false,
      delivering: false,
      deliveries: [],
      listeners: new Set(),
    };
    existing = state;
    states.set(registry, state);
    slot.observer = (record, kind) =>
      publish(
        state,
        registry.id,
        record,
        (kind ?? 'changed') as LinkStateEvent['kind']
      );
    tree.registerCleanup(() => {
      state.closed = true;
      slot.observer = undefined;
      slot.links.clear();
      state.listeners.clear();
      state.deliveries.length = 0;
    });
  }
  const state = existing;
  const assertLive = () => {
    if (state.closed || isToolingTreeDestroyed(tree))
      throw new StudioTreeDestroyedError();
  };
  return {
    snapshot() {
      assertLive();
      return {
        treeId: registry.id,
        sequence: state.sequence,
        links: [...slot.links.values()].map((record) => detach(viewOf(record))),
      };
    },
    subscribe(listener) {
      assertLive();
      const subscription = { listener };
      state.listeners.add(subscription);
      return () => {
        state.listeners.delete(subscription);
      };
    },
  };
}
