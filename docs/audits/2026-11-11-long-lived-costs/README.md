# Long-lived performance, heap and optionality

November 11, 2026. Execution record under the [registered protocol](PROTOCOL.md).
The retained-store investigation and final comparison rerun are complete. Keep
the reviewed v15 collection/cleanup fixes and v16 preparation/representation
changes as successor candidates. No new version or publication is selected; the
released v15.4.8 and sealed v16 baseline remain immutable. The largest gains are
workload-specific: v15 collection queries and v16 coordinated population, rollback
and retained/pending memory. Ordinary v16 startup remains more expensive.

## Updated ordinary-store comparison

The [fresh 140-child comparison](final-ordinary-comparison.json) includes both
original and final SignalTree builds in the same rotated schedule, the pinned
native Angular and NgRx implementations, and separate v15 A/A repeats. Final
v15 is runtime `0d2b9619206ab9e7a7af998944e744f6d2b6e492`; final v16 is
`5d04ff65d2eaab1986ed1b420cbc013edc01542b`. They remain unpublished candidates.
All children and the skipped-write control pass their expected outcomes.

At 10,000 rows with 32 numeric fields, median elapsed times and whole-process
populated heap are:

| Current implementation | Setup/readers through 5,000 sparse edits | Subsequent 200 aggregate/filter updates | Populated heap |
| --- | ---: | ---: | ---: |
| Native Angular row signals | 6.88 ms | 118.57 ms | 30.250 MiB |
| NgRx SignalStore `withEntities` | 7,677.53 ms | 379.80 ms | 25.964 MiB |
| Final v15 | 22.73 ms | 39.77 ms | 29.525 MiB |
| Final v16, ordinary no-Link bundle | 155.08 ms | 116.89 ms | 31.322 MiB |

These are checked synchronous state workloads, including shared assertions;
they are not UI interaction latency or a comparison of batch entity updaters.
Native remains cheapest for the sparse path. v15 is fastest for this aggregate
mix; its paired final/before ratios are 0.566–0.656, with median 0.623. The same
arm's aggregate A/A ratios are 0.986–1.028, reported as context rather than a
confidence interval. The update does not establish a sparse-write improvement:
its cumulative final/before ratio is 1.024, while A/A variation is materially wider.

v16 ordinary population and cumulative sparse work remain essentially at their
earlier level under this study's descriptive limits. Its large publication and
retention gains below belong to the corresponding coordinated workloads. No
v16-over-v15 amortization crossover or general ordinary-state heap reduction is
demonstrated. NgRx's standard entity updater copies collection state; these
results do not rank every custom NgRx implementation. The production browser
comparison is a separate measurement of the actual app workflows.

## Refreshed competing-library applications

The settled builds are compared in the same production Angular applications as
the original study. The [final execution receipt](final-comparison-sequence.json)
records **578 passing comparative children**: 140 ordinary state, 132 inventory,
264 dispatch and 42 separate private-query-variant children. Build/conformance,
calibration, planted defects and supplemental payload checks are separate from
that count. The [browser analysis](final-browser-comparison.json) validates all
396 main browser children using the original analyzer and unchanged child engines.

Pinned dependencies are Angular 22.0.7, NgRx SignalStore 22.0.1 and TanStack
Angular DB 0.2.12 / DB 0.15.2 / Query DB Collection 1.4.8 / Query Core 5.107.1.
Chromium is 141.0.7390.37 under Playwright 1.56.1. Five fresh children per main
cell use rotated arm order; the before/final order is balanced 2/3 or 3/2, but
five rotations do not balance every position of all eight arms. Separate v15
A/A children expose host variation. These are descriptive, local controlled
browser results, not real-user INP, calibrated device classes or significance tests.

At 10,000 rows, no CDP slowdown, current-arm medians are:

| Implementation | Inventory navigation | Filter latency | Populated browser heap |
| --- | ---: | ---: | ---: |
| Native Angular row signals | 25.8 ms | 2.7 ms | 6.318 MiB |
| NgRx SignalStore | 25.4 ms | 2.3 ms | 4.164 MiB |
| Final v15 | 30.9 ms | 2.0 ms | 6.046 MiB |
| Final v16 | 180.7 ms | 2.0 ms | 6.999 MiB |
| TanStack DB, original query strategy | 145.1 ms | 51.2 ms | 10.498 MiB |
| TanStack DB, private stable-query strategy | 133.4 ms | 2.0 ms | 11.416 MiB |

| Implementation | Dispatch navigation | Accept-owner latency | Populated browser heap |
| --- | ---: | ---: | ---: |
| Native Angular row signals | 34.2 ms | 8.7 ms | 10.856 MiB |
| NgRx SignalStore | 31.6 ms | 11.6 ms | 5.466 MiB |
| Final v15 | 42.7 ms | 9.4 ms | 7.455 MiB |
| Final v16 | 199.7 ms | 9.9 ms | 8.100 MiB |
| TanStack DB, original payload strategy | 66.7 ms | 19.0 ms | 7.797 MiB |
| TanStack DB, private separate-payload strategy | 70.3 ms | 14.1 ms | 7.797 MiB |

