# Direct keyed-map construction screen

This is a private neutral-kernel experiment for M, not a library API or an
application recommendation. No results exist at protocol registration. The
original runtime-screen and all prior packets stay unchanged. Runtime proposals
are separately preserved under the optimization sweep's proposals/direct-map.

## Artifact admission and execution

Prepare one packet per unchanged baseline or candidate. The runner accepts the
three explicit existing identified manifest formats: prior canonical v15 package,
fresh built baseline, or identified built prototype. It verifies the complete
kernel payload inventory and successful exact build receipt. Canonical manifests
also join the canonical kernel payloads, source seal, head and archive digest.
Prototype receipts with immutable source snapshots verify those files; a mutable
worktree path or later documentation-only HEAD is never substituted for source
identity. The original manifest and declared source identity remain in the packet.
This is exact package use, not an independent reproduction of the entire build.

Production esbuild consumers export signalTree/entityMap in the bare arm and also
link/transactions/restoration in the modules-loaded arm. Actual emitted module
contributions, not parsed dependency presence, must establish optional loading.
v16 modules-loaded emits its native entity publication factory; v15 does not have
that factory. This distinction is explicit. No recipient is enrolled and no
optional enhancer is instantiated in either workload. These arms are not claims
of equal native guarantees between release lines.

Node24.15.0 executable bytes, runner/protocol, esbuild JS/package/native binary,
toolchain manifest/lock, all consumed kernel inputs and generated bundles/meta are
bound. Children import exactly one kernel authority. Full provenance inputs are
checked by the parent before/after the cohort and at admission. Each child reads
only a compact execution manifest containing its exact package payloads, bundles,
Node, runner/protocol and parent packet hash; it verifies those execution bytes
before/after work. Parent admission derives that compact manifest from the full
packet and binds both files. This avoids hashing/parsing extra source-snapshot
provenance in only a prototype child. The provenance is still fully checked; source changes require fresh packets and controls.
Two packets compared in one invocation must belong to the same release line and
Node executable, with equal esbuild JS/package/native binary, version, toolchain
manifest and lock bytes. Cohort admission reconstructs the complete mandatory
packet/input union, binds each exact child command and invocation sidecar, and
rejects cleanup, admission, spawn or signal failures by presence, even falsey errors. Preserve every first failure; no overwrite or selected retries.

```
node tools/optimization-sweep/direct-map-screen.mjs prepare MANIFEST TOOLCHAIN PACKET
node tools/optimization-sweep/direct-map-screen.mjs selftest HELPER_OUTPUT
node tools/optimization-sweep/direct-map-screen.mjs controls BASE_PACKET M_PACKET CONTROLS
node tools/optimization-sweep/direct-map-screen.mjs compare BASE_PACKET M_PACKET COHORT CONTROLS/results.json
node tools/optimization-sweep/direct-map-screen.mjs analyze BASE_PACKET M_PACKET COHORT/results.json ANALYSIS
```

Root owns the heavy execution slot. Freeze and independently review this source
before preparation, controls or measurement. No existing release artifact is edited.

## Work and units

Each child is a fresh Node process with one store. Rows have8 or32 total fields
including id/value,10,000 rows in normal measurement. First populate the store;
measure its first asMap() alone, then20 unchanged cached reads, then40 iterations
of updateOne followed by asMap. The40 IDs and values are deterministic. Each timed
iteration asserts the changed row value, total cardinality and a distinct map
after installation. Stage CPU is process.cpuUsage user+system microseconds, also
reported in ms; elapsed is monotonic nanoseconds. The40-stage includes updates,
projections and these constant oracles. It is not pure Map-constructor CPU.

Full initial and final maps independently verify every storage key, field and
ordered value outside timers. Digests must agree across arms. The initial map is
held across all40 edits and checked unchanged. Its reference is then released.
Untimed semantic work checks storage rekey without rewriting payload ID, old held
map identity, remove/re-add replacement, omitted collection reads and supplied
reactivation values. These probes follow the timed phases and retain no snapshot
after returning. The store is destroyed and references dropped before final GC.

Memory uses separate children with identical functional work and no reported CPU
timings. Each checkpoint performs three GCs separated by event-loop turns, then
samples process.memoryUsage after another turn: imported module, populated store,
first map held, initial+latest maps after40 edits, initial map released, after
semantic probes, after destruction. Seed array is dropped before populated GC;
no separate full expected row store is retained. Signed deltas are whole-process
finite observations, not allocated bytes, retained dominators or universal leaks.
The checkpoint after initial release still includes the library's current map
cache. Post-destroy module/compiled-code retention is not charged wholly to rows.

## Schedule, controls and interpretation

Four profiles: width8/32 crossed with bare/modules-loaded. Three alternating
baseline/candidate rounds, timing and memory separated, plus two baseline A/A
pairs per profile and kind:80 measurement children per release line. Complete
schedule is written before execution. The three-round order has partial positional
balance. All main samples are retained; A/A is descriptive noise evidence.

Before comparison require28 control children: each arm and module profile has a
100-row normal execution and six faults. Missing population row, skipped update,
forced stale map, changed held snapshot, skipped rekey and skipped omission must
fail their exact nonvacuous oracle. An unrelated error or cleanup failure does not
count. Complete normal stages and memory checkpoints are required at admission;
missing data cannot become an analysis. These controls do not replace the source
proposal's baseline semantic tests, tuple instrumentation or native attribution
mutation checks.

The separate selftest checks schedule identities and complete timing/memory shapes
with synthetic values, including omitted stage/checkpoint/oracle and invalid CPU
rejection. It also exercises the actual admission path with a synthetic bound
packet/cohort, then removes an input or alters a command/sidecar, and checks falsey
thrown/cleanup errors. Synthetic packet data never qualifies a runtime. It does not execute or qualify a runtime or replace the28 real controls.

Report each profile and kind independently with raw matched pairs, median/range
differences and A/A. Do not pool release lines, widths, module states or memory
and timing children. No automatic winner or numerical significance claim. A lower
tuple count does not establish CPU benefit; direct Map.set may trade optimized
constructor iteration against transient objects. The next decision weighs CPU,
finite heap, code size and complexity against unchanged behavior. This screen is
not app/browser performance, native-recipient parity or release qualification.
