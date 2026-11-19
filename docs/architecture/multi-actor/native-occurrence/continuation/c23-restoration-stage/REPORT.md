# C23 first-case stage diagnostic — externally cancelled, qualification open

Source: exact C23 manifest bc8926949819af2cab3b716b71a04b6f3f97a6be5117b954bbfa236b66dec90b. Frozen source and private copy verified across all 3,067 files before/after, with only the explicitly hashed stage-marker spec differing in the diagnostic copy. Root/frozen source untouched. Original failed qualification remains at ../st-c23-restoration-full-independent; its full evidence hash inventory reverified unchanged.

## Bounded result

One fresh-process Nx invocation selected ONLY `jumps across a turn that cleared more rows than the argument limit` in the original restoration file. 130,000 rows, original assertions/imports/timeouts and async sequence preserved; added imports are node:fs/node:v8 solely for output. Removing the helper and marker statements reproduces the original spec byte-for-byte. The second case remains byte-exact and unselected. No GC, additional tree reads, native runtime edits, scaled rerun, or subsequent large run.

Direct synchronous markers establish module evaluation and test-body entry. Seed/drain, update/drain, clear/drain, reader history-length assertion (2), and current-index assertion (1) completed. Last marker: `before-undo`, immediately preceding `tree.jumpTo(0)`. No after-undo marker: the owned process was cancelled without a return from that call. Undo row/write/read/order assertions, redo, and finally cleanup were not reached. No semantic assertion failure or Vitest timeout report was emitted. No exact undo/redo counters observed.

The independent reporter emitted only init/config/module-start throughout, never case-ready/end. Thus absent case-ready does NOT imply import blockage: this diagnostic proves test-body execution despite those missing reporter events. It does not retroactively establish the phase of the original uninstrumented run.

## External bound and cleanup

Corrected runner consumes complete append-only records from both reporter and stage streams. It translates event epoch age to monotonic time, retaining the latest timestamp; delayed reads cannot extend the deadline. No fixed launch/active-case ceiling is used. Deadline arithmetic controls recorded in DEADLINE-CONTROL.json. Watchdog fired 180.3023 seconds after before-undo, recorded in WATCHDOG.json. Prior qualification caveat remains separate: its old helper used 180 seconds from launch / only165.513 seconds from module-start.

Owned groups 31403 and32016 received TERM using the reused birth-matched descendant tracker. Initial RESULT.json truthfully retains ownedDescendantsRemain:true: Nx PID31421 and a zombie were still present. On explicit owner authorization, a fresh birth check matched PID31421 (Mon Nov2 14:41:53 2026, group31403); only this surviving live Nx process received SIGKILL. Final census in CLEANUP-FINAL.json is empty. Worker32067 had already exited after TERM. No other processes touched; no retry.

## Memory and environment limits

Node24.15.0 / pnpm10.17.0; forks, isolate=true, maxWorkers=1, happy-dom. Worker V8 heap limit4,496,293,888 bytes; argv/env/startup recorded. No heap-limit override. Marker readings below are point samples, not peak memory or a stall-end heap measurement.

| Marker | RSS bytes | heapUsed bytes |
| --- | ---: | ---: |
| module-evaluated | 121061376 | 43484472 |
| before-seed | 120242176 | 44146328 |
| after-seed-drain | 795820032 | 664462856 |
| after-update-drain | 796147712 | 664630896 |
| after-clear-drain | 1108033536 | 829360920 |
| after-reader | 1108164608 | 829418472 |
| before-undo | 1108180992 | 829454272 |

Main reported physical32GiB, swap23,271.5MB used of24,576MB, compressor830,947 pages of16KiB during this run. Saved as attributed observation in HOST-CONTEXT.json, not independently measured or a causal finding. No OOM evidence, heap-exhaustion conclusion, algorithmic-complexity attribution, timeout-regression claim, or performance comparison follows from these data. Qualification remains environment-qualified/incomplete.

## Evidence

STAGES.patch / ORIGINAL.spec.ts / INSTRUMENTED-SHA.json preserve exact instrumentation. run-once/COMMAND.json gives exact command/environment; first.log preserves first output; stages.jsonl contains every direct marker with memory; events.jsonl and nodes.jsonl preserve reporter/start config; ownership.jsonl, SIGNALS.json and CLEANUP-FINAL.json preserve process identities and cancellation. SOURCE-AFTER.json reports no mismatches. No additional workload is proposed or run.

Preparation note: the initial sandboxed copy-preparation process was stopped and resumed with direct filesystem access before any diagnostic invocation. This was not a test retry. The single run's hash verification completed before launch and again after cancellation.
