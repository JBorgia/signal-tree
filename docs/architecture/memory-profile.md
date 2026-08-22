# Retained heap — the axis that actually constrains a low-end device

**Status:** measurement, re-measured 2026-08-21 on a repaired harness.
Reproduce with `node --expose-gc tools/memory-report.mjs`, decomposed with
`node --expose-gc tools/bench-entity-layers.mjs`.

> **Every number in the 14.0.0 revision of this document was measured before the
> heap had settled and has been replaced.** The harness applied a turn boundary
> to one scenario and not the others, so rows that were meant to be compared sat
> at different points on the reclamation curve. The settling rule now lives in
> `tools/lib/heap-quiescence.mjs`, every scenario gets the same one, and
> `tools/check-memory-harness.mjs` fails the build if a scenario ever measures
> less than a scenario it strictly contains. The superseded figures are kept in
> "What the old numbers were" below rather than deleted, because two claims in
> this repo were argued from them.

Bundle size and retained heap are different constraints, and conflating them
leads to optimising the wrong one. **Bytes over the wire decide load time;
retained heap decides whether the page survives.** This project has extensive
bundle data and, until now, none on memory — which is awkward, because memory is
where the architecture should win and size is where it explicitly does not
compete.

---

## The numbers

Node 24.3 / V8 13.6, forced GC, one process per scenario.

| scenario                                          | retained | per unit           | collectable after release |
| ------------------------------------------------- | -------- | ------------------ | ------------------------- |
| `signalTree`, 20k scalar leaves                   | 37.29 MB | **1,955 B/leaf**   | ✅                        |
| plain object of 20k RAW Angular signals           | 11.01 MB | **577 B/signal**   | ✅                        |
| plain object, 20k keys (floor)                    | 1.22 MB  | 64 B/key           | ✅                        |
| `entityMap`, 1k entities                          | 1.34 MB  | 1,407 B/entity     | ✅                        |
| `entityMap`, 10k entities                         | 11.35 MB | **1,190 B/entity** | ✅                        |
| `entityMap` 10k **+ a held `tree()` snapshot**    | 11.36 MB | 1,191 B/entity     | ✅                        |
| `entityMap` 10k **+ `byId()` on every row, HELD** | 59.61 MB | **6,251 B/entity** | ✅                        |
| `entityMap` 10k + `byId()` on every row, not held | 16.62 MB | **1,743 B/entity** | ✅                        |

2,000 repeated `tree()` reads grew the heap by **0.044 MB**.

### Where the 10k collection's bytes are

`node --expose-gc tools/bench-entity-layers.mjs`, same protocol, one process per
arm, 3-field entities:

| layer                                               | retained | per entity |
| --------------------------------------------------- | -------- | ---------- |
| plain `Map` of the same entities (payload floor)    | 1.14 MB  | 120 B      |
| `StructuralStore` + `EntityValueStore`, direct      | 4.34 MB  | 455 B      |
| `createEntitySignal` + `setAll`, metadata off       | 11.20 MB | 1,175 B    |
| `createEntitySignal` + `setAll`, metadata on        | 11.21 MB | 1,176 B    |
| **public `entityMap` + `setAll`**                   | 11.26 MB | 1,181 B    |
| + `byId()` on every row, nodes dropped              | 16.62 MB | 1,742 B    |
| + `byId()` on every row, **all nodes held**         | 59.62 MB | 6,252 B    |
| all nodes held, owner/subject/position metadata off | 43.31 MB | 4,541 B    |

Read carefully, because the obvious reading of this table is wrong in two ways.

**The layer names are narrow on purpose.** The physical-stores row is a floor
for those two classes, **not** a measurement of "the framework-neutral kernel" —
it constructs them directly and so skips mutation framing, commit machinery and
identity plumbing that a real neutral path pays for. And `createEntitySignal`
imports `signal`/`computed` from `@angular/core` at its top, so Angular is
already present from that row down; there is no "entity semantics without
Angular" arm here and there cannot be one without a different build.

