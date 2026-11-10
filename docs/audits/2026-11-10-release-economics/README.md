# Packed v16 application economics and release decision

November 10, 2026. This audit evaluates packed runtime `b6acda57552affb0fdcbc0b40f1996c4345ed5d8`, on source checkpoint `1a6225a386825c12f60d799a59db34c6341cc1e2`. The larger prefix-frame CPU prototype is not this candidate. The comparison release is the integrity-verified npm 15.4.4 kernel, not an assertion about the newest published version.

**Release decision: NO-GO. Reject this packed candidate for general v16 production.** Coordinated start work and pending-state memory repeatedly exceed the preregistered allocations. Representative job-store first initialization also misses its allocation, and destroyed derived-state roots remain retained. This closes the current candidate's acceptance decision; it does not leave an undecided production HOLD or reject every possible v16 implementation. Keep the supported release line in service and require a corrected candidate for further release preparation.

## Acceptance policy

The owner explicitly authorized setting ordinary-state budgets from representative apps, an equivalent coordinated-workflow comparison, and a clear release decision. The [registered policy](../../../tools/release-economics/policy.json) fixes the workloads, thresholds, sampling and decision rules before the final measurements. First registrations and every failed or incomplete run remain in the evidence packet.

The ordinary fixtures execute the React reference store's factory, derived outputs and actions and the Angular inventory's factory, hooks, actions and held-reader behavior. Inventory uses explicit neutral reads in place of Angular scheduling. The original seeds are five seven-field jobs and four five-field products. Each also has a declared 1,000-row capacity scenario, anchored to the demo benchmark's `QUICK_CONFIG.collectionSize`; these are scaled application shapes, not claims about deployed thousand-row apps. The scaled inventory advances its next unused ID beyond the supplied seeds.

| Mandatory endpoint | Allocation | Independent rationale |
| --- | ---: | --- |
| Loaded-module first state initialization and warm initialization p95 | 25 ms | State portion of a chosen 100 ms local-readiness target; 75 ms reserved for other work |
| Action plus required local projections/publication p95 | 4 ms | State portion of a 16.67 ms frame; 12.67 ms reserved |
| Complete local coordinated workflow, sum of timed stages, p95 | 25 ms | Same local-work readiness allocation; intentional remote/pending waits excluded |
| Quiescent live state above imported idle | 32 MiB | State portion of a chosen 128 MiB JS envelope, across eight specified coexisting stores/sessions |

These are new engineering acceptance allocations, not inherited product SLOs or measured device limits. They gate elapsed local state work. Process CPU is reported separately. Node passes cannot qualify browser rendering; repeatable state-layer failures can reject this candidate under the policy. No required relative speedup over v15 or the application coordinator is invented.

Each profile has two packed A/A children and five alternating reference/packed pairs, all serial fresh processes. Ordinary timing uses one first invocation, 20 warmup routes, 100 measured routes, 20 warmup interactions and 400 measured interactions per child. Each child uses nearest-rank p95; first invocation is a single sample, not a per-child percentile. All five comparison children must meet a gate. Four or five crossings establish a repeated failure; mixed crossings conservatively prevent acceptance without establishing that stronger claim. No cross-profile compensation applies.

The ordinary heap envelope is four 1,000-job and four 1,000-product stores, with actual app readers, before and after 1,200 actions per store. The coordinated envelope is eight 1,000-job sessions after ten complete workflows, then with overlapping owners pending, then all settled. Both use the existing shared GC/turn quiescence protocol. Required destination snapshots remain in pending state; oracle row arrays are released, with hashed expectations retained for full-row checks. Actual trees and entity handles are WeakRef sentinels; wrapper collection is insufficient.

## Ordinary results

The final ordinary campaign completed all 60 planned children with unchanged bound inputs. Its twelve heap children retain a nonzero exit for the collection assertion: seven packed (including two A/A controls) and five v15. Completion of the schedule is not a claim that all checks passed. Every live-heap budget passes; the failed collection checks are a separate obligation.

