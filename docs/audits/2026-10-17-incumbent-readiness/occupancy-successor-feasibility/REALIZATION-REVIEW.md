# Independent physical-plan expressibility review

Read-only source review, 2026-10-22. Source: `/private/tmp/semantic-transition-slice2/candidate`; raw failures: `review/rekey-vacancy.ts` and `retention-review/witness.ts` in its parent evidence directory. Read approved plan and PAYLOAD-DECISION.md. No other reviewers' conclusions read. No runtime edits, model execution or test reruns; findings below are source evidence, not successor acceptance.

## Finding

The existing native structural target can represent the approved result. The current inverse-effect handoff cannot represent every route without a common prevalidation distinction between ordinary facts and physical realization. An installer-only fix, or changing ordinary `add` to physical `rekey` in-place, is insufficient.

The required result is L physically and ordinarily at A, physical n99 / ordinary n7; fresh F detached. Payload ID need not equal key. Existing native lifetime identity and native divergence storage suffice as storage primitives. No second settlement engine or persistent canonical tree is required by these two minimal witnesses. This is a feasibility conclusion only: the present S5 sparse plan has a missing combined transfer/placement representation, and preparation/install publication details remain implementation gates.

## Exact boundaries

1. `transactions/transactions.ts:3135–3220` selects full-target rollback before pending normalization for order/same-key structural handoff; otherwise `rollbackPendingTurnAt` invokes `validateEffects` before its apply callback. Adding a join only in that callback is too late.
2. `pending-rollback.ts:75–91` validates original normalized effects, then prepares discard and applies those same effects. `tree-realization-adapter.ts:456–479` validates through `buildPreparedRealizationContext`; lines2067–2101 fold physical per-effect state.
3. `tree-realization-adapter.ts:1605–1617` rejects add if its subject is already active. That is correct for a physical add, incorrect as interpretation of an ordinary existence restoration whose lifetime remains physically active elsewhere. Destination validation must remain against the complete authorized physical plan; do not suppress this rejection generally.
4. `rollbackPendingTarget` lines2846–2866 derives its physical target from current physical source and ordinary reversal effects BEFORE attaching admittedEffects. `target-transition.ts:680–685` throws if an add subject is already active. Attaching richer evidence afterward cannot fix this earlier interpretation.
5. `prepare-structural-target.ts:19–58` accepts an existing active lifetime at a changed key and independently accepts an explicit complete order, with uniqueness and restoreAllowed checks. Thus a correctly derived final physical target is expressible without recreating L or overwriting L's current physical payload.
6. `prepare-entity-target.ts:131–146` collects original admitted structural subjects, classifies add/remove as existenceSubjects, and excludes them from value realization transitions. Its install loop then clears ordinary topology overrides and calls `dischargeOrdinaryValue` for those subjects. This actively destroys the approved ordinary7/physical99 divergence. An extra field-edit list alone does not fix its structural semantics.
7. `EntityValueTransition` plus `EntityValueStore.installValueTransition` already represents physical99 / ordinary7 and retains the ordinary baseline. But `prepareRealizationTransition` starts from the currently stored baseline and only applies value edits; it does not represent restored ordinary presence or binding. An original inverse add supplies the O restoration payload, while current P supplies retained display. Those are two inputs to one prepared result, not alternatives.

## Minimal common preparation record

A transient prepared unit can reuse existing structures but must explicitly retain:

- Original ordered ordinary inverse effects (unmodified), including structural occupancy and value facts, for incumbent authority/capture/ordinary publication.
- Prepared ordinary binding/presence disposition for affected lifetimes and keys, derived from those facts and staged occupancy. This is not inferred from the physical target.
- Ordered explicit value realizations, distinct from implicit historical row payload used to restore ordinary existence.
- Physical realization: current-lifetime transfer versus inactive-lifetime restoration; physical payload chosen by the approved rule; final placement under existing policy.
- Physical and ordinary before/after transitions for native publication versus ordinary consumers, and the shared base revision checked before install.

For the active-old witness: O restoration says L→A/n7; P join sees L→B/n99; realization says remove F, transfer L B→A, retain P99, install O7 divergence. A subsequent explicit n99 adoption and rejection must still have a value inverse7. Rewriting O add to P rekey would lose the ordinary existence/value restoration; rewriting its payload to99 would lose O7.

## Placement cannot be silently dropped

`planPreparedRekey` in entity-signal.ts:1167 onward only stages `transfer-key`; it preserves the existing linked-list position. `PreparedKeyTransfer` has no placement facts. The heterogeneous planner groups removals/restores/rekeys and only its restore plans run current successor/predecessor placement. An ordinary inverse add lowered only to physical rekey consequently loses restoration placement.

The full target already separates final key map from final order. Point/S5 needs an equally explicit sparse physical transfer+placement preparation, using the existing lifetime-sensitive placement rule. The approved plan forbids routing point work through full collection targets. Therefore “use full target for every structural inverse” is not a valid shortcut.

Remove+restore of the same active lifetime may imitate final storage shape, but unchanged `planRemove`/`planRestore` publish removal/addition callbacks and restore payloads. That is not demonstrated equivalent to an active transfer, and would risk changing callbacks/inspection and losing P99. Do not advertise it as an existing solution. Existing target publication computes active-before/active-after changed key as rekey and has no lifecycle tap for it (`prepare-entity-target.ts:232–285`); preserve that distinction.

No new ordering policy is needed merely to represent these facts. A prepared active transfer can carry separately resolved placement. Existing target derivation's placement function takes inverse add anchors; do not convert to a rekey and then pretend unchanged `deriveStructuralTargetOrder` will recover lost placement. Preserve full-unit anchor dependencies, occupied destination refusal, successor/predecessor identity, and frontier checks. This review does not qualify broader target placement rules.

## Review gates before runtime selection

- A single common preparation must occur before BOTH adapter validation and target derivation, and the installation must consume that exact prepared revision, not independently reconstruct it after validation.
- Full-target and sparse point/S5 lowering must consume the same ordinary facts but can use their existing different physical installation strategies. No caller-local inference of O from P.
- Preserve unmodified first failures. Add active L at B with display99/ordinary7, subsequent99 adoption/rollback7, and multi-neighbor relocation controls that distinguish key transfer from placement.
- Native callbacks must describe actual physical change; ordinary capture/inspection/publication must describe original authorized O inverse. Do not emit synthetic remove/add lifecycle for active relocation merely to reuse plans.
- Preparation throw/reentry, unchanged-state refusal/retry, same-unit destination vacating, and pure point-work counts remain required. No fresh success counts established here.

## Disposition

Scoped common-join implementation is plausible with existing native authority and value transition primitives, but cannot be claimed to be plumbing existing effects unchanged. The concrete internal gap is a prepared ordinary structural disposition plus physical transfer/placement record before validation. It is not evidence of a new public semantic conflict after PAYLOAD-DECISION, nor proof the candidate passes. No later slice gate is cleared by this review.
