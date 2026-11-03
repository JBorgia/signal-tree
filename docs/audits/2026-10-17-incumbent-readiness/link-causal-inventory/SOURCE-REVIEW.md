# Read-only causal inventory: source identity, projection and adoption

Scope: frozen private qualification implementation, no patch or replay. Native source anchors are relative to `/Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree`; private anchors to `/private/tmp/link-qualification-entities`. Existing evidence reused: `payload.log`, `baseline-fields.log`, `first-traces.json`, `aggregate-*-final.log`, `restoration-*.log`. Independent review interpretation below does not confer production acceptance.

## 1. Native source resolution already has the necessary identity distinctions

**Proven source facts:**
- `packages/kernel/src/lib/link.ts:270–280`: resolve `getEntityLocationBinding(x)` separately from ordinary address. Entity-backed scalar is recognized by native Link; it is not an unknown/unregistered target.
- `lib/internals/entity-projection-seed.ts:47–72`: binding contains collection owner PositionId, subjectId and optional fieldKey. It contains no row values.
- `lib/entity-signal.ts:2120–2145`: held row resolves a subject handle through structural store; inactive returns undefined. Current storage key is read through subject activation, not captured forever.
- `entity-signal.ts:2172–2220`: row/field binds `{owner,subjectId,fieldKey}`; field read derives from entity; write looks up active lifetime and delegates to updateOne. Missing lifetime throws. A different lifetime later using the same key is not followed.
- `link.ts:590–633`: native delivery ignores valueless pings; entity projection validates owner+subject, rejects inspection, ignores rekey, requires authored field footprint and extracts field from captured complete row. It never treats arbitrary notification value as scalar payload.
- `entity-lifetime-ledger-null.spec.ts:50–80`: held row and field remain absent through fresh same-key recreation. `entity-active-prepend-changeid.spec.ts:167` onward pins retained identity through rekey.

**Evidence:** Baseline field9 publishes numeric9; inspection99 publishes nothing. Frozen candidate accepts that field, returns started receipt, and sends actual undefined (typed `payload.log`), physical read stays9. Same-key held-reference control passes; no evidence permits relaxing lifetime rules.

## 2. Private helper collapses source distinctions before publication

**Proven source facts:**
- `loader.mjs:55`: declaration passes only registry.id and first owned position (or -1), not entity subject/field binding.
- `private.ts:33–53`: annotate/completed/latest use string treeId:firstPosition; no subject, field, operation kind or mutation footprint. Ordinary collection pings are admitted as receipt facts. Input payload stays raw notification value.
- `loader.mjs:61–62`: capture stamps PathNotifier and completes every batch entry before native subscriber interpretation.
- `loader.mjs:43–46`: refresh directly writes `eligible=receipt.payload as T`, independently of native entity projection. Type assertion does not validate semantic type.
- Native entity notifications carry whole row and collection position (`entity-signal.ts:2857`), while entity field metadata exposes that same collection position (`entity-signal.ts:2232` vicinity). Other collection pings carry no value. Therefore last receipt can represent a whole row or undefined, not the linked field.

**Causal conclusion:** The failure is lossy source identity plus wrong projection boundary. Merely adding subject/field to the key is necessary but insufficient: pings, participation, footprint, removal, rekey and equal value with new responsibility still require native semantic interpretation before a payload ticket is eligible. Conversely simply reading current field value would reintroduce inspection contamination and reentry races.

The full helper also sends original eligible rows after inspection-only aggregate work; baseline and adoption-only do not. `mode(false)` bypasses admission but leaves refresh/dirty changes. This belongs to helper integration, not scalar adoption storage.

## 3. Entity adoption takes a different storage admission route

**Proven source facts:**
- `entity-signal.ts:2199–2208`: scalar-looking entity field setter calls collection updateOne, not scalar slot runtime.
- `entity-signal.ts:2818–2853`: updateOne runs interceptors, spreads displayed entity with changed fields and commits existing subject value.
- `entity-signal.ts:1217–1239`: existing-subject path prepares entity responsibility using `valueStore.backingForSubject(subjectId)` as before, installs row and prepared record, emits committed capture, advances physical clock. It already has a preinstallation responsibility seam, but that before is physical inspected row.
- `entity-signal.ts:1190–1215`: source explicitly documents separate existing-subject fast path and frame path; both value-store operations and revision locations must be considered.
- Frozen patch `patch.mjs:3–25` retains inspectionBaseline by scalar slot; it never transforms entity value store/entity responsibility preparation. Entity field projection consequently bypasses adoption baseline tracking entirely.

**Evidence:** Field7 -> inspection99 -> transact(field99) records zero changes; rollback leaves99. The owner's scalar adoption contract expects ordinary7 restoration. This is missing production storage coverage, not a field Link API syntax defect. Native same-key held reference safety still passes, and ordinary aggregate undo/redo passes; these cannot qualify adoption.

## 4. Proposed shared seams (design inference, not implemented proof)

A common operation lifecycle can *represent* these facts using existing native identities and contracts. It cannot be implemented as a universal raw PathNotifier ticket keyed by position alone.

1. Resolve a source to a typed internal identity: ordinary location; entity lifetime plus field; or collection projection. Bind the declaration to connection/source revision, not mutable key spelling. Existing native metadata supplies these distinctions; no new public API is required to name them.
2. At supported storage admission, capture responsibility separately from displayed equality. Ordinary scalar and existing-subject/frame entity installers must supply their correctly participating before/after facts. The semantic rule is shared; storage-specific paired installation remains explicit. Shadow facts for inspection should be lifetime/field scoped and reclaimed when discharged, superseded or no live obligation remains. Key changes must never retarget them to another lifetime.
3. Let the same native participation/projection logic produce an immutable eligible payload revision and source-qualified responsibility revision together. Responsibility-only ABA updates can refresh that revision without native value emission. Valueless pings invalidate/cache-wake only; they cannot mint a payload revision. A completed operation receipt must identify what native projection it actually advanced.
4. Keep validation, declaration outcome and delivery state distinct. Source removal/replacement, rekey and subsequent updates invalidate or advance only matching lifetime tickets; a disposed connection cannot retain publication authority. Restoration reactivation of the same lifetime differs from a new same-key lifetime.

This is a representation correction plus entity-admission implementation, not a new ownership architecture or policy. However the existing private helper must be replaced at these boundaries, not extended with `if entity then reread` exceptions. A common lifecycle is plausible because required identities and prepared capture seams exist; its correctness/sparsity/reclamation are not established by this inventory.

## 5. Finite unchanged acceptance discriminators for any later authorized patch

- Typed entity field source9 publishes number9; dependent reject publishes surviving field truth; inspection alone never starts a send.
- Same collection: independently declared a.n must not authorize b.n or another field on a. Same position, different subject/field is the discriminator missing from current capture.
- Rekey retains lifetime ticket; remove/re-add same key does not retarget; stale held-field write rejects without new-lifetime mutation; removal/restore same lifetime follows existing restoration rule.
- Inspection field99 adoption and rollback restore ordinary7 physically and durably; genuine ordinary99->99 remains no-op; equal incoming realization discharges baseline; updateOne/replaceOne/frame routes agree.
- Original ABA/nested-validation/delivery controls unchanged; no forced value notifications, physical inspection reread, blanket inspection suppression, safe-refusal substitution or aggregate-declaration scope expansion.
- Native aggregate16, adoption-only16 and true restoration undo/redo remain separate controls. Full helper presently fails an aggregate compatibility assertion despite no aggregate declaration use.

No new tests run for this inventory; source inspection and previously frozen executable evidence only. No production edits or broader qualification.
