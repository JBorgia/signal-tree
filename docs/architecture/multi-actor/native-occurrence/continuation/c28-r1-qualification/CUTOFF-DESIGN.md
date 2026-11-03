# Bounded correction design: historical closure versus invocation relevance

DESIGN ONLY. No runtime patch. R1 remains frozen and unaccepted. This follows the exact A/B trace and independent `r1/ab/REVIEW.md`; it does not reopen owner-approved receipt semantics.

## Measured failure

At x, the selected old certificate is ready and masks A:{a}, B:{b,a}; both comparators are true. At unowned y, selection admits the proposal itself. Its original installed predecessor IS ready, but its `retained` operand is the new, expected-to-be-unready invocation. The shared readiness return suppresses all relevance. y's final proof differs only by confirmed a in owners/validation; values, clean bits, D/I/W, flags and pending cells match. y therefore keeps its new revision, supersedes the old receipt and becomes the sender. a is authentic current validation and must validate; it is not new pending responsibility. Calling every occurrence of a historical would be inaccurate.

## Proposed shared admission data, not an operand swap

At the existing native scalar prepare seam retain four explicit meanings:

1. **Prior installed certificate P:** `predecessor.requirement`, before endpoint selection. This witnesses the historical state being compared/replaced.
2. **Selected historical certificate S, if any:** `retained.requirement` ONLY when it is distinct from `prepared.requirement`. It may differ from P (e.g. restoration/selected endpoint). Preserve exact restoration/literal bypasses; do not recertify them.
3. **Current invocation C:** the unprojected prepared requirement, with its captured inputs, validation frames, known destination and raw flags. Its unready status is normal and is not evidence that P/S history is open.
4. **Captured lower bound L:** existing captured-pending owners plus frame pending-at-entry/capture protection, snapshotted for relevance at this admission. Outcome changes later must not erase L. Keep raw validation and frame records unchanged.

Historical closure must be checked on the real old contributors, not C merely because selection calls it retained. For a deliberately conservative first correction, require P and S (when present) ready, and every captured input requirement whose I/V is considered for historical cleanup ready at the cutoff. This last condition prevents a seemingly confirmed reference from being used to erase evidence in an unfinished consumed certificate. If any such historical contributor is open, decline cleanup for this admission; do not queue cleanup or revisit its mask at settlement. A later fresh admission may establish closure.

No new authority or owner-history graph is needed: these objects already exist at scalar prepare. Avoid storing P permanently on the new current certificate. Extract only bounded admission classifications/cells; existing completion owns any transient reference. This design requires no generic-construction observer or sweep.

## Two relevance classifications, shared only after their conditions hold

**Historical candidates H:** confirmed-at-cutoff I/V cells from the closed old contributors. Eligibility does not authorize dropping D/W/unclassified actual roles; currentObligations' role guards remain mandatory, as do all flags/source availability.

**Current invocation candidates V:** confirmed-at-cutoff I/V references from C, excluding L. This includes explicitly supplied already-confirmed a. V describes prospective publication/no-write relevance AFTER full current validation, not permission to omit a from frame completeness. Pending-now, captured-pending-then-confirmed, rejected/abandoned, unknown/unavailable and actual destination/window responsibilities remain exact.

In the conservative first correction, if historical closure above fails, use no removal mask at all. Otherwise H and V can share a prospective projection mask because both are subject to the same L and role/flag preservation. Keeping the two classifications explicit prevents readiness of C from accidentally disabling V, and prevents V from globally erasing a same-identity cell in an unresolved historical contributor. This is a bounded refusal to normalize open history, not a new policy that all equal work in an open horizon must always be no-write.

Do NOT simply call currentRelevance(P,C) everywhere: that would forget a distinct selected S and unresolved consumed history. Do NOT merely remove the readiness return: that reinstates the rejected wider normalization scope. Do NOT apply a comparator-only special case for y/a or force a receipt status.

## Projection timing and source/recipient handoff

Keep C and issued inputs/certificates unprojected. A prospective relevance mask is fixed at admission, but may only take effect for transported source/recipient proof after the current validation AND activation barriers complete successfully under existing machinery. An unresolved fresh composite should expose its raw combined proof; its installed scalar completion/horizon normalization can install the projected data proof once ready. Reuse C26's existing installed completion/listener ownership; no new delayed task is needed. Invalid/error flags must survive even if completion still runs after a callback throw.

This timing distinction prevents the fresh source from becoming prematurely weaker while its authentic current validation is still open. The historical eligibility decision stays fixed; completion cannot add newly-confirmed cells to the mask. The existing retirement summary must still derive from unprojected constituents before ancestry deletion, preserving static blockers and qualifying window identities exactly. Current publication relevance is not retirement permission.

The same classified mask must reach the existing Unit/native/revision handoff and final aggregate no-write comparison. The latter compares the actual reduced prior/effective proofs after earlier sibling units (x before y), not a guessed leaf predecessor. Apply role/flag-preserving projection to both sides, then use the existing equality/clean/value conditions and ordinary noWrite path. This keeps occurrence replacement accounting and old receipt/operation lifetime behavior; do not retarget earlier snapshots/receipts or skip installing current source facts.

For A/B specifically: P is closed at both fields. x has closed S; y has no historical S because its selected value is C. Inputs were captured with pending owner arrays [p],[p],[] and frame protection [p]. Eligible a (and B's historical b) may be irrelevant to final publication comparison only after raw validation. y then compares the same p/D/I/V/W/flags as its prior aggregate, so existing noWrite retains the earlier receipt. No new owner decision is required.

## Finite preregistered discriminators for a reviewed successor

1. **Unowned newly admitted y:** unchanged approved A/B tests, unchanged assertions; trace P/S/C identities and readiness. Both fresh receipts no-write; earlier receipt represents one useful send after p; no notification/ownership changes. This is the exact failure being corrected.
2. **Unresolved genuine old contributor:** within an outer dependent[p,q] declaration, install equal derived support; confirm q, then make a second admission before outer validation closes. Verify no cleanup of that still-open old certificate, exact p/q protection and no early send. After closure, a fresh equal declaration can exercise approved no-write progress; p confirmation sends exactly once via the retained selected receipt. Include activation-first and validation-first internal readiness controls to avoid treating one barrier as both. Do not assert no-write for the intentionally unresolved intermediate admission.
3. **Pending captured then confirmed inside updater:** unchanged current-validation control plus trace L includes q even after confirmation. Full omitted-owner contradiction and exact useful terminal output remain; q is never newly eligible merely because the callback confirms it.
4. **Already-confirmed authentic a supplied now:** unchanged nested confirmed-validator completeness control. Incomplete outer claim must still contradict. Complete approved A/B can become no-write only after this validation; do not delete a from frame input checking.
5. **No loss of acquisition protections:** exact original fresh pending-q regression and unchanged opaque r-only/s-only/both/saved-before-q packet. Pending q and both opaque obligations remain, old issued payload stays isolated. No equal-value shortcut or callback rerun.
6. **Completion/retirement/error boundary:** unchanged six C26 internal readiness/alias/listener/retirement controls and five public horizon controls, plus one projected confirmed-I/V case whose old retirement blocker remains true. Primary thrown sentinel identity, source availability and listener cleanup remain exact. Diagnostic graph counts must separate current source, recipient, selected op and issued snapshots.

These are a design qualification list, not claims of execution on a corrected runtime. Only frozen R1 evidence exists now. The exact deferral implementation and historical input closure check require independent review; if they require a representation-wide responsibility change, stop rather than broaden this design.
