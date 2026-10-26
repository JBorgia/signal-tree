# Paired boundary extension: concrete design candidate

October 26, 2026. Read-only continuation of 303aa198 against frozen f01ed39a. No runtime patch, executable model, test run or public API selection. The proposal below is one finite candidate for review, not a conclusion that the recurring defect is repaired. Production87f6831f and rejected B are unchanged.

## Existing contract and the exact extension

The frozen plan f80645c8 requires: “Never overload the physical pair or infer membership ownership from seeing a row.” It requires “Use the single existing notify protocol; no parallel notifyPrepared/event bus.” Production undoable.ts states: “It does not create a causal-turn boundary.” The owner's latest instruction requires callback-authored operations remain distinct and prohibits resuming runtime merely because an isolated model passes.

Extend the existing shared capture/boundary records; do not introduce a second operation journal. The extension separates three things currently easy to conflate:

1. **Installation evidence:** which physical and ordinary facts one completed source unit changed.
2. **Selection and authority:** which operations/effects an existing transaction or history scope may reverse.
3. **Projection:** how authorized facts change a particular consumer's baseline. A Link baseline can differ from source ordinary state.

The current source already prepares sparse physical and ordinary placement stages and ordinary changes before commit. It omits an ordinary continuity chain and drops ordinary-only topology transitions from the physical-only boundary subscription. Filling those fields is a private carrier change, not a replacement ownership policy.

## Minimum record and ownership

Each completed structural source unit supplies one correlation identity shared by its existing entity and order captures. This identity is not a transaction id or causal turn id. It need not contain a global sequence or retain a predecessor. A callback's nested operation has a different identity even when owned by the same transaction. Existing OperationRecord.previous remains the transaction's own sequence; it references/enriches the shared prepared evidence instead of copying a second payload journal.

Each view, P and O, carries:

- collection identity and before/after **continuity tokens**;
- sparse touched placement pairs: lifetime id → before/after presence, key, predecessor and successor, including changed neighboring links;
- before/after head/tail when touched;
- an explicit order endpoint/domain only if already needed by an authored broad order operation;
- the unit's existing selected value/structural effects and participation, carried separately from placement pairs.

Placement pairs are *composition evidence*, not authored effects. Changing A's next pointer while inserting B does not give B's writer ownership of A. Field payloads remain in the existing value/effect representation. Membership existence and key occupancy stay distinct from order. Omitted evidence differs from a certified topology-neutral operation.

### Token rules

A collection owns only its current P and O continuity tokens, not a linked history. O gets a fresh opaque endpoint when an installed unit changes ordinary membership, key occupancy or order; P-only inspection keeps O's token. An O-only adoption advances O even when P membership is unchanged. Field-only work leaves topology tokens unchanged. A key-only change can advance topology continuity without entering the full-order interference channel. Foreign ABA produces distinct admitted order events even if final values match.

Tokens certify source adjacency during **capture composition only**. They neither confer ownership nor replace current inverse eligibility. Undo/redo does not require current token equality with a historical token and does not resurrect old tokens to restore authority. Successful realization advances current continuity normally, while the established history/frontier/claim protocol determines redo eligibility. Once composition is complete, entries retain only the token/evidence references still needed for a live obligation; the source token has no back-pointer.

For topology-neutral units, do not insert a self-edge into a before-token→interval index. That would overwrite another neutral record or create cycles. Such units still retain their value/participation evidence where required.

### Preparation and completion

At source preparation, snapshot only touched pairs from the ordinary stage's pre-install base and final patch; never reconstruct them after physical installation has changed that base. Clone/seal the pairs under existing snapshot rules. Allocate the next O token privately. The prepared terminal plan includes the token update and responsibility references alongside existing ordinary installation. Validate existing mutation revision and expected P/O endpoints after preparation-time user code; failed preparation installs none of this attempt's evidence.

Completion is after all instructions, final placement, ordinary facts and minimum responsibility install, but before any capture delivery that can invoke user code. Existing split entity/order callbacks carry the same sealed unit identity. Consumers can accept either order of these projections and deduplicate the unit; they cannot wait for a later callback to supply a previously missing final topology. The broad order endpoint already exists in frame preparation; it must be included in the completed evidence before the first delivery, rather than inferred from the later publishOrderChange call.

This rule applies to direct value adoption, frames and realization lanes, not only EntityMutationFrame. Realization supplies evidence under its existing participation and must not enqueue a fresh authored contribution. After reentry, later taps read fresh current state; they do not rewrite the immutable outer record.

