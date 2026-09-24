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
   * Open an optimistic turn. Returns a handle that confirms or rolls back.
   *
   * A verb, matching `propose()` and the handle's own `confirm()`/`rollback()`.
   */
  transact(fn: () => void): PendingTransaction;
  /**
   * Open a reviewable proposal: the same turn `transact()` opens, named for the
   * multi-writer workflow and given a review projection.
   *
   * Never shipped under another name, so there is no bridge to keep.
   */
  propose(fn: () => void): Proposal;
}

export interface PendingTransaction {
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
// PROPOSAL-0 — a public vocabulary over transaction semantics.
//
// Every member below maps mechanically onto machinery that already shipped:
//
//     proposal()                 -> transaction()
//     inspect()                  -> classify retained effects vs later effects
//     accept()                   -> confirm()
//     reject()                   -> rollback()
//
// Restoration is NOT fused in. `undoable()` stays `undoable()`, wrapped by the
// caller around the proposal's WRITES:
//
//     undoable(() => { proposal = store.proposal(() => applyResult(r)); });
//     ...review...
//     proposal.accept();          // one undo unit
//
// An earlier draft offered `accept({ undoable: true })`. Implementing it proved
// it CANNOT be composition — `undoable()` designates the causal turn containing
// its writes, and a proposal's writes happen at `proposal()` time, so wrapping
// `confirm()` designates nothing. Measured 0 undo entries against 1 for
// wrapping the proposal. The option was deleted rather than kept as a
// placeholder, so this surface is smaller than the one that was frozen.
//
// It adds NO authority rule, NO retained semantic fact and NO proposal-only
// transaction behaviour. That is an evidenced claim, not an intention: the
// whole adversarial matrix was run against the raw primitives BEFORE this
// facade existed (`proposal-0-kernel.spec.ts`), and passed.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether a proposed change still represents current truth.
 *
 * ⚠️ `'current'` means THE PROPOSAL'S CONTRIBUTION still stands — not that the
 * value originally proposed is still present. A structural add stays
 * `'current'` while a later writer changes fields on that same entity, because
 * the row it added is still the row that is there. Render `inspect()` beside
 * ordinary current-state reads, never as a value snapshot.
 */
export type ProposalStatus = 'current' | 'superseded';

/**
 * One proposed change, located by path.
 *
 * Carries no identity token deliberately. Classification uses subject lifetime
 * internally — it must, or a business key reused by a different record would
 * be misread — but `PROPOSAL-REVIEW-SURFACE-0` measured that the RESULT does
 * not need it: two proposals with the same `path` and the same visible value
 * are still told apart by `status` alone.
 */
export type ProposalChange = {
  path: string;
  status: ProposalStatus;
};

export type ProposalInspection = {
  changes: readonly ProposalChange[];
};

/** What `accept()` returns: the settled inspection, closing the read/act race. */
export type ProposalAcceptance = ProposalInspection;

export interface Proposal {
  /**
   * The current review state of each proposed change.
   *
   * Safe to call repeatedly while the proposal is outstanding. After
   * settlement it reports the inspection as of that settlement.
   */
  inspect(): ProposalInspection;
  /**
   * Commit the proposal. Returns the inspection as settled.
   *
   * Does NOT enroll in restoration, and takes no option to. `undoable()`
   * designates the causal turn containing its WRITES, and a proposal's writes
   * happen when `proposal()` runs — so an `accept()`-time flag could only be
   * honoured by retroactively designating a turn, which is a new authority
   * rule this facade exists to avoid. Measured: wrapping `confirm()` alone
   * designates nothing.
   *
   * Restoration stays orthogonal and compositional. Designation declared at
   * proposal time survives an arbitrary review gap:
   *
   * ```ts
   * let proposal!: Proposal;
   * undoable(() => {
   *   proposal = store.proposal(() => applyResult(result));
   * });
   * // ...human reviews for as long as needed...
   * proposal.accept();   // one undo unit
   * ```
   */
  accept(): ProposalAcceptance;
  /**
   * Withdraw the proposal.
   *
   * Throws {@link SignalTreeRollbackError} when the reversal cannot be applied
   * without destroying newer truth. A refusal that could be ignored would be
   * worse than one that cannot.
   */
  reject(): void;
}
/**
 * Optional evidence retention (L15). Correctness records are bounded by live
 * obligation and are NOT configurable; this asks for diagnostic history ON TOP
 * of that, and is opt-in because the reader-visible policy may not change
 * silently.
 */
export type TransactionsConfig = {
  history?: { retain: number };
};
