import { SignalTreeRollbackError, type CarrierKind } from '../types';
import { isToolingTreeDestroyed, type ToolingTree } from './tooling-tree';
import { StudioTreeDestroyedError } from './confirmed-turn-view';
import { getPositionRegistry, type TreeId } from './position-registry';
import {
  getTransactionLifecycleSource,
  type TransactionLifecycleFact,
  type TransactionLifecycleObserver,
  type TransactionLifecycleSource,
} from './transaction-lifecycle-source';

export interface PendingTransactionView {
  readonly transactionId: number;
  /**
   * The last lifecycle transition the transaction owner announced: `opened`
   * while the callback runs, `staged` once its contribution is complete. A
   * transaction whose callback threw is never staged, so a refused automatic
   * compensation that keeps it pending (with a recovery handle) stays `opened`.
   */
  readonly phase: 'opened' | 'staged';
  /**
   * Whether this transaction's commit scope has been settled, releasing (or
   * discarding) its deferred consequences. Read from the scope, not inferred
   * from a refusal: v16 keeps the scope open while authority stays pending.
   * Other operations may still hold delivery.
   */
  readonly consequencesReleased: boolean;
}

export interface TransactionLifecycleSnapshot {
  readonly treeId: TreeId;
  readonly sequence: number;
  readonly pending: readonly PendingTransactionView[];
}

/**
 * The owner's own refusal classification (`RollbackFailureCause['kind']`).
 * A reader reports it; it never refines or invents one. Validation refusals,
 * including realization `structural-drift`, are `effect-validation-failed`.
 */
export type TransactionRefusalReason =
  | 'later-confirmed-dependency'
  | 'effect-validation-failed';

export type TransactionLifecycleObservation = {
  readonly transactionId: number;
} & (
  | { readonly kind: 'opened' | 'staged' | 'confirmed' | 'rolled-back' }
  | {
      readonly kind: 'refused';
      readonly reason: TransactionRefusalReason;
      /** The transaction is still pending and settleable after the refusal. */
      readonly pendingRetained: boolean;
      readonly consequencesReleased: boolean;
    }
) & {
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

type Listener = (event: TransactionLifecycleObservation) => void;
type Subscription = { listener: Listener };
type State = {
  closed: boolean;
  delivering: boolean;
  holds: number;
  listeners: Set<Subscription>;
  deliveries: {
    event: TransactionLifecycleObservation;
    audience: Subscription[];
  }[];
};
const states = new WeakMap<object, State>();
const noop = (): void => undefined;
const detach = (
  snapshot: TransactionLifecycleSnapshot
): TransactionLifecycleSnapshot => ({
  ...snapshot,
  pending: snapshot.pending.map((item) => ({ ...item })),
});

function snapshotOf(
  source: TransactionLifecycleSource
): TransactionLifecycleSnapshot {
  const { sequence, pending } = source.read();
  return {
    treeId: source.treeId,
    sequence,
    pending: pending.map((item) => ({ ...item })),
  };
}

/** The owner's own classification of the refusal it threw; never refined. */
function reasonOf(error: unknown): TransactionRefusalReason {
  const kind =
    error instanceof SignalTreeRollbackError
      ? ((error as { cause?: { kind?: unknown } }).cause?.kind as unknown)
      : undefined;
  return kind === 'later-confirmed-dependency'
    ? kind
    : 'effect-validation-failed';
}

function deliver(state: State): void {
  if (state.delivering || state.holds > 0) return;
  state.delivering = true;
  try {
    for (let i = 0; i < state.deliveries.length; i++) {
      const { event, audience } = state.deliveries[i];
      for (const subscription of audience) {
        if (state.closed || !state.listeners.has(subscription)) continue;
        try {
          subscription.listener({ ...event, snapshot: detach(event.snapshot) });
        } catch {
          /* Observation cannot fail settlement. */
        }
      }
    }
  } finally {
    state.deliveries.length = 0;
    state.delivering = false;
  }
}

/** Attach the single per-tree observer to the owner's source. */
function observe(
  source: TransactionLifecycleSource,
  state: State
): TransactionLifecycleObserver {
  return {
    record(fact: TransactionLifecycleFact): void {
      // No event allocation or retained snapshot when nobody is listening.
      if (state.closed || state.listeners.size === 0) return;
      // The owner has already counted this transition: the snapshot is the
      // state at the transition, sequence included.
      const snapshot = snapshotOf(source);
      let event: TransactionLifecycleObservation;
      if (fact.kind === 'refused') {
        const retained = snapshot.pending.find(
          (item) => item.transactionId === fact.transactionId
        );
        event = {
          kind: 'refused',
          transactionId: fact.transactionId,
          reason: reasonOf(fact.error),
          pendingRetained: retained !== undefined,
          consequencesReleased: !!retained?.consequencesReleased,
          treeId: snapshot.treeId,
          sequence: snapshot.sequence,
          snapshot,
        };
      } else {
        event = {
          kind: fact.kind,
          transactionId: fact.transactionId,
          treeId: snapshot.treeId,
          sequence: snapshot.sequence,
          snapshot,
        };
      }
      state.deliveries.push({ event, audience: [...state.listeners] });
      deliver(state);
    },
    hold(): () => void {
      // Inside delivery the running loop already drains in order.
      if (state.delivering) return noop;
      state.holds++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        state.holds--;
        deliver(state);
      };
    },
  };
}

/**
 * Local transaction state, with no retrospective event or payload history.
 * `undefined` when the tree was built without `transactions()`; reading never
 * installs it.
 */
export function transactionLifecycleReader<
  T,
  C extends CarrierKind = CarrierKind,
  TAccum = unknown
>(tree: ToolingTree<T, C, TAccum>): TransactionLifecycleReader | undefined {
  if (isToolingTreeDestroyed(tree)) throw new StudioTreeDestroyedError();
  const registry = getPositionRegistry(tree.$);
  const source = registry && getTransactionLifecycleSource(registry);
  if (!registry || !source) return undefined;
  let existing = states.get(registry);
  if (!existing) {
    const state: State = {
      closed: false,
      delivering: false,
      holds: 0,
      listeners: new Set(),
      deliveries: [],
    };
    existing = state;
    states.set(registry, state);
    source.attach(observe(source, state));
    tree.registerCleanup(() => {
      state.closed = true;
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
      return snapshotOf(source);
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