Values below are medians across the five comparison children. Warm and interaction values are medians of within-child p95s, not a pooled production percentile.

| State-layer endpoint | v15.4.4 | Packed | Packed budget result |
| --- | ---: | ---: | --- |
| Five-job first initialization | 3.96 ms | 6.90 ms | Pass, 0/5 crossings |
| Four-product first initialization | 2.51 ms | 4.75 ms | Pass, 0/5 |
| 1,000-job first initialization | 6.03 ms | 26.36 ms | **Fail, 5/5 above 25 ms** |
| 1,000-product first initialization | 3.80 ms | 24.11 ms | Mixed, 1/5 above 25 ms |
| 1,000-job warm initialization p95 | 1.74 ms | 15.66 ms | Pass, 0/5 |
| 1,000-product warm initialization p95 | 1.89 ms | 11.04 ms | Pass, 0/5 |
| 1,000-job interaction p95 | 0.69 ms | 1.33 ms | Pass, 0/5 above 4 ms |
| 1,000-product interaction p95 | 0.49 ms | 2.20 ms | Pass, 0/5 |
| Eight views, populated live heap | 4,025,624 B | 19,114,288 B | Pass, 0/5 above 33,554,432 B |
| Same views after 9,600 total actions | 8,919,040 B | 27,856,424 B | Pass, 0/5 |

The five packed job startup observations are 26.51, 26.36, 26.33, 25.83 and 27.67 ms. The miss is modest, but repeated under the fixed rule. Inventory's one crossing is not a repeatable-failure claim. The small seeded apps and every warm/interaction gate pass. These results narrow the problem to first-use construction and lifecycle retention; they do not support calling ordinary interaction generally unusable.

CPU is a different metric: median child p95 synchronous process CPU for 1,000-job initialization is 2.87→45.04 ms, and for inventory 2.83→16.03 ms. Process CPU includes runtime/GC threads; through-turn CPU also includes the common harness scheduling. Neither is the elapsed frame budget. The raw distributions and A/A controls remain available; no v15-relative parity gate is imposed.

## Equivalent coordinated task

The [independent coordinator and common oracle](../../../tools/release-economics/coordinated.mjs) operate on accepted seven-field job records. Two owners edit different fields of the same row; one confirms while the other rolls back, in both orders and with either field accepted. A preattached field consumer makes independent progress. A collection consumer attached after the optimistic edits waits on unresolved evidence and publishes the exact complete collection once. Foreign pending work either confirms or rolls back. Endpoint reentry, same-key entity replacement, stale-handle refusal and fresh publication are checked. Eight coexisting sessions share the pending domain and settle foreign owners in reverse order, checking the absence and eventual content of every publication.

The alternative uses plain row Maps and lazy per-field journals for changed rows, with explicit application coordination and detached destination payloads. Its implementation derives outcomes from state; it does not replay expected traces. Both arms use the same assertions at intermediate boundaries. Four planted controls must fail: premature publication, whole-row rollback that clobbers a later accepted field, stale-lifetime retargeting and dropped writes.

This is equivalence for the named flat-row workflow, not all SignalTree APIs. Same-field competing edits, arbitrary expressions, full restoration, rekey, framework realization, backend authorization and durability are outside the comparison. Measured cost is implementation cost for these scenarios, not a lower bound on what v16 guarantees must cost. Expected-state construction and assertions are outside timers; actual actions, required reads, destination serialization and the common drain remain inside.

## Coordinated results

All 24 final children complete without a semantic or collection assertion failure. The separate functional run has 22 result records across both arms and kills all four planted controls. The budgets fail independently of those functional passes.

