# Store comparison — methodology

A small Angular 22 application measures state libraries on one operational workload: a dispatch
grid with live updates, refetches and stacked editors. It answers "what does this store cost a
real Angular screen?" — bundle bytes, startup work, update-to-render latency, reactive fan-out
and retained memory — in a real browser with Angular rendering.

It does **not** measure GT Web or any other product. Its numbers are evidence about the stores
under this workload, not about an application's own components.

## Arms

| id               | what                                                     | resolved from                   |
| ---------------- | -------------------------------------------------------- | ------------------------------- |
| `signals`        | hand-written Angular signals store: the no-library floor | app source                      |
| `ngrx`           | `@ngrx/signals` SignalStore + `withEntities`             | npm                             |
| `st14`           | `@signaltree/core` 14.1.3                                | npm                             |
| `st15-released`  | `@signal-tree/angular` 15.3.1                            | npm (aliased)                   |
| `st15-candidate` | an unreleased build, from packed tarballs                | `scripts/install-candidate.mjs` |

The app is standalone (`pnpm install --ignore-workspace`): no arm can resolve SignalTree from
workspace source. One `@angular/core` instance serves every arm; each SignalTree arm resolves
its own kernel.

## Fairness rules (binding on every arm)

1. **Idiomatic, and the best idiomatic form.** Each arm uses its library the way that library's
   documentation recommends, choosing the cheapest documented form of the same operation. A
   competitor arm is written as an expert in that library would write it. No arm may use another
   library's internals or undocumented API.
2. **Same behaviour.** Every arm must produce the identical grid snapshot and editor results for
   the same seeds; the runner compares digests and marks a mismatching arm INVALID (exit 1).
   A fast wrong arm is not a result.
3. **Setup outside the clock.** Data generation, seeds and plans are prepared before timing.
   Construction is timed only where construction is the thing measured (`load`).
4. **No no-op writes.** Every timed write stores a value never stored at that location before
   (a per-run counter), so equality short-circuits cannot flatter or penalise an arm.
5. **No hoisting asymmetry.** Paths and lookups are resolved inside the timed operation, the way
   application code does it.
6. **Shared everything else.** Grid, editor, generator, driver, timing and digest are shared code.
   An arm folder contains only store code.
7. **What a library genuinely does differently is the result.** An immutable rebuild versus a
   targeted write is architecture, and is left alone.

## Independent fairness review — dispositions

A read-only reviewer audited every arm and the shared harness for asymmetry in either
direction. Its findings, and what was done:

