# Independent pending/drain diagnostic interpretation

Disposition: diagnostics narrow the observed problem but do not identify an accepted optimization or close runtime-cost HOLD. C's pending/settled heap increment persists in this new bounded cohort. No added asynchronous native-completion backlog is observed at the instrumented sites. A candidate point trace includes a minor GC after the synchronous write endpoint, but that is not a causal explanation of the earlier cost cohort's drain result.

Read-only review. No runtime tests, new children, heap parsers, snapshots or profilers executed. Lightweight offline checks read the author-run raw JSON, recomputed differences/classifications and checked recorded counts. No repository/source changes. Only this requested review artifact is written. Other independent review verdicts were not used.

## Evidence identity and completion

- `SUMMARY.json` SHA256 `c398221c41750ed60780cecb9a7e9654838c08b2b3d94e025125c0d96887483a`.
- `PREREGISTRATION.json` SHA256 `0011af3c26521125523aabd1f95265381b39547e4f2a93af04aaf933616b4879`.

`AFTER.json` records82/82 valid scheduled results, no source/input mismatches. The schedule comprises38 scaling children,12 uninstrumented economics children,10 snapshot capture children,10 offline snapshot-analysis children,6 allocation-sampling children and6 copied-artifact trace children. Thus72 workload/capture/profile children plus10 offline analyses, not82 independent performance samples. Earlier calibration/control runs are additional separately recorded evidence, not pooled samples.

A is frozen fe18 package input; C is retained9aa20563b. The new cohort is diagnostic and does not rerun/replace or pool the prior48-child cost screen. Calibrations report successful actual Node24 weak/conditional controls, source/scheduler/GC positive and missing-recording controls, allocation held/collected controls and useful workload omission controls. These support the respective probes within their documented limits, not arbitrary complete ownership/CPU attribution.

The launcher explicitly supplies PATH/TZ/LANG. Recorded scaling child environments also contain macOS-injected `__CF_USER_TEXT_ENCODING`. Say "minimal explicitly supplied environment, with recorded platform injection," not "exactly three variables in every child." No inherited credential-variable names appear in those recorded lists; that does not prove every possible input to a heap snapshot is secret-free.

## 1. Pending workload scaling

All38 scaling results independently checked here report the configured per-tree owner count ×10 global total, Node24.15.0, zero of the10 sampled trees alive after teardown and quiescence rounds within3–40. Heap-stability convergence and finite WeakRef clearance remain different evidence from universal absence of retained objects.

The anchor uses10 owners per tree and transient reads of ten rows, matching the recorded pending workload shape. Its three per-arm new samples give:

| Delta over enhanced primed heap, bytes | A median [min,max] | C median [min,max] | Difference of medians |
| --- | --- | --- | ---: |
| Pending | 1,034,936 [1,032,408,1,042,200] | 1,096,576 [1,078,712,1,097,504] | +61,640 |
| Rolled back / handles released | 958,752 [948,032,965,104] | 1,022,808 [1,001,424,1,024,896] | +64,056 |

The intervals do not overlap in these three-sample anchor observations. This independently observed direction is consistent with the earlier pending concern; it is not a new acceptance classification or a precision estimate of an implementation component.

Controlled variants hold33 row readers consistently at every0/1/10/32-owner count, unlike the anchor. Distinct-row and same-row variants use two samples per arm/cell. Candidate minus baseline median increments:

| Variant | Owners/tree | Pending minus primed | Settled minus primed |
| --- | ---: | ---: | ---: |
| Fixed distinct | 0 | 0 | 0 |
| Fixed distinct | 1 | +45,948 | +62,680 |
| Fixed distinct | 10 | +64,432 | +71,904 |
| Fixed distinct | 32 | +80,180 | +64,416 |
| Fixed same row | 0 | −84 | −84 |
| Fixed same row | 1 | +47,020 | +62,932 |
| Fixed same row | 10 | +61,104 | +71,388 |
| Fixed same row | 32 | +84,404 | +68,996 |

The small zero-owner increments themselves are not zero: both fixtures' pending/settled checkpoints move by about75KB/90KB after priming despite no owners. That reveals process/protocol movement and is another reason not to call the differences pure owner storage. Increasing owners changes handles, writes, facts and captured windows; same-row reuse additionally changes ancestry/overlap while distinct-row reuse changes touched footprint. These limited points do not establish a general linear slope, growth bound or asymptotic law. The settled excess is roughly60–72KB across nonzero counts rather than a simple constant per-owner multiplier.

Destroyed-minus-process-baseline remains positive in both arms. Tree WeakRef clearance and the snapshot evidence below prevent relabeling this alone as a retained-tree leak.

## 2. Scheduling traces separate logical work from GC delivery

Point copied-artifact traces for both arms record2000 Source.prepare, Native complete, Source.complete, finalization and readiness-delivery calls during the synchronous writes. C uses2000 Native.preparePoint hits; A uses generic preparation. Both record zero scheduled/executed calls at the rewritten library scheduler sites, and no later native counter changes through22 task markers. This is concrete evidence against an added deferred native-completion backlog at those covered sites in that workload. It does not cover every Promise/host/internal/aliased scheduler or all runtime work.

Pending author traces record100 scheduled and100 executed path-notifier microtasks in each arm. Pending rollback traces record111 scheduled/executed callbacks in each arm:100 owner-cell deletion callbacks,10 transaction callbacks and one path-notifier callback. Later counter changes are scheduler executions; there are no later Native.complete/finalization increments. Candidate pending author metadata identifies100 responsibility callbacks and generic Native.prepare; it does not use the native fast-point branch. Thus ordinary point CPU economics and pending transactions exercise different source paths.

