# Reader memory R1 — stopped at fifth invocation

R1 attempted five commands: four accepted invocations, then baseline2048 stopped by **no-progress180s** before any test events or memory samples. Exit -15; lastRecord=null; no surviving owned processes. No retries. **Reader2048, reader512 repeat, and baseline512 repeat were not started. This is not a completed eight-run campaign.**

## First stop and context

Raw first stop: R1/runs/baseline-2048-r1/{COMMAND.json,first.log,PROCESS.json,OWNED.json,WATCHDOG.json,SIGNALS.jsonl,RESULT.json}. Supervisor39643 launched command45004. The watchdog terminated only recorded birth-matched descendants, first SIGTERM then remaining matches SIGKILL. RESULT records remainingOwned=[] and unchanged source/test hashes. Supervisor subsequently completed final frozen-source checks and exited normally; that does not convert the child failure into a passed campaign.

The log reached Nx target/launcher output and contains existing historical tsconfig-path warnings; there is no reporter event or boundary sample. The post-signal Nx failure text is not a failed workload assertion. Classify this as startup/launch no-progress failure, not an entity assertion, heap stop or memory exhaustion result. Root cause is not established; similar historical warnings also occurred in successful invocations. Missing metrics in raw RESULT use controller zero placeholders; they are **not measured zero memory**. No favorable restart or timeout extension was made.

Earlier accepted invocations sometimes logged passing cases before Nx exited. Acceptance waited for actual exit0, complete receipts, cleanup and integrity checks. Their passing test logs alone were never the campaign completion condition.

## Identity and protocol

Frozen baseline8f902607f4e4f9fa31bda66c0b1c87ce3fe38a6c2b7a145c366498a5fc9d5333 versus reader812a3ad5d6843e95a791aaf001927d54f67738626360a50afb9f7871fdfcd302. Reader measurement selection42b24d55377490c7c51cf552004cd9141584d8ec8bfad075e2724afd6a55cfed excludes only its two packet diagnostic specs; frozen runtime/specs remain untouched. Runtime delta is exactly the three private-reader implementation paths. Imports resolve from each identified source arm; shared installed node_modules symlink is explicit. This is source Nx/Vitest evidence, not built-package qualification.

R1/PREREGISTRATION.md, IDENTITY.json and COMMANDS.json were recorded before R1 launch, after independent qualification of controller1d79497f61728e1f33ec300d05058cc2399f568eec71680226d0dd8034eb0344. Original controller092d450b and preregistration remain unchanged. C0 remains one administratively cancelled command with zero events/samples, separately preserved. R1 restart reasons were explicit: administrative zero-data cancellation plus discovered/fixed controller defects. The reviewer checked actual positive and negative predicates before R1.

Original two workload bodies, imports, assertions and timeouts were retained; only N changes plus the exact previously registered output-only instrumentation/final12-microtask drain. Inverse instrumentation equals original. Membership case remains synchronous and precedes replacement restoration in the same fresh worker. No additional payload reads, GC, profiler, heap flags,130k or CPU campaign. Original restoration assertions check count/first ID, not every payload.

## Completed boundary observations (heapUsed MiB)

| Invocation | Worker PID | After replacement | After undo | After redo | After destroy + drain | Max sampled heap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline-128-r1 | 40667 | 45.21 | 46.31 | 56.22 | 58.68 | 58.68 |
| reader-128-r1 | 42727 | 40.32 | 49.44 | 57.32 | 59.45 | 59.45 |
| reader-512-r1 | 43928 | 47.93 | 49.15 | 51.53 | 60.94 | 62.91 |
| baseline-512-r1 | 44609 | 55.38 | 50.14 | 62.58 | 73.18 | 73.18 |

R1/SUMMARY.json contains exact bytes; BOUNDARIES.csv and per-run memory.jsonl contain all120 numeric boundary samples. Four distinct worker PIDs, same V8 heap limit4,496,293,888 bytes,30 exact ordered stages each, correct N, two passing selected cases and nine filtered/skipped cases each. That is eight selected case executions of two distinct test bodies, not eight distinct tests. Every accepted run had no runtime/test mismatch or surviving owned process.

Neither512MiB nor the >64MiB AND >8x previous smaller-N growth rule fired. The actual stop was startup no-progress at baseline2048, with no measured worker data. No inference about2048 memory is possible.

At512, reader boundary heap values are lower in this single pair; at128, reader after-undo/redo/final-drain and maximum sampled heap are higher despite a lower initial heap. No512 repeats were obtained, so within-arm variation is unmeasured here. Boundary values can move with collection and unrelated whole-process state; these observations do not establish retained-byte savings, peaks, a leak, an asymptotic bound, or a general improvement/regression. No CPU/timing ranking. The aborted campaign cannot qualify large workloads or resolve prior OOM evidence.

## Preservation and separate correctness evidence

R1/FROZEN-INPUTS-AFTER.json verifies all3124 baseline and3127 reader frozen files with zero mismatches. FINAL-PRESERVATION.json binds the latest per-arm after-run source checks and final overlay hashes to exact saved tests/commands, verifies only five R1 run directories, and lists the three unstarted invocations. Historical controller/preregistration and reviewed R1 controller remain byte-identical. No root/frozen source edits or budget changes.

Prior Main correctness receipts are separate: Angular4/2files, React3/1file, Vue4/2files, Solid4/2files (15 framework cases total); kernel93/4files; full source typecheck exit0. Main's separately composed no-sink diagnostics repeat passed11/11 across2files, with its first setup failure preserved. These do not inflate R1 case counts. Packet-diagnostic composition caveat was resolved for measurement by exclusion, not frozen-spec edits.

Disposition: memory campaign stopped and preserved. No more memory runs/retries. Proceed only with the separately authorized existing verification gates on the test-composed0af649ba candidate.