**The held-node delta is not "Angular".** +48.36 MB is 81% of the all-held
configuration, and 16.31 MB of it is the owner/subject/position metadata
accessors. The remainder is jointly the Angular field `computed()`s **and** the
callable node object, its `set`/`update`/`asReadonly` closures and its property
descriptors. No arm separates those, so neither is charged alone.

---

## What these say

**1. The tree structure is nearly free; the cost is Angular's signals.**
619 B/leaf against 577 B for a bare Angular signal holding the same value — the
whole accessor tree, the marker registry, the memo and the path plumbing add
**about 42 bytes per leaf, ~7%**. Anyone weighing "SignalTree vs raw signals" on
memory is choosing between 619 and 577; the differentiator is not the overhead,
because there barely is one.

The real number in that row is the other comparison: a signal costs ~9× a plain
object property (577 B vs 63 B). That is the price of reactivity itself and it
is Angular's, not ours — but it is the number that matters when someone asks
"can I put 20,000 reactive values on a phone".

**2. A snapshot of 10,000 entities costs 0.01 MB.**
`entityMap` 10k retains 2.85 MB; the same collection with a `tree()` snapshot
**held live** retains 2.86 MB. Structural sharing means the snapshot shares the
entity objects by reference rather than copying them — which is exactly the
property [`snapshot-aliasing.spec.ts`](../../packages/core/src/lib/snapshot-aliasing.spec.ts)
documents from the correctness side. Read whole state as often as you like; it
is not a memory event.

**3. Reading does not grow the heap.** 2,000 full `tree()` reads added 0.044 MB
— noise. The memo is keyed per node and invalidated by writes, so it grows with
the SHAPE of the tree, not with how often it is read. A memo that grew per read
would be a leak in any app that renders in a loop.

**4. Nothing leaks.** Every scenario is collectable once released, verified by
`WeakRef` rather than by a heap delta.

---

## Two methodology traps, both of which produced wrong answers here first

Recorded because both are silent and both invent a problem that does not exist.

**Heap deltas without forced GC measure ALLOCATION, not retention.** Already on
record at 8× (25.71 MB vs 3.32 MB) in
[materialisation-prior-art §3.2](./materialisation-prior-art.md). The tool now
refuses to run without `--expose-gc`.

**Forced GC is still not settled, and an unequal settling rule is worse than a
wrong one.** This file's 14.0.0 numbers were all read after four synchronous
`gc()` calls with no turn boundary — except one scenario, which had a
`yieldBeforeMeasure` flag. That produced a published ablation in which
materialising a node for all 10,000 rows retained 42 MB LESS than not doing it.
Both numbers were individually plausible, which is why review did not catch it.
`tools/lib/heap-quiescence.mjs` now drains turn boundaries until the heap stops
moving, identically for every arm, and `tools/check-memory-harness.mjs` rejects
any table where a scenario measures less than one it strictly contains.

**Scenarios sharing one process contaminate each other.** The first draft ran
them all in one and reported `entityMap 10k + a held snapshot` retaining LESS
than the same entityMap alone — strictly more data retaining less, which cannot
be true. It was the previous scenario's garbage plus V8's lazy reclamation. One
process per scenario, the same rule the benchmark harness already needed
(design-thesis §3, realisation 13).

**And a third, specific to leak checks:** a heap delta after release is not
evidence of a leak. V8 does not shrink `heapUsed` promptly, so the first version
of the "reclaimed" column reported every `entityMap` scenario as a 2.3 MB leak.
A `WeakRef` is the definitive test — but it is **not cleared within the same
synchronous turn**, however many times you call `gc()`. Without yielding to a
macrotask first, every scenario reports a leak, _including a plain object_, which
is how that bug announced itself.

---

## Cross-library — measured, and it does NOT favour us

`node --expose-gc tools/memory-compare.mjs`. Same 10,000 entity objects in each
library's idiomatic collection, one process per arm.

