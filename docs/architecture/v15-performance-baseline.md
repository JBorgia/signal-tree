# 15.0 performance baseline

**Status:** MEASURED at `87a790eb`, on a quiet machine, after declarative
construction and zero-owner reclamation. This is the reference point later work
is compared against, not a claim about any other machine.

Every table names the tool that produces it. Re-run the tool before trusting a
number here; nothing in this file is hand-copied from a scratch run.

## Read this before comparing anything to anything

**Machine load moves these numbers more than most code changes do.** In one
session, on a single unchanged build, `entitymap-setAll` measured 17.5 ms,
18.6 ms, 27.1 ms, 30.2 ms, 49.6 ms and 66.1 ms — a 3.8x spread with no code
between the runs. Two consequences, both learned the expensive way here:

1. **Never compare two builds measured at different times.** A sequential
   before/after produced an apparent 21% `setAll` regression and a 50%
   `updateOne` regression that both vanished under interleaving; the same
   method later produced an apparent 30% _improvement_ in the other direction.
   Interleave the arms — build A, build B, build A, build B — in one run.
2. **Quote the absolute and the spread, never the ratio alone.** A ratio of two
   sub-millisecond medians is a statement about the load at that moment.

`tools/bench-public-collection-layers.mjs` and `tools/bench-vs-signalstore.mjs`
both report min/max alongside the median for this reason. If the ranges overlap,
there is no result.

## Operation cost — `tools/bench-public-collection-layers.mjs --samples 9`

n = 10,000 entities, one child process per arm, median of 9.

| arm                                  |   median | what it is                        |
| ------------------------------------ | -------: | --------------------------------- |
| `plain-array-construct`              |  1.60 ms | 10k rows as a plain array leaf    |
| `entitymap-declare`                  |  0.72 ms | declaration, no population        |
| `entitymap-setAll`                   | 18.16 ms | initial population                |
| `entitymap-addMany`                  | 18.14 ms | initial population                |
| `entitymap-updateOne`                |  0.19 ms | one field of one row of 10k       |
| `entitymap-updateOne-dependent-read` |  0.33 ms | update plus a dependent read      |
| `entitymap-addOne`                   |  0.19 ms | structural                        |
| `entitymap-removeOne`                |  0.31 ms | structural (includes reclamation) |
| `entitymap-changeId`                 |  0.24 ms | structural                        |
| `entitymap-projection-all`           |  1.28 ms | full projection read              |
| `entitymap-projection-ids`           |  0.30 ms | id projection                     |
| `entitymap-projection-asMap`         |  1.46 ms | map projection                    |

`setAll` is consistent with the 17.86-19.64 ms recorded in
[setall-regression.md](./setall-regression.md) after the subject-position
transport deletion. `removeOne` includes zero-owner reclamation on this fixture
(no enhancers configured) and is unchanged from before it — see
[retired-subject-churn.md](./retired-subject-churn.md), "RESOLUTION".

## Live retention — `tools/bench-entity-layers.mjs`

10,000 entities, 3 fields each, quiesced per `tools/lib/heap-quiescence.mjs`,
one process per arm.

| arm                          | retained | per entity | what it isolates                      |
| ---------------------------- | -------: | ---------: | ------------------------------------- |
| `L0-payload`                 |  1.14 MB |      120 B | payload floor, no library             |
| `L1-physical-stores`         |  4.34 MB |      455 B | physical entity stores only           |
| `L2-entity-semantics-nometa` |  4.59 MB |      481 B | entity realization, incl. Angular     |
| `L3-entity-semantics`        |  4.59 MB |      481 B | metadata flags before any node exists |
| `L4-public-entitymap`        |  4.64 MB |      487 B | **the public baseline**               |
| `L5t-nodes-transient`        | 10.06 MB |    1,055 B | residue of a full read, not held      |
| `L5-nodes-held`              | 36.80 MB |    3,859 B | every row node/fields held            |
| `L5m-nodes-held-nometa`      | 36.75 MB |    3,853 B | control for L5                        |

L5 minus L5m is **6-7 B/entity** across runs. The metadata accessors are not a
memory opportunity; see the AMENDMENT in
[capability-authority-audit.md](./capability-authority-audit.md), which
supersedes an earlier ~1,710 B/entity figure.

## Churn retention — `tools/bench-entity-churn-retention.mjs`

1,000 live rows held constant, 50 full key generations.

| arm                 | per retired | note                                |
| ------------------- | ----------: | ----------------------------------- |
| `no-history`        |         6 B | zero-owner retirement forgets it all |
| `no-history-reads`  |         6 B | observation costs nothing once retired |
| `time-travel`       |     1,310 B | a restorer exists                   |
| `time-travel-reads` |     1,859 B | restorer plus observation           |

