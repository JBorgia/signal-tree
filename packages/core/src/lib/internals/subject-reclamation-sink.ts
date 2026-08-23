import {
  getSubjectRestorationClaims,
  type SubjectRestorationClaims,
} from './subject-restoration-claims';

/**
 * THE RECLAMATION SINK — where a released claim becomes freed memory.
 *
 * `SubjectRestorationClaims` answers "does anything still need this?".
 * This answers "then actually let it go", and it is the only place in the
 * library that acts destructively on a restoration decision.
 *
 * ## Why it BROADCASTS instead of routing
 *
 * Subject ids are COLLECTION-scoped: `StructuralStore` is constructed once per
 * `entityMap` and starts `nextSubjectId` at 1, so a tree with two collections
 * has two different subjects called 1. Phase 6A measured that and established
 * that collapsing them in a tree-scoped registry is safe — merging can only ADD
 * owners to a number, never remove one — but that when a number finally goes
 * unowned, BOTH collections may still hold their own retired subject under it.
 *
 * A `Map<subjectId, PhysicalOwner>` would therefore pick one owner and leak the
 * other. Every unowned number goes to every registered owner, and each owner
 * answers for itself: do I hold this subject, is it tombstoned, does it still
 * have backing. `__prepareSubjectReclamation` returning `undefined` is a normal
 * "not mine", not an error.
 *
 * ## The last-owner rule is enforced HERE, not at the call site
 *
 * `release()` reports what THAT owner let go. Another system may still hold the
 * same subject — a pending transaction, another history entry — so the sink
 * re-asks the registry before acting. A caller that had to remember to do this
 * would eventually forget.
 */
export interface SubjectPhysicalOwner {
  __listSubjectReclamationCandidates(): readonly number[];
  __prepareSubjectReclamation(
    subjectId: number,
    options: { causallyEligible: boolean; reclaimLifetimeRecord?: boolean }
  ): unknown;
  __applyPreparedSubjectReclamation(prepared: unknown): void;
}

export interface SubjectReclamationSink {
  /**
   * Offer subjects whose last restoration claim has been released.
   *
   * Returns how many were actually reclaimed, which is what the retention
   * gates assert on — a sink that silently reclaims nothing looks exactly like
   * a sink that is not wired.
   */
  offerUnclaimed(subjectIds: readonly number[]): number;
  /** Registered owner count, for diagnostics and for the boundary tests. */
  ownerCount(): number;
}

export function createSubjectReclamationSink(
  claims: SubjectRestorationClaims,
  owners: readonly SubjectPhysicalOwner[]
): SubjectReclamationSink {
  return {
    offerUnclaimed(subjectIds) {
      if (subjectIds.length === 0 || owners.length === 0) {
        return 0;
      }
      let reclaimed = 0;
      for (const subjectId of subjectIds) {
        // THE LAST-OWNER RULE. The caller released ITS claim; someone else may
        // still hold one, and freeing here would be the data loss Phase 6B
        // measured — a pending rollback that throws and loses the row.
        if (claims.isClaimed(subjectId)) {
          continue;
        }
        for (const owner of owners) {
          const prepared = owner.__prepareSubjectReclamation(subjectId, {
            // Sound because the registry IS the causal authority for this
            // subject: the Phase 2 oracle established that the claim set names
            // every retired subject a legal traversal can resurrect, and the
            // check above establishes that nothing names this one. It is NOT a
            // way to skip `assessReclamationEligibility` where a TurnStore
            // exists — a transaction registers its own claim for exactly that
            // reason, so the `isClaimed` check above already covers it.
            causallyEligible: true,
            // The claim check above IS the establishment this needs: nothing
            // can restore this subject, so its lifetime record can go too.
            // Without this the sink frees the value bytes and leaves the
            // ledger, which is the half that grows with total churn.
            reclaimLifetimeRecord: true,
          });
          if (prepared === undefined) {
            // Not this owner's subject, or nothing left to reclaim. Both are
            // ordinary in a broadcast.
            continue;
          }
          owner.__applyPreparedSubjectReclamation(prepared);
          reclaimed += 1;
        }
      }
      return reclaimed;
    },

    ownerCount() {
      return owners.length;
    },
  };
}

/**
 * Where `signalTree` leaves the entity collections that can reclaim.
 *
 * Resolved by name rather than imported, because `signal-tree.ts` is the bare
 * bundle's entry point and an import edge to this module would ship the sink to
 * every tree, including ones that can never restore.
 */
const SUBJECT_PHYSICAL_OWNERS_SYMBOL = Symbol.for(
  'SignalTree:SubjectPhysicalOwners'
);

const SUBJECT_RECLAMATION_SINK_SYMBOL = Symbol.for(
  // `SignalTree:` prefix REQUIRED — `unwrap()` walks
  // `Object.getOwnPropertySymbols`, which returns non-enumerable symbols too,
  // and skips brands by this prefix. A symbol named anything else lands in
  // every snapshot the tree produces.
  'SignalTree:SubjectReclamationSink'
);

/**
 * Resolve the tree's sink, creating it on first use.
 *
 * Lazy and installed on `$` for the same two reasons the claim registry is:
 * a tree with no restoration authority must not pay for it in the bare bundle,
 * and enhancers hand back a wrapper, so a symbol on the outer object is not the
 * object the next enhancer sees.
 *
 * Returns `undefined` only when there is nowhere to install it, which means
 * there is no tree and therefore nothing to reclaim.
 */
export function getOrCreateSubjectReclamationSink(
  node: unknown
): SubjectReclamationSink | undefined {
  const host = ((node as { $?: unknown } | null)?.$ ?? node) as object | null;
  if (host === null || typeof host !== 'object') {
    return undefined;
  }
  const existing = (
    host as Record<symbol, SubjectReclamationSink | undefined>
  )[SUBJECT_RECLAMATION_SINK_SYMBOL];
  if (existing) {
    return existing;
  }
  const claims = getSubjectRestorationClaims(node);
  if (!claims) {
    // No claim registry means no restoration authority has ever run on this
    // tree, so there is no released-claim event for a sink to consume. The
    // retirement boundary's zero-owner path already covers that tree.
    return undefined;
  }
  const owners =
    ((host as Record<symbol, unknown>)[SUBJECT_PHYSICAL_OWNERS_SYMBOL] as
      | SubjectPhysicalOwner[]
      | undefined) ?? [];
  const sink = createSubjectReclamationSink(claims, owners);
  Object.defineProperty(host, SUBJECT_RECLAMATION_SINK_SYMBOL, {
    value: sink,
    enumerable: false,
    configurable: true,
  });
  return sink;
}