| Matched endpoint | Application coordinator | Packed | Packed budget result |
| --- | ---: | ---: | --- |
| First initialization | 0.63 ms | 32.10 ms | **Fail, 5/5 above 25 ms** |
| Warm initialization p95 | 0.13 ms | 18.60 ms | Mixed, 1/5 above 25 ms |
| Start stage p95 | 0.045 ms | 13.37 ms | **Fail, 5/5 above 4 ms** |
| Complete local workflow, sum of timed stages, p95 | 0.64 ms | 15.19 ms | Pass, 0/5 above 25 ms |
| Eight sessions after ten workflows each | 1,577,864 B | 21,567,536 B | Pass, 0/5 above 33,554,432 B |
| Eight sessions with owners pending | 1,692,736 B | 144,197,544 B | **Fail, 5/5 above 33,554,432 B** |
| Same sessions settled, consumers disposed and workflow contexts released | 1,608,680 B | 21,659,216 B | Pass, 0/5 |

Values are medians across independent children; timing percentiles follow the same per-child rule. Packed's five start-stage p95s are 13.50, 13.37, 12.73, 14.27 and 13.26 ms. That stage creates the independent connection and three optimistic owners, acquires the late collection consumer and performs the two declared-independent edits, including publication drains. The other packed stage medians are below 0.63 ms p95. The named start stage, not retirement or final delivery, is the dominant measured local cost.

Pending state is about 137.52 MiB, 4.30 times the 32 MiB allocation. The pending-minus-populated difference is about 116.95 MiB of whole-process live heap. This is not an object/dominator partition or a leak claim: after settlement and disposal, state falls back to about 20.66 MiB and all sampled actual resources collect after session destruction. The reference performs the same named observable task with about 1.61 MiB pending. This establishes a concrete less-expensive bounded alternative; it does not establish the minimum cost of every v16 guarantee or a general framework/library ranking.

Packed synchronous process CPU per complete workflow has median child p95 41.45 ms versus 0.054 ms for the coordinator. Including the common drain gives 43.52 versus 0.666 ms. Process CPU and elapsed wall are separate; GC/runtime threads and harness scheduling are included as specified. Raw per-stage/per-workflow distributions preserve this distinction.

## First failures and controls

- The expanded inventory first attempted the tiny demo's next ID 5, which already existed in the scaled seed. The independent oracle caught that the blank-name hook had not run. The scaled fixture now chooses the next unused ID; app behavior and exact tiny seeds remain intact.
- The first setup could not read `sysctl` inside the sandbox. CPU identification uses Node's OS API instead. No measurement ran in that setup.
- An incomplete ordinary cohort omitted production-mode settings. Source inspection caught it before budget analysis; it is retained and excluded. Final arms both use `ngDevMode=false` and `NODE_ENV=production`.
- The first production cohort stopped at its first collection assertion. Moving store construction into a helper removed retention of the last inventory object by the top-level test scope. Four React job-tree roots still survived on both exact artifacts, while their row handles collected. The collection assertion remains a failing assertion; the final runner records its nonzero exit and continues only that explicitly identified failure so the complete comparison can be reported.
- A brief independent functional selftest overlapped the first production cohort's tiny inventory profile. Its timestamp and affected child intervals are recorded before endpoint selection. The entire first cohort is retained; final measurements are a separate clean campaign, not pooled samples or favorable retries.

## Independent review

Premise review inspected the actual app source without using historical candidate timings to propose thresholds. It required labeling the scaled capacity and chosen allocations, including complete application operations, distinguishing elapsed work from process CPU, and fixing the live-store population before measurement.

Measurement review independently identified the scaled ID collision, oracle construction inside early coordinated action helpers, eager metadata that handicapped the reference, and the need for actual resource sentinels and a shared pending domain. The final comparison addresses those findings. Review assertions and executed checks are distinguished in the final evidence record.

Final independent review recomputed the raw percentiles, heap deltas, budget crossings and classifications for all 84 receipts, verified the bound inputs, and checked ten strong paths comprising 198 edges against the four actual V8 snapshots. It found no remaining measurement blocker and supported rejecting this exact candidate. It explicitly retained the positive ordinary/warm/settled results, the modest ordinary startup miss, and the bounded nature of equivalence. Review was read-only; runtime checks were executed separately.

## Destroyed derived-state retention

