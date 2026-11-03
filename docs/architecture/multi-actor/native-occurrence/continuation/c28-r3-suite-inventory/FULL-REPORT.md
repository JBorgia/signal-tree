# R3 unchanged full-five-suite first-failure characterization

**All five Nx targets launched once. Four framework suites completed and failed; kernel was externally stopped for180 seconds without reporter progress. No retry or correction.** Exact3,095-file manifest `e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3`; all copied and frozen files remain unchanged.

| Project | Ordinary pass | Ordinary fail | Expected failure satisfied | Skip | Completed/discovered files | Outcome |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| kernel | 5015 | 19 | 4 | 12 | 279/638 | watchdog; incomplete |
| angular | 301 | 1 | 0 | 3 | 52/52 | exit1; complete |
| react | 104 | 4 | 0 | 0 | 19/19 | exit1; complete |
| vue | 222 | 1 | 0 | 0 | 34/34 | exit1; complete |
| solid | 135 | 1 | 0 | 0 | 22/22 | exit1; complete |

Totals observed:5,777 ordinary passes,26 ordinary failures,4 satisfied expected failures and15 skips. No observed todo or failed expected-failure-marked case. These are observed results, **not** a completed765-file aggregate. Reporter flags keep it.fails successes separate from ordinary passes. Skips retain existing policies; no new skips/xfails/filters. Kernel279 completed +one started incomplete +358 not started. Four frameworks cover all127 discovered files. Thus406/765 files completed, no unexpected files.

## Kernel containment and coverage boundary

The last recorded event is a PASS for entity-large-batches.spec.ts → “setAll, replace and clear with membership observed”. No subsequent case-start/end or module-end arrived within180 seconds. WATCHDOG.json records that event and no-progress trigger; exact execution phase afterward is unknown. Do not infer which source operation stalled from test order. The first large membership case passed, but the file/suite did not complete. No timing superiority, complexity or resource-exhaustion diagnosis.

Kernel child exit -15; birth-matched owned descendants received termination, subsequent census is empty. SIGNALS.jsonl preserves actual signals. No global kill or unrelated process intervention. Framework-only supervisor then ran the remaining explicitly authorized suites in fresh groups, sequentially, after containment. Each exited1 for ordinary failures, no watchdog; all groups absent. PREREGISTRATION.md records both original bounds and this post-kernel continuation decision.

## Actual failure disposition, not acceptance

[FULL-FAILURE-LEDGER.json](FULL-FAILURE-LEDGER.json) lists all26 exact cases, source test hashes, full errors/stacks and raw log/event paths.

- **Four preregistered historical conflicts observed:** three React branch-declaration-qualification cases expected held/conservative but got no-write; kernel dependent ancestor receipt expected held but got validating. Preserve the prior receipt/recipient-domain adjudications; these observations do not authorize editing originals or count as passes. Later assertions after each first hard failure are not claimed.
- **Seven shared-admission errors:** three kernel whole-value-new-keys cases plus one whole-value-new-keys case in each framework throw `Scalar selection requires prepared admission`. Cross-facade reproduction is real execution evidence; cause, affected boundary and regression introduction require independent source review. Not dismissed as old oracle conflicts.
- **One real counted-work failure:** entity-granular-reactivity single-entity update records13,000 with unchanged <2,000 assertion. No threshold change or new measurement campaign.
- **Fourteen other first failures remain unclassified:** restoration spy counts2, nested transaction authorship1, transaction-observer failure/recovery5, opaque-terminal recovery3, transaction-lifecycle refusal1, external ABA safety1, Link refusal/commit ordering1. Raw errors identify missing calls/recovery, value mismatch or absent refusal. Do not infer runtime versus stale-injection cause from titles; no repair attempted.

## Evidence and exact scope

Each full-runs/<project>/ has COMMAND.json, PROCESS.json, first.log, events.jsonl, CASE-LEDGER.json, FAILURES.json, SUMMARY.json, SOURCE-BEFORE/AFTER.json and RESULT.json. Commands are `corepack pnpm nx test <project> --skip-nx-cache --maxWorkers=1 --reporter=default --reporter=<own output-only reporter>`, without file/name filters or additional exclusions. Full discovery lists remain in discovery/. No source/test/config edits. All765 ordinary discovered files were eligible; unexecuted kernel remainder is explicitly listed, never counted passed.

Own pinned Node24.15.0/pnpm, cache/data/TMPDIR. COMMAND records all output env; required prepared/public/two-history/equal-owner sinks supplied. Known absolute diagnostic writes redirected by the unchanged helper into per-run output. Angular retains its target NODE_OPTIONS=--expose-gc; React/Vue/Solid retain their target source/spec compiler prechecks, all reached Vitest. Existing retention routing remains separate. The inherited equal-owner research spy is nontransparent to the sixth selection argument; any recorded counts are not a retention gate. Reporter/module status enumeration changes no assertion.

No suite retry, source/API/oracle/budget fix, broader build/artifact/cost run, or release acceptance. Current focused147 success does not supersede this failure ledger. Main owns causal delegation and any later routing/implementation correction.
