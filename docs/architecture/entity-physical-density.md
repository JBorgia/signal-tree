# Entity Physical Density

`ENTITY-PHYSICAL-DENSITY-0` optimizes representation under frozen semantics.
It does not renegotiate EntityMap, SubjectId identity, membership, ordering,
held-reference behavior, restoration, causal behavior, or public API.

## E0 — Byte Attribution

Generator checkpoint: `82b487da`.

Reproduce:

```bash
pnpm nx build kernel
node --expose-gc tools/bench-entity-physical-density.mjs
```

The generator measures each arm in a fresh process at 0, 1k, 10k, and 100k
entities. Every point uses `tools/lib/heap-quiescence.mjs`, takes the median of
three isolated samples, and must pass a WeakRef collectability check. Synthetic
copies of the exact field shapes must close within 90-110% of the production
classes or the generator fails.

The familiar 10k point and the marginal slope answer different questions:

```text
actual physical stores at 10k       4.35 MB  ≈456 B/entity at that point
actual physical stores at 100k     37.82 MB
marginal physical-store slope               393.9 B/additional entity
```

Map capacity steps and fixed process/module costs make a point estimate larger
than the cross-size marginal slope. E0 uses the slope for attribution and prints
both measured empty-arm bytes and fitted intercepts without calling either a
portable fixed cost.

### Production Floor

| Physical owner                                | Marginal bytes/entity | Share of physical slope | Scales with             | Semantic authority                       |
| --------------------------------------------- | --------------------: | ----------------------: | ----------------------- | ---------------------------------------- |
| Entity payload                                |                  72 B |                   18.3% | retained subject values | application value                        |
| `EntityValueStore.retainedEntities` Map entry |                  36 B |                    9.2% | retained subject values | SubjectId → entity value address         |
| `StructuralStore.subjectIds`                  |                  36 B |                    9.2% | live subjects           | key → stable SubjectId address           |
| `StructuralStore.subjectStates` Map + record  |                  84 B |                   21.4% | existing subjects       | lifetime, active key, restore permission |
| `StructuralStore.subjectRevisions`            |                  36 B |                    9.2% | existing subjects       | subject revision                         |
| linked ordering node                          |                  56 B |                   14.2% | live subjects           | active order and neighbor identity       |
| `activeNodesByKey` Map entry                  |                  36 B |                    9.2% | live subjects           | O(1) live-node lookup by key             |
| `activeNodesBySubject` Map entry              |                  36 B |                    9.2% | live subjects           | O(1) live-node lookup by SubjectId       |
| **Total**                                     |             **394 B** |              **100.0%** |                         |                                          |

`StructuralStore` accounts for 286 B/entity. `EntityValueStore` plus its payload
accounts for 108 B/entity. A conventional `Map<key, entity>` carrying the same
payload also measures 108 B/entity; SignalTree's additional physical floor is
structural identity/lifetime/order representation, not public accessor metadata.
Structural bookkeeping is therefore about 72.5% of the production marginal
physical floor. Do not describe the physical floor as 455 B/entity: that is a
useful 10k point measurement, not the cost of one additional entity.

### Attribution Closure

| Check                                                              | Result |
| ------------------------------------------------------------------ | -----: |
| exact synthetic structural fields / actual `StructuralStore` slope | 100.0% |
| exact synthetic structural + value fields / actual physical slope  | 100.0% |
| exclusive component sum / actual `StructuralStore` slope           | 100.0% |
| exclusive component sum / actual physical slope                    | 100.0% |

The displayed precision is not a claim of zero measurement uncertainty. The
hard assertion is the preregistered 90-110% closure band. Three non-zero points
span 100× but do not establish a portable linear model for every V8 capacity
threshold; repeat measurements should compare the same generator and runtime.

## Authority Versus Representation

Every row above names a real semantic job. E0 does not establish that each job
needs a separate Map or object allocation.

> **Unify allocation, not authority.**

A consolidated physical subject record may be addressed by both stores while
`StructuralStore` continues to own key, identity/lifetime, revision, membership,
and ordering, and `EntityValueStore` continues to own value. No unrelated path
may treat the record as an unowned mutable bag.

## E1 Target

E0 authorizes an external record-consolidation prototype, not a production
change:

```text
keyIndex
    Map<Key, SubjectId>

subjects
    Map<SubjectId, SubjectRecord>

SubjectRecord
    key
    value
    revision
    lifetime / restore permission
    active ordering links or active node
```

The immediately proven consolidation opportunity is two subject-indexed Map
entries: revision and entity-value addressing, approximately 72 B/entity
combined. That would move the measured marginal floor from about 394 B toward
322 B before any active-index result.

E1 must measure staged candidates so each claim remains attributable:

