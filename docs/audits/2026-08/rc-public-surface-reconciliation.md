# RC Public Surface Reconciliation

Date: 2026-08-21
Branch: `history/gate1-frontier-cutover`
HEAD reviewed: `cf008545`

## Verdict

Update: the public-surface contradiction is resolved as of `cf008545`.
`node tools/check-rc-public-dispositions.mjs` passes, the tarball resolver sees
only the surviving core entry points (`.`, `./security`, `./storage`), and the
reviewer-discovered internal spec imports were repaired in `08b8fae5`.

Release engineering is in good shape: gates pass, self-tests prove the gates can fail, tarballs are checked, clean-checkout flow works, and CI publishing is wired for trusted publishing. The public API reconciliation blockers recorded below are retained as the audit trail for why the removals happened.

## Blocking Findings

### 1. Async markers were still public while the disposition map said delete

Current `@signaltree/core` root exports include:

- `asyncSource`
- `asyncQuery`
- `AsyncSourceConfig`
- `AsyncSourceLoader`
- `AsyncSourceMarker`
- `AsyncSourceSignal`
- `AsyncQueryConfig`
- `AsyncQueryFn`
- `AsyncQueryMarker`
- `AsyncQuerySignal`
- `ReadonlyAsyncSourceSignal`
- `ReadonlyAsyncQuerySignal`

The product-core map states `asyncSource()` / `asyncQuery()` are `DELETE — frozen, still physically present`. DR-4 may still require a future async-helper derivation, but that broader question does not revive these named carriers.

Original required action: Remove from RC public surface. Resolved: `165e71f9`
removed these names and their companion public types from the publishable root
surface. If a SignalTree-owned async helper later survives, it must be derived
from zero rather than inherited from these spellings.

### 2. Several public root exports were mechanically retained or not earned

The current root barrel still exports capabilities classified as `LC`, `AS`, not
earned, or unplaced in the map. Settled negative states are not fresh release
decisions.

Resolved: public removals from `22792f97`, `c53aa416`, `52644fa3`, `b339b921`,
`2029db99`, `76ab032c`, and `18fe5781` removed the settled-negative or unplaced
root exports/subpaths. Only a later independent authority may grant one of those
exact symbols again.

### 3. Collection retention is measured and attributed at the RC decision layer

Final baseline measured the 10k collection workload as:

- SignalTree: `122.72 ms`, `66.12 MB retained`
- NgRx signals: `10.41 ms`, `0.93 MB retained`
- Elf: `1.50 ms`, `0.92 MB retained`
- Raw signals: `4.87 ms`, `6.16 MB retained`

Follow-up retained-heap probes from `node --expose-gc tools/memory-report.mjs --json`
narrow the owner:

- plain object, 20k keys: `1.21 MB`, `64 B/key`
- raw Angular signals, 20k: `11.00 MB`, `577 B/signal`
- `entityMap` 1k after `setAll`: `6.11 MB`, `6410 B/entity`
- `entityMap` 10k after `setAll`: `59.95 MB`, `6286 B/entity`
- `entityMap` 10k plus held `tree()` snapshot: `59.96 MB`, `6287 B/entity`
- `entityMap` 10k plus held `byId()` for every row: `65.29 MB`, `6846 B/entity`
- `entityMap` 10k plus transient, unheld `byId()` for every row: `18.03 MB`, `1890 B/entity`

This rules out a held `tree()` snapshot and normal projection reads as the main owner. Held per-row facades add about `5.34 MB`, but the dominant `~60 MB` is already present in active `entityMap` storage/structural/value realization after `setAll`. Transient `byId()` materialization is collectable and substantially lower after a turn boundary, so the weak cache is not the 60 MB owner.

RC-level attribution: the broad memory result belongs to active public `entityMap`
realization, not kernel logical update cost, not held snapshots, and not projection
reads. A deeper split between active value backing, structural store,
subject/position metadata, entity signals, and Angular internals remains useful
optimization work, but it is no longer an unattributed release blocker.

