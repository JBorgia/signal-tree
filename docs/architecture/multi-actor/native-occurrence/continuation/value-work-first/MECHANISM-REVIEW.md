# Independent value-work handoff mechanism review

**Accept the bounded mechanism for implementation, with its stated acknowledgment and reduction invariants. No counterexample to that mechanism demonstrated. This is not implementation or C15 acceptance.** No runtime edits or new policy are needed for this disposition.

Reviewed exact VALUE-WORK-DESIGN.md and REVIEW.md from /private/tmp/st-c12-enrollment-independent-review. Their archived copies and hashes are alongside this report. Independently verified exact C15 manifest SHA256 `02aba88c81c413700ef4af2f9bf8facc422cabf01fddf6a31b4ec2d777b16568` and all its file entries in /private/tmp/st-native-combined-c15/candidate. IDENTITY.json records source and evidence identities. Read repository review contract; this is mechanism review, not release verification.

## Causal premise confirmed from source and raw evidence

C15 private.ts:244–305 reduces completed units in order. Its non-noop branch keeps B's distinct support, supersedes A, and overwrites projected.changed with B's physical-change bit at :300. Link researchRefresh at link.ts:1046–1052 selects B but does not dirty the Link. The preserved trace has payload {a:1,b:0}, changed:false on repeated refreshes, and sent:[]; no admission event occurs. The unchanged scalar-frame-publication.spec.ts:375–391 failed on C15 and passed on C12 in the supplied focused logs (one selected test, 25 intentionally unselected). Those are inspected existing runs, not a fresh execution by this reviewer.

Thus retaining declaration permission or preventing operation retirement would address the wrong stage. Current B must remain authoritative. Outstanding value work is the fact that was lost.

## Why adoption is the correct acknowledgment boundary

Source references are relative to C15 packages/kernel/src/lib.

- link.ts:961–978 is the only post-initialization assignment clearing dirty. It immediately establishes/reuses a held waiter before invoking admission. No application callback lies between the dirty reset and waiter creation. Therefore work already transferred to Link has an existing owner through hold/queue/send; producer state need not wait for endpoint acknowledgment.
- :980–1005 transfers that waiter into the existing queue/chain and reconciles latest eligible state. :851–940 handles admission, retry after deferred permission, and current-ticket allowed checks after the observable sending transition. :1059–1068 resumes held work on eligibility. New support-only selection must update researchFact and eligible even with no new work; neither fact identity nor equal payload alone is permission.
- private.ts:452–464 requires the current fact, no outstanding preparation/unresolved support, and current permission/grant. The cursor must not participate in this permission decision. B's pending q still blocks; an A epoch does not authorize B. After q settles, work retained in either producer or Link can progress using B's support.
- link.ts:862–869 and :921–926 retain knownY suppression and endpoint acknowledgment. These suppress repeated equal deliveries, but cannot recreate work that was never adopted. Endpoint rejection keeps the existing reporting/queue policy (:1009 onward); acknowledging at adoption does not introduce automatic retry or pretend successful I/O.

The proposed sequence (capture stable receipt, assign fact/payload, OR outstanding prefix into dirty, acknowledge exact prefix without callbacks) is a valid ownership transfer. Implement taken as monotone, e.g. max(taken, receipt.workEpoch), with exact delivery-cell identity validation. An older receipt must neither regress taken nor acknowledge through current produced. The cell cannot be replaced or reset by support recomposition, no-write, supersede or retirement.

Example: A produces epoch 1; B only changes support and carries epoch 1; taking B makes dirty and taken=1. If A was already taken, B updates current selection but does not rearm work. If epoch 2 appears after capture of epoch 1, acknowledging 1 leaves 2 outstanding. This explains both useful settlement and absence of sticky work flags without payload history.

## Clone/reentry and adoption conditions that must survive implementation

These are already obligations in the proposal, not a demand for wider architecture:

1. Share both cursor cell and selected receipt across prepared Binding clones (private.ts:229, :331). Sharing only the counters while cloning projected by value is insufficient: later installation could restore the obsolete selection. Unit reduction must increment produced once at publication of selected non-noop value work; inspection must not increment it.
2. Both refreshSource (:511) and projectScalarContribution (:535–539) currently retain the pre-ready Binding wrapper. Both must return only the live binding's stable receipt after reduction, not merely compare two fields on an obsolete wrapper. Check the latest current fact and cell; an installed but unfinished newer selection offers no takeable receipt yet. The shared work prefix survives until that selection completes.
3. Do not expose a partially reduced receipt from recursive refresh. A drain guard, if needed, belongs to the recipient shared state, not a stale wrapper. It must release in finally and must not acknowledge on readiness alone. Source callbacks in installFact/index updates and proof recomposition motivate the proposed bounded reentry test; no full stale-payload repair is preapproved. A demonstrated stale completed payload outside handoff remains a separate concrete finding.
4. Centralize both receipt adoption paths, including direct projectScalarContribution at link.ts:827–828. Remove the same-fact-only early return. Existing legacy fact-only project paths (:754–756, :831–835) already set dirty; their next stable refresh must acknowledge the matching prefix even when researchFact already matches. Do not falsely deem a prefix adopted merely because a fact was assigned. Adoption must happen before any observeLink/user callback in the new helper, and must never clear dirty on support-only updates.
5. Keep current-ticket allowed after observeLink. A listener installing a newer revision invalidates the old ticket; held work must resume with the newer selection, never old permission or payload. No cursor operation should call endpoint/admission or add a new queue.
6. Disposal deletes the binding and existing Link cleanup resolves held/waiting work before user cleanup (link.ts:1120–1148). A late acknowledgment must be inert even if the same channel object is ever associated with a different cell. No acknowledgment-created wake or source-global cursor.

No contradiction found between these invariants and current Link dirty/held ownership. The two monotone cursors distinguish delayed adoption from newer production in a way a resettable boolean cannot.

## Required bounded falsifiers and limits

Implementation qualification should run the design's seven listed discriminators: unchanged/reversed/equal-only sibling frame; changed A then equal B with actual pending q and exact settlement delivery; already-delivered A followed by B without a duplicate, then later genuine change; read-without-take and delayed E acknowledgment against E+1; held/send-observer/endpoint reentry with intervening support-only pending selection; prepared clone and unfinished/reentrant reduction; disposal while held. Include the same-fact legacy adoption path in the take discriminator. Assertions must check latest exact payload and current support, not only counts or lack of exceptions. Preserve original counterexample and existing safety controls unchanged.

**Run this turn:** read-only source/control-flow review and full manifest verification via `python3 /private/tmp/st-parent-freshness-implementation-independent/value-work-mechanism-review/audit.py > /private/tmp/st-parent-freshness-implementation-independent/value-work-mechanism-review/audit.log`. Exact existing baseline/C15 commands, logs and trace were archived; no green diagnostic trace is treated as a passing progress oracle.

**Not run:** no new tests, model simulation, runtime implementation, broad suite, GC or composition replay. There is no cursor implementation to execute yet. This accepts the specified mechanism and boundary, not its eventual code or unexecuted discriminators. C15 remains blocked by the original equal-sibling failure until an implemented, reviewed correction passes those bounded checks.