Latency cells are medians of each child's own p95; individual operations are
never pooled. Navigation is the registered startup interval. Heap is whole
browser heap after the registered GC checkpoint, not attributed library bytes.
Dispatch timing and memory use separate children. The private TanStack rows are
specific application changes, not claimed upstream library defaults.

The [same-schedule inventory pairs](final-inventory-pairs.json) and
[dispatch pairs](final-dispatch-pairs.json) largely preserve the earlier browser
standings. They do not establish a general UI speedup for either SignalTree
update. The final v16 10,000-row dispatch navigation is higher in every paired
sample: median final/before ratio 1.071, range 1.004–1.223. Its ordinary population
is effectively unchanged in the separate state cohort. Browser populated heap
changes little; the dispatch after-destroy checkpoint at 1,000 rows is about
1.2–1.3% higher on the successors. That whole-module/app measurement does not
identify a retained-store leak. The controlled repeated-rollback and exact-object
aging studies below establish the specific lifetime cleanup repairs.

The [separate membership-changing inventory trace](final-private-inventory-comparison.json)
confirms the private TanStack strategy's exchange: 10,000-row filter p95 falls
53.7 to 2.3 ms, while toggle rises 1.3 to 7.6 ms and membership-changing rename
1.0 to 4.3 ms. Populated heap rises about 0.914 MiB; the aged +400 checkpoint
is about 0.895 MiB lower. This is a search-heavy workload choice, not a free win.
The private dispatch strategy reduces acknowledgement-processing p95 from
15.1 to 0.5 ms. Its populated/preview memory is essentially unchanged in the
existing memory scenario, which carries empty publication payloads. Separate
exposure/detachment controls pass, but no populated-publication memory saving
is inferred from that empty-payload scenario.

The ordinary benchmark and browser scenarios answer different questions.
Standard NgRx entity updates copy collection state, which is costly in the
5,000-write state loop; its actual rendered app remains competitive here.
Native wrappers, NgRx and TanStack implement the common application outcomes,
including explicit task-specific lifetime checks. They are not implementations
of every v16 declaration, pre-enrollment, restoration and independent-publication
guarantee. The full-contract comparison remains the separately checked v16
coordination trace, not a claim that rivals cannot implement those behaviors.

Generator: [registered final rerun](../../../tools/application-lab/final-comparison-rerun-protocol.md),
`node tools/application-lab/final-comparison-packet.mjs`, followed by the original
inventory/dispatch drivers and analyzers. The exact command arrays, source,
package, schedule, raw-child and analyzer hashes are retained in the receipts.
The [private analyzer derivation](final-variant-analyzer-derivation.json) changes
only the original analyzer's admitted arm list and sibling tool path; its
[containment controls](final-variant-analyzer-controls.json), original self-tests
and all 42 admission/metric checks pass.

## Original retained-store comparison and motivation

The ordinary workload keeps one Angular-native store alive through population,
200 retained row/field readers, 100/1,000/5,000 sparse edits, aggregate queries,
replacement/retirement, broader field demand and further edits. Four arms use the
same values and intermediate-result oracles. SignalTree consumers are production
bundled with named imports; the unused Link implementation is verified absent.
The native arm uses one native signal per row; NgRx uses its supported entity
updater. Native/NgRx supply explicit stale-editor guards for this task, not a
replacement for SignalTree's complete lifetime/coordination contract.

The [100-child results](ordinary-results.json) include five independent processes
per profile plus v15 A/A repeats. At 10,000 rows and 32 numeric fields, cumulative
setup, acquisition and checked sparse work has these median elapsed times:

| Through retained edits | Native Angular | NgRx SignalStore |  v15.4.8 | Qualified v16 |
| ---------------------- | -------------: | ---------------: | -------: | ------------: |
| 100                    |        3.78 ms |        157.78 ms | 11.16 ms |     121.05 ms |
| 1,000                  |        4.68 ms |      1,512.77 ms | 14.06 ms |     127.32 ms |
| 5,000                  |        6.64 ms |      7,651.63 ms | 22.03 ms |     150.95 ms |

At 1,000 rows / 32 fields, the 5,000-edit cumulative medians are 4.07, 19.90,
17.39 and 48.07 ms respectively. NgRx's pinned `updateEntity` copies its entity map
and ID array; SignalTree's subject-indexed point writes avoid that collection-sized
copy. The setup investment therefore demonstrably pays in this particular larger,
write-heavy comparison. It does not establish a v16-over-v15 crossover. Native
remains the lower-work arm here.

The subsequent 200-edit aggregate/filter stage at 10,000 rows / 32 fields costs
122.37 / 376.66 / 65.39 / 117.43 ms. This is a different operation mix, not another
measurement of sparse point writes. Timings include shared assertions and are
synchronous Node state work with Angular primitives: no DOM, paint, INP or network.
Do not substitute these numbers for the earlier end-to-end application results.

