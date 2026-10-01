# Store comparison — methodology

A small Angular 22 application measures state libraries on one operational workload: a dispatch
grid with live updates, refetches and stacked editors. It answers "what does this store cost a
real Angular screen?" — bundle bytes, startup work, update-to-render latency, reactive fan-out
and retained memory — in a real browser with Angular rendering.

It does **not** measure GT Web or any other product. Its numbers are evidence about the stores
under this workload, not about an application's own components.

## Arms

| id               | what                                                                          | resolved from                                                                               |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `signals`        | hand-written Angular signals store: the no-library floor                      | app source                                                                                  |
| `ngrx`           | `@ngrx/signals` SignalStore + `withEntities`                                  | npm                                                                                         |
| `st14`           | `@signaltree/core` 14.1.3                                                     | npm                                                                                         |
| `st15-released`  | `@signal-tree/angular` 15.3.1                                                 | npm (aliased)                                                                               |
| `st15-candidate` | an unreleased build, from packed tarballs                                     | `scripts/install-candidate.mjs`                                                             |
| `st15-undo`      | the candidate with `transactions()` and `restoration()` installed, never used | a second install of the same tarballs (`st15-candidate-enhanced`), so its chunk is separate |

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
   Grid construction happens during route setup, before the `load` clock; `load` measures
   population of an already-created empty store. Editor construction is included in editor-open timing.
4. **Changed edit values.** Timed field edits use a per-run counter to avoid equality no-ops.
   Refetch deliberately includes unchanged rows (~95%); it is a reconciliation workload.
   This rule does not claim that every refetch or reorder must change every value.
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
- In the historical artifacts, SignalTree's `ids()`/`all()` are versioned projections and return a new array on every field
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
  functions are optimised. Editor application-object retention is therefore measured from snapshots excluding code
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
  grid JS-heap bytes per row (`Runtime.getHeapUsage` after GC): the difference between
  `(afterLoad - baseline)` at the largest and smallest N, divided by their row-count difference.
  This endpoint slope cancels constant costs, but includes any row-dependent code, grid and
  harness cost. A single N is reported as gross delta/N, not a slope; JS heap retained after teardown versus before the load; and for
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
- `--cpu <rate>` applies CDP CPU throttling on the recorded host. Rate 4 is a synthetic
  slowdown, not a calibrated midrange laptop/phone or battery-mode simulation.
- Results go to `results/<timestamp>.json` with the environment: Node, Chromium, OS, CPU, the
  throttle rate, harness git SHA and dirty flag, installed versions, and evidence described below. The console report gives medians across rounds and the min–max across rounds.
- A crashed, timed-out or INVALID arm fails the run (exit 1) and is reported as such, never
  silently dropped.

## Variants and attribution tools

- `--footer off` leaves the status chips out, so nothing reads `statusCounts` while timing. Every
  arm's counts recount all rows. This removes that recount; grid projection, rendering and
  scheduling remain in the timing.
- `scripts/profile.mjs` records a CPU profile around one driver operation and reports self and
  inclusive time by function and by owner (arm chunk, Angular + harness, GC), with `--callers`
  for the code that pays for a helper. Build with `NG_BUILD_MANGLE=0` first so names survive.
- `scripts/heap-per-row.mjs` diffs heap snapshots before and after a load and reports bytes per
  row by object kind. It reports signed net change across all categories (including those
  disappearing after load) and positive-category growth separately. It excludes code, hidden,
  synthetic and `system /` objects; includes grid/harness objects; and uses snapshot `self_size`,
  not transitive retained size. Top rows are ordered by absolute change, not truncated before
  totaling. This single-N measure cannot decompose the whole-heap slope from `run.mjs`.
  A timestamped JSON captures all category deltas and artifact evidence.

Both are for attribution only; quote timings from `run.mjs`. Results and analysis so far are in
`FINDINGS.md`.

## Evidence and fairness limits

`run.mjs`, `heap-per-row.mjs` and `size-matrix.mjs` record SHA-256 file manifests for the
harness, source/fixtures and both installed candidate aliases, plus lock/config hashes.
Browser tools also hash the files in the served root, including custom roots. Candidate
`.candidate.json` claims are stored separately from the observed installed-file fingerprints;
tarballs are rehashed when available and labeled `match`, `mismatch`, `unavailable` or `unknown`.
Missing or malformed manifests are explicit. When available, candidate tarballs are extracted
into temporary directories and compared with installed package files. `installedMatchesTarballs`
is true only when both Angular and its nested kernel match the claimed tarball hashes and
extracted payloads, false on a demonstrated mismatch, and `unknown` when verification cannot
complete. Package comparison excludes dependency directories and the installer's `.candidate.json`;
the nested kernel is compared separately. Unavailable archives and unsupported archive entries
remain unknown rather than being certified. Temporary extraction trees are removed.

