# Bounded admission/selection follow-up

Reviewed October 26, 2026. `ADMISSION-SELECTION.md` SHA-256: `faca98744b11e714c0361b0ddfe708846ea699e2b8269820318072834a982c42`. Original `MECHANISM.md` remains unchanged at `c179bd743ad1c579a4938f9d5d8aacf7b6f618fe86e9ad9fdbce574b629afd69`. Source inspected: frozen f01ed39a in `/private/tmp/v16-transition-qualification`.

**The addendum resolves the two concrete design ambiguities for the requested cases. No contradictory selection policy or new authority is demonstrated.** It identifies the existing selector/realization routes and makes order-witness installation precede reentry. Those are adequate source-level answers to my bounded findings; they are requirements for a successor, not proof that f01 already implements them or authorization to resume runtime.

I inspected only the addendum and relevant source/test chains for the three requested cases and admission-order finding. No other new reviewer verdicts, model/runtime/test execution, or source edits. Only this report was written.

## Own rekey, foreign removal, own fresh same-key addition

The mapping matches the existing selector:

- `transactions.ts:630–644` classifies an add/rekey as superseded when later same-owner-path, **same-subject** evidence ends in removal. The foreign removal of old lifetime L therefore supersedes its own rekey.
- The fresh addition M has a different subject. The removal of L cannot erase M at lines638–639. The compensation loop omits superseded L and retains eligible M/scalar effects at706–747.
- `applyRollbackCompensation:3440–3443` compiles only selected effects and inverts them; `compileSelectedCompensation:3017–3054` does not add support neighbors. Inversion removes M and reverses the scalar. It does not restore L merely because the business key is b.
- `compensatedFrontiers:3112–3146` requires continuous complete expected/actual structural responsibility and matching current frontier. No bridge is a valid outcome; the subsequent point/target routes at3563–3602 still apply selected inverses.

The unchanged `native-foreign-disposition-matrix.spec.ts` case explicitly requires no rows, both held lifetimes absent and x restored. The addendum preserves that useful success rather than introducing gap refusal. **Source and assertion verified; test not rerun.**

## Occupied destination, refusal, later useful retry

The addendum appropriately says selection/**physical validation**, rather than attributing this case solely to the rekey-occupancy classifier. Here the owned effect is removal of L, not rekey. The later occupant M is another subject; the selected inverse still requests restoring L, and physical admission must reject M's occupied key.

The existing rollback route validates prepared ordinary/physical effects before atomic application (`transactions.ts:3598–3605`), with the existing complete-target route where structural handoff requires it (3563–3587). The restore planner explicitly checks whether the destination will be vacated by the selected frame before permitting restoration (`entity-signal.ts:2039–2063`). M is foreign and not selected for removal, so it is not a permitted vacancy. A preparation failure without installation leaves the turn pending (`transactions.ts:4720–4737`); terminal cleanup occurs only after successful compensation (4742–4745).

After foreign M removal, the pending request is planned against current occupancy. Keeping the original effects and recomputing admission makes L's restoration possible; a cached failed pair target must not override that. The unchanged foreign-disposition test asserts first refusal preserves M and x1, followed by restoration of held L, M detachment and x0. **No contradiction found; no replay executed.**

## Ordinary ABC, inspected B omission, authored setAll(C,A)

The mapping preserves the three domains:

- `prepareOrdinaryTopology` records complete O endpoints and a separate authored domain (`entity-signal.ts:1050–1067`); `indexed-source-owner-subset.spec.ts:58–87` expects ABC→CBA with B retained ordinary.
- Transaction reversal selects `ordinary.before` restricted to `ordinary.domain` (`transactions.ts:3257–3265`), yielding [A,C]. History selects before or after using the same restriction (`restoration.ts:3102–3114`), allowing the reverse [C,A] direction.
- `prepareEntityTransitionTarget:168–174` carries that admitted order into ordinary preparation; `entity-signal.ts:826` invokes `orderDomain`. Its implementation (`entity-placement-stage.ts:75–89`) permutes only domain slots in the current ordinary sequence, keeping B in its slot.

Thus B's changed adjacency remains support evidence, not new membership, payload or full-order ownership. No support pairs need to enter compensation/inspection effects. This closes the requested domain interpretation. **Source and existing assertions verified; no undo/redo or rollback execution occurred.**

## Pre-reentry witness installation

The addendum explicitly closes the conditional B,A,C defect: the actual order contribution and foreign-order witness are part of terminal installation **before** `observeCommitted`, including error-reporting reentry. Later order callbacks only consume the admitted id without allocating another ordinal. Therefore actual own A→foreign B→own C is summarized as that chronology; B before A's installation remains the distinct foreign-before-first-owned case.

The existing policy is retained: `transactions.ts:2777–2807` ignores inspection/restoration/rollback order, treats realized ordinary order as foreign, and records interference per collection. The revised placement of that admission changes when the same fact becomes available, not which foreign order conflicts. Failed/stale preparation must install no outer witness while preserving a completed nested admission.

This requires native work: the current order subscriber still performs admission at delivery time. Pure-order units, foreign units without a transaction id, callback faults and retries must all receive exactly one prepared/installed witness update; carrying only row responsibility is insufficient. Those are implementation falsifiers, **not a remaining contradiction in the addendum's explicit rule**. No new execution was requested or performed.

The requested finite follow-up is complete. The two design findings are addressed at specification/source-mapping level for these cases. Original rejection evidence and runtime stop remain unchanged; broader native correctness, costs and authorization were outside this follow-up.