Generator:
`node tools/application-lab/long-lived.mjs compare BASELINE NEW_OUTPUT`.
The [lab protocol](../../../tools/application-lab/long-lived-protocol.md) records
work counts, ordering, artifact binding and limits. The analyzer recomputes every
child's cumulative sum and verifies schedules and raw receipts. Same-arm controls
remain separate from confidence intervals or statistical population claims.

## Heap is a set of different choices

Whole-process populated heap in that same 10,000 × 32 profile is 29.706 / 25.421 /
28.963 / 30.760 MiB. These include libraries and the common oracle. v15 is above
NgRx but below the per-row native implementation; an unconditional claim that
SignalTree uses more heap than native is false for these fixtures.

The separate [80-child field-demand study](field-demand-results.json) removes
retained operation schedules and separates handle creation from carrier creation:

| Transition, 200 held rows of 32 numeric fields     |     Native | NgRx fixture |       v15 |       v16 |
| -------------------------------------------------- | ---------: | -----------: | --------: | --------: |
| Acquire row handles without reading                |  0.018 MiB |    0.046 MiB | 1.693 MiB | 1.748 MiB |
| Acquire the remaining 6,200 numeric field carriers | ~2.529 MiB |   ~2.529 MiB | 7.624 MiB | 7.533 MiB |

SignalTree installs 6,600 enumerable field getters for those 200 rows (32 numeric
fields plus ID) at row-handle acquisition. Individual field carriers remain lazy.
Source inspection identifies per-row getter/cache state and per-field native
signals, writable bindings and intrinsic-observation records. Optional transaction
owner/position metadata is capability-gated and is not the explanation for these
bare-tree measurements. No byte total is assigned to a single internal object type.

Native and NgRx field views here are the application wrappers used by this
comparison, not NgRx's deep-signal property access and not the full SignalTree field
contract. Original demand-study teardown values were fixture-sensitive. A separate
22-child v15/v16 confirmation returns from the entire async work frame before GC;
all sampled tree, row, field and payload objects collect, while deliberate field
pins remain alive until released. That cleanup experiment does not cover the
native/NgRx arms. Demand deltas and cleanup evidence are reported separately;
neither proves universal leak freedom.

Generator: `node tools/application-lab/field-demand.mjs compare BASELINE ORDINARY_COHORT NEW_OUTPUT`.
See its [protocol](../../../tools/application-lab/field-demand-protocol.md).

## What is already optional

The [capability audit](CAPABILITIES.md) separates construction-selected enhancers,
module selection, demand allocation and always-present behavior. Transactions,
restoration and retained diagnostic history are opt-in. Row/field handles are
created on demand. These existing choices require no new configuration surface.

Native publication participation in v16 is currently **module-wide**. If production
bundling removes Link, it removes the native publication participant. If Link is
included anywhere in the module instance, eligible collections retain evidence
on writes even without a current subscriber. Actual Link recipients add another
projection. This makes “not subscribed” different from “not included.”

The [60-child activation baseline](activation-baseline-results.json) measures
no-Link, module-present/no-recipient and active-recipient cases. The neutral v16
fixture is 45,014 gzip bytes without Link versus 73,932 with a reachable Link;
v15 is 25,265 versus 33,896. These are specific production fixture bundles with
external peers, not whole application sizes or gate budgets.

At 10,000 rows with eight numeric fields, v16 populated within-process heap deltas
are about 7.08 MiB without Link, 30.14 MiB with its module present, and 48.18 MiB
with an active collection recipient. They are distinct activation costs, not
per-feature dominator attribution. The active-before-population case also exposed
an avoidable repeated scan; its optimization is described below.
Activation phase timings stop at the synchronous operation's return. Heap is
sampled after settling. These timings do not include awaited Link delivery; the
pending-lifetime experiment separately times settlement through its complete drain.
The active-recipient write stage coalesces 200 writes; it does not measure 200
independent outbound deliveries.

Generator: `node tools/application-lab/optional-seam.mjs build BASELINE NEW_BUNDLES`,
then `node tools/application-lab/optional-seam.mjs measure BUNDLES NEW_RESULTS 5`.
Metafiles and exact bundle hashes distinguish removed code from merely inactive
subscriptions. The missing-write control fails on the affected row.

A per-tree publication capability could avoid module-wide cost on selected trees,
but it must explicitly define late enrollment and consumption by another tree's
Link. Discarding earlier evidence changes current behavior. We have not introduced
that public mode or claimed a synthetic boolean branch prices a correct design.
The measured no-Link path quantifies an opportunity; it does not prove a compatible
per-tree opt-out. Internal redundant-work fixes come first.

## Guarantee-specific retained-store work

