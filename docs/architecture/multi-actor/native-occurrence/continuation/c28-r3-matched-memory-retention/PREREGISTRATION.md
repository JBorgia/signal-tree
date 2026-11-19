# Matched N512 retention diagnostic — two invocations only

Baseline R3 then prepared-index arm, fresh sequential Nx worker, first membership case then restoration case, exactly original imports/assertions/timeouts and N512. No original runtime/config modifications. Prior packet remains untouched. Run through pinned Node24.15.0/pnpm10.17.0; NODE_OPTIONS=--expose-gc follows existing retention-gc worker mechanism. Actual worker globalThis.gc must be a function at every memory marker; absence fails, never skips. No heap limit override.

Keep original12-microtask drains. After all redo assertions, add12-microtask+one setTimeout(0) task drain and primitive sample while tree remains live; no GC. After unchanged destroy/final drain, same task drain and sample. Then exactly three samples, each task/microtask drain, one actual gc() call, task/microtask drain, primitive memory record. No GC in preparation, seed, replacement, undo, redo or destruction. The final count must be3 in each worker. Both arms identical instrumentation; no objects retained by recorder.

These fixed samples are NOT the adaptive heap-quiescence gate and make no convergence/universal-reclamation claim. Local tree remains in lexical scope after destroy; process/modules/framework/test runner/prior-case history remain. Compare whole-process GC response, not attributable tree dominators or index-specific OOM cause. No second-case-only arms, repeats, profiles or130k.

Reuse original external180s no-progress/360s absolute birth-matched owned descendant census/cancellation. Stop on first failure, source drift, >512MiB sampled heap, missing selected test, unavailable GC, unexpected GC count or retained owned process. Expected exact2case passes plus9filtered per arm. No favorable retries.
