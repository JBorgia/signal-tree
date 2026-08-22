# Cross-library, real implementations

**Status:** re-measured 2026-08-21 on a repaired harness. Reproduce with
`node --expose-gc tools/bench-compare.mjs`.

> ⚠️ **The 14.0.0 revision of this page published an invalid comparison and both
> of its tables have been replaced.** Two independent defects: the memory column
> took its baseline after five timing iterations in the same process, and the
> settling rule was not neutral across arms — adding a turn boundary moves
> SignalTree by tens of MB and the other three by 0.00 MB, because SignalTree is
> the only arm here with a microtask-deferred notifier, weak caches and a
> `FinalizationRegistry`. Timing and retention now run in separate processes and
> every arm settles through `tools/lib/heap-quiescence.mjs`.
>
> **Re-measuring also exposed a throughput regression that is not a measurement
> artefact** — see "Open: the collection regression" below. It is unresolved,
> and the collection table should not be quoted as a current claim until it is.

Every arm implements the **same capability** using that library's own entity
API, not a simplified stand-in:

| arm            | implementation                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `signaltree`   | `entityMap({ selectId })`, `timeTravel()`                                                             |
| `ngrx-signals` | `signalState` + `@ngrx/signals/entities` (`setAllEntities`, `updateEntity`) — the official entity API |
| `elf`          | `createStore` + `withEntities`, and **`@ngneat/elf-state-history`** for undo                          |
| `raw-signals`  | a hand-rolled `Map` of per-entity signals + an id list — what you write with no library               |

One process per arm; timing is the median of 5 runs; memory is retained heap
after forced GC. History is enabled **only** for the undo/redo workload, so
each workload isolates one thing.

---

## Collection — build 10,000, 200 single-entity updates, read all

Reproduce with `node --expose-gc tools/bench-compare.mjs --n 10000`.

| arm            | median        | retained | 14.0.0 published   |
| -------------- | ------------- | -------- | ------------------ |
| elf            | **1.43 ms**   | 1.05 MB  | 1.43 ms / 0.92 MB  |
| raw-signals    | 5.05 ms       | 6.28 MB  | 4.60 ms / 6.16 MB  |
| ngrx-signals   | 10.22 ms      | 1.07 MB  | 10.98 ms / 0.93 MB |
| **signaltree** | **107.04 ms** | 11.44 MB | 3.24 ms / 1.29 MB  |

`retained` is the COLLECTION's cost. Each arm's library module graph is loaded
before the measured window, because it is not equal across arms and it is not
what this column is asking about: `@signaltree/core` (which pulls Angular)
retains 6.67 MB of modules, `@ngrx/signals` 5.88 MB, `@ngneat/elf` 2.18 MB.
Charging each arm its own import padded every number and compressed the gap
between them by ~4x. This figure agrees with the isolated layer probe in
[memory-profile.md](../architecture/memory-profile.md) to 0.03 MB.

**SignalTree is fourth of four, and this is a regression, not a re-measurement.**
The three other arms reproduce their 14.0.0 timings within noise on the
byte-identical harness. Only SignalTree moved, and it moved 36×.

The memory column moved for the harness reasons in the banner above. The TIMING
column did not: timing was never affected by the settling defect, the workload
is unchanged, and `tools/bench-compare.mjs` is byte-identical to the commit that
produced the published table.

### Open: the collection regression

`git diff 888336d1..HEAD -- tools/bench-compare.mjs` is empty, so the harness and
workload that measured 3.24 ms are the ones now measuring 115.32 ms. elf,
`@ngrx/signals` and raw-signals all land within ~5% of their published figures
across the same interval, which rules out the machine and the harness.

Decomposition (`node --expose-gc tools/bench-public-collection-layers.mjs --n
10000`) puts essentially all of it in initial population: `setAll(10k)` at
~116 ms, while steady-state `updateOne` stays at ~0.29 ms and the structural
mutations at ~0.4 ms. So the O(1)-write thesis is unaffected; what regressed is
bulk realization.

**Unattributed.** 681 commits separate the two measurements and no bisect has
been run — one was attempted in a git worktree and abandoned because `nx`
resolved the workspace root through the symlinked `node_modules` and wrote its
build into the main tree, which would have measured the wrong commit. Attributing
it needs a worktree with its own install.

