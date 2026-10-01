import type { ToolingTree } from './tooling-tree';
import {
  getPositionRegistry,
  type PositionRegistry,
  type TreeId,
} from './position-registry';
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
  readonly dirty: boolean;
  readonly held: boolean;
  /** Scheduled reconciliation jobs, not a FIFO of application values. */
  readonly queued: number;
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
type Registration = { readonly read: () => LinkStateView };
type State = {
  nextId: number;
  sequence: number;
  closed: boolean;
  cleanupRegistered: boolean;
  delivering: boolean;
  deliveries: Delivery[];
  links: Map<number, Registration>;
  listeners: Set<Subscription>;
};
const states = new WeakMap<PositionRegistry, State>();
function stateFor(registry: PositionRegistry): State {
  let state = states.get(registry);
  if (!state) {
    state = {
      nextId: 1,
      sequence: 0,
      closed: false,
      cleanupRegistered: false,
      delivering: false,
      deliveries: [],
      links: new Map(),
      listeners: new Set(),
    };
    states.set(registry, state);
  }
  return state;
}
function detach(view: LinkStateView): LinkStateView {
  return {
    ...view,
    positions: [...view.positions],
    directions: { ...view.directions },
  };
}

/** @internal A relationship reports its actual scheduler facts, without values. */
export function registerLinkState(
  registry: PositionRegistry,
  read: (id: number) => LinkStateView
): { publish(kind?: LinkStateEvent['kind']): void; forget(): void } {
  const state = stateFor(registry);
  const id = state.nextId++;
  const registration = { read: () => read(id) };
  if (!state.closed) state.links.set(id, registration);
  let retired = state.closed;
  return {
    forget() {
      retired = true;
      state.links.delete(id);
    },
    publish(kind = 'changed') {
      if (state.closed || retired) return;
      if (kind === 'disposed') {
        retired = true;
        state.links.delete(id);
      }
      const sequence = ++state.sequence;
      // No event allocation or retained payload when nobody is listening.
      if (state.listeners.size === 0) return;
      state.deliveries.push({
        event: {
          treeId: registry.id,
          sequence,
          kind,
          link: detach(registration.read()),
        },
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
    },
  };
}

/**
 * Observe active Link relationships owned by this tree. Reading creates no Link,
 * performs no I/O and grants no mutation authority. Destroyed trees refuse reads.
 */
export function linkStateReader<T, TAccum = unknown>(
  tree: ToolingTree<T, TAccum>
): LinkStateReader {
  const registry = getPositionRegistry(tree.$);
  if (!registry)
    throw new Error('Link observation requires an owned SignalTree.');
  if ((tree.destroyed as () => boolean)()) throw new StudioTreeDestroyedError();
  const state = stateFor(registry);
  if (!state.cleanupRegistered) {
    state.cleanupRegistered = true;
    tree.registerCleanup(() => {
      state.closed = true;
      state.links.clear();
      state.listeners.clear();
      state.deliveries.length = 0;
    });
  }
  const assertLive = () => {
    if (state.closed || (tree.destroyed as () => boolean)())
      throw new StudioTreeDestroyedError();
  };
  return {
    snapshot() {
      assertLive();
      return {
        treeId: registry.id,
        sequence: state.sequence,
        links: [...state.links.values()].map((item) => detach(item.read())),
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
