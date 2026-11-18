# Publication activation cost experiment

This new harness compares an identified v16 baseline and an implemented candidate
using the same neutral-kernel consumer. It is not a semantic substitute for the
existing native/source suites, installed workflows, original point-work bound or
release gates. No measurements are included here.

The initial candidate question is transparent deferral of entity publication
participant allocation for a safe cold prefix. Ordinary scalar participation
continues through the existing native path. No public configuration is introduced.
The emitted Link and both native factory modules remain present in the loaded
arms; a separate tree has a real Link with a checked delivery. A separate no-Link
bundle is a regression control, not evidence of per-tree isolation. It retains
exactly the two named imports `signalTree` and `entityMap` (selectedimports2),
without the enhancer/tooling exports required by the loaded fixture.

## Freeze inputs before execution

Use Node 24.15.0 and the repository's pinned pnpm. Obtain both manifests from
`tools/optimization-sweep/build-kernel.py`; this harness does not build runtime.
Copy `config.example.json` to a new artifact configuration, fill both manifest
paths and SHA256 values, review the explicit profiles, and freeze that file.
The default matrix contains twelve profiles, three paired CPU rounds and two
paired heap rounds. Two additional baseline A/A pairs cover entity and ordinary
state in each measurement kind. There are eighteen separate control children.

Preparation compiles only small production consumer bundles. Root owns the build
and measurement execution slot; do not overlap these commands with another heavy
build or measurement. All output directories must be new.

```text
node tools/publication-activation/run.mjs prepare CONFIG_JSON TOOLCHAIN_WORKSPACE NEW_PACKET
node NEW_PACKET/run.mjs plan NEW_PACKET/packet.json controls NEW_CONTROLS_PLAN
node NEW_PACKET/run.mjs run NEW_CONTROLS_PLAN/plan.json
node NEW_PACKET/run.mjs plan NEW_PACKET/packet.json cpu NEW_CPU_PLAN NEW_CONTROLS_PLAN/execution/results.json
node NEW_PACKET/run.mjs run NEW_CPU_PLAN/plan.json
node NEW_PACKET/run.mjs plan NEW_PACKET/packet.json heap NEW_HEAP_PLAN NEW_CONTROLS_PLAN/execution/results.json
node NEW_PACKET/run.mjs run NEW_HEAP_PLAN/plan.json
node NEW_PACKET/run.mjs analyze NEW_CPU_PLAN/execution/results.json NEW_HEAP_PLAN/execution/results.json NEW_ANALYSIS_JSON
```

The config, runner, workload and this protocol are copied/bound before execution.
Each package is admitted through its complete inventory, successful Nx build
receipt, exact source snapshots and patch, and unchanged-input claim. The receipt
HEAD is reported as such; documentation HEAD is not relabeled runtime provenance.
Both package authorities, consumer sources, bundles, emitted-contribution
metafiles, Node executable, complete installed esbuild JS/native package payloads,
toolchain manifest and lockfile are hashed. Source aliases and a second runtime
in a consumer bundle are rejected. Consumer bundles are minified ESM, Node24
target, with production defines and tree shaking. They are neutral fixtures,
not Angular browser application or release-budget bundles. Raw and level-9 gzip
bundle sizes are reported.

The parent verifies the same complete closure before each child and after it.
Children read only the compact shared execution manifest and import their chosen
bundle; full source-inventory hashing does not become asymmetric child prehistory.
Each sample is a fresh Node process. CPU children have no exposed GC. Heap
children expose GC and emit no CPU times. `NODE_OPTIONS` is cleared for children.
Actual commands, PID, environment summary, status/signals, raw results and logs
are retained. First unexpected failure stops the run. A correction requires a
new packet/output; no favorable retries replace earlier evidence.

## Workload and timing boundaries

Entity rows have an id plus `width-1` numeric fields. Ordinary branches contain
`width` numeric leaves. Counts, widths, trees and history cycles are explicit in
the frozen config. The selected cases include 1k/10k narrow entities, 10k wide
entities, 256 small entity/ordinary trees, no enhancer, transactions, restoration,
combined enhancers, initial/late recipient, active unrelated recipient and a
no-Link bundle. The cases are selected profiles, not a complete Cartesian matrix.

Every loaded profile creates an unrelated scalar tree, attaches a real Link,
writes 17 and requires the exact delivery. Target trees are populated and receive
up to 200 distinct literal edits before their first full-context read. Collection
count is the only pre-context collection read. Reading rows/snapshots earlier
would itself exercise promotion and erase this cold-prefix question. The first
context invokes the actual `tree.$()` root read and verifies every field of every
row, including changed and unchanged rows. Its canonical entity shape is
`{ rows: { all: [...] } }`; ordinary state is `{ values: { ... } }`. Later phases
retain and recheck the actual root snapshot, including its native certificate
associations. Ordinary profiles likewise use root reads in this context stage.
A runtime must separately prove
that collection `count()` does not itself promote publication evidence.

