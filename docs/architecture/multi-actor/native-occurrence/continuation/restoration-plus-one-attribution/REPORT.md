# C21 restoration extra-read attribution

Neither extra operation is adjacency traversal. The failing counter is `publicationDependencyReads`, incremented by `location-runtime.ts:303` in `trackDependency` without an active consumer. Original failures are preserved in ORIGINAL-FAILURE-STACKS.txt. No thresholds or runtime changed.

| Sequence | N | Undo reads | Redo reads |
| --- | ---: | ---: | ---: |
| Paired | 3 | 9 | 37 |
| Paired | 32 | 96 | 385 |
| Large-case sequence | 3 | 10 | 38 |
| Large-case sequence | 32 | 97 | 386 |

Paired redo has twelve N-sized buckets plus one `RestorationManager.currentIndex` read (`restoration.ts:569`), called by `restoreVisibleStateToConfirmed:1489` while leaving temporal view from runJumpTo. This accounts for the original 37/385/3073 versus 36/384/3072 failures; N256 is original evidence, not a new trace.

The large-case sequence explicitly obtains `restorationReader(tree).snapshot()` before installing stats. That attaches an operation observer. On undo, operation publication checks `live()` before checking whether listeners exist, and `isToolingTreeDestroyed` (`tooling-tree.ts:28`) reads `tree.destroyed()`. This is one additional dependency read beyond the three N-sized row buckets. It explains the original 390001 versus 390000 failure by source and scaled traces, without rerunning 130k. The scaled redo includes BOTH singleton reads (12N+2). Original 130k redo was not reached and is not reported as measured.

Four diagnostic tests passed. Each N/sequence uses fresh plain and traced trees; exact numerical parity is asserted. The tracing accessor replaces only the returned stats object's numeric property, records full stacks, and sums increments back to the original counter. Runtime methods/prototypes remain unchanged. Row restoration, writes=N, redo tombstones=N and empty state assertions remain. Original import style and intervening reads are retained for each sequence. This is characterization, not a budget pass. run/COMMAND.json is the generating command; run/observations contains every stack and raw count; run/first.log and RESULT.json preserve execution.

All 3066 exact-C21 input hashes still match BASE-MANIFEST.json (73e4ecfde64ee05a1eed1eb1362e8ca6f18755b1192a3583454440ef4ad68c27). Only two test-only diagnostic files were added. No 130k rerun, timings, mutation experiment or full-suite claim.

These are real reads with state/lifetime roles, not demonstrated redundant work. No calibration is recommended as qualified. Any future calibration requires an actually executed, reached semantic-work mutant (for example duplicated per-row snapshot work or reintroduced collection traversal), retaining row/order/write/tombstone assertions and demonstrating a kill. Injecting counter increments or mutating bypassed legacy routes is not meaningful mutation proof. Source arithmetic alone is not a kill. The earlier C19 Array.find final-adjacency attribution is a different counter and does not explain these failures.
