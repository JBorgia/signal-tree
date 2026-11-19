# Source-owned footprint and completed selection successor — DESIGN ONLY

Status: proposed private mechanism, frozen for Faraday quick mechanism review. Contract adjudication now preserves the original whole-authored restoration expectation without new policy; mechanism acceptance is still pending. No runtime or fixture changes authorized by this record. Root checkout and frozen predecessor remain untouched. Source: `/private/tmp/st-occurrence-successor`, source-manifest SHA256 `80a0116269b26af939f775b9a10ff8a79d99b6e9b556a17b05137ab5e3f67502`. Diagnostic evidence: `/private/tmp/st-occurrence-restoration-trace`.

## Critical qualification: scope is not settlement ownership

The trace proves conflicting field scopes: native packet [] versus setAll notification null. It does NOT prove that native responsibility admitted a new ordinary owner. Whole-row intent, physical equality, ordinary authority, rollback obligations, publication input dependencies and a foreign possible-owner window are different facts.

New blocking discriminator: same-tree pending q writes x=7; independent equal setAll literal x=7; reject q. If native settlement still restores x=0, publication must not treat 7 as independent of q. This applies even if a publication callback has complete-row scope or an independent declaration. Conversely, a foreign q possible window is not a native rollback obligation on x; replacing that window under an approved independent declaration need not acquire transaction ownership. Do not transfer the foreign-window result to the same-tree case.

Concrete evidence for caution: transactions.ts:2373 prepares native entity responsibility, and :2442 skips fields with equal before/after value AND presence. entity-signal.ts:1350 supplies ordinaryPlan.changes. Current callback returns only TerminalRecordPlan|undefined (mutation-capture-runtime.ts:112), not a certified ownership disposition. Thus an equal complete row can reach publication preparation without a newly recorded native field effect. A null notification footprint or clean publication requirement cannot fill this missing evidence. This is source inspection, not execution of the new rollback discriminator.

The settled CONTRACT-ADJUDICATION.md preserves the original foreign-q possible-window regression target. The separate same-tree settlement safety qualification remains: loss of explicit footprint is demonstrated; whether replacing field publication support is legal must additionally satisfy the native responsibility/recording contract. Do not fix [] to null and stop.

## One producer result, three distinct dimensions

Introduce a private prepared source-step result at the native value/topology preparation boundary. It pairs:

1. **Operation scope**: whole literal, explicit partial keys, explicitly derived keys, or exact inverse scope. Scope is mandatory at every replacement caller. Equality never supplies a missing classification.
2. **Native disposition**: physical transition; ordinary transition; installed/retained settlement obligations; exact source admission identity. This comes from native preparation/settlement authority, not Link declarations. An unchanged value may retain native obligations even when its permitted publication window changes.
3. **Publication selection**: exact ordinary payload, occurrence/lifetime identity, member/key/order facts, and per-slot native requirements with readiness. It carries declared/consumed input and possible-window roles separately from native destination obligations.

These dimensions share one unit/step identity and one terminal installation. No caller-name branch, setAll exception or recipient-local repair. Native entity publication, ordinary capture/confirmed history, PathNotifier and membership selections consume the same resolved result in their appropriate domains. They do not all become authorship consumers: inspection/inverse and physical-only events retain their existing roles.

Native settlement remains authoritative. A proposed `PreparedResponsibilitySelection` must be issued while the existing responsibility plan is prepared and installed with it; it states exact affected field/lifetime obligations retained or superseded. 'No new effects' is not 'no existing obligations'. With no optional transactions enhancer, the base native source can issue the existing no-settlement-obligation selection; with an installed authority, an absent return cannot be interpreted as a clean certificate. If this seam cannot expose the needed distinction without changing approved settlement/history behavior, the implementation remains blocked on contract adjudication, not rescued by publication-only inference.

