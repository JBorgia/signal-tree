# Selected-install extraction feasibility — source review

Read-only review of `/private/tmp/link-a1-successor-experiment`. No runtime change or test/model execution for this finding. This is not implementation acceptance. The selected-effect planner remains authoritative; the proposal below only prepares its already-selected execution before delivery.

## Existing pieces and exact limitation

| Existing piece | It already supplies | It does not supply |
| --- | --- | --- |
| `tree-realization-adapter.ts:159–280`, `PreparedRealizationContext` | Collection-node-scoped subject values, current keys, reachability and occupancy overrides; distinguishes identical lifetime IDs in distinct collections | Ordered adjacency; a frame prepared against this context still reads live placement |
| adapter `buildPreparedRealizationContext` and `planningPreparedContext` (`969–1033`) | Sequential validation/value composition and effective removal keys, without live installation | A callback-free per-collection native install packet |
| adapter `orderPhysicalPlacements` (`2751+`), caller `1139–1150` | Existing placement dependency ordering, including lifetimes restored by the same unit and anchors removed by it | Native resolved restore placements; do not replace its ordering with a second dependency resolver |
| `EntityPlacementStage` (`physical/entity-placement-stage.ts`) | Sparse overlay on live P adjacency, reciprocal edge edits, head/tail, insert/remove/rekey/order | Key occupancy index and lifetime restore eligibility; `insert` normalizes missing anchors but is not an authority selector |
| `StructuralStore.preparePlacement` (`95–101`) | Correct native base P adjacency and head/tail | A frozen base: final unit must validate the source revision after all callback-capable preparation |
| `EntityMutationFrame.preparePlacement` (`144–239`) | Frame instructions and final adjacency/order endpoints before commit | Shared prospective base: it creates two live-store stages, and `prepareCommitInstructions` resolves every restoration against live store (`416–445`) |
| `planHeterogeneousFrame` (`937+`) | Exact physical execution order and separately selected ordinary plans (`1380–1415`) | Its current structural `plan.commit()` invokes rich capture and native updates before later live-point/O installs (`1447–1462`) |

Consequently **pre-calling each existing structural plan's commit preparation is invalid**. Example: first restore recreates the successor needed by a later restore; both preparations against the original live store append the later row to the wrong end. Occupied-key handoff likewise needs the already-proved prepared occupancy, not a newly weakened live check. No new policy is needed to avoid this: use the existing selected order/context plus one shared per-collection placement stage.

## Minimum private extraction

1. Keep `PreparedRealizationContext` as the existing scoped value/occupancy oracle. Associate a single transient placement stage with each resolved collection node for this selected unit. Construct it from the collection's own `StructuralStore.preparePlacement`; never from a Link projection or final payload list.
2. Add a private preparation argument to the source structural planners/frame, conceptually `{ placement: EntityPlacementStage<K>; resolveSubjectValue(subject): unknown; resolveOccupancy(key): number | vacant | undefined }`. Exact naming is not material; the implementation must reuse the context's existing ownership scope. A read-only context result must not be mistaken for instructions to mutate its final-key map out of sequence.
3. Iterate the **same selected execution sequence currently installed**: all planned removals; `orderPhysicalPlacements` results (restores/fresh adds/placement-bearing transfers); non-placement transfers; live-point values; selected ordinary plans. Prepare each structural instruction against the shared stage after preceding instructions have updated it. Use the existing effective removal keys and vacating-key evidence. Refuse before any live installation when an occupied destination is not vacated by the selected unit.
4. Make restore resolution a shared private source primitive accepting a placement reader/head/tail. It must preserve current successor-first behavior: use an available successor's actual predecessor; otherwise available predecessor's actual successor; otherwise prepared tail. Do not introduce bracket refusal, historical-neighbor ownership or chronological replay. `StructuralStore.resolveSubjectRestorePlacement` currently returns historical `beforeSubject` when both anchors are ordered, but `restoreSubjectAtResolvedPlacement` always inserts immediately before the successor; a stage-normalized adjacent predecessor gives the same physical result. Preserve capture's authored/support distinction rather than treating this normalization as authored neighbor responsibility.
5. Save resolved instructions and source P/O intervals once. `EntityMutationFrame` installation consumes those instructions without calling `resolveSubjectRestorePlacement` again. Values, minimum responsibility, paired topology, publication records and rich record payloads are all prepared before install; they may not reread rows after the first external callback.
6. Split the existing source result into `install` (owned native primitives + minimum/private records), `deliverCapture`, `invalidate`, and existing row/order/path/tap delivery. The complete heterogeneous owner installs **all** collection/scalar/member/O/selection facts and records first, then delivers rich capture, invalidation and public delivery with established first-error containment. Ordinary standalone authoring methods keep their existing wrapper/partial-success timing. Do not batch an arbitrary transaction or swallow callback-authored new operations under an ambient suppression flag.

