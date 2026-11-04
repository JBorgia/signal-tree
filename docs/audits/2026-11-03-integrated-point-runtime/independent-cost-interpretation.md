# Independent bounded cost interpretation

Reviewed the generated preregistration, DISTRIBUTIONS.json, ALL-SCALAR-SAMPLES.csv, STATUS.json and raw child stdout. Recomputed every metric's median delta and directional classification from the CSV under the unchanged registered overlap/maximum-range rule: no disagreement. All 48 status entries are valid, with no global stop or failed profile. Raw outputs matched their recorded PID/profile/size; all 24 heap children report weakAlive=0. Selected sample0 outputs were inspected for all four profiles. No test, build, profiler or new campaign was run.

At inspection AFTER.json was absent: the controller's final full-source check was still pending. Numerical interpretation is therefore conditional on clean final source/input/cleanup receipts. No final campaign integrity closure is inferred from completed child status alone.

## Required endpoints

The registered conjunction is not met. Point synchronous process CPU improves beyond the registered uncertainty threshold, but populated live-minus-baseline heap regresses beyond it. CPU improvement cannot compensate for that heap result.

| Registered metric | Retained median | Selected median | Delta | Classification |
| --- | ---: | ---: | ---: | --- |
| point.sync_cpu_ms | 180.387 ms | 55.417 ms | -124.970 ms (-69.28%) | selected-lower |
| heap-populated.live_minus_baseline_bytes | 17,757,072 B | 19,956,008 B | +2,198,936 B (+12.38%) | selected-higher |

Point CPU sample ranges do not overlap; its 124.970 ms median reduction exceeds the maximum observed same-arm/A/A range of 54.333 ms. Populated live heap ranges also do not overlap; its increase exceeds the corresponding 11,240 B variability. These are registered finite-sample directions, not confidence intervals or universal effect estimates.

## Separate dimensions

Point synchronous wall time also classifies selected-lower: 120.324667 to 35.430250 ms (-84.894417 ms). Its reduction only narrowly exceeds the registered maximum variability, 84.154625 ms; do not present it as equally stable as CPU. Total point CPU is selected-lower, 182.470 to 55.524 ms. Point drain time remains unresolved. All construction timing metrics are unresolved: synchronous CPU 1005.134 to 1021.906 ms, synchronous wall 957.446125 to 944.310583 ms, total CPU 1005.628 to 1025.800 ms. Construction dispatch size0 means the registered 100-row fixture, not empty construction.

Absolute populated live process heap is also selected-higher: 23,963,264 to 26,176,752 B (+2,213,488 B). Populated settled-minus-baseline rises by 2,198,936 B; populated pre-drain live is unresolved because its observed variability is much larger. Populated destroyed-minus-baseline is unresolved (+784 B).

Pending incremental heap and absolute heap must not be conflated. Pending live-minus-primed-idle rises 1,032,976 to 1,086,040 B (+53,064 B, +5.14%), selected-higher. Pending absolute live process heap rises 26,688,856 to 28,952,032 B (+2,263,176 B); pending live-minus-baseline rises 20,482,664 to 22,731,288 B (+2,248,624 B), both selected-higher. Primed idle-minus-baseline itself rises by 2,196,488 B. Thus the absolute pending difference is largely already present in the enhanced idle fixture; it is not all incremental pending-owner storage.

Pending settled-minus-idle rises 949,064 to 1,004,488 B (+55,424 B), selected-higher. Pending settled-minus-baseline rises by 2,250,472 B; pending pre-drain live/settled and destroyed-minus-baseline also classify selected-higher. The latter's +46,504 B is a process-level residual, not proof of a retained tree leak: all heap WeakRefs cleared in this finite harness.

## Disposition and limits

This screen does not authorize advancement/adoption under its preregistered rule. Preserve the experimental implementation and evidence without claiming runtime-cost acceptance. The unchanged absolute point-work result is a separate screen and does not override heap regression.

This is frozen-v16 versus isolated prototype, not released-v15. Ten trees at one 1000-row size cannot establish scaling or attribute heap increases to fused maps, arrays, closures or another mechanism. Whole-process heap deltas are not dominator/retained-size attribution; pre-drain observations are not transient-allocation totals. Omitted projection and confirmation/rollback timing remain outside this bounded screen. No full release qualification, production SLO, semantic completeness or architectural-family rejection follows.
