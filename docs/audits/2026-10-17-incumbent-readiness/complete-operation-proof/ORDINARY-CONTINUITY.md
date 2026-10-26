# Ordinary continuity through existing shared capture vocabulary

Independent read-only October26 at frozen f01ed39a. Consulted complete-operation-design-review/DESIGN-REVIEWED-DRAFT and source, no other new reviews. No models/tests/native edits/API selection.

## Existing fields and first omission

mutation-capture-runtime.ts CollectionOrderCapture has P before/after subjects/frontiers plus optional ordinaryEndpoints before/after/domain; CommittedEntityCapture has changes and optional P structuralFrontier/structuralRecords. These are separate views already carried through one runtime, not a second journal.

restoration/order-boundary-evidence.ts OrderBoundaryEvidence contains one before/after token pair and one records array. completeOrderCapture indexes P token intervals and extends P endpoints; spread preserves optional ordinaryEndpoints unchanged. restoration.ts4780–4812 accepts only structuralFrontier+records and excludes inspection/restoration/compensation. Source can author O-only presence during field adoption without P structural interval, so a simple 'also extend O arrays using these same P intervals' is insufficient.

## Proposed minimum private facts, not selected syntax

Extend the existing completed source capture/boundary carrier to distinguish:
- Stable collection identity and immutable installed-operation identity/sequence, separate from transaction owner/designation/participation.
- P before/after continuity tokens and P placement records (existing).
- O before/after continuity tokens and O presence/key/placement records with lifetime identity and exact before/after neighbors; explicit absence differs from missing evidence. Value-free placement records, existing value changes remain payload authority.
- O explicit full/subset order endpoint/domain when operation actually authors order. Ordinary neutral operation has certified unchanged O token, not assumed missing evidence. Physical-only inspection changes P but keeps O continuity; O-only adoption changes O without requiring P membership transition.
- Scope metadata continues to decide admission/authority. Sequence indexes order installed facts, never decides whose contributions rejection may erase.

Tokens need per-domain source provenance; reusing physical frontier as O proof would reconnect unrelated intervals after inspection. No payload snapshot/mirror required by these fields. Captured O facts must come from source owner's staged state before installation, not current display after callback.

## S1–S6 mapping

S1 direct commitExistingSubjectValue: prepareOrdinaryTopology already creates explicit O add/remove/displacement facts on necessary-existence adoption despite physical value-only edit. Supply completed O interval from that staged plan; P can certify topology-neutral. preparePointValues existing-lifetime selected edits need only O field/value unless approved source plan explicitly changes presence. P/O equality is not evidence that admission is empty.

S2 frame: entity-signal.ts1186 physicalPlacement,1205 ordinaryPlan;1240–1275 prepares responsibility, checks revision, installs both and returns O/P endpoint facts. Ordinary before/after links are available before commit in placement patch and byStep changes. Derive O boundary here with full final prepend/setAll placement before first delivery; don't derive after emitTap.

S3 selected point realization: prepareOrdinaryRealization620–850 stages O presence/key/field and placement; supplied physicalAfter separately determines P. O-only inverse changes must certify source continuity even if P unchanged. Existing authority selects inverse; recording interval must not create new authored history.

S4 complete target: physical/prepare-entity-target prepares P target and invokes source prepareOrdinaryRealization with admittedEffects/order. Same completed record can carry separate tokens/records; source must validate that O order domain matches O membership after selected effects. No use of target.order as O default.

S5 lifetime/key restore: frame restore/transfer consumes source ordinary inverse, returns paired facts as S2/S3. Lifetime identities, successor policy and physical99/ordinary7 separation persist. Key-only operation need not imply O order change, but occupied destination/displacement must be explicit.

S6 retirement: absence of semantic transition does not mint continuity interval; maintenance cannot silently delete current O identity/edge obligation. Existing claims protect historical restoration. Keep source truth and optional history retention separate; tokens alone do not retain payload authority.

## Concrete missing-fact counterexamples

1. OABC; inspect removeB (P AC); own field adoption of inspection-createdX can change O membership while physical structuralFrontier absent. Existing restoration boundary filter drops this O-only transition. Later explicit order cannot safely extend through it from P tokens.
2. Existing unchanged addw→prependc turn: ordinary prepend-before includesw; whole-turn undo removesw. O membership interval preceding explicit order must compose inverse endpoint before validation, not merely filter absentw afterward.
3. Callback outerprependC completedCAB; callbackprependD→DCAB. Both same owner/turn possible, distinct operation identities/tokens mandatory. If outer endpoint filled at callback return it acquires D accidentally.
4. Inspection-only full reorder updates P token while O unchanged. Matching O token must bridge this only as an O-neutral event, not import inspection's records. Foreign realized O order must remain foreign and trigger approved atomic interference refusal as appropriate.

## Feasibility conclusion and bounds

Existing shared capture vocabulary is extensible enough in principle to carry both ordinary continuity and physical continuity without a second **operation journal**, provided the single source boundary subscriber retains ordered immutable evidence for both domains. Existing fields alone are not sufficient: O-only interval and O-domain tokens are missing. This is a private carrier extension requiring reviewed mapping at every source installation lane, not a zero-change reuse of OrderBoundaryEvidence.

Whether history indexes shared events or keeps a bounded bucket array is storage choice; it must not introduce another authoritative replay engine. Membership/order composition must preserve authored ordering/dependencies and lifetime policy, not give token-contiguity authority to erase foreign truth. These source findings support a design hypothesis only. A model passing does not authorize runtime work; unchanged native failures and recurrence review remain mandatory gates.

## Source-premise correction: existing records are not uniformly physical

Verified frozen entity-signal.ts1254–1260 passes **ordinaryPlan.changes** as preparedChanges into committedEntityObserver. Lines1982–1992 strip payload from those structuralRecord entries when structuralFrontier exists. Therefore current structuralRecords are carried under a **physical** frontier interval but ordinarily derived from prepared ordinary mutations. Earlier wording above calling them uniformly P records was overbroad; retain this correction explicitly. A physical token plus ordinary record array is itself an unlabelled view pairing and cannot be assumed physical continuity evidence after divergence.

Inspection branch prepareOrdinaryTopology939–948 preserves ordinary placement yet pushes original physical change into returned changes. Thus even name ordinaryPlan.changes is not a uniform semantic-view certificate: inspection returns physical observation records while ordinary state is unchanged. Existing history boundary subscriber excludes inspection, but source carrier remains mixed by participation.

Correct design constraint: derive explicit P records from actual prepared physical instructions/placement, O records from actual ordinary placement transition, with separately certified token pairs; participation filtering determines allowed consumers, not implicit reinterpretation of one array. No second journal follows, but merely adding an O frontier beside the existing array without view separation would preserve the ambiguity. This correction strengthens the missing-view mapping requirement; no runtime/model/test performed.