1. consolidate lifetime, revision, and value under the one SubjectId-indexed
   record while retaining both active indexes;
2. replace `activeNodesBySubject` with `SubjectId → record.activeNode`;
3. replace `activeNodesByKey` with
   `key → SubjectId → record.activeNode`;
4. combine both active-index removals only after the independent arms pass.

The ordering node plus two active indexes account for another 129 B/live subject,
but none may be deleted merely because it is large. Inside the prototype:

- `activeNodesByKey` must be compared with `key → SubjectId → record.activeNode`;
- `activeNodesBySubject` must be compared with direct
  `SubjectId → record.activeNode`;
- both alternatives must remain O(1);
- ordering, rekey, restore placement, and integrity controls must remain exact.

No SubjectId reuse, generational identity, weak canonical truth, public API
change, or production-store rewrite is authorized by E0.

## E1 Result — Admissible Representation Evidence

Generator checkpoint: `1bc53ae8`.

```bash
node --expose-gc tools/bench-subject-record-consolidation.mjs
```

| Prototype arm                                             | Marginal bytes/entity | Saving from production |
| --------------------------------------------------------- | --------------------: | ---------------------: |
| production `StructuralStore` + `EntityValueStore` control |               394.0 B |                      — |
| consolidated record, both active indexes retained         |               345.3 B |                 48.7 B |
| consolidated record, only key active index retained       |               309.0 B |                 85.0 B |
| consolidated record, only SubjectId active index retained |               309.0 B |                 85.0 B |
| consolidated record, neither active index retained        |               272.7 B |                121.4 B |

The production control reproduces E0's 393.9 B/entity slope. Consolidating the
two extra SubjectId-indexed facts saves 48.7 B/entity, not the theoretical
72 B/entity, because enlarging the lifetime record into the consolidated record
has its own object-layout cost. Each active index independently contributes
36.3 B/entity; removing both through record lookup contributes 72.7 B/entity.

All candidate records are mutable in place: a value or revision update does not
replace stable subject identity or rewrite indexes. A retired record remains
strongly addressed by SubjectId with `activeNode` absent. The synthetic controls
cover linked-node identity, mutable value/revision update, retirement, held
record identity, fresh same-key occupation, reactivation, missing lookups, and
forward/reverse ordering integrity for every index variant. Key lookup remains
`key → SubjectId → record.activeNode`; SubjectId lookup remains
`SubjectId → record.activeNode`. Neither path scans.

Adversarial confirmation bounds this result to **admissible representation
evidence**. Split stores remain a coherent rival and consolidation is not
semantically necessary. This prototype does not test production restoration
placement, reorder/move/transfer, causal integration, external ingress, owner
invalidation, facade GC, or hot-path latency. Therefore 272.7 B/entity is a
plausible measured layout, not an authorized production target.

## E2 Result — Exceptional Lifetime Evidence

Generator checkpoint: `e07ac9d3`.

```bash
node --expose-gc tools/bench-active-retired-lifetime.mjs
```

| Population                                 |          Marginal bytes/unit | Interpretation                                  |
| ------------------------------------------ | ---------------------------: | ----------------------------------------------- |
| E1 active control                          |               272.7 B/entity | explicit `active` and `restoreAllowed`          |
| compact active                             |               256.6 B/entity | active implicit from `activeNode`               |
| mutated compact active                     |               256.6 B/entity | ordinary updates add 0.0 B/entity               |
| retired, strong exceptional state          |      248.7 B/retired subject | no active key or ordering node                  |
| attribution control without lifetime truth |      164.4 B/retired subject | invalid candidate; isolates overflow            |
| held retired                               | 257.9 B/held retired subject | external strong held-record reference           |
| reactivated                                |               295.1 B/entity | compact record plus key-index churn             |
| fresh same-key occupant                    |         553.0 B/old-new pair | held retired subject plus distinct live subject |

The common active record saves 16.1 B/entity by omitting the two explicit
lifetime fields. Mutating active value/revision adds no measurable subject
slope. The strong exceptional lifetime Map plus record costs 84.3 B/retired
subject, matching E0's lifetime attribution, but only exceptional populations
pay it.

Reactivation initially appeared to retain 38.5 B/entity beyond pristine compact
construction. A key-index delete/reinsert control attributes 36.3 B/entity of
that difference to V8 Map churn; reactivation is only 2.2 B/entity beyond that.
Replacing the emptied exceptional Map changes its marginal slope by 0.0 B/entity.
This says nothing about a fixed empty-container residue.

The synthetic production-shaped restoration claim graph adds 294.3 B/claimed
retired subject in its chosen owner-Set representation. That is not an abstract
minimum claim cost and does not belong to the raw lifetime floor; E5 owns the
production capability measurement.