The installed v16 [coordination results](coordination-results.json) cover ten
fresh children, each retaining its stores through 100 episodes of dependent
publication, independent progress, rollback refusal, retirement/key reuse,
pre-enrollment history and automatic recovery. They then open 128 simultaneous
pending transactions and drain them with value checks. An early-publication
control fails while its dependency is pending. The exact lazy-index candidate
also passes the complete repeated trace in ten fresh children.

At 10,000 rows / 32 fields the baseline's whole-process heap progresses from
67.175 MiB populated to 71.288 after 100 episodes, 74.022 with 128 pending
transactions, and 71.357 after their settlement. This arm imports Link and tooling
and enables transactions: it is not the ordinary no-Link heap profile. Fixed
microtask draining and assertions are included in phase times. There is no rival
implementation claiming the full v16 contract in this arm.

Fresh baseline source validation passes 660 kernel files (7,223 passing tests,
five expected failures and 12 skips) and 53 Angular files (306 passing tests,
three skips; one file skipped). These cover the broader declaration, current-reader,
restoration, reentry and retirement matrix. GC-specific suites are separate gates.
The original point-work witness is retained unchanged; a wrapper asserts its
reported strict bound rather than treating exit zero as sufficient.

Generator: `node tools/application-lab/coordination-aging.mjs compare BASELINE NEW_OUTPUT [CANDIDATE_KERNEL]`.

## Optimization findings

The [experiment record](EXPERIMENTS.md) preserves first failures and rejected
approaches. The first v15 callback walker won a short Angular screen but lost the
longer warm-path comparison and is rejected. The second candidate caches ordered
subject IDs on demand. Its 112-child neutral screen resolves lower cumulative
5,000-edit projection CPU at 10,000 rows: 921.381 → 392.077 ms; reading IDs as well
costs about 80,752 additional live bytes and lowers CPU 1,576.016 → 700.732 ms.
That original neutral screen set `NODE_ENV=production` and `__DEV__=false`,
but did not explicitly fold `ngDevMode`; it is not the final fully folded
production result. The strict-fold successor cohort is reported separately.
The Angular pairing is noisier and does not justify a universal UI speedup claim.
See [neutral distributions](v15-subject-cache-neutral-results.json) and
[Angular distributions](v15-subject-cache-angular-results.json).

The first v16 support index removes a measured quadratic scan but adds 4.411 MiB
in the 10,000-row active-Link case. The lazy index builds only when needed and
normally lives in structural preparation's temporary draft. Its paired median
population is 6,226.27 → 844.98 ms, while populated heap is 48.190 → 48.245 MiB.
No-Link bundles are byte-identical; their timing differences directly demonstrate
host/process variation. Point-write differences do not establish a point-write
speedup. [Eager tradeoff](v16-eager-support-index-results.json),
[lazy tradeoff](v16-lazy-support-index-results.json).

The next experiment indexes ordered subjects by address during egress preparation.
It preserves duplicate-lifetime keys and strict equality, including the original
NaN/undefined behavior. An independent Map-equivalence falsifier caught a `-0`
normalization error; the fix passes the unchanged 80,000-operation / 720,000-query
falsifier. Its final 20-child pairing measures 10,000-row active population
768.51 → 289.46 ms against the lazy-support intermediate, with every pair lower.
That comparison is not against the original frozen v16. Point timings remain
mixed. The original work counter still reports 1,800 visits at both 2,000 and
20,000 rows. [Address experiment](v16-address-index-results.json),
[normalization follow-up](v16-address-normalization-results.json).

## Final v15 successor: measured adoption

The final runtime `0d2b9619206ab9e7a7af998944e744f6d2b6e492` combines the
projection cache with both lifetime cleanup repairs and the active-row guard.
The [112-child successor comparison](v15-final-production-projection.json)
explicitly folds `ngDevMode`, `__DEV__` and `NODE_ENV` for both arms. At
10,000 rows through 5,000 retained edits, cumulative CPU medians are:

| Profile | Released v15.4.8 | Final v15 candidate | Observed result |
| --- | ---: | ---: | --- |
| Repeated value projection | 751.401 ms | 354.034 ms | 52.9% lower |
| Inventory/filter queries | 993.190 ms | 549.815 ms | 44.6% lower |
| Values and IDs | 788.306 ms | 366.141 ms | 53.6% lower |
| Sparse point writes | 85.391 ms | 96.907 ms | Unresolved under registered variability rule |

No samples are discarded. The 1,000-row values-and-IDs outcome is unresolved,
including its preserved host-noise outlier. The final 10,000-row values-and-IDs
profile pays about 82,136 extra live bytes for simultaneous projection caches.
Other heap differences are unresolved. This supports adopting the internal
projection cache for its collection-read benefit, not promising faster individual
writes or a universal Angular UI improvement. Earlier Angular candidate results
remain mixed and are not reassigned to this final artifact.

## Combined v16 successor: direct remeasurement

Runtime `5d04ff65d2eaab1986ed1b420cbc013edc01542b` adds exact retained-source
packing and batch-local contribution sharing to the integrating predecessor below.
It preserves the same OwnerCell references and addressed contributions. The
[representation record](TERMINAL-FACTS.md) includes the rejected global cache,
its replacement, independent review and the remaining mixed-proof CPU tradeoff.