---

## Undo/redo — 50 recorded writes, then 50 undos, over 10,000 entities

Reproduce with `node --expose-gc tools/bench-compare.mjs --n 10000`.

> ⚠️ **An earlier revision of this file published the opposite result.** It
> claimed SignalTree was 20× faster than elf. It was not measuring undo/redo at
> all — see "The retraction" below. These numbers are the corrected ones, and
> they are verified by postconditions every arm must satisfy.

| arm          | median       | retained | history                      | 14.0.0 published |
| ------------ | ------------ | -------- | ---------------------------- | ---------------- |
| **elf**      | **1.09 ms**  | 4.88 MB  | built-in `elf-state-history` | 1.24 ms          |
| signaltree   | **29.45 ms** | 29.70 MB | built-in `timeTravel()`      | 3.67 ms          |
| ngrx-signals | 177.21 ms    | 1.08 MB  | hand-rolled                  | 179.84 ms        |
| raw-signals  | 273.85 ms    | 6.31 MB  | hand-rolled                  | 278.44 ms        |

**SignalTree is ~27× behind elf and ~6× ahead of a hand-rolled history.** The
same regression pattern as the collection workload and almost certainly the same
cause: elf, `@ngrx/signals` and raw-signals reproduce their published timings,
SignalTree went from 3.67 ms to 29.45 ms. The published "~49× ahead of
hand-rolled" no longer holds; ~6× does.

elf remains ahead for a structural reason worth naming: it is an immutable
store, so an undo swaps ONE state reference — 3 µs, independent of collection
size. SignalTree holds per-entity signals, so restoring means writing values
back into them. That cost is now proportional to what CHANGED rather than to
the collection, but it is not a pointer swap and will not become one without
giving up the granular signals that are the point of the design.

### What the correction found

Splitting the workload showed the gap was never in recording:

|            | per write | per undo (before) | per undo (after) |
| ---------- | --------- | ----------------- | ---------------- |
| elf        | 38 µs     | 3 µs              | 3 µs             |
| signaltree | 44 µs     | **4,368 µs**      | **~40 µs**       |

Writes were always at parity. Every bit of the 150× was `undo`, because
`entityMap`'s restore called `setAll` **unconditionally** — rebuilding the
storage map, the id index and all 10,000 per-entity signals to apply a
one-entity change. 3.62 ms per undo, at any collection size.

Since a snapshot shares its entity objects with the live tree (499/500 identical
after a single edit), a reference walk finds exactly the rows that moved.
Restore now diffs and writes only those, with `setAll` as the fallback for any
add, removal, reorder or id change — correctness pinned by
`entity-restore-diff.spec.ts`, which tests the FALLBACK shapes rather than the
happy path, because a shortcut that is wrong about when it applies would
silently corrupt a restore.

> **Provenance, because this number was previously wrong in three places at
> once.** Earlier revisions published 78 µs (CHANGELOG), 237 µs (this table) and
> ~110 µs (the decomposition below) for the same quantity, none of them
> reproducible from a committed harness. Re-measured: **~40 µs per undo**,
> median of 5 runs, isolating the undo phase from the recording phase, with
> postconditions asserted (history reached 52 entries; the edited row actually
> reverted). Spread across runs was 36–43 µs with one 101 µs outlier, so treat
> it as "tens of µs", not a precise figure.
>
> **Quote the whole-workload table at the top of this section, not this
> figure.** That one comes straight out of
> `node --expose-gc tools/bench-compare.mjs --n 10000`, so anyone can re-derive
> it; a per-undo cost divided out of a combined workload is exactly how one
> measurement became three published numbers. An independent run of that harness
> while writing this note gave 3.97 ms / 1.64 ms against the 4.32 / 1.76 above —
> same ordering, same ratio, ordinary run-to-run spread.

### Where the remaining undo cost actually is, and what is NOT worth optimising

Figures from `node --expose-gc tools/bench-compare.mjs --n 10000`.

The obvious next optimisation was to have restore write the snapshot's entity
objects in DIRECTLY, since it already holds them — `upsertOne` routes to
`updateOne`, which does `{ ...entity, ...changes }` and allocates a new object
rather than reusing the one the snapshot is holding. Decomposing a 10,000 entity
undo first:

