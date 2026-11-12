# Long-lived ordinary-store diagnostic

Registered before the first pilot, November 11, 2026. This diagnostic complements
(the root task owns) v16 guarantee-specific witnesses. It does not implement or
claim equivalence to the full Link/transaction/recovery contract.

Production-bundle named exports from the exact installed Angular facades in the
frozen application baseline, with Angular externalized to the same installed
runtime used by the common computed readers;
NgRx is the installed SignalStore + withEntities, native uses one Angular signal
per row. Dynamic imports, JIT preparation and module initialization occur before
timing. Production mode is enabled. No rendering, network or Angular application
scheduler is measured. The common task includes custom lifetime guards for
native/NgRx held editors, explicitly not a generic replacement for SignalTree.

Before measurement, run a pilot and a planted skipped-write control. Correctness
checks run on every timed write and its retained computed reader, every aggregate
query result, and every replacement/retired-editor attempt; whole-row snapshots
are checked between windows. Timing includes the common assertions, excludes
operation generation, full snapshot checking and forced GC. It is synchronous
state CPU/wall work, not user-event latency or primitive-only throughput.

The same retained store progresses through population, the first collection read,
acquiring 200 row/field
readers, cumulative sparse-write counts 100/1,000/5,000, 200 aggregate filter
updates, 128 same-key replacements with attempted retired-editor writes, late
acquisition of every numeric field on those 200 rows, another 1,000 field edits,
and destruction. The 200 retained rows span the collection. Rows have either
8 or 32 numeric fields plus ID. Collection sizes are 1,000 and 10,000.

Record cumulative actual stage durations rather than adding unrelated p95s. The
first operations are retained (no discarded warm-up). Compare five independent
serial Node children per arm/profile with rotated arm order. A second v15 child
in each profile/round is an A/A repeat, not an uncertainty bound. Preserve pilot
and first failures separately; never select favorable retries.

Heap checkpoints force GC across event-loop turns, outside timed windows. They
include the whole Node runtime, imported libraries, common oracle/data and held
readers. Report absolute heap and within-child deltas separately; do not attribute
each byte to features or add overlapping memory statistics. Late demand concerns
all fields on 200 retained rows, not full materialization of the entire store.
Cleanup drops fixture references as well as destroying/disposing the store.
Finite edit/retirement counts cannot prove unlimited boundedness or leak freedom.

Each new output directory saves a schedule before children start, immutable child
results/logs and invocation receipts. Hash baseline inputs and the diagnostic
source/protocol; bind executable files for Angular, NgRx and their dependencies.
Check inputs before and after. Capture Node, OS, CPU, process IDs, load and free
memory; the shared development host is not a controlled device benchmark.

Commands:

```sh
node tools/application-lab/long-lived.mjs pilot /absolute/baseline /fresh/pilot
node tools/application-lab/long-lived.mjs control /absolute/baseline /fresh/control
node tools/application-lab/long-lived.mjs compare /absolute/baseline /fresh/cohort
node tools/application-lab/long-lived-analyze.mjs /absolute/cohort /fresh/summary.json
```

A pilot may expose a fixture error or excessive duration. Any protocol revision
must be written before the complete cohort runs and explain the change. No
performance ceiling or winning outcome is fitted to these measurements.

Pre-cohort revision: the first pilot imported installed ESM barrels directly.
That evaluates otherwise-unused Link registration and does not represent a
selective production consumer. Its receipts are retained as a fixture-design
attempt. The complete cohort uses named-export tree-shaken bundles with saved
metafiles and hashes. This prevents attributing unselected module costs to every
ordinary consumer.

Second pilot correction before cohort: explicitly drop the aggregate computed
reader at teardown. Its Angular producer dependencies can retain collection
state even though its cached result contains only numbers. Earlier after-destroy
heap values therefore include this live fixture reader and are not leak evidence.
