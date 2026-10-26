# Concrete admission and selected-inverse mapping

October 26, 2026. Central response to the c179bd74 mechanism review. This supplements, rather than overwrites, the exact reviewed MECHANISM.md. Source-only derivation; no executable result or runtime authorization. The source remains f01ed39a.

## Admission is part of the terminal installation, not delayed capture delivery

The mechanism's phrase “minimum responsibility” includes the source unit's actual order admission and the existing foreign-order witness. It is prepared with the unit and installed before `observeCommitted`, membership callbacks, capture error reporting or native publication can reenter. The later `publishCollectionOrder` event consumes the already-admitted unit id; it cannot allocate another ordinal or retroactively establish the unit's place in chronology.

Concrete reuse:

1. Source preparation forms a paired unit with a private id and optional explicit-order fact. `setAll` must pass its already-prepared caller arrays into this fact; it cannot rely on `frame.orderEndpoints` being populated as prepend does. P/O stage pairs are sampled independently. Existing structuralRecords cannot be relabeled P: they currently derive from ordinaryPlan.changes under a P frontier, and inspection has different interpretation.
2. Existing transaction responsibility preparation stages a value-free update to the current `transactionOrderAdmissions` summary when this unit has an actual order contribution. The same admission rules apply: another collection/field is not an order, inspection and restoration are not foreign authored order, realized ordinary order is foreign. The update must participate in the existing terminal record plan even when this operation does not have a current transaction id, because a foreign operation may affect an already-open transaction's witness.
3. The unit's admission is installed exactly once with native/ordinary installation and responsibility. Preparation failure installs no ordinal or witness. If preparation reenters, existing revision validation rejects stale outer preparation before its witness/state install; the nested completed admission remains intact. Identity must not be reused on retry.
4. Later subscribers append/reference the completed record under the existing scope rules. Witness admission uses the unit's installed marker, not event delivery order. There is no global unit log: pending transactions hold only their existing compact per-collection summaries; history uses its current capture bucket and entry lifecycle. A caught listener exception cannot erase the already-installed witness.

For actual own A → reentrant foreign B → own C, A's first witness state exists before B starts; B marks the intervening admission and C closes the conflict. If B happens before A installation, B remains before the first own order. The same routine distinguishes the cases without inferring chronology from callback return. The unchanged full-order ABA refusal remains irreversible until the transaction terminally confirms/rejects under its existing rules. No current-value test replaces it.

This is more than moving a publish call. It places the required order fact in the existing preparation/install obligation, then makes old projections idempotent. No application callback order is intentionally changed; if a native implementation cannot preserve that order while installing the witness, it fails this design.

## Select effects first; do not invert complete placement support as authority

The integration points are the existing ones:

- `TransactionAuthority.getPendingRollbackPlan` (transactions.ts1040+) uses existing pending/later effect authority and an order witness.
- `buildPendingRollbackPlan` (427–758) returns a conflict or actual compensation effects; `classifyStructuralOverlap` (624–705) distinguishes erased lifetime responsibility from a surviving dependency.
- `applyRollbackCompensation` (3420+) passes selected effects to `compileSelectedCompensation` (3017+), then forms actual inverse effects with `toRollbackEffect`/`placeFieldReversalsWhileRowsExist`.
- The existing point realization path handles eligible effects. `rollbackPendingTarget` (3179+) and `deriveDeclarativeTransitionTarget` handle an existing order delta or a structural handoff requiring a complete target. Ordinary inverses are carried separately from physical target values under the existing private realization contract.

The paired composer enriches completion of **an existing selected order delta**. It does not create an order delta when selected effects only concern membership/rekey/fields. It does not add neighbor support pairs to `plan.compensation`, pending inspect effects, descriptor claims or `admittedEffects`. A unit can be retained as completion evidence while only some of its effects remain eligible; the presence of its id never selects all of them.

When selected effects have no order delta, their pairs may corroborate complete frontier compensation only under the existing `compensatedFrontiers` checks (complete expected disposition, contiguous permitted structural interval, matching current frontier). If supersession or an unselected interval prevents that proof, omit the optional frontier bridge and use the existing point/target inverse. Do not refuse solely because no bridge was produced. Do not feed source before/after endpoint snapshots into a partial inverse target.

