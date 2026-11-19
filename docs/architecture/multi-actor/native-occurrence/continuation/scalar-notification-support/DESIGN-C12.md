# Bounded C12 correction design — for review, not implemented

## Required rule

An uncovered notification may update its accepted observation payload. It is **not an authored support replacement**. For the exact affected scalar contribution, preserve its selected requirement and add observation uncertainty. Derive outgoing eligibility from the complete selected projection, including native dependencies, shared validation, recipient-local obligations, membership guards, and readiness. Only a source-installed authored unit may replace that contribution's support through the existing admission/completion path. A sibling write cannot replace it; an independent declaration cannot certify an old notification.

This fixes the demonstrated failure without removing possible foreign holds, modifying declaration semantics, inventing permission, or changing public APIs. The retained-collection assertion is `sent.at(-1)`, not `tree.$()`; it is a delivery/support discrepancy, not evidence of a new presence regression. It is outside this correction.

## Proposed bounded implementation shape

Target `experimental-publication/private.ts`, principally `project`, with a private helper for conservative observation requirements. No changes proposed to `lifecycle.nativeProof`, declaration validation, native source factories, transaction owner outcomes, or notification coverage semantics.

For each accepted legacy scalar contribution:

1. Keep existing owner-qualified source routing and contribution-local coverage filtering. Keep draining behind installed completion. Resolve the exact scalar field using the existing relative-address trie, or the direct scalar source. Do not substitute the aggregate current revision for the field's revision. Missing field resolution must not silently replace all sibling fields on the scalar-contribution path.
2. Read the **currently selected contribution requirement**, using its completed field/value fact and `factRequirements`, not a fresh physical value, native weak-map reseed, mutable declaration stack, notification metadata, or a reconstructed proof. Include recipient-local obligations already attached to this requirement. A known enrolled field whose selected requirement cannot be recovered is an invariant failure, not a reason to mint initial permission. A genuinely unsupported legacy source may retain the existing unknown baseline behavior.
3. Select `observationRequirement = combine(selectedRequirement, unknownRequirement)`. `unknownRequirement` has unknown=true and no newly invented owners/window. The selected requirement supplies all existing D/I/V/W, invalidation, rejected roles and readiness. Preserve the requirement object as a dependency: snapshotting `nativeProof(selectedRequirement)` is insufficient before validation closes.
4. Make this operation idempotent for repeated notifications without an intervening authored replacement. A private weak cache/mark can reuse the wrapper for an already observation-wrapped requirement; do not recursively grow `[oldWrapper, unknown]` chains per notification. This cache carries no value, revision authority, owner discovery or release permission. New authored requirements naturally select different identities.
5. Install that wrapper for the exact contribution and maintain its field/value fact. An aggregate outgoing fact must be distinct from per-field contribution facts: do not reuse one fact whose `ownProofs` callback is overwritten by the last field installed. For a broad legacy projection affecting several known contributions, conservatively wrap each existing contribution separately, with distinct field facts, retaining membership support. This follows the existing broad-path traversal cost; ordinary point notifications touch one contribution.
6. After updating the payload and contribution support, compute the outgoing fact's proof from `projectionSupport(b).proof` (plus unknown if needed for a source with no enrolled value contribution), and propagate `index.unresolved()`. Apply the same presence masking as ordinary completion. Do not set outgoing `proofs` to the naked `{owners:[],unknown:true,invalid:false}` object. Later readiness recomposition must refer to this outgoing fact and cannot lose its observation uncertainty.
7. Publish/select the outgoing fact only after those changes are coherent. Supersede the prior outgoing revision without erasing surviving contribution requirements. Reuse the existing occurrence-index readiness cancellation, replacement and disposal ownership; do not introduce a separate native-ready listener path.

The two necessary parts are **preserving contribution support** and **recomposing outgoing support**. Doing only the second once is insufficient if the fallback already replaced the invalid field; doing only the first is insufficient if the current outgoing fact still contains the empty generic proof.

## Real authored replacement and release

`ready()` already selects the completed authored unit's source requirement plus its recipient evidence for `unit.field` / direct value. That is the replacement boundary: it replaces the old observation wrapper for that field, rather than permanently unioning old invalidity into every future write. Retain this path and its input/admission checks.

A fresh independent literal write to x after the failed operation may replace x's old failed authorship where native admission permits it. A derive write consuming x retains its actual native/shared obligations. A y-only write leaves x's support intact. An equal literal write is not automatically a no-op in responsibility; retain existing support-only admission/completion behavior. Rejected destinations and rollback-restored endpoints remain selected by the existing native mechanisms, not by notification equality.

When q settles, the captured possible/validation cells become terminal and existing surviving-delivery logic can deliver the selected payload. Invalidity need not be rewritten to false. No new pending-owner scan is added and no foreign possible window is discarded. Disposal must release wrapper subscriptions through the existing index.

