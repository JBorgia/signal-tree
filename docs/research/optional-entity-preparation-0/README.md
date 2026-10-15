# Optional entity-target preparation experiment

Baseline: `f962e9038838570912545d11f48c4251537979e3`. Owner authorized a bounded dependency-split experiment while preserving contracts and ceilings. **Reviewed candidate, not release or budget acceptance.**

## Mechanism and scope

The collection continues to own stores, selected key, subject epochs, membership observation and publication. Its internal target binding supplies that typed environment to an algorithm supplied by the optional target-transition consumer. The extracted algorithm retains original preparation, installation and publication ordering. There is no process-global registration, second state owner or new package export.

`owner`, `ownerPath`, and `readSource` remain available to plain membership/read observers. Only the internal preparation call gains an explicit algorithm argument. The two tests that called this private binding pass the same extracted algorithm; existing assertions remain. Full physical-store target methods, point preparation and restore planners are still retained. This is a partial split, not proof that ordinary entities carry no optional preparation.

## Artifact evidence

Gate-identical entity fixture: **26,893 → 26,396 gzip bytes** (497 saved). Bare stays **11,919 bytes**. Separate matched behavior-checking fixtures:

| Fixture | Before gzip bytes | After gzip bytes | Change |
| --- | ---: | ---: | ---: |
| Plain entity store | 26,947 | 26,447 | −500 |
| Transactions + restoration | 73,963 | 74,292 | +329 |

The emitted-graph assertion requires the extracted implementation absent from after/plain and present in after/enhanced. Both artifacts run checked state/order rollback smoke tests. These Node executions of browser-target bundles are not browser/framework tests. The before implementation was inline, so absence of its new filename is not an absence witness for the old algorithm.

Fresh demo: **563.17 kB**, up from 562.67 kB at the reduced baseline. Unchanged bundle and demo ceilings still fail (exit 1). No ceiling was raised. Root and callable API checks pass.

## Correctness and first failures

All five full suites passed: kernel 5741, Angular 237, React 74, Vue 172, Solid 104 ordinary passes; 12 expected failures and 15 skips remain. Source types, spec-types and lint pass. Full-suite execution preceded the added late-tap regression and source formatting only; the new test and heterogeneous controls then passed separately (8 tests).

The additional regression attaches a membership observer after preparation, then replaces it during installation's open notification. It requires the original observer to receive balanced open/close and the target to install. Deliberately snapshotting the tap at preparation produces **1 failed test**, then restored source produces **1 pass**. First failure is retained. Independent exact review verified phase ordering and dynamic tap access.

Initial source typecheck failed because the host interface declared a readonly array where the existing notifier requires mutable number[]. The interface was corrected to the existing return contract, with no cast or weakened public type. The initial focused invocation named one nonexistent test path; actual output was three files/84 tests, not four. Corrected heterogeneous coverage ran later and is also in the full suite. Build logs contain pre-existing semantics-composition TS4111 warnings; successful output generation is not claimed to eliminate those diagnostics.

## Cost measurements and limits

First run: 24 fresh processes, six paired rounds, 16 rows, 200 warmup + 2000 checked operations. Paired wall medians after/before were 0.9992 rollback and 1.0000 confirm. Rollback heap-delta medians increased 4920 bytes; retain the confirm outlier. Independent interpretation identified incomplete timing-window artifact provenance, not a demonstrated mismatch. Preserve this run; do not pool it with the next.

The preserved v2 protocol has a stale heap-description label saying 2000 operations; its count, child, receipts and samples consistently establish **5000**. This correction does not rewrite the hashed original record.

Second run (`cost-v2`): frozen archived artifacts, pre/post JS inventories equal, command/timestamp/exit receipts, pinned NODE_ENV, harness hashes, timeouts and finite-output checks. Six paired rounds, 500 warmup + 5000 operations. It additionally checks every row value and pending responsibility 1 → 0. Every rollback invokes preparation; confirm invokes none.

| Mode | Paired median wall ratio | Wall ratio range | Paired median CPU ratio |
| --- | ---: | ---: | ---: |
| Rollback | 1.0049 | 0.9955–1.0182 | 1.0013 |
| Confirm | 1.0161 | 0.9867–1.0485 | 1.0184 |

Post-GC heap-delta medians: rollback 191432 → 210776 bytes; confirm 223500 → 226320 bytes. These are whole-process endpoint deltas with one workload length, not peak allocations, retained journal bytes, per-operation cost or proof of a leak. No quiet-host certificate, A/A noise bound or statistical neutrality claim. Timing includes checked synchronous writes and settlement, excludes explicit GC/deferred flush, and includes incidental GC. Do not transfer these results to all applications or the separate G1 choice.

## Disposition

The import-boundary hypothesis survives this bounded experiment: plain consumers exclude the outer algorithm without a public contract change. Its measured benefit is modest and enhanced consumers pay more. Preserve it separately as a candidate; neither universal performance improvement nor final architecture/budget acceptance follows. The main reviewed candidate can be recovered unchanged at the baseline SHA. Further splitting of structural preparation is not part of this experiment.

## Replay and artifacts

Evidence archive includes both built kernel graphs, source snapshots/hashes, raw logs, all 48 timing samples, scripts, reviewers and the first mutation/type failures. `compare-bundles.executed.mjs` preserves the original command source; `compare-bundles.mjs` is its archive-relative replay using the saved graphs. Run with repository dependencies and Node 24.15.0:

```sh
node compare-bundles.mjs
```

`cost-v2/measure.py` deliberately refuses to overwrite raw samples. To rerun, copy its driver and child into a fresh sibling directory of `baseline-kernel` / `candidate-kernel`, then invoke Python; the pinned Node path may need adjustment on another host. Rebuild from baseline plus the recorded source patch with the repository configs before claiming evidence for a different source or environment. No push, merge, tag or publish is part of this result.