Controls preserve stable non-reused SubjectId, in-place mutation, held retired
identity, occupied-key restore rejection, fresh same-key occupation, exact
same-subject restoration, rekey identity, forward/reverse order integrity, and
constant-hop Map lookup. All arms collect after release.

E2 is **admissible representation evidence only**. Production promotion must
first make active `restoreAllowed === true` an enforced invariant or represent
its exceptional false case, and must cover the intermediate tombstone state,
mixed populations, production restoration/causal paths, and hot-path latency.
No weak canonical truth, production change, or public change is authorized.

## E3 Result — Segmented Storage Rejected

Generator checkpoint: `86b6aee7`.

```bash
node --expose-gc tools/bench-segmented-subject-storage.mjs
```

E3 compares the complete synthetic E2 layout with four SubjectId-record
containers at segment size 1,024: Map, dense outer chunk arrays, sparse
reclaiming object segments, and sparse field-packed segments with stable record
handles. Every variant retains the unchanged key-to-SubjectId Map and ordering
nodes. SubjectIds remain positive safe integers, monotonic, and never reused;
segment and offset derive directly from SubjectId without an address Map.

| Population                                |     Map | Chunked objects | Sparse objects | Packed stable handles |
| ----------------------------------------- | ------: | --------------: | -------------: | --------------------: |
| dense                                     | 256.6 B |         228.4 B |        228.4 B |               229.3 B |
| dispersed 10% occupancy, direct           | 320.8 B |         365.1 B |        365.5 B |               517.2 B |
| dispersed 10% occupancy, after retirement | 357.1 B |         364.9 B |        365.6 B |               517.2 B |
| clustered 10% survivors after retirement  | 293.0 B |         301.0 B |        228.5 B |               229.4 B |
| repeated high-water churn                 | 256.7 B |         301.0 B |        228.5 B |               229.7 B |
| mixed active/restoration-retained         | 214.5 B |         186.2 B |        186.3 B |               187.2 B |

Dense segmentation saves only 27.4-28.3 B/retained subject once stable access
identity is included. Field packing provides no additional dense win over object
segments. The dispersed sparse population reverses the result: every segmented
variant is larger than the churned Map, and packed segments are much larger.

Sparse object and packed variants correctly reclaim whole empty segments. That
makes clustered and repeated-high-water survivors dense again and removes the
high-water penalty. Dense outer chunk arrays cannot reclaim those segments and
retain a 72.6 B/subject repeated-high-water penalty. A held old SubjectId while
new IDs grow remains correct in every variant.

The direct-versus-retired dispersed pair attributes 36.3 B/retained subject to
Map churn. Segmented variants add approximately no retirement residue of their
own, but pay for low occupancy directly. Iteration walks allocated segment
capacity, so dispersed segmented iteration is materially slower than Map
iteration; segmented random lookup/update also generally regress. Dense timing
does not show a meaningful regression, but the sparse result controls the row.

E3 is **closed negative representation evidence**. No segmented candidate meets
the combined requirement of a material density win, bounded sparse/high-water
retention, and no meaningful point-operation regression. The E2 compact
`Map<SubjectId, SubjectRecord>` remains the best external candidate. Segment
size tuning, slot reuse, an address Map, SubjectId reuse, generational identity,
and production migration are not authorized by this result.

> **Do not optimize SubjectId storage for dense allocation unless the
> representation also wins under realistic sparse retirement and churn.**

## E4 Result — Realization Retention Attributed

Generator checkpoint: `6c8f9e44`.

```bash
pnpm nx build kernel
node --expose-gc tools/bench-entity-realization-retention.mjs
```

E4 measures the production public EntityMap at 0/1k/10k/100k. Every arm runs in
an isolated process, uses the shared heap-quiescence protocol, requires every
released facade WeakRef to clear while its tree remains live, and rejects a
linear fit below $R^2 = 0.995$.

| Realization state                          | Marginal bytes/entity | 10k retained heap |
| ------------------------------------------ | --------------------: | ----------------: |
| untouched                                  |               403.2 B |           4.53 MB |
| `byId()` then release without reading node |               759.5 B |           8.08 MB |
| read node then release                     |             1,115.9 B |          11.57 MB |
| read fields then release                   |             1,115.9 B |          11.57 MB |
| hold nodes without reading                 |             2,981.0 B |          29.33 MB |
| hold and read fields                       |             3,337.5 B |          32.83 MB |
| release, mutate, reacquire, release        |             1,106.8 B |          11.54 MB |

The released-realization residual has two independently triggered strong
owners:

