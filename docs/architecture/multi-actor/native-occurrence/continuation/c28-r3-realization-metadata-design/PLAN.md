# Private realization admission metadata — bounded design

Design only; no implementation or executions. Source: frozen state-repair candidate manifest b528cc06421748f41b570e45ad841786c565dece483cd306922a0e77b49a21b7, over R3 e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3. Runtime patch d82886f6eea6aa5b8f5036f43197d321e6b4817c2079ca6ad1e0feaba119f645. Relevant paths below are relative to its candidate/packages/kernel/src. The held candidate's 65-pass/1-fail result and baseline passing history case remain unchanged evidence, not acceptance.

## Required distinction

Classify each adapter-owned scalar realization at pre-install terminal/native ownership admission, without rebinding getActiveWriteContext during equality, preparation callbacks, validation, installation or notifications. Preserve origin, transaction identity, actual native dependencies, shared validation and explicit existing publication metadata. An unrelated reentrant write is a separate operation even when it targets the same leaf.

lib/undoable.ts:65: “It cannot promote a write that is not authored.” Adapter-owned realized writes stay outside authored history. This does not authorize classifying unrelated callback writes as realized. Keep the unchanged stale heterogeneous test's history baseline+1, surviving `other`, untouched target values/membership, refusal and notification assertions. Do not alter undoable to force authorship: that would incorrectly promote genuine external realization.

## Proposed private data path

Use one optional internal preparation classification, e.g. `admissionParticipation?: 'realized'`. This is a proposed name, not a public WriteMetadata field or a new endpoint/permission. Absence retains all existing behavior. No general arbitrary metadata override, SDK field, registry, listener or persistent leaf flag.

1. At adapter-owned scalar frame preparation, supply the flag explicitly in that frame's prepareCommit options. This describes the frame's staged operations, not the call stack. The frame closes before source preparation; a nested frame/direct setter gets no flag unless independently supplied by its own realization producer.
2. Thread the option through the private tree-facing frame port and BOTH neutral and native frame orchestrators into the scalar slot frame/prepareSlots. Do not use withWriteContext. Equality must run under the unchanged caller context. The flag does not alter equality or physical/ordinary inspection bookkeeping.
3. When prepareSlots constructs each IntrinsicMutation, attach the flag to that mutation before passing the same attempt to prepareScalarSourceTerminal and prepareScalarSourcePublication. The latter spread must preserve it alongside preparedTerminal, predecessor chain and deferred finalization. This gives the actual selected attempt immutable classification. A callback creating another mutation cannot inherit it.
4. Terminal producer ingress must pass explicit effective admission metadata to its existing producer: derive the usual active metadata and mutation intent, overriding only participation for this flagged mutation. Do not install the derived object as ambient context. Existing terminal guards then skip authored journal creation for the realized attempt. Preserve owner/path/position/subject and origin fields. Current ingress is intercept-leaf-signals.ts:160–162. If the separately reviewed dynamic provider replaces this ingress, the new common delegate must preserve this exact operation-local rule; do not depend on an unaccepted sibling implementation.
5. transactions.ts:2877 scalar-selection callback must use the same mutation-local effective participation for its authored-ownership guard. Otherwise the terminal correctly omits an authored record but selection still requires scalarAdmission and throws. Nonchanged endpoint policy remains unchanged. Do not short-circuit all publication, or manufacture scalarAdmission for realized writes.
6. Keep native requirement construction intact. private.ts nativeAuthorship(:145–149) derives owner/unknown from transaction identity and origin, not participation; it must still see those existing facts. No blanket exclusion of actual native inputs, owner support or validation. The flag is not an instruction to clear native ownership or choose a compensation endpoint. Native inspection detection remains its existing ambient classification; this bounded correction does not define a new realized-within-inspection policy.
7. Remove only the newly introduced whole-apply wrapper. Retain explicit per-effect realized notification metadata, existing per-effect fallback scopes, revision checks, phase ordering and detached completion/error draining. Keep the separate realized-evidence dedup correction. Do not broaden this into a rewrite of established fallback callback semantics.

The option needs no persistent allocation beyond the existing options/mutation objects. It must not be stored in installed native proof, on source objects, or in the result's long-lived support. No performance claim. If the implementation requires a helper to derive effective metadata, keep it internal and pure; ordinary writes should not acquire an unnecessary new metadata copy.

## Producer and transport inventory