## One composition routine, after existing authority selection

The routine receives selected completed unit references, their existing effects, relevant unselected boundary evidence, and any authored broad order domain. Selection is not a contiguous time interval. The routine never selects a unit merely because tokens join.

1. Validate source/view identity and unit correlation. Missing ordinary evidence is an internal incomplete-transition result, never an instruction to fall back to physical neighbors.
2. Retain the existing selected value/occupancy inverse and its foreign-write rules. Keep the order-specific interference witness independently of endpoint simplification. A foreign field or another collection's order is not a full-order conflict.
3. Compose selected compatible **runs**. In each run use P pairs with P order and O pairs with O order. Fold touched presence/key/adjacency pairs by lifetime, preserving the earliest before and latest after only through proven contiguous evidence. Preserve intermediate dependencies separately; transient endpoints disappearing from the net patch do not delete required restoration anchors.
4. For an already-required broad order endpoint, extend its before image backwards through the selected prefix pairs and its after image forwards through selected suffix pairs. Apply all departing/arriving lifetime changes and adjacency updates as a prepared set, then validate the resulting membership/order domain before producing an inverse. Do not replay a contained member frame twice; shared unit identity makes containment explicit.
5. Explicit order authorship domain, complete endpoint membership and touched placement support are three distinct sets. Extending the before endpoint across an add must remove that lifetime from before membership; it must not declare a new full-order contribution over every remaining ordinary row. Keep approved subset-order behavior for unmentioned ordinary lifetimes.
6. An unselected topology operation breaks simple run extension. Preserve it under existing authority/eligibility rules; never bridge it with first-before/last-after merely because endpoints compare equal. If an existing safe inverse applies, keep it useful. If the approved conflict rule applies, refuse before any installation, retaining all authority. A new gap without a governing safe inverse is a proof obligation, not authorization for a new blanket refusal.
7. The resulting ordinary target and physical realization footprint feed the existing private target/point preparation. Resolve sequential execution dependencies separately from constraints on final topology. Validate both before installation. These composition pairs do not replace lifetime-sensitive successor/predecessor policy with historical-bracket placement or chronological intent replay.

The present completeOrderCapture is the common home for boundary extension, but its current mutation of only physical endpoints is insufficient. Both restoration and transaction materialization must call the same paired composition contract, after their existing selection. The existing transaction foldOperationDisposition remains a completeness check; it is not a second inverse engine.

## Hand-worked discriminators (reasoning, not executed tests)

| Sequence | Required evidence and result |
| --- | --- |
| O z,a,c → add w → overwrite-prepend c | Add pairs join O0→O1; prepend's ordinary before is z,a,c,w. Extending that before backwards by the add pairs yields z,a,c; after remains c,z,a,w. The scope before domain excludes w, so undo removes w and restores c's value/order without validating an intermediate membership domain. Redo uses the complete after endpoint. |
| Same sequence with an intervening independent field write | Field evidence remains separate; topology continuity is neutral. Selected topology composes while the existing field-preservation rule retains the independent value. |
| Own CBA → foreign BCA (optionally back to CBA) → own ACB | Existing per-collection order witness survives endpoint folding and requires atomic refusal, including ABA. No rollback notification; inspect/confirm remain useful. |
| Foreign BCA before first own order | It is the selected operation's actual ordinary baseline, not a selected operation or conflict merely because it exists. |
| Inspection changes P ABC to ACB; later O-only adoption | Inspection contributes no O edit; adoption supplies its own O interval even with no P membership interval. The physical-only subscriber filter cannot represent this case. |
| Outer prepend C then onAdd prepends D | Outer paired unit ends at CAB before delivery; nested unit begins there and ends DCAB. Scope composition may select both, but outer evidence never contains D. |
| One frame creates and removes a transient anchor | Final sparse placement may be empty, but existing inverse effects/claims retain an anchor while a surviving obligation needs it. Endpoint cancellation does not release that dependency. |
| Two Links created before/after inspection adds x | Apply the same authorized field inverse to their own baselines: [a1] versus [x9,a1]. No universal ordinary snapshot replaces either baseline. |

These derivations show what facts are required. They do not certify native emitter completeness, the existing placement algorithm, retries or resource behavior.

## Exact reuse and retirement