| Exclusive retained owner                                  |          Marginal increment |
| --------------------------------------------------------- | --------------------------: |
| `entitySignals` entry + entity value cell                 |    356.3 B/realized subject |
| `subjectStateSignals` entry + activation cell             |        356.4 B/read subject |
| released facade/field-derived graph beyond the two cells  |           approximately 0 B |
| held facade, field cells, closures, descriptors, metadata |      2,221.6 B/held subject |
| held field reads beyond their activation cell             |          0.1 B/held subject |
| second acquisition cycle beyond first released field read | -9.1 B/subject, noise-level |

`byId()` creates the entity cell and the facade/field graph, but does not execute
the node. The facade graph is weakly cached and collects after external
references disappear. Calling the node or a field executes `currentKey()` and
interns the separate activation cell; that cell remains strongly indexed after
the facade collects. Reading every field adds no further released slope.

The weak facade cache therefore works as intended. Reacquisition does not add a
positive slope and reads current canonical truth after intervening updates.
Simultaneous consumers receive the same live facade. Held facades remain
reactive across forced GC, and remove plus fresh same-key occupation preserves
distinct SubjectIds and realization identities. Each returned tree owner is
collectible after release.

The existing forced-GC durability gate remains decisive: live consumers update
after GC, held references survive remove/undo of the same subject, stale held
references do not follow a fresh same-key occupant, and independent consumers
all invalidate. E4 therefore does not authorize replacing either strong cell
Map with naive WeakRefs; that experiment has previously produced stale UI while
ordinary tests remained green.

E4 is **closed attribution evidence**. It proves the approximately 356 B
released-`byId` residual belongs to the durable entity cell, not retained facade
objects. Actual node/field observation adds a second approximately 356 B durable
activation cell. It does not prove either cost irreducible, but any ownership
redesign must preserve the forced-GC laws above. No production retention change
is authorized.

## E5 Featured-Memory Law

E5 must test this density law explicitly:

> **An unconfigured capability has zero subject slope. An unused configured
> capability has no material subject slope. Retained history cost scales with
> retained restorable work, not total tree size or total past writes.**

The required restoration arms are raw; configured with zero designated turns;
configured with 1,000 undesignated writes; designated writes with retention 0,
1, and 20; and a large/unbounded control. Report fixed bytes per tree separately
from bytes per live, designated, or participating subject, retained turn, and
retained claim/history entry.

Retention 0 means completed turns are immediately discarded; it does not remove
designation semantics. A bounded hot undo window may evict older turns. Any
persistent cold diagnostic journal remains separate from restoration authority
unless a future product contract explicitly makes those records restorable.

## E5 Result — Direct Falsifiers Found

Generator checkpoint: `bc6ab836`.

```bash
node --expose-gc tools/bench-capability-density.mjs
```

E5 measures the production public tree at 0/1k/10k/100k with three isolated
samples per arm, a matched post-seed settlement boundary, exact history/claim
cardinality, and post-`destroy()` collection of the tree, claim registry, and
descriptor store. Every fit passes $R^2 >= 0.99$.

| Capability state                                          | Marginal bytes/live subject | 100k retained heap | History / claims / subject descriptors |
| --------------------------------------------------------- | --------------------------: | -----------------: | -------------------------------------- |
| raw                                                       |                     403.2 B |           38.92 MB | 0 / 0 / 0                              |
| causal-runtime only                                       |                     403.2 B |           38.94 MB | 0 / 0 / 0                              |
| restoration configured, zero designated writes            |                     840.2 B |           80.88 MB | 1 / 0 / 100,000                        |
| restoration plus 1,000 undesignated writes                |                     831.1 B |           80.12 MB | 1 / 0 / 100,000                        |
| requested `maxHistorySize: 0` after 100 designated writes |                   1,231.0 B |          118.50 MB | 50 / 50 / 99,950                       |
| buffer length 2                                           |                     847.1 B |           81.75 MB | 2 / 2 / 99,902                         |
| buffer length 20                                          |                     991.4 B |           95.55 MB | 20 / 20 / 99,920                       |
| buffer length 101                                         |                   1,631.2 B |          156.65 MB | 101 / 100 / 100,000                    |

The law dispositions are:

- **Unconfigured capability: PASS.** Causal-runtime alone adds 0.0 B/live
  subject. Its overhead is fixed/tree-level.
- **Configured but unused: FAIL.** Restoration adds 437.0 B/live subject before
  any designated write. At 100k this is about 42 MB, with one subject descriptor
  and one structural-effect-by-subject entry per live subject despite zero
  claims.
- **Undesignated activity: PASS / no accumulation found.** One thousand
  ordinary writes add -9.1 B/live subject, retain no new entry or claim, and do
  not increase descriptor cardinality.