The installer optionally reads `source-commit.txt` (one full 40-character Git SHA) and/or
`source-manifest.json` (`{"sourceCommit":"<full SHA>"}`) beside the tarballs. It records sidecar
hashes, `source.claimedCommit`, tarball hashes and installed payload hashes in each alias's
`.candidate.json`. Missing, malformed or conflicting sidecars give an unknown claim. The
matrix and browser evidence expose `claimedSourceCommit` alongside freshly observed hashes.
A valid SHA remains **unverified source provenance**: a sidecar does not prove the tarball was
built from that commit. Old installed manifests remain unknown until explicitly reinstalled;
no historical run is backfilled from a newly discovered sidecar.

`node scripts/build-with-provenance.mjs` hashes app/config/script inputs and the complete
installed dependency tree (including pnpm link targets, excluding `.cache`) before invoking
`pnpm exec ng build --configuration production --stats-json --output-path dist`. It sets
`NODE_ENV=production` and clears `NG_BUILD_*` overrides. After a successful build it requires
unchanged inputs, hashes the served files, and writes `dist/build-provenance.json` outside the
served directory. Starting a new build removes the previous receipt so failure cannot leave
an old success claim. This is a local build receipt, not signed or independently reproducible
source provenance. Keep packages, inputs and served files unchanged during the comparison.

Default-root browser comparisons and heap attribution require this receipt. A present receipt
with changed installed bytes, sources/scripts/configuration, Node runtime or served bytes is
rejected before launching a browser. The browser tools also recheck at completion. Custom
experimental roots without a receipt stay explicitly unknown/development; a stale receipt is
never silently downgraded to unknown. The size matrix builds and verifies its own per-cell
bundles, so it does not depend on the Angular-app receipt.

For a fresh comparison, retain the exact packed artifacts and record their source commit,
then install and use the provenance wrapper immediately before measuring. Preserve each output; all result writes
are exclusive, so a filename collision fails instead of overwriting evidence. Do not retrofit
new manifests onto historical runs. Existing runs in this directory remain development evidence.
New browser runs set `development` and `developmentReasons` for quick/short sampling, custom
roots, or busy load samples at either endpoint. Passing this heuristic does not certify a quiet
machine throughout the run. A/A is a descriptive control, not a confidence interval; a failed
control cannot provide a noise band. Cross-arm digest agreement also cannot detect a common
bug; the driver's expected DOM checks complement it.

The shared driver and examined arms use generated plans outside the timed callback, matched
visible rows and editor checks, per-library burst APIs (NgRx batches heterogeneous patches in
one updater; SignalTree loops `updateOne`), and explicit store destruction. The historical
claims that alternative batching forms were slower were not rerun during this audit. Recheck
those choices if the final candidate changes their costs. Reorder remains asymmetric as
explained above; footer-off still includes grid overhead. The idle-enhancer arm is not an
active-undo comparison.

The size matrix is a separate fixture-size experiment. It compiles **once** per cell with
browser platform, ESM, minification, tree-shaking, `ngDevMode=false` and
`process.env.NODE_ENV="production"`. The exact measured bytes are then executed in Node
(with production mode and the Angular compiler available for external Angular JIT) and must
produce the expected result before the cell receives sizes. This verifies production-bundle
fixture behavior, not browser rendering or every branch of a feature. Bundle and input hashes,
production defines, externals and compression options are recorded alongside candidate evidence.
A wrong/missing result makes the cell INVALID and the matrix exits 1.

`@angular/*`, `rxjs`, `rxjs/*` and `tslib` are external in that matrix. Thus it measures library
code plus fixture glue **conditional on those dependencies already being shared**. RxJS is
not free for a consumer that otherwise does not need it; those bytes are excluded, not proved
absent or counted elsewhere. This is not a total application-download comparison. Hand-rolled
undo proves only the fixture's undo/redo behavior, not parity with SignalTree's full restoration
semantics. Classic NgRx async fixtures omit `@ngrx/effects`; they measure plain async dispatch.

## Running

```sh
pnpm install --ignore-workspace
node scripts/install-candidate.mjs <dir with signal-tree-{angular,kernel}-*.tgz>
node scripts/build-with-provenance.mjs
node --test scripts/lib/*.selftest.mjs
node scripts/run.mjs --rounds 5 [--rows 1000,10000,50000] [--cpu 4] [--arms signals,ngrx,...]
```

Quiet the machine first (close browsers and builds; plug in power). A run on a busy machine is
for development only and says so in its output.
