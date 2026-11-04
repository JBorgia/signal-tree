# Independent cost interpretation — FAST-POINT-DUAL-MAP-0

Independently recomputed every metric median delta and classification in DISTRIBUTIONS.json from ALL-SCALAR-SAMPLES.csv under the preregistered overlap/maximum observed same-arm-or-A/A-range rule: no mismatch. Inspected child identity/profile/size in all raw outputs and selected sample0 outputs for each profile. All 24 heap children report weakAlive=0. AFTER.json reports 48 completed/valid children, no source/input mismatches, failed profiles or global stop. No new tests, profiling, retry or campaign was run.

## Pinned endpoint screen

Both pinned cost endpoints classify selected-lower. With the separately established unchanged point-work gate, the experiment satisfies that necessary conjunctive screen. This is bounded advancement evidence, not unconditional acceptance or adoption: the registration separately prohibits offsetting regression or unresolved release cost with a favorable metric.

| Required endpoint | Frozen median | Dual-map median | Delta | Registered direction |
| --- | ---: | ---: | ---: | --- |
| point.sync_cpu_ms | 69.354 ms | 31.470 ms | -37.884 ms (-54.624%) | selected-lower |
| heap-populated.live_minus_baseline_bytes | 17,757,224 B | 17,725,080 B | -32,144 B (-0.1810%) | selected-lower |

Both pairs of sample ranges are disjoint. CPU's median difference exceeds the 20.328 ms maximum observed variability; populated heap's difference exceeds 1,936 B. The small heap decrease is a whole-process delta across ten populated trees, not a per-row/object ownership allocation estimate. These descriptive directions are not confidence intervals or universal effect sizes.

## Other dimensions remain separate

Point wall time classifies selected-lower, 32.159 to 20.243292 ms (-37.052%). Its 11.915708 ms reduction is only moderately beyond the 10.677042 ms variability threshold. Point drain time classifies selected-higher, 0.178250 to 4.511125 ms (+4.332875 ms), beyond 2.067250 ms variability. Total point CPU, including drain, is unresolved: 69.448 to 50.134 ms, a 19.314 ms decrease inside the 20.633 ms maximum variability. Therefore synchronous CPU improvement must not be reported as established total-CPU or end-to-end completion improvement. The two-setImmediate drain is the unchanged harness boundary; no causal explanation for the extra drain work is established by these samples.

Construction wall, synchronous CPU, total CPU and drain are all unresolved. Medians are 209.611333 to 210.393917 ms wall, 373.145 to 382.421 ms synchronous CPU, and 373.548 to 382.804 ms total CPU. Construction includes 200 measured create/populate/check/destroy operations on 100-row fixtures plus 20 warmups; dispatch size0 is not an empty-tree workload.

Absolute populated live heap also classifies selected-lower: 23,963,776 to 23,942,960 B (-20,816 B). Populated settled-minus-baseline decreases by 32,144 B and destroyed-minus-baseline by 24,960 B, both selected-lower. Populated pre-drain live is unresolved (-1,021,184 B within 2,783,040 B variability). A single pre-drain observation is not an allocation total.

Pending heap regresses under the same rule. Incremental pending live-minus-primed-idle rises 1,033,528 to 1,096,760 B (+63,232 B, +6.118%), selected-higher. Absolute live process heap rises 26,686,368 to 26,730,040 B (+43,672 B); live-minus-baseline rises 20,480,088 to 20,512,160 B (+32,072 B), both selected-higher. Enhanced idle-minus-baseline itself decreases by 31,576 B. Thus an idle saving and larger pending increment coexist; neither replaces the other endpoint.

Pending settled-minus-idle rises 949,232 to 1,019,568 B (+70,336 B, +7.410%), and settled-minus-baseline rises by 39,128 B, selected-higher. Pending destroyed-minus-baseline is higher by 24,888 B. Conversely its pre-drain live and settled observations are lower by 148,984 B and 100,152 B respectively. These different phases must remain distinct; earlier pre-drain decreases do not erase the live/settled increases. All heap WeakRefs cleared in this finite harness, so the destroyed residual is not proof that a tree remains strongly retained.

## Warranted disposition and limits

The narrow question whether this pipeline plus dual-map layout can meet the two pinned synchronous-CPU/populated-heap endpoints versus frozen fe18 has positive evidence in this cohort. It does not demonstrate that all runtime costs improve. A claim of clean runtime-cost acceptance, adoption readiness, release-green or regression-free advancement would exceed these data: pending heap is higher, drain is higher and total CPU/construction remain unresolved. These cannot be compensated by the two favorable endpoints. No new owner disposition is inferred.

Frozen fe18 and selected dual-map are the arms. The old fused B cohort was neither rerun nor pooled; differences between old and new retained timing medians do not support cross-cohort causal comparisons. This integrated experiment does not isolate CPU or byte contributions of dual maps from every retained pipeline choice.

One 1000-row populated size cannot establish scaling, and process-level deltas do not identify dominators, object costs or mandatory semantic storage. Projection and confirmation/rollback timing are omitted; pending heap does not replace those timings. No released-v15 parity, production SLO, complete semantic proof or final release qualification follows. Keep the existing source/test/counter evidence and cost packet separately bound; interpretation does not authorize a further experiment or production adoption.
