# C26 scalar-only finalized-role prototype — first gate

Frozen for independent review; no composition/activation or general retention acceptance. Source manifest SHA-256 `8055911bdd78c9df536bc8a7e1ea8bf3e74427c64675fbc8d0a566c0d91aa38f`. Runtime patch `843b04c9370164a7d20d8a590b5b8148592ea928aa95e1353d3123a59a1cd7ac`. C25 full manifest verified unchanged before copying and after freeze. Candidate has no diagnostic hooks/specs; research replay patch separately supplies them.

## Mechanism and scope

Only three production files changed from exact C25: experimental-publication/lifecycle.ts, private.ts, entity.ts. No API, caller policy, owner filtering, declaration permission or source admission change.

Scalar retained-selection construction uses a separate scalar-marked composite helper. Already-ready scalar composites materialize immediately without subscriptions. Otherwise only installed native scalar completion registers readiness, before delivering activation. The existing recursive readiness predicate requires validation and activation for all constituents. Existing readiness subscription releases child listeners before callback. Enrollment is deduplicated by requirement identity; callback deletes its enrollment marker before normalizing. If enrollment or activation throws, both stages are attempted and the first error is preserved. Outstanding synchronous scalar completion/horizon work owns the temporary registration; replacement/Link disposal/owner settlement does not cancel surviving aliases prematurely. The bounded horizon audit supports this scope, not arbitrary realization or non-scalar completion.

Normalization computes exact publication proof and recursive retirement classification while ancestry is present, then replaces the getter with a data property and removes components **on the same requirement object**. It neither replaces nor reinstalls endpoints/views. OwnerCells and D/I/V/W, terminal bits and uncertainty flags stay intact. Root retirementOwnWindowOnly remains untouched. The retirement summary preserves static blockers (including actual-role presence even if confirmed) and identity-ordered qualifying own-window cells. Existing entity retirement reads that summary and evaluates current outcomes/source registry identity using existing ownerCellCanTransition. Entity construction, source-composite enrollment, completion.support, and non-scalar completion are unchanged. Generic recipient/observation composites also remain unnormalized.

## Preserved runs, not additive pass totals

| Run | Result | Meaning |
| --- | --- | --- |
| runs/first-gate | 7 tests / 2 files pass | Original first attempt: derived0/1/2/4 useful terminal control plus six lifecycle/summary controls. Root traversal did not yet follow summary weak-map edges. |
| runs/first-gate-complete | 8 tests / 2 files pass | Same controls plus no-recipient disposal during open horizon; graph includes summary weak-map edges. This supersedes completeness of the first diagnostic, not its raw record. |
| runs/unchanged-focused | 27 tests / 6 files pass | Uninstrumented frozen source: equal-owner-admission, equal-owner-selection-companion, terminal-owner-possible-refresh, terminal-owner-actual-contributor, saved-inspection-snapshot-isolation, equal-owner-current-input. All original files/assertions unchanged from C25. |
| runs/source-types | exit0 | Pinned `pnpm exec tsc --noEmit -p tsconfig.typecheck-all.json` on frozen uninstrumented source. |

Every worker run records exact command, PID/group, raw first.log, exit, timeout and source hashes. Pinned Node24.15.0/pnpm10.17.0; per-run Nx/cache/temp; 180-second owned-group cap. No timeout or assertion/compiler failure occurred. Historical archived-tsconfig extends warnings are present in Nx logs, not suppressed or repaired. No performance conclusions.

Main separately reports 22/22 frozen replay exit0/sourceUnchanged under runs/main-frozen-replay. This overlapping independently selected subset is **not added to worker counts**. Its source/result record remains owned by Main. Independent source and lifecycle review are pending; this report supplies no preferred acceptance verdict.

## Finite ancestry evidence

`research/ROOTS-FIRST.jsonl` preserves the first graph; `research/ROOTS-FINAL.jsonl` includes retirement-summary edges. Final observations:

| Closed derived writes | Selected nodes / depth | Enumerated requirements | Enumerated component edges | Frames / inputs |
| --- | --- | --- | --- | --- |
| 0 | 1 / 0 | 8 | 2 | 0 / 0 |
| 1 | 1 / 0 | 11 | 4 | 0 / 0 |
| 2 | 1 / 0 | 14 | 6 | 0 / 0 |
| 4 | 1 / 0 | 14 | 6 | 0 / 0 |

Selected scalar proof has no getter/components at each sample; the test asserts this and exact two-owner preservation. The original behavioral assertion is unchanged: no early sends, p.confirm alone insufficient, q.confirm produces exactly [{x:7,y:0}], then settled completes; exact updater calls and zero value notices also remain asserted. Source endpoint/requirement identity changes on new derived installation as before; in-place normalization does not claim retaining the previous installation's endpoint identity.

Other enumerated roots include source/view/saved snapshot, recipient structures/facts, lifecycle registries and transaction effect roots. Their 2→4 equality is an observation, not a universal heap/GC bound or a claim every remaining composite is normalized. Initial-to-2 growth is reported, not discarded. No new numeric budget was invented. No64/256 runs, distinct-owner-history experiment or broad suites were run. Terminal-owner identities intentionally remain; fixed-owner ancestry is a separate question from owner-history retirement.

## Lifecycle evidence and remaining limits

The focused controls execute both activation-before-finish and finish-before-activation, same-identity alias closure, readiness callback throwing while later callbacks still run, reentrant declaration from a readiness callback, exact callback sentinel/invalid proof preservation, no construction-time listeners for an uninstalled unit, generic composite exclusion, all-ready scalar summary classification, and source closure after Link disposal within the horizon. The latter preserves the installed root with two actual owners and no recipient. Unit-level lifecycle cases use existing private preparation/installation primitives explicitly; they are not represented as public API tests.

Uninstalled construction with zero listeners is not an exhaustive supported late-preparer-failure test. Dynamic retirement-summary equivalence across all45 model cases, arbitrary failure routes, non-scalar activation, and all alias/GC roots are not newly qualified here. Independent lifecycle controls are being prepared separately by Tesla. Malformed/private-mutated requirement graphs, process termination, resource exhaustion and nonreturning callbacks remain outside the supported scalar unwind premise. No hidden early-ready substitution or recipient-only cancellation was added.

## Reproduction and freeze

`runtime.patch` applies only production delta to C25. `research/first-gate-instrumentation.patch` applies after it and contains diagnostic exports plus both focused specs; set a new ST_ROOT_OUTPUT and use run-focused.py's recorded commands on a disposable review copy. Do not apply it to this frozen candidate. `research/uninstrumented/` preserves the three relevant runtime files plus instrumentation-touched transaction/selection files before diagnostic injection; freeze.py restored those exact bytes. First and complete run source manifests remain separate. New research specs are not promoted into ordinary discovery by this prototype.

`SNAPSHOT-C26.json` and `FREEZE.json` preserve the first frozen source identity; `POST-RUN-IDENTITY.json` verifies it after worker checks. Original C25 files, tests, raw failures and excluded non-scalar evidence remain untouched. Source edits are closed. Hold for independent focused review before any further diagnostic or implementation change.