## Stale notifications and reentry

- Covered contributions remain skipped individually, including mixed/coalesced notifications. Coverage means participation, not permission.
- Before queueing and again when draining after completion, apply the existing exact-field `scalarContributionIsCurrent` check. A later authored fact on x suppresses an older x contribution; a later y fact must not suppress accepted x work. Do not weaken or bypass that check to make the safety test pass.
- An enrolled native fact is not an authored recipient fact. Its absence from `scalarFacts` currently permits the late-enrollment ping. That acceptance need not be changed to fix safety: the accepted ping must preserve the native requirement rather than downgrade it. Do not blanket-skip all late-enrollment or unknown observations; unchanged protocol controls require useful uncovered updates.
- A queued notification behind `publish:false` cannot read a later live value or force early native readiness. Drain only after exact installed completion; wrap the selected requirement at drain. Re-check freshness there, since intervening reentry may have authored a newer field fact.
- Completion/readiness reentry that installs a newer field requirement replaces/cancels the old occurrence entry using its identity check. A stale callback cannot restore its old entry or supersede the newer current fact. Preserve the ordinary completion `b.current===unit.fact` and predecessor rules.
- The existing numeric notification stamp is sampled by `annotate()` at notification time. It is not a new proof of installation identity. This proposal does **not** claim it solves every possible delayed-stamp ordering case. The bounded reentry discriminator below must check payload order as well as support. If it exposes an ordering ambiguity that the existing contribution protocol cannot resolve, preserve that first failure and stop for a concrete source-issued receipt design; do not guess ordering from value equality, global serials, or latest live state.

## Discriminating controls

Run unchanged, retaining first failures:

1. `native-certificate-successor.spec.ts` scalar parent invalidation case: no send before q settles, exact `{x:7,y:8}` afterward. Membership sibling is the contrasting existing positive control. Do not change the separate missing-readiness fixture to make this group green.
2. `scalar-frame-publication.spec.ts:415-558`: uncovered-first / uncovered-last / sibling payloads, omission must not resurrect a member, `publish:false` completion gating, owner-qualified source isolation. These synthetic notification probes test the internal protocol, not an invented public adapter.
3. Same file's rollback-to-earlier-pending-scalar, equal/support-only inspection adoption, and completion-reentry/install-replay controls. They constrain actual replacement, lifecycle, and once-only completion.
4. `publication-evidence-scope-controls.spec.ts`: declared foreign input survives declaring-link disposal and later invalid independent derive, then useful settlement delivery; cleanup returns registry counts. Do not reinterpret its explicitly unknown foreign-path expectation as permission to erase a known native/shared-validation obligation.

New bounded controls, preserving first sources/assertions:

A. Existing uninstrumented `parent-proof-safety-falsifier.spec.ts`: actual parent independent/dependent contradiction, late child enrollment, independent y. First C12 failure already preserved. Add a separate settlement companion (not an edit to that first fixture) asserting no send while q pending and exactly one correct send after confirmation.
B. Same concrete scenario, then a fresh literal x replacement before q settles: demonstrate useful delivery after x is genuinely reauthored (and unchanged y is clean). Pair with an updater consuming the failed x support, which must remain held/contradict rather than laundering it. One equal-literal variant constrains support-only replacement, subject to existing scalar admission.
C. Native-only possible-window hold: install an ordinary scalar while unrelated q is pending, late-enroll recipient, deliver its uncovered notification. It must retain the captured foreign possible hold and deliver correctly after q terminates. This distinguishes validation retention from blanket invalid-only handling.
D. Queue old x notification, late enroll, then author newer x and y before drain. Assert exact latest payload, no old x replay, retained obligations on any untouched contributor, and no duplicate send. Repeat only the meaningful ordering where completion reentry performs the newer x installation before the queued outer notification drains. Capture actual notification ordering; no fake observer changes in the public-route version.
E. Repeated accepted uncovered observations while x's requirement is unresolved: no send before completion, native invalidation preserved afterward, and dispose releases subscriptions. A private protocol companion may inspect index subscription counts and wrapper identity to reject growing chains or listener leaks; label it private instrumentation.

Acceptance is safety **and** these useful replacement/settlement checks, not merely suppressing sends. Source/spec types required after implementation. No broad suites are proposed at design stage.

## Evidence status

This is a source-reviewed mechanism proposal, not an implemented or tested fix. Previously executed original C11/C12 failures, actual-contradiction falsifier, role traces, and raw commands are in `ORDINARY-NATIVE-FAILURE.md` and adjacent artifacts. The new controls above have not run. Relevant unchanged control sources were inspected; this design turn did not rerun them. No runtime, frozen test, API, budget, or authority changes were made.
