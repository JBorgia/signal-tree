# Independent C21 aggregate/recipient failure adjudication

Exact C21 manifest `73e4ecfde64ee05a1eed1eb1362e8ca6f18755b1192a3583454440ef4ad68c27`. Both original failing specs and six supporting source/spec files verified against that manifest, copied unchanged under originals/. Partition first failures/command/result preserved. No runtime/assertion edits or additional test runs.

**Classification: the six first failures are obsolete recipient-only hold expectations under the approved source-progress/enrollment invariance disposition. They do not demonstrate six native safety regressions.** This is not a claim that all assertions after those failures pass. Exact unexecuted continuation checks remain qualification work.

## Contract basis, independent of the new runtime's sends

The owner-approved requirement separates complete source evidence from connection-local declaration permission: another recipient must retain the complete source obligations, may use ordinary surviving admission when eligible, and must not borrow the declaring connection's permission. Mere existence of an unrelated pending owner is not itself an actual input/destination/validation dependency. Genuine native possible-owner windows, external/unobserved origin, incomplete declarations and shared validation remain mandatory.

Available records: native-occurrence/continuation/README.md:235–240 describes that separation; c12-publication-admission-review/REVIEW.md:31–33 and :63 requires the original six useful secondary progress cases, first recipient declared/second surviving, no owner mutation, and no loss of invalid support. enrollment-correction/REPORT.md records the implementation scope and no-permission-transfer counterweights. enrollment-independent/WINDOW-ADJUDICATION.md distinguishes recipient-only artificial windows from real native possible support and preserves useful owner settlement/disposal coverage. These reflect prior approved premises; this review does not infer authority merely from C21 passing.

The older declaration draft at exact candidate docs/audits/2026-10-17-incumbent-readiness/link-declared-contract/SPEC.md is historical/draft support, not independent current approval. Its distinctions about known evidence and unrelated owner existence are consistent with the approved interpretation; its old no-declaration conservatism cannot override the later explicit enrollment invariance disposition.

## Four aggregate-independent-input cases

Original lines 8–34 cover branch/root x before-pending/during-pending secondary enrollment. The only pending turn p writes owner.z on a separate tree. The tested updater reads its own initial clean branch/root and produces x=1; it never consumes owner.z or p, does not author a destination under p, and neither throws nor adds an unknown declaration. Both recipients observe the same installed source revision.

The raw console records show exact physical and outbound values, primary receipt started/declared, and pendingOwner=7. The first assertion failure is line32, `otherSent == []`. The preceding primary useful-progress assertions pass. Later p.inspect/owner assertions are blocked in these original four cases and must not be claimed as executed there.

Holding only the nondeclaring recipient for p would reinstate the enrollment-dependent artificial window rejected by the approved contract. It is not needed to protect a consumed source obligation. **A positive counterpart already exists unchanged in C21:** publication-enrollment-adjudicated.spec.ts covers these exact four mode/enrollment setups, plus other variants, requires one useful secondary delivery and surviving-only starts, preserves primary declared basis, p.inspect and owner value, and checks disposal cutoffs. All 16 cases passed in the same partition. Keep the originals/failures as historical evidence; route qualification to the adjudicated counterparts rather than delete the behavioral coverage.

For exact whole payload qualification, a future companion should require branch `{x:1,y:0}` or root `{pair:{x:0,y:0},x:1,y:0}` on both endpoints, then settle/rollback unrelated p and assert no duplicate send. Existing primary/secondary toMatchObject checks are useful but do not assert all root keys. This strengthening is proposed, not silently edited or executed.

## Two recipient-cause-classification domain-only cases

Original lines9–25 cover domain-only/external-origin/unknown-declaration x confirm/rollback. In domain-only, c observes t.pair but an independently declared root updater reads clean root x and pair.y to install pair{x:1,y:0}. That wider updater creates a recipient-domain mismatch; it does not create an unobserved native input or actual dependency on foreign p. There is no external metadata and the declaration is complete. Secondary `[]` at line18 is the first failure for both terminal choices.

Domain mismatch must remain distinguishable from declaration permission and actual unknown native authorship. It does **not**, with complete source-native evidence, require manufacturing a fixed possible-owner window containing p. Both recipients can therefore publish through their applicable gates while p remains pending. No permission transfer follows from secondary ordinary surviving delivery.

