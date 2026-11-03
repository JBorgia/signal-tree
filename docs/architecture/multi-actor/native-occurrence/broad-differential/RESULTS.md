# Completed frozen-source differential

Disposition: c47b is not qualified. Four unchanged assertions regress: three kernel hidden-collection rollback cases (transactions alone, transactions first, restoration first) and the Vue hidden-row rollback case. All four pass on 057c and fail on c47b in both full runs and focused exact-source replays. No runtime or fixture repairs were made.

## Exact source identities

These are source-manifest SHA-256 identities, not Git commits.

- Predecessor: `057c6b8f4933eca5dbb3c0c31c069612264998b66e71c9e49ddd1a933edddad3`, original `/private/tmp/st-native-explicit-handoff-successor/candidate`.
- Successor: `c47b821c5a805f5b37d6c0f5707098d9871fdf2575d22dcc3e12f4a4c93c81db`, original `/private/tmp/st-prepared-paired-successor/candidate`.
- Verification copies and all logs: `/private/tmp/st-native-broad-differential/{predecessor,successor}`. `POST-REPLAY-SOURCE-UNCHANGED.json` confirms all manifest entries in both originals and both copies after focused replays.

## Actual assertion inventory

| Scope/source | Ordinary passed | Expected-failure tests reported passed | Failed | Skipped | Unexecuted pending | Total |
|---|---:|---:|---:|---:|---:|---:|
| Kernel predecessor | 6352 | 5 | 95 | 12 | 10 | 6474 |
| Kernel successor | 6387 | 5 | 98 | 12 | 10 | 6512 |
| Angular, each | 245 | 0 | 3 | 3 | 0 | 251 |
| React, each | 82 | 0 | 3 | 0 | 0 | 85 |
| Vue predecessor | 180 | 0 | 3 | 0 | 0 | 183 |
| Vue successor | 179 | 0 | 4 | 0 | 0 | 183 |
| Solid, each | 112 | 0 | 3 | 0 | 0 | 115 |
| All predecessor | 6971 | 5 | 107 | 15 | 10 | 7108 |
| All successor | 7005 | 5 | 111 | 15 | 10 | 7146 |

The five explicit `.fails` cases are four provenance-spike cases and one open-key-reachability case. All five actually report passed on both sources; these are expected-failure successes, not ordinary behavioral passes. See `EXPECTED-FAILURE-ACTUAL-STATUS.json`.

The same ten assertions in entity-large-batches.spec.ts remain pending/unexecuted on both sources. They are not expected failures or declared skips. `SUITE-ERRORS.json` contains no reported suite messages explaining them; the suite itself reports passed despite those pending assertions. Cause is undetermined; no timeout/hook/OOM diagnosis is asserted. See `UNEXECUTED-ASSERTIONS.json`. Fifteen declared timing-gated skips are separate (12 kernel, 3 Angular; ST_PERF unset).

Identities include project, relative file, fullName, and duplicate occurrence ordinal. Each source has 19 assertions beyond the first duplicate name: 8 kernel, 2 Angular, 9 Vue; all pass. None were collapsed. See `DUPLICATE-IDENTITY-LEDGER.json` and both `*-TEST-IDENTITIES.json` files.

## Changed and shared results

`VERDICT-DELTA.json` records 44 changes: four passed-to-failed regressions, 39 added passing assertions, and one removed passing private-helper assertion. Three fixture files changed, seven were added, none were removed. The removed assertion belongs to the obsolete ambient helper in native-invocation-handoff.spec.ts; the changed invocation fixtures port private timing/semantic error-cause controls. Added research assertions were executed, not ignored. `FIXTURE-DIFF.json`, `INVENTORY-CLASSIFICATION.json`, and `OUTSIDE-TARGET-INVENTORY.json` distinguish executable fixtures, archived/configuration records, and files outside the five authorized targets.

There are 107 shared failed identities: 95 kernel plus three each Angular, React, Vue, Solid. `SHARED-FAILURES.json` preserves both raw messages; `SHARED-FAILURE-GROUPS.json` groups by file. A shared failed verdict alone is not proof of identical cause.

The specifically requested rich committed-entity selected-unit case fails identically in focused predecessor and successor replays: the capture callback sees right-row values 50/60 instead of completed inverse values 11/12. This concrete failure is inherited from 057c. See `{predecessor,successor}/committed-capture-focused/first.log`; no assertion was changed.

## Regression cause classification

The hidden-row failures are a new selected-route target-resolution/admission regression. The selected preparer rebuilds `indexPointOwnerPaths` from current enumerable root membership; omission removes the collection from that lookup. `resolveCurrentSubjectTarget` consequently cannot find the retained owner and `applyEffect` refuses with `Missing live leaf ...`. The incumbent adapter retains its source owner index. This is not evidence that the entity lifetime expired, nor demonstrated disclosure of hidden rows. `FIRST-REGRESSION-TRACE.md` records exact source hooks; runtime branch-map instrumentation was not added. Independent review is `/private/tmp/st-hidden-collection-independent-review/REVIEW.md`.

Focused replays: `{predecessor,successor}/vue-hidden-focused` and `/kernel-hidden-focused`, with exact commands, fixture hashes, first logs, and JSON results. Vue: predecessor 1 pass vs successor 1 failure; kernel: predecessor 3 passes vs successor 3 failures. Name-filtered remaining cases are not counted as full-suite declared skips.

## Reproduction and limits

All ten full commands completed and produced JSON: `corepack pnpm nx test <kernel|angular|react|vue|solid> --skip-nx-cache --reporter=json --outputFile=<unique path> --maxWorkers=2`. Each command, result and first log is retained under its source/project directory. Node 24.15.0 and pnpm 10.17.0; exact shared dependency versions are in `IDENTITIES.json`. Kernel runs were serialized to preserve fixed diagnostic outputs; originals were restored. No watchdog interruption occurred.

Full commands exited nonzero; all assertions above come from raw assertionResults, not deduplicated names or misleading aggregate pending totals. This is correctness evidence only: no performance, heap, budget, activation, or broad acceptance claim. Source remains frozen. Main owns archival and disposition; no further correction proposal or tests were added in this handback.