- **Zero retention: UNSUPPORTED / CONTRACT FALSIFIER.** `maxHistorySize: 0`
  emits the exact ST2032 diagnostic and falls back to 50. After 100 designated
  writes it retains exactly 50 entries and 50 claimed subjects. The product
  cannot currently express zero completed-history retention.
- **Bounded retention mechanics: PASS.** Buffer lengths 2, 20, and 101 retain
  exactly their expected entry and claim counts, and eviction releases claims.

Matched scalar controls remain approximately 848.3-848.7 B/live subject at 2,
20, and 101 retained entries, with zero entity claims. Entity-designated turns
add approximately 0.79-0.81 MB per additional retained entry at 100k, but this
is a composite of the collection pointer snapshot, turn/effect metadata, and
claim graph. It is not a general per-entry or per-claim cost. The key result is
that entity-history retention scales with retained entries multiplied by the
affected collection's pointer width, while total undesignated writes do not
accumulate history.

E5 is **red evidence**, not a green closure. It authorizes attribution and
bounded production-design work, not a representation or public API change.

## RESTORATION-IDLE-DENSITY-0 / R0 — Byte Attribution

Generator checkpoint: `3013b735`.

```bash
node --expose-gc tools/bench-restoration-idle-density.mjs
```

R0 extracts the actual production realization-descriptor Map and INIT state,
destroys the tree, and measures those artifacts independently. They retain
437.2 B/subject against the 437.0 B/subject restoration-over-causal production
delta: **100.0% accounting closure**.

The extracted graph contains one descriptor owner and, per subject:

- one four-field subject address descriptor in `subjectDescriptors`;
- one cloned structural add effect indexed by both operation identity and
  SubjectId;
- one distinct entity in the materialized INIT collection snapshot.

Standalone owner-family probes are intentionally non-additive because hidden
classes, strings, and payload objects share allocation context. They measure
approximately 80.0 B/subject for the INIT materialized snapshot, 116.3 B for
the subject descriptor Map, and 304.7 B for the dual-index effect graph. Their
501.0 B sum over-closes production and is diagnostic only; extracted production
artifacts are the closure authority.

The idle cost is therefore not unexplained causal machinery. It is eager
restoration representation created for the initial population before any turn
is designated. Semantic necessity is not established: production resolution
prefers inline effect addresses, while subject descriptors are documented as
fallback machinery.

`RESTORATION-IDLE-DENSITY-0` may now test lazy acquisition and release under the
frozen restoration and transaction laws. No descriptor/effect/INIT artifact may
be removed until first designated entity undo, structural add/remove/rekey,
same-subject restoration, transaction composition, atomicity, and fallback
address resolution all remain correct.

`ZERO-HISTORY-RETENTION-0` is a separate product-contract decision. R0 does not
decide whether 0 means no retained completed entries, whether INIT survives, or
how `canUndo`, reset, and diagnostics behave. Current fallback-to-50 behavior is
measured, not endorsed.

`REALIZATION-OWNERSHIP-0` remains queued after E5. Its property is durable while
owned and reconstructible when unowned, with E4's four forced-GC laws plus held
cell/subscriber ownership, owner release, reacquisition truth, same-subject undo,
fresh-key isolation, and repeated acquire/release boundedness as killer controls.

## E5 / R0 Production Closure

Production checkpoint: `ea521d7e`.

The red E5 and R0 measurements above remain the historical defect evidence. The
production correction applies **ownership before retention**:

- ordinary settled turns discard transient capture and retain no restoration
  descriptors, effects, claims, or history;
- a turn-wide designation stages every write's reversal facts and commits them
  only after the composed turn is non-empty and accepted;
- descriptors are retained before claims only for an accepted positive-capacity
  turn, then released when no restoration or transaction authority owns their
  subjects;
- pending transactions hold fallback facts until confirmation and discard them
  on rollback, reset, destroy, net-zero composition, or thrown callback;
- canonical snapshot priming remains a fixed tree-level operation for positive
  capacities, not a retained INIT entry;
- reset and destroy retain no RESET or INIT checkpoint.

The live E5 matrix after the correction is:

| Capability state                                | Marginal bytes/live subject |    100k retained heap | History / claims / subject descriptors |
| ----------------------------------------------- | --------------------------: | --------------------: | -------------------------------------- |
| raw                                             |                     403.2 B |              38.92 MB | 0 / 0 / 0                              |
| causal-runtime only                             |                     403.2 B |              38.94 MB | 0 / 0 / 0                              |
| restoration configured, zero designated writes  |                     403.2 B |              39.10 MB | 0 / 0 / 0                              |
| restoration plus 1,000 undesignated writes      |                     394.1 B |              38.33 MB | 0 / 0 / 0                              |
| `maxHistorySize: 0` after 100 designated writes |         approximately 394 B | approximately 38.3 MB | 0 / 0 / 0                              |
| capacity 2                                      |                     409.9 B |              40.02 MB | 2 / 2 / 2                              |
| capacity 20                                     |                     554.3 B |              53.81 MB | 20 / 20 / 20                           |
| configured capacity 101, 100 turns authored     |                   1,194.1 B |             114.91 MB | 100 / 100 / 100                        |