The new [60-child activation comparison](v16-terminal-final-activation.json) and
[40-child pending comparison](v16-terminal-final-pending.json) compare this final
runtime directly with the original frozen v16. They are new matched cohorts;
no intermediate percentage is multiplied into their results. At 10,000 rows
and eight numeric fields, medians are:

| Workload / checkpoint | Original frozen v16 | Combined successor |
| --- | ---: | ---: |
| Active-Link population, synchronous elapsed | 5,341.83 ms | 279.74 ms |
| Active-Link population CPU | 5,504.36 ms | 475.06 ms |
| Active-Link populated heap above pre-store | 48.173 MiB | 43.987 MiB |
| Pending population, confirmation arm | 5,417.63 ms | 428.82 ms |
| Confirmation including full drain | 20.96 ms | 21.95 ms |
| Pending workload heap, confirmation arm | 84.280 MiB | 59.102 MiB |
| Confirmed, transaction handle dropped | 69.693 MiB | 44.528 MiB |
| Rollback including full drain and cleanup | 10,845.94 ms | 607.83 ms |
| Rolled back, transaction handle dropped | 26.664 MiB | 9.366 MiB |

The pending heap reduction is approximately 30%. It preserves unresolved owners
and all checked values; it is representation sharing, not early settlement or
discarding pending reversal inputs. Confirmation work remains similar. These are
installed-kernel workloads, with the registered assertions and drain boundaries;
they do not measure Angular rendering, network latency or library-only heap.

No-Link population is 98.90 / 93.88 ms and module-present/no-recipient population
is 181.38 / 185.88 ms. Their 10,000-row heap deltas are 6.906 / 6.911 and
30.140 / 30.149 MiB respectively. No general construction or point-write speedup
is inferred from small differences. The 1,000-row module-only heap is bimodal in
both arms; its separated medians must not be called a deterministic two-MiB
regression. All raw values and the diagnostic follow-up remain separate evidence.

All ten [coordination children](v16-terminal-final-coordination.json) pass their
100 episodes and 128-pending-transaction phases. Both planted early-publication
controls fail correctly. The [point witness](v16-terminal-final-point.json)
retains the original 1,800 visits at both collection sizes, with width and
charged-work controls. Full combined source validation is in
[VALIDATION.md](VALIDATION.md). Long-history capture costs and the refreshed
competing-library application comparisons are reported separately.

## Integrating predecessor a35: population cost

The integrating runtime `a35ed7534996a80a77d0038ac61cb374fa5a1403` is
compared directly with the original frozen v16 in [60 fresh children](v16-final-activation.json).
This is not a multiplication of improvements from separate intermediate cohorts.
At 10,000 rows with eight numeric fields:

| Activation | Original population elapsed | a35 population elapsed | Original / a35 populated heap delta |
| --- | ---: | ---: | ---: |
| Link removed by bundling | 101.53 ms | 98.94 ms | 6.909 / 6.911 MiB |
| Link module present, no recipient | 186.69 ms | 190.48 ms | 30.140 / 30.143 MiB |
| Active collection Link before population | 5,580.98 ms | 291.32 ms | 48.427 / 48.386 MiB |

Active-recipient population elapsed falls 94.8%; CPU falls from 5,760.535 to
502.408 ms, or 91.3%. The 1,000-row active case also improves (89.74 to 42.27 ms).
No general improvement is claimed for no-Link/module-only construction or point
writes; the 10,000-row 200-write active medians are 52.04 / 51.80 ms with mixed
pairs. Populated heap is essentially unchanged. These are synchronous population
intervals; full settlement/drain costs are measured separately below.

The eliminated work is redundant contributor/address searching during structural
publication preparation. Exact temporary indexes replace repeated scans without
retaining the rejected eager index. Some structural `order.includes/indexOf`
searches remain: this is a large measured improvement, not a claim that every
bulk operation is now linear or that v16's guarantee cost is minimal.

## Pending memory and complete settlement

The integrating a35 [40-child pending comparison](v16-final-pending.json) uses an active
Link before a transaction populates 1,000 or 10,000 rows. It checks every physical
value, forbids outbound delivery before settlement, and verifies the exact
confirmed or rolled-back result. The planted early-publication control fails.

At 10,000 rows, the confirmed population median falls 5,793.38 → 463.65 ms and
the rollback-arm population falls 5,906.45 → 428.90 ms. Confirmation through the
complete microtask/Link drain is similar, 21.40 → 23.49 ms. Rollback **including
that drain and the new cleanup** falls 11,807.47 → 613.62 ms; corresponding CPU
is 12,203.64 → 1,082.04 ms. The comparison does not hide deferred cleanup outside
the measured settlement interval.

