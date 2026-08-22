# The 158 B/entity existence overhead — decomposed

**Status:** decomposed. One owner found, and it is NOT the same defect class as
the previous two. No change made.
Reproduce with `node --expose-gc tools/bench-entity-layers.mjs --n 10000`.

Baseline after `db4dbcc5`:

```text
L0 payload                  120 B/entity
L1 physical stores          455 B/entity
L2 entity semantics         608 B/entity
L4 public entityMap         613 B/entity
```

`L2 -> L4` is 5 B, so effectively all of the overhead sits between the two
physical stores and `createEntitySignal`.

## Where the 153 B goes

Same protocol, imports hoisted so no arm is charged module load:

| arm                                                 | retained | per entity |
| --------------------------------------------------- | -------: | ---------: |
| A — structural + value stores only                  |  4.34 MB |      456 B |
| B — A plus a rebuilt `MaterializedEntityProjection` |  5.56 MB |      583 B |
| C — the projection alone, stores released           |  1.93 MB |      202 B |
| D — full `createEntitySignal` + `setAll`            |  5.80 MB |      608 B |

```text
MaterializedEntityProjection   127 B/entity   (83% of the gap)
everything else                 25 B/entity   (16%)
```

Confirmed by removal: with the projection never populated, L4 measures
**487 B/entity (4.64 MB)** instead of 613 B (5.85 MB) — a 126 B/entity
difference, matching the 127 B from arm B/A.

### The residual is mostly fixed, not marginal

Run at three sizes, the residual `D - B` does not hold constant:

| arm                         |  n=1k | n=10k | n=50k |
| --------------------------- | ----: | ----: | ----: |
| A stores only               | 389 B | 455 B | 397 B |
| B stores + projection       | 514 B | 583 B | 514 B |
| D full `createEntitySignal` | 708 B | 608 B | 526 B |
| **D − B**                   | 194 B |  25 B |  12 B |

`D − B` falls with N, so it is dominated by fixed per-collection cost — roughly
**~180 KB fixed plus ~9 B/entity marginal** fits all three points. The fixed part
is the collection's own structures (the version signal, the four collection
computeds, notifier state, caches), which amortize away and are not an
existence-per-entity cost at all.

So the marginal accounting is:

```text
MaterializedEntityProjection   ~127 B/entity
everything else marginal          ~9 B/entity
fixed per collection            ~180 KB, amortizing
```

⚠️ **Measurement caveat.** Arms A and B read 389/455/397 and 514/583/514 across
sizes — the same structures, ±60 B/entity apart. Retained-heap deltas at these
magnitudes carry V8 page granularity, so _cross-size_ per-entity figures are
rough. The 127 B projection figure does not depend on that: it comes from a
paired same-N comparison (both with and without the projection at 10k), which is
the reliable form. Treat the ~9 B and ~180 KB split as indicative only.

The cost is structural, not payload: a `Map<K, ProjectionNode>` entry plus a
`{key, value, previous, next}` node per entity — its own doubly-linked list,
maintained in parallel with the ordered index `StructuralStore` already keeps
(`activeNodesByKey`, `activeNodesBySubject`, and its own linked list).

## It has no production reader

Mechanically verified across `packages/core/src`:

```text
projection reader methods called in production
  .get(...)        0
  .entries()       0
  .snapshot()      1   -> snapshotStorageProjection
                        -> exposed ONLY as
                           __snapshotStorageProjectionForTesting
```

`EntityMutationFrame` receives the projection and only ever writes to it —
`rebuild`, `removeEntry`, `rekeyEntry`, `appendEntry`, `replaceEntry`. It never
reads it. Meanwhile the actual query path — `getProjectedEntity`,
`getProjectedEntries`, and through them `all()`, `ids()`, `map()`, `count()` —
derives everything from `structuralStore.activeKeysSnapshot()` plus
`valueStore.backingForSubject()`, never from the projection.

So in production the materialized projection is **maintained on every mutation
and read by nothing**.

## Falsifier result

Population disabled, full core suite run: **17 failures, every one an assertion
about the projection's own contents.** Names like "reconstructs the materialized
projection exactly from structural and value ownership", "rebuilds projection
from owners", "projects rekey incrementally while preserving authoritative
order", "leaves projection untouched until explicit projection runs".

