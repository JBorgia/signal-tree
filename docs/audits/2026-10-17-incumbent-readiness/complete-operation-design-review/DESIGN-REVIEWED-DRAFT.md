# Complete-operation successor: finite design review

October 26, 2026. Design only, against rejected `f01ed39a7df8a5de185ebec0773e09e36537dacb`; production comparator `87f6831fa60cafe87508f0ace84b7638698ca3b0`. No source repair, model execution, test rerun, API selection, activation or cost acceptance is part of this review. The final candidate verdict remains 79/84 registry gates passed, 66 kernel failures and four bundle failures. B remains closed.

## Frozen premises and the question

The owner's current instruction requires: “Reentry: callback-authored operations remain distinct rather than being folded into the outer operation.” It also requires: “Do not resume runtime work merely because a design passes an isolated model.”

The existing public contract at production87f6831f `packages/kernel/src/lib/undoable.ts:19–20` says: “`undoable()` marks the authored causal turn containing its writes as eligible for undo. It does not create a causal-turn boundary.” Its adjacent examples make two synchronous scopes one undo step and allow designation to cover another authored write in the same turn. These rules cannot be replaced by callback-exit grouping.

The approved migration plan at f80645c8 says: “Never overload the physical pair or infer membership ownership from seeing a row.” It also says: “Use the single existing notify protocol; no parallel notifyPrepared/event bus.” Its stop boundary says: “A supposedly shared correction reproduces the same missing-facts mechanism in another mapped writer; do not continue with another caller exception.” The source's exact plan wording is verified in the review packet; where this document paraphrases a design requirement it is not a new public contract.

Question: what complete transition must exist at each established boundary so that no consumer promotes an intermediate order snapshot to whole-scope authority? Separately, what evidence must a Link to a leaf receive when an ancestor's membership changes? The two questions share the need for trustworthy source facts, but do not have an established common root cause.

## Observed loss, not a new ordering-policy dispute

The unchanged add-w/overwrite-prepend-c test fails only on the candidate. `completeOrderCapture` extends physical endpoints across surrounding structural intervals, but leaves `ordinaryEndpoints` unchanged. Undo removes w as an earlier constituent edit; ordinary order still includes w from the later prepend's intermediate before-state. Validation correctly rejects the contradiction. The public test contains no inspection, foreign writer or unresolved payload premise.

This rules out treating an explicit order operation's endpoints as a turn's endpoints. It does not establish that removing absent IDs fixes inversion. Other multi-removal controls produce wrong surviving order, and omitted IDs may represent required dependencies rather than disposable incidental anchors. Successor policy must retain the approved lifetime-sensitive successor/predecessor rules, atomic refusal for unresolved foreign ordering conflicts, and P99/O7 payload separation.

## Four boundaries, not one universal callback scope

| Boundary | Begins / completes | Consumers and limits |
| --- | --- | --- |
| Source installation unit | A native writer prepares an intended change; completes when physical state, ordinary facts and minimum responsibility are installed and immutable, before its first user delivery | Describes one actual installed operation. A public method may use a direct lane or a prepared frame; frame identity alone is not universal. No claim all operations must be delayed until callback return. |
| Reentrant operation | A callback or preparation-time user action initiates another writer | A distinct unit with its own installation sequence. Existing transaction/designation context may still own it. Distinct operation does not mean separate transaction or undo step. |
| Transaction scope | Existing transaction admission through its established capture close; retained until terminal settlement | Selects owned units under existing authority. Nested `transact` remains rejected where currently rejected. Callback-authored ordinary writes may belong to the same owner. Foreign realized/inspection facts are not silently selected. |
| Causal history turn | Existing causal-turn collection and drain, promoted by designation under the shipped contract | Composes all participating completed units in the turn, including multiple synchronous callbacks. It does not use each `undoable` callback's return as a new boundary. |

A fifth boundary is settlement installation: selected inverses are privately prepared and validated across their complete target before any physical installation/publication. It is an existing realization operation, not a newly authored transaction contribution.

The source unit must seal before callbacks. History/transaction composition must wait for their own existing closure. Therefore “all consumers use the same completed transition” means identical completed source facts and identical composition rules for the same selected scope—not delaying every observer until a transaction or history turn ends.

## Candidate mechanism for scrutiny: completed source facts plus scope composition

This is a private contract proposal, not an approved implementation or public API. Existing state stores remain authoritative. Records are evidence for already-defined responsibility; no persistent canonical mirror, new settlement engine or global replay of all writes is proposed.

### Source facts

Each native installation path must provide one immutable description correlated with the installed unit. It contains:

