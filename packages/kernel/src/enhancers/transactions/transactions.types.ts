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
  transaction(fn: () => void): PendingTransaction;
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

/**
 * Optional evidence retention (L15). Correctness records are bounded by live
 * obligation and are NOT configurable; this asks for diagnostic history ON TOP
 * of that, and is opt-in because the reader-visible policy may not change
 * silently.
 */
export type TransactionsConfig = {
  history?: { retain: number };
};
