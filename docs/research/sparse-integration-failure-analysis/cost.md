# Bounded CPU attribution: rejected sparse integration

No runtime or tests were changed. Production artifacts from baseline `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023` and the final source snapshot sealed by integration checkpoint `9b9b0b35a7dd207df366047ef5c9621168a2b405` were profiled. `artifact-hashes.json` hashes every package JS artifact in each profiled output directory, not only its tiny index entry point. The candidate remains behaviorally rejected.

## Workload and method

The preserved `measure-common.mjs` workload creates one transaction, writes row 0's `n` field, asserts its visible value is 1, successfully rolls back, asserts 0, checks terminal inspection has one change, and retries rollback. No application observer. All those assertions remain verbatim. Collections contain 32 or 1,024 entities; one field changes. Setup and 31 warmup cycles are outside the profiled loop. Three alternating baseline/candidate fresh-process samples per size use 10,000 cycles with V8 inspector sampling at 100 microseconds. Node is `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node`, `--expose-gc`. All 12 runs succeeded. No broad suites were run.

`profile-common.mjs` differs from the preserved harness only by starting/stopping the inspector around its timed loop and saving the profile. `runs.json` records exact commands and results; profiles and raw logs are retained. `analyze.py` excludes the inspector activation's own samples explicitly. Sampled times measure main-thread stack residency, not total user+system CPU across V8 threads. Therefore the following percentages are not causal shares of the prior 1.7x process CPU delta.

## Evidence

Median exclusive sampled main-thread shares, percent (each column is a separate total):

| Component | Baseline 32 | Candidate 32 | Baseline 1024 | Candidate 1024 |
|---|---:|---:|---:|---:|
| Sparse core itself | 0 | 33.2 | 0 | 35.4 |
| Persistent map itself | 0 | 15.2 | 0 | 18.2 |
| Sparse adapter itself | 0 | 2.6 | 0 | 2.5 |
| Native delta itself | 0 | 2.0 | 0 | 1.9 |
| Clone utilities/native structuredClone | 0 | 6.0 | 0 | 4.8 |
| Existing transaction shell | 45.6 | 18.7 | 44.6 | 17.7 |
| Other library code | 39.2 | 14.5 | 40.6 | 12.9 |
| Garbage collector | 10.8 | 5.5 | 9.7 | 4.7 |

Remaining samples are VM/harness work. Independent medians need not sum to 100. Core-inclusive shares (core plus descendants, including persistent maps and clones) are **52.7% and 56.4%**. These overlap the exclusive rows and must not be added to them. The ownership computation is a substantial sampled cost center; this is not evidence that generic persistent data structures are intrinsically unsuitable.

The profiled runs' median process CPU per cycle was baseline/candidate **54.53/89.49 us** at 32 and **52.85/94.62 us** at 1024. These longer, instrumented runs corroborate a cost gap (1.64x/1.79x), but do not replace the preserved five-sample 500-cycle measurements or constitute a profiler-free benchmark. Differences in warmup and sampling overhead prevent attributing exact deltas.

Existing model counters, observed through wrappers in a disposable copied artifact, establish the work below for exactly one unchanged successful cycle. The wrappers return original results and preserve assertions; no timings from these instrumented counter runs are used.

| Existing counter / call | 32 rows | 1024 rows |
|---|---:|---:|
| Persistent map node visits | 697 | 1237 |
| Persistent map node allocations | 86 | 156 |
| Affected cell edits | 2 | 2 |
| Indexed live-record lookups | 22 | 22 |
| Dependency edits | 2 | 2 |
| Occupancy edits | 4 | 4 |
| Full snapshot entity visits | 0 | 0 |
| Full snapshot scalar visits | 0 | 0 |
| Owner-group prefix copies | 0 | 0 |
| exportPrepared / finalize calls | 2 / 2 | 2 / 2 |
| entityView materializations | 4 | 4 |

These are allocation events and lookup counts, not retained nodes or distinct entities. A fixed field mutation is sparse but incurs tree-path rebuilding and repeated indexed resolution. At 32 rows, preparation accounts for 341 visits/44 allocations and settlement for 345/41; at 1024 they are 606/79 and 610/76. Opening an owner allocates one map node. The remaining lookups include reclamation eligibility checking.

## Source-backed attribution

* **Index allocation:** `sparse-ownership/persistent-map.ts:16,66,76` constructs new AVL path nodes for set/remove; counters increment in the production code. `core.ts:338` finalizes every affected entity by removing/reinstalling occupancy and ordering indexes even for this field-only change. Four occupancy edits per cycle confirm that path runs on both preparation and settlement. No whole-collection scan is demonstrated here; allocation grows with indexed tree depth.
* **Repeated resolution/materialization:** `core.ts:550` calls `finalize` then constructs before/after entity views, compares touched values and looks up predecessor/successor. `entityView` at line 526 walks the affected row's field index and clones each winning field. It runs four times per cycle (twice for write preparation, twice for rollback preparation). The write-side adapter consumes the returned responsibility writes/adds but does not use the prepared entityChanges; native forward installation is already handled by the mutation frame. This is concrete preparation work whose output is unused by this bridge path. Removing it safely would require a separate prepared-plan contract experiment, not a claimed repair here.
* **Duplicate representation/evidence, not proven double native installation:** `sparse-adapter.ts:62-76` translates committed entity capture into sparse field operations; `transactions.ts:2027-2082` also prepares diagnostic operation history/effects, and transaction capture/inspection remains. Both are active. Native state and sparse cells retain representations of current field truth, while the journal retains evidence. Profiles find cost in both, but do not isolate what diagnostic machinery could be removed without violating inspection/recovery contracts. The ordinary forward write plus rollback requires two physical state transitions; there is no measured proof that the identical physical write is unnecessarily installed twice.
* **Notification/bridge:** Adapter and native delta exclusive self time are each small compared with core plus indexes. The workload has no application observer, so observer callback execution cannot explain this cost gap. Publication machinery still runs and contributes within other-library time; no ablation isolates its exact share, and active-observer costs remain unmeasured here.
* **GC:** Sampled GC exists in both arms. Candidate GC percentage being lower does not imply fewer allocations: its denominator and total duration differ, and concurrent GC work is not captured by these main-thread percentages. AVL node allocations are directly observed independently.

This evidence favors **substantial ownership/index computation plus redundant export/materialization work**, rather than solely a slow synchronization callback. It does not establish how much cost remains after correct production integration, or which alternative design wins. No causal ablation was attempted because removing ownership or diagnostic obligations would invalidate the matched workload's production meaning.

## Replay

From a host retaining the sealed artifact locations:

```sh
python3 /private/tmp/st-sparse-failure-analysis-20261016/cost/run-profiles.py
python3 /private/tmp/st-sparse-failure-analysis-20261016/cost/analyze.py
python3 /private/tmp/st-sparse-failure-analysis-20261016/cost/instrument.py
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node --expose-gc /private/tmp/st-sparse-failure-analysis-20261016/cost/count-common.mjs /private/tmp/st-sparse-failure-analysis-20261016/cost/instrumented entity 1 32
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node --expose-gc /private/tmp/st-sparse-failure-analysis-20261016/cost/count-common.mjs /private/tmp/st-sparse-failure-analysis-20261016/cost/instrumented entity 1 1024
```

`instrument.py` copies only built artifacts into its own disposable directory and adds observability wrappers; original artifacts and source stay untouched. `counters-inner-*.log` and `counters-replay-32.log` preserve the observed counts. No new first test failures occurred in this investigation. The earlier measurement harness failure remains in the original packet and was not repeated or reclassified.