### 4. Collection throughput needs layer boundaries, not one headline number

The broad `bench-compare` collection workload reports SignalTree at `122.72 ms`
for 10k rows. That number is not comparable to the production-kernel
`updateOne` measurements until the workload is split by operation type.

Follow-up public API decomposition at 10k rows (`node --expose-gc tools/bench-public-collection-layers.mjs --n 10000 --samples 5 --json`) measured:

| Layer                                        |       Median | Retained delta | Interpretation                                                    |
| -------------------------------------------- | -----------: | -------------: | ----------------------------------------------------------------- |
| plain array tree construction                |   `1.727 ms` |      `0.17 MB` | payload/control                                                   |
| empty `entityMap` declaration                |   `0.596 ms` |      `0.12 MB` | construction is not the 122 ms owner                              |
| `entityMap.setAll(10k)`                      | `116.180 ms` |     `71.33 MB` | initial population owns the broad workload time/heap              |
| `entityMap.addMany(10k)`                     | `113.136 ms` |     `71.32 MB` | same as `setAll`: bulk realization/population                     |
| existing `updateOne`                         |   `0.290 ms` |     `-0.02 MB` | public steady-state update remains sub-ms                         |
| existing `updateOne` + dependent `byId` read |   `0.453 ms` |     `-0.01 MB` | compatible with kernel O(1) direction                             |
| structural `addOne`                          |   `0.364 ms` |     `-0.02 MB` | single public structural mutation is not the broad workload owner |
| structural `removeOne`                       |   `0.440 ms` |     `-0.02 MB` | same                                                              |
| structural `changeId`                        |   `0.398 ms` |      `0.05 MB` | same                                                              |
| projection `all()`                           |   `2.004 ms` |      `0.15 MB` | projection read cost exists but is not 122 ms                     |
| projection `ids()`                           |   `0.608 ms` |      `0.15 MB` | same                                                              |
| projection `asMap()`                         |   `2.199 ms` |      `0.51 MB` | same                                                              |

This reconciles the apparent contradiction with the kernel measurements:

- the kernel `updateOne` / direct-frame logical-work results are about steady-state mutation after realization;
- the broad 10k collection workload is dominated by initial population / realization;
- the large retained heap appears when entering active `entityMap` realization, not when reading projections or updating an existing member.

What remains unresolved is the optimization-level retainer split inside initial
`entityMap` realization: active value backing, structural store,
subject/position metadata, entity signals, Angular runtime objects, and
closure/map overhead.

## Current Publishable Packages

| Package                | Public entry points                       | Status                                                                                                          |
| ---------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `@signaltree/core`     | `.`, `./security`, `./storage`            | Survives; blocked root symbols and unplaced subpaths removed                                                    |
| `@signaltree/events`   | `.`, `./nestjs`, `./angular`, `./testing` | Survives as standalone event bus / adapter package                                                              |
| `@signaltree/ng-forms` | `.`                                       | Survives as Angular FormGroup adapter, but individual helpers remain mechanically retained unless dispositioned |
| `@signaltree/shared`   | private                                   | Internal only                                                                                                   |

Deleted package surfaces: `guardrails`, `realtime`, `schema`, `enterprise`, `callable-syntax`, and `core/authoring`.

## Benchmarked Feature Surface

