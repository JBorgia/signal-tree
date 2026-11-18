# What pays for what

A feature being optional does not mean its supporting contract costs nothing.
An implementation allocation being present does not mean that allocation is
semantically unavoidable. These are different questions.

## V15: source-established boundaries

This table is grounded in qualified source
[`e45fd6961`](https://github.com/JBorgia/signal-tree/tree/e45fd69616586cae6f7f9e8622c082199d0fded0).
It is not an additive heap decomposition. Complete application measurements and
individual controlled allocation experiments provide different views of cost.

| Responsibility | When cost is paid | What it buys | What can be deferred |
| --- | --- | --- | --- |
| Ordinary state and ownership | Tree construction | Framework-native values, a stable typed tree and bounded owner lifetime | Empty position/capture containers are already lazy; ordinary leaf topology still exists. |
| Entity membership, identity and order | Marker materialization and population | Keyed state, stable entity lifetimes, ordered collection behavior | Public row nodes, activation/epoch cells and field carriers are acquired on demand. Internal active topology nodes, values and logical membership exist during population. |
| Ordinary mutation observation | Minimal registration before writers escape; full record at first consuming claim | A late Link can observe an already-escaped writer without losing its identity | The candidate additionally defers the dormant record; position IDs were already demand-allocated. All claimed leaves eventually pay. Native Angular reads are not separate scalar Link claims. |
| Structural revision tracking | Empty map at construction; entries at the first nonzero structural revision | Rekey/restoration/lifetime checks and retirement correctness | New candidate leaves zero implicit; ordinary value writes do not populate this map. Fully rekeyed surviving lifetimes pay the entries. |
| Transactions | Enhancer application, then additional cost when opening work | Captured consequences, pending ownership and confirm/rollback | Applying the enhancer already installs authority and hooks. Actual pending capture, retained obligations and settlement are additional. |
| Restoration | Explicit capability/enhancer configuration and use | Its supported temporal restoration behavior | Do not import or configure unused capabilities merely for a future use case. |
| Diagnostic history | Chosen history/observation policy | Investigation of retained past activity | Diagnostic retention is separate from live obligations needed for correctness. Setting history lower cannot discard unresolved work safely. |
| Investigation UI, recording and durable services | Explicit application/private-tool integration | Presentation, storage, authorization and recovery beyond in-memory state | These are not embedded hosted services in the public kernel. They carry their own integration, operation and privacy costs. |

For bare trees, first normal `$` access materializes all markers and then runs any
configured derived factory. This is not per-row field laziness. Enhancers require
marker materialization before application. The previous selected v15 profile
placed `const rows = tree.$.rows` outside its factory and population intervals;
its phase bins therefore omit that boundary. The separately identified follow-up
covers it. The common application's factory surrounds the full `createDispatch`
call, including `accepted.$.jobs.setAll(...)`, so its end-to-end store-factory
measurement has a different scope.

Source anchors:
[construction/materialization](https://github.com/JBorgia/signal-tree/blob/e45fd69616586cae6f7f9e8622c082199d0fded0/packages/kernel/src/lib/signal-tree.ts),
[ordinary observation](https://github.com/JBorgia/signal-tree/blob/e45fd69616586cae6f7f9e8622c082199d0fded0/packages/kernel/src/lib/internals/observation-substrate.ts),
[entity access](https://github.com/JBorgia/signal-tree/blob/e45fd69616586cae6f7f9e8622c082199d0fded0/packages/kernel/src/lib/entity-signal.ts),
[structural store](https://github.com/JBorgia/signal-tree/blob/e45fd69616586cae6f7f9e8622c082199d0fded0/packages/kernel/src/lib/physical/structural-store.ts),
[transaction configuration and opening](https://github.com/JBorgia/signal-tree/blob/e45fd69616586cae6f7f9e8622c082199d0fded0/packages/kernel/src/enhancers/transactions/transactions.ts),
[diagnostic retention contract](https://github.com/JBorgia/signal-tree/blob/e45fd69616586cae6f7f9e8622c082199d0fded0/packages/kernel/src/enhancers/transactions/transactions.types.ts).

## V16: additional responsibilities and remaining representation cost

Source inspection of candidate `f8cf26e50193ca8aa5580da15b739129313f256e`
separates these responsibilities; final sampled attribution and qualification
have their own receipts.

| Responsibility | Activation and additional work | Safe selection in this pass |
| --- | --- | --- |
| Construction plan and witness containers | Created with the tree; requested capabilities affect the plan. V16 still eagerly creates some containers that v15 defers. | No blanket copy of v15 containers: extra witness/cancellation paths need adaptation. This remains a small, unmeasured setup opportunity. |
| Entity population | Even without a current Link, preserve active key/order/lifetime information, atomic installation, ordinary versus physical membership and later enrollment obligations. | Reuse completed placement only for admitted aligned, all-fresh population; retain change values, facts and validation. |
| Entity publication evidence | Evaluating the Link module registers a factory. A per-source clean prefix can stay compact, but evidence/ownership/recipient demand promotes it. No observer now is insufficient proof that promotion is unnecessary. | Preserve the previously qualified automatic activation and rechecks. No new public mode. |
| Observation and revisions | Interception precedes escaped writers; claimed record identity persists; nonzero revisions follow structural demand. | Adapt v15's dormant-record and implicit-zero changes while preserving v16 branch scopes, owned IDs, preparation and cleanup. |
| Full collection demand | Materialize requested values and preserve each recipient's eligible membership/order/history. | Repair the concrete multiple-prepend defect in private placement; do not impose inspection-only physical order on an ordinary recipient. |
| Restoration placement | Preserve recorded neighbors, owner/subject separation and existing cycle ties. | Replace repeated fallback searches with indexed heads and cursors. Extra transient O(N) head storage buys measured input-search reduction; it is not a whole-rollback linearity claim. |

The implementation currently uses mutation frames, placement stages, cloned
payloads and per-step/per-subject fact maps. The guarantees require information
and behavior, not necessarily those exact representations. The source review
does not prove every remaining allocation minimal. Conversely, deleting facts
because no observer is present can lose obligations needed by a later reader or
owner. An optimization needs a positive condition establishing equivalence.

Source anchors:
[construction](https://github.com/JBorgia/signal-tree/blob/f8cf26e50193ca8aa5580da15b739129313f256e/packages/kernel/src/lib/signal-tree.ts),
[population](https://github.com/JBorgia/signal-tree/blob/f8cf26e50193ca8aa5580da15b739129313f256e/packages/kernel/src/lib/entity-signal.ts),
[publication activation](https://github.com/JBorgia/signal-tree/blob/f8cf26e50193ca8aa5580da15b739129313f256e/packages/kernel/src/lib/internals/entity-publication.ts),
[observation](https://github.com/JBorgia/signal-tree/blob/f8cf26e50193ca8aa5580da15b739129313f256e/packages/kernel/src/lib/internals/observation-substrate.ts),
[placement resolver](https://github.com/JBorgia/signal-tree/blob/f8cf26e50193ca8aa5580da15b739129313f256e/packages/kernel/src/lib/physical/order-restores-for-placement.ts).

Preserving issued values through supported SignalTree writes does not establish
an additional deep-immutability guarantee against arbitrary caller mutation of
retained input objects. The stronger external-alias test failed on the frozen
baseline too and is preserved as an invalid premise, not silently made into a
new runtime promise.

## Configuration economics

Named feature exports and construction-time enhancers already offer meaningful
choices. Importing a symbol, configuring a capability and exercising it are three
different costs. Tree shaking is checked on identified consumer fixtures; the
difference between two fixtures is not automatically a pure per-feature price.

Creating a Link relationship is opt-in. Loading its module is a different boundary:
the v16 root and framework barrels reach it in ordinary unbundled ESM, even when
the named import is only `signalTree`. The Link module registers its factory at
evaluation. Package `sideEffects: false` metadata lets a tree shaker omit an
unused Link module. Prior identified bare and no-Link entity fixtures do omit
that module/factory implementation, while retaining shared publication support.
Those graphs establish their particular bundles, not universally zero cost or
fresh bytes for the current successor. Per-source participant activation is
automatic and can follow evidence or ownership demand as well as a relationship.
Diagnostic fixtures exporting capabilities for later phases are also different
from minimal consumer bundles that omit those capabilities altogether.

Automatic demand allocation is useful when it retains the same behavior without
asking users to understand another option. It also adds a state transition and
can shift cost to first use. This study measures sparse and dense live use,
rearming, structural demand and actual pending operations rather than advertising
only constructor savings. No new public switch is selected.

A weaker v16 publication mode would require a separately defined contract,
compatibility story, testing surface and user decision. It is not justified merely
because a branch might skip bookkeeping. Reusing already-equivalent placement
and postponing unused allocations address implementation overhead while keeping
the selected guarantee intact. The [transfer assessment](CROSS-VERSION.md)
separates those changes from potential future container work.

## What these costs do not buy

The runtime does not itself make an agent truthful, authorize a payment, durably
commit a remote effect, decide policy or guarantee exactly-once execution across
external systems. The installed oversight application adds backend authority,
correlation, idempotency and recovery with explicit contracts. Those integration
proofs are separate from primitive speed and from human comprehension.

V15 can support a carefully designed oversight application. V16 strengthens its
native coordination/publication substrate; it does not remove the need for that
application/backend design. Likewise, a peer implementation producing the same
scripted business outcome has not thereby acquired every native v16 guarantee.


## Construction is amortized, but not all overhead is startup

Population is normally a one-time payment for a long-lived store. It must still
fit the user's startup and memory constraints. Deferred marker, public-node,
field and observation allocations are paid at their first demand; they do not
vanish because the initial constructor returns quickly. Fully demanded workloads
can consume the sparse savings.

Pending ownership, active recipient projection, validation, settlement and chosen
history can recur throughout the store lifetime. A long-lived store therefore
amortizes construction without proving a universal performance crossover. The
common application records initial demand, repeated context work, interleaved
commands and pending pressure; the native retained-store cohort separately
exercises ten cycles with full v16 semantics. Those measured scopes, including
signed post-destroy residuals, are the basis for cost claims—not a claim that all
additional heap was purchased once at startup.