Pending retained heap is essentially unchanged at 84.3 MiB above the pre-store
checkpoint. The optimizations preserve pending inputs and ownership; this does
not prove that all 84.3 MiB are necessary or that pending-memory cost is solved.
After confirmation and dropping the handle it is 69.695 / 69.741 MiB. After
rollback and dropping the handle it falls 26.663 → 15.082 MiB, with the tree and
Link still alive. Those process deltas include inputs, oracle state, module/JIT
activation and retained cache capacity; the aging experiment separately checks
growth and actual collection. A synchronous observation falls from about
339.5 to 222.5 MiB in the rollback arm, but it is a sampled high-water lower bound,
not an allocation profiler or a true peak measurement.

The integrating a35 [ten-child coordination trace](v16-final-coordination.json) also passes
all 100 episodes per child and the subsequent 128 simultaneously pending
transactions. At 10,000 × 32 fields, whole-process heap is 67.234 MiB populated,
71.264 after 100 episodes, 74.003 pending and 71.336 settled. It preserves
dependent publication, independent progress, rollback refusal/retry, retirement,
pre-enrollment history and recovery from automatic compensation refusal. Full
source suites cover the wider restoration/current-reader/reentry contract.
The original [point-work witness](v16-final-point.json) remains at 1,800 visits
for both 2,000 and 20,000 rows, with positive width/charge controls and preserved
`throw undefined` handling. Neither trace claims rival equivalence.

## Retained-tree cleanup finding

Repeated bulk rollback exposed a distinct correctness-of-resource-lifetime issue.
The visible store becomes empty and transaction handles collect, but the baseline
retains another 1,000 lifetime records and value backings each cycle. At cycle ten
there are 10,000 such records. Both reused and fresh keys reproduce the growth;
destroying the tree releases the sampled payloads. The registry diagnostic has
zero restoration claims at every settled endpoint. See the
[before-repair aging trace](bulk-rollback-aging-before-results.json).

Ordinary add/remove churn also reproduces the gap on transaction-capable trees,
even when the enhancer has never been called. The separate
[deterministic inventory](never-claimed-churn-before-results.json) distinguishes
bare trees (no retained retired records), unclaimed enabled trees (10/20/30), and
designated undo history with a bounded history policy (10/10/10 legitimately
retained). This is not the same phenomenon as requested field carriers or the
input copies needed while a transaction remains pending.

The cause is a missing production cleanup trigger. Immediate retirement cannot
reclaim before notifier capture installs undo ownership. Transaction release
therefore conservatively drops its claim without reclaiming; history eviction
later supplies the safe trigger only when there is history to evict. The repair
queues exact retirement/release candidates on the already-optional enhancer path,
waits for capture to finish, and rechecks current claims and physical eligibility.
It also protects inspection-hidden ordinary members and reoffers them when their
ordinary lifetime ends. The bare path does not install the scheduler. No public
maintenance switch or guarantee reduction is introduced.

Independent review and 94 focused tests cover pending ownership, pre-flush undo
capture, redo, reentry, overlapping collection-local identities, failed attachment
cleanup, old handles and inspection transitions. The same original gap is
confirmed on published v15.4.8; its port preserves that line's settlement contract.
That first repair exposed a second residual: collected activation cells left
numeric keys and `WeakRef` wrappers in a tree-owned index. A diagnostic map census
identified 30,000 entries after 30 cycles even when there was no active Link and
no accumulating test-ID list. The final repair removes an index entry only after
its entire lifetime is actually forgotten, preserving pending/history ownership,
value-only retirement and failed pre-install attempts. Late reads cannot recreate
a store-owned entry for an already-forgotten lifetime. See the exact
[before](weak-index-census-before.json) / [after](weak-index-census-after.json)
census and [independent review](weak-index-independent-review.json).

The final [v15 ten-cycle cohort](v15-final-rollback-aging.json) passes all 14
children. With reused keys, whole-process heap above the empty-store checkpoint
progresses from 2.733 to 15.367 MiB on released v15, versus 1.595 to 2.075 MiB on
the repaired candidate. Fresh keys show the same distinction. The baseline ends
with 10,000 retired lifetime/backing records; the candidate has zero at every
settled checkpoint and all sampled payloads and transaction handles collect while
the store remains alive. Deliberately pinned-tree controls retain and then release
their samples as intended.

The separate [30-cycle intervention](v15-final-residual-heap.json) isolates the
remaining process/oracle costs. With current-cycle IDs only, cycle 20-to-30 heap
changes are −25/−61 KB without a Link recipient and +29/+37 KB with one, versus
+272/+317 KB and +346/+347 KB before weak-index cleanup. This is an observed finite
plateau, not a zero-allocation or universal leak-freedom claim. The final census
no longer contains the growing activation map; its other captured weak node-cache
map has zero entries at cycles 10, 20 and 30.

Cleanup also avoids creating inventory for active rows. The active 64-field
counter changes from 65 visited keys to zero, while a retired pending row still
visits 65 and restores its held field correctly. This is a work-count check,
separate from the timed settlement comparison. No new user-facing switch or
guarantee removal is adopted.

