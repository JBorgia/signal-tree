# Independent diagnostic results interpretation

Reviewed PREREGISTRATION, AFTER, schedule and raw child results with bounded arithmetic summaries. AFTER records82 completed/valid results and no source/input mismatches. This is clean diagnostic execution, not cost acceptance or adoption. No test, profiler, snapshot parser, campaign or retry was run by this reviewer; calculations read existing result JSON only. No other reviewer's verdict supplied the conclusion.

## Economics and scheduling

Recomputed medians/ranges under the registered nonoverlap plus maximum same-arm/A/A-range rule. Every registered synchronous/two-immediate/22-turn cumulative CPU and wall endpoint is unresolved in this fresh economics cohort:

| Endpoint | Before median | C median | Maximum observed variability |
| --- | ---: | ---: | ---: |
| synchronous wall | 65.908958 ms | 60.466250 ms | 68.885167 ms |
| synchronous CPU | 115.878 ms | 92.237 ms | 59.744 ms |
| two-turn cumulative wall | 66.034958 ms | 60.633084 ms | 69.039750 ms |
| two-turn cumulative CPU | 116.078 ms | 93.942 ms | 59.386 ms |
| 22-turn cumulative wall | 66.741167 ms | 61.531667 ms | 69.065958 ms |
| 22-turn cumulative CPU | 116.631 ms | 94.716 ms | 56.512 ms |

These data neither reproduce a stable4.33ms drain penalty nor establish its recovery. Subtracting each child's sync endpoint gives C two-turn drain wall samples8.146/0.166834/0.200041/0.254417/0.192ms, versus before0.236792/0.401250/0.555833/0.196834/0.126ms. C has one large excursion, not a consistently larger increment. Its corresponding CPU excursion25.216ms makes a universal cheap-drain conclusion equally unsupported. Additional turns include harness scheduling, process/JIT/GC work;22 turns do not prove completion of all consequences. Do not replace, pool or reinterpret the prior acceptance cohort using this diagnostic cohort.

Copied point traces have2000 source/native preparation and completion hits in both arms, with C using Native.preparePoint and before Native.prepare. At rewritten direct scheduler sites both point traces record zero scheduled/executed/current tasks. This is evidence against an extra direct instrumented point queue in this workload, not absence of all deferred work or proof that a queue can be removed. GC observer records4 events/13.510ms before and2/3.711ms C in these instrumented children; these durations cannot attribute the historical wall difference or supply uninstrumented CPU acceptance.

Pending-author traces match100 scheduled/executed path-notifier microtasks per arm. Pending-settle traces match111 scheduled/executed tasks per arm: one path-notifier,100 lifecycle cell-cleanup and10 transaction sites, with final current0. Preparation metadata reports responsibility capture on authoring and no responsibility preparer on settlement; both use generic native preparation. These exact counts identify measured boundaries/sites and no count imbalance between arms. They do not prove all111 operations mandatory, redundant or the source of retained bytes. async_hooks and event/GC phases remain diagnostic/harness-inclusive; observer delivery phase is not collection occurrence time.

## Pending scaling

Anchor pending-minus-primed medians are1,034,936B before and1,096,576B C (+61,640B across ten trees). This broadly resembles the earlier pending increment but is a separately sampled descriptive observation, not a pooled estimate or per-owner budget.

With fixed33 held readers per tree, pending-minus-primed is near75KB in both zero-owner cells. Distinct-row medians at1/10/32 owners per tree are402,832/1,039,604/3,208,808B before and448,780/1,104,036/3,288,988B C. Same-row medians are402,136/1,004,628/3,085,092B before and449,156/1,065,732/3,169,496B C. Thus C is descriptively higher at every nonzero controlled cell here, while reusing one row does not eliminate owner-count growth. Distinct-row growth is somewhat larger at high count; this is topology/workload evidence, not an isolated causal partition.

Two controlled replicates do not establish statistical significance, linearity, asymptotics or a constant per-owner slope. Zero-owner phase increments are nonzero, and the1-owner settled increment is already large. Priming fixes reader retention but owner count still changes authored facts, handles, windows and histories. Anchor ephemeral priming and controlled held-reader data must remain separate. Negative destroyed-minus-primed values reflect destruction of the populated fixture, not negative owner storage.

## Allocation and snapshots

Summed existing sampling-profile node selfSize values are62,672,728B before versus23,499,016B C for point; pending-author14,888,048 versus14,835,760B; pending-settle14,125,128 versus13,939,984B. These single-child Poisson sampled totals, including collected JS and profiler/quiescence effects, suggest the point profiles differ substantially while pending phase profiles are much closer. They are neither exact allocation totals nor retained/native storage measurements, and no replication/acceptance conclusion follows. Before point stacks include generic prepare/Map/iterator activity; C includes preparePoint and still generic/requirement work. Stack names require module/call-path interpretation, not direct conversion into a removable operation count.

Snapshot additive self-size totals differ C-minus-before by-15,688B primed,+44,128B pending,+49,968B rolled-back,+52,488B confirmed and+24,976B destroyed. These are one fresh child per checkpoint/arm and include source/code/engine/harness differences; their values are not longitudinal heap changes or direct reproduction of process-heap medians. Parser retained/class sizes overlap and cannot be added into a cost partition.

Field-shape nativeRequirement self-size is identical between arms at corresponding checkpoints (17,120B primed/rolled-back,25,120B pending/confirmed); fieldEndpoint and physicalView groups also match corresponding endpoint checkpoints. That does not eliminate requirement graphs, contexts, arrays or retained closures as contributors: signatures overlap and do not traverse exclusive retained ownership. ownerCell signature matches zero despite positive pending semantic checks; this is an explicit warning that shape matching is not an owner census. Numeric/property encoding and shapes can omit matches. No inference of absent owners is warranted.

The destroyed snapshots and sampled WeakRefs show fixture release within the exercised diagnostic boundary, not universal collection. Incoming edge samples and calibrated retained-engine values can locate candidate graphs but have not, by themselves, established an unnecessary lifetime or operation. No unique removable owner journal, strong root or byte-exact culprit is demonstrated by the summaries inspected here.

## Warranted disposition

The packet narrows the question: pending growth persists with fixed readers and same-row ownership; direct instrumented scheduler counts match; the fresh drain economics are variable/unresolved; point sampled allocation is smaller without a corresponding isolated pending-allocation finding. None establishes a semantically safe repair or licenses an ownership redesign. Keep existing C/runtime-cost HOLD and the prior cost evidence intact. A repair requires a concrete retained/scheduled path, proof of unnecessary lifetime/work under supported semantics and a targeted falsifier; this review does not invent or authorize a new campaign.

Limits: inspected existing offline analysis outputs rather than rerunning parser/dominator calculations or independently verifying every incoming edge. Engine-qualified nonadditive retained sizes and field signatures are diagnostic evidence only. No release, production SLO, owner-identity census, minimum semantic cost or complete lifetime proof follows.