Do not discard the whole six-case classifier. The four external-origin / unknown-declaration cases passed unchanged in this same partition, including their hold, useful confirm/rollback, later-owner isolation and final payload checks. Those remain important genuine uncertainty controls. In the two failing domain-only cases, later cause/proof/basis/terminal assertions were not reached; this report does not certify them from the first observed send.

**Proposed separate positive counterparts (two terminal variants, not edits now):**

1. Preserve the exact domain-only root-updater/branch-recipient setup and spies that delegate to the real lifecycle functions. Assert one exact `{x:1,y:0}` delivery to each recipient before p settles, unchanged physical value, p.inspect and foreign owner value.
2. Capture recipient channels at registration and assert secondary `started` basis is `surviving`, never `declared`; do not infer it from primary's receipt. Preserve the original primary surviving-basis expectation and explicitly execute it. Confirm recipient-domain uncertainty remains observed, while unobservedOrigin/invalidAttribution/uncapturedUpdaterInput remain absent. Keep the original useful proof-unknown check as a separate diagnostic expectation until actually replayed; do not equate receipt-local unknown with a native pending window or replace the check merely because delivery occurred.
3. Preserve the later owner scenario and both p.confirm/p.rollback paths; assert both endpoints still contain exactly one delivery (no settlement duplicate), both settled() calls complete, and later owner stays pending/unmodified. Do not remove these assertions just because domain-only no longer waits for p.
4. Pair those positive cases with an **actual native-window counterweight**: while p is pending, perform an unscoped source write to root x, then use that retained x in the same independently declared root updater. Both recipients must remain held, a later owner must not extend the captured window, and settling the actual captured p must release one exact latest payload. This distinguishes source uncertainty from recipient-only mismatch. The existing recipient-window-independent.spec.ts has analogous branch/root confirm/rollback and remaining-owner/disposal controls; all 9 passed, but an exact root-input/branch-output companion above is not yet run.

No proposed counterpart grants a nondeclaring recipient permission for its next operation. C21 recipient-source-permission.spec.ts's public test already sends an independently declared revision to both Links, then writes unscoped under foreign q and requires both to hold until q confirms. Its other tests retain untouched destination ownership and parent horizon invalidation. All 9 passed in this partition.

## Source mechanism checked

- private.ts:336–350 separately captures updater/native input and recipient-domain uncertainty. It does not classify all recipient mismatch as an actual native input dependency.
- lifecycle.ts:254–269 separates unknown coverage from unobserved authorship. `incomplete` remains true for no-native nonmatching admission, unobserved authorship or incomplete active frames; mere recipientDomain with complete native evidence does not create that window.
- lifecycle.ts:291–303 freezes actual recipient windows only for incomplete operations; recipientProof retains them across recomposition. Native support and shared validation remain separately selected.
- private.ts:264–304 combines selected authored/native/occurrence support; lifecycle.ts:435–440 projects it through recipientProof.
- private.ts:464–485 gates declared early admission with hasDeclaration(channel,fact); otherwise eligible work uses the original ordinary gate and per-channel surviving grant. lifecycle.ts:313–315 preserves matching-channel declaration identity. This is source inspection, not an instrumented trace proving each individual callback path in the six failed tests.

The unrelated-owner hold cannot be restored globally to make these originals green without contradicting the existing positive controls. Conversely, this disposition does not permit dropping true possible/native/shared-validation obligations or weakening external-origin cases. No runtime correction is recommended for these six first failures on the available evidence.

## Executed evidence and limits

Used Main's existing exact-source partition, not a new run:

- aggregate-independent-input: 4/4 failed at old secondary-empty assertion.
- recipient-cause-classification: 4 passed, 2 domain-only failed at secondary-empty assertion.
- publication-enrollment-adjudicated: 16 passed.
- recipient-source-permission: 9 passed.
- recipient-window-independent: 9 passed.
- publication-native-provenance: 18 passed; aggregate-native-input-default-control: 1 passed.

RAW-RELEVANT-OUTPUT.txt retains raw selected output. IDENTITY.json binds copied inputs and full first.log hash. Newly proposed domain-only continuation/counterweight and root full-shape checks are **not run**. No full-suite, count, heterogeneous invalidation, release or broader safety acceptance is inferred. Main owns oracle disposition/promotion.