Configured-unused restoration falls from 840.2 to 403.2 B/live subject and
80.88 to 39.10 MB at 100k, recovering approximately 41.8 MB. Its incremental
subject slope is 0.0 B. R0 independently reports 0.0 B/subject production idle
delta and 0.0 B/subject extracted idle artifacts.

`maxHistorySize` now means completed designated turns retained:

```text
undefined   default capacity 50
0           retain no completed entries, claims, or reversal payloads
1           retain one completed turn and support one undo/redo
N           retain at most N completed turns
```

Zero capacity may capture transient facts while a turn executes, but it bypasses
snapshot/history construction at settlement and retains none. Positive
capacities retain only participating subjects and exact bounded cardinalities.

Kernel validation after the change: 246 files, 1,992 passed, 3 expected
failures, 13 skipped, 1 todo; typecheck, kernel lint/build, E5 and R0 memory
gates, and independent adversarial review are green. This closes
`RESTORATION-IDLE-DENSITY-0` and `ZERO-HISTORY-RETENTION-0` without reopening
designation, SubjectId, structural restoration, transaction atomicity, durable
settlement, or public root semantics.

## RESTORATION-ACTIVE-DENSITY-0 (pre-registered)

`ea521d7e` closes the idle slope. It does not close _retained_ history density.
The matrix above still scales with collection width: capacity 2 / 20 / 100 cost
40.02 / 53.81 / 114.91 MB at 100k live subjects, an increment of roughly
771-795 KB per retained entity turn, while 100 retained scalar turns over the
same subtree stay near 40 MB. Bounded cardinalities (100 / 100 / 100) are not
bounded bytes; "positive capacities retain only participating subjects" is
asserted, not yet demonstrated, for entity turns.

Frozen target law: retained restoration cost scales with retained causal work
and the subjects and positions needed to reverse it, not with unrelated live
subjects. A one-entity value change conceptually needs TurnId, SubjectId, prior
affected truth, causal metadata, and claim/ownership; structural operations add
only the placement or neighbour facts reversal requires. A full-width collection
image must prove semantic necessity.

Pre-registered falsifier: at 1k / 10k / 100k subjects, independently, retain one
designated turn of each kind (one-field scalar change, whole-entity replacement,
add, remove, rekey, reorder/move) and compare configured restoration with zero
history against the same plus one retained turn, inventorying retained owners.
An approximately 8 KB / 80 KB / 800 KB progression for a one-subject turn is a
decisive O(N) result. The retained owner is attributed from measurement before
any redesign; the collection-width snapshot or projection is the suspect, not
the premise. `REALIZATION-OWNERSHIP-0` re-queues behind this row.

## RESTORATION-ACTIVE-DENSITY-0 / A0 — Owner Located

Generator checkpoint: `93bd4d15`.

```bash
node --expose-gc tools/bench-restoration-active-density.mjs \
  --operation field
```

A0 stops at the actual retained production graph. With capacity 1, one
designated one-entity field turn retains one history entry, one effect, one
claimed SubjectId, and one position. That entry's `state.rows.all` has
cardinality equal to the whole collection and is the **same object** as the live
canonical root snapshot's collection array.

| Live subjects | One-turn increment | Matched canonical materialization | Turn beyond materialization |
| ------------: | -----------------: | --------------------------------: | --------------------------: |
|         1,000 |            69.6 KB |                           34.1 KB |                     35.5 KB |
|        10,000 |           137.2 KB |                          107.0 KB |                     30.1 KB |
|       100,000 |           840.1 KB |                          820.2 KB |                     20.0 KB |

At 100k, a zero-history tree that merely materializes `tree.$()` reproduces
approximately 820 KB of the 840 KB one-turn increment. Clearing only the
history entry's `state` reference reclaims nothing because the live snapshot
cache co-owns the same object. The first-order O(N) owner is therefore the
collection-wide canonical materialization forced by `buildTurn()`, not the
one-effect/one-claim metadata graph.

The same three-sample 100k result holds across the preregistered operations:

| One turn                 | Production increment | Canonical materialization | Effects / claims / positions |
| ------------------------ | -------------------: | ------------------------: | ---------------------------: |
| field update             |             840.1 KB |                  820.2 KB |                    1 / 1 / 1 |
| whole-entity replacement |             840.1 KB |                  812.6 KB |                    2 / 1 / 1 |
| add                      |             833.1 KB |                  801.7 KB |                    1 / 1 / 1 |
| remove                   |             830.3 KB |                  800.1 KB |                    1 / 1 / 1 |
| prepend placement        |             832.2 KB |                  810.4 KB |                    1 / 1 / 1 |