| component                                            | cost       | when it is paid            |
| ---------------------------------------------------- | ---------- | -------------------------- |
| `tree()` snapshot capture, cold (O(N) pointer array) | 38 µs      | on **record**, not on undo |
| the reference diff walk over 10,000 rows             | 15 µs      | on undo                    |
| `updateOne` for the one changed entity               | **< 1 µs** | on undo                    |

> **This table previously stated a "total per undo" of ~110 µs, which its own
> components do not sum to** (38 + 15 + <1 ≈ 54 µs) — and it counted the
> snapshot capture as an undo cost when capture happens when the entry is
> _recorded_. The undo-side components come to ~16 µs, and the measured
> end-to-end figure is ~40 µs; the remainder is the restore write path and
> per-call overhead the decomposition does not break out. Corrected rather than
> deleted, because the conclusion below still holds and the arithmetic error is
> the instructive part.

**The spread is under 1 % of the cost**, so removing it would buy nothing
measurable while adding an internal replace-without-merge path that bypasses the
interceptor and tap handlers `updateOne` runs. Declined on the numbers rather
than on taste.

What remains is the O(N) pointer array, and it is inherent: a history entry has
to hold a snapshot, and a snapshot of a changed collection is a new array of N
pointers. A warm `tree()` costs 0 µs — the memo already covers the unchanged
case — so the cost only appears where the collection genuinely moved. For scale:
the `structuredClone` a hand-rolled history performs on the same data is
2,869 µs, ~75× more.

### The retraction

<!-- measured: describes timer granularity in a harness that was fixed (100 yields at ~1 ms of setTimeout(0) floor). It is a property of setTimeout, not of any library, and there is no generator for it. -->

The first version of this harness measured SignalTree **doing nothing**:

```
SYNC (as the harness was written)   history=1    reverted=false     0.51 ms
AWAITED                             history=52   reverted=TRUE    215.12 ms
```

`timeTravel()` records on a notifier FLUSH, which is scheduled with
`queueMicrotask`. The workload was `async` but had no `await` between the writes
and the undos, so the flush never ran: SignalTree recorded **one** entry, called
`undo()` fifty times with nothing to undo, and restored nothing — while every
other arm performed fifty `structuredClone`s of ten thousand entities. Published,
that table showed SignalTree winning by orders of magnitude **on the strength of
being idle**.

The fix is not just an `await`. The workload now asserts its own postconditions,
for **every** arm:

- the writes actually landed (`value === 900_049`);
- the undos actually reverted it (`value !== afterWrites`);
- history held ≥ 50 entries **after the writes** — captured there, because
  stack-based arms drain their history as they undo while SignalTree keeps
  entries and moves a pointer, and checking afterwards failed three arms for a
  difference in semantics rather than for doing no work.

A benchmark that cannot detect it did nothing is the same defect class it exists
to expose. This is the fifth instance of that pattern in this repo, after
`grep "Failed tasks"` exiting 0, pre-publish passing on 5 of 7 packages,
typecheck reading only typing specs, and a property test passing while data was
dropped.

One further correction during the fix: yielding with `setTimeout(0)` added
~100 ms of pure timer granularity to every arm (100 yields × ~1 ms), which
swamped the differences. A microtask yield is enough to flush the notifier and
costs nothing.

### Structural sharing does not extend to collection contents

Measured on a 500-row collection, changing ONE entity:

```
unrelated branch shared : true      <- O(depth) holds here
rows node shared        : false
all ARRAY shared        : false
entity objects shared   : 499 / 500
```

So the accurate statement is **O(depth) for plain nested state, but
O(collection-length in pointers) per history entry for a collection**, with the
entity objects themselves shared. The comment in `time-travel.ts` claiming
"only the nodes that actually changed — O(depth) per entry" is true of nested
objects and false of collections, and the undo/redo column above is exactly
where that shows up.

## Reactive granularity — the half the timings above do NOT measure

Everything above is **store time with no change detection and no DOM**. That
matters, because a store's job is only half the work: the other half is how many
components have to re-render as a result, and the two can point in opposite
directions. elf's undo is a pointer swap, which is cheap in the store — the
question is what it costs downstream.

Measured: 1,000 rows, one per-row reactive consumer each, change **one** entity,
count how many consumers are invalidated.