The two that sound like broader contracts — "does not partially add when
upsertMany later fails" and "does not partially remove, update, or allocate when
a later setAll arrival blocks" — assert atomicity through the **public API first**
(`count()`, `byIdOrFail`, `byId`), and those assertions pass. Their failures are
the _additional_ `__snapshotStorageProjectionForTesting` comparison. The
atomicity property does not depend on the projection; the tests merely use it as
a second instrument.

## ⚠️ This is NOT the previous defect class, and the reading is genuinely open

The last two findings were eager realization of observation attached to mere
existence. This is not that. Two readings fit the evidence equally well and they
point in opposite directions:

```text
READING 1 — dead weight
  a derived index that nothing consumes.
  127 B/entity plus per-mutation maintenance, for nothing.
  -> delete it, and the ~17 tests that describe it

READING 2 — an unfinished optimization
  the query path currently walks activeKeysSnapshot() and does a value-store
  lookup per key on every all()/ids()/map() recompute. A materialized ordered
  index is exactly what would make those cheap. The index was built and
  maintained but never wired into the readers.
  -> finish it: point getProjectedEntries() at the projection
```

Reading 2 has direct support: `all()` measured 2.004 ms and `asMap()` 2.199 ms
at 10k in the RC decomposition, which is the cost of that walk. If the
projection were read instead, those could fall — and the 127 B/entity would be
buying something.

Deciding between them is a product question about which axis to spend on
(per-entity retention vs projection read cost), not something the retention
measurement settles. It should not be resolved by whichever change is easier.

## What is NOT claimed

- Not that the projection is a defect. It has no reader today; that is a fact
  about wiring, not about whether an ordered index is earned.
- Not that the remaining 25 B/entity is understood. It is not attributed.
- Not that deletion would be free: it would remove the instrument several
  atomicity tests use, so those tests need rewriting against the public API
  rather than deleting.

## Resolved into a three-way decision table

The fork was mis-stated as two options. There are three:

```text
A  projection maintained, reads derive from the stores   <- committed
B  projection maintained, reads use the projection
C  projection does not exist
```

A vs B is nearly free — the projection is built and maintained either way, so B
takes the read improvement at no extra memory or mutation cost. **A is dominated
by B**: if the projection stays, wiring it in is close to a no-brainer. The real
architectural question is B vs C, and it was never measured until now.

Candidate C was built: `MaterializedEntityProjection` removed, its allocation,
per-entity nodes and all mutation-frame maintenance deleted, authoritative
store-derived reads kept.

`tools/bench-workload-classes.mjs`, median of 5, ± is max−min:

| class            |   A steady |   B steady |   C steady | B vs C | verdict      |
| ---------------- | ---------: | ---------: | ---------: | -----: | ------------ |
| POINT_HEAVY      |   63.6 ±26 |   60.5 ±23 |   63.6 ±33 |   5.0% | inconclusive |
| PROJECTION_HEAVY |  455.9 ±29 |  439.0 ±13 |  466.6 ±23 |   5.9% | **B wins**   |
| REACTIVE_FANOUT  |  247.1 ±76 |  221.9 ±20 |  239.9 ±58 |   7.5% | inconclusive |
| BULK_LOAD        |  279.8 ±51 |  150.0 ±24 |  285.7 ±42 |  47.5% | **B wins**   |
| REALTIME         | 706.7 ±242 | 678.9 ±221 | 760.1 ±275 |  10.7% | inconclusive |

Memory: A and B identical; **C saves 127 B/entity at 10k and 105 B/entity at
100k**.

Three of five classes are inconclusive because the spread swamps the delta —
recorded as inconclusive rather than read as small wins. POINT_HEAVY performs
zero whole reads by construction, so its null result is a harness check, not a
finding.

### The trade is scale-dependent

```text
        memory cost of B      steady-state benefit of B
10k     1.27 MB               ~6% on projection-heavy
100k    10.5 MB               ~47% on bulk-load
```

Both scale with N. BULK_LOAD is where the projection genuinely earns: 100k
entities, whole reads dominant, steady time halved.

