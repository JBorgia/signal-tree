# Application improvement experiments

This follow-up preserves the registered [observable contract](PROTOCOL.md).
The first complete inventory cohort identifies two large costs: initial v16
population and repeated filtering in the TanStack query implementation. These
are investigation targets, not conclusions about their causes or remedies.
The baseline files, builds and results remain immutable.

## Attribution before selection

Run separate profiles against the qualified baseline at 10,000 rows for v16,
v15 and TanStack. Inspect startup, repeated filtering and point edits. Report
mapped sample coverage, garbage collection, idle/unmapped samples and overlapping
browser duration metrics. Do not combine instrumented runs with the comparative
timing cohort or equate sampled timestamp weights with exact function CPU.

For SignalTree, distinguish empty tree creation from initial population. A
neutral-package diagnostic may compare public `setAll` and `addMany` on a fresh,
empty store with copied unique rows and a pure ID selector. This only selects
an application candidate; the production Angular result determines application
impact. Preserve duplicates, replacement, hooks and reentry behavior elsewhere;
the two APIs are not general substitutes.

For TanStack, inspect repeated query creation, initial evaluation, result
materialization and query retirement. A candidate may use a persistent ordered
collection view and Angular computed filtering, or one matching query with
derived count/viewport. Keep literal substring matching, immediate counts,
insertion order, the 40-row viewport, editing and complete session cleanup.
Additional materialized data, edit work or heap are measured tradeoffs.

## Admitting and comparing a candidate

Keep experiments in a separate source location. Bind original and changed
source, dependency and served bytes. Change one causal feature at a time; do
not pool distinct variants or silently repair a failed packet.

Before timing, rebuild the affected production AOT applications and pass the
same conformance traces and planted controls. If shared SignalTree initialization
changes in dispatch, rerun dispatch conformance, including late previews,
reentry, entity retirement and pending teardown. Public runtime artifacts stay
unchanged unless a separately justified runtime change is selected. Any runtime
change needs the existing point-work/lifetime witnesses and full qualification.

For admitted inventory candidates, use five fresh-browser before/after pairs
per affected arm at 1,000 rows/1x, 1,000 rows/4x and 10,000 rows/1x. Alternate
pair order and rotate arm order. Include two separate v15 baseline A/A pairs
per profile. Write the schedule before launch; execute locally serially. Reuse
the baseline's 30 filter/30 toggle actions, exact intermediate checks, startup
boundaries, forced-GC checkpoints and finite aging/teardown. Preserve every
attempt, browser PID, raw child and host observation.

Add a separate 30-action title-change trace after those interactions and before
aging, on both before and after builds. Select J-0, filter `pump`, then alternate
its title between `Inspect valve changed` and its original `Inspect pump 0`.
Prepare the input outside the timer; time the Rename click through the existing
event-to-layout boundary. Assert the stored title, matching count, exact 40-row
insertion-order viewport and J-0's visible presence/absence after each action.
Return to the empty filter before aging. This tests a mutation that changes
filter membership, which active-flag toggles do not. It is a new matched cohort;
its heap/aging results are not pooled with the earlier baseline cohort.

Report paired child values, differences and ratios plus independent-child
min/median/max. Keep A/A controls separate; they are not confidence intervals.
Do not pool child operations into a population p95. Recompute served raw/gzip
bytes and source inventory. A failed or incomplete cohort supplies no comparative
claim. Timing improvements must be weighed against initialization, edit latency,
heap, cleanup, source complexity and compatibility costs.

No new SLO or acceptance ceiling is fitted to a result. Conformance is mandatory;
economic disposition is specific to the measured workload and feasible options.
Preserve inconclusive and unsuccessful candidates as findings. An application
improvement is not evidence that an unexercised library guarantee is unnecessary.

Independent read-only premise review found no blocker for these bounded
questions. Its editing-scope concern is addressed by the explicit title-change
trace above; add/remove performance and human maintenance effort remain unmeasured.

## Dispatch payload experiment

The completed 174-child dispatch cohort adds a concrete target: TanStack
acknowledgement processing grows with the full publication payload (10,000-row
median child p95 22.1 ms). A separate source-mapped profile samples native proxy
deep cloning during that stage. The application stores frozen payloads inside
mutable intent records; source inspection and profiles motivate a private
representation trial, not a precise per-function CPU attribution.

Keep immutable publication payloads in an application-owned map keyed by intent
ID while native collection records own mutable intent metadata. Install the
payload before publishing the `started` state, preserve the same frozen transport
payload and acknowledgement/reentry policy, and release the map entry on payload
dismissal and session destruction. The added map is counted application work;
it does not disappear from source or heap measurements. Late-preview query
materialization is unchanged by this trial and cannot be claimed improved.

Require the same production dispatch conformance and all planted controls on the
new exact build before measuring. Compare five fresh before/after pairs per
affected arm at each existing profile (1,000/1x, 1,000/4x, 10,000/1x), alternating
pair order using a fixed arm index and rotating arm order. Two separate baseline
v15 A/A pairs per profile remain controls. Each schedule entry has separate
timing and memory browser children, reusing the original 20-round workflow,
128-pending checkpoint, preview, settlement/pruning, aging, pending teardown and
late-delivery checks. Write the complete schedule before launch. Include every
attempt; do not pool this cohort with the first study or with instrumented runs.

Report matched per-child stage/p95 values, startup, all whole-application heap
checkpoints, served bytes and maintenance surface. Interpret differences against
same-arm repeatability and workload impact, without a fitted threshold or an
aggregate winner. This experiment changes only private application source.