The first context and late attachment are distinct stages. The first context may
already promote a candidate; late attachment therefore measures enrollment after
that context, not a second claim of first promotion. Eight actual `tree.$()`
root-context reads per tree exercise the warm path, with an exact useful value
sum extracted from `snapshot.rows.all` or `snapshot.values`. Raw `rows.all()`
reads are used for later value oracles; they are not labeled native context
capture. Initial recipients
are deliberately enrolled before population.

History cycles replace every row/ordinary value with a fresh epoch. Entity keys
also change each cycle, exercising retired lifetimes rather than only rewriting
existing payloads. Transaction
profiles retain one pending owner per tree, require every pending value, require
no target delivery while pending, then alternate confirmation and rollback.
Settlement must leave zero pending owners, exact full values/order, the unchanged
held snapshot, and a positive target delivery of the correct value. Nontransaction
profiles make ordinary replacements. Restoration profiles additionally make one
useful f1 edit explicitly designated through synchronous `undoable()`, undo it,
and redo it, checking exact before/after values. Earlier population, sparse edits
and history replacements are not designated as undoable. This
roundtrip timer explicitly includes its useful checks.

Every target delivery retains its ordered SHA256 digest, never its row payload.
Stage checks cover attachment, population, literal edits, each settlement and
each restoration step. Every observed digest must match the expected value for
its stage; the complete accumulated trace is rechecked so corrupting an earlier
digest cannot hide behind a later correct delivery. Stages that must publish also
require a new positive delivery. The ordered trace and stage ranges are retained
in results and independently replayed during admission. These bounded hash lists
are part of the measured fixture's retained heap.

CPU stages aggregate factory, initial attach, population and its drain, literal
edits and their drain, first
context, late attach, repeated contexts, history mutations, settlement calls,
settlement/drain, restoration roundtrip, Link disposal/drain and tree destruction/
drain. Population/replacement includes fresh input-object creation, equally for
both arms. Dynamic consumer module import is a separate CPU/wall observation;
it is excluded from the workload phase sum. A separate whole-episode CPU/wall
envelope surrounds the complete workload, including all value/trace oracles,
pending-owner drains, input generation, disposal and cleanup. This envelope
includes validation overhead and is not application latency. The selected phase
sums exclude assertion gaps, pending-owner check drains and housekeeping; they
must not be reported as complete episode cost. Raw user/system CPU and wall nanoseconds are
retained alongside milliseconds. Delivery hashing occurs in sink callbacks and
is included when those callbacks run inside a measured drain.

Heap checkpoints use three GCs separated by event-loop jobs: module ready, empty,
populated, literal edits, first context held, enrolled, history with context held,
Links disposed, destroyed trees deliberately held, and owner helper returned.
The sampled objects are the actual first tree and first returned root context snapshot;
the snapshot is not claimed to be an isolated canonical backing allocation.
History-held checkpoints intentionally include the held old context. Inputs and
expected-value arrays are created in returned helpers; no growing reference model
or receipt list owns all historical row payloads. Normal helper-return WeakRef
outcomes are observations, not a universal collection assertion. Separate controls
pin the actual tree and snapshot, require them alive, release them, and require
collection. Whole-process signed deltas are not total allocation, peak memory or
per-feature dominator attribution.

## Controls and remaining qualification

Both arms run positive small transactional and restoration/late-Link workloads,
plus a positive initial-recipient workload, five planted faults (drop population,
final literal edit, unrelated delivery, or settlement; corrupt an earlier target
delivery digest), and a heap pin/release control. The trace fault changes the
first recorded digest only when a second correct delivery arrives, keeping the
last digest and count correct; it must fail `target-delivery-history-oracle`.
Only the intended named oracle counts as expected
failure. Cleanup, spawn, incomplete metric schemas or unrelated errors reject a
sample. CPU/heap plans require admitted exact-packet controls. The analyzer
rejoins the schedule, command, packet, logs, raw measurements and controls, and
requires paired semantic observations (including target delivery counts) to match; it
reports every sample and paired candidate-minus-baseline differences. A/A is a
variation observation, not a confidence interval or significance claim.

This cost screen does not establish pre-enrollment proof identity, foreign-owner
windows opened during getters, cross-tree input consumption, equal-value
authorship, inspection separation, source retirement eligibility or the original
strict point bound. Those remain independent correctness gates before candidate
adoption. Counts and successful final values alone cannot establish those contracts.