### Shared caching moves the bottleneck off `all()`

The cycle model made this visible. Angular `computed` is lazy **and shared**, so
five derived consumers over one collection cost

```text
1 x all() reconstruction  +  5 x traversal of the result
```

not five reconstructions. A representation that speeds up reconstruction is
therefore amortized across fan-out and hits a floor set by per-consumer
traversal — which is why REACTIVE*FANOUT shows a smaller effect than
PROJECTION_HEAVY despite more consumers. Reconstruction count equals \_cycle*
count, not read count.

That is the more durable finding here. Faster `state -> collection` does not
address `collection -> filter/sort/map/group/aggregate` per consumer.
Incremental derivation would; a materialized entity index does not.

### What must NOT justify the 127 B/entity

Not "rollback / history / sync might use it later". Those need change over time —
before, after, operation, version, origin, transaction. This projection holds
_current ordered entities_; it is not a mutation log, and calling it future
infrastructure for temporal features is the speculative architecture tax this
process exists to avoid. Keep it only if present benefit justifies present cost,
or if a concrete near-term capability reuses this actual representation.

## Per-operation decision table, B vs C

`tools/` scratch bench, median of 5–7, both candidates built from the same
commit with only the projection differing.

| operation            |       N | B keep+use | C delete | B vs C                   |
| -------------------- | ------: | ---------: | -------: | ------------------------ |
| `all()` recompute    |   1,000 |     0.0319 |   0.0546 | C 41.6% slower           |
|                      |  10,000 |     0.2391 |   0.3211 | C 25.5% slower           |
|                      |  50,000 |     1.3218 |   1.9379 | C 31.8% slower           |
|                      | 100,000 |     3.1761 |   5.0675 | C 37.3% slower           |
| `updateOne`          |     all |   ~0.00090 | ~0.00085 | noise                    |
| `replaceOne`         |     all |   ~0.00080 | ~0.00080 | noise                    |
| `addOne`+`removeOne` |     all |    ~0.0038 |  ~0.0035 | C faster, sub-µs         |
| `changeId` x2        |     all |    ~0.0050 |  ~0.0044 | C faster, sub-µs         |
| construction         |     all |          — |        — | inconsistent sign, noise |
| retained B/entity    |   1,000 |        500 |      355 | **−145 B**               |
|                      |  10,000 |        588 |      462 | **−126 B**               |
|                      |  50,000 |        522 |      406 | **−116 B**               |
|                      | 100,000 |        523 |      395 | **−128 B**               |

### Reading it

**B's only real win is `all()`**, and it is a consistent one: 1.25–1.7x across
four sizes, same direction every time, margins far outside run-to-run spread.

**C's wins are memory and, marginally, structural mutation.** The mutation
advantages are real in sign but sub-microsecond in magnitude — `addOne`/
`removeOne`/`changeId` differ by ~0.0005 ms — so they should not carry weight.
Construction is noise: the sign flips across sizes, which is what a
maintenance-cost difference of this size looks like against setAll variance.

So the trade reduces to one line:

```text
B pays ~126 B/entity to make all() 1.25-1.7x faster.
C recovers ~126 B/entity and gives that back.
```

Both terms scale linearly with N:

```text
          B memory cost      B all() saving per recompute
10k       1.26 MB            0.082 ms
100k      12.8 MB            1.891 ms
```

### What decides it

Not a benchmark. The break-even depends on realized recomputations per lifetime,
which is exactly the quantity nobody has measured (see
[collection-access-profile.md](./collection-access-profile.md)). At 100k a
single recompute saves 1.9 ms, so a store doing thousands of them over its life
recovers the 12.8 MB easily; a store doing ten does not.

Against the assumption ledger: A5 ("10k–100k supported") is marked _assumption_,
not observed — there is no application evidence above 10k. If A5 softens, B's
best case softens with it, because that is where its advantage is largest.

A7 is the binding constraint: permanent per-entity memory needs repeated benefit
**or** broader architectural use. B has repeated benefit only for
projection-heavy stores, and no broader use today — the shared-cache finding
above shows it does not touch the per-consumer traversal that dominates reactive
fan-out.