GC occurrence must use `startTime`/duration, not `deliveryPhase`:

- A point writes span164.332625–237.600209ms. All four recorded minor GCs start and end inside that synchronous interval, though all entries are delivered during `turn-2`.
- C point writes span166.616583–191.978208ms. One recorded minor GC is inside writes. Another starts192.211500ms, ends193.998458ms, after the write endpoint and before the first task marker194.194375ms. Its observer delivery still says `turn-2`.
- All four major/forced-GC entries in EACH pending author/settle trace end before that trace's measured operation starts. They came from earlier priming/quiescence and were delivered later. They are not four drain collections caused by authoring/settlement.

This supports one observed post-write minor GC in the copied C point trace. It does not assign the earlier uninstrumented4.511ms drain to GC, estimate GC CPU or show a persistent queue difference. Wrappers, async_hooks, observer buffers and altered copied artifacts perturb GC/timing. Event occurrence, observer delivery and the historical performance cohort are distinct.

## 3. New uninstrumented economics remain unresolved

Independently applied the registered descriptive rule to all10 economics dimensions using the raw two A/A controls and five per-arm samples. All10 are unresolved: range overlap or median delta does not exceed the maximum same-arm/A/A range. In particular nonoverlapping synchronous-CPU ranges still fail the required variability margin. Some medians:

| Diagnostic metric, ms | A median | C median |
| --- | ---: | ---: |
| Synchronous wall | 65.908958 | 60.466250 |
| Synchronous CPU | 115.878 | 92.237 |
| Cumulative CPU through two task boundaries | 116.078 | 93.942 |
| Cumulative CPU through22 boundaries | 116.631 | 94.716 |
| Drain-only wall | 0.236792 | 0.200041 |
| Drain-only CPU | 0.200 | 0.160 |

C has one large drain sample (8.146ms wall/25.216ms process CPU); the other four are much smaller. Neither discarding that sample nor using the smaller new median to erase the old result is justified.22 cumulative turns include harness/runtime/JIT/GC activity and are not complete native-work CPU accounting. No new economic pass, equivalence or cost waiver follows.

## 4. Snapshots constrain broad structural explanations, not exact ownership

One fresh snapshot per checkpoint/arm avoids earlier snapshot perturbation of a later checkpoint. The parser and calibration hashes match the reported qualified Node24 weak/conditional controls; retained sizes are engine-reported, nonadditive and qualified only by those controls. Incoming samples remain descriptive edges, not full ownership paths.

Raw total self-size C−A at primed/pending/rolled-back/confirmed/destroyed is −15,688 / +44,128 / +49,968 / +52,488 / +24,976 bytes. These are one cross-child snapshot per cell and different metrics from scalar heapUsed. Difference-in-differences suggests a similar scale to the scalar pending increment but does not isolate an owning structure.

The two arms have equal Map counts/self sizes at each inspected snapshot checkpoint. At live/settled checkpoints C has20 more WeakMaps,30 more WeakSets,75 more closures and10 more contexts than A; the additional weak-container counts reconverge after destruction. This is consistent with C's added source bookkeeping, not proof that the weak tables independently retain their keys or that those containers explain the entire excess. Compilation/code/string differences are also present and survive tree teardown; aggregate process tails are not the tree graph alone.

The field-shape groups are incomplete candidate classifications. Both pending snapshots report zero `ownerCell` matches despite100 workload-verified pending owners. In this capture configuration numeric values are not exposed, so missing numeric property edges are one possible reason; this review did not establish that cause. The decisive conclusion is that shape-count0 cannot certify owner absence. Likewise a tiny `nativeCompletion`/`preparedUnit` candidate group does not prove no opaque completion/closure graph survives. NativeRequirement matches are314 during pending and214 after rollback in both arms; ordinary endpoint and physical View candidate counts also match. These observations do not attribute the extra bytes to additional requirements or wrappers.

Do not sum class retained sizes, individual retained sizes and overlapping shape groups. A shared closure/window's several incoming aliases are not additive ownership costs. No specific removable lifetime or misowned graph has been demonstrated by this data alone.

## 5. Sampling shows where transient allocation was observed

Single sampled allocation profiles per arm/mode report:

| Sampled JS bytes | A | C |
| --- | ---: | ---: |
| Point | 62,672,728 | 23,499,016 |
| Pending author | 14,888,048 | 14,835,760 |
| Pending rollback | 14,125,128 | 13,939,984 |

The point profile supports substantially fewer sampled allocation bytes for C in this run. The pending profiles remain close and their leading stacks include ordinary-entry/value-transition construction, transaction responsibility, row/node realization, notifications and generic publication. These are statistical sampled JS allocations including collected examples under the calibrated settings, not exact total/native allocation, retained bytes or per-component CPU. There is only one profile per cell; small deltas have no independently quantified sampling uncertainty here. No sampled-allocations-to-live-heap equality is justified.

## Remaining unknowns and narrow closure

The diagnostics show persistent bounded pending/settled heap excess, comparable covered callback multiplicity, synchronous native completion, and a GC scheduling-position difference in one instrumented point trace. They do not yet identify an exact removable retained graph or account for the historical drain wall/CPU. No new owner-window semantics, token removal, completion deletion or garbage-collector tuning is justified solely by these observations.

Close this diagnostic phase with its raw controls/data and explicit gaps. Candidate C remains held for runtime costs. Any later optimization requires a concrete lifetime/representation claim and a semantic falsifier; this review opens no automatic optimization campaign and grants no adoption/release authority.
