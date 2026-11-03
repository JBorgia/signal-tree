# One source-owner installation inventory

Design evidence only, October24. Native candidate frozen; no edits/tests. Paths below under packages/kernel/src. Proposed owner means one collection-local ordinary-placement state owner adjacent to StructuralStore/EntityOrdinaryTopology, not Link/history authority and not a selected full/sparse representation.

## Actual installation bodies inspected

| Native seam | Current mutation body | Owner obligation before P installation / consumer |
| --- | --- | --- |
| S1 existing field | lib/entity-signal.ts1575–1620 commitExistingSubjectValue; frame replace-value at physical/entity-mutation-frame.ts221–231 | No placement authorship. Preserve occupancy/placement if adopting required lifetime existence; ordinary field facts separate. Paired responsibility and source notification share prepared record. |
| S2 entity frame | physical/entity-mutation-frame.ts196–269 createSubject, restoreSubjectAtResolvedPlacement, transferSubject(+placeActiveSubject), tombstoneSubject | Prepare affected P reciprocal edges and ordinary presence/key/placement intent as complete unit. Inspection saves old ordinary links before P changes; ordinary operations update owner from authored intent. installOrdinary then responsibility occurs at272 onward; nothing afterward may change authored placement unnoticed. |
| S2 compound move | lib/entity-signal.ts1423–1436 moveToFront calls StructuralStore.moveKeysToFront; addManyInOrder2143 invokes after frame; addOneWithStructuralEffect2252 likewise | Move must join frame's prepared final placement, not append-tail facts installed then corrected downstream. Preserve physical old edge facts before move; callbacks/flush see completed source unit. |
| S2 full order | lib/entity-signal.ts4125–4178 frame then reorderActiveKeys(incomingIds); order publication4164+ | Complete target ordinary intent and P order planned together before either install. Inspection reorder preserves ordinary links for all impacted neighbors, including surviving members lacking add/remove records. Explicit own reorder differs from observed physical survivor order. |
| S3 point realization | entity-signal.ts4505 __prepareOrdinaryRealization; physical/entity-mutation-frame restore/transfer/value branches | Use authorized inverse O facts plus separately prepared P target. Owner resolves O inverse from ordinary topology, P placement from approved successor policy; P99/O7 remains valid. No authored recapture. |
| S4 complete target | entity-signal.ts4546–4570 __prepareTransitionTarget → physical/prepare-entity-target.ts186–187 installPreparedTarget and installPreparedTargetValues | Prepared target must include owner’s O disposition and exact P linked target. Installing structural target wholesale cannot silently replace O order with P order. Revision validation before install; invalidation/publication after complete unit. |
| S5 key/lifetime restoration | entity-signal.ts1677 restoreOne,1695 planRestore; mutation-frame208 resolved revival,252 transfer,257 placement | Same owner participates whether restore is public/history/rollback. Identity non-reuse; restoration destination and placement validated privately. Key mapping alone cannot imply ordering intent. |
| S6 retirement | entity-signal.ts2715 applyPreparedSubjectReclamation,2849 reclaimRetiredSubjectsWithoutOwner; mutation-frame233–246 forgetSubject/retireSubject | Remove only obligation-free owner records; do not reclaim lifetime facts required by pending inverse or ordinary/physical divergence. Retirement is maintenance, no authored O/P transition/publication. |
| Frontier metadata | entity-signal.ts4552–4553 installCompensatedOrderFrontier | Restore proof token consistently with installed topology; token is not ordinary sequence storage. Must not use frontier installation to mask missing O links. |

StructuralStore is constructed at entity-signal.ts1061, ordinaryTopology at1079. Initial materialization uses normal source operations, so owner establishment must precede first inspection/observer; empty construction has valid empty order and no per-member allocation. StructuralStore.clear body physical/structural-store.ts557–567 clears maps/head/tail and frontier; source destruction must dispose owner too. No public collection writer direct-call to clear was found in inspected entity-signal; do not count an unused low-level clear as qualified destruction path.

## Eleven writer families mapped