| arm                        | @10k     | **marginal**       | fixed   |
| -------------------------- | -------- | ------------------ | ------- |
| elf                        | 3.13 MB  | **94 B/entity**    | 2.23 MB |
| raw Angular signals        | 6.57 MB  | **89 B/entity**    | 5.72 MB |
| `@ngrx/signals`            | 6.66 MB  | **89 B/entity**    | 5.81 MB |
| **SignalTree `entityMap`** | 18.03 MB | **1,172 B/entity** | 6.84 MB |

The `fixed` column is essentially each library's module graph, measured
independently at 6.67 / 5.75 / 5.88 / 2.18 MB — which is why the marginal slope,
not the `@10k` absolute, is the comparable number. The three competitor arms
moved by ~2 B/entity when the harness was repaired. SignalTree's marginal went
from a published **134 B/entity to 1,172** — because
the boundary the old protocol omitted is worth ~54 MB to this arm and 0.00 MB to
the other three. A protocol only one arm is sensitive to is not a comparison.
The corrected figure agrees with `memory-report.mjs` independently: 1,172 B
marginal against 1,190 B per entity at 10k, from a different tool.

**MARGINAL is the slope between 1k and 10k**, so every fixed cost — module load,
Angular init, the harness — cancels. It is the only column that answers "what
does one more row cost". The entity objects are ~89 B of it and no library
controls that part.

**SignalTree is the most expensive per entity of the four**: ~45 B/row over a
raw signal, ~43 B over `@ngrx/signals`. That is the id index and the entity
storage map, and it is the price of `byId()` being O(1) and per-entity writes
not touching the array. It buys something; it is not free; and the honest
statement is "granular reactivity costs ~50 % more per row than holding an
array", not "we use less memory".

### The number that actually matters for a large list

| SignalTree usage at 10k                       | per entity  |
| --------------------------------------------- | ----------- |
| entity objects alone (the floor)              | 89 B        |
| plain array leaf                              | 113 B       |
| `entityMap`, collection read via `.all()`     | 315 B       |
| `byId()` on every row, nodes **not retained** | **844 B**   |
| **`byId()` on every row, nodes HELD**         | **3,573 B** |

`byId()` materialises a per-entity node so that row can be bound and written
independently — the whole point of the feature — and it is by a wide margin the
most expensive thing in this document.

**Reading is now cheap; holding is not, and that distinction is the finding.**
The node cache used to be a strong `Map`, so merely CALLING `byId()` allocated
permanently: 4,149 B/entity, 39.6 MB at 10k, whether or not anything kept the
node. It is now a `WeakRef` cache with a `FinalizationRegistry`, so a walk that
reads every row and keeps nothing costs 844 B/entity — 4.9× less, and the
documented pattern for granular updates stopped being the expensive one.

Holding them still costs 3,573 B/entity. That is not the cache failing; a
materialised per-entity node is real state, and no cache policy makes retained
state free. The weak cache removed an accidental cost, not the intrinsic one,
and saying otherwise would be quoting the flattering half of the measurement.

**This is the memory guidance that matters on a phone:** call `byId()` freely,
but _keep_ a node only for rows a user can actually interact with. A 10,000-row
list holding a node per row retains 34 MB, and nothing else in this document
comes close to it.

> Both rows are produced by the harness now, not by hand. The 4,149 B figure sat
> in this file as prose while the cache underneath it was changed from strong to
> weak — prose does not re-run. The transient row also needs a macrotask yield
> before its heap is read: a `WeakRef` is not cleared in the same synchronous
> turn however many times you call `gc()`, and without the yield it measured
> 3,565 B/entity, indistinguishable from held, which would have read as "the
> weak cache does nothing".

## What is still NOT measured

- **`@ngrx/store`, `@ngxs/store` and Akita are absent.** They need an Angular JIT
  bootstrap to construct, and standing up a full Angular environment per arm
  would introduce a bigger confound than the comparison is worth. Their absence
  is not evidence either way.
