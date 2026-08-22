# RC Public Surface Reconciliation

Date: 2026-08-21
Branch: `history/gate1-frontier-cutover`
HEAD reviewed: `3670e73b`

## Verdict

Do not publish `1.0.0-rc.1` yet if the RC is expected to represent an analytically reconciled public surface.

Release engineering is in good shape: gates pass, self-tests prove the gates can fail, tarballs are checked, clean-checkout flow works, and CI publishing is wired for trusted publishing. The remaining blockers are product/API reconciliation, not release plumbing.

## Blocking Findings

### 1. Async markers are still public while the disposition map says delete / decision required

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

The product-core map states `asyncSource()` / `asyncQuery()` are `DELETE — frozen, still physically present` and that DR-4 requires a decision on promise-carrier scope. That is a release-surface contradiction, not a performance issue.

Required before RC: decide whether these are intentionally public in the RC. If yes, update the disposition map and release ledger with the survival argument. If no, remove them from root public exports and published declarations.

### 2. Several public root exports are mechanically retained or not earned

The current root barrel still exports capabilities classified as `LC`, `AS`, or unplaced in the map. That can be acceptable for an RC only if each is explicitly labeled as transitional or accepted as a survivor.

Required before RC: for each item below, either keep with an updated disposition or remove/defer it.

### 3. Collection retention is measured but unattributed

Final baseline measured the 10k collection workload as:

- SignalTree: `122.72 ms`, `66.12 MB retained`
- NgRx signals: `10.41 ms`, `0.93 MB retained`
- Elf: `1.50 ms`, `0.92 MB retained`
- Raw signals: `4.87 ms`, `6.16 MB retained`

This is not yet evidence that `entityMap` must be memory-heavy. It only proves the benchmark workload retained substantially more memory. Attribution is not measured.

Required before RC or explicitly carried into RC notes: classify this as an unattributed performance finding and avoid claiming it is an accepted tradeoff of the v15 architecture.

## Current Publishable Packages

| Package | Public entry points | Status |
| --- | --- | --- |
| `@signaltree/core` | `.`, `./security`, `./lazy`, `./edit-session`, `./storage` | Survives; root surface needs reconciliation |
| `@signaltree/events` | `.`, `./nestjs`, `./angular`, `./testing` | Survives as standalone event bus / adapter package |
| `@signaltree/ng-forms` | `.` | Survives as Angular FormGroup adapter, but individual helpers remain mechanically retained unless dispositioned |
| `@signaltree/shared` | private | Internal only |

Deleted package surfaces: `guardrails`, `realtime`, `schema`, `enterprise`, `callable-syntax`, and `core/authoring`.

## Benchmarked Feature Surface

| Feature measured by `tools/size-report.mjs` | Public in current RC candidate? | Disposition in map | Reconciliation |
| --- | --- | --- | --- |
| `signalTree` | Yes | `KP` frozen | Keep. Core construction boundary. |
| `entityMap` | Yes | Survives but challenged / unplaced | Keep only with explicit unresolved-retention note or run attribution first. |
| `entityMap + loader` | Yes: `loader`, `invalidateTag`, loader types | `loader` app responsibility; tags unrun remainder | Needs decision: public cache-policy helpers are still shipping. |
| `stored` | Yes | `AS`, not earned both halves | Needs keep/delete decision. Consequence ordering fixed; independent survival not proven. |
| `compared` / `byKeys` | Yes | unplaced; null not run | Needs keep/delete decision. |
| `asyncSource` | Yes | DELETE / decision required | Blocker unless disposition changes. |
| `asyncQuery` | Yes | DELETE / decision required | Blocker unless disposition changes. |
| `batching` | Yes | `KA` | Keep. Notification batching over synchronous writes. |
| `timeTravel` | Yes | `KA` devtools/history instrument | Keep if framed as causal/debug/history adapter, not end-user undo by itself. |
| `transactions` | Yes | `KA` for refusal/neutrality; speculative role open | Keep only with narrow scope documented. |
| `serialization` | Yes | not earned for core function / unplaced | Needs keep/delete decision or scoped survival. |
| `persistence` | Yes | `KA`; enhancer form undisposed | Keepable for tree-scoped durability, but form needs explicit acceptance. |
| `devTools` | Yes | `KA` diagnostic projection | Keep. Diagnostic adapter. |
| `security` subpath | Yes | `KA`, no external imports | Keep. Isolated construction-time validator. |
| `lazy` subpath | Yes | unassigned threshold-driven | Needs explicit keep/delete decision. |
| `edit-session` subpath | Yes | null not run | Needs explicit keep/delete decision. |
| `storage` subpath | Yes | `KA` | Keep. Adapter-only, no Angular coupling. |

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

Justification: mixed. `derivedFrom` is justified by module-boundary typing. `.derived()` chain remains legacy-compatible. `linked()` is not uniquely SignalTree-owned and needs a keep/delete decision.

### Entity collections: `entityMap` and entity members

How it works: normalized collection state with entity signals, structural store, subject identity, materialized projection, O(1) keyed lookup, and collection operations (`addOne`, `removeOne`, `byId`, `ids`, plus projections and bulk methods).

Optimization/adaptation: heavily adapted. v15 added subject/position separation, address-vs-reference semantics, staged entity mutation frames, structural rekey/remove handling, and causal-history integration. Bulk operations stage before commit to avoid partial publication.