The [isolated diagnostic](../../../tools/release-economics/retention-diagnostic.mjs) runs nine cases on each exact artifact in fresh children. Plain trees, one derived value, a nested namespace with one derived value, and the small active-entity controls collect. The derived-of-derived case retains the tree and both derived callables on both artifacts. The actual five-job app retains its root after its projections are read, while the associated row handle collects. Omitting only `selectionHiddenByFilters` does not avoid it. These are observed finite collection outcomes, not a claim that every derived configuration leaks.

Four heap snapshots were taken before dereferencing the sentinels. The graph analysis excludes weak edges and conditional WeakMap key/value edges. Both minimal derived-chain snapshots contain an unconditional strong path from the module-global `dependencyFinalizer`, through its held dependency Map and a dependency node's `refresh`/`compute` closures, to the derived callables. Those snapshots do not establish an unconditional path to their tree roots, despite the observed root noncollection.

The packed actual-app snapshot does establish an unconditional path to the tree: finalizer holdings → dependency Map → `refresh` → `compute` → the captured `selectId` closure → `store`. The finalizer's held dependency graph therefore defeats collection of this destroyed app. The v15 actual-app snapshot has an additional global marker-processor path to its tree, including an unread-store retention witness; packed's unread app collects. The derived finalizer mechanism exists in both releases. This is not a regression caused by packed field storage, and dropping app methods or projections from the accepted fixture would hide the required behavior.

Independent interpretation review verified the path reports and required the distinction between callable-root proof, observed tree noncollection, and the actual-app tree-root proof. A repair must break the finalizer-held dependency cycle while preserving dependency cleanup, abandoned-recipe collection, publication and lifetime behavior. Existing single-derived retention tests do not cover the failing chain.

## Reproduction and evidence

The original counter rerun passes unchanged at **1,800 visits** for 200 distinct writes at both 2,000 and 20,000 rows; its width and thrown-value controls pass. Exact packed-artifact late-reader/retirement, public reentry, clone-reentry and frame-packet witnesses also pass. These checks preserve the guarantees already achieved; they do not compensate for the acceptance failures.

Four relevant documentation gates pass: version claims, README APIs, documented imports and relative links. Their package prerequisite build reproduces all 141 measured packed package files byte-for-byte. The current production demo build is recorded at 814.69 kB, failing its unchanged 570 kB numerical ceiling. Size already has explicit owner disposition and is not used to reject this candidate. Two initial sandboxed build processes aborted with SIGABRT; the approved one-worker run reached bundle generation and the explicit size failure. No numerical ceiling was edited. This is not a successful production-browser or full release qualification claim.

The release controller and TODO now record NO-GO and the concrete successor requirements: coordinated pending representation, coordinated start preparation, derived dependency disposal and first-use construction. Runtime, facade, public API and published packages are unchanged. A corrected candidate must meet the same acceptance tests before the full release campaign is worth rerunning.

The [validation receipt](validation.json), [evidence archive](evidence.tar.gz) and [SHA-256](evidence.sha256) preserve exact artifacts, all registrations and raw children, failed first attempts, functional controls, snapshots/path reports, witness outputs and build/documentation logs. The archive contains a self-contained `reproduction/` copy of the harness, original app sources and shared quiescence code. All 862 manifest payloads were rehashed successfully after archive creation. The measured kernel JS has no external package imports.

From this source checkout (or the packet's `reproduction/` directory), copy `packed-kernel` and `v15-kernel` from the archive to a **fresh** packet directory, and use Node 24.15.0:

```sh
node tools/release-economics/coordinated.mjs selftest /absolute/packet/packed-kernel 1000
python3 tools/release-economics/run.py /absolute/packet ordinary
python3 tools/release-economics/run.py /absolute/packet coordinated
python3 tools/release-economics/summarize.py /absolute/packet/ordinary-runs
python3 tools/release-economics/summarize.py /absolute/packet/coordinated-runs
```

The runner refuses existing output directories, binds all executed harness/app/artifact inputs before measuring, checks identity around every child, preserves stderr and nonzero exits, and records host/load/limits. A/A variability bands are descriptive, not confidence intervals. One host does not establish production-device percentiles.