## Residual publication facts: diagnosis and representation repair

The integrating candidate's [14-child aging analysis](v16-integrating-aging.json)
confirms zero retired lifetime/backing records and zero sampled payload/transaction
survivors at every settled checkpoint. Those checks are not sufficient to close
retention: reused-key whole-process heap still rises 4.246 → 11.889 MiB across
ten 1,000-row rollbacks, and fresh keys behave similarly. Approximately 4.10 MiB
accumulates from cycle five to ten. This artifact is therefore not evidence of a
flat long-lived heap, despite its successful CPU and physical cleanup results.
The separately registered residual intervention investigates this remaining owner.

The intervention identifies five source maps retaining exact negative publication
facts, plus two addressed recipient maps when a Link is active. The same actual
rolled-back owner references are part of those facts. Dropping them would change
later native declarations; the established retirement counterexample rejects
that shortcut. The source representation now packs adjacent subjects only when
all five requirement references match. Recipient batches share identical ready,
callback-free snapshots while preserving exact keys and contribution counts.

The [final aging and census record](v16-terminal-final-aging.json) passes its
14 aging children, eight residual children, two census arms and three controls.
At 30,000 retired lifetimes, all logical source subjects remain represented in
30 runs, with no unpacked facets for the homogeneous workload. Physical lifetime
records, value backings and sampled payloads/transactions are released.

In the current-ID oracle cells, median whole-process heap above each child's
empty-store checkpoint is:

| Thirty 1,000-row rollback cycles | a35 before representation changes | Source packing 145 | Combined 5d04 |
| --- | ---: | ---: | ---: |
| No recipient | 13.029 MiB | 3.755 MiB | 3.761 MiB |
| Active recipient | 24.754 MiB | 15.453 MiB | 7.530 MiB |

These are [separate descriptive cohorts](v16-terminal-final-relative-heap.json),
not paired CPU trials. The current-ID cells complete in each cohort; a different
original a35 cumulative-ID child failed a strict collection checkpoint and remains
failed. The full original a35 residual cohort is not relabeled eight-for-eight.

Two 30,000-key recipient indexes remain. The active-recipient reduction is about
70%, but long-lived structural churn still accumulates addressed evidence. This
is not constant-space history or a demonstrated minimum guarantee cost. Ordinary
field edits do not each create a new entity lifetime. Further address compression
would need exact deletion/reinsertion/reseed behavior and measured point costs;
no permanent aggregate or new public cleanup switch is selected here.

The separate [eight-child GC diagnostic](v16-module-only-gc-diagnosis.json)
validates actual live owners, sampled tree/row collection and explicit pin/release
sensitivity. Additional job-separated GC changes some populated/edited heap
readings but does not universally collapse the two heap classes. The original
high destroyed-heap class is not reproduced under this intervention, so neither
its cause nor a necessary helper-return remedy is established. Whole-heap timing
sensitivity is kept separate from deterministic map counts and actual liveness.

## Costs after a long history

The [30-child history comparison](v16-deep-history-analysis.json) measures a35,
source-only 145 and final 5d04 in fresh interleaved processes. All registered
consumer, exact-fact, late-enrollment, declaration, fresh-bulk and cleanup checks
pass. The first pilot's incorrect use of a last-mutation subject footprint as a
whole-collection inventory is preserved; collecting each distinct mutation's ID
fixes the fixture without changing runtime or expected coverage.

After ten homogeneous 1,000-row rollbacks, final versus a35 retained-heap savings
are 5.64–6.10 MiB in every pair, with a 5.83 MiB paired median. Explicit full-source
capture costs more: twenty captures use 17.954 versus 7.652 ms median CPU, and
every pair is higher. The paired median extra CPU is about 0.53 ms per capture
of 10,000 retired subjects. Ordinary `tree.$()` repeats use an existing certificate
and report zero input-fact visits; they are not credited as fresh expansion.

Across that twenty-capture phase, the immediate heap-used delta is about
55–59 MiB in the final arm versus 18.93 MiB in a35. This is an observed transient
delta with possible GC during the phase, not allocated bytes, retained heap or
peak memory. Source inspection identifies a remaining expansion path: complete
physical-view capture expands stored runs into per-subject view entries before
`captureInput` deduplicates their requirement references. This is a concrete
future optimization target, not evidence that the measured extra bytes are all
semantically necessary or that they occur on every point edit.

New bulk and late-Link timing pairs vary, so this history study does not establish
a general CPU gain. The distinct 256-edit transaction actually retires IDs in
descending order: only one run packs and 1,275 facets stay in the original maps.
Its heap differences cross zero; subsequent bulk preparation and drain have
higher paired CPU medians, while elapsed differences are small. This fallback
avoids repeatedly shifting a run array, at the cost of retaining ordinary maps.
The memory benefit is strongest for homogeneous bulk histories, with explicit
expansion and mixed-proof costs rather than an unconditional speed claim.

## Independent interpretation and limits