| arm                                | consumers invalidated by a 1-entity change |
| ---------------------------------- | ------------------------------------------ |
| **signaltree** (`byId(i)`)         | **1 / 1000**                               |
| **elf** (`selectEntity(i)`)        | **1 / 1000**                               |
| `@ngrx/signals` (`entityMap()[i]`) | **1000 / 1000**                            |

**elf does NOT lose granularity to its pointer swap** — `selectEntity` filters
per entity, so a whole-state reference swap still notifies only the row that
changed. The intuition that an immutable swap must invalidate everything is
wrong for elf, and it is worth stating because it would be an easy and
flattering thing to assume.

**`@ngrx/signals` does lose it, and by the widest margin here.** Reading
`entityMap()` takes a dependency on the whole collection, so every consumer
recomputes on every change. That is a property of the idiomatic usage, not a bug
— but at 1,000 rows it is 1,000 component invalidations where the other two have
one.

### What this is worth, as arithmetic rather than measurement

<!-- measured: NOTHING. The figures in this section are arithmetic from the invalidation counts above, using a stated per-render assumption. The section says so in its own body. There is no generator because nothing here was measured. -->

A signal read is tens of nanoseconds; an Angular component re-render is
microseconds to milliseconds. At 1,000 rows and a conservative 10 µs per render,
one change costs ~10 µs of rendering with granular invalidation and ~10 ms
without — three orders of magnitude, and it lands on the main thread. That is
arithmetic from the invalidation counts above, **not** something this harness
measured.

### An attempt to price it in time, and why it failed

<!-- measured: a discarded run, recorded because it failed. The harness read every consumer after every write, which is not what a framework does, so these numbers describe the broken harness rather than the libraries. Kept as a record of the mistake; do not quote them. -->

Timing 200 writes with 1,000 live consumers attached gave signaltree 29.6 ms,
elf 31.3 ms and `@ngrx/signals` 13.0 ms — i.e. the arm with the WORST
granularity looked fastest. The harness read every consumer after every write,
which is not what a framework does: it renders only what is invalidated. So the
loop priced 200,000 signal reads and erased the very property it was meant to
measure.

Recorded rather than deleted because the shape is seductive: a benchmark that
forces all consumers to re-read will always flatter the least granular store.
Measuring this properly needs a real Angular render loop, which is not something
a Node harness can stand in for.

## Reading these honestly

<!-- measured: node --expose-gc tools/bench-compare.mjs -->

**What this does not show.** `@ngrx/store`, `@ngxs/store` and Akita are absent —
they need an Angular JIT bootstrap to construct, and standing up a full Angular
environment per arm would be a bigger confound than the comparison is worth.

**The hand-rolled arms are not strawmen, but they are not optimal either.** They
use `structuredClone` per entry, which is the obvious implementation. A user who
knew to store inverse patches instead would land far closer to elf. The number
to quote against `@ngrx/signals` is therefore "what the absence of a primitive
costs a typical user", not "the best achievable".

**Testing elf without `elf-state-history` would have been a strawman**, and the
first run of this harness did exactly that — it reported elf at 177 ms, in the
same band as the hand-rolled arms, because it was hand-rolled. Installing the
package it actually ships moved it to 1.27 ms. Combined with fixing our own
idle arm, that is the difference between "SignalTree wins by 3,000×" and
"SignalTree loses by 150×" — from the same harness, two bugs apart.

**History was on for everyone in the first run**, including during the
collection workload, which charged signaltree and elf for recording while
ngrx-signals and raw-signals paid nothing — they have no primitive to enable.
Separating the workloads changed the collection ordering.

---

## The comparison that should be made: `@ngrx/signals`

Task-level figures: `node tools/bench-vs-signalstore.mjs`. Collection and
undo/redo figures: `node --expose-gc tools/bench-compare.mjs --n 10000`.

Everything above ranks four libraries on every axis, which is the honest way to
measure and the wrong way to decide. Almost nobody is choosing between SignalTree
and elf: elf is a general-purpose store with an Angular adapter, and a team that
picked it did so for reasons this table does not contain. **The library an
Angular team is actually choosing between SignalTree and is `@ngrx/signals`** —
same framework, same signals-first premise, same problem.

Against that one comparison, measured here:

