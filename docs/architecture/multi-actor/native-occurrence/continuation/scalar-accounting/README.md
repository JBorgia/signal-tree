# Bounded scalar installation accounting successor

Base: exact frozen C1 `/private/tmp/st-native-combined-c1/candidate`, manifest `bac3ad33b8eee7bd0e5851461de9b95fd3144d26e3f6db70d84193a70c76179f` (2974 files). No C2 claim. New candidate only; frozen/root sources untouched. Main owns composition and independent acceptance.

## Runtime delta

Only `packages/kernel/src/lib/internals/tree-scalar-slot-runtime.ts` changes runtime source:

- Count each changed-slot assignment inside the prepared installer, after the assignment. Preparation, discarded work, equality failures and stale refusals do not invent installations.
- Count revision advances in the shared advanceRevision helper, after the actual local/shared clock advance. Remove the old commitRecorded-only increment to prevent double counting. Suppressed revision stays zero; authority-shadow-only revision advances remain counted even with zero physical assignments.
- Count the extra equality function calls made when inspection/ordinary shadow state exists, in both prepared and recorded paths. Count immediately before the actual callback, including when that callback throws. No callback/equality algorithm changed.

No public API, new counter, publication/commit policy, error behavior, slot storage, or cost ceiling change. The local/shared revision expression preserves the original fallback behavior.

Counter meaning is explicit: slotReads counts readSlot calls, not every internal array access. readRecordSlot, equality input accesses, and frame staging's internal readValue are not renamed into readSlot events. slotWrites counts actual physical slot assignments (including commitRecorded assigning an equal physical value for semantic admission); revisionIncrements counts this scalar runtime's actual local/shared clock advances, not arbitrary external clock use. equalityChecks counts actual equality-function invocations, not Object.is shadow bookkeeping. No speed/heap claim.

## Separate composition patches

- runtime.patch — actual event instrumentation only.
- accounting-tests.patch — eight new event tests.
- scalar-oracle.patch — approved point-write readSlot expectation1→0 and three counter-object snapshots at assertion time. All other expected counts, frame widths2/10/100, sizes10/100/1000/10000/100000 and20000ms timeout remain unchanged.
- omission-reason-companion.patch — separately applicable to the original omission spec: three enhancer-order private retained-row cases assert exact effect-validation-failed cause and specific omitted/changed path message. Both downstream hidden-state assertions and pending.confirm remain. No runtime change. Candidate keeps the original omission file unchanged and executes a separate companion file containing this delta; Main should apply the patch to its chosen fixture, not add a duplicate whole suite.

FREEZE.json contains final source-manifest and exact patch hashes. SOURCE-SHA256.json includes all baseline files plus new test files. CHANGED-SHA256.json lists exact deltas. Original fixtures preserved in original-fixtures/. BASELINE-UNCHANGED.json verifies frozen C1 remains identical.

## Failure chronology

`first-failures/originals` preserves C1's four unchanged original failures with exact command/source paths; scalar stopped at first point-write vector and omission reason assertions stopped before later checks. `first-failures/frame-counters` preserves the separate adjudication companion revealing frame writes/revisions0 at size10/width2. These were executed in the named adjudication copy, not retroactively attributed to this successor.

Before runtime changes, `runs/preregistered-red` executes the new tests on this exact copied C1: six failures/two passes. Missing prepared writes/revisions and shadow equality counts are real counter failures. Nx also logged an inherited archived-doc tsconfig reference warning; tests nevertheless executed, and their assertions—not that warning—explain the red result.

`runs/focused` was an interim successful24-test run. The revision helper was simplified while that process was active, so its result is not the final identity gate. `runs/final-focused` is the final source replay, with no subsequent source edits, and includes the three omission companions. Final outcome: exit0, 27 tests pass across four files; 78 tests filtered/skipped. See its exact RESULT.json/first.log.

## Commands and boundaries

All commands recorded under runs/*/COMMAND.json with cwd, argv and env; first.log/RESULT.json retained. Node24.15.0, pinned corepack pnpm; NX_DAEMON=false, NX_ISOLATE_PLUGINS=false, NX_TUI=false; fresh ST_PREPARED_REVIEW_OUTPUT per run.

Final test command:

```
corepack pnpm nx test kernel --skip-nx-cache scalar-install-accounting.spec.ts tree-scalar-slot-runtime.spec.ts production-scalar-substrate.benchmark.spec.ts omission-reason-companion.spec.ts --testNamePattern='scalar slot runtime|counts|stale install|reentry counts|ordinary authority-only|recorded shadow|proves compiled scalar reads|refuses, typed, when the collection changed while omitted' --maxWorkers=1
```

The eight new controls cover local/shared clocks, prepare-before-install, once-only installation, actual readSlot events, discarded frame, direct commit, advanceRevision:false, no-op, fresh equality throw, stale install after independent recorded write, equality reentry retaining nested write, ordinary authority-only frame, and recorded shadow comparison. Assertions also verify installed/uninstalled values and actual runtime revision; no passing counter-only surrogate for absent work.

Source types: `corepack pnpm exec tsc --noEmit --pretty false -p tsconfig.typecheck-all.json`, exit0.
Spec types: `node tools/check-spec-types.mjs`, exit0; existing ratchet unchanged. This is a ratchet pass, not a claim that every historical spec diagnostic vanished.

No broader suite/framework build, package/release, performance or retention qualification. Main should compose and independently verify the patches against C2 rather than treating this C1 manifest as C2.