- **No browser numbers.** Node/V8 only. A phone's constraint is the same shape
  but the absolute figures will differ.
- **No DOM.** This measures the store, not the rendering that consumes it.

---

## What the old numbers were

Kept because two claims in this repo were argued from them, and a reader who
remembers them deserves to see what changed rather than a quietly different
table.

| scenario                                 | 14.0.0 (unsettled) | repaired       |
| ---------------------------------------- | ------------------ | -------------- |
| `entityMap`, 10k entities                | 2.85 MB            | 11.35 MB       |
| `entityMap` 10k + `byId()` all, HELD     | 34.08 MB           | 59.61 MB       |
| `entityMap` 10k + `byId()` all, not held | 8.05 MB            | 16.62 MB       |
| cross-library marginal                   | 134 B/entity       | 1,172 B/entity |

A separate audit run of the same unsettled harness reported `entityMap` 10k at
**59.95 MB** and 1k at **6.11 MB**. Three mutually inconsistent generations of
this table were in circulation — 2.85, 59.95 and 11.35 MB for the same shape —
which is itself the argument for the consistency gate rather than for more
careful re-measurement.

**The guidance did not change direction.** Holding a node per row was the
dominant cost before and is the dominant cost now; it is larger than the old
table said (59.61 MB, not 34.08 MB), and the base collection is larger too
(11.35 MB, not 2.85 MB). What changed is that the numbers are now reproducible
to 0.01 MB across runs and agree across two independent tools.

## Churn is a separate, open finding

Everything above measures a collection built once and held. A collection whose
KEYS churn — a filter changing, a page turning, a poll replacing rows — grows
without bound even with constant live membership: 1,000 live rows across 150
key generations retain 119.72 MB in a tree with no history enhancer attached and
no way to restore any of the retired subjects. Measured, attributed and
pre-registered in [entity-churn-retention.md](./entity-churn-retention.md);
reproduce with `node --expose-gc tools/bench-entity-churn-retention.mjs`.

## The collection cost, with module load excluded

`bench-compare.mjs` loads each arm's library before the measured window, so its
`retained` column is the collection alone:

| arm          | 10k collection retained |
| ------------ | ----------------------- |
| elf          | 1.05 MB                 |
| ngrx-signals | 1.07 MB                 |
| raw signals  | 6.28 MB                 |
| SignalTree   | 11.44 MB                |

### Two separate memory problems, not one

The held-node cost does not explain the base cost, and conflating them hides the
harder question:

```text
A. UNOBSERVED COLLECTION BASE
   SignalTree ~1,176 B/member marginal   vs   @ngrx/signals ~89 B
   ~13x, before a single byId() node exists.
   Why does merely EXISTING in an entityMap cost this much?

B. MATERIALIZED OBSERVATION
   base ~11.4 MB  ->  all nodes held ~59.6 MB
   ~48 MB incremental, largely understood: per-field computeds,
   closures, property descriptors, metadata accessors.
```

B is increasingly explained. **A is not**, and it is the one that contradicts
the intended separation — an untouched member should be paying for its canonical
value, its membership/indexing, and whatever lifetime facts are independently
earned, not for observation machinery it has never been observed through. 13×
does not have to become 89 B/member — SignalTree owns more semantics than
`@ngrx/signals` does — but at that ratio every major component has to justify
itself individually.

**This is the honest cross-library retention comparison and it is harsher than
the absolutes suggested.** An earlier repaired-but-unhoisted run read 18.12 /
6.92 / 11.99 / 3.36 MB, which put SignalTree at ~2.6x `@ngrx/signals`; that gap
was compressed by charging every arm its own import cost. Excluding it,
SignalTree is ~10.7x, and the independent marginal slope agrees at ~13x
(1,176 B/entity against 89 B). The 11.44 MB figure also agrees with the isolated
layer probe's 11.41 MB to 0.03 MB, from a different tool.