|                                                         | SignalTree   | `@ngrx/signals` |           |
| ------------------------------------------------------- | ------------ | --------------- | --------- |
| consumers invalidated by a 1-entity change (1,000 rows) | **1**        | 1,000           | **1000×** |
| collection: build 10k + 200 updates + read all          | 107.04 ms    | **10.22 ms**    | 0.10×     |
| undo/redo: 50 writes + 50 undos over 10k                | **29.45 ms** | 177.21 ms       | **6.0×**  |
| collection retained (10k, module graph excluded)        | 11.44 MB     | **1.07 MB**     | 0.09×     |
| retained per entity (marginal)                          | 1,176 B      | **89 B**        | 0.08×     |
| history primitive                                       | built in     | hand-rolled     |           |

**This is materially worse than the 14.0.0 version of this table claimed**, which
read 3.2× / 49× / 0.67×. One win survives intact and is still the one that
matters most (granularity, and it is not a benchmark result — see below); undo/
redo remains a win at 6.1× rather than 49×; collection throughput and per-entity
memory are now losses of 10× and 13× rather than a win and a 1.5× loss.

The memory line moved for harness reasons — `@ngrx/signals` reads 89 B/entity
either way, SignalTree's 136 B was measured before the heap settled. The
collection line moved for a real and unattributed regression. Neither is
explained by "the price of the biggest win", and that framing has been removed
rather than restated at a worse ratio: 13× the per-entity memory of the
alternative is a cost that has to be argued for on its own, and 1,172 B/entity
against a 120 B payload is not obviously the price of an id index.

**The granularity row is the one that matters and it is not a benchmark result.**
Reading `entityMap()` in `@ngrx/signals` takes a dependency on the whole
collection, so every consumer recomputes on every change. At 1,000 rows that is
1,000 component invalidations against one. A signal read is tens of nanoseconds
and a component re-render is microseconds to milliseconds, so at a conservative
10 µs per render one change costs ~10 µs of rendering here and ~10 ms there —
on the main thread. That is arithmetic from the invalidation counts, not
something this harness timed, and the attempt to time it is recorded above as a
failure.

**Where elf belongs in the story.** elf matches the granularity (`selectEntity`
filters per entity, so a pointer swap still notifies one row) and beats us on
undo and collection throughput. The difference worth stating is not a number:
granularity is SignalTree's default and elf's opt-in, per selector. If you write
`store.pipe(selectAllEntities())` — the obvious call — you get the coarse
behaviour, and the fine behaviour is available to whoever remembers to ask for
it. That is a real distinction and it is smaller than a benchmark table makes it
look.

## What to claim

<!-- measured: node --expose-gc tools/bench-compare.mjs; retained memory via tools/memory-compare.mjs and docs/architecture/memory-profile.md -->

- ✅ **Against `@ngrx/signals`: granular by default, 1 invalidation vs 1,000.**
  The clearest and most defensible claim in this document, and the comparison
  most readers are actually making.
- ⚖️ **Undo/redo: ~6× faster than hand-rolled, ~23× behind elf.** (Was ~50× and
  ~2.5×; the same unattributed regression moved this too.) Defensible
  against "you would have to write this yourself", not against elf. The original
  "20× faster than elf" was an artefact of measuring an idle arm; the corrected
  measurement then exposed a real O(collection) defect in restore, now fixed.
- ✅ **Snapshots are nearly free.** A held `tree()` of 10k entities costs 0.01 MB
  ([memory-profile.md](../architecture/memory-profile.md)) — one of the few
  claims here that survived re-measurement unchanged, and now on equal footing
  with its baseline rather than compared across settling points.
- ⛔ **Collection throughput: DO NOT CLAIM.** Fourth of four and 36× slower than
  the same harness measured at 14.0.0, unattributed. See "Open: the collection
  regression".
- ❌ **Not per-entity memory, and by more than previously stated.** Highest of
  four at 1,176 B/entity marginal against 89 B for `@ngrx/signals`
  ([memory-profile.md](../architecture/memory-profile.md)). The previously
  published 136 B was measured before the heap had settled.
- ⛔ **Do not claim anything about churned collections.** Retention grows without
  bound as keys turn over
  ([entity-churn-retention.md](../architecture/entity-churn-retention.md)).
- ❌ **Not bundle size.** Recorded elsewhere and unchanged.