This uses one transient adjacency preparation object and the existing occupancy/value simulator; it is not another settlement engine or canonical state mirror. Point edits touch their patch/dependencies. Explicit full-order output can enumerate its specified domain. A private prepared-stage hook is necessary because neither current `CollectionNode` nor `PhysicalPlan` exposes the source stage; this is internal extraction plumbing, not a public API.

## Selection and callback boundary

`planPreparedRekey` (`entity-signal.ts:1700–1770`) currently checks/sets active selection **after** `commitAndProjectEntityMutationFrame`, whose rich observer already ran. Moving rich delivery later must put the selection consequence inside the complete selected unit, before callback delivery. Derive it from the selected lifetime's prepared key mapping; do not overwrite a callback-authored later selection.

The existing target source documents the governing rule at `physical/prepare-entity-target.ts:190–200`: selection is a current key choice, follows its selected surviving lifetime through rekey, and preserves the selected key when that lifetime is absent/removed. Structural `planRemove` does not clear activeId; this extraction must not invent such clearing. `clear()`'s explicit selection reset is a different ordinary writer.

`replaceLocation(activeIdSignal, target)` is **not itself a proven pure primitive**: `location-runtime.ts:createWritable` runs intrinsic capture and publication preparation/completion, and `publish` groups only its dependency delivery. The private extraction therefore needs either (a) a source-owned prepared internal-cell write/install/publish split, or (b) a verified existing cell path with no observer/preparer and a containing invalidation group. Option (b) cannot be assumed merely because activeId is exposed read-only. A narrow internal-cell preparation capability is phase extraction, not new selection authority, but must be included in the implementation inventory; leaving the setter after capture fails the requirement.

Similarly `publishSubjectPhysicalChange`, `syncEntitySignal`, `tombstoneSubjectSignal`, `updateSignals`, membership taps, epoch publication and reclamation are not part of a pure install by naming convention. Prepare required node/index changes beforehand; defer callback-capable work until all source records are installed. Keep live recovery claims until existing terminality rules permit reclamation.

## Existing unchanged discriminators to preserve

- `tree-realization-adapter.spec.ts:1190`: restore then rekey against prepared subject state.
- `:1310`: later stale field makes restore/rekey preparation side-effect free.
- `:1435`: occupied destination refusal.
- `:1523`: remove→restore→rekey with prepared vacancy overriding live occupancy.
- `:1793`: competing prepared restores block later rekey without installation.
- `:1941`: remove→restore→rekey→field as one coherent prepared turn.
- `:2236` sequence: removed/competing anchors and multiple restorations.
- Existing `order-composition-readiness`, transient add/remove/re-add and owner-approved successor policy assertions remain unchanged; this extraction cannot make all plans prepare by deleting successor validation or granting incidental anchors authority.
- The separately preregistered early rich-capture witness must see both fully restored collections before it writes a777, then retain that newer value. Its listener is a private controlled extension seam; the unchanged public tap/default-Link witness remains a separate delivery control.

## Boundary verdict

The missing capability is concrete: **source-owned shared-stage preparation plus pure install/result delivery extraction**, not another inverse policy. The existing context/stage contain the required categories of facts, but the current method signatures do not yet implement the combination. This is feasible source evidence, not an executed proof. A proposal that instead introduces another topology dependency sorter, reselects effects from the final stage, derives O from P, or needs a collection-wide snapshot for a point inverse crosses beyond this mechanical extraction and requires a new scope decision. No runtime work is authorized merely by this document.