- Source tree/collection or branch identity, stable entity lifetime or path address, installation sequence and existing participation/owner references. A new source unit must not reuse the outer unit's identity during reentry.
- Separate physical and ordinary transitions: field presence/value, lifetime existence, business-key occupancy and placement/order. An omitted member differs from present undefined. A rekey does not author unrelated fields or an incidental full order.
- Explicit authored/realized footprint and the relevant dependencies. Observed neighboring topology is input to validation unless the operation authors or requires it; observation alone grants no authority.
- Per-view before/after continuity evidence for membership and order over the **same unit**. The current physical frontier is not sufficient evidence of ordinary continuity. The source owner must supply ordinary structural/placement facts even when physical and ordinary topology differ.
- Existing physical notification descriptors and ordinary publication projection inputs. Consumers do not independently classify a successful operation from a later read of current physical state.

The internal representation must correlate split value/membership/order capture callbacks without creating a second notifier. It may project facts into the existing notification protocol. A mutable record populated after the first user callback is disallowed. Values used for evidence must be stable under the existing clone/snapshot contract; a readonly TypeScript field alone does not establish runtime immutability.

### Scope composition

For a requested scope and direction, one composer receives completed units in actual installation order and the existing authority selection. It produces physical and ordinary endpoint facts over that same selected interval, plus the retained inverse/dependency facts needed by existing policies.

1. Preserve unit boundaries, participation and sequence; do not flatten reentry into the outer operation or select foreign work merely because it occurred inside a callback.
2. Compose membership, key and placement changes together for each view. A prefix add or suffix remove modifies the scope endpoint domain in that view. For add-w then prepend-c, the original scope ordinary-before is z,a,c; its ordinary-after is c,z,a,w. A valid prepend-local before containing w is not the scope-before.
3. Retain every intervening ownership/dependency barrier required by the existing contract. A first-before/last-after shortcut is permitted only after continuity and permitted supersession are established. The approved owned-order / foreign BCA / owned ACB case remains an atomic refusal, not an excuse to grant arbitrary selective inversion.
4. Validate final ordinary membership and final ordinary order together. Separately validate the physical realization footprint under the approved P99/O7 rule. Do not compare ordinary order with physical membership or adopt untouched displayed fields to make them agree.
5. Keep sequential execution constraints separate from final-placement constraints. A row restored in the same settlement may be a valid final anchor even if absent in the starting physical store; it must not be treated as already available during an earlier execution step. No arbitrary neighbor substitution.
6. Do not discard transient identities solely because they disappear from endpoint sets. Existing restoration can require a transient anchor/dependency; retirement follows obligations, not endpoint subtraction alone.
7. Freeze the prepared result, validate source revisions after preparation-time user code, and install the whole allowed realization before delivery. No intermediate publication. Stale preparation follows the existing refusal/retry contract; it must not erase legitimate reentry.

This demands ordinary boundary evidence for every structural constituent, not an ordinary snapshot only when an explicit reorder happens. `EntityOrdinaryTopology` currently owns sparse divergence and has no independent ordinary frontier token. A successor must map continuity to existing successful-installation sequencing or add private continuity metadata paired with installation. Choosing that field/layout is an implementation proof obligation; it is not permission to infer ordinary continuity from physical frontier equality.

### Mapped source completion and consumers

The following is the finite migration map, not an assertion these paths already implement the proposed contract. Path/family names retain f80645c8 meanings. Source anchors are the function/class names in frozen f01ed39a; historical line numbers in the original writer inventory must not be applied to this larger file.

| Path and producer | Completion proof required | View/consumer obligation |
| --- | --- | --- |
| S1 direct existing row (`commitExistingSubjectValue`) | Ordinary value/necessary existence and responsibility installed before row publication | Emit touched P/O footprint without a collection snapshot; capture and inspection cannot infer adoption from P equality. |
| S2 multi-instruction frame (`commitAndProjectEntityMutationFrame`, `EntityMutationFrame`) | Values, lifetime membership, key occupancy, final placement and paired responsibility form one installed unit before order/row taps | Correlate currently separate committed-entity and order evidence; never seal O order before a same-unit membership edit. |
| S3 point realization (`preparePointValues`, realization adapter) | Every selected point and ordinary realization edit installed before invalidation/publication | Preserve ordered field presence/value reversals; no new authored contribution and no full-target substitution. |
| S4 complete target (`prepareEntityTransitionTarget`, `prepareDeclarativeTransitionInstallation`) | Selected membership and order validated together for P and O, all target installations completed before delivery | Consume the scope-composed O endpoint, not an individual operation endpoint. Preserve authorized physical realization footprint. |
| S5 structural replay (prepared restore/remove/rekey plans, realization adapter) | Execution dependencies resolved privately; final-placement constraints validated across selected plans; install all before callbacks | Retain lifetime identity, inverse eligibility, ordinary key occupancy and placement separately from displayed payload. |
| S6 order/selection/retirement (`publishOrderChange`, scalar selection, retirement) | Pure order supplies explicit P/O scope; selection remains existing scalar authority; retirement runs only after obligations permit | No synthetic row values or authored cleanup operation; order-only facts still need complete scope composition and delivery. |