Current order prepares publication before responsibility (entity-signal.ts:1323 versus :1350). A coordinated successor must prepare the ordinary/value result and responsibility selection before finalizing its publication certificate, then install their plans together under existing revision guards. This cannot move user getters, interceptors or equality callbacks across existing ordered boundaries. An alternative two-phase binding may reserve the unit first, then bind its responsibility selection before terminal installation; an unbound unit is not completable.

## Exhaustive private contract (illustrative, not implemented or compiled)

Replace optional `authoredFields?: ...` with a required discriminated input. Keep semantic axes orthogonal rather than inventing a public mutation-kind taxonomy.

```ts
type ValueScope =
  | { kind: 'whole' }
  | { kind: 'keys'; keys: readonly string[] }
  | { kind: 'derive'; input: CapturedNativeInput; resolver: PreparedDeriveScope }
  | { kind: 'inverse'; selection: AuthorizedInverseSelection };

type StepParticipation =
  | { kind: 'authoring'; context: CapturedAuthoringContext }
  | { kind: 'inspection'; context: CapturedInspectionContext }
  | { kind: 'realization'; authority: AuthorizedRealizationSelection };

type PreparedReplacement<K, E> = {
  kind: 'replace-value'; key: K; subjectId: number; nextValue: E;
  scope: ValueScope;
  participation: StepParticipation;
};
```

All capability types above are private source-issued opaque handles with runtime issuer/revision validation; no caller-constructed `independent:true` equivalent. The actual implementation should use existing capture/context types rather than duplicate them. `derive` is deliberately explicit: the existing prepareValueTransition derive resolver stages accessors once and computes its approved changed-field scope. Preserve that algorithm, but return its resolved scope. Value differences are permitted INSIDE that explicitly selected existing derive rule, never as a default for missing caller intent. A partial empty key set stays explicit, not silently promoted to whole.

Resolved step must carry distinct `physical`, `ordinaryEffectsByStep`, `resolvedScope`, `responsibilitySelection`, and `ordinarySelection`. Ordinary effect groups include topology displacement/adoption; they cannot inherit a field mask blindly from an unrelated subject in the initiating replacement. Structural effects remain tagged structural. Do not flatten per-step effects to subject-wide last-writer data or union their scope across different participation.

Compiler enforcement is feasible: required scope/participation on PreparedValueReplacement; no optional overload/default; exhaustive switch with `assertNever`; private brands for completed selections and ownership witnesses; type-negative fixtures for missing scope, passing an inspection unit as ordinary evidence, and completing an unbound selection. Search all references and direct object constructions, including nonproduction tests/benchmarks. Types cannot prove a caller selected the correct union member, a brand was not forged with a cast, or a lifetime is current; runtime issuer checks and behavioral tests remain mandatory. No public exports/types changed or weakened. No compile claim is made for this design sketch.

## Full frame caller inventory

All production frame replacement constructors found in frozen packages are in entity-signal.ts. FRAME-CALLERS.txt records the search. Line numbers are frozen-source positions.

| Site | Current scope | Required classification and constraint |
| --- | --- | --- |
| :1801 planPreparedRekey, only with placement and unequal backing | omitted | Inverse/realization selection supplied by tree-realization-adapter.ts:1310. Preserve options.publication==='physical' and exact prepared subject/placement authority. Pure public rekey has no row replacement. Do not infer whole ordinary adoption from its complete physical row. |
| :2619 batched add/prepend overwrite | omitted | Whole intercepted replacement for existing subject; fresh subjects remain structural adds. Classify each admitted copy/step under current dedup/interceptor semantics; do not change repeated-key ordering or final-value policy. Explicit derive context, if valid on this path, must retain captured consumption rather than silently becoming a literal. |
| :3806 replaceOne / callable byId | null or 'derive' already supplied | Preserve consumed callable intent precedence. Whole literal versus explicit derived resolver; return resolved scope once. Inspector/transformed getters evaluated once at existing boundary. |
| :3914 updateMany | transformed Object.keys already supplied | Exact per-row transformed partial keys, including equal assignments/presence changes; inherited sibling values outside these keys remain outside authorship. Capture existing ambient consumed-input scopes separately. |
| :4283 upsertMany existing rows | union of transformed partial keys already supplied | Exact merged supplied keys per existing row as current duplicate-copy semantics define. Newly added rows are separate structural units. Do not turn merged physical row into whole authorship. |
| :4680 setAll existing rows | omitted | Whole replacement for each existing incoming literal row, or explicit approved derive classification; removals/additions/order retain separate scope. Never classify equal rows as order-only. Native ownership still comes from responsibility disposition, not this scope tag. |

