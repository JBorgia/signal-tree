# Structural-drift refusal regression: validation is applied after its precondition is rewritten

**Finding:** the experimental ordinary-to-physical lowering substitutes the current physical key for the original rekey `before` endpoint, then restoration validates only that lowered array. The check still exists, but it now checks a precondition manufactured from current state. In the unchanged public fixture, inverse `2 → 1` becomes `3 → 1` after external rekey `2 → 3`; `currentKey === before` consequently succeeds. This erases the structural-drift refusal that protected the atomic bounds sibling in 87f.

No source or tests were edited or executed for this trace. Main owns the unrelated collection-anchor and retained-address corrections. This is a source-grounded mechanism proposal for review, not implementation authorization or acceptance.

## Sources and observed evidence

- Production Git: `87f6831fa60cafe87508f0ace84b7638698ca3b0`; verified archive `/private/tmp/st-native-shared-failure-triage/production-87f-0i52qgfq/candidate`, manifest SHA-256 `da9bb5e49f78eb94c53d936728108334b935a222423ea45c846c5367368ae9d3`.
- c47b manifest: `c47b821c5a805f5b37d6c0f5707098d9871fdf2575d22dcc3e12f4a4c93c81db`, `/private/tmp/st-prepared-paired-successor/candidate`.
- d3b manifest: `d3b6da2906ae9cef72e5623b35eb6de3dee73d64b12f5c9bd408352aa627e73b`, `/private/tmp/st-selected-forwarding-cleanup-successor/candidate`.
- `SOURCE-IDENTITIES.json` hashes the inspected files and verifies them against each frozen experimental manifest. Restoration, ordinary-realization, ordinary topology and the fixture are byte-identical between c47b and d3b. Their adapter diff only adds the selected-continuation outcome cleanup, outside this structural validation path; saved as `d3b-tree-realization-adapter.ts.diff`.
- Exact fixture: `packages/kernel/src/lib/opaque-leaf-restoration.spec.ts`, test “still refuses structural drift before reversing an atomic leaf sibling”. It is byte-identical at production and both experimental sources.
- Production focused command/log/result: `/private/tmp/st-native-shared-failure-triage/production-87f-0i52qgfq/02/{COMMAND.json,first.log,RESULT.json}`. Through Nx, one selected assertion passes, exit 0; timeout/assertions unchanged.
- c47b and 057c broad raw failure identities copied into `successor-RAW-FAILURE.json` and `predecessor-RAW-FAILURE.json`. Both fail at `expect(() => tree.undo()).toThrow(...)`: undo did not throw. Later state assertions did not run. The trace does **not** claim measured post-failure bounds/history corruption or a new d3b execution. d3b applicability is supported by the relevant source comparison.
- `restoration.diff` and `tree-realization-adapter.diff` preserve production-to-c47b source changes. Commands used here: read-only `git show 87f6831f:<path>`, `rg`, source excerpts, SHA-256 comparison and Python diffs. No runtime instrumentation was added.

## Exact sequence and lost boundary

The unchanged fixture at lines 234–260:

1. Create row lifetime S at numeric key 1, bounds `{min:0,max:10}`.
2. One undoable operation changes bounds to `{min:1,max:9}` and rekeys S `1 → 2`.
3. Public `external(() => rows.changeId(2,3))` moves that same lifetime to key 3; flush.
4. Undo should refuse the complete operation. Bounds remain `{min:1,max:9}`, ids remain `[3]`, history cursor remains its captured index, and `canRedo()` remains false.

### Production 87f

`restoration.ts:3261` sends the unchanged `appliedEffects` to `realizationPort.validateEffects`. For the structural inverse the original endpoint remains `before=2, after=1, subject=S`. `tree-realization-adapter.ts:446` builds the ordered prepared context; its rekey predicate at 1448–1451 requires current subject key to equal the recorded `before`. Current key is 3, so it returns structural drift. Restoration throws before `applyAtomically` or history advancement. The focused production pass covers both refusal and every subsequent public state assertion, not just matching an error string.

### c47b/d3b

`restoration.ts:3301–3310` first calls `prepareOrdinaryEffects(appliedEffects)` and then validates the returned `preparedEffects`. Adapter `prepareOrdinaryEffects:476–489` calls `prepareOrdinaryRealization` with a current physical-key resolver `__findKeyBySubjectId`.

`causal-runtime/ordinary-realization.ts:34` reads key 3. Its general rekey branch at 47–50 copies the original effect but sets `before: key`; inverse `2 → 1` has become `3 → 1`. The original array is retained in a WeakMap (lines 53–54), but **semantic validation does not use it**.

`tree-realization-adapter.ts:491–502` validates the lowered array. `buildPreparedRealizationContext:2322–2354` calls `canApplyEffect` and advances a temporary ordered context. Its rekey predicate at 1802–1811 compares current key 3 with the freshly substituted before key 3. The target key 1 is vacant, so this predicate no longer detects the external rekey. Installation later receives the lowered effects, with the original ordinary array used for ordinary publication at `applyAtomically:555–564`; retaining that publication metadata is not admission validation.

The scalar external-conflict pass cannot rescue this case: `restoration.ts:3244` skips structural effects, and the external event changed the row key, not the bounds scalar. Nor is the new selected point route responsible: this is restoration's structural inverse, not transaction point admission.

The source selects the non-declarative route for this simple one-turn rekey: `requiresDeclarativeStructuralTarget` in `target-transition.ts:266–332` checks key handoffs between distinct structural effects and additions; one rekey plus a scalar triggers neither. Both production and experiment already have the declarative conditional, so attributing the regression merely to “declarative validation skipped” is incorrect. No new branch-entry runtime trace was executed; this is the direct source interpretation of this concrete fixture.