At 150 rounds the two `no-history` arms read **-6 B/retired** — the quiescence
noise floor, not memory being created. Tripling the retirements does not scale
the total, so retention is no longer linear in retired subjects and the
pre-registered criterion in
[entity-churn-retention.md](./entity-churn-retention.md) is MET.

**Do not treat 6 B as the budget.** The claim is the asymptote, and
`tools/check-retired-subject-slope.mjs` gates it by measuring at two subject
counts — 117 B/retired would pass any byte budget stable enough to keep, and
117 B/retired is unbounded growth.

The owned arms are untouched and still grow: 1,310 B/retired at 50 rounds,
1,407 B at 150. History-aware eligibility is a separate problem.

## Workload classes — `tools/bench-workload-classes.mjs`

Counts are ASSUMPTIONS, pre-registered in
[workload-assumptions.md](./workload-assumptions.md); the plus/minus is max-min
across samples, and a delta inside the spread is not a result.

| class              |       N | construct (ms) | steady (ms)   | B/entity |
| ------------------ | ------: | -------------: | ------------- | -------: |
| `POINT_HEAVY`      |  10,000 |     18.23±7.57 | 45.18±37.38   |      468 |
| `PROJECTION_HEAVY` |  10,000 |     14.49±2.80 | 477.44±26.58  |      464 |
| `REACTIVE_FANOUT`  |  10,000 |    14.80±14.31 | 221.24±13.88  |      465 |
| `BULK_LOAD`        | 100,000 |   159.32±24.88 | 283.88±44.02  |      406 |
| `REALTIME`         |  10,000 |     13.73±3.45 | 850.50±252.08 |      466 |

Construct and steady are reported separately on purpose: a read-path change
cannot move construction, so summing them lets construction variance impersonate
a steady-state win.

## Against @ngrx/signals — `tools/bench-vs-signalstore.mjs`

Interleaved arms, median of 9. @ngrx/signals 21.1.1.

| task                                 | SignalTree | SignalStore |
| ------------------------------------ | ---------: | ----------: |
| write one field 10 levels deep       |   0.011 us |    1.109 us |
| update 1 row of 50k + dependent read |   1.075 us |  795.337 us |
| write, then read whole state 10x     |   0.744 us |    2.596 us |
| 50 writes with undo history          |   1.046 us |  311.071 us |

Single-entity update as the collection grows — **the architectural claim**:

| collection | SignalStore | SignalTree |
| ---------: | ----------: | ---------: |
|      1,000 |    13.57 us |   1.331 us |
|     10,000 |    51.47 us |   0.469 us |
|     50,000 |   870.45 us |   0.574 us |

SignalStore is LINEAR in collection size; SignalTree is FLAT. **Quote the shape,
never a multiplier** — the multiplier is a function of n (~10x at 1k, ~1,500x at
50k), so any single value describes the fixture rather than either library.

## Against elf, @ngrx/signals and raw signals — `tools/bench-compare.mjs --n 200`

Each arm implements the same capability with that library own entity API.

| arm            | collection | undo/redo | history     |
| -------------- | ---------: | --------: | ----------- |
| `raw-signals`  |    0.10 ms |   5.87 ms | hand-rolled |
| `elf`          |    0.26 ms |   0.14 ms | BUILT-IN    |
| `ngrx-signals` |    0.51 ms |   3.97 ms | hand-rolled |
| `signaltree`   |    0.74 ms |   2.96 ms | BUILT-IN    |

**elf wins both arms at this size and is not a weak reference** — it is the
fastest competitor in this repo benchmarks. SignalTree is last on the
200-entity collection arm. The claim this repo makes is about how cost scales
with collection size, not about winning at n=200, and the table above is kept
unflattering on purpose so that distinction stays visible.

## Bundle — `tools/check-bundle-budget.mjs`, `tools/size-report.mjs`

| target                | prod gzip |  budget |
| --------------------- | --------: | ------: |
| `signaltree-bare`     |   9.92 KB | 10.0 KB |
| `signaltree-entities` |  20.27 KB | 21.0 KB |

Bare grew 0.47 KB in 15.0 and it is a design cost, not a diagnostic: declaring
enhancers puts the resolver and the configuration validator on every tree
mandatory construction path. Full attribution is on `signaltree-bare` in
`tools/check-bundle-budget.mjs`. This is **not** a small bundle relative to the
field; do not sell it as one.
