# Selected entity installation boundary: independent source review

## Finding

Current source has reusable callback-free storage primitives and the existing selection/planning authority. It does **not** expose a complete callback-free structural selected-unit installation path that the coordinator can simply call today. In particular, structural `commit()` is still a combined prepare/install/rich-capture/native-invalidation operation. The preserved private witness demonstrates that it delivers an earlier constituent before the selected mixed inverse is fully installed.

Separating those phases for the already selected settlement unit preserves the approved atomicity requirement. It does not require a new inverse selector, a second topology authority, or whole-method atomicity for ordinary partial writers. However, it is more than renaming `commit` to `install`: prospective placement, paired ordinary facts, minimal responsibility, preparation failures and signal side effects must survive the extraction.

## Identity and evidence

Reviewed checkout `/private/tmp/link-a1-successor-experiment`, HEAD `4d8157aa059f7e6e3fbb41de06ec0cb74de01973` plus dirty candidate. This review ran no tests and made no runtime edits. Exact source copies and hashes are in `selected-install-source/MANIFEST.json`. Relevant hashes:

| File | SHA-256 |
| --- | --- |
| entity-signal.ts | 956d39c81548d5168df8ba40a20ddedd40b89b10b46d26eebb2c37827033b013 |
| physical/entity-mutation-frame.ts | 0af1d67e76841a68d08c647205043e89c8b34c2f2757f503fe71b2d7260c3030 |
| physical/structural-store.ts | 1895bdd43895296a255eb4fc9ae86e339a687c60ee051da797a94e24a1ff0353 |
| physical/entity-value-store.ts | cba3a6356b6961e707a81014eef1f626117691d38f215ea0ccafae111e8ac57f |
| internals/causal-runtime/tree-realization-adapter.ts | 5f8eca17ba6da9f33bc18442ec2cc3a4aeaa01cab5c70ef0eec7733542e067d3 |
| internals/mutation-capture-runtime.ts | 54260cd194e6e3567acaad5e6045b0a89345d27e4da715f6f1dbacb54fcdb81f |

These six reviewed files, scalar-slot runtime, and both named witnesses match the entity-admission first-run manifest. Its BEFORE/AFTER manifests are identical. Entity signal/frame have no current diff against HEAD; the adapter's current 58-line diff is invalidation/error containment, not a structural install split. Copies of those diffs are preserved beside the manifest. No other reviewer verdict was consulted.

The supplied first log `/private/tmp/link-a1r-presence-evidence/entity-admission/FIRST.log` records one failed Nx test at 14:26:31. In `committed-entity-selected-unit.spec.ts`, undo restores left.a and right.a/right.b in one selected operation. A deliberately installed private committed-entity capture callback observes left.a=1 but right.a=50/right.b=60, whereas its prewritten expectation is right.a=11/right.b=12. That is the first executed divergence. The later final-state assertion is not reached, so the log does not independently establish its result. The callback writes right.a=777, but this is a controlled private capture witness, not a claim that public applications subscribe through this internal API.

The unchanged public `heterogeneous-reentry-publication.spec.ts` (SHA-256 `af6b26df9c06e0c62bc19e97bc0dd1ecded0fef6666547016b0b610380e2feb1`) separately requires newer callback-authored a777/b12 in both native state and default Link's final output after mixed undo. It was inspected, not rerun. The private witness SHA-256 is `2a6a89b3aff4226bdc2a4070db8db648bd222390a296582e35691b9e9f0ce5f9`.

## Governing boundaries

`RELEASE-1.0.md`, Release Invariants, says “All expected fallible semantic work precedes private commit” and “PRIVATE COMMIT consumes prepared instructions only.” Its atomicity rule forbids an observer, publication adapter, persistence consequence or other external consumer from observing an intermediate heterogeneous state.