| Phase | Retained owner / release |
| --- | --- |
| Private preparation | Attempt-local pairs/token; no source registration until successful terminal installation. Preparation failure releases only attempt-local storage. |
| No active capture/subscriber obligation | Current ordinary divergence and current token only; no completed-unit journal. Token does not reference payload or prior tokens. |
| Transaction callback/pending handle | Existing installedOperations record references necessary evidence; prepared responsibility and selected authority remain the owners of effects/claims. Compact order conflict witness stores identity/ordinal, not foreign values. |
| History bucket | Existing orderBoundaries stores references to paired evidence, not another per-operation payload copy. At drain, prepared complete endpoints/required effects move into existing CanonicalTurn/HistoricalEvent retention; discard unnecessary source units. |
| Refusal | All selected authority, inverse evidence and required claims stay; no token/current-state update. |
| Confirmation/successful rejection | Existing installedOperations/expectedDispositions/order-admission deletes run at terminality. History that independently requires facts retains only those facts and existing claims. Observer failure after completed compensation does not make it pending again. |
| History eviction/redo truncation/reset | Existing restoration release path drops its references/claims; reclaim only after the final live obligation ends. |
| Tree destruction | Existing transaction cleanup does explicitly clear transactionOrderAdmissions at transactions.ts:4991, as well as operation maps via separate registered cleanup. Any proposed enrichment must use those same teardown paths. A retained handle/receipt may keep its terminal result but not an obsolete tree/journal graph. |

A source inspection correction is recorded: one trace initially missed the explicit order-witness clear near the end of destruction. It is present; this is not an executed retention failure. Reclamation of enriched records remains untested.

Costs to measure later: k touched pair records plus existing dependency facts, append without copying prefixes, no collection traversal for a field-only change or local cleanup. Broad reorder may already require N endpoint entries; compose them once with indexed lookup, not one full snapshot per constituent. Open-scope count and affected-connection fanout are separate cost dimensions; this design does not claim constant work across arbitrarily many genuinely affected consumers. No budgets are relaxed.

## Separate leaf-Link handoff

This is not repaired by order composition. Keep native source-shape interpretation and relationship authority separate, as source-mutation.ts already requires.

At binding, retain registry identity and the existing sealed structured path for an ordinary leaf; entity lifetime/field bindings stay a separate namespace. A tree-local affected-source index maps membership branch/member prefixes to bound ordinary sources. At membership event admission, select only genuinely affected sources; never enumerate unrelated trees or treat a dotted string as address identity. Register/dispose updates this index with existing connection lifetime.

A membership notification with unused undefined value slots is a real tagged event, not a generic ping. Admission uses its branch identity, literal changed keys, participation and event identity to mint evidence for each affected supported leaf. The native Link projection then pairs **that event's** evidence with the exact projected payload on that relationship baseline. An absence payload is valid undefined. Do not reuse completions.get(event) pointing at an earlier admitted fact; do not grant early permission merely because no payload is available.

Ordering: capture/validate source evidence before any relevant observable reentry, complete that same evidence before synchronous delivery, and preserve the existing queued membership barrier. Current PathNotifier calls enqueue observers before experimental annotate and calls researchComplete in flush; the synchronous delivery branch must be mapped explicitly. These are source-order findings, not newly executed counterexamples. If callbacks can run before evidence admission, collecting current pending owners afterwards is not proof of the earlier operation's dependencies. A successor must carry the prepared event's evidence rather than infer it at a later callback.

Eligibility decisions remain immutable and revision-specific. Default conservative hold, declared-validation obligations, surviving-write semantics and incoming exact-source authority stay unchanged. In-flight older sends complete under their own ticket, followed by corrective delivery for the newest eligible revision. Disposal removes source/index references and resolves local waiters without promising cancellation of already-started endpoint I/O. Creation after an event adopts a new baseline; it must not acquire that past event's admission retroactively.

## Finite native gate if separately authorized

First retain both unchanged production differentials, then cover the mapped six lanes and eleven writers under this record shape. Required discriminators include O-only and P-only transitions, same-unit containment, nested reentry, foreign order ABA versus independent fields, history turn versus callback grouping, transient anchors, ordinary-only adoption, unchanged subset order, source-revision preparation failure, refusal/retry and terminal cleanup. Leaf controls separately include missing member, re-add/ABA, literal keys, different trees, validation reentry, synchronous and queued delivery, multiple baselines, in-flight correction and disposal. Preserve original assertions; additional controls must require useful output.

A design approval would authorize no production claim. Native qualification must still demonstrate exact source completion and composition across all lanes; no isolated model, test count, or static derivation clears the recurrence stop. If implementation needs another authority, changed policy, whole-store point-work, or writer-specific loss repair, stop with the concrete conflict. Full suites/costs remain after focused native review, not part of this read-only continuation.
