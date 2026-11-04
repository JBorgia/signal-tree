# Independent implementation review — preserved conversation findings

This record preserves this reviewer's earlier bounded admission/source assessments. It is not a fresh full review, release sign-off or runtime-adoption recommendation. Implementation and architectural authority remained centralized with the controller. The reviewer did not execute tests/builds or edit production files. Runtime was the isolated v16-sparse-responsibility-0 worktree, based on f165d28e55dce241ff6466a58c9b850f1bbc20f3 with baseline production packages matching frozen fe18. Governing frozen premises were identified at 9a9770a63bbece5267f6c439270209ccaf9ef3ee. Uncommitted source changed during the staged reviews; these observations must not be treated as a seal of every later edit.

## Conditional experimental admission

The bounded design was conditionally admitted for an isolated experiment after completion/ordering clarification, not chosen as a production architecture. Required conditions included private per-source packet issuance authentication; no loss of native history with zero recipients; explicit exposure before native completion reaches a recipient; preserved repeat completion, receiver and thrown-undefined behavior; exact terminal delete/write/revision/add ordering; and callback-safe preparation. Original semantic and point-work bounds remained unchanged. Lazy collection-version behavior required grouping, first-read and framework witnesses. Count reduction alone could not establish CPU/heap acceptance.

## Root-owned source slice

Source inspection found no concrete blocker in the reviewed slice. The constructor-delivered point-preparer closure and per-source WeakSet separated privately issued packets from generic/foreign packet admission. A native completion was exposed before recipient preparation, including recipients introduced by callback-capable preparation. Native-only completion remained opaque through a WeakMap lookup; lookup rather than deletion preserved repeated completion and calling native.complete through its owning object preserved its receiver.

The terminal specialization kept native deletes and adds on the outer record, executed native writes followed by source revision in its write adapter, and therefore retained composition-wide delete/write/add phases. Lazy collection version retained existing advance frontiers and realized a writable Location on first demand; actual native entity history remained independently installed. Exact immutable global pending-membership snapshots were invalidated on actual membership changes, including source disappearance. These were source observations, not executed universal guarantees.

## Fused field facts and point preparation

After the entity slice stabilized, the current diff and integrated-field-facts.spec.ts were inspected. No blocker was demonstrated. Separate logical ordinary/physical row flags and key sequences retained empty-row existence and divergent side order. Physical-only preparation retained dynamic untouched ordinary support. Point preparation protected an in-preparation base against getter-reentrant installation, sealed evidence before recipient escape, retained deliberate equal-value physical View mutation separately from captured per-edit requirements, and changed the row revision on installation for retirement validation.

Reviewed witnesses covered retained unread native completions, refused callback-reentrant attempts, retirement invalidation, physical-only ordinary support and divergent field ordering. The inspected first-decisive-semantics RESULT receipt reported exit 0, no source mismatches and no remaining owned processes; the controller reported 229 tests across 29 files. That selected run was not a proof of every semantic contract. The unchanged absolute point gate, wider framework/types qualification and fresh cost screen were still separate obligations. This review preceded the later conservative global topology isAligned guard; no fresh full review of that later state is asserted here.

## Solid writable-token first failure and correction premise

The original framework failure was inspected in native-publication-error-boundary.spec.ts and raw framework-suites/first.log. React 109, Angular 302 plus 3 skipped, Vue 223 passed; Solid had 135 passes and one failure. The failing writable-token case stopped at its fault-free calibration assertion tokenCalls > 0, before arming the fault. Its fixture held two row memos/epoch handles but never demanded a collection query. The new lazy version could consequently leave the writable-token injection path unrealized.

The governing native-publication-error-recovery record requires completion of native bookkeeping and sibling delivery before reporting an actual post-invalidation exception, preserving the thrown value. It does not require allocation of an unused writable token. Thus the observed failure established an unmet fault-injection precondition, not a demonstrated lost error/publication contract.

The smallest justified fixture correction proposed was a public rows.all() read before calibration; the stronger proposed witness retained an active collection memo and recorded its deliveries alongside the existing held-row observations. Required collection values were [0,0], [1,1], [2,2], [3,3] at the corresponding stages, with fault deliveries frozen before direct reads. Every original positive token-call/hit guard, thrown-marker identity, calibrated epoch-attempt, completed-frame, row-coherence and subsequent-write assertion had to remain. Closure required an actual writable-token fault hit and passing assertions, preserving the original failure.

Baseline proof must be supplied by actual controller receipts: this reviewer inspected the original test at b0410dc05 and its current fixture, but did not execute or independently verify a corrected-fixture baseline run. No such run is fabricated here. Later successful framework/baseline receipts, if present, are execution evidence separate from this source assessment.

## Limits

No universal correctness, full qualification, cost improvement or adoption conclusion follows from these reviews. Relevant exact source manifests and actual run receipts govern freshness. The cost-protocol review is preserved separately in independent-cost-protocol-review.md.
