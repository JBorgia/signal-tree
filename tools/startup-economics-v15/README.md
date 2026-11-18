# V15 startup attribution

This experiment separates ordinary tree construction, EntityMap population,
first demand, subsequent useful work and release. It evaluates sparse initial
entity revisions and first-claim allocation of dormant observation records.
It does not change either line's containment policy or add a public mode.

`run.mjs prepare KERNEL_PACKAGE ANGULAR_PACKAGE NEW_OUTPUT` bundles identified
built packages with production defines. The Angular arm uses the actual facade,
including construction-input handling and the Angular peer runtime. The neutral
arm uses the kernel. Fixtures remain unminified to preserve sampled function
names; their byte size is not a delivered-size result. Source-runtime aliases
are refused. Packet bindings hash imported modules, the emitted fixture, runner
and Node executable. Build receipts remain separate evidence from source sidecars.

`run.mjs run BASELINE_PACKET CANDIDATE_PACKET NEW_OUTPUT cpu|heap ROUNDS`
launches serial fresh Node 24.15.0 processes. CPU and forced-GC cohorts are
separate. Each round includes a neighboring baseline A/A sample; A/A describes
observed noise, not a confidence interval. There are no discarded warmups.
Host load is recorded; this is not exclusive-machine isolation.

Profiles use 64 ordinary trees with 128 scalar fields, or one collection of
1,000/10,000 six-field rows (one field is a nested object). The 10,000-row
transactions profile configures the enhancer but does not time explicit
transaction settlement. Ordinary work performs 4,096 immediately checked
writes, attaches 64 late scalar Links, writes through pre-held callables, checks
every delivery, disposes Links and checks held snapshots. Entity work validates
every value, key and order, acquires 100 row nodes, performs 1,000 checked writes,
replaces the full collection in reverse order, then removes and reuses a key
while checking that the old node stays retired. Every tree is destroyed.
Forced-GC children additionally assert actual tree WeakRef release after four
event-loop/collection passes. This does not prove arbitrary retention freedom.

The initial ordinary profile claims only 64 of its 8,192 leaves. Its `active`
heap checkpoint is after Link disposal, and does not measure live Links or
dense first-claim demand. The initial transactions profile only configures the
enhancer; it does not open, confirm or roll back a transaction.

Factory timing excludes seed generation and population. Heap differences are
whole-process bytes above the module-ready checkpoint; seed arrays are included.
They are not retained/dominator sizes or universal per-entity figures. Timed
stage sums are not whole-application startup, browser rendering or total episode
cost. First-read result assertions run outside that stage; write assertions run
inside the write stage. Instrumented `kind: "profile"` samples are attribution
only and are never pooled with comparative CPU samples.

The initial three-round cohort retained adverse Angular population timings.
`followup.mjs plan CONFIG NEW_PLAN_DIRECTORY` pre-registers seven matched rounds
with baseline, sparse-only and combined arms, rotating/reversing their order and
alternating neighboring A/A samples. Its 84 children cover Angular 10,000-row
bare and configured-transaction populations plus ordinary construction, using
the unchanged first-cohort child. `followup.mjs run PLAN_JSON NEW_OUTPUT` executes
that exact plan. `analyze.mjs RESULTS_JSON [candidate|sparse|combined]` reports
paired medians, ranges and maximum observed A/A differences without discarding
the initial cohort.

`activation-heap.mjs plan CONFIG NEW_PLAN_DIRECTORY` registers a separate
follow-up on the same exact baseline/combined artifacts: 27 fresh Angular heap
children across three matched rounds with adjacent A/A samples, and 12 positive
and negative controls. Sparse ordinary demand claims 64 of 8,192 leaves; dense
demand claims all 8,192. Distinct checkpoints retain live Links, then dispose,
then rearm them while checking pre-held setters and every delivery. The third
profile populates 10,000 rows, opens and confirms one transaction, opens and
rolls back another, then retires and replaces a lifetime. It checks pending
authority, values, order, held snapshots and old-node isolation. Controls drop a
real delivery, omit destruction, omit confirmation or omit rollback and must
fail their named oracle. A positive tree pin/release control establishes that
the WeakRef release check observes an actual retained tree. Run controls before
the registered heap cohort using `activation-heap.mjs run PLAN_JSON NEW_OUTPUT
controls|heap`. These results supplement the earlier checkpoints; they never
rename them or establish a CPU improvement.

`build-packages.py snapshot WORKSPACE NEW_OUTPUT` preserves source inputs
without a build. `build-packages.py build WORKSPACE NEW_OUTPUT` snapshots inputs,
removes owned `dist/`, performs the canonical package set's uncached serial Nx
build and emits complete package manifests compatible with the application
comparison admission. It includes `llms.txt` and all current
`nx.json#namedInputs.packageBuildGlobals`, package sources/configurations, root
TypeScript/workspace/lockfile inputs, scripts and build tooling. Actual installed
dependencies must be admitted with the pinned frozen lockfile. Final artifacts
must use the reviewed committed source and follow the release guide's normal
and mutation gates before the clean build. Snapshot-only output and the earlier
two-file prototype receipt are not full build or release qualification.

Semantic qualification is separate: focused kernel/Angular tests and the
mutation-tested retired-lifetime gate cover stable held callables, overlapping
claims, first identity/rearm, sparse revision defaults, prepared targets,
reclamation and stale lifetimes. Full package qualification, canonical bundle
budgets and production demo/documentation gates remain required before sign-off.