Justification: partial. Dynamic membership itself has real SignalTree function. The five minimum members are closest to justified. Bulk/convenience members, `changeId`, active-entity selection, `tap`, and `intercept` remain mixed or negative in the disposition map. Memory retention at 10k is unattributed and must not be normalized as accepted architectural cost.

### Entity loader helpers: `loader`, `invalidateTag`, loader types

How it works: `loader()` brands load/cache policy for `entityMap({ load })`; `invalidateTag` addresses cache-policy holders.

Optimization/adaptation: tree-shakeable helper path. Plain `entityMap()` does not statically import loader machinery.

Justification: unresolved. The map classifies cache/freshness/tags as application cache policy, with `invalidateTag` still an un-run remainder. Public survival needs an explicit decision.

### Durability: `stored`, `persistence`, `serialization`, storage subpath

How it works: `stored()` persists individual leaves/markers; `persistence()` persists tree snapshots; `serialization()` snapshots and restores tree state; `core/storage` provides storage adapters.

Optimization/adaptation: consequence ordering was repaired so durable writes run only after the tree commit scope settles. `persistence()` is tree-scoped. Storage adapters are isolated in a subpath.

Justification: mixed. The post-commit consequence authority is frozen. `persistence()` and storage adapters are plausibly justified. `stored()` had correctness fixes but remains not independently earned in the map. `serialization()` is validated but still not earned as a core function in the disposition map.

### Async markers: `asyncSource`, `asyncQuery`

How it works: path-attached async lifecycle markers with loading/error/result state and refresh/input-driven query behavior.

Optimization/adaptation: they are currently self-registering markers and included in readonly types and size benchmarks.

Justification: blocker. The disposition map says they are DELETE / decision required. Since they remain public root exports, RC cannot claim a reconciled public surface until this is resolved.

### Equality: `compared`, `byKeys`

How it works: wraps a leaf with custom equality so writes that are semantically unchanged can be skipped.

Optimization/adaptation: small tree-shakeable marker/helper; benchmarked as `+0.07 KB` over bare.

Justification: unresolved. Useful, but the map says its null has not run: what does SignalTree need to know about equality? Needs keep/delete decision.

### History and transactions: `timeTravel`, `transactions`, `SignalTreeRollbackError`, `trackHistory`

How it works: `timeTravel()` records causal turns and realizes undo/redo through the tree realization adapter; `transactions()` groups synchronous writes into pending turns with `confirm()` / `rollback()`; rollback can throw `SignalTreeRollbackError`; `trackHistory()` is signal-level history over a writable signal.

Optimization/adaptation: substantially redone. History now composes causal turn storage, applied-history assessment, structural dependency checks, and physical realization instead of plain whole-state snapshots. `transactions()` delegates to pending confirmation/rollback rather than opening a second mutation path.

Justification: mixed. Causal turn atomicity, rollback refusal semantics, and user-recognizable history steps are justified. `transactions()` is justified for refusal/neutrality, but speculative role remains open. `trackHistory()` is mechanically retained after form deletion and needs its own decision.

### Batching

How it works: writes remain synchronous, while notifications/change-detection delivery are batched to reduce render churn.

Optimization/adaptation: aligned with frame/publish semantics rather than delaying truth mutation.

Justification: keep as `KA`. Observational atomicity is a real adapter obligation.

### Diagnostics and adapters: `devTools`, `createAuditTracker`, `security`, `lazy`, `edit-session`

How it works: `devTools()` projects tree changes into Redux DevTools; audit tracker appends change records; `security` validates construction input; `lazy` defers signal materialization; `edit-session` wraps draft/commit/cancel flows.

Optimization/adaptation: most are tree-shakeable and/or subpath-isolated. `security` and `storage` avoid main-bundle external coupling. `lazy` isolates memory-manager/proxy machinery in a subpath.

Justification: mixed. `devTools`, audit, security, and storage are reasonably scoped adapters. `lazy` and `edit-session` are still unplaced/null-not-run in the map and need explicit keep/delete decisions.

### `@signaltree/events`

How it works: standalone event bus package with Zod schemas, validation, registry/factory, error classification, idempotency, NestJS integration, Angular event helpers, and testing utilities.

Optimization/adaptation: package boundary, optional peers, ESM output, and subpaths keep integrations separate.

Justification: keep as standalone adapter package if we accept it as outside core kernel semantics. It does not define SignalTree state truth.

### `@signaltree/ng-forms`

How it works: `createFormTree()` builds a SignalTree-backed Angular `FormGroup`; validators are namespaced under `ngFormValidators`; wizard/history helpers remain.

Optimization/adaptation: removed dependency on `core/authoring`; explicit root barrel; no marker bridge/signals subpaths in the published manifest.

Justification: unresolved at function level. The package may survive as Angular adapter, but `createFormTree`, wizard, and history are recorded as mechanically retained / unproven. Needs explicit acceptance or narrowing before RC.

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

This is the major unexplained finding. Treat it as unattributed until an ablation identifies the owner.

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

Add a pre-RC release item before `publish 1.0.0-rc.1`:

1. Resolve current root exports whose disposition is DELETE / not earned / legacy / unplaced.
2. Decide whether `asyncSource` and `asyncQuery` survive the RC or are removed.
3. Decide whether mechanically retained helpers (`stored`, `linked`, `compared`, `trackHistory`, `createFormTree`, `wizard`, `edit-session`, `lazy`) are intentionally public.
4. Record the 66 MB collection retention as unattributed unless an ablation explains it.

If this reconciliation is accepted, the RC can proceed as an RC: first real npm trusted-publishing proof, external install proof, then RC issue collection.