Writer-family obligations: W1 fields/updateOne and W3 batch partial updates retain only authored fields; W2 whole replacement/derive and W8 setAll/reorder retain their distinct intent; W4 add/prepend and W6 removals supply ordinary membership/placement even without explicit reorder; W5 rekey supplies occupancy rather than incidental order; W7 mixed upsert combines update/add facts without promoting inspected siblings; W9 hidden reintroduction supplies parent-member participation as well as row facts; W10 inverse/restoration consumes completed scope facts; W11 retirement consumes obligation ownership without authoring new truth. Constructor and held-handle controls remain compatibility checks. This map grants no new public writer route.

Each mapping must identify the source of ordinary continuity evidence, its revision check, the capture/inspection subscriber and the actual publication projection. A table entry without this native mapping is an open implementation obligation; passing a model cannot fill it.

### Consumer mapping

| Consumer | Required input / permitted result | Forbidden reconstruction |
| --- | --- | --- |
| Paired responsibility capture | Prepared ordinary authored facts and dependencies for each installed unit; authority accessible at installation | Post-callback physical image as captured ordinary truth; new unowned membership |
| Pending inspection | Ordered selected units, participation and the same scope composition semantics used for rejection | Intermediate order snapshot labeled whole-scope truth; physical equality used to discard adoption |
| Undo/redo | Completed scope transition plus retained inverse/dependency facts; opposite direction with existing eligibility | A physical-composed endpoint paired with an ordinary-uncomposed endpoint |
| Transaction confirmation/rejection | Existing selected ownership and supersession rules over complete unit facts | Publication dependency interpreted as rollback ownership; foreign callbacks silently owned or lost |
| Native observers/taps | Existing physical descriptors after the installation unit is coherent | Delaying outer placement until after callback-authored writes; promising fresh application-native computed values inside groups |
| Link | Eligible ordinary source projection for its exact address/lifetime and publication revision | Current inspected display as ordinary truth; permission for one payload reused for another |

Consumers may retain different projections for different obligations. They may not derive contradictory transition endpoints for the same selected scope. No public snapshot must be materialized for a consumer that only needs a touched-field delta.

### Reentry and failures

Outer prepend C completes membership/order as CAB and seals its unit before onAdd(C). The callback's prepend D installs a separate unit, producing DCAB. A shared transaction may later select both units, in sequence, but no outer completion revises its sealed CAB facts to DCAB or overwrites D.

Preparation can execute application code (getters/equality/interceptors). Its reentrant unit remains independent of the attempt's private preparation. The attempt revalidates source revision and existing ownership before install. Failed preparation has no outer installation or resources left reachable. Post-install callback failure retains coherent installed facts and usable existing recovery; successful abort preserves callback value identity, failed abort uses SignalTreeRollbackError/recovery.callbackError. No new universal recovery promise for process OOM.

No asynchronous propagation is inferred. Existing declaration scopes and transaction rules retain their supported synchronous boundaries. Destruction terminates delivery/settlement obligations under existing contracts and cannot resurrect a sealed receipt or complete a discarded operation.

## Concrete alternatives and limits

| Representation | Can express complete endpoints? | Principal burden / discriminator |
| --- | --- | --- |
| Per-scope ordinary snapshot at first/last selected write | Yes for simple contiguous work; conditional for foreign intervals and inverse dependencies | Easy reference control, but full snapshots can turn point work into collection work and still lose authority barriers/transient dependencies. Scope-before/after must be source-authorized, not read later at drain. |
| Sparse completed source units with one shared scope composer | Plausible; preserves the source of each fact and boundaries | Requires complete ordinary structural facts, reentry segmentation, identical composition across consumers and obligation cleanup. No native sufficiency demonstrated. |
| Independently extend ordinary arrays inside history/transaction consumers | Can fix the narrow add/prepend example | Retains duplicated composition and invites another missing consumer or writer. Not sufficient evidence for the requested shared boundary. |

Carry sparse completed facts as a design candidate and snapshots as a reference for expected endpoints, not as an automatically accepted implementation. No isolated model result can select a production winner. The design review must reject the candidate if it cannot identify an ordinary continuity proof without broad state duplication or changed semantics.

## Cost and retention obligations before any native successor

