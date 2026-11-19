# Exact private interface for joint merge

Against frozen C1-derived candidate, runtime changes exactly:

- experimental-publication/lifecycle.ts: readonly optional NativeRequirement.retirementOwnWindowOnly; ownerCellCanTransition(cell):boolean; onOwnerCellTransition(cell,callback):()=>void; notifications after ownerWake on terminal ownerTransition and during abandonOwnerSource. One module-local WeakMap keyed by exact OwnerCell stores observer sets. Cancellation needs the blocker correction in REVIEW.md before accepting this interface.
- experimental-publication/entity.ts: prepareRetirement(subject) returns ready/canRetire/current/onReady and optional onSettlement. It snapshots fields/members/placements/views/visible/placementViews/mappings/mappingViews, recursively evaluates constituents and collects exact live W cells only if all requirements are otherwise releasable. No source requirement mutation.
- internals/entity-publication.ts: EntityRetirementPlan.neutral renamed canRetire; optional onSettlement(callback):()=>void. Existing scheduler waits on onReady first, then onSettlement only when provided, otherwise drops a permanently ineligible request. Normal exact-subject/current-revision/installed-forget guards remain.

For phase integration, compute the provenance bit from the ORIGINAL known/unknown/inputs/active-frame preparation arguments. Never reconstruct it from finalized/cleared arrays or a compacted unknown bit, and never synthesize it from combined proofs. Composite requirements retain constituent provenance.

Do not equate native readiness with owner settlement. Do not activate settlement subscriptions during sealing. Preserve queued processing after installed synchronous completions and reentry; whichever merged readiness boundary is chosen must guarantee installed/validated source evidence. Keep receipt/native proof construction and window sampling unchanged. Availability false is not terminal outcome; abandoned/unavailable cells are not confirmed/rolled-back.

The source requestRetirement(subject,eligible) contract is unchanged: existing trusted installed-forget producer supplies exact lifetime eligibility. Neither new lifecycle export grants permission to forget a live/recoverable subject. No public barrels change. Merging with packet admission or phase experiments requires resolving these exact shared file sites in a fresh combined candidate and revalidating; this independent review does not qualify that combination.