| Feature measured by `tools/size-report.mjs` | Public in current RC candidate? | Disposition in map                                 | Reconciliation                                                                                   |
| ------------------------------------------- | ------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `signalTree`                                | Yes                             | `KP` frozen                                        | Keep. Core construction boundary.                                                                |
| `entityMap`                                 | Yes                             | Survives but challenged / unplaced                 | Keep for RC; retention attributed to active realization, deeper split remains optimization debt. |
| `entityMap + loader`                        | No                              | `loader` app responsibility; tags unrun remainder  | Removed from RC public surface.                                                                  |
| `stored`                                    | No                              | `AS`, not earned both halves                       | Removed from RC public surface.                                                                  |
| `compared` / `byKeys`                       | No                              | unplaced; null not run                             | Removed from RC public surface.                                                                  |
| `asyncSource`                               | No                              | DELETE                                             | Removed from RC public surface.                                                                  |
| `asyncQuery`                                | No                              | DELETE                                             | Removed from RC public surface.                                                                  |
| `batching`                                  | Yes                             | `KA`                                               | Keep. Notification batching over synchronous writes.                                             |
| `timeTravel`                                | Yes                             | `KA` devtools/history instrument                   | Keep if framed as causal/debug/history adapter, not end-user undo by itself.                     |
| `transactions`                              | Yes                             | `KA` for refusal/neutrality; speculative role open | Keep only if the exported API can promise only the earned semantics.                             |
| `serialization`                             | No                              | not earned for core function / unplaced            | Removed from RC public surface.                                                                  |
| `persistence`                               | Yes                             | `KA`; enhancer form undisposed                     | Keepable for tree-scoped durability, but form needs explicit acceptance.                         |
| `devTools`                                  | Yes                             | `KA` diagnostic projection                         | Keep. Diagnostic adapter.                                                                        |
| `security` subpath                          | Yes                             | `KA`, no external imports                          | Keep. Isolated construction-time validator.                                                      |
| `lazy` subpath                              | No                              | unassigned threshold-driven                        | Removed from RC public surface.                                                                  |
| `edit-session` subpath                      | No                              | null not run                                       | Removed from RC public surface.                                                                  |
| `storage` subpath                           | Yes                             | `KA`                                               | Keep. Adapter-only, no Angular coupling.                                                         |

## Retained Functionality: How It Works and Why It Was Kept or Questioned

### Core shape: `signalTree`, `$`, callable leaves, `tree()`

How it works: `signalTree()` builds a typed tree facade where `$` exposes callable writable signals at every leaf and `tree()` reads or applies state. Current production construction includes the slot-backed scalar substrate, owner position metadata, and frame/publish semantics.

Optimization/adaptation: this was substantially redone toward the v15 kernel. Scalar values are addressed through compiled ownership/slot metadata rather than repeated whole-tree interpretation on the hot path.

Justification: keep. This is the kernel public constraint boundary: SignalTree owns truth, Angular owns observation, causal history owns meaning.

### Read-only views: `asReadonly` and readonly types

How it works: returns the same runtime tree object with a type-level view that hides write APIs and exposes only reader-safe marker/entity methods.

Optimization/adaptation: type-only narrowing; no runtime wrapper cost.

Justification: keep as `AS`. It shortens declarations and prevents accidental writes at API boundaries without creating a second runtime authority.

### Derived helpers: `derivedFrom`, `WithDerived`, `.derived()` chain, `linked`

How it works: `.derived()` attaches computed tiers to the tree; `derivedFrom<T>()` gives external derived functions a typed `$` parameter; `linked()` wraps Angular linked-signal semantics.

Optimization/adaptation: `derivedFrom` is a TypeScript ergonomics fix, not runtime machinery. `linked()` delegates to Angular.

Justification: mixed. `derivedFrom` is justified by module-boundary typing. `.derived()` chain remains legacy-compatible. `linked()` is not uniquely SignalTree-owned and defaults to removal unless a later authority grants it.

### Entity collections: `entityMap` and entity members

How it works: normalized collection state with entity signals, structural store, subject identity, materialized projection, O(1) keyed lookup, and collection operations (`addOne`, `removeOne`, `byId`, `ids`, plus projections and bulk methods).

Optimization/adaptation: heavily adapted. v15 added subject/position separation, address-vs-reference semantics, staged entity mutation frames, structural rekey/remove handling, and causal-history integration. Bulk operations stage before commit to avoid partial publication.

