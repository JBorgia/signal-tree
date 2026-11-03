# Matched small-size memory experiment — first eight invocations complete

All eight authorized invocations pass the two original selected cases (16 case executions, two distinct case bodies). Nine other tests in the original file are name-filtered per invocation, not claimed passed. No assertion/compiler failure, timeout, steep-growth stop or retry. Runtime inputs remain unchanged; no GC/profile/second-instrumentation expansion.

## Exact workload and identity

Baseline frozen R3 manifest `e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3`; indexed arm differs only in tree-realization-adapter.ts, hash `0e9e8347f26bec9a360b0db5080fb52b0949b3f30da011db93efe018a8d57fce`. Both3,095-file maps verified; indexed base serialization differs but entries equal. FROZEN-INPUTS-AFTER.json contains no mismatches. Every per-run test, after removing output statements/helper/final drain and restoring LARGE, equals the original byte-for-byte. Runtime files have no instrumentation.

Each sample uses a distinct fresh worker PID, same imports/facade/observers, preceding membership setAll/replace/clear case, then restoration setAll/replacement/undo/redo; original assertions and60s/120s test timeouts unchanged. Only N and primitive stage records differ. Membership remains synchronous; original12-microtask drains retained; one extra12-microtask sample after final restoration destruction. No intermediate tree reads were added. Original restoration assertions verify row count/first ID, not every row payload.

Pinned Node24.15.0 and installed tools, sequential Nx/maxWorkers1. All workers report the same V8 heap-size limit4,496,293,888 bytes; no heap-limit override or forced GC. Host is shared with other agents: host contention/GC scheduling was not controlled, and no timing comparison is made. This is source/installed-tool development evidence, not built-package qualification.

## Boundary heapUsed (MiB)

| Sample | Worker PID | After replacement | After undo | After redo | After destroy+drain | Max sampled heap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline-128-r1 | 61447 | 45.12 | 46.38 | 56.30 | 58.75 | 58.75 |
| indexed-128-r1 | 62177 | 46.00 | 56.84 | 66.50 | 45.06 | 66.53 |
| indexed-512-r1 | 62357 | 56.76 | 73.23 | 67.90 | 78.51 | 78.51 |
| baseline-512-r1 | 62593 | 55.28 | 72.98 | 67.13 | 77.72 | 77.72 |
| baseline-2048-r1 | 63121 | 116.53 | 125.65 | 147.19 | 187.81 | 187.81 |
| indexed-2048-r1 | 63206 | 115.99 | 116.72 | 130.03 | 170.73 | 170.73 |
| indexed-512-r2 | 63309 | 54.95 | 72.59 | 67.05 | 77.61 | 77.61 |
| baseline-512-r2 | 63402 | 48.08 | 66.35 | 85.64 | 72.49 | 85.78 |

SUMMARY.json supplies unrounded values and sampled RSS; BOUNDARIES.csv/raw memory.jsonl include every boundary and V8 fields. These are whole-process instantaneous values, not allocation counts, true peaks, retained sizes or dominators. No values from different metrics are added.

## First findings and unresolved attribution

1. Both arms complete throughN2048 with useful original assertions, and neither reaches the preregistered safety stop. This does not qualify130k or supersede its OOM/watchdog records. The separately passing indexed130k restoration-control pair remains its own result.
2. AtN2048, after replacement both arms are near116MiB; substantial growth exists in the shared workload before the observed undo boundary. After undo, redo and cleanup both remain sizeable. Index-only storage is not established as the dominant cause.
3. GC position materially affects comparisons: baselineN2048 falls from116.53MiB after replacement to55.85MiB before undo, while indexed falls from115.99 to80.28MiB. Baseline512 after-redo varies67.13→85.64MiB between fresh samples; indexed512 is67.90→67.05MiB. The first cross-arm512 difference is much smaller than that baseline same-arm variation. Do not claim the indexed arm is memory-better/worse from maximum boundary readings or call this an interval estimate.
4. BothN2048 arms allocate substantially during destroy (about35MiB increase at sampled boundaries). Without collection this does not prove retained cleanup objects or a leak. The final drain is not a retention test.

Disposition: the first experiment localizes a material common workload footprint and demonstrates insufficient resolution to assign bytes to the prepared index versus lifecycle/proofs. It neither proves an index retention defect nor absolves the index. The planned local preparation-boundary/cardinality discriminator would require separate authorization; it was not run. No recursive proof traversal, full heap dump, sampled allocation profiler or GC follow-up was started.

## Preservation

PREREGISTRATION.md pins order, sizes and stop rules. Each runs/<arm-size-replicate> contains exact command/env, first.log, test bytes, raw stage/event data, source-before/result and PID/owned-process records. All groups/descendants absent at completion. EVIDENCE-SNAPSHOT.json binds packet. No production/runtime/assertion/budget edits,130k rerun, cost-limit change or speed claim. Independent metadata implementation review can resume once its author freezes; this bounded measurement task is complete.
