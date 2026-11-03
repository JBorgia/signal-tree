# Parent freshness test promotion

Promote exactly SIX new normal test files. This validates Main's proposed set. No runtime edits; no new reentry policy, skipped tests or xfail. Tested against the accepted frozen C8 proof runtime, not Main's later C9 composition.

## Normal promotion set

| Exact repository path | Cases | Authoritative regression assertions |
| --- | --- | --- |
| packages/kernel/src/lib/parent-snapshot-currentness.spec.ts | 5 | Ordinary/keyed completion freshness and retained child writes; ancestor/sibling identity; no-repeat churn; calibrated no-demand derived-work control. |
| packages/angular/src/lib/parent-snapshot-currentness.spec.ts | 5 | Same completion/identity controls; actual native signal identity and warmed computed delivery distinction. |
| packages/kernel/src/lib/parent-freshness-focused.spec.ts | 7 | Prepared-slot/currentness discrimination; new-child dependency retention; dormant equal-value reactivation; supported symbol-store ancestry; no-op/discard identity; refused preparation; direct replace/derive observer currentness. |
| packages/angular/src/lib/parent-freshness-focused.spec.ts | 7 | Same bounded controls with native mirror versus backing discrimination, preserved computed timing and native capture path. |
| packages/kernel/src/lib/parent-freshness-entity.spec.ts | 2 | Sorted/unsorted wrapper early identity, native/neutral delivery boundary, subsequent collection dependency, repeated-read comparator stability. |
| packages/angular/src/lib/parent-freshness-entity.spec.ts | 2 | Same wrapper/dependency/identity contracts with actual Angular computed. |

The six files contain 28 tests (14 per facade). Keep existing `construction-resource-cleanup.spec.ts` and `keyed-construction-cleanup.spec.ts` in BOTH packages; these are already baseline files, not part of this six-file addition. Existing kernel `marker-snapshot-memo.spec.ts` and `snapshot-builder.spec.ts` also remain unchanged and were included to reproduce the prior kernel42/angular18 selection.

The symbol assertion is the existing supported backing-store form, not a newly invented public symbol-write API. Instrumented builder-work assertions retain their original scope; output omission does not weaken the counters or identity checks.

## Research-only inventory — preserve outside the normal test tree

| Exact paths | Disposition and reason |
| --- | --- |
| packages/kernel/src/lib/bounded-reentry-baseline.spec.ts; packages/angular/src/lib/bounded-reentry-baseline.spec.ts | Paired characterization: records throws, straddling values, invocation counts and inherited failures. Passing harness does not establish freshness or a public reentry result. |
| packages/kernel/src/lib/bounded-reentry-targeted.spec.ts; packages/angular/src/lib/bounded-reentry-targeted.spec.ts | Targeted characterization of recovery triggers, warmed marker reentry and native cycle behavior. Do not turn observations into new mandatory semantics. |
| packages/kernel/src/lib/parent-freshness-callbacks.spec.ts; packages/angular/src/lib/parent-freshness-callbacks.spec.ts | Ungrouped paired C8/candidate callback/error traces. Interpretation depends on raw JSON and verifier, not standalone harness exit. |
| packages/kernel/src/lib/parent-freshness-grouped.spec.ts; packages/angular/src/lib/parent-freshness-grouped.spec.ts | Grouped paired traces, including deliberate visibility/error/count differences. Preserve comparison evidence rather than promoting a weakly asserted diagnostic as a full acceptance test. |
| packages/kernel/src/lib/construction-completion-snapshot-review.spec.ts | Original completion diagnostic: asserts sentinel/reachability, writes snapshots, but does not assert their freshness. Strong completion assertions are already in parent-snapshot-currentness. |

All nine files are copied byte-for-byte under `research-only/` in this new scratch and absent from its candidate test tree. The original frozen files remain untouched in `/private/tmp/st-parent-freshness-resumed/c8-proof/candidate`. All C7a/C8 first fixtures, first errors, commands, paired traces and verify-proof.py remain preserved in their original external evidence directories. No research assertion was edited or deleted from those records; they remain reproducible research controls, not added normal regression policy.

## Only allowed helper changes

`parent-snapshot-currentness.spec.ts` already guards its diagnostic output environment variable; unchanged in both packages. `parent-freshness-entity.spec.ts` has no diagnostic output; unchanged in both packages.

Only each focused file's `save` helper changed: return without writing if `ST_PREPARED_REVIEW_OUTPUT` is absent; otherwise write the exact same JSON. No call site, test body, expectation, fixture, callback, sentinel, teardown or import changed. VERIFICATION.json checks full-file byte equality after reversing just those two helper substitutions, not merely an assertion count.

- `PROMOTE-TESTS.patch`: six complete file additions, suitable when Main has composed runtime only.
- `OPTIONAL-OUTPUT.patch`: two helper-only edits, suitable when Main already has the six frozen proof files. Do not apply both blindly.
- `promote/`: exact six-file payload with repository-relative paths.
- `INVENTORY.json`: machine-readable normal/research paths and input/output hashes.

## Validation without diagnostic output

The runner explicitly removes `ST_PREPARED_REVIEW_OUTPUT` from the subprocess environment for every command; exact argv/environment and raw first logs are in runs and COMMANDS.json. All assertions execute normally without diagnostic-output setup.

- Kernel prior selection: **42 passed** (the three promoted kernel files plus existing cleanup/memo/builder tests).
- Angular prior selection: **18 passed** (the three promoted Angular files plus existing cleanup tests).
- Unchanged spec-types ratchet: **pass**; baseline not updated.

Node 24.15.0 / pnpm 10.17.0. Only private copied dependency shims were relocated; no install. All candidate runtime/config files match frozen C8 proof; the frozen source manifest and evidence hashes were rechecked. Main owns C9 composition and should run these promoted tests there; these runs make no C9 qualification claim.
