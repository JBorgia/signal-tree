# C21 GC routing successor — bounded review candidate

**Baseline 12/12 arms pass; both required mutants fail at their intended assertions.** Exact discovery changes ordinary 620→619 and GC 4→5, moving only src/lib/held-continuation-probe.spec.ts. This is executable routing proof, not exclusion-only success. No full-suite, runtime/public-semantic change, or composition.

## Change and identity

Separate exact C21 copy, excluding the independently prepared two-spec injection-forwarding patch. Five changed/added paths: ordinary Vitest config, retention Vitest config, existing forwarding runner, existing gate description, and one tools/lib matrix validator. All runtime and every original spec file remain byte-identical to C21. BASE-MANIFEST.json and SNAPSHOT-CANDIDATE.json preserve exact hashes; gc-routing.patch is the review delta. No root edits.

The existing forwarding-retention-gc gate still invokes tools/check-forwarding-retention.mjs. Its original nine arm/scenario pairs retain the same fixtures, commands, GC settings, assertions and per-child files. Three held arms are added in fresh sequential processes: hold-proceed, drop-proceed, hold-row. Their inherited scenario variable is removed. Both fixtures run under the shared retention config with explicit exact file filters and worker GC. No partial-arm command-line mode exists. Each invocation creates a fresh artifact directory.

The runner fails on child error/signal/nonzero status and checks original artifact identity, pinned Node and complete 12+12 boolean samples. The final matrix also rejects missing/duplicate/unknown modes, mismatched execution identity, missing/malformed/swapped artifacts, and failed child status even when its sampling artifact exists. Child assertions remain the semantic authority; artifact recording alone never passes a child failure.

## Executed verification

- Baseline: complete registered runner, 12/12 pass; RUN-SUMMARY.json and candidate/artifacts/forwarding-retention contain exact commands, all logs, samples, SOURCE.json and aggregate RESULT.json.
- Discovery: installed Vitest list --filesOnly --json before/after ordinary and GC configs, not source-glob guesses. DISCOVERY.json preserves complete sets. Sole movement is held-continuation; other 619 ordinary and four GC files unchanged. Raw commands/results in runs/discovery-*.
- Existing retained-tree mutant: a separate copy injects the same fixture mutation registered by verify-gates.mjs. Complete gate exits1: original nine forwarding cases fail receiver collectibility assertions; all three held cases pass. No source/runtime mutation in the review candidate.
- New held-positive mutant: separate copy retains box.positive during released sampling. Complete gate exits1: all three held cases fail the unchanged released-positive assertion; all nine forwarding cases pass. Both first logs, exact mutation text and all samples are preserved under mutants/ and runs/mutant-*.
- Matrix failures: actual recorded baseline rows are separately deleted, duplicated, artifact-swapped, assigned a missing artifact, assigned failed-child status, or given a malformed round. Seven small Node processes call the exact production validator: valid matrix exits0, all six malformed cases exit1. Commands/process exits and errors in matrix-falsifiers/PROCESS-RESULTS.json and per-case files. These are validator-process checks; they do not rerun GC or pretend to be full gate child executions.
- Existing gate --list exposes the updated coverage under the same gate name. Both new/changed JavaScript entry modules pass node --check. No spec-type run needed for unchanged fixtures; prior two-spec type evidence is separate and is not claimed for this candidate.

All GC gate launches used the external owned-group no-output watchdog; no deadline triggered. Commands retain pinned Node24.15.0 / installed dependencies, own Nx data/cache/tmp. All first outcomes preserved. Candidate manifest checked after baseline and mutants; no tracked candidate source changed during verification. No performance/CPU/heap-cost claim.

## Review boundaries

New held-positive is a separately executed qualification mutant, not an additional mutation schema change in verify-gates. The existing registered retained-tree mutant remains intact. Non-replay, explicit-row, and absent-GC mutants were not run in this successor: original corresponding assertions passed in all baseline arms, and the two required mutants plus matrix failure checks were the bounded mutation scope. No universal reclaimability inferred.

Independent review/coordination with McClintock remains pending. Current tool inventory did not identify that reviewer; automatic approval review rejected sending scratch details to another unverified destination. No indirect message was sent. A verified reviewer thread ID is needed to deliver this packet. No preferred independent verdict is supplied.
