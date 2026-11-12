# Capability, activation and cost ownership

Source baseline `18e2eed330629900b5e519168785591c0ab751dc` (v16 runtime
`2826cc94185b4cccc3717ea1e6370d7bc27cbf27`), released v15.4.8 source
`37ef1788f6bac61678fc312f391b180bd7a6bbd7`, pinned NgRx Signals 22.0.1.
This is a source audit supplemented by the measured activation experiments.
It is not a claim that a competitor cannot implement custom features.

| Capability / storage                        | SignalTree v15.4.8                                                      | Qualified v16                                                                                  | NgRx 22.0.1 inspected implementation                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Framework signal graph                      | Angular native signals through facade                                   | Same native ownership; stronger current direct readers                                         | Native Angular signals per top-level slice                                              |
| Nested field acquisition                    | Lazy entity field carriers; retained row handles on demand              | Also lazy                                                                                      | Lazy deep computed proxies                                                              |
| Entity collection                           | Explicit `entityMap` marker; identity/order/value indexes               | Same, plus ordinary-state topology and publication source                                      | Optional `withEntities`; entity object map, ID array, computed entity list              |
| Single entity update                        | Targeted subject/value mutation and invalidation                        | Targeted path plus ordinary/publication preparation                                            | `updateEntity` shallow-copies entity map and IDs, then selected row                     |
| Entity lifetime                             | Retained mutable row/field handle stays with the acquired lifetime      | Preserved                                                                                      | Key-addressed state; stale-editor guards must be supplied by application/custom feature |
| Transactions                                | Optional enhancer; conservative rollback/refusal contract               | Optional enhancer; recoverable refusal retains pending authority/consequences                  | No equivalent built-in transaction/recovery contract in inspected exports               |
| Restoration                                 | Optional enhancer; structural/lifetime ownership and temporal snapshots | Optional enhancer with integrated publication behavior                                         | Custom feature/application responsibility for equivalent behavior                       |
| Diagnostic confirmed history                | Optional; default retained history zero                                 | Optional; default retained history zero                                                        | Custom observation/history feature; `watchState` itself does not supply this contract   |
| Link                                        | Module-selected implementation, explicit relationship activation        | Module-selected native participant; explicit recipient activation                              | Custom synchronization/publication implementation                                       |
| Evidence for future Link consumer           | v15 behavior                                                            | Native participant may retain evidence before a subscriber exists when Link module is included | No equivalent built-in obligation                                                       |
| Current direct reads during nested mutation | v15 facade behavior                                                     | Required construction-bound native adapter capability                                          | Angular native behavior; no claim of equivalence to SignalTree's stronger contract      |

## Existing opt-in structure

Both SignalTree lines resolve a frozen tree plan before writes. Transactions
requests `causal-runtime`; restoration requests it plus `temporal-snapshots`.
Causal runtime implies mutation capture and position topology. EntityMap installs
capture/topology/retirement facilities based on those capabilities. These are
existing construction decisions, not newly proposed flags. Later addition of an
enhancer is not supported by this plan.

Source anchors: `lib/signal-tree.ts`, `lib/internals/tree-capabilities.ts`,
`lib/internals/runtime-tree-plan.ts`, `lib/markers/entity-map.ts`, and the enhancer
factories. The published v15 transaction options distinguish retained diagnostic
history from correctness state needed while operations remain pending.

Some always-created empty containers remain even without active capture: inspect
`lib/internals/mutation-capture-runtime.ts`. The fast inactive write path returns
without capture work. This is an allocation lead, not evidence that a new public
configuration object would save material cost. Measure many-small-tree applications
before treating a few empty containers as the dominant cost of large collections.

## Module selection is not per-tree selection

v16 `lib/link.ts` registers the native entity publication factory at module
initialization. `lib/internals/entity-publication.ts` instantiates its native
participant lazily during relevant writes. Consequently:

1. Removing unused Link code during production tree-shaking can remove its native
   participant and evidence cost.
2. Including Link somewhere in an application can activate that participant for
   other eligible collections even before they have a Link subscriber.
3. Attaching an actual Link creates its recipient projection, a further cost.

The activation experiment measures all three cases. A direct Node import of the
entire ESM barrel is not interchangeable with a selective production bundle.
The ordinary long-lived comparison explicitly bundles named imports and verifies
that unused Link/native participant implementation is absent.

A future per-tree opt-in must decide at construction what late enrollment and
cross-tree observations it supports. Simply skipping evidence because there are
no subscribers today violates existing late-enrollment traces. Conversely, source
inspection does not prove that every present allocation is essential. Prefer
removing redundant internal work before adding a public semantic mode.

## What v15 offers beyond the inspected NgRx built-ins

The distinction is a supplied behavior contract, not whether JavaScript can do it.
SignalTree supplies lifetime-bound handles, targeted entity mutation, coordinated
rollback/restoration ownership and Link behavior. NgRx supplies extensible store
features, hooks, linked state, watcher/event/resource integrations and native
Angular reactivity; applications can build coordination on top. Such additional
code must be included when comparing equivalent behavior and maintenance surface.
SignalTree does not itself ship persistence, serialization, async or forms APIs
in this release, and must not be credited with those unprovided features.