Type call sites outside runtime: physical/entity-mutation-frame.spec.ts:105; enhancers/restoration/committed-entity-capture.spec.ts:28,34,92; production-scalar-substrate.benchmark.spec.ts:389,435. These directly stage/commit physical frames. Require explicit fixture intent and retain physical-only test semantics; do not invent ordinary publication authority for the low-level commit fallback. EntityMutationFrame.commit can currently write backing without a prepared value transition (:331); its physical-only route must be explicitly distinguished from a publication-bearing prepared source unit.

Related producers that must join the same result, although not frame replacement constructors:

- Direct updateOne, :3732 -> commitExistingSubjectValue(:2048), supplies transformed partial keys. It must return the same resolved scope/responsibility/selection result as frame operations, without routing point writes through a full frame/collection walk.
- Callable entity field writes and updater wrappers reach direct updateOne/replaceOne. Preserve current native input capture and intent precedence; a wrapper must not turn a derived input into a clean whole literal.
- Point inverse source at :536 uses prepareRealizationTransition and explicit EntityRealizationEdit row/field facts. Complete targets/replay at :855-856 have their own physical/ordinary effect domains. Reuse those facts, never stamp complete physical targets as all ordinary-authored.
- Marker hydration entity-map.ts:371-451 routes through upsertOne or setAll. Both routes must preserve the incoming operation classification. Its reference-skip optimization needs a discriminator: it cannot skip a permitted support transition, but this design does not decide that every equal reference is fresh authorship.
- New member installation and retained path activation require the selection mechanism below. Neither may fabricate clean child requirements.

## Exact selected membership payload: producer composition, not overlay

The observed membership snapshot reads rows.all while its ancestor is hidden and captures []. Removing the recipient's overlay without a producer replacement would publish the wrong payload. The replacement is a **source-issued selection handle**, not an absence-aware read or a new clean snapshot.

Proposed lifecycle:

1. Each native source's completed ordinary selection has exact source/occurrence/lifetime and unit/version identity. It pairs payload with requirement slots and ordinary member/key/order domain. It is derived from existing prepared value/topology facts, not independently mutable state. Initial handles are issued during native construction/materialization, including clean never-omitted ancestors; no cold-enrollment scan of a collection supplies missing authority.
2. A native child operation prepares a successor selection from its previous handle and its ordered ordinary effects. Full setAll can reuse the complete prepared row/order work it already performs; point work edits only touched entries. Inspection prepares physical display only and leaves the ordinary selection handle unchanged. Realization updates only authorized ordinary facts. Untouched contributors and consumed dependencies retain exact identities.
3. The structural write context already coordinating recursiveUpdate receives each **successfully installed child selection** through the producer completion hook. Recursive branch composition returns a private branch-selection handle built from these exact child handles, installed plain-member selections and existing ordinary membership edges. It does not call rows.all(), unwrap physical storage or ask recipients for cached payload. A child handle can retain a collection sequence as an immutable projection node; composition must not expand or scan all rows.
4. `setMemberPresence` receives a required prepared-selection capability for an ordinary present transition. The capability binds parent/key/exact child, child completion frontier, ordinary payload descriptor, exact native support references and membership requirement. Absence uses an explicit absence capability and does not destroy retained child evidence. Branch activation selects the composed supplied value; it cannot select hidden unsupplied siblings. Construction installs an initial child capability; direct leaf path re-add composes only its approved path and sibling omissions; inverse membership uses the authorized inverse selection.
5. Prepare membership responsibility and this selection before descriptor mutation; install them in the same terminal membership unit under existing identity/reentry guards. The capability may reference already-completed child units from this whole write. 'Same completed unit' means the membership unit atomically selects a frozen frontier of those children, NOT that the whole root call becomes an atomic transaction. Existing completed writes survive a later throw exactly as before.
6. Recipients receive one completed selection payload/support pair. They attach/detach exact occurrence contributions incrementally and publish only after selected readiness reductions complete. Delete the recipient collection-overlay loop and its payload reconstruction when this source handoff is proven. No delivery-time membership snapshot, collection enumeration or physical reread is allowed.