When an existing broad order delta is selected, pair extension completes the original scope's domain and endpoint, but current order/frontier validation still decides whether it may be restored now. Do not discard superseded membership from a delta by arbitrary filtering, relax an occupied-destination or missing-anchor guard, or synthesize a new broad order to avoid those guards. Cases requiring a new selective full-order inversion rule remain outside this mechanism; the current supported refusal rules are preserved.

## Discriminating mappings

| Existing control | Selected authority → preparation → result |
| --- | --- |
| Own old-L rekey a→b; foreign remove L; own fresh-M add b | Structural classifier sees a later remove of L and omits the rekey as superseded. Different lifetime M is not erased by L's remove. Compensation contains own scalar x and M's add; inversion removes M and restores x. There is no authored broad order delta. The mismatched physical frontier must not supply a bridge or select L. Point/target realization removes M; both references stay absent. Same business key never makes L and M interchangeable. |
| Own remove L at a; foreign fresh-M occupies a | Existing selection/physical target validation refuses the occupied destination before any inverse installation. A rejected preparation changes neither x nor M and retains pending authority. After foreign M removal, the same pending effects are reconsidered against current occupancy; restore L and x, keep M detached. No cached pair result may preserve the stale conflict or consume authority on the first refusal. |
| One source unit's field/structural effects are partially superseded | Keep all unit evidence necessary to understand the completed installation, but send only the authority selector's returned effects into inverse compilation. Placement support remains evidence, never an extra reversal or claim. If no order delta is selected, no full source before image is installed. |
| O ABC; inspection hides B; authored setAll(C,A) | Ordinary endpoints ABC→CBA, authored permutation domain {C,A}; B's adjacency is support-only. Undo ordinary order takes ABC restricted to the authored domain, yielding [A,C], and the source's existing orderDomain permutes those slots around untouched B. Redo uses [C,A]. B remains ordinary, with its existing payload and lifetime; its pointer changes neither adopt it again nor erase it. |
| Remove rows with no remaining valid anchors and no authored broad order | Pass selected structural inverse to existing successor/predecessor/final-topology resolver. Sparse before pairs do not manufacture a broad order delta; the unchanged ST1034/placement refusal remains. |
| Whole turn add-w then overwrite-prepend-c | All relevant membership and order facts belong to the selected turn. Extend the explicit prepend before endpoint across add-w's O interval before creating the inverse domain. The inverse removes w and restores the original z,a,c order. Here complete scope composition is valid; it is not the partial-supersession case above. |
| A transient created/removed lifetime is named by surviving inverse work | Keep current withTransientRows/claim obligation even if the net placement pair cancels. Transient reconstruction goes through the existing final-target dependency resolver, not a new historical-neighbor overwrite rule. |

Sources: native-foreign-disposition-matrix.spec.ts15–25; indexed-source-owner-subset.spec.ts58–87; restoration-missing-anchors.spec.ts; two-setall-turn.spec.ts141+; order-composition-readiness.spec.ts. These are unchanged acceptance assertions and source-derived expected paths, not newly passing tests. No arbitrary-order rollback capability is claimed.

## Leaf dependency and delivery admission

At native membership event preparation, identify bound affected ordinary sources using registry + literal structured segments. Create per-event/source association before any enqueue observer, validation getter or error callback can change dependencies. Bind the existing revision/declaration evidence to that association; it is not a grant. The ordinary projection still applies the native event to each relationship's own baseline at delivery. Facts and payloads join by that exact event/source association, not by latest-completed fallback.

Both queued and synchronous delivery consume a completed association. The current flush-only completion and annotate-after-enqueue-listeners ordering are not sufficient. A delayed association cannot repair a previously published value; a synchronous path may not skip completion. A connection created after admission adopts its current relationship baseline and gets no retroactive association. These rules retain native notification order while preparing immutable evidence earlier; they do not add a flush or release pending/validation holds.

The native proof must show the actual terminal event-preparation point for member omission/re-addition and the two delivery branches. This read-only mapping identifies the requirement, not an implemented hook. Reentrant declaration validation, literal-key cross-tree exclusion, multiple relationship baselines and in-flight correction remain separate falsifiers.

## Cost and scope limits

Counting stage pairs is not claiming local prepend is already constant-work. Existing preparation may populate broad patches or materialize order arrays; its recorded traversal regression remains unaccepted. Report actual prepared support, emitted changed pairs, snapshot traversals and live-obligation retention separately. No additional journal, canonical mirror, new public policy or API is proposed. Independent native qualification and fresh artifact/cost acceptance remain required before any integration claim.
