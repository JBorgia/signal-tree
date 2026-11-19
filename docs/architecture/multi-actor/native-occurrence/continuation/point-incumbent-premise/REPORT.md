# Point guard provenance, retained incumbent and private-counter premise

**The increase is real under the unchanged source-count proxy, not an arithmetic/calibration artifact.** Exact retained production87f6831f measures800 at both2k/20k populations (4/update); unmodified C21 measured13800 (69/update); frozen A measured13000 (65/update). All remain constant across these two populations. Thus the collection-size discrimination survives while the absolute counted-work guard regresses. This is not a timing result or proof that all additional work is removable. A remains frozen; no budget/API/capability/runtime changes were made.

## Guard provenance and intended contract

`ef1631b0e6fde99193c5c6b0b8c7f01af300d051` (October6) introduced countIteratedElements and the strict<2000 assertion. It replaced the0.05ms/update check with the same200 updates at2,000/20,000 rows, equal counted work between populations, a useful updated-value assertion and a positive copy calibration. The commit and test comments describe preventing collection-sized walks/rebuilds and avoiding load-sensitive timing. The commit reports mutation controls killing reintroduced O(size) copies/walks; those historical mutation claims were not rerun here.

`eb259b3a529f78154727b438fd111654a2769a8f` added searches and Object keys/values/entries after review found gaps. It explicitly charges whole receiver length even when a search exits early. It reports killing indexOf/key-listing mutations. The current counter is byte-identical to this retained production counter (SHA c00fca7b2807d6f676a2fe6ca40c678cf32c20d200c11dd30d3fd62a6b4aadb7). The earlier a4973f4b1 change concerned repeated-read cache identity, not this point ceiling.

The executable contract contains TWO obligations: collection-size equality and an absolute<2000 aggregate (under10/update on average for200 updates). The prose primarily motivates the former; neither introducing commit supplies a measured derivation for the exact numeric2000 threshold or a policy permitting arbitrary future constant overhead. The absolute assertion nevertheless exists and remains binding. A constant-work implementation can pass the complexity comparison while violating this absolute guard. This tension calls for explicit cost/contract adjudication if a future change cannot satisfy both, not silently deleting/recalibrating the ceiling.

The October19 remaining-runtime checkpoint README records a broad passing incumbent suite but no exact matching count. Its “two entity budgets fail” statement concerns bundle-size gates, not this point test. Earlier C8a/C21 attribution packets quantify candidate counts, not retained production. No matched incumbent numeric artifact was found in that bounded evidence search, so the authorized one-off count experiment was executed.

## Matched retained experiment

Source is a git archive of exact87f6831fa60cafe87508f0ace84b7638698ca3b0 in this own scratch. All2517 archive files remain unchanged. The only addition is the same attribution diagnostic used on C21, changing only its output path to a runner-controlled directory. Its inherited test names say “exact C21 point visits”; here that is a copied harness label, NOT the runtime identity. Both the original unchanged guard and diagnostic run through Nx in one command. No alternate import experiment or second measurement run.

Package.json, pnpm-lock.yaml and .nvmrc are byte-identical to the working installed-tool environment (DEPENDENCY-IDENTITY.json): Node24.15.0, pnpm10.17.0. Root node_modules is a read-only dependency symlink; caches/output are local. The original counter is embedded unchanged and runs alongside the attributed equivalent on separately seeded trees, exactly as in the C21 diagnostic. Setup/assertions/teardown are outside measurement. Every updated row and an untouched row are checked by the diagnostic; original assertion remains unchanged.

| Runtime | Count at2k | Count at20k | Every write | Original<2000 |
|---|---|---|---|---|
|retained87f6831f, fresh this packet|800|800|4|pass|
|unmodified exact C21, previous frozen evidence|13800|13800|69|fail|
|frozen A, previous frozen evidence|13000|13000|65|fail|

Incumbent raw event histograms/calls/stacks match between populations; original==attributed==800. Its four charges/write are three invalidation/publication iterable visits at location-runtime376/394/358 and one Object.keys at entity-signal2868. This does NOT mean the incumbent performs only four machine operations: merges/object spread, indexed loops and many point accesses are not charged. Calibrations remain positive7, nested8, empty0 and exact-error/restoration.

