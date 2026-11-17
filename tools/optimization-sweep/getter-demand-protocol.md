# Shared getter resolver demand screen

Private C1-versus-G experiment. The existing production runtime-screen packets
provide the exact neutral kernel bundles; this tool does not rebuild runtime or
change an existing packet/generator. Use native-loaded bundles with link,
transactions and restoration exports retained, but instantiate no enhancer or
recipient. Module reachability is not equivalent to an enrolled native workflow.

Before execution freeze this runner and protocol and obtain source review. Root
owns the heavy slot. First failures remain; corrected tooling requires new bound
wrapper packets and fresh controls. No results existed at registration.

```
node tools/optimization-sweep/getter-demand-screen.mjs prepare C1_RUNTIME_PACKET C1_G_PACKET
node tools/optimization-sweep/getter-demand-screen.mjs prepare G_RUNTIME_PACKET G_G_PACKET
node tools/optimization-sweep/getter-demand-screen.mjs controls C1_G_PACKET G_G_PACKET CONTROLS
node tools/optimization-sweep/getter-demand-screen.mjs compare C1_G_PACKET G_G_PACKET COHORT CONTROLS/results.json
node tools/optimization-sweep/getter-demand-screen.mjs analyze C1_G_PACKET G_G_PACKET COHORT/results.json ANALYSIS
```

Preparation checks the complete144-payload package inventory against each source
manifest, exact successful build receipt, preserved source snapshots when present,
all original packet bindings and native factory bytes actually emitted in its
metafile. Full source/build provenance is verified by the parent. Children read a
compact execution manifest derived and bound by the parent, with only exact
package payloads, bundle, Node and runner/protocol plus parent packet hash; those
execution bytes are checked before/after work. This avoids asymmetric prototype
source-snapshot parsing/hashing in a child without omitting provenance checks. Historical source metadata stays labeled; package verification does not
independently reproduce a build. Node24.15.0 executable bytes, new runner/protocol
and old production bundle bytes are bound. Both arms must use identical captured
esbuild/lock dependencies. Admission reconstructs the mandatory packet union,
checks every exact child command/result/log/invocation sidecar and rejects even
falsey cleanup/spawn/admission errors. No incomplete metric payload is admitted.

Each fresh child constructs two trees of256 rows and holds all512 row handles.
Rows contain8,32 or128 total numeric fields, including id; other fields are f0
through f(width-2). Values encode row ID and field index independently. The same
handles pass successively through0,1 and all demanded fields. This is a cumulative
demand experiment, not three independent populations. Zero-demand whole-row reads
do not acquire fields. Descriptors are inspected without invoking their getters.

CPU children never invoke GC. Population, handle creation, whole-row reads,
first f0 acquisition, repeated f0 acquisition, held f0 reads, first all-field
acquisition, repeated all-field acquisition, held all-field reads and destruction
are separate stages. Repeated one-field stages use16 passes; all-field stages4.
Getter-acquisition stages accumulate exact identity matches against previously
held carriers; held-carrier stages sum values. Expected counts and sums are checked
after each timed stage. Full descriptors, values and identity checks run outside
timers. This is getter acquisition plus a useful identity consumer, not a bare
lookup instruction; held reads separately price the already-acquired path.

After timing,12 deterministic useful f0 edits check both held and reacquired row
values; both trees then rekey an entity without changing its payload ID. Held
carrier writes must reach the rekeyed entity. Removal must make old handle/carrier
reads absent and writes refuse; same-key re-add creates a distinct lifetime and
cannot retarget the old carrier. These are functional guards outside measured
stages, not claims to cover every selected-write/late-enrollment guarantee. The
proposal's existing native/neutral reentry, retry and GC tests remain required.

Memory children perform the same functional work without reporting CPU timings.
They collect three times with event-loop turns before each whole-process heap
checkpoint: module, populated, handles, whole0, one, all, after lifecycle probes,
destroyed. No separate seed/expected store remains. One/all carrier arrays and
handles are intentionally held through their checkpoints. All fixtures/references
are dropped before destroyed. Signed deltas are finite heap observations, not
allocated bytes, dominator sizes or a universal leak bound. Subsequent demand
checkpoint deltas include cache/carrier/storage changes and engine history.

Schedule: three matched alternating baseline/candidate rounds per width, with
separate timing/memory processes; one same-build baseline A/A pair per width and
kind, interposed after round1. Total48 comparison children. Three-round positional
balance is partial. A/A is descriptive noise evidence, not a confidence interval.
Keep every sample; do not pool widths or CPU/heap kinds.

Before comparison require10 control children, five per arm at width8: normal CPU,
wrong field value, wrong getter identity, normal memory with actual carrier
pin/release, and a retained-pin negative memory control. The pin fixture deletes
a materialized getter from a still-live row, proves its carrier alive while
deliberately held, then drops the pin and requires actual WeakRef disappearance
while row/tree remain usable. The retained-pin control must fail that exact
release oracle. Only the specified failure counts; unrelated errors or cleanup
failures cannot be credited. Controls run separately from the48-child cohort.

Adoption weighs zero-demand handle heap against one/all-demand heap and lookup
CPU, not only the smallest demand case. G adds a weak map/state per demanded field;
neither source code nor one heap checkpoint establishes a net win. No public API,
configuration, application recommendation or release qualification is implied.
