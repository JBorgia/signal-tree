import type { NodeAccessor } from '../../lib/node-accessor';
import { Assert, Equals } from '../test-helpers/types-equals';
import { restoration, RestorationConfig } from './restoration';

import type {
  Enhancer,
} from '../../lib/types';

/**
 * `restoration()` returns the NEUTRAL enhancer contract.
 *
 * This asserted the realization-facing shape,
 * `(config?) => <T>(tree: ISignalTree<T>) => ISignalTree<T> & RestorationMethods`.
 * That was the implementation vocabulary, and migrating to `Enhancer<TAdded>`
 * is exactly what changed it — so the row went red and was updated
 * deliberately, not worked around.
 *
 * This file does NOT stand in for the consumer contract. Asserting
 * `restoration`'s own declared shape says nothing about whether a call site
 * still gets `RestorationHistoryEntry<AppState>[]` out of `getRestorationHistory()` — which is the
 * one property this migration could plausibly have broken, since the state is
 * recovered from polymorphic `this` and `EnhancerHost` is not a `NodeAccessor`.
 * That is `restoration-contract.typing.spec.ts`, proven green BEFORE this
 * signature changed and re-run unchanged afterwards.
 */
type ExpectedSignature = (config?: RestorationConfig) => Enhancer<RestorationMethods>;

type ActualSignature = typeof restoration;

type _ContractCheck = Assert<Equals<ActualSignature, ExpectedSignature>>;

// .with() preserves accumulated types via `this & TAdded` pattern.

export {};


// ─────────────────────────────────────────────────────────────────────────────
// MOVED HERE IN 15.0 — TYPE-BARREL-CONVERGENCE-0.
//
// These declarations lived in `lib/types.ts`, the KERNEL type barrel, even
// though this module owns them. That was co-location, not duplicate authority:
// `ISignalTree` never named a capability method bag, so the kernel type surface
// did not statically own optional machinery. The move corrects placement only —
// no rename, no semantic change, and the package root still re-exports every
// one of them from here.
//
//     A PUBLIC RE-EXPORT MAY SURVIVE A MOVE. A SECOND DECLARATION MAY NOT.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `RestorationMethods` deliberately does NOT extend `TransactionMethods` (15.0,
 * TX-SURFACE-0).
 *
 * `restoration()` used to ship its own `transaction()` — a second implementation
 * of a concept `transactions()` already owns and the README already documented
 * as belonging there, reaching the public surface silently through an interface
 * extension. It was also the incorrect one: its rollback dependency check read
 * the restoration history rather than its own captured effects, so under opt-in
 * eligibility it stopped refusing unsafe rollbacks. It looked correct only
 * because the old default admitted every authored write to that history.
 *
 * The capabilities compose, which is why deletion was cheaper than repair:
 *
 *   transactions()  groups authored work, owns rollback, announces lifecycle
 *   undoable()      admits the resulting causal turn
 *   restoration()    observes that lifecycle and restores admitted turns
 *
 * Install `transactions()` for a transaction boundary. There is no shim, and
 * re-adding one via another interface extension would recreate the duplication —
 * see the negative typing test in `tx-ownership.typing.spec.ts`.
 */
export interface RestorationMethods {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  getRestorationHistory(): RestorationHistoryEntry<
    this extends NodeAccessor<infer S> ? S : never
  >[];
  resetRestorationHistory(): void;
  jumpTo(index: number): void;
  getCurrentIndex(): number;
  // `pauseRecording()` / `resumeRecording()` / `isRecordingPaused()` were
  // REMOVED in 14.1.1. They could not express "one undo step", only "record
  // nothing" — so the documented recipe needed a synthetic sealing write landing
  // on an invented domain field, and an earlier revision of that guide shipped
  // the destructive version without it. Worse, pause was a GLOBAL mode: an
  // unrelated write inside the window was suppressed too, so correctness needed
  // sole ownership of the tree for its duration. A `for` loop has that; a
  // multi-second `mergeMap` over N requests does not.
  //
  // The replacement is a transaction handle — see
  // docs/architecture/history-the-greenfield-target.md.
  /** Internal restoration manager exposed for advanced tooling/debugging */
  readonly __restoration?: {
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    // `unknown`: this is an inline property type, so `this` is the enclosing
    // interface rather than the tree. Internal tooling surface — state
    // precision belongs on the public getRestorationHistory().
    getRestorationHistory(): RestorationHistoryEntry<unknown>[];
    resetRestorationHistory(): void;
    jumpTo(index: number): void;
    getCurrentIndex(): number;
  };
}

export interface RestorationHistoryEntry<T> {
  action: string;
  timestamp: number;
  state: T;
  payload?: unknown;
}