A separate reviewer inspected the quoted premises, pinned competitor source,
ordinary/field/activation receipts, v15 neutral and Angular candidate cohorts,
coordination episodes and planted controls before reading this report's conclusions.
That review found no blocker to the bounded study. It did not run benchmarks or
certify the integrating successor. The corrected reporting boundaries are:

- The measured NgRx implementation is SignalStore 22.0.1 with `withEntities` and
  `updateEntity`; alternative custom NgRx representations are not excluded.
- Native per-row signals remain cheaper for sparse writes. Aggregate-heavy work
  can favor v15 in this fixture. Neither finding is a general library ranking.
- The ordinary data does not establish v16 amortizing its startup premium over
  v15; recurring measured stages remain higher as well.
- Repeated full-contract v16 episodes establish the checked behavior and finite
  scaling observations, not a rival-equivalent implementation or a minimum price
  for each guarantee.
- v15's projection candidate has a narrow CPU benefit and a priced second-array
  cost. Its Angular profiles are mixed, so there is no general UI speedup claim.
- A viable per-tree publication option has not been implemented and measured.
  Module exclusion is an observed opportunity, not proof of a semantics-preserving
  flag or permission to discard required earlier evidence.

The implementation reviews are distinct: contributor/address representation
equivalence includes executed falsifiers; reclamation reviews inspect ownership,
capture ordering, ordinary-lifetime transitions and line-specific compatibility
against focused executed tests. Final integrated validation is recorded separately
from all of those narrower reviews.


The final [independent comparison review](final-comparison-independent-review.json)
checks 4,917 file bindings and all 578 final comparison children, recomputes the
main and private metrics and A/A pairs, and checks all 132 dispatch memory
children's intermediate states. It finds no material admission, identity,
arithmetic or observable-work blocker. The reviewer performed source inspection
and offline arithmetic, not another benchmark run. The single protocol wording
correction records the actual two-source private packet preparation and the
inventory build's source reachability; it changes no measured input or result.

## Adoption and optionality decision

Keep the v15 ordered-subject cache and the v16 temporary publication indexes.
Keep both lines' automatic reclamation and activation-index cleanup, plus the
active-row guard. These remove measured redundant work and dead state without
changing public API or asking consumers to select weaker behavior. The rejected
linked walker and eager index remain rejected; favorable isolated samples do not
override their broader CPU/heap costs.

Keep the final exact source packing and batch-local contribution sharing. Their
retained/pending heap savings are demonstrated in complete workloads, with the
mixed-proof and full-capture CPU costs above. The
[independent retention interpretation](v16-terminal-final-independent-review.json)
checks the raw evidence and its limits; it does not claim constant history space,
universal leak freedom or the minimum possible price of the guarantees.

Keep the existing enhancer and demand choices. Do not add cache, cleanup or
"fast point" configuration flags: their viable internal representations already
follow actual demand, and correct cleanup must be automatic. The published
capability plan is resolved at construction; a larger public option matrix needs
a measurable benefit over this existing selection.

Per-tree publication selection is a substantial remaining design opportunity,
because final module-only heap still sits around 30.14 MiB versus 6.91 MiB with
Link removed. It is not implemented in this change. A compatible design must
specify late enrollment and cross-tree consumption, pass those existing traces,
and price complete implementation costs before adoption. Ordinary v16 topology
and current-reader integration remain built in; this study does not demonstrate
that an external enhancer can reproduce their guarantees at lower cost.

For application choice, the four-arm ordinary study supports v15 when stable
entity handles and repeated entity edits/queries justify its indexes. Native
per-row signals remain cheaper in the measured sparse path. NgRx offers its
Angular store-feature ecosystem and lazy deep signals; matching SignalTree's
lifetime, rollback/restoration and Link contracts requires additional application
or feature code. Full v16 coordination buys stronger behavior, with an explicit
startup, publication and pending-memory premium. The measured ordinary workload
does not show v16 overtaking v15 after amortizing setup.

[Final validation](VALIDATION.md) keeps artifact identities and numerical size
failures explicit. These are reviewed successor implementations on separate
branches, not a new npm version, tag, merge or deployment. The original released
v15 and qualified v16 artifacts are unchanged.

## Evidence and branches

The complete selected evidence is indexed by [EVIDENCE.json](EVIDENCE.json), with
commands, exact source/package identities, raw results, controls, independent
reviews and preserved failed attempts. The archive verifier checks supplied
payload integrity and declared hash-reference closure; it does not establish
complete repository history, semantic correctness or a reproducible installed
environment by itself. The report and current ledger are outside the archive's
self-hash cycle and are versioned with this study commit.

Runtime branches: [v15 maintenance successor](https://github.com/JBorgia/signal-tree/tree/codex/v15-retirement-reclamation)
and [v16 successor](https://github.com/JBorgia/signal-tree/tree/codex/v16-egress-support-scan).
The current study lives on [codex/application-comparison](https://github.com/JBorgia/signal-tree/tree/codex/application-comparison).
