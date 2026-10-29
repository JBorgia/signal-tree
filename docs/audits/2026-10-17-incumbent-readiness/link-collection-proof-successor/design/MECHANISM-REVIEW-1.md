# Independent mechanism review — collection proof draft 1

2026-10-29. Read-only review of frozen source `75416029be1e0c1d9735ed3bdc0f4e8e6c02f775` in `/private/tmp/link-authored-removal-successor`. Working tree was clean. No tests or suites run, no runtime/controller edits, and no other reviewer verdict read.

Reviewed input SHA-256:

- `DESIGN-DRAFT-1.md`: `8fac8827b73769c852a7745e17471b3fa17d1e9d492cbd2c1e60c9d419231a76`
- `SOURCE-MAP.md`: `141d83fe7605b0d31e1ea22f3ff65114a2c54c9d8a3c74fe7d0975cdf1cb430d`

## Disposition

The central mechanism is implementable under the existing private authority: the existing egress reducer can emit contributor edits alongside its payload selection, and the existing combined terminal-record path can install those edits atomically with payload. This does not require another row store, a new settlement selector, or a caller-specific adapter.

Draft 1 does not yet specify a complete runtime successor. The missing items below are concrete contracts at existing seams, not reasons to reopen the product requirement. Resolve items 1–4 before treating the core plan as implementation-complete. Items 5–6 are explicitly separate dependencies of the approved full route; the core mechanism cannot supply their acceptance by implication. A bounded implementation of the core can be coherent while those dependencies remain gated, but it cannot be described as the complete qualified route.

Frozen premise at `3c8bbaff`: “Completeness covers all inputs to newly authored facts. Untouched contributing facts retain their own support: a declaration can be valid while the resulting projection and its receipt remain held.” Observable consequence: completing the author of one changed field cannot publish a collection whose selected membership, another field, placement or captured input remains held. Declaration admission and delivery eligibility therefore must remain distinct.

## Required specifications

### 1. Define the prepared evidence resolver, including adopted facts and mapping decisions

`experimental-publication/entity.ts:39–116` prepares a native requirement and exposes only `requirement` plus `support(subject, field)`. That support merges current source ordinary maps; it does not identify the evidence for each fact selected by a recipient. Rekeys are skipped at lines 63 and 77. Physical correspondence uses the first matching subject at line 85, despite the ordered step protocol in `internals/entity-publication.ts:13–25`.

The concrete discriminator is an inspection-created row with two fields followed by an authored update to one field. `internals/entity-egress-projection.ts:263–280` adopts the whole row. Selecting the new authored requirement for both fields would certify the untouched inspection value; selecting source ordinary support can omit it. Similarly, `reconcileAddress:148–156` can evict an eligible old lifetime because physical occupancy changed. That decision consumes evidence even though the evicted row contributes no output value.

Specify the prepared resolver's address and result: source/lifetime/dimension, step or exact selected fact identity where necessary, ordinary versus physical certificate, and explicit unavailable evidence. Specify the evidence consumed by collision/occupancy and placement decisions. Preserve exact physical/semantic step association rather than first-subject lookup. Sharing one requirement across facts authored by the same unit is fine; this finding does not require a new requirement object for every field. What must remain exact is which fact that requirement certifies and which pre-existing requirements are retained.

This is a source-backed gap, not a newly executed failure. It is a private metadata extension permitted by the draft's authority. Adding one whole-collection fact to `completedValueFact` cannot substitute for it.

### 2. Make order-only authorship and proof-only replacement explicit revision producers

`link.ts:595–599` decides whether to prepare a receipt solely from semantic edits. A packet with `ordinaryOrder` but no edits can change `projection.prepare(packet)` and install a dirty payload without a new receipt. The fallback order listener at `link.ts:1059–1085` separately mutates the projection inside a microtask. A check of the previously installed binding revision is insufficient for either route.

Specify that every participating order producer first prepares its exact eligible order domain and proof edits, then installs the resulting payload/proof revision before it can dirty or enqueue output. Identify which legacy listener path remains and how it consumes that revision rather than authoring another unproved one. Keep payload-change, support-change and authored-domain membership distinct: `reorder` returning false establishes only unchanged arrangement, not that all proof edits are absent.

The existing reducer at `entity-egress-projection.ts:204–223` deliberately preserves eligible lifetimes excluded from `afterSubjects`. Retaining their contributors while replacing only the authored domain is feasible. Neither source-wide placement replacement nor array equality supplies this contract. This is source inspection; the preserved logs do not establish this newly proposed discriminator as passing.

### 3. Define initialization and authoritative acquisition as coherent payload/proof snapshots

`internals/entity-projection-seed.ts` carries only lifetime, key and row. It contains no provenance or source revision. Native maps may also be absent for initially existing facts. `link.ts:525–543` sets `eligible` before applying external truth and then reseeds from the post-write source. Simply adding a later proof read can combine different revisions if applying that truth throws or reenters.

