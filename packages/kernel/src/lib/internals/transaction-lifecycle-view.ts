import type { ISignalTree } from '../types';
import type { ToolingTree } from './tooling-tree';
import { StudioTreeDestroyedError } from './confirmed-turn-view';
import {
  getPositionRegistry,
  type PositionRegistry,
  type TreeId,
} from './position-registry';

export interface PendingTransactionView {
  readonly transactionId: number;
  readonly phase: 'opened' | 'staged';
  /** This operation's deferral scope is closed; other operations may still hold delivery. */
  readonly consequencesReleased: boolean;
}

export interface TransactionLifecycleSnapshot {
  readonly treeId: TreeId;
  readonly sequence: number;
  readonly pending: readonly PendingTransactionView[];
}

export type TransactionRefusalReason =
  | 'later-confirmed-dependency'
  | 'later-pending-dependency'
  | 'effect-validation-failed'
  | 'structural-drift';

type LifecycleFact = { readonly transactionId: number } & (
  | { readonly kind: 'opened' | 'staged' | 'confirmed' | 'rolled-back' }
  | {
      readonly kind: 'refused';
      readonly reason: TransactionRefusalReason;
      readonly pendingRetained: boolean;
      readonly consequencesReleased: boolean;
    }
);

export type TransactionLifecycleObservation = LifecycleFact & {
  readonly treeId: TreeId;
  readonly sequence: number;
  /** State at emission, even when delivery follows a reentrant operation. */
  readonly snapshot: TransactionLifecycleSnapshot;
};

export interface TransactionLifecycleReader {
  snapshot(): TransactionLifecycleSnapshot;
  subscribe(
    listener: (event: TransactionLifecycleObservation) => void
  ): () => void;
}

/**
 * Producer handle. `hold()` lets the owner record a transition (its sequence and
 * emission snapshot) at the state change itself, before its engine announcement
 * runs other owners' callbacks, while public listeners still run afterwards.
 * Transitions recorded during the hold are delivered in order on release.
 */
export interface TransactionLifecyclePublisher {
  (fact: LifecycleFact): void;
  hold(): () => void;
}

type Listener = (event: TransactionLifecycleObservation) => void;
type Subscription = { listener: Listener };
type State = {
  sequence: number;
  closed: boolean;
  delivering: boolean;
  holds: number;
  readPending?: () => readonly PendingTransactionView[];
  listeners: Set<Subscription>;
  deliveries: {
    event: TransactionLifecycleObservation;
    audience: Subscription[];
  }[];
};
const states = new WeakMap<PositionRegistry, State>();
const detach = (
  snapshot: TransactionLifecycleSnapshot
): TransactionLifecycleSnapshot => ({
  ...snapshot,
  pending: snapshot.pending.map((item) => ({ ...item })),
});

/** Producer registration only. Readers never install transaction capability. */
export function installTransactionLifecycleObservation<T>(
  tree: ISignalTree<T>,
  readPending: () => readonly PendingTransactionView[]
): TransactionLifecyclePublisher {
  const registry = getPositionRegistry(tree.$);
  if (!registry) return Object.assign(() => undefined, { hold: () => noop });
  const state: State = {
    sequence: 0,
    closed: false,
    delivering: false,
    holds: 0,
    readPending,
    listeners: new Set(),
    deliveries: [],
  };
  states.set(registry, state);
  tree.registerCleanup(() => {
    state.closed = true;
    state.readPending = undefined;
    state.listeners.clear();
    state.deliveries.length = 0;
  });
  const publish = (fact: LifecycleFact): void => {
    if (state.closed) return;
    const sequence = ++state.sequence;
    if (state.listeners.size === 0) return;
    state.deliveries.push({
      event: {
        ...fact,
        treeId: registry.id,
        sequence,
        snapshot: snapshotOf(registry, state),
      },
      audience: [...state.listeners],
    });
    deliver();
  };
  const hold = (): (() => void) => {
    // Inside delivery the running loop already drains in order.
    if (state.delivering) return noop;
    state.holds++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      state.holds--;
      deliver();
    };
  };
  const deliver = (): void => {
    if (state.delivering || state.holds > 0) return;
    state.delivering = true;
    try {
      for (let i = 0; i < state.deliveries.length; i++) {
        const { event, audience } = state.deliveries[i];
        for (const subscription of audience) {
          if (state.closed || !state.listeners.has(subscription)) continue;
          try {
            subscription.listener({
              ...event,
              snapshot: detach(event.snapshot),
            });
          } catch {
            /* Observation cannot fail settlement. */
          }
        }
      }
    } finally {
      state.deliveries.length = 0;
      state.delivering = false;
    }
  };
  return Object.assign(publish, { hold });
}

const noop = (): void => undefined;

function snapshotOf(
  registry: PositionRegistry,
  state: State
): TransactionLifecycleSnapshot {
  return {
    treeId: registry.id,
    sequence: state.sequence,
    pending: (state.readPending?.() ?? []).map((item) => ({ ...item })),
  };
}

/** Local transaction state, with no retrospective event or payload history. */
export function transactionLifecycleReader<T, TAccum = unknown>(
  tree: ToolingTree<T, TAccum>
): TransactionLifecycleReader | undefined {
  if ((tree.destroyed as () => boolean)()) throw new StudioTreeDestroyedError();
  const registry = getPositionRegistry(tree.$);
  const state = registry && states.get(registry);
  if (!registry || !state) return undefined;
  const assertLive = () => {
    if (state.closed || (tree.destroyed as () => boolean)())
      throw new StudioTreeDestroyedError();
  };
  return {
    snapshot() {
      assertLive();
      return snapshotOf(registry, state);
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
