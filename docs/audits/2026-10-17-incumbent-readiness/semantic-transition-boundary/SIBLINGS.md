# Sibling realization boundary trace

Read-only at production checkout `90c1bd1118cba0748dd0d233fc787b3d055a39a2`, compared with rejected `/private/tmp/semantic-transition-execution/candidate`. No runtime edits, later migration or fresh execution. Source citations below relative to `packages/kernel/src/`.

The adapter, plain-member planner, target derivation and complete entity target planner are byte-identical between production and rejected candidate (`cmp` succeeds). Their conversion boundaries pre-exist. The candidate newly interprets a full physical point target as full ordinary authority; this changes the consequence of existing information loss. Do not call production itself guilty of the approved-adoption regression simply because it shares the conversion code.

## Point field versus whole row

`lib/internals/causal-runtime/tree-realization-adapter.ts:648–740` accepts ReversalEffects retaining owner/subject, subjectFieldSegments, fieldPresence and endpoints. At725–728 it snapshots the current physical row once. At730–734 it resolves the effect path: empty path replaces the complete row, absent-after removes just that field, otherwise only that field is assigned. Thus field-level effect information is still available while composing the physical target. At740 the collection receives only `{subjectId,key,value}`: the exact field footprint and the distinction between whole-row replacement and a partial overlay are no longer represented in the target shape.

Production `lib/entity-signal.ts:496–530` treats this as a physical installation, invalidates and publishes realized data. Rejected candidate `entity-signal.ts:507–528` adds `prepareValueTransition(subjectId, after)` without a footprint. Candidate `physical/entity-value-store.ts:22–47,57` selects full physicalAfter as ordinaryAfter, marks divergence false and deletes baseline. This is the **proven failure**: mixed x1/m4 rollback accidentally adopts inspected n99, making later n99 adoption empty and rollback99. Exact uninstrumented evidence: `/private/tmp/semantic-transition-s3-review/first.log` and frozen bundle. Row-only positive uses a different route and succeeds.

Whole-row effect has no untouched row fields within its explicit scope; carrying a full target there is not by itself a defect. The loss is the inability to discriminate whole-row from partial field scope at the receiving seam. Absence versus present undefined remains honored while constructing physical value, but not carried as separate realization footprint.

## Mixed plain member plus row

`tree-realization-adapter.ts:663–670` collects membership targets with explicit presence/value/turn;736 prepares them separately from row plans. `lib/internals/plain-branch-membership.ts:888–904` preserves member presence and scalar target identity;942–1021 recursively stages exact own supplied members/absence;1023 onward preserves staging turn order, preventing older value effects from overriding later membership. Its return has staged position IDs plus install/invalidate/publish phases. Installation1139 validates retained handles and installs scalar frame then membership. Publication1172 records realized membership metadata and value endpoints.

Important separation: member staging at992–999 deliberately excludes entity collections from ordinary member recursion; collection storage is restored by its own entity effects. Thus a plain-member target does not supply the missing row field footprint. With no entity structural effect, entity siblings still go through the same point aggregation740. This is a **source-predicted exposure**, not a newly executed counterexample; no blanket claim of a plain-member defect. Member presence itself remains explicitly represented rather than collapsed to a value-only undefined.

## Heterogeneous structural plus field/scalar effects

`preparePointRealization:673–700` switches to `planHeterogeneousFrame` when any effect is structural. `tree-realization-adapter.ts:788–815` validates supported add/remove/rekey vocabulary and constructs a PreparedRealizationContext. Context keyed by collection scope+subject at136–149 tracks prospective occupancy/value; `updatePreparedRealizationContext:1773–1809` applies field segments/presence to prospective row values, preserving individual original effects separately.

Two information channels survive here:

- Original scalar/subject field effects remain in `preparedSubjectScalarEffects` and `framedScalarEffects`889–896 and are later published with their original before/after/path at1235–1269.
- Actual structural installation receives a full `preparedSubject.value`: restore/fresh-add at1015–1053, prepared rekey1085–1106. These signatures carry lifetime/key/anchors but not a field footprint or ordinary/physical pair.

Installation1156 onward commits scalar/removal/fresh/restore/rekey plans before publication, retaining order policies. Complete publication of original field effects cannot by itself correct an ordinary baseline wrongly installed from full prepared physical value. Conversely, missing explicit footprint in a full restoration target does not establish a failure when whole lifetime value is legitimately authorized. This is an **unexecuted scope/authority risk** for later structural migration, not the current minimal-S3 recurrence. No semantics of inspection-created/restored lifetime selected.

## Complete collection target

`lib/internals/causal-runtime/target-transition.ts:960–995` applies each value effect to the collection target using subjectFieldSegments and fieldPresence; empty fieldPath replaces row, otherwise a field is modified/deleted. Resulting target stores subject/value/order, not the operation footprint that produced each row. `lib/physical/prepare-entity-target.ts:47–159` compares current physical subjects to full proposed target, builds structure/value plans and physical before/after publications. Install166–181 applies structure, values and selection; publishOrder183 and publish188 follow complete-target installation. `target-transition.ts:120–141` installs all prepared targets before order publication and callbacks.

Candidate `EntityValueStore.installPreparedTargetValues` replaces retained values but does not reconcile `inspectionBaselines`; production has no such baseline map. Therefore a **source-only stale-baseline risk** exists under candidate full-target realization until that route is specified and tested. This is S4, explicitly later/unmigrated, not evidence to invoke recurrence for the already-covered point repair. The physical target's all-members nature does not independently grant ordinary authority over inspected siblings; required authority must come from the selected operation contract. No new executable claim made here.

## Direct/fallback field path as control

Effect execution elsewhere retains explicit subjectFieldSegments (`tree-realization-adapter.ts:1480–1514`), resolving held row then field update/removal/full replacement based on effect scope. The earlier row-only public control keeps untouched inspection authority. This explains why testing only field rollback did not exercise the failed conversion seam; it does not prove all fallback paths safe.

## Inventory conclusion

The proven recurrence is one exact conversion: partial row reversal -> full physical point target -> ordinary whole-row installation. Sibling planners variously retain original effects beside prepared full values or preserve explicit membership separately. Those facts identify where further evidence is necessary, without making them all failures or authorizing successor patches. Current production semantics, rejected candidate behavior, and unexecuted migration risks must remain separate.