`heterogeneous-atomicity.spec.ts:14–36` repeats that contract and identifies its own tests as the forward authoring path. Its comments at approximately 97–105 explicitly state that its notification controls were validated with batching enabled. Those controls are not proof of arbitrary synchronous forward-writer atomicity. They must not be used to expand ordinary authoring boundaries.

The approved successor `MECHANISM.md:85–99` is more specific to this task: “For atomic selected settlement, all constituent row/member/order edits belong to that selected prepared unit”; ordinary branch partial units retain their boundaries; admission precedes native invalidation, rich capture, enqueue observers and taps. A0:91–99 similarly places fallible preparation before callback-free install and freezes completed selected ordinary deltas before delivery.

These rules support moving rich capture past the complete **selected settlement** install. I found no source/test contract granting a rich-capture listener a right to observe an intermediate constituent of that selected inverse. `committedEntityObserver` describes completed writes, and `EntityMutationFrame.commit` itself promises all of its instructions are applied before observation. The missing property is composition across the larger selected heterogeneous unit. This interpretation does not authorize postponing every ordinary batch writer's per-row capture or changing synchronous path-observer ordering generally.

## Concrete source map

1. **Selection and prospective values already exist.** Adapter `planHeterogeneousFrame` takes selected effects, builds `PreparedRealizationContext` at 969, and separately simulates effect applicability in `buildPreparedRealizationContext:2249–2281`. Prepared restored values come from `resolveSubject` at 1223; restore preparation receives `vacatingKeysByOwner` at 1264. `orderPhysicalPlacements` and the existing restore ordering preserve execution/anchor dependencies. None of this must be replaced by inference from current membership, neighboring subjects, or a publication payload.

2. **Structural plans are not installation-only.** Adapter `PhysicalPlan:1188–1191` exposes only `commit` and `publish`. At 1442–1462 its purported install phase commits scalar slots, then removals, placements and rekeys, then live rows and selected ordinary plans. Entity `planRestore:2129–2209`, `planFreshAdd:2215–2258`, `planRemove:2262–2324`, and `planPreparedRekey:1693–1782` create frames inside those commit closures. They call `commitAndProjectEntityMutationFrame`, then epoch/activation/selection work and `updateSignals`. Thus later plans are still uninstalled when the first structural plan delivers capture.

3. **Frame preparation contains fallible work.** Entity `commitAndProjectEntityMutationFrame:1113–1330` prepares value transitions, clones structural records, computes placement and ordinary changes, prepares minimal entity responsibility, and checks the physical revision. It then calls `frame.commit` with an observer. That work presently occurs during each outer plan's commit, after earlier selected constituents may already have installed. A callback-free interval cannot include deep cloning, equality/reflection, responsibility preparation or other potentially reentrant preparation. This is a source-derived limitation; no new preparation-fault execution was performed here.

4. **The storage interval is available but not packaged for the coordinator.** `EntityMutationFrame` can stage replace/tombstone/fresh/restore/transfer instructions. `preparePlacement:156–230` creates detached placement and caches prepared instructions; `commit:266–410` applies structural/value changes, ordinary installation and `TerminalRecordPlan`, then invokes the optional observer. `StructuralStore` has primitive create/transfer/tombstone/restore-at-resolved-placement operations (359–524); `EntityValueStore.installValueTransition:131–145` and ordinary installation use prepared map edits. With preparation complete and observation deferred, these are the correct existing owners for the installation interval. Their existence is not evidence that the current outer `commit` closures are pure.

5. **Prospective placement is the important extraction constraint.** `EntityMutationFrame.prepareCommitInstructions:418–449` resolves restore anchors using the live structural store. `resolveSubjectRestorePlacement:428–481` implements live-anchor fallback, and adapter `orderRestoresForPlacement:2812+` expressly relies on sequential predecessors becoming live. Preparing every individual structural plan independently against the original store can change this behavior. Extraction must obtain each plan's exact prospective placement from the already authorized ordered unit and its prepared context, or stage that unit through the existing placement owner. It cannot invent an alternative order or occupancy rule. Reusing a data structure for this prospective view is an internal representation decision; implementing a competing selector is not.

