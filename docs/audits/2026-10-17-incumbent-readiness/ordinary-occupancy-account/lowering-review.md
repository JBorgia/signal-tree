# Independent lowering and realization feasibility review

Read-only source audit against `/private/tmp/semantic-transition-slice2/candidate` (rejected runtime preserved). No executable model, runtime change, or new test execution. Scope: proposed MECHANISM.md occupancy account through existing capture, inverse validation and physical planning.

## Disposition

A complete ordinary occupancy account can lower its **authored ordinary changes** into the existing add/remove/rekey vocabulary. That does not make those effects directly executable against current physical state. The proposed identity join is a necessary new **shared preparation step before physical validation**, not a small adjustment to the installer. Current source has multiple earlier gates that reject the active-old case before a new installer could help.

A single-authority extension remains plausible: incumbent ownership admits the ordinary inverse; one preparation record derives and validates physical realization from it, preserving both views. Source inspection does not prove this extension complete. It requires coordinated changes at the private validation/target joins identified below. It would become an architectural expansion if implemented as an alternate admission engine, independent ordinary frontier, a new pending ownership model, or separate ad hoc normalizers for each rollback route.

## What existing vocabulary can express

`CommittedEntityMutation[]` plus structuralRecord admits an ordered sequence. Bind fresh→A when old ordinarily occupies A can record ordinary remove(old,A) and add(fresh,A). Bind B→A can record remove(old,A) and rekey(B,priorKey,A). Unbind ordinary-absent produces an explicit empty ordinary list. These facts can enter existing transaction responsibility before installation and the same prepared list can feed rich capture.

But the operation before-set, ordered edits and normalized capture effects are not interchangeable. `pending-rollback.ts:117+` indexes dominant structural effects per lifetime, deduplicates first effects by rollback address, and orders field reversals around existence. `transactions.ts` also folds effects. Therefore multiple same-key operations within one operation require checking the *resulting normalized inverse*, not merely showing that the initial list names every displaced lifetime. Recovery before-facts must not be lost by add/remove cancellation or rekey folding. This is an explicit lowering acceptance check, not evidence that folding must be replaced.

## Active-old counterexample: exact earlier gates

Suppose ordinary old A belongs at key A, inspection moved that exact lifetime physically to B, and a pending fresh lifetime occupies physical A. The ordinary inverse asks for fresh absent and old bound to A.

1. On the ordinary adapter route, `pending-rollback.ts:79` calls port.validateEffects before preparing discard and before applyAtomically. `tree-realization-adapter.ts:456` builds a PreparedRealizationContext. `canApplyEffect`'s add branch (~1605) rejects whenever the target lifetime already has any current physical key. Freeing A first does not make old inactive at B. Moving normalization only into applyAtomically is too late.
2. The same-key guard can select `rollbackPendingTarget` directly in transactions, bypassing that optional point planner. `target-transition.ts:679` rejects add if the lifetime is already in the collection target; rekey requires the exact expected source key (~710). Supplying the old ordinary add unchanged to target derivation fails independently of the first gate.
3. Heterogeneous/point/S5 planning also builds and updates prepared physical context. Its rekey planner uses current physical from-key, and restore planning expects an inactive/restorable lifetime. Rewriting the installer alone cannot reconcile these assumptions.

The required physical realization is a transfer of old from actual B to A plus removal of fresh, with complete-unit destination validation. Ordinary responsibility remains restore old-at-A; physical transfer is its realization, not a new authored rekey and not a reason to rewrite the transaction's ordinary before-facts.

## Required private handoffs

- After incumbent overlap/ownership admission determines the authorized ordinary inverse, derive one immutable realization record containing original ordinary edits, affected identity/key closure, current physical revision and proposed physical instructions/target.
- Perform the identity join **before every physical validation gate**. Validate against the complete proposed occupancy, including keys vacated by that same unit and old's current physical source key. Preserve refusal for unrelated surviving occupants and unavailable identities.
- The adapter validation and installation must consume the same prepared record or revalidate its captured revision. A validator that checks one translation while apply independently translates current state can disagree under reentry.
- Feed the existing complete-target guard and target construction the physical occupancy plan, while retaining ordinary inverse evidence alongside it. Keep the same-key handoff guard. Do not derive ordinary authority from the physical target diff or rewrite the stored ordinary effect into its physical counterpart.
- Carry original admitted ordinary value/presence edits into point and complete-target value installation. Active-old transfer must not silently replace inspected displayed fields with a historical full row, nor commit incidental physical fields as ordinary truth. Structural existence restoration and field restoration remain separately specified.
- Existing `PreparedRealizationContext` tracks staged physical occupancy; it is reusable for the physical plan but is not an ordinary ownership authority. Its current add/rekey predicates remain legitimate for *physical* instructions. Changing add to accept active lifetimes globally would weaken the wrong contract.

These changes touch transaction rollback's route selection/port boundary, shared target derivation input, and point/S5 preparation. That is larger than a Bind displacement-table patch, but still potentially the approved shared-facts preparation extension. A new prototype limited to an occupancy map would not establish these joins.

## Placement and frontier must not disappear during lowering

A physical rekey preserves position. An inverse ordinary removal currently restores using lifetime-sensitive successor/predecessor placement. Translating ordinary add→physical rekey solely because the lifetime is active can therefore lose required placement behavior. The prepared account needs an explicit answer: which already-authorized placement facts apply to this inverse, which survive, and whether moving the physically active lifetime is required. Do not silently substitute preserve-current-position, historical bracket replay, or whole-collection reorder. Preserve current successor-placement policy and test moved/missing/same-settlement anchors with the active-old variant.

Partial occupancy restoration must leave unrelated ordering alone. Existing CollectionOrderDelta participants and explicit structural placement are available representations, but source inspection does not prove that a synthesized narrow physical placement can be lowered without new authority. If current vocabulary cannot express it faithfully, that is the concrete representation boundary to report before implementation.

`transactions.ts:2701` deliberately ignores equal physical frontier endpoints. Ordinary-only adoption may have no physical frontier change and must still retain membership responsibility. Its inverse can physically change occupancy/order and must publish that actual transition. C3 can change physical order with no ordinary inverse. No invented frontier token should make these cases fit a convenience branch. Target frontiers and existing compensated-frontier validation must remain tied to their real physical intervals.

## Bounded next evidence

Before claiming feasibility, the same account must produce admissible ordinary inverses and valid physical plans for absent-old versus active-old; add/adopt/rekey displacement; multiple staged bindings; committed replacement and atomic pending refusal; same-unit destination vacating; untouched inspected fields/order; and useful retry. Inspect both normalized inverse and physical plan, not just final rows. Preserve active-old's current safe refusal as the control while requiring the proposed contract's intended success only where the owner-approved target is fully specified.

No impossibility established. No runtime acceptance established. The proposal identifies the right missing distinction, but requires a common prevalidation realization account and an explicit placement join to avoid repeating the rejected implementation's missing-facts pattern.