For k touched constituents, admission appends touched facts without copying the accumulated prefix. Point writes and local cleanup must not enumerate unrelated collections/trees. An explicit full reorder may process its declared members; materialize an indexed domain once, not repeated includes searches per member. These are design targets, not measured passes or new relaxed ceilings.

One source owner retains current ordinary divergence; scope capture retains only facts required by open transactions/history/recovery. Releasing one consumer cannot delete another's needed inverse or identity. Terminal settled authority never reactivates from recovery-only facts. Retained receipts may retain their own result but not an obsolete tree/connection/payload graph. Existing indexed cleanup and lifetime isolation remain mandatory. Current 4N-versus2N prepend cost and the four failed bundle budgets are not accepted by this proposal.

## Separate leaf-Link obligation

The bare leaf omission/re-addition falsifier has no pending owner or declaration. Candidate leaf stalls; production and branch/collection controls progress. That differential stands independently of ordering.

A leaf's stable location may be affected by an ancestor membership change. Exact-position matching alone cannot create its eligibility evidence. The design must derive a source-specific publication fact from the completed membership transition and the kernel's structured address relation, then bind that fact to the projected ordinary presence/value and revision. For absent leaf, undefined is a real absence payload, not a value-less ping. Entity references retain lifetime semantics; a path leaf is not a license to retarget a retired entity reference.

Eligibility and delivery remain separate. With no unresolved responsibility, ordinary absence must reach the endpoint and settled must complete. With pending dependencies or enclosing declaration validation, the newly projected revision remains held as required. A later eligible revision wakes delivery even if an earlier one is held; in-flight older work needs serialized correction. Inspection-only membership must not acquire ordinary publication authority. Re-addition, ABA responsibility changes, multiple connections, disposal and destruction must retire the old facts and waiters without inventing early permission.

Affected-source lookup must follow a tree-local structured-address index or existing equivalent, rather than scan every registered tree/connection. Work may scale with sources actually affected by a changed ancestor. Adding or removing that index entry is itself part of connection/source lifecycle: failed preparation must not leave a live grant, and disposal must retire reverse references when no in-flight or recovery obligation requires them. This is a required cost/atomicity property, not selection of a trie or another new API.

No generic grant, extra flush, timeout increase or unsupported-source demotion is a repair. Whether the existing source identity carrier can express ancestor influence without a new carrier is a required source mapping for a native proposal, not established by the timeout alone. Independent trace is included separately.

## Finite acceptance packet and stop rule

No execution occurred for this design. These are prewritten requirements, not new test results:

1. Preserve byte-identical order-composition-readiness and leaf-Link omission replays, each compared with production. Preserve the other frozen failure groups and first results.
2. Map all six installation paths / eleven writer families from f80645c8 to source completion, P/O facts, minimum responsibility, sealing and delivery. Direct field, frame and target paths cannot be omitted because they do not share one class.
3. Native membership/order sequences: add→prepend, reorder→remove, multiple caller-ordered removals, transient anchors, same-lifetime remove/re-add, new-lifetime same-key replacement, rekey, full-order operations and inverse redo. Require useful success where established; refusal only for approved conflicts.
4. Inspection/adoption: independent P/O order, P99/O7 relocation, explicit equal-display adoption, untouched inspected fields, correct pending inspection, rejection and subsequent transaction. All consumers must agree on authored footprint.
5. Reentry: outer C→callback D, callback selects C/C→X/C→original, preparation-time reentry, nested writes sharing an owner versus foreign participation, callback throws, failed abort, repeated settlement and retry. Check both coherent observer snapshots and retained newer work.
6. Leaf-Link: omission and re-addition with no enhancers, transactions and history; queued versus in-flight delivery; ordinary/inspection transitions, declared validation, multiple owners/connections, scalar ABA, disposal and tree destruction. Require actual delivery, no hung settled waiter and no inspection leakage.
7. Complexity/retention: fixed-local workloads versus increasing untouched state, full divergence, repeated cycles, live recovery and held references. Keep cost measures separate from semantic passes and apply existing measurement contract before any decision campaign.
8. Independently review complete native coverage and all changed verdicts before broader qualification. A passing isolated model or example does not lift the runtime recurrence stop or accept an API.

A design can close the boundary inventory while leaving native sufficiency unproved. Runtime successor authorization remains separate. If ordinary continuity, selected-scope composition or source-address projection requires new public semantics, a second authority, or more than this mapped migration, return the concrete conflict before implementation. The hypothetical nested missing-parent case remains conditional: if a supported producer requires ancestor creation/adoption to realize an inverse, preserve that public reproduction and resolve authority before implementing it. Do not infer the ancestor rule from this representation. No additional writer-specific exception is authorized.