## Bounded general correction mechanism

Restore **semantic admission before physical lowering**, while retaining legitimate physical/ordinary divergence. Do not insert a key-3 special case, inspect display visibility, or route around the existing planner.

1. Keep the exact original owner/subject/structural endpoints as the semantic operation. Validate the whole operation against source-owned **ordinary structural state** before substituting any current physical key or dropping a physically absent remove. Reuse the existing structural admissibility predicates and ordered temporary-state simulation; do not infer authority from a lowered endpoint.
2. Obtain ordinary membership/key/occupancy from the collection's existing `EntityOrdinaryTopology` and `StructuralStore` pair. `entity-ordinary-topology.ts:25–30` already constructs the ordinary placement view over physical base state plus explicit divergence. `entity-signal.ts:710–725` already uses that view in source-owned ordinary realization. A private, bounded source admission method can expose the necessary read/simulation capability to the adapter, without a public export, global index, full output materialization, or new lifetime authority. Its lookup keys must remain `(collection source, subject)` and typed storage keys, never mutable path strings.
3. Only after semantic admission succeeds, lower the approved operation into physical placements using the existing current-key join. Validate physical realizability separately: exact active lifetime, destination occupancy and same-step dependencies. The two validations answer different questions; a physical key is an address, not evidence that an external change was authorized to be reversed.
4. Tie both results to the same complete ordered operation and source/revision boundary. Validate all effects, including the atomic scalar sibling, before any install, source completion, cursor movement or delivery. If preparation can invoke callbacks, revalidate its existing revision/lifetime boundary before committing. Refusal must discard request-local preparation and leave physical and ordinary state/support/history unchanged.
5. The adapter's `prepareOrdinaryEffects`/`validateEffects` contract should carry an explicit admitted pair (semantic operation plus physical lowering) or perform the semantic check inside the private lowering boundary. A bare physical array with optional WeakMap evidence is insufficient as a proof of admission. Audit both callers (`restoration.ts:3303`, `transactions.ts:3821`) so no caller can bypass the semantic phase. Do not switch planners; operations with complete-target/order/frontier requirements continue through their existing complete route, preserving its admission obligations.

Why not simply call the old validator on the original array against physical state? Inspection can legitimately move physical placement while ordinary placement still has the recorded key. That shortcut would reject allowed ordinary inverses merely because display storage differs. In this external-rekey case, ordinary and physical placement both move to 3, so semantic `before=2` fails. In an inspection-only rekey, ordinary may remain 2 while physical becomes 3; semantic admission can succeed and physical lowering can use 3. This distinction follows the existing ordinary topology, not a new public policy.

Apply the same separation to existing add/remove lowering: a semantic add becoming physical rekey and a remove being physically omitted must not erase semantic preconditions or lifetime collisions. Preserve existing per-kind rules; do not invent a universal strict-key law where current remove/restore semantics intentionally use subject identity and prepared occupancy. No extra cache or permanent authority record is needed.

## Unchanged controls required before accepting a future correction

No controls were modified or rerun here. Keep original assertions, including the current diagnostic matcher; acceptance is the all-state contract, not the matcher alone.

- `opaque-leaf-restoration.spec.ts:234`: original counterexample; must refuse **and** preserve bounds, row ids, cursor and redo availability. Adjacent external-undefined controls preserve whole-turn refusal for atomic scalar truth.
- `enhancers/restoration/p0c-divergence.spec.ts:68`: same subject externally/realization rekeyed; refuse without changing key. At :96, “REPAIRED: one conflicting location refuses the WHOLE turn”; at :123, conflicting undo leaves cursor position. These prevent a fix that merely skips the unsafe structural component and restores the scalar sibling.
- `internals/causal-runtime/tree-realization-adapter.spec.ts:497`: refuse same-key work occupied by another subject (lifetime, not key alias).
- Same file :1039, :1310, :1648, :1793: preparation remains side-effect free when later scalar/stale-subject or occupancy validation fails. These cover earlier safe contributions before a later refusal.
- Same file :1190, :1523: restore→rekey and remove→restore→rekey use prepared state rather than independently validating every step against the initial live state. Keep these positive controls so general admission does not over-refuse lawful composition.
- Same file :620: successful mixed rekey/scalar publication is coherent. :326 and :557 preserve subject/PositionId addressing after physical rekey for scalar operations; do not turn all rekeyed subjects into stale handles.
- `entity-inspection-egress.spec.ts:238`: inspection rekey followed by authored update keeps the same lifetime. This is an existing positive separation control, not by itself a full undo-after-inspection proof. A future correction needs a focused paired inspection-versus-external structural inverse discriminator if no existing fixture pins that exact distinction; none was invented or added here.

“All-state unchanged” includes physical values, ordinary payload/support, entity lifetime/key/occupancy, history cursor/redo and externally visible delivery. The original test directly covers public values/key/cursor/redo; the existing adapter controls cover additional preparation atomicity. Do not claim the original alone measures internal support or notification silence. Any missing exact support/delivery discriminator belongs in the reviewed correction's preregistration, not an inferred pass from the error string.

## Handback

The lost boundary is **semantic structural precondition validation before address normalization**. The evidence establishes the specific public regression against production and a source explanation unchanged by d3b's forwarding cleanup. Main can review the source-owned paired-admission mechanism above independently of collection-anchor/retained-source work. No runtime successor, new test oracle, public policy change, or broader qualification is included.
