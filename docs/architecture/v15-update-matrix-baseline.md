# Update-cost matrix — checkpoint 1 (post-Step-6 baseline)

**Status:** BASELINE, measured at `d487a4ae`. Reproduce with
`node --expose-gc tools/bench-update-matrix.mjs --axis all`.

**These are not v15's published numbers.** Checkpoint 1 of 3:

```text
1. now              post-Step-6, lifetime semantics stable, rollback defect fixed
2. after Step 8     history-aware reclamation may touch bookkeeping on every write
3. RC freeze        clean pinned environment, multiple repetitions
```

The reason to take it now is that the implementation is known-correct and the
next change is a *memory* change that could cost time on the hot path. Without a
before, that cost is unattributable.

## Read this before quoting a cell

- **Quote the SHAPE, never a cell.** The question is whether update cost stays
  ~O(1) in unrelated collection size and scales with the consumers actually
  affected. A single number is a statement about this fixture and this machine.
- **Machine load moves these more than most code changes do** — see the warning
  in [v15-performance-baseline.md](./v15-performance-baseline.md). Compare runs
  of this tool only against other runs taken back to back.
- **Both configurations, always.** `raw` is minimum equivalent functionality;
  `featured` is a production configuration with history. A library doing less
  looks faster, and reporting one column is how a comparison becomes an
  advertisement.
- `*` = HAND-ROLLED: the library has no such primitive, so the cell measures
  what its absence forces on a user. `n/a` = no equivalent, not measured.
  `†` = reduced sample count, see the notes.

## The core hot path — µs per update

```text
UPDATE ONE FIELD               1k       10k      100k     shape
  raw
    signaltree               0.93      1.25      1.67     flat
    elf                      0.99      5.91     77.22     linear
    ngrx-signals             5.45     45.72   1331.19     linear
    raw-signals              0.12      0.14      0.28     flat
  featured
    signaltree               2.39      2.22      2.92     flat
    elf                      1.58      4.53    133.13     linear
    ngrx-signals             5.62     45.10   1331.63     linear
    raw-signals              0.18      0.15      0.27     flat
```

**This is the architectural claim and it holds in both configurations.**
SignalTree and a hand-rolled map of per-entity signals are flat in collection
size; elf and @ngrx/signals are linear, because both rebuild or re-project state
proportional to what they hold. At 1k SignalTree is within noise of elf and
~6x @ngrx/signals; at 100k the gap is a different kind of statement entirely.

**Do not quote a multiplier.** It is a function of n — roughly 6x against
@ngrx/signals at 1k and ~800x at 100k — so any single value describes the
fixture, not either library.

**raw-signals is faster than SignalTree everywhere on this axis, and that is
worth stating plainly.** It is a `Map<id, signal>` with no entity semantics, no
history, no change reporting and no identity guarantees. It is the floor the
abstraction is paying for, not a competitor, and keeping it in the table is what
makes the cost of the abstraction visible instead of assumed.

## Change-tracking scaling — µs per update

```text
                              1k        10k
UPDATE 10 FIELDS   raw
    signaltree               1.64      2.04
    elf                      1.69      6.93
    ngrx-signals             6.00     52.86
    raw-signals              0.63      0.79
UPDATE 100 FIELDS  raw
    signaltree              21.62     21.74
    elf                     22.26     22.21
    ngrx-signals            27.43     66.75
    raw-signals             19.77     19.56
```

At 100 fields every arm converges: the work is dominated by building and
applying the patch object, not by the store. The interesting column is 10 fields
at 10k, where the collection-size term still separates them.

## Consumer fan-out — µs per update, 10k rows

```text
                          0 cons    1 cons   10 cons  100 cons
  raw
    signaltree              1.25      1.22      1.13      1.44
    elf                     6.00      5.87      7.46     14.89
    ngrx-signals           45.42     45.30     44.86     45.67
    raw-signals             0.14      0.19      0.17      0.18
  featured
    signaltree              2.17      2.21      2.23      2.15
    elf                     6.20      4.91      6.15     14.19
    ngrx-signals           45.02     44.94     44.60     44.74
    raw-signals             0.14      0.27      0.17      0.16
```

Every consumer watches the row being written, and all of them are read INSIDE
the timed region — a library that defers invalidation has not finished the
update until the dependent value is available again.

SignalTree is flat to 100 consumers. elf grows ~2.4x from 0 to 100 because its
select/pipe model re-projects per subscriber. @ngrx/signals is flat here too,
but at a level set by its collection-size term rather than by fan-out.

## Batching and transactions

```text
BATCH OF 100 UPDATES          1k        10k
    signaltree (featured)  154.81    134.19     = 1.35 µs/update
    ngrx-signals           515.19   4212.18     = 42 µs/update
    elf                       n/a       n/a     no batching primitive
    raw-signals               n/a       n/a     no batching primitive

UPDATE + ROLLBACK             1k        10k
    signaltree (featured)   90.15    395.22
    ngrx-signals           391.61*  3812.03*    hand-rolled snapshot/restore
    raw-signals            387.15*  4215.56*    hand-rolled snapshot/restore
    elf                       n/a       n/a     no transaction primitive
```