Justification: partial. Dynamic membership itself has real SignalTree function. The five minimum members are closest to justified. Bulk/convenience members, `changeId`, active-entity selection, `tap`, and `intercept` remain mixed or negative in the disposition map. Memory retention at 10k is only partially attributed and must not be normalized as accepted architectural cost.

### Entity loader helpers: `loader`, `invalidateTag`, loader types

How it works: `loader()` brands load/cache policy for `entityMap({ load })`; `invalidateTag` addresses cache-policy holders.

Optimization/adaptation: tree-shakeable helper path. Plain `entityMap()` does not statically import loader machinery.

Justification: unresolved. The map classifies cache/freshness/tags as application cache policy, with `invalidateTag` still an un-run remainder. Public survival requires independent authority; release pressure grants none. These helpers now participate in the RC disposition gate.

### Durability: `stored`, `persistence`, `serialization`, storage subpath

How it works: `stored()` persists individual leaves/markers; `persistence()` persists tree snapshots; `serialization()` snapshots and restores tree state; `core/storage` provides storage adapters.

Optimization/adaptation: consequence ordering was repaired so durable writes run only after the tree commit scope settles. `persistence()` is tree-scoped. Storage adapters are isolated in a subpath.

Justification: mixed. The post-commit consequence authority is frozen. `persistence()` and storage adapters are plausibly justified. `stored()` had correctness fixes but remains not independently earned in the map. `serialization()` is validated but still not earned as a core function in the disposition map. Settled negatives default to absence.

### Async markers: `asyncSource`, `asyncQuery`

How it works: path-attached async lifecycle markers with loading/error/result state and refresh/input-driven query behavior.

Optimization/adaptation: they are currently self-registering markers and included in readonly types and size benchmarks.

Justification: blocker. The disposition map says they are DELETE / decision required. Since they remain public root exports, RC cannot claim a reconciled public surface until this is resolved.

### Equality: `compared`, `byKeys`

How it works: wraps a leaf with custom equality so writes that are semantically unchanged can be skipped.

Optimization/adaptation: small tree-shakeable marker/helper; benchmarked as `+0.07 KB` over bare.

Justification: unresolved. Useful, but the map says its null has not run: what does SignalTree need to know about equality? Omit or finish that derivation before RC.

### History and transactions: `timeTravel`, `transactions`, `SignalTreeRollbackError`, `trackHistory`

How it works: `timeTravel()` records causal turns and realizes undo/redo through the tree realization adapter; `transactions()` groups synchronous writes into pending turns with `confirm()` / `rollback()`; rollback can throw `SignalTreeRollbackError`; `trackHistory()` is signal-level history over a writable signal.

Optimization/adaptation: substantially redone. History now composes causal turn storage, applied-history assessment, structural dependency checks, and physical realization instead of plain whole-state snapshots. `transactions()` delegates to pending confirmation/rollback rather than opening a second mutation path.

Justification: mixed. Causal turn atomicity, rollback refusal semantics, and user-recognizable history steps are justified. `transactions()` is justified for refusal/neutrality only if the public API can be narrowed to that earned promise; documentation cannot rescue an over-broad carrier. `trackHistory()` is mechanically retained after form deletion and defaults to removal.

### Batching

How it works: writes remain synchronous, while notifications/change-detection delivery are batched to reduce render churn.

Optimization/adaptation: aligned with frame/publish semantics rather than delaying truth mutation.

Justification: keep as `KA`. Observational atomicity is a real adapter obligation.

### Diagnostics and adapters: `devTools`, `createAuditTracker`, `security`, `lazy`, `edit-session`

How it works: `devTools()` projects tree changes into Redux DevTools; audit tracker appends change records; `security` validates construction input; `lazy` defers signal materialization; `edit-session` wraps draft/commit/cancel flows.

Optimization/adaptation: most are tree-shakeable and/or subpath-isolated. `security` and `storage` avoid main-bundle external coupling. `lazy` isolates memory-manager/proxy machinery in a subpath.

