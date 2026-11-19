# C28 working-source preliminary review

Owner-approved A/B no-write relevance is accepted, not reopened. This is a read-only review of captured working source, not freeze acceptance. PROVISIONAL-IDENTITY.json and provisional-source preserve exact files; initial five-file capture had no concurrent byte change. signal-tree/utils were captured separately for reader-path inspection. No candidate edits/tests and no verdict from other reviewers used.

## 1. Reader-path claim not yet established

SCOPE says fresh branch capture uses the uncached canonical builder. Captured signal-tree.ts:488,1135,2145 still uses unwrap before beginBranchPublicationInput. utils.ts:284–340 uses memoized accessor materialization, or buildFromStore for a backing store whose nested branch values can come from accessor memos. The explicit unwrapBranchForWriteCapture helper exists at346 but is not referenced by these signal-tree sites.

private.suppliedViews:110–111 prefers snapshotViews.get(supplied); registration at125 derives its new association from suppliedViews and therefore reuses an existing certificate for the same object. This correctly avoids simply relabeling an old issued cached object. New NativeView identity on changed certificate also avoids mutating old issued views. But a fresh root/branch updater may still receive nested cached objects with old certificates, so new nativeValues/new view alone does not prove fresh branch acquisition uses the new current certificate. Direct native leaf capture uses current nativeViews and is a different path.

Required discriminator: same saved/cached object before/after certificate handoff, direct leaf capture, root updater and branch updater, and saved supplied-snapshot consumption. Inspect actual certificates where obsolete confirmed roles do not affect public output; preserve old inspection99 behavior. This is a concrete source-wiring discrepancy with the stated plan, not an executed public failure or instruction to force cache invalidation.

## 2. Admission cutoff: unresolved retained evidence is not gated

lifecycle.currentRelevance:160–165 tests cell confirmation and protection, but never nativeRequirementReady(retained). private.prepare calls it for non-exact routes even if the retained contribution has unfinished validation/activation. That is broader than the earlier closed-predecessor-only design and must be justified or narrowed before freeze acceptance.

The straightforward pending-to-confirmed cases have real protection: invocation.inputs retains owners captured pending, even if they confirm during updater execution. prepareNativeRequirement records those owners in every active frame.protectedOwners through installed records. runDeclaration protects explicit handles that are not confirmed at entry. currentRelevance unions current invocation input owners with active frames' protectedOwners. Within a shared still-open horizon, previously installed captured-pending inputs are therefore not automatically lost when now confirmed.

This is not a proof for every unresolved retained predecessor. The classification samples retained/invocation proof now while the transported getter can later observe additional horizon evidence. The fixed relevance mask must not erase a newly relevant current obligation sharing the same cell. Raw contradiction validation still uses unprojected invocation evidence, which is necessary but does not alone prove final transported equivalence. Explicit confirmed handles currently supplied remain in frame validation even when allowed to be irrelevant for final no-write; this matches approved separation rather than being an automatic defect.

Cheapest missing control: unresolved retained contribution across same-horizon reentry/late nonmatching recipient, qi captured pending then confirmed before the next admission, plus a genuinely fresh confirmed validation handle. Check exact protection, error sentinel and later useful delivery. A separate activation-only unresolved predecessor must be identified by a supported path before inventing its oracle. No concrete leak established here; absent readiness gate is a scope/proof gap.

## 3. Relevance-mask lifetime

combineScalarNativeRequirements's projected proof getter closes over parts and relevance. C26 normalizeScalar replaces that getter with a data descriptor and deletes components; this removes those PARTICULAR closure edges after readiness. It computes retirementClassification from unprojected constituents before deletion, preserving the old recursive blocker/qualifying-window meaning. It does not derive retirement permission from shortened roles.

Operation.relevance is explicitly cleared in projectRevision after dependency reconciliation. Unit.relevance is not explicitly cleared in ready/dispose. On the normal path ready removes the Unit from b.pending and resolves its promise; installed completion tokens are weak and completion stacks unwind. The new occurrence authoredRequirement closes over a projected data proof plus unit.native, NOT the Unit/relevance itself. Fact maps hold proofs/requirements, not Units. No persistent completed-Unit root was demonstrated by this trace. Non-cleared field alone is not a leak; any diagnostic must show an actual live root to that Unit/mask. Failed reduction while the unit remains pending is outstanding work and needs error-path qualification, not a guessed completed-work bound.

Require counts/roots that include op.relevance, Unit.relevance, frame.protectedOwners, getter closures by descriptor/source evidence, retirement-summary weak edges and pending registrations. Visible owner-role counts cannot establish reclamation. Unresolved registrations/stack references may legitimately last through synchronous completion/horizon unwind; permanently retaining every completed mask may not.

## 4. Earlier no-write receipt/root

Both prior and effective proofs are compared through the same admission relevance mask. On no-write, the new operation is retired and b.current returns to effective predecessor; the older operation/receipt retains its own finite issued proof and dependencies. That is needed to keep the earlier send attributed correctly. It need not have every obsolete confirmed cell removed immediately.

Occurrence replacement happens BEFORE no-write collapse and uses fresh projected contributions, so current occurrences and the old active operation intentionally have distinct evidence lifetimes. Tests must show repeated no-write invocations do not append masks/dependencies to the old operation, and genuinely new pending qi selects relevant work. Source maps/caches must not repeatedly reintroduce issued histories into future fresh captures. Existing old proof retention is not by itself a failure; unbounded growth of current/active structures from discarded no-write invocations would be.

## Preliminary disposition

Representation, retirement-summary separation and normal mask release have plausible source paths. Reader-path wiring and the missing closed-predecessor scope gate need concrete qualification; neither is declared a reproduced runtime defect. Await author freeze and exact reader/root/error controls. No runtime edits, speculative runs, policy reversal or final acceptance.
