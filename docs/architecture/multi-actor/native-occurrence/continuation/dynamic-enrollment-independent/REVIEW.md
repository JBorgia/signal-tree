# Independent dynamic enrollment review

Frozen author source manifest SHA-256: `5f9b20cfff783d947cff974fab5e5f3ef9ac15e0e902c1638601166310e70bfb`. `SOURCE-VERIFICATION.json` verifies every manifest entry against both the review copy and author source. No author/runtime edits. New controls live only in the independent copy. Trace-only lifecycle instrumentation lives separately under `trace/candidate`.

## Four occurrence changed verdicts: classification, not old inherited failures

Main's verified frozen B run `/private/tmp/st-native-combined-b/runs/occurrence-discriminator` is 12/12 pass. C0 and Helm both fail the same four unchanged first-omission assertions (scalar, empty collection, collection, mixed). They are genuine B-to-C0 changed verdicts. They are inherited by Helm from C0, not inherited before B. Original assertions remain unchanged.

Causal evidence: `trace/runs/first-omission/observations/recipient-window.jsonl` records the exact original scalar failure on trace-only C0. At omission, matching root has `matches:1`, `incomplete:false`, clean native owners/possible and no uncertainty. Child has `matches:0`, `incomplete:true`, likewise clean native support and false origin/attribution uncertainty. Its finalizer alone captures pending q in the window. This is missing matching declaration, not recipient-domain uncertainty or q retained in selected native ancestry. Instrumented and uninstrumented original failure agree. The same common membership preparation/recipient finalizer handles all four; this trace directly observes the scalar case, not four separate traces.

Source: `experimental-publication/lifecycle.ts:219` makes missing matching declaration incomplete; lines238–247 capture the fixed pending window; lines249–254 preserve it through recipient proof recomposition. B does not have that recipient-window finalization. Placement/native omission has already removed q from the selected requirement in the trace. Thus recipient classification supplies the observed extra hold; calling it a placement-retention defect is unsupported.

Authority preserved verbatim under `authority/`:

- AUTHORITY: “Unobserved undeclared origin has a revision-specific conservative obligation against the instrumented owners pending at authorship.”
- AUTHORITY: “Recipient-only uncertainty retains its adjudicated fallback and cannot impose another connection's hold.”
- AUTHORITY: “Settlement wakes revision-bound eligibility without requiring a value event.”
- Prior CONTRACT-ADJUDICATION distinguishes its two matching independent declarations with wider native arguments from an undeclared recipient. It explicitly recommends retaining windows for an undeclared recipient while preserving the recipient-only exception.

Recommendation to Main: adjudicate the four immediate undeclared-child assertions as obsolete relative to the approved bounded-window rule, narrowly. Preserve originals and raw failures; do not call them unchanged passes. Do not grant the child the root's declaration. Do not generalize this disposition to a matching declaration with recipient-domain-only uncertainty or to actual consumed q support.

Useful terminal controls: all four kinds × q confirm/rollback assert root immediate progress and child `[undefined]` or `[[]]` after settlement without another target write. 8/8 pass on both C0 and Helm. JSON logs encode array undefined as null; assertions explicitly use undefined. Unchanged enrollment-invariance tests pass 16/16 on both. This reconciles terminal liveness with the no-borrowed-grant rule; it is not permission to silently edit the old oracle.

## Independent enrollment adversaries

New controls exercise deep inspected plain ancestry (only authored descendant retained; inspected siblings excluded), installed partial member after later equality throw, independent nested writer surviving outer getter failure, repeated omit/readd identity and single delivery, disposal, consumed q source subtree copied into surviving member, and actual retained static nested entity named-row refusal/supplied-row readd. These assertions pass on Helm. Original author 406 assertions replay pass; that count is bounded coverage, not acceptance of all producers.

The preinstall refusal control fails: three membership preparer throws leave scalar runtime slots 0→3 although no child installs. The unchanged control fails identically on C0. This is an existing allocation cleanup gap, not a new Helm regression. Source: `signal-tree.ts:1565` builds via createSignalStore before `materialize-markers.ts:800` invokes the membership preparer; refusal has no scalar allocation rollback at that boundary. The hook is private; this proves private preparation cleanup is incomplete, not that every public write can provoke that refusal.

