import {
  tryGetTransactionLifecycleChannel,
  type TransactionLifecycleEvent,
} from '../causal-runtime/transaction-lifecycle';
import { getPathNotifier } from '../../path-notifier';

import type { WriteMetadata } from '../../mutation-types';

/**
 * DIAG-JOURNAL-1 — the smallest bounded read-only journal capable of falsifying
 * F3-F7.
 *
 * Deliberately internal, bounded and disposable. No public API, no DevTools
 * surface, no schema commitment: F3-F7 are allowed to delete fields that are not
 * necessary and to expose fields that are.
 *
 * ## The unit is the causal turn (F1, terminal)
 *
 * ```text
 * journal unit           the flush-bounded causal turn
 * transaction lifecycle  CORRELATED protocol facts
 * ```
 *
 * A confirmed transaction happens to align with one causal turn. A rollback is
 * TWO causal turns — the speculative writes, then the compensation — against one
 * lifecycle ending `rolled-back`. So transaction identity cannot define the
 * unit; it correlates with it.
 *
 * ## Lifecycle events NEVER mutate a recorded turn
 *
 * A transaction can be `staged` when its speculative turn is recorded and become
 * `rolled-back` after a DIFFERENT turn exists. Writing that outcome back into the
 * first turn would rewrite what that turn WAS. The two streams are retained
 * separately and share one monotonic sequence, which preserves observed
 * chronology without letting either define the other:
 *
 * ```text
 * seq 21  tx 7 opened
 * seq 22  causal turn — speculative effects, tx 7
 * seq 23  tx 7 staged
 * seq 24  tx 7 rolled-back
 * seq 25  causal turn — compensation
 * ```
 *
 * ## What it may and may not retain
 *
 * Diagnostic values are ordinary observed JS values. The journal may retain them
 * until the corresponding bounded record is evicted; that retention confers no
 * SignalTree ownership and no restoration rights. It never retains signals, tree
 * nodes, turn stores, capture buckets, claim handles, reversal plans, or any
 * closure capable of applying state.
 *
 * Values are retained AS OBSERVED — not cloned. Deep cloning is a separate
 * semantics problem (Date, Map, Set, class instances, cycles, identity-sensitive
 * values) and none of it is needed to answer F3-F7.
 *
 * @internal
 */

export interface DiagnosticEffect {
  readonly path: string;
  readonly ownerPath?: string;
  readonly origin?: WriteMetadata['origin'];
  readonly participation?: WriteMetadata['participation'];
  readonly transactionId?: number;
  readonly subjectIds?: readonly number[];
  readonly positionIds?: readonly number[];
  readonly before?: unknown;
  readonly after?: unknown;
}

export interface DiagnosticTurn {
  readonly sequence: number;
  readonly effects: readonly DiagnosticEffect[];
}

export interface DiagnosticTransactionEvent {
  readonly sequence: number;
  readonly kind: TransactionLifecycleEvent['kind'];
  readonly id: number;
}

export interface DiagnosticJournal {
  turns(): readonly DiagnosticTurn[];
  transactionEvents(): readonly DiagnosticTransactionEvent[];
  dispose(): void;
}

export interface DiagnosticJournalOptions {
  /** Bounded by construction. Oldest turns are evicted first. */
  readonly maxTurns?: number;
  /** Bounded independently: lifecycle events outnumber turns. */
  readonly maxTransactionEvents?: number;
}

const DEFAULT_MAX_TURNS = 50;
const DEFAULT_MAX_EVENTS = 200;

export function createDiagnosticJournal(
  tree: object,
  options: DiagnosticJournalOptions = {}
): DiagnosticJournal {
  const maxTurns = Math.max(1, options.maxTurns ?? DEFAULT_MAX_TURNS);
  const maxEvents = Math.max(
    1,
    options.maxTransactionEvents ?? DEFAULT_MAX_EVENTS
  );

  const turns: DiagnosticTurn[] = [];
  const events: DiagnosticTransactionEvent[] = [];
  let sequence = 0;
  let open: DiagnosticEffect[] | null = null;
  let disposed = false;

  const notifier = getPathNotifier();

  const offWrite = notifier.subscribe(
    '**',
    (next, prev, path, ownerPath, origin, subjectIds, positionIds, meta) => {
      if (disposed) return;
      const m = (meta ?? {}) as WriteMetadata;
      (open ??= []).push({
        path,
        ownerPath,
        origin: (origin as WriteMetadata['origin']) ?? m.origin,
        participation: m.participation,
        transactionId:
          typeof m.transactionId === 'number' ? m.transactionId : undefined,
        subjectIds,
        positionIds,
        before: prev,
        after: next,
      });
    }
  );

  // The engine's own boundary (DIAG-JOURNAL-0 case 8), not a finer one invented
  // here.
  const offFlush = notifier.onFlush?.(() => {
    if (disposed || !open) return;
    turns.push({ sequence: sequence++, effects: open });
    open = null;
    while (turns.length > maxTurns) turns.shift();
  });

  // OBSERVER side: resolve, never install. A tree with no transaction owner is a
  // legitimate journal target.
  const offLifecycle = tryGetTransactionLifecycleChannel(tree)?.subscribe(
    (event) => {
      if (disposed) return;
      events.push({ sequence: sequence++, kind: event.kind, id: event.id });
      while (events.length > maxEvents) events.shift();
    }
  );

  return {
    turns: () => turns,
    transactionEvents: () => events,
    dispose() {
      if (disposed) return;
      disposed = true;
      offWrite();
      offFlush?.();
      offLifecycle?.();
      turns.length = 0;
      events.length = 0;
      open = null;
    },
  };
}