Rekey exposes a second, larger owner. Its one structural effect and one position
retain **every live SubjectId as a claim**: 1k / 10k / 100k claims and
275.6 KB / 2.48 MB / 22.62 MB respectively. The source is stale collection
metadata: `setAll` leaves `lastSubjectIds` at collection width and `changeId`
does not replace it with the rekeyed subject before interception reads the
metadata.

A0 is **closed owner attribution**, not a production optimization. The next
active subrows are independent:

1. `RESTORATION-REKEY-CLAIM-WIDTH-0` must make one rekey retain exactly its one
   SubjectId, fixed at the mutation/rekey producer so every downstream causal
   consumer sees the correct participation set, without changing held identity,
   key reuse, undo/redo, or position.
2. `RESTORATION-TURN-STATE-0` must derive the minimum retained reversal
   representation and test whether effect-only turns can reverse every
   scalar/entity/structural/transaction turn -- and satisfy `jumpTo()` and
   historical-state exposure -- without forcing or retaining a full-width
   canonical snapshot. Compact effects are the leading candidate, not the
   conclusion. The snapshot cache may still own the current materialization for
   ordinary reads; restoration must not require it merely to retain a
   one-subject turn.

No active-history representation change is authorized by A0.

### Independent replication

A second agent, given only the raw 1k/10k/100k symptom magnitudes and blocked
from the A0 harness, this document, and `RELEASE-1.0.md`, independently
confirmed both owners:

- **One-field turn.** Owner is `CanonicalTurn.state` (a full materialized root
  snapshot from `snapshotState(tree.$)` at settlement); its O(N) term is the
  collection array `state.<collection>.all`. A single retained turn shares the
  live snapshot array; 20 retained turns pin 20 distinct `.all` arrays
  (`===`-checked), so retention is `entries x N` pointer slots at ~8 B, not
  `entries x N` row objects (rows stay structurally shared, 1,019 distinct
  across 20 turns over 1,000 rows). An exhaustive own-property / symbol /
  descriptor / deep-subgraph scan of a retained entry found zero function or
  accessor fields: closure capture is falsified as the dominant O(N)
  retained-turn mechanism (no function or accessor edges in the retained graph,
  and the ~8 B/slot array term carries essentially the whole multiplicative
  slope; lexical environments elsewhere are not reflection-enumerable).
- **Rekey.** `entry.restorationSubjectIds` is N-wide and populates the
  `SubjectRestorationClaims` `bySubject` / `byOwner` reverse index (~241 B per
  subject, ~98% of the retained rekey cost). `planRekey.commit()` and
  `planPreparedRekey.commit()` never call `rememberSubjectIds()`, leaving the
  `lastSubjectIds` latch at the prior wide write; `wrapMutator`
  (`intercept-leaf-signals.ts:208`) reads it and the precedence at
  `restoration.ts:660` admits it over the correct one-element `effectSubjectIds`.
  Interposing any narrow undesignated write before the rekey collapses claims
  from N to 2 and retained bytes by 98%, effect record unchanged.

Both accounts agree. The attribution is frozen.

Disposition:

```text
A0 OWNER ATTRIBUTION
    CLOSED / independently replicated

ordinary entity-turn O(N) owner
    CanonicalTurn.state.<collection>.all
    distinct N-wide projection array per retained turn

rekey O(N) owner
    stale producer participation metadata
    -> N-wide restorationSubjectIds
    -> N-wide claim ownership graph

closure capture
    FALSIFIED AS DOMINANT O(N) TURN-RETENTION MECHANISM

RESTORATION-REKEY-CLAIM-WIDTH-0
    PRODUCTION FIX AUTHORIZED AT PRODUCER
    do not modify restoration.ts:660 precedence, claim registry,
    restoration filtering, or public API

RESTORATION-TURN-STATE-0
    DERIVE MINIMUM RETAINED REVERSAL REPRESENTATION
    effect-only is candidate, not yet conclusion

REALIZATION-OWNERSHIP-0
    QUEUED
```

The rekey producer must emit exactly the current rekeyed subject as its
last-write participation metadata; `rememberSubjectIds()` / `lastSubjectIds` may
be the implementation but the requirement is the fact, not the mechanism. The
`restoration.ts:660` precedence is left intact deliberately: it carries
whole-turn capture for writes without structural effects, and narrowing it to
`effectSubjectIds` would turn a provenance bug into a restoration special case.

### RESTORATION-REKEY-CLAIM-WIDTH-0 — closed