Separate diagnostic preserves the failed zero-slot oracle and measures actual runtime slot/listener/binding state. Helm: slots3, unchanged listeners/bindings, escaped child writes deliver nothing, retry delivers a.n2, disposed link stays silent. C0: same slots3 but escaped child write delivers ghost a.n99 and contaminates retry. Helm moves observation inheritance after actual installation (`materialize-markers.ts:842`), fixing that registration problem. Do not equate observer cleanup with slot release or a universal heap claim.

## Ancestor adoption authority and collection limit

`member-membership.ts:206` now checks all ordinary ancestry; path reactivation and `signal-tree.ts:1309` admit only supplied installed members. The direct deep plain descendant test excludes inspected siblings and passes. Actual physically absent nested EntityMap control retains established behavior: held named-row write refuses, addOne restores only its supplied row. `absent-collection.spec.ts` states the owner decision: dormant storage must not supply the reactivated value.

A distinct observational probe (both C0 and Helm) omits the parent, inspection-adds b.n9, then normally writes b.n2 via field or updateOne. Physical value changes to2, ordinary root remains `{other:1}`, no publication. This probe deliberately has no invented adoption oracle. It neither authorizes nor qualifies historically unresolved ordinary-absent but physically inspected nested entity realization. That behavior is unchanged here; a broader semantic claim would require separate adjudication.

Collection producer coverage is bounded: descendant enrollment stops at entity publication bindings. Static nested EntityMap omission/readd is tested. Fresh dynamically constructed collection enrollment is not established by the author's archived private custom-marker attempt. Do not claim all collection producers from scalar descendant passes.

## Evidence and commands

Every run directory contains COMMAND.json (exact pinned environment/argv), first.log, RESULT.json and unique observations. Node24.15.0, pnpm10.17.0; tests through Nx, cache disabled, maxWorkers1. No broad suite or benchmark.

- `runs/author406`: 406 pass.
- `runs/original-occurrence`: 24 pass / 4 fail (12 original occurrence + 16 invariance).
- `C0/runs/terminal-and-original`: 32 pass / 4 fail (adds8 terminal).
- `runs/independent-corrected`: 14 pass / 1 fail (slot count).
- `runs/diagnostic-boundaries`: 3 pass; C0 same suite 2 pass / 1 ghost-observer failure.
- `C0/runs/preinstall-slots`: same unchanged allocation assertion fails.
- `runs/first-independent`: 13 pass / 2 fixture-import failures; exact original preserved in first-import-fixture.ts. Corrected import separately; these were not runtime regressions.
- `runs/spec-types`: first review-fixture typing errors preserved. `first-type-fixtures/` preserves all three files before typing-only corrections. Final run statuses are appended below.

Collection-containing branch links in original research controls are outside public typed Link admission. Supplemental terminal/diagnostic fixtures use an explicit bounded snapshot view solely to exercise that same experimental runtime path; they do not expand public types. Ordinary scalar/member public adversaries retain valid bounded fixture shapes. No all-any, public type changes, assertion weakening, or manual original-oracle edits.

Conclusion: bounded dynamic registration/ordinary plain-path behavior is supported, with a demonstrated inherited slot-cleanup limit and explicit collection/absence scope exclusions. Four occurrence failures need the above contract reconciliation, not an unexplained inherited label. No activation or universal lifetime qualification.

Final verification: `runs/final-independent` **17 pass / 1 fail**, unchanged zero-slot failure. `runs/final-spec-types-2` exits2 with 202 diagnostics, zero in the new review fixtures; see TYPE-RESULT.json for the exact comparison. The final getter return annotation is type-only. No assertion changed. Source-owned allocation cleanup proposal and causal ownership details: [CLEANUP-MECHANISM.md](CLEANUP-MECHANISM.md). This is a proposal for independent review, not a claim that its implementation has been reviewed.
