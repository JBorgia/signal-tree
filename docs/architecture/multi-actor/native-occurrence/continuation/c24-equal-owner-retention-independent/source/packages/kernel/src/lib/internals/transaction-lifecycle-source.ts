/**
 * Production seam for transaction lifecycle OBSERVATION (read-only tooling).
 *
 *     A DORMANT CAPABILITY IMPOSES NO ACTIVE-STATE MACHINERY.
 *
 * The transactions runtime keeps its own per-transaction phase record and a
 * transition count (it needs both to answer a reader that attaches late), and
 * calls an observer that is `undefined` until `transactionLifecycleReader`
 * (from `@signal-tree/kernel/internals`) first attaches. Event construction,
 * snapshots, holds, queueing and delivery live in
 * `transaction-lifecycle-view.ts`, bundled only when imported.
 */
import type { TreeId } from './position-registry';

/** One transition, as the owner states it. `error` is the refusal it threw. */
export type TransactionLifecycleFact = { readonly transactionId: number } & (
  | { readonly kind: 'opened' | 'staged' | 'confirmed' | 'rolled-back' }
  | { readonly kind: 'refused'; readonly error: unknown }
);

export interface TransactionLifecycleObserver {
  /** Called at the transition itself, before other owners' callbacks run. */
  record(fact: TransactionLifecycleFact): void;
  /** Defer public delivery; transitions recorded meanwhile keep their order. */
  hold(): () => void;
}

export interface PendingTransactionFacts {
  readonly transactionId: number;
  readonly phase: 'opened' | 'staged';
  readonly consequencesReleased: boolean;
}

export interface TransactionLifecycleSource {
  readonly treeId: TreeId;
  /** Current transition count and pending transactions, as the owner holds them. */
  read(): { sequence: number; pending: PendingTransactionFacts[] };
  attach(observer: TransactionLifecycleObserver): void;
}

const SOURCES = new WeakMap<object, TransactionLifecycleSource>();

/** @internal The transactions runtime registers its source under its registry. */
export function defineTransactionLifecycleSource(
  registry: object,
  source: TransactionLifecycleSource
): void {
  SOURCES.set(registry, source);
}

export function getTransactionLifecycleSource(
  registry: object
): TransactionLifecycleSource | undefined {
  return SOURCES.get(registry);
}