`signaltree` reports `n/a` for batching in the RAW config on purpose: without
`batching()` declared there is no primitive, and the raw config is minimum
functionality. The hand-rolled rollback arms are what the absence of a
transaction boundary forces — `stateHistory().undo()` was NOT substituted for
elf, because history is not a transaction boundary.

SignalTree's rollback is not flat in collection size (90 -> 395 µs from 1k to
10k). That is the history/transaction term, and it is the same term Step 8 is
about.

## Retention after quiescence — 200 updates, then settle

```text
                              1k        10k      100k
  raw
    signaltree             0.62MB    4.66MB   39.53MB
    elf                    0.16MB    0.98MB   10.11MB
    ngrx-signals           0.18MB    1.00MB   10.14MB
    raw-signals            0.65MB    6.21MB   61.46MB
  featured
    signaltree             2.47MB   20.62MB  189.32MB
    elf                    2.18MB   16.32MB  184.83MB
    ngrx-signals           0.18MB    1.00MB   10.14MB
    raw-signals            0.65MB    6.21MB   61.46MB
```

This column exists because speed that hides retention shows up nowhere else.

**SignalTree retains ~4x elf and @ngrx/signals in the raw config.** That is the
per-entity signal, node and metadata cost decomposed in
[v15-performance-baseline.md](./v15-performance-baseline.md) — 487 B/entity at
the public baseline — and it is the price of the flat update column above. Both
things are true and both belong in any honest summary.

In the featured config SignalTree and elf converge (189 vs 185 MB at 100k):
history dominates, and both keep 200 entries. @ngrx/signals stays at 10 MB
because it has no history primitive to configure — that row is not a win, it is
a missing feature.

## CORRECTION — the OOM footnote, and what it actually is

This section originally read: *"the history-recording update loop accumulates,
a previous sample's store is still reachable when the next is built, this is the
same residue Step 8 exists to attack."* **Two of those three claims were wrong**,
and `tools/probe-history-sample-isolation.mjs` is what refuted them. The
correction is kept in place rather than edited away, because the reasoning that
produced the wrong attribution is the part worth not repeating.

### What IS true — and it is a real finding

**An abandoned SignalTree that has taken writes is fully retained until
`destroy()` is called.** Six builds of the same fixture, one process:

```text
                        build 1   build 2   build 3   build 4   build 5   build 6
  tree abandoned         89.65    174.08    263.14    355.81    452.13       OOM
  tree destroyed          7.08      7.21      7.28      7.28      7.37      7.38
```

Nothing is released without `destroy()`; everything is released with it. Six
isolated processes each report **89.65 MB**, identical to two decimals, so a
single store's cost is flat and the in-process curve is pure accumulation.

That is a **lifecycle contract, not a leak** — and it is the answer to the
discriminator that mattered: it is not the harness holding completed samples
(`oneBuild` returns nothing), and it is not unbounded per-store growth.

### What was WRONG

**History is not what fills the heap.** One build costs 84.3 MB at ZERO updates
and 94.99 MB at 400 — so history is ~27 KB per wide update, and the 89 MB is the
seeded store. Attributing the OOM to "the history-recording update loop" was
reading a plausible cause into a measurement that did not distinguish it.

The claim reached the doc because the earlier evidence for it — "five setup-only
builds settle at ~277 MB" — came from an ad-hoc script using `heapUsed` after a
single `gc()`, not the quiescence protocol. It under-measured, showed sublinear
growth, and made construction look innocent. **The protocol difference produced
the wrong conclusion, in a repo that already has a documented rule about
exactly this.**

### OPEN ITEM — one cell, unlocalized, do not quote it

`signaltree / featured / update-100-fields @ 10k` still OOMs at 5 samples
**after** `destroy()` was added to the harness teardown. Seeding it costs
~142 KB/row inside the harness:

```text
  n=1000    151.8 MB      n=5000     714.8 MB
  n=2000    292.2 MB      n=10000   1418.1 MB
```

against ~8 KB/row in every standalone reproduction — including one that runs the
harness's own `IMPLS.signaltree` code inside the harness's own process and
settles at 82 MB. Linear in n, reproducible, and I could not localize it.

Three hypotheses were tested and refuted: cross-tree history contamination
through the global `PathNotifier` (a second tree's history stays at 1 entry),
the seed array being retained (kept in scope deliberately: no effect), and a
superlinear cost from constructing a third featured tree (81.9 MB standalone).

**Until this is closed, the featured wide-field row is not evidence of anything
about the library.** Every other cell reproduces standalone.

## What this baseline is for

Step 8 must not regress the flat columns. Concretely, re-run this tool and
require:

1. `update-one-field` stays flat across 1k -> 100k in BOTH configs.
2. `consumer fan-out` stays flat to 100 consumers.
3. `featured` retention improves, which is Step 8's whole point.
4. No new `n/a` or `OOM` cells.

If history-aware reclamation buys memory at the cost of the flat update column,
that trade needs to be made deliberately rather than discovered later.
