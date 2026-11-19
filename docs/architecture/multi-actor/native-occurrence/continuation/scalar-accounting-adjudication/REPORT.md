# C1 scalar work and hidden collection oracle adjudication

Read-only runtime review. Recommendation: accept a narrowly justified companion for the three hidden-collection reason assertions. Do NOT close the scalar work case with an oracle-only change: removing its stale point-read expectation exposes missing frame installation counters. Originals remain byte-identical; no runtime/cost ceiling edits.

## Identity / baseline

Copied all2974 files from frozen C1 `/private/tmp/st-native-combined-c1/candidate`, verifying SNAPSHOT-C1.json SHA256 `bac3ad33b8eee7bd0e5851461de9b95fd3144d26e3f6db70d84193a70c76179f`. Own copy is this directory/candidate. FINAL-IDENTITY.json records final verification and additional diagnostic specs.

Census case34 and44–46 were already red in original combined `f3bb2ef22fce1d0890cd791e599ac9284288f58e28c6406167547a870c9f0e79`. Independently inspected recorded differential failures on predecessor `057c6b8f4933eca5dbb3c0c31c069612264998b66e71c9e49ddd1a933edddad3` and paired successor `c47b821c5a805f5b37d6c0f5707098d9871fdf2575d22dcc3e12f4a4c93c81db`. Exact four identities/stacks preserved in BASELINE-RECORDED-FAILURES.json. This review did NOT rerun those older sources. Their Nx command receipts are in `/private/tmp/st-native-broad-differential/{predecessor,successor}/kernel/COMMAND.json` (test kernel, JSON reporter, maxWorkers2).

Both original fixtures match byte-for-byte across all four sources: scalar `f4245476f7cc67ecc2016690d1c2a01383c44af9985c566fa3d60e4f9657acc4`; omission `e88ef703666602c20ba6874d42c25657b3dda235f0f591753c7e691b09167e9c`. FIXTURE-IDENTITIES.json and READ-EVIDENCE-SHA256.json retain the comparisons and raw evidence hashes.

## Exact C1 replay

Node24.15.0, corepack pinned pnpm, Nx no cache, maxWorkers1. Every runs/* has COMMAND.json with cwd/env/argv, first.log and RESULT.json. Fresh ST_PREPARED_REVIEW_OUTPUT per run.

`runs/originals`: `corepack pnpm nx test kernel --skip-nx-cache production-scalar-substrate.benchmark.spec.ts designated-collection-omission.spec.ts --testNamePattern='proves compiled scalar reads and writes stay constant|refuses, typed, when the collection changed while omitted' --maxWorkers=1`. Exit1, exact4 failed,78 filtered/skipped. No downstream pass inferred.

`runs/companions-first`: same filters on separate scalar-oracle-companion.spec.ts / omission-oracle-companion.spec.ts. Only point-write slotReads expectation changed1→0; hidden cases assert precise typed validation cause plus omitted-row message. Exit1: three omission cases pass; scalar progresses to first frame-width2 and fails on missing slotWrites/revisionIncrements.

`runs/scalar-snapshot-counter`: scalar companion with copied stats `{...stats}` at assertions. Exit1, first width2 at size10: expected slotWrites2/revisionIncrements1, actual0/0. All other vector fields match. This avoids reporting a live mutable counter object: original failure rendering also displayed publicationDependencyReads1, whereas the snapshotted failure has0. Do not attribute that reporting-time increment to the measured write.

`runs/counter-diagnostic`: exit0, two diagnostic tests for direct frame.commit and prepareCommit installer. Values become10/11, changedSlots contain both slots, runtime revision advances by1; captured counters nonetheless say writes0/revisions0, equalityChecks2. Passing diagnostic certifies instrumentation failure, NOT a zero-cost budget.

`runs/omission-public-controls`: unchanged original positive restore and public add-while-omitted refusal controls, separate from private producer reason adjudication. See result/log for exact count.

## Scalar adjudication and correction

Source tree-scalar-leaf-runtime.ts:143 routes stored reads through readRecordSlot, while public read uses readSlot. location-runtime.ts:478 reads before only when a mutation observer/publication preparation exists. tree-scalar-slot-runtime.ts:246 increments slotReads only in readSlot; readRecordSlot and commitRecorded use private slot storage. Thus a plain point replacement can correctly have zero counted readSlot calls. This is not a claim of zero internal value accesses or general performance improvement. Exact other counters and read result remain required.

The original stops at the FIRST size10 point-write vector. It does not execute the frame vectors or later sizes100/1000/10000/100000. The companion reaches width2 and exposes a real measurement defect: tree-scalar-slot-runtime.ts:195–215 prepareSlots installer assigns values and advances revision without recording slotWrites/revisionIncrements. commitSlots now delegates to that installer; equality accounting remains in collectSlotChanges. The writes and revision do occur, proved independently.

Action for Main: restore instrumentation at the actual prepared installation sites, counting each installed changed slot and each actual revision advance (respect advanceRevision:false, no-op, stale/reentry refusal and prepare-without-install). Do not count planning as installation or change expected frame budgets to zero. Separately justify point-write readSlot expectation0, preserve public read expectation1, and snapshot counters before diagnostic reporting. Re-run unchanged frame vectors through all sizes plus prepared/discard/stale/no-op controls after the counter repair. No runtime implementation supplied here, no raised ceiling.

## Hidden collection adjudication

The fixture's changeRetainedRows (designated-collection-omission.spec.ts:110) is deliberately a private producer: readSource→prepareTarget→install→publish, not a public authored write. readTransitionSource (entity-signal.ts:646) supplies no admittedEffects. prepare-entity-target.ts:168 prepares ordinary realization from `target.admittedEffects ?? []`, therefore no ordinary facts; publish at:299 still announces physical truth with explicit empty ordinary changes. Transactions projection (:4006, :2079) consumes only those ordinary entries; an empty list must not synthesize a later authored dependency from physical payload. Restoring notifier fallback to force the old reason would violate that boundary.

Rollback independently checks changedOmittedCollection in transactions.ts:3694 before restoration installation. plain-branch-membership.ts:715 compares retained physical rows against omission-time rows, excluding the reversal's own touched rows/order. C1 throws the precise typed `effect-validation-failed`: entity collection at g.rows was omitted and changed; re-adding would not restore it as it was. This is the required safety refusal, not a missing refusal or successful unsafe restoration.

Current in-tree authority supports this exact distinction: docs/audits/2026-10-01-v16-integration/PROGRESS.md:2665–2678 explicitly requires this rollback guard with effect-validation-failed. docs/guides/composition-recipes.md:353–372 requires refusal to preserve state/pending authority and explains later-confirmed-dependency for actual newer overlapping work. The original test's comment that private replay necessarily reaches dependency refusal first is stale relative to source-owned ordinary admission. This does not authorize changing reasons for actual later public/transaction dependencies.

Recommended companion: preserve original test file; use precise cause.kind effect-validation-failed and specific omitted/changed collection message for these three private-producer cases. Separate companion passes all three enhancer orders, then reaches BOTH original downstream public hidden-state assertions and successful pending.confirm(). Thus refusal leaves public reads absent and confirm remains usable. No universal retry/reveal/lifetime claim. No new reason semantics/API needed.

Files: companions.patch records only separate fixture deltas; failed scalar companion source from first run preserved in runs/companions-first/scalar-fixture.ts. Originals and runtime untouched. No full suite, type/build, performance or release acceptance claimed.