W1 point/updateOne →S1/S2 replace-value; W2 whole row/updater →same; W3 updateMany →S2 multiple replace-value with per-step facts. These author fields, not incidental neighbor order.
W4 add/prepend(one/many) →S2 create plus compound move. Owner receives final insert position before first responsibility/callback.
W5 rekey →S2 transfer/S5. Owner changes occupancy only unless explicit separately prepared placement exists.
W6 remove/clear/removeWhere →S2 tombstones. Save ordinary predecessor/successor from owner, P reciprocal patch from physical store; update surviving links in each domain separately.
W7 upsert →W1/W4 branches within one ordered frame; duplicate-key intermediate operations retain chronology. W8 setAll/reorder →S2 complete target; explicit supplied order intent and membership/value intent remain distinguishable.
W9 hidden reintroduction →plain-branch membership +S4/S2; ordinary parent authority separately gated; retained hidden physical order is not automatic resurrection input. No broader hidden-path implementation authorized by this design.
W10 rollback/history redo/restore →S3–S5 using source-authorized realized facts. Consumers do not rebuild placement from payload snapshots.
W11 retirement →S6; owner drops metadata after dependencies drain and tree teardown, not merely zero pending count.

## Exact four preserved failures

- ONE compound ordinary-order leak: O ABC; inspection removeA/addX/reorderCBX; own setAllCAX; rollback and later ordinary B update publishCAB. Ordinary removeB borrowed physical C/X anchors.
- Prepend onAdd flush: expectedXA, redoAX.
- Prepend callback nested appendY: expectedXAY, redoAYX.
- Prepend callback nested prependY: expectedYXA, redoAYX.

The three prepend cases share early append-tail ordinary admission versus later final placement; nested callbacks prove complete source placement must be fixed before delivery. The compound case requires independently valid ordinary adjacency before physical inspection edits. None is a downstream sort/flush repair.

## Unmapped / verification obligations

No representation selected. Every P mutation must report its *complete changed adjacency footprint*, including reciprocal endpoints/head/tail, so physical-base sparse overrides can preserve O agreement before mutation. Full retained O storage instead must show incremental updates and measured first-divergence/whole-order costs. Either must cover changed-order-with-unchanged-membership, absent/retired lifetime identity, same-key replacement and ordinary rekey.

Responsibility preparation, final compound placement and failure/reentry revision validation must be one prepared unit: reentrant user preparation can invalidate it; after commit no delayed outer move may overwrite callback work. Fault before installation changes neither owner nor P; post-install delivery failure retains coherent installed authority. Independent review must enumerate calls through frame/target/direct-move/direct-reorder, rather than assume frame coverage covers all.

No claim that collection order-capture subscription (transactions.ts2777+) owns source order: it only sees admitted captures and own endpoints. No reverse-calling Link projection, history snapshot, catch/delete rollback or writer-specific neighbor repair follows from this matrix.

## Callsite completeness supplement

Raw manifest: structural-store-calls.raw, generated from frozen candidate root with:

    rg -n 'structuralStore\.[A-Za-z]+\(' packages/kernel/src --glob '!*.spec.ts'

All non-test lexical calls are retained including reads/planning. Mutation subset (exact file lines): entity-signal.ts1427 moveKeysToFront;1450 bumpSubjectRevision;1531 allocateFreshSubjectId;1532 createSubject;4146 reorderActiveKeys;4553 installCompensatedOrderFrontier. entity-mutation-frame.ts198 createSubject;208 restoreSubjectAtResolvedPlacement;241 forgetSubject;243 retireSubject;252 transferSubject;257 placeActiveSubject;262 tombstoneSubject. prepare-entity-target.ts186 installPreparedTarget. Calls allocateFreshSubjectId also appear through frame/planner paths in raw manifest and reserve identity only; planFreshSubjectIds is nonmutating (StructuralStore89–99). bumpSubjectRevision1450 changes observer lifetime token, not adjacency; frontier installation changes validation identity, not sequence. Both still require correct commit ordering and must not masquerade as order facts.