Production checkpoint: `1bd52ed0`.

`planRekey.commit()` and `planPreparedRekey.commit()` now set
`lastSubjectIds = [subjectId]`, joining every sibling mutator. That is the only
production change; `restoration.ts:660`, the claim registry, restoration-side
filtering, and public API are untouched. `tools/bench-restoration-active-density.mjs
--operation rekey` at 100k live subjects now reports `effects=1,
claimedSubjects=1, positions=1`, and the one-turn increment (70.6 / 138.2 /
841.7 KB at 1k/10k/100k) is identical to an ordinary field turn -- the N-wide
`restorationSubjectIds` and the O(collection) `bySubject` / `byOwner` claim
graph are gone, removing ~22.6 MB of retained heap at 100k. What remains is the
shared `CanonicalTurn.state.<collection>.all` materialization, which is
`RESTORATION-TURN-STATE-0`'s subject. `rekey-claim-width-0.spec.ts` pins the fix
at the producer (`__subjectIds` after `changeId`, ordinary and
transactional/prepared paths) and at the restoration outcome (one retained
claim regardless of collection size, held identity across the rekey, undo/redo
key restoration, order preservation, rolled-back-transaction atomicity, eviction
release, and fresh same-key occupant distinctness). Full kernel suite, both
TypeScript passes, and kernel lint/build are green.

Redo path traced explicitly. `redo()` of a designated rekey turn replays through
`__planPreparedRekey.commit()` — the second patched site — and the sole notify
delivered is `path=rows.<newKey> owner=rows nSubjects=1 structural=rekey`. After
redo settles, the retained turn's `restorationSubjectIds` and the claim registry
stay at one, at N of 20 / 30 / 600 / 1,000. An earlier draft assertion that read
`80` after redo was invalid: it made a bulk `setAll(80)` the only designated
turn and left the rekey as a bare `transaction().confirm()` (which creates no
restoration entry), so `undo()` / `redo()` replayed the `setAll` and correctly
re-latched participation to the collection — the assertion observed the
last-write latch after redoing an unrelated bulk turn, a property the latch was
never promised to hold. The replacement test redoes the rekey turn itself.

## RESTORATION-TURN-STATE-0 (pre-registered)

Known defect: every retained restoration turn forces and pins
`CanonicalTurn.state = snapshotState(tree.$)` at settlement, which for an
EntityMap is a distinct collection-width `state.<collection>.all` array per
retained turn (~810 KB of an ~842 KB one-turn increment at 100k; 20 retained
turns pin 20 distinct arrays). `entry.state` is consumed by `restoreState()` in
undo, redo, and `jumpTo`, by the net-zero/dedup `===` / `deepEqual`
discriminator, and is a non-optional field of the public
`RestorationHistoryEntry<T>` from the public `getRestorationHistory()`.

**Frozen law:** a retained restoration turn owns only the information required to
reverse and reapply that causal turn. Historical-state materialization is a
distinct semantic job and must not force every retained turn to own a full-tree
snapshot unless a direct semantic falsifier proves that coupling necessary.

**Not frozen:** effect-only representation, checkpoint cadence, checkpoint plus
replay, lazy historical materialization, public history-state redesign. Compact
effect/delta turns lead; none is the conclusion.

**Sequence.** (1) Source inventory of every read/copy/comparison/serialization/
public-type exposure of `RestorationHistoryEntry.state` (tests and docs
included), classified semantic requirement / public contract / diagnostic
convenience / incumbent mechanism, resolving whether `.state` on
`getRestorationHistory()` is (A) a frozen promise of eagerly-stored historical
NaturalValue, (B) a promise the API can provide it, or (C) unfrozen inherited
shape. (2) Blind semantic falsifier: independently derive the minimum
information each frozen operation needs and try to break a turn-local
delta/effect representation, weighting `jumpTo` (forward/backward/across
eviction), redo branching, transactions, structural identity, address fallback,
held references, and later authoritative realization truth. (3) Choose the
representation from evidence.

**Mandatory proof set:** ordinary reversal (scalar, nested field, whole-entity
replacement, add, remove, rekey, reorder/prepend); identity/address (held
subject across remove/undo, fresh same-key occupant isolation, address fallback,
position restoration); causal composition (multi-write one subject, multi-field
one entity, mixed scalar+entity turn, net-zero composed turn, transaction
confirm/rollback/atomicity); temporal authority (undo, redo, redo
truncation/branching, jumpTo backward/forward, jump across an evicted-window
boundary, later realization truth after authored work); lifecycle (eviction,
reset, destroy, descriptor/claim release). The later-realization-truth case is a
killer falsifier: a naive before/after delta must not restore stale authored
truth over later authoritative truth.