Justification: mixed. `devTools`, audit, security, and storage are reasonably scoped adapters. `lazy` and `edit-session` are still unplaced/null-not-run in the map and should be omitted unless their independent derivations are completed.

### `@signaltree/events`

How it works: standalone event bus package with Zod schemas, validation, registry/factory, error classification, idempotency, NestJS integration, Angular event helpers, and testing utilities.

Optimization/adaptation: package boundary, optional peers, ESM output, and subpaths keep integrations separate.

Justification: keep as standalone adapter package if we accept it as outside core kernel semantics. It does not define SignalTree state truth.

### `@signaltree/ng-forms`

How it works: `createFormTree()` builds a SignalTree-backed Angular `FormGroup`; validators are namespaced under `ngFormValidators`; wizard/history helpers remain.

Optimization/adaptation: removed dependency on `core/authoring`; explicit root barrel; no marker bridge/signals subpaths in the published manifest.

Justification: unresolved at function level. The package may survive as Angular adapter, but `createFormTree`, wizard, and history are recorded as mechanically retained / unproven. They default to absence unless a later authority grants them.

## Performance Baseline Summary

Generated under ignored local scratch directory `artifacts/final-baseline-2026-08-21/`.

### Size

- Bare `signalTree`: `9.45 KB` gzip
- `entityMap (plain)`: `20.77 KB` total, `+11.32 KB`
- `entityMap + loader`: `22.33 KB` total, `+12.88 KB`
- `stored`: `11.13 KB` total, `+1.68 KB`
- `compared`: `9.51 KB` total, `+0.07 KB`
- `asyncSource`: `10.26 KB` total, `+0.81 KB`
- `asyncQuery`: `10.34 KB` total, `+0.89 KB`
- `batching`: `+0.79 KB`
- `timeTravel`: `+11.73 KB`
- `serialization`: `+1.82 KB`
- `persistence`: `+2.61 KB`
- typical app (`entityMap + stored + asyncSource`): `22.9 KB`
- everything: `39.14 KB`

Caution: the labels include unresolved public APIs (`asyncSource`, `asyncQuery`, `stored`, `serialization`). These are measurements, not survival decisions.

### Collection benchmark

At 10k collection workload:

- SignalTree: `122.72 ms`, `66.12 MB retained`
- NgRx signals: `10.41 ms`, `0.93 MB retained`
- Elf: `1.50 ms`, `0.92 MB retained`
- Raw signals: `4.87 ms`, `6.16 MB retained`

Additional retained-heap ablation shows the dominant cost appears before projection reads and before held per-row facades. The remaining attribution target is active `entityMap` internals: retained value backing, structural store, subject/position metadata, entity signals, and Angular runtime objects.

### Granular workload vs SignalStore

- Deep field write: SignalTree `0.0945 ms`; SignalStore `1.15 ms`
- Update 1 row of 50k + dependent read: SignalTree `0.94 ms`; SignalStore `1557 ms`
- Write then read whole state 10x: SignalTree `1.39 ms`; SignalStore `2.66 ms`
- 50 writes with undo history: SignalTree `0.92 ms`; SignalStore `312.86 ms`

These support the granular-observation thesis, but they do not explain collection retention.

### SSR payload

- 100 rows: `10.9 KB`
- 1,000 rows: `109.4 KB`
- 10,000 rows: `1120.1 KB`
- `asyncSource` 500 rows ships `54.35 KB`; normal rehydrate drops it; `{ transfer: true }` delivers it.

Shape is linear. Absolute payload size is a product/documentation constraint.

## Required Next Action Before RC

The public-surface reconciliation item is resolved for core: blocked root
symbols and unplaced subpaths are absent, tarball exports resolve, copyable docs
do not import removed names, and full core tests pass after internal evidence
specs moved off the public barrel.

Before publishing `1.0.0-rc.1`, run the normal RC packaging/publish proof. The
remaining `entityMap` memory work is now optimization-level attribution inside
active realization, not an unattributed RC surface contradiction.