One Nx execution:4 tests pass,9 unrelated cases filtered. Exact command/environment and source identity are in run/COMMAND.json and SOURCE-BEFORE.json; raw first.log, RESULT.json and observations/rows-*.json are retained. No full suites, timings, new budget or production source mutation. Diagnostic snapshot b1d6437abcbf295f17275949ca25c4c163f42cdf283b0a4652b1285d89e33506 and diagnostic.patch identify replay inputs.

## Import graph / factory activation matters

Both original production test and copied diagnostic import entityMap from `../index` and signalTree from `./signal-tree`. C21 comparison used that same import shape. This is a supported barrel import, not a deep-import-only fixture selected to avoid registration.

In C21 the barrel exports Link; link.ts imports experimental-publication/entity, whose module registers the entity publication factory. path-notifier imports experimental-publication/private, which registers the scalar native publication factory. Intrinsic mutation source creation then attaches that factory, including to neutral private createCell counters. Entity native preparation is source-owned and occurs without a currently enrolled recipient. The5/update private capture charge is separately traced to the private version increment, as the prior premise review qualifies.

Retained87f6831f's Link/path-notifier/intrinsic source do not have these factory registrations/capture machinery. Its unchanged barrel import therefore cannot activate the same new native publication path. This is an architectural source difference under matched imports, not a counter change. A narrowed direct entity-marker import in C21 could fail to activate entity registration and produce a misleadingly cheaper workload; no such result is substituted here. Import reachability and factory state must stay explicit in future cost claims. Conversely some extra work supports newly approved publication semantics absent from the incumbent: the numeric delta alone does not prove those responsibilities can be removed.

## Existing private untracked operations: yes, but scoped

1. Neutral LocationRuntime.createEpoch/advanceEpoch already implement a private source-side increment without reading the reactive callable or entering generic publication input capture. createEpoch keeps a closure version and dependency node/publisher; advanceEpoch calls the handle's own update closure. It deliberately has no mutation source/binding/peek/subscribe surface. This is an existing untracked operation for handles created by that runtime.
2. NativeLocationRuntime has the corresponding existing pair. Native handles advance only through the adapter's advanceEpoch; its portable fallback updates its own closure. It stages pending handles and drains all, preserving first-error/later-handle behavior. ObservationAdapter documents this as opaque invalidation only: the returned value is a nonce “never read,” and only the creating adapter advances it.
3. Native private createCell already uses unobservableMutationSource and its derive reads realized.peek before incrementing, without scalar native capture. Neutral createCell currently registers the general source and therefore takes the discarded capture in C21. The same helper name does not imply identical private paths across runtimes.
4. Existing native realized.peek and neutral location.peek are safe source-read mechanisms at their current owners. There is no proven uniform callable-cell peek port at the EntityMap call site: Angular's signal cell and its separate realization.peek demonstrate the difference. No new capability/API is necessary to describe the existing operations, but neither operation is a ready alias for arbitrary private Locations.

Why this is NOT automatic permission to replace the collection version with an epoch: EntityMap createVersionedProjection reads `version()` as a numeric cache key (entity-signal454–468), whereas EpochHandle is opaque and its value is not promised. Native epoch advancement is grouped/deferred under its own contract; generic version backing storage advances before native notification. Stable return values, source-current cache invalidation, grouped read/reentry behavior and retained subject-state carriers must therefore be proved before repurposing that existing mechanism. Existing epoch support is a concrete design lead, not proof of a drop-in substitution. The earlier B premise stop remains justified; no capability or implementation is added here.

## Classification and limits

- **True charged-work regression:** unmodified C21 adds13000 over incumbent800; A adds12200. Same counter, fixture/import shape, installed lock and positive calibration. A still preserves a real800 reduction relative to C21.
- **No demonstrated collection-size regression in this workload:** all measured counts stay equal at2k/20k. This does not establish every algorithm/field-width/owner/recipient dimension as constant.
- **No demonstrated arithmetic calibration flaw:** the instrumentation's selective/double-charging rules and holes are known and unchanged. The data are not silently miscounted or hidden by helper bookkeeping.
- **Unresolved adequacy of the absolute threshold for expanded semantics:** provenance explains scale protection but does not price new obligations or license a threshold increase. Keep both assertions and first failures; no weakened guard is recommended.

The full C21 gate remains Main's authority. This packet supplies the missing retained count and a precise existing-operation inventory, not release readiness, new semantic authority or a runtime repair.