| Source path | Role / bounded action |
| --- | --- |
| internals/causal-runtime/tree-realization-adapter.ts:1831 | planScalarFrame: explicit realized preparation, regardless of fieldEndpoints presence. |
| same :1616 | planHeterogeneousFrame scalar frame: explicit realized preparation. Its scalars may represent prepared subjects as well as ordinary roots; classify the actual staged frame, not only leaf keys present in an endpoint map. Entity plans retain their existing metadata. |
| same :848 | prepareSelectedOperation scalar frame: same flag; retain exact endpoint restoration via prepareWithScalarSelections. |
| same :1049–1052 | preparePointRealization scalar frame: same classification if included in successor scope; do not leave an accidentally unclassified parallel scalar producer. |
| plain-branch-membership.ts:1117–1120 | Member realization stages a scalar frame separately, sometimes before adapter `apply`. Must be inventoried explicitly; do not claim the whole-apply wrapper ever covered this. An optional private argument can forward classification from adapter callers (:617, :908, :1041). Preserve default for other callers. |
| transactions.ts:3622; restoration.ts:3167 | Other callers of preparePlainBranchMembers. Existing compensation/restoration producers; inspect their context before propagating or defaulting new metadata. No blanket default on a generic scalar frame. They are adjacent qualification, not evidence the original two failures require an entity redesign. |
| tree-scalar-slot-port.ts:26–38 | Internal tree-facing frame prepare options. No root/adapter barrel export found for this frame type in inspected sources. |
| tree-scalar-leaf-runtime.ts:108–117 | Neutral orchestrator manually rebuilds options; must explicitly forward new field. |
| native-tree-scalar-leaf-runtime.ts:123–132 | Native orchestrator also manually rebuilds options; same forwarding required. |
| tree-scalar-slot-runtime.ts:48, :99, :123–127, :205–227 | Internal substrate option types/callback and prepareSlots mutation creation. Preserve stale checks and equality before admission. |
| intrinsic-mutation.ts:70–82, :433–441 | Private mutation carrier and source dispatch; pass field to the exact mutation, no ambient wrapper. |
| intercept-leaf-signals.ts:160–162; transactions.ts:4231–4320 | Terminal producer ingress and unchanged detached journal construction/guards. |
| transactions.ts:2877–2895 | Native scalar ownership selection consumer. |
| experimental-publication/private.ts:145–190 | Native authorship, inspection and endpoint selection; preserve proof logic and actual input. |

Direct setter/update paths in location-runtime and native-tree-scalar-leaf-runtime produce ordinary mutations without the option and keep their semantics. Existing applyEffect (:1988 onward) scopes per-effect realization already; changing that is outside this correction. Native entity packet preparation (experimental-publication/entity.ts:99–105) uses packet inspection plus ambient identity/origin; it does not need a scalar flag. Do not add the flag to entity packets, members' authority or structural permissions merely because a heterogeneous frame contains them.

## Why not extend withScalarSelections?

native-scalar-selection.ts:9–11 is a synchronous, finally-restored map from leaf identity to selected compensation endpoint. Adapter prepareWithScalarSelections (:821–824) fills it only when an effect has a field endpoint. Thus:

- Endpoint absence is not proof of authored participation; the failing ordinary realization may have no endpoint.
- Existing map lifetime encloses prepareCommit and callbacks. Classifying by leaf membership could misclassify a reentrant ordinary write to the SAME leaf, even if another-leaf case passes.
- Restoring the map in finally prevents escape but does not distinguish two attempts within its lifetime.
- A narrower ambient WriteContext wrapper around prepareCommit retains the original injected failure: the wrapper runs before the private injected preparation callback and before equality.

Retain the existing endpoint hook unchanged for its existing job. Pass classification explicitly on the frame's prepared mutation. This avoids taking a position on broader endpoint-hook reentry semantics. If a future implementation proposes consuming an ambient token, it must bind it to the exact frame/attempt before callbacks; a leaf-keyed flag alone is insufficient and adds complexity not required by this design.

## Required finite discrimination

1. Unchanged history counterexample on exact repaired successor: preparation injection writes `other` once, target refused, unrelated history +1, no target notification. Preserve original failure logs and assertions.
2. Original A/authored, B/realized, C/authored nested case plus both ABA scheduler variants: B survives outer rollback; A/C behave as original oracle; realized external evidence not discarded by authored dedup.
3. Internal read-only observer of prepared mutations: actual frame attempt carries realized classification; injected callback sees the original getActiveWriteContext and its separate mutation has no flag. Include same-source reentry to distinguish an explicit attempt from a leaf-keyed ambient shortcut. Preserve existing stale/reentry refusal, not a new permissive commit oracle.
4. One neutral and one native facade frame regression exercise forwarding; all metadata/return/error assertions exact. Same callback throw and subsequent useful authored write must prove no classification leak and no duplicate journal entry.
5. Selected endpoint counterweight retains actual destination/input/validation support and useful completion; no early send while genuine owner remains pending. An unchanged authored direct-set dedup control remains necessary.
6. Types: source/spec plus public declaration surface comparison. No new exported type/SDK field. Inventory options forwarding before tests; a native-only omission would compile in some shapes while silently losing classification.

Implementation scope decision: the minimum direct repair is scalar and heterogeneous prepared admissions. The parallel selected/point/member scalar producers above must be either explicitly covered with the same private metadata or named as unchanged, separately qualified routes; do not announce universal realization coverage from the two original passing cases. No public-only history regression has been executed here. Payload-getter public reachability remains a separate finite falsifier, not authority to weaken the private history test.
