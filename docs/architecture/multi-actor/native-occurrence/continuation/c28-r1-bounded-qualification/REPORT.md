# Exact C28-R1 bounded qualification — runtime selections pass; spec types fail

Source manifest: `9805ab2fae49202a334ef506c71a3583ff0f8dfebec51e8b27d992b23971653b`, copied from /private/tmp/st-c28-r1-current-capture/candidate. **All 3,090 manifest entries verified.** Candidate and frozen input hashes match afterward. Every selected test is byte-identical to the archived C27/C26 command's test file (TEST-IDENTITIES.json). No source, test, oracle, config, public surface or budget edits.

| Exact archived selection / gate | First result |
| --- | --- |
| C27 focused-first: eight kernel files | 54/54 pass |
| C27 remaining-failure replay: nine kernel files | 59/59 pass |
| Source types: tsc --noEmit -p tsconfig.typecheck-all.json | exit0 |
| Public types: tsc --noEmit -p packages/kernel/tsconfig.typecheck.json | exit0 |
| Spec types: tools/check-spec-types.mjs | **exit1: five errors, three files** |
| C26 Angular facade selection | 8/8 pass |
| C26 React facade selection, including existing target typecheck | 8/8 pass |
| C26 Vue facade selection | 8/8 pass |
| C26 Solid facade + saved-snapshot selection | 10/10 pass |

The requested runtime selections total **147 passing cases across22 files** (113 kernel +34 framework). No failed runtime assertion or approved-policy-mismatch assertion occurred in these runs. Spec-type failure prevents a fully green qualification result.

## First failure classification — unchanged and unresolved

[runs/spec-types/first.log](runs/spec-types/first.log) is the first complete compiler output. The unchanged gate reports each affected file exceeds its zero-error baseline:

- cached-current-input.spec.ts:56: TS2783 twice, explicit `name` and `message` precede `...error`, which can overwrite them.
- opaque-current-input.spec.ts:6: TS2783, explicit `message` precedes `...error`.
- current-capture-r1.spec.ts:16 and :35: TS2322, object-valued updateAndReport supplies a nested function where its public argument type requires the corresponding value object. types.ts:309 currently accepts `Partial<T> | ((current:T)=>Partial<T>)`; it does not type recursive property callbacks in this argument.

The three duplicate-property errors concern diagnostic serialization. The two callback errors expose fixture/public-type incompatibility; this run does not decide whether that private runtime route should be represented differently in research or admitted publicly. Neither category is an old approved policy-mismatch oracle, nor proof of runtime failure. No cast, assertion alteration, type change, ratchet or retry was applied. These capture fixtures were compiler-checked, not separately runtime-replayed here: author A/B, retention and reentry qualification remains separate.

## Reproduction and containment

Each runs/<gate>/COMMAND.json contains exact argv, own cwd, archived command path, pinned Node24.15.0/Corepack pnpm and every task-set environment variable. ST_PREPARED_REVIEW_OUTPUT, ST_PUBLIC_DIAGNOSTIC_OUTPUT and ST_C21_DIAGNOSTIC_OUTPUT point to that run's private output; inherited ST_* variables were cleared. The prior diagnostic redirect helper is unchanged and hashed. Own Nx cache/data/TMPDIR, maxWorkers1, sequential launches; no overlapping builds/tests or duplicate attempts. Existing startup resolution warnings remain in raw logs.

Every gate has untouched first.log, PROCESS.json and RESULT.json. All nine runs completed before the external180-second owned-group watchdog, and all owned groups are absent. Full source hashes were checked before/after runs; FINAL-IDENTITY.json additionally verifies frozen input unchanged. RESULTS.json records exits/counts without conflating compiler exit with test assertions. EVIDENCE-SNAPSHOT.json binds logs, commands, identities and report.

No 130k case, full suite, build, GC replay, additional A/B or retention/reentry experiment. No performance or release claim. Main owns any subsequent correction/composition; this frozen replay preserves the first spec-type failure for review.
