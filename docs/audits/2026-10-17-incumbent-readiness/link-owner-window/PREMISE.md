# Independent premise review: immutable pending-owner epochs

Reviewed source HEAD `3a20d56c7b4dce75bf9b4a50f43f0386cfd75b06` in `/Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree`. Read-only source review; no test execution or production edits. This reviews the hypothesis, not an implementation.

## Finding

The hypothesis supports a legitimate, narrow progress case: an actual authored scalar revision observes possible owners P (or P,Q); R opens later without changing that revision; every owner captured by that revision confirms; that exact revision can publish while R remains pending. This is conservative epoch eligibility. It does not establish independence from owners pending when the write occurred, and does not fulfill the entire automatic-independent-progress requirement.

No read tracking is necessary for this narrow result if all same-tree currently pending owners are included. A later opening cannot retroactively supply an input to an earlier immutable value. However, a later mutation, reentrant replacement, live mutable payload, incomplete owner capture, or cross-tree input defeats that argument. Limit the first experiment to immutable scalar payloads and same-tree pending inputs; preserve cross-tree/cached-native/structural work as unsupported rather than manufacture independence evidence.

The owner approved the concrete ordinary write of retained data after rejection as new surviving application truth. That removes the historical-origin discriminator for that case. It does not authorize classifying compensation, inspection replay, restoration or delayed publication as new ordinary authorship. Retiring an owner must not re-stamp an old revision as fresh.

## Source prerequisites verified

- `packages/kernel/src/enhancers/transactions/transactions.ts:3794–3834`: lifecycle view and opened transition precede callback; opened listeners can write and open nested work before the commit scope exists. Capture from the current lifecycle source at the write, not only the commit-scope Boolean or a listener-maintained pending cache.
- `packages/kernel/src/lib/internals/transaction-lifecycle-view.ts:124–190`: public delivery can be held or already delivering, while snapshot reads authoritative current source. Snapshot/event payloads are detached but not recursively frozen. Internally owned immutable copies remain necessary.
- `transactions.ts:3998–4072`: terminal confirmation is recorded before consequences, but public lifecycle delivery follows those consequences. A mechanism may wait for public event and then wake its own gate; it cannot claim that an earlier durable callback already saw the outcome. Do not replace the source's single observer slot and disable existing tooling.
- `packages/kernel/src/lib/path-notifier.ts:262–325`: notify/enqueue captures write metadata before deferred coalescing. Capture exact revision evidence here rather than at later delivery. Observation is after mutation and exceptions are swallowed; failed evidence capture must conservatively invalidate eligibility, not retain an earlier clean record.
- `packages/kernel/src/lib/mutation-types.ts:76–176`: absent origin means ordinary application work, `transaction-rollback` is realization provenance, and participation is a separate axis. Neither absent transaction metadata nor origin alone proves independence. A rollback/replay-derived replacement must not inherit an unrelated prior eligible fact.
- Lifecycle pending disappearance is not outcome evidence: construction abandonment/destruction can remove views without confirmation. Preserve unknown/held rather than convert disappearance to confirmed.

## Required discriminators, expected before execution

1. P open; y direct42 or copiedP7; R opens later; confirm P. Exact unchanged y revision progresses with R still pending; neither arm progresses before P confirms.
2. P,Q already open before y; confirm P only: held. R opens afterward; confirm Q: may progress despite R. This prevents accidentally testing only one owner or adopting the latest pending snapshot at delivery.
3. P open; y copiedP7; reject P: old revision remains ineligible. A real later ordinary y write under the approved post-rejection case creates fresh evidence. A same-value setter that emits no new mutation must not be falsely claimed as a new observed revision.
4. P opens from an opened listener and writes before its commit scope: snapshot must include it. A nested lifecycle callback creates Q then writes while queued public events are undelivered: snapshot must include Q.
5. New write during terminal delivery: fresh revision captures owners pending at that point, including any R opened reentrantly. Old eligibility cannot transfer to it.
6. Rollback compensation and restoration: exclude or remain held absent an explicit, validated restoration fact. A notification of restored state is not itself new surviving application truth. Tests must distinguish actual callback-authored writes from realization.
7. Refusal and callback-error recovery retain owner pending; do not resolve on exception. Confirm then rollback cannot reverse the terminal fact; duplicate confirmation cannot create a new epoch.
8. Frozen caller records / mutation attempts: later owner-set mutation cannot erase P, and revision identity binds exactly one payload and immutable possible-owner set.
9. Preserve incoming-authority progress and proven delivery tests: obsolete preflight revision never sends after a synchronous replacement; held send cannot strand eligible revision; started old request gets later serialized corrective send.
10. Destroying a tree is not confirmation. Preserve separate connection-dispose and tree-destruction semantics and do not advertise fixed retention or waiter cleanup without a separate test.

## Scope and interpretation

A passing P-then-R case earns useful automatic progress, not global automatic publication independence. Direct unrelated writes authored while R is already pending still conservatively wait for R; this is a known liveness limit, not a passing independence result. Rejection after revision remains a deliberate conservative limitation of this all-confirm proof, not proof the retained ordinary value is physically invalid.

A cross-tree copy from a still-pending source into a tree with no owners is a negative boundary witness. The approved post-rejection rule does not justify calling it independent. If such inputs cannot be excluded or identified in production, the narrow mechanism is not sufficient for general adoption.

Proceed with a finite scalar research experiment under these limits. No new public policy or override is justified by this premise review.

## Review of prewritten SPEC.md

Read `/private/tmp/link-owner-window/SPEC.md`. Its scope is suitable for the finite experiment, with these implementation requirements:

- Reuse `getWriteParticipation(meta)` (`packages/kernel/src/lib/write-participation.ts`): absent participation deliberately means authored; realized/inspection must not get fresh windows. The experiment can additionally conservatively exclude positive restoration/devtools/rollback provenance from its narrow ordinary-write path. Do not claim those origin exclusions redefine repository participation semantics. Authoritative inbound has its separate exact-acquire ticket.
- Explicit transaction attribution must match captured owner identity, including tree/owner namespace, not just integer transactionId. Missing/noncurrent attributed owners must cause unknown/held, not an empty clean window.
- A safe public-reader wake strategy is: snapshot source synchronously at enqueue, independently copy pending IDs, maintain irreversible terminal outcomes from subscribed public events, and wake held revision checks when those events arrive. The delay is allowed; never infer confirmed because the snapshot no longer contains an owner. Recheck revision and all facts through the reviewed delivery gate. Attach before mutations; late attachment has unknown historical outcomes and remains held. Record/wake only research-held tasks; do not recursively resend all queued production work.
- If private instrumentation observes terminal record earlier, it must publish the immutable terminal fact before requesting a wake, and defer actual delivery until existing coherent publication/consequence ordering permits it. An inline wake from `publishLifecycle` can run before confirm's normal authority/side-effect work; it needs a concrete ordering argument and counterexample tests, not merely an earlier observation point.
- Cross-tree copy may be admitted by the mechanism; report this as a scope-limit counterexample preventing general production safety claims. It is neither a same-tree pass nor universal impossibility.