| Finding                                                                                           | Disposition                                                                                                                                               |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signals` refetch diffed rows and wrote only changed ones (an equality short-circuit only it got) | **Fixed**: writes every row, like `setAll` in the library arms                                                                                            |
| `signals` status counts depended on N row signals (N producer edges no library arm pays)          | **Fixed**: one version signal, untracked recount (still O(n), like every arm)                                                                             |
| Footer counts and editor DOM were never verified; `statusCounts` was not in the digest            | **Fixed**: footer checked after every status edit and every scenario; editor inputs, lines, total and dirty checked after edits; counts are in the digest |
| Editor field/line edits were untimed                                                              | **Fixed**: every edit is timed to stable                                                                                                                  |
| Burst called `update` 100× (NgRx's `updateEntity` clones the entity state per call)               | **Fixed**: `updateMany` in each library's batch form (NgRx: one `updateEntities` with a per-id `changes` function)                                        |
| SignalTree could batch with the `batching()` enhancer                                             | **Measured, not used**: no difference at 10k rows (Angular already coalesces signal writes into one render), +0.7–1.2 KB                                  |
| SignalTree could batch with `upsertMany`                                                          | **Measured, not used**: ~2× slower at 10k rows, 12–25% slower at 50k, both versions                                                                       |
| NgRx builds an environment injector per editor                                                    | **Measured, immaterial**: 0.46 µs per create + destroy (Node, Angular 22) against ~200 µs editor opens                                                    |

Architectural differences that stay (rule 7) and must be stated with any result:

- SignalTree `entityMap` has no documented reorder; `move` is a `setAll` of the reordered list
  ("reorder via full reconciliation"). NgRx patches its `ids` state directly, which is documented
  state but not an entity updater — a mild advantage for NgRx on `move`.
- SignalTree's `ids()`/`all()` are versioned projections and return a new array on every field
  write, so the grid's window re-slices on every edit; NgRx `ids` is unchanged by a field update.
- NgRx `updateEntity`/`removeEntity` copy the entity map and ids on every write (O(n)).
- `row(id)` is the raw writable signal in `signals`, and one wrapping `computed` per visible row
  in the library arms.

## Timing

Each timed operation starts in a fresh task (a message-channel callback, as an input or socket
event would) and runs from `performance.now()` immediately before the first store write to the
resolution of `ApplicationRef.whenStable()` with the DOM updated (the driver verifies the
expected text is in the DOM for visible rows). Zoneless change detection, OnPush everywhere.
The page is cross-origin isolated (COOP/COEP), so the clock resolves to microseconds; the runner
refuses to measure a page that is not.

Harness defects found and fixed while validating (each would have distorted every arm):

- Back-to-back awaited writes ran inside one chain of timer callbacks, and HTML clamps a timer
  nested 5 deep to >= 4 ms, so every arm's p95 sat at ~5 ms. Fixed by the fresh task above.
- Without isolation, `performance.now()` is coarsened to 100 us; 1k-row edits read 0.0/0.1 ms.
- A CDP global handle ("DevTools console") kept the in-page driver alive after teardown, and
  through it the whole grid store, so every arm appeared to retain its rows. The host now
  disposes the driver; heap-snapshot retainer paths were used to find and confirm this.
- `Runtime.getHeapUsage` counts compiled code, which keeps growing for many editor cycles as
  functions are optimised. Retention is therefore measured from heap snapshots excluding code
  and V8/system objects.

Render counters count template evaluations of row, footer and editor components, so "one row
changed" can be told apart from "every visible row re-rendered".

## Scenarios

For each row count in `--rows` (default 1000, 10000, 50000):

- **load** — `setAll` of N generated rows into an empty store, to stable.
- **refetch** — `setAll` of the same N ids with ~5% of rows changed, to stable.
- **edits** — 200 awaited single-row updates for each `EditKind`: position of a visible row,
  position of an off-screen row, status of a visible row. Reported p50 / p95 / p99.
- **burst** — 100 updates in one synchronous task, then one wait.
- **reorder/remove** — 50 awaited moves, then 50 awaited removes.
- **editors** — 30 warm-up then 20 measured cycles of: open 3 stacked editors, edit, save the
  top one, close all. Open and close latency p50 / p95.
- **memory** — after `HeapProfiler.collectGarbage`:
  grid bytes per row (`Runtime.getHeapUsage`, marginal from the slope between row counts, so
  fixed module cost cancels); JS heap retained after teardown versus before the load; and for
  editors, application objects (heap snapshot, compiled code and system objects excluded)
  retained once during 30 warm-up cycles and per cycle over the next 20 (should be ≈ 0), with
  compiled-code growth reported separately; plus DOM node and listener counts
  (`Memory.getDOMCounters`) after teardown.
- **startup** — fresh browser, cache disabled: JS bytes transferred (gzip, from CDP
  `Network.loadingFinished.encodedDataLength`) to reach a rendered empty grid, and CDP
  `Performance.getMetrics` ScriptDuration / TaskDuration for that navigation. An arm's library
  cost is its JS bytes minus the `signals` arm's.

## Protocol

- One fresh Chromium per (round, arm, scenario group); groups are startup, grid, editors.
- Arm order rotates every round. Default 5 rounds; quote nothing from fewer than 5.
- An **A/A control** runs `st15-released` a second time as a separate arm in every round; its
  spread is the noise band. A difference inside the band is not a result.
- `--cpu <rate>` applies CDP CPU throttling (4 approximates a mid-range laptop on battery).
- Results go to `results/<timestamp>.json` with the environment: Node, Chromium, OS, CPU, the
  throttle rate, git SHA and dirty flag, every arm's installed version and the candidate tarball
  checksums. The console report gives medians across rounds and the min–max across rounds.
- A crashed, timed-out or INVALID arm fails the run (exit 1) and is reported as such, never
  silently dropped.

## Running

```sh
pnpm install --ignore-workspace
node scripts/install-candidate.mjs <dir with signal-tree-{angular,kernel}-*.tgz>
pnpm build
node scripts/run.mjs --rounds 5 [--rows 1000,10000,50000] [--cpu 4] [--arms signals,ngrx,...]
```

Quiet the machine first (close browsers and builds; plug in power). A run on a busy machine is
for development only and says so in its output.