6. **Paired ordinary facts already have an owner.** `prepareOrdinaryRealization:615–854` returns selected ordinary changes, interval, optional order endpoints and an install closure; installation updates ordinary value baselines/topology after physical truth. Adapter's local interface at 50–54 and `ordinaryPlans:1380–1414` currently retain only install/changes. A complete admission packet must carry the source's existing interval/endpoints as well, and preserve the separately selected ordinary group. The structural frame's locally derived ordinary records cannot simply substitute for selected O facts or certify every physical row/anchor as authored. `CompletedTopologyUnit` remains evidence joining P/O, not an authority selecting inverses.

7. **Live-point and scalar lanes already show the split.** Entity `preparePointValues:511–579` performs clone/equality/transition preparation first, provides primitive `install`, then separate `invalidate` and `publish`. Scalar slot frames expose `prepareCommit`; the native/scalar leaf wrappers can request `publish:false`. These can participate in one complete selected install without changing selection. The heterogeneous scalar lane currently calls `commit` inside install rather than precomputing all preparation, so the coordinator must still establish a genuine all-prepared boundary.

## Delivery boundaries that remain after structural extraction

`committedEntityObserver` calls the mutation capture runtime; `mutation-capture-runtime.ts:157–180` invokes listeners synchronously and contains their errors through a reporter. It is user-code-capable even though the port is private. Minimum responsibility must already be installed before these rich listeners run; deferring or dropping responsibility itself is not the same operation.

Entity `publishSubjectPhysicalChange:1908`, `syncEntitySignal:2727`, and `updateSignals:2892` can reach native cells, epochs and invalidation delivery. An invalidation group is useful existing machinery, but it does not prevent synchronous rich capture. Nor does it prove all custom/native realization callbacks are deferred. The first callback-capable invalidation must follow complete native/ordinary/responsibility/publication admission.

Public path notification is also a callback boundary: `path-notifier.ts:333–345` calls enqueue observers before queue delivery, and 366+ delivers subscribers immediately when batching is disabled. Moving taps or merely queueing notifications first cannot establish whole-unit admission. After admission, preserve the existing notification order and error containment; reentry authors a later unit. Default Link must consume immutable admitted deltas in installation order and not replay an older row notification after that newer unit. Making native storage atomic alone does not prove the unchanged public Link witness passes.

Existing membership holds (`entity-membership-source.ts:89–99`) already express whole-reversal delivery after collections install. They are not a general rich-capture/native-invalidation hold. The alternate full-target path is also not a ready pure-install substitute: `prepare-entity-target.ts:225–240` invokes membership taps and writes active selection with `replaceLocation` inside install. It materializes the full target and scans current/target subjects. Replacing point selection with that path indiscriminately would require separate scope/cost justification and still needs callback-boundary scrutiny.

## Bounded disposition

There is a supported internal extraction, not a missing product policy: retain existing effect selection, prepared subject context, occupancy/vacating rules and anchor order; prepare all selected P/O transitions, minimal records and recipient admission before any installation; install those exact instructions without callbacks; then attempt capture, invalidation and public delivery with installed obligations preserved on failure. Ordinary forward partial units keep their existing boundaries.

The concrete implementation blocker is absence of the complete prepared structural port, including prospective placement and paired selected ordinary evidence. A coordinator-only wrapper or blanket delay is insufficient. A broad new topology planner or publication-owned selection engine is unnecessary and would introduce an authority the supplied contract does not grant.

The private first failure is already a discriminator for the early rich-capture boundary. The unchanged public witness is still required for default Link/reentry chronology, and synchronous enqueue/native invalidation controls remain necessary for an eventual candidate. No test pass, repair authorization, performance result, or general callback-timing change is claimed by this source review.