NgRx source inspected: `fesm2022/ngrx-signals.mjs` (`toDeepSignal`, `withState`,
`patchState`, `watchState`, constructor feature reduction) and
`fesm2022/ngrx-signals-entities.mjs` (`cloneEntityState`, `updateEntity`,
`withEntities`). Package payload hashes belong to the measurement receipts.
The corresponding pinned upstream sources are
[entity helpers](https://github.com/ngrx/platform/blob/22.0.1/modules/signals/entities/src/helpers.ts)
and [deep signals](https://github.com/ngrx/platform/blob/22.0.1/modules/signals/src/deep-signal.ts).
In particular, `cloneEntityState` allocates both copies before an update decides
which slices to publish; a field-only update need not publish a new IDs slice
for that temporary ID-array allocation to have occurred.

## Configuration decisions from the measurements

| Cost                                         | Existing selection                          | Disposition                                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transaction capture and pending inverse work | Construction enhancer                       | Keep opt-in. Pending correctness state is required until settlement; diagnostic history remains a separate choice.                                                                                      |
| Undo/redo ownership                          | Restoration enhancer and history policy     | Keep opt-in. Do not confuse an evictable history budget with permission to evict a pending owner's reversal inputs.                                                                                     |
| Individual row/field carriers                | Actual handle/field demand                  | Keep automatic lazy allocation. A second configuration knob would duplicate a choice already made by the consumer's reads.                                                                              |
| v15 ordered subject projection cache         | First value projection                      | Adopt the measured internal cache candidate. Value-only use substitutes an array; final simultaneous IDs/value demand pays about 82 KB at 10,000 rows. A public cache flag is not justified by this evidence. |
| v16 contributor/address search indexes       | Preparation actually needing those searches | Prefer temporary lazy indexes over permanently maintained indexes. The rejected eager representation's additional heap buys no required semantic behavior.                                              |
| v16 native publication evidence              | Link's module present, then eligible writes | A material candidate for finer activation. A per-tree public mode is not implemented or priced; preserving late enrollment and cross-tree consumption must be demonstrated first.                       |
| Settled, unclaimed retired backing           | Cleanup policy, not a user feature          | Correct automatic reclamation. Do not ask users to choose between leaked retired rows and valid pending/history restoration.                                                                            |
| Forgotten lifetime's weak activation entry | Internal cache lifetime | Remove after actual full retirement, including late-read registration guards. Weak values do not remove the map's strong keys or wrapper allocations. No user configuration is warranted. |

The meaningful threshold for another switch is the complete implementation's
saved startup/retained memory minus its branch, configuration storage, code size,
test matrix and documentation costs. A synthetic boolean branch does not measure
that implementation. The current evidence supports demand-selected internal
representations and the existing enhancer choices. It does not justify removing
the ordinary v16 topology/current-reader contract or offering a weaker default
under the same guarantees.

Publication evidence is the largest measured optionality opportunity: the neutral
10,000-row activation fixture adds about 23 MiB when the Link module is present
without a recipient. That number includes all effects of the activation change;
it is not an exact byte attribution to one proof structure. A future alternative
must pass the existing pre-enrollment, same-key lifetime, reentrant-read and
cross-tree traces before any saving is credited to it. No subscriber-count
shortcut meets that requirement.

## What the costs buy, and when they recur

| Mechanism | Paid when | Benefit / avoidable part |
| --- | --- | --- |
| Identity, order and value indexes | Population and structural mutation | Stable entity lifetimes and targeted edits; avoids the pinned NgRx updater's repeated collection-map copy. Does not make each native signal operation cheaper. |
| Row getters and field carriers | Requested row, then requested fields | Retained writable field identity and native dependency integration. Carriers are lazy, but all row getters are currently installed together; the wide-demand study exposes this cost. |
| Collection projection | Reading all values after invalidation | Ordered collection view; final v15 caches numeric subjects to avoid repeated key-to-subject lookup. Asking for IDs as well can keep a second array. |
| Pending inverse/ownership state | Opening and retaining unsettled operations | Enables valid rollback/refusal and restoration. Pending state cannot be evicted under a diagnostic-history budget. Settled unclaimed residue is repaired rather than sold as an option. |
| Native publication evidence | Relevant writes when Link's module is present | Supports later consumers and coherent publication. The module/no-recipient delta is measurable; the study does not assign every byte to an individual guarantee. |
| Recipient projection and preparation | Attaching a recipient, then relevant writes | Maintains recipient-visible state. Repeated structural searches were avoidable and now use temporary lazy indexes; required projection state remains. |
| v16 ordinary topology and current-reader integration | Ordinary construction and mutations | Stronger direct-read/reentry behavior. It is built into the present kernel; no equivalent external enhancer implementation was demonstrated. |

The startup-versus-steady-state story is therefore partly true. Indexing can pay
back against repeated whole-map copies, as the large sparse-edit comparison shows.
It does not excuse a repeated quadratic publication scan, retained dead entries,
or continued carrier allocation as more fields are requested. Nor did the measured
ordinary workload establish a crossover where v16 becomes cheaper than v15.

The current enhancer plan resolves capabilities at construction, so it already
offers a choice without reparsing configuration on each write. A new publication
mode would still add state, branches and a semantic/test matrix. Its potential
savings are substantial, but its compatible implementation has not been measured.
The measured internal representations preserve these choices without adding a
new public flag. Retired publication facts also have a separate
[exact-reference packing experiment](TERMINAL-FACTS.md); their semantic obligation
is retained while repeated per-row storage is reduced.

## Interpretation boundaries

A plain entity map can be cheaper to create and retain while doing more copying
on each edit. Identity/dependency indexes can reverse that tradeoff in a retained
store. Whole-collection queries may dominate either implementation. These are
hypotheses tested by the cumulative measurements, not a universal winner ranking.
A heap checkpoint includes shared runtime and fixture state; neither the source
matrix nor a heap difference assigns exact bytes to each individual guarantee.