**Direct bypass1532 is real installation**, not a harmless read: commitFreshSubject calls allocateFreshSubjectId then createSubject, which activates and appends an active linked node (StructuralStore337–343). allocateSubjectId1521 first checks existing key, otherwise calls it. Callers: planRekey1296/1310, rememberSubjectId1542, rememberSubjectIds1661, and neighbor evidence2175/2247/3811. Existing valid-key paths normally reuse identity, but missing-key behavior must be audited/guarded at the common owner seam; do not assume invocation is identity-only or inspection-only. Owner must distinguish reserve ID from installation and participate if physical adjacency changes.

**Wrapper/dead methods:** StructuralStore.restoreSubject387–403 resolves placement then delegates internally to restoreSubjectAtResolvedPlacement; no non-test external .restoreSubject call was found. StructuralStore.clear555–567 clears all maps/linked roots; no non-test external store.clear invocation was found. Their internal delegates are covered, but unused methods are not runnable teardown evidence. Public api.clear is row removal, not StructuralStore.clear. Read-only methods snapshotActiveOrder/activeKeysSnapshot may update caches/stat counters; they do not author topology. prepareTarget stages maps privately; installPreparedTarget alone swaps live topology.

**Construction correction:** createEntitySignal330 takes configuration, no initial row array; marker processor markers/entity-map.ts252 constructs it. Stores are initially empty (entity-signal1061/1079). There is no implicit initial row installation in this body. Hydration later calls node.setAll via marker writer markers/entity-map.ts415 after diff path fails. Thus prior phrase 'initial materialization uses normal source operations' was imprecise: empty materialization is allocation; actual supplied rows must be traced through marker write diff/setAll.

**W9 actual body:** entity-signal4375–4425 wraps row-adding methods and clear for absent collections. interceptAsEmpty validates before hidden mutations; clearRetained4311 invokes ordinary api.clear under silentClear; writePrepared runs original method with suppressed duplicate interceptors; reactivatePathOnWrite re-adds the path. Same owner must cover hidden retained-row removal plus authored rows, while parent membership remains separate. No standalone hidden-order reconstruction is justified.

**Teardown qualification:** this collection body exposes internal reclamation and subscribes membership/presence mechanisms, but no source-owned StructuralStore.clear teardown call exists in manifest. Tree-owned registries releasing collection closure reachability are a different mechanism from explicit clearing; exact lifecycle/GC qualification remains missing, not assumed by method names. Proposed owner must attach to actual tree/collection destruction ownership rather than invent api.clear-as-destroy. This inventory does not assert untraced destruction calls.

## Direct value installation lanes (explicit completeness)

`entity-signal.ts503–576 preparePointValues` is exported privately at4510–4511 and invoked by `internals/causal-runtime/tree-realization-adapter.ts816–848` for existing-lifetime point realization. Body first verifies activeKeyForSubject equals supplied key, clones and prepares exact realization edits. `install()` only calls valueStore.installValueTransition; it never calls a StructuralStore mutator or ordinaryTopology installation. `invalidate()` advances existing epochs and updateSignals; `publish()` sends realized value-transition metadata and optional onUpdate. This is a physical/ordinary **value** write lane excluded from adjacency mutation, not omitted from installation inventory. Preconditions must remain existing-lifetime/unchanged membership/key; if a producer needs existence adoption it must use an admitted structural path, not infer placement inside this value-only lane.

`entity-signal.ts1575–1605 commitExistingSubjectValue` is separate from frame commits. It prepares value transition and ordinary topology changes, prepares responsibility, checks physical revision against reentry, then installs value transition + ordinaryPlan + terminal record and capture before clock advance. It does not mutate physical adjacency. However ordinary necessary-existence admission for an inspection-only lifetime can carry topology through ordinaryPlan: proposed owner must supply that explicit ordinary insertion requirement while unrelated present lifetime field writes remain placement-neutral. S1 exclusion therefore applies only to physical adjacency, not to possible ordinary membership participation.

Direct dynamic `allocateSubjectId → commitFreshSubject → createSubject` participation is a **prospective obligation**, not a newly proved reachable bug. Body shows installation if reached with absent key; inventory does not establish that supported read-only acquisition reaches it. Every caller's valid-key preconditions must be checked before classifying it as harmless allocation; do not label source-only reachability as a public failure.
