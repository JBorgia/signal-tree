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

| Population | Marginal bytes/unit | Interpretation |
| --- | ---: | --- |
| E1 active control | 272.7 B/entity | explicit `active` and `restoreAllowed` |
| compact active | 256.6 B/entity | active implicit from `activeNode` |
| mutated compact active | 256.6 B/entity | ordinary updates add 0.0 B/entity |
| retired, strong exceptional state | 248.7 B/retired subject | no active key or ordering node |
| attribution control without lifetime truth | 164.4 B/retired subject | invalid candidate; isolates overflow |
| held retired | 257.9 B/held retired subject | external strong held-record reference |
| reactivated | 295.1 B/entity | compact record plus key-index churn |
| fresh same-key occupant | 553.0 B/old-new pair | held retired subject plus distinct live subject |

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
