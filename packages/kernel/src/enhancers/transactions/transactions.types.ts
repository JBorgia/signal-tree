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

export interface TransactionMethods {
  /**
   * Open an optimistic turn. Returns a handle that inspects, confirms or rolls
   * back.
   *
   * A verb, matching the handle's own `confirm()` / `rollback()`, and the verb
   * form of the noun the glossary already teaches.
   */
  transact(fn: () => void): PendingTransaction;
}

export interface PendingTransaction {
  /**
   * The current review state of each change this turn made.
   *
   * Safe to call repeatedly while the turn is outstanding. After settlement it
   * reports the inspection as of that settlement — `confirm()` and `rollback()`
   * snapshot before they act, which is the race `inspect()` alone cannot close.
   *
   * Available on EVERY handle. It was briefly reachable only through a second
   * entry verb, which was an arbitrary restriction: nothing about inspection
   * depends on how the turn was opened.
   */
  inspect(): TransactionInspection;
  confirm(): void;
  /**
   * Rolls back the pending optimistic transaction.
   *
   * Throws {@link SignalTreeRollbackError} when SignalTree cannot remove the
   * transaction conservatively without risking later valid work.
   */
  rollback(): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPOSAL-0 — the review projection, folded into the one transaction verb.
//
// This row asked whether reviewing unapproved work needs its own semantics. It
// does NOT: every member mapped mechanically onto machinery that already
// shipped, and the only thing that survives as public surface is `inspect()`.
//
//     propose()                 -> transact()      (one verb, folded)
//     inspect()                  -> KEPT, on every PendingTransaction
//     accept()                   -> confirm()
//     reject()                   -> rollback()
//
// The parallel vocabulary was REMOVED before 16.0 shipped. AGENTS.md binds
// public naming to the glossary's Everyday vocabulary, which defines
// `transaction` and `rollback` and never defines propose/accept/reject — so a
// second name for every operation was a fourth vocabulary the project had not
// agreed to teach. The capability is unchanged; only the naming is.
//
// Restoration is NOT fused in. `undoable()` stays `undoable()`, wrapped by the
// caller around the pending's WRITES:
//
//     undoable(() => { pending = store.transact(() => applyResult(r)); });
//     ...review...
//     pending.confirm();          // one undo unit
//
// An earlier draft offered `accept({ undoable: true })`. Implementing it proved
// it CANNOT be composition — `undoable()` designates the causal turn containing
// its writes, and a proposal's writes happened at `propose()` time, so wrapping
// `confirm()` designates nothing. Measured 0 undo entries against 1 for
// wrapping the pending. The option was deleted rather than kept as a
// placeholder, so this surface is smaller than the one that was frozen.
//
// It adds NO authority rule, NO retained semantic fact and NO pending-only
// transaction behaviour. That is an evidenced claim, not an intention: the
// whole adversarial matrix was run against the raw primitives BEFORE this
// facade existed (`proposal-0-kernel.spec.ts`), and passed.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether a change this turn made still represents current truth.
 *
 * ⚠️ `'current'` means THIS TURN'S CONTRIBUTION still stands — not that the
 * value it originally wrote is still present. A structural add stays
 * `'current'` while a later writer changes fields on that same entity, because
 * the row it added is still the row that is there. Render `inspect()` beside
 * ordinary current-state reads, never as a value snapshot.
 */
export type ChangeStatus = 'current' | 'superseded';

/**
 * One change a turn made, described by a display path and review status.
 *
 * Classification distinguishes entity lifetimes internally. The public path
 * is not a unique address: a literal key containing a dot can have the same
 * display path as nested fields. Status does not resolve that ambiguity.
 * Map changes to ordinary state reads using application knowledge; splitting
 * this string on dots is not a general-purpose resolver.
 */
export type InspectedChange = {
  /**
   * Human-readable location. PRESENTATION ONLY, and deliberately ambiguous:
   * a literal key `'a.b'` and the nested path `a.b` both render as `"a.b"`.
   * Use it for display; never to identify which location changed.
   */
  path: string;
  /**
   * Lossless typed address — the segments that actually identify the location.
   * `['a.b']` and `['a','b']` are different places and read differently here,
   * which is what lets a reviewer be told the truth about what an agent
   * changed (law L17: human-readable paths are presentation, never identity).
   *
   * `undefined` when the position cannot be resolved to an address, reported
   * rather than guessed.
   */
  address: readonly string[] | undefined;
  /**
   * Subject identity when this location belongs to an entity subject. A reused
   * business key is a DIFFERENT subject, so this distinguishes "the agent
   * edited the row that is there now" from "the agent edited the row that used
   * to be there" (law L7).
   */
  subject?: number;
  status: ChangeStatus;
};

export type TransactionInspection = {
  changes: readonly InspectedChange[];
};

/**
 * Optional evidence retention (L15). Correctness records are bounded by live
 * obligation and are NOT configurable; this asks for diagnostic history ON TOP
 * of that, and is opt-in because the reader-visible policy may not change
 * silently.
 */
export type TransactionsConfig = {
  history?: { retain: number };
};