Specify the existing baseline authority for initially ordinary facts, the explicit certificate for inspection-only seed facts, and inheritance of already-pending native facts. Missing map entries cannot indiscriminately mean either clean initial support or permanently unknown support. Specify when seed identity and evidence are captured, the source/recipient revision check, and the install/abort behavior around inbound application. A failed or reentrant acquisition must not pair one payload with another acquisition's evidence. No recipient enrollment may rewrite native evidence or enlarge an already captured owner window.

These are implementation details derivable from the approved relationship baseline and external-acquisition rules; the review finds no need for a new public declaration API or a new rule that ingress confirms unrelated native owners. The draft currently promises the boundary without specifying its realization.

### 4. State finalization and invalidation ordering for the new summaries

The existing source prepares native and recipient units, checks enrollment revision, combines terminal records, and finalizes before installation (`entity-publication.ts:81–96`). Native requirements acquire their fixed window in `lifecycle.ts:108–117`; validation frames can remain unresolved after installation. Contributor summaries cannot permanently cache a pre-finalization empty owner set or flatten distinct D/I/W/V roles into a single owner count.

Specify that prepared contributor entries retain requirement identities; summary construction/finalization observes the finalized window and unresolved validation, and subsequent outcome/horizon changes wake eligibility without reconstructing values. State which source and relationship revisions invalidate the whole prepared unit after callback-capable preparation. Enrollment/disposal controls already exercise recipient revision invalidation, but adding a contributor index must preserve those guarantees rather than install a stale index beside current payload.

This is a narrow ordering requirement, not evidence that the existing lifecycle must be replaced. Existing native capture/finalize and completion machinery are the appropriate foundation.

## Full-route dependencies that remain blocking

### 5. Negative contribution supersession and shared retirement need an explicit representation contract

The remove rule specifies creating a negative contributor when recipient membership changes, but does not specify when that contributor ceases to represent current absence, how a later addressed operation replaces it without a value change, or where still-current uncertainty goes after native lifetime reclamation. A collection of absent lifetime records cannot simply remain forever, and terminal owner outcomes do not establish that an unknown fact became clean initial evidence.

`entity.ts:119` indiscriminately deletes native maps on explicit retirement. The automatic bare-retirement path in `entity-signal.ts:3363–3397` does not call that hook. One path can erase current/captured evidence; the other leaves metadata behind. Specify the shared obligation-aware release/transfer rule, lookup of any compact absence certificate after reclamation, and separation of immutable captured input from current recipient slots. Preserve the fixed historical window; neither recapturing today's pending owners nor resetting to `initialRequirement()` is equivalent.

The preserved `final-gates.log` actually fails final negative-metadata/churn assertions. The negative-membership confirm/reject cases perform useful delivery before failing cleanup. Those executions establish retention failures; they do not independently demonstrate that blanket deletion is safe or that absence proof was lost in those runs. Exact bounded compaction remains unimplemented and unqualified. This need not block establishing core contributor representability, but it blocks full native-survival/retirement acceptance.

### 6. Whole selected inverse preparation is not provided by the current commit seam

`internals/causal-runtime/tree-realization-adapter.ts:1385–1414` prepares separately selected ordinary effects. Its install then commits structural physical plans, installs point plans and finally installs ordinary plans (`1448–1462`). Source commit prepares/completes publication within those individual operations (`entity-signal.ts:1320–1373`). The `publication: 'physical'` marker suppresses additional authored tombstones; it does not by itself make all intermediate physical operations callback-free or suppress every inherited ordinary effect.

The preserved selected-unit test fails when rich capture observes partial mixed inverse values. An exact collection contributor index cannot repair the capture boundary. Before implementing this dependency, specify the complete selected unit's prepare/install/invalidate/publish phases, how selected O and physical logistics remain separate, and where stale revision, occupied-key/anchor validation and error precedence are checked. Reuse existing plans where possible, but do not claim the current `commit` entry point already supplies atomic installation. This is an existing executable blocker plus source explanation, not a request for another settlement architecture.

## Evidence and bounded acceptance

No new execution occurred. Previously preserved `final-focused.log` reports 24 passing / 2 failing: destination-first collection delivery before foreign uncertainty settles, and independent collection declaration rejected before its callback. `final-gates.log` reports 2 passing / 7 failing, including inspected unavailable-input cases, selected capture, negative cleanup and churn. Their original assertions remain acceptance constraints; source-derived cases above are additional discriminators, not retroactive passes.

The finite next review boundary is the resolver and contributor-edit contract, order-only revision path, seed/acquire snapshot protocol and finalization sequence, followed by separately specified retirement and selected-unit mechanisms. Review their concrete source changes and unchanged useful-delivery controls when authorized. Do not reopen already-decided completeness policy merely because the current capability flag rejects collections. No release, activation, public export or broader verification acceptance follows from this review.