Implementation constraint: today the native publication participant retains requirements, not a full ordinary payload selection cache. The proposed source selection handle is therefore real missing machinery, not a rename of ordinaryMemberSnapshot. It should reference immutable prepared row values and existing source topology/versioned sequence nodes, with delta-derived caches owned by the native source. Do not introduce an independent value/settlement authority or duplicate one full collection per recipient. Maintain only current source selection plus handles retained by pending/completing units; release obsolete handles/listeners at supersession/disposal. A linked history of all deltas or a cold 'walk everything to rebuild' fallback is unacceptable.

If existing topology/value representations cannot provide a stable prepared sequence without a new global scan, the selection part is not implementation-ready; report that representation gap rather than claim a getter wrapper satisfies it. Preparing a full payload that was explicitly supplied may traverse that input as existing setAll already does; a one-row write or membership activation may not rescan unrelated collection entries.

Membership ingress inventory: recursiveUpdate's final membership loop (:1303/:1315), setMemberValueApplier(:884), member-membership reactivateOnWrite (:315), direct path re-add loop (:523/:527), and materialize-markers.installPreparedMember(:776). All converge on the same mandatory selection admission. Tests must also cover inverse/inspection use of these paths and reentrant additions. No optional selection argument with a snapshot fallback.

## Installation, cancellation and pending boundaries

Retain existing prepared per-step participation and ordinary topology domain. Use ordinaryPlan.byStep and changeIndexByMutation; don't reconstruct scope by array position after filtering and don't assign a single last aggregate requirement to all steps. A displaced subject's ordinary removal is its own structural evidence. Parent horizon readiness is explicit; completed payload may still carry unfinished requirement identities. Enrollment must not normalize those to initial evidence.

Slot replacement, supersession, aborted preparation and disposal use the existing exact identity cancellation helper. New lifetime at the same key has a new occurrence and source selection. Omitted source selections are retained only for legitimate recovery/reappearance. Pending q consumed into surviving y remains selected even if q's original subtree is omitted.

No runtime successor should begin until Faraday quick review accepts the coordinated mechanism, including same-tree settlement safety, and the source-owned selection representation is finite. Confirmation must select meaning, not merely agree that a test passed. This record grants no change to public semantics, rollback behavior, equality policy, activation or ceilings.

## Settled adjudication and separate competing oracle

`/private/tmp/st-occurrence-independent-review/CONTRACT-ADJUDICATION.md` is copied as an immutable input here. It preserves the exact original immediate-restoration assertion: the literal setter already authors the full row, and old possible-q support must not survive solely because publication dropped its footprint. It does not authorize membership-only clearing or changing native settlement ownership. The same-tree q test remains a blocking falsifier of any overbroad mechanism.

The aggregate wider-ancestor-updater expectation is a different conflict: aggregate-installed-publication.spec.ts:131 expects no delivery, whereas collection-contributor-core.spec.ts:111–122 requires useful surviving {x:1,y:0} delivery. Preserve both exact fixtures and classify that conflict separately; do not treat it as a new footprint recurrence, silently fix either assertion, or claim a fully green aggregate contract suite.

Fixture typing is a separate, already supplied artifact: `/private/tmp/st-fixture-types-aj63tgdb/fixture-only.patch`. A future disposable successor may apply it only after preserving predecessor spec diagnostics and verifying the supplied before/after emitted-byte claim. It changes no runtime mechanism or assertion. This design freeze includes the patch and original error log as inputs; neither patch nor runtime has been applied.
