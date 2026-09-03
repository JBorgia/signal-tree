<div align="center">
  <img src="apps/demo/public/signaltree-mark-192.png" alt="SignalTree ST leaf mark" width="120" height="120" />
  <h1>SignalTree</h1>
  <p><strong>Causal application state for Angular and React</strong></p>
  <p>State as shape. Consequential transitions. Signals at every path.</p>

  <p>
    <a href="https://jborgia.github.io/signaltree/" target="_blank"><strong>Live Demo</strong></a>
    &nbsp;|&nbsp;
    <a href="https://www.npmjs.com/package/@signal-tree/kernel" target="_blank">npm</a>
    &nbsp;|&nbsp;
    <a href="https://github.com/JBorgia/signal-tree" target="_blank">GitHub</a>
    &nbsp;|&nbsp;
    <a href="https://signaltree.io/built-for-ai" target="_blank">Built for AI</a>
  </p>
</div>

## SignalTree is not @ngrx/signals

**Different library, different author, different package** — the `@signal-tree/*` scope (hyphenated; not under `@ngrx/`). Angular apps install [`@signal-tree/angular`](packages/angular/README.md); React apps install [`@signal-tree/react`](packages/react/README.md); framework-neutral libraries use [`@signal-tree/kernel`](packages/kernel/README.md). A framework package is the complete application facade: import SignalTree APIs through it rather than mixing framework and kernel imports. It's a typed reactive store where **your state literal is the API**: no `withState` / `withMethods` / `withComputed` wrappers, no actions, no reducers. You read and write any path directly — `tree.$.user.name()` to read, `tree.$.user.name.set(v)` to write — at any depth. If a doc or AI agent conflated this with NgRx SignalStore, that's the confusion to drop first; see [SignalTree vs NgRx SignalStore](docs/compare/ngrx-signalstore.md).

> **On `@signaltree/*` (no hyphen)?** That is the pre-15 line and it stops at
> 14.1.1. See [Migration `@signaltree/*` → `@signal-tree/*` (v15)](docs/guides/migration-v14-v15.md).

## Why SignalTree

SignalTree models application state as consequential transitions, not just
values in reactive containers. The kernel distinguishes authored work from
external truth, preserves stable entity identity through structural change, and
publishes one coherent result for operations that touch several locations.
Framework packages realize those semantics without becoming another state
authority.

The capabilities applications opt into remain composable:

- **`entityMap()`** → normalized collections with O(1) lookups and reactive CRUD
- **`updateAndReport()`** → a changed-paths report for partial server-payload sync, audit trails, and targeted persistence
- **`derived`** → one computed-state factory deep-merged at any path
- **`restoration()`** → optional undo/redo over explicitly designated authored turns

### Use SignalTree if you need

- User edits and server truth to remain distinguishable
- One logical operation across several entities to publish coherently
- Stable identity across collection removal, rekey, reorder, and held references
- Typed normalized collections with O(1) lookups (`entityMap`)
- State that mirrors your data shape, not Redux ceremony

Restoration is one optional consequence of that model. When enabled, a
designated user operation remains one causal turn and can be restored atomically
without overwriting newer external truth. Most applications need not enable it.

### Production architecture

For anything beyond a prototype, wrap the tree in a service and expose **`$` reads + Ops methods**: declare computed state in `signalTree(..., { derived })` and use `@Injectable` Ops services for writes and async. See [Recommended Architecture](docs/architecture/signaltree-architecture-guide.md#recommended-architecture-tldr).

For components that should only ever read the store, `asReadonly(tree)` narrows the tree to a `ReadonlyStore` — read-only `$` over the tree's full accumulated type (leaf `Signal` reads, configured derived computeds preserved, `linkedSignal()` narrowed to `Signal`) plus `destroy()`/`destroyed`. Marker surfaces are genuinely narrowed to per-marker reader allowlists: entity mutators (`upsertOne`, `removeWhere`, …) are not offered on the readonly type, and `byId()` is re-signed to a read-only entity node (deep `Signal` leaves, no `.set`). `defineStore(factory, { expose: 'readonly' })` is sugar over the same view for injected stores. This is a compile-time narrowing only — the same runtime object, no runtime guard — so it stops the type system from _offering_ a write, not a determined `as any`; pair it with a separate Ops service for the write path.

## When to Use SignalTree

SignalTree makes a specific architectural trade: **writes are independent of state size, and
notification is independent of subscriber count — and you pay for that whenever you materialize the
whole tree.** Two questions decide whether that trade is in your favour.

**1. How many live consumers are bound _below the top level_, and how often do you write?**

Only leaves are signals, so a write goes to one leaf and dirties only that leaf's consumers. An
immutable store re-runs subscriber projections on emission and filters downstream.
[`tools/bench-state-scale.mjs`](tools/bench-state-scale.mjs) compares SignalTree
with `@ngrx/signals` on separate state-size and consumer axes. SignalTree's leaf
write stays flat as unrelated state grows; quote the measured shape, never a
bare multiplier.

**2. Do you read the whole collection on every change?**

That hands the granularity win back:

- Over 10,000 rows, `update` + `byId()` is **2.13 µs**; `update` + `all()` is **9.91 µs**, because
  `all()` rebuilds the array on every change and there are no per-entity consumers to earn the
  granularity back. That gap widens with collection size and with how many per-entity nodes have
  been materialised.
- Restoration writes affected values back through stable subjects rather than
  swapping one immutable root. Treat simple scalar undo as a hot-path question:
  `RESTORATION-HOT-PATH-0` in [`TODO.md`](TODO.md) separates retained-effect
  application from lookup, causal bookkeeping, and publication before any
  representation change.

**High write frequency × many per-entity bindings → SignalTree, by a wide margin. Whole-collection
reads → an immutable store fits better. If deep undo is the product, benchmark that optional capability separately.**

> Numbers are Node v24.3 / V8 on one machine. Browser transfer is not yet established — re-run the
> harnesses rather than trusting the table.

### Which apps land where

<!-- measured: node --expose-gc tools/bench-compare.mjs (collection and undo arms); node tools/bench-vs-signalstore.mjs (per-entity vs whole-collection reads) -->

Every figure in this section comes from `node --expose-gc tools/bench-compare.mjs`
and `node tools/bench-vs-signalstore.mjs`. Ratios between sub-millisecond arms move
run to run — re-run before quoting one.

Two columns, deliberately separated: **what the measurements say** is a different question from
**what teams pick**. Ecosystem gravity is real, but it is a fact about hiring, not about fit —
collapsing them lets one masquerade as the other. The library measurements are ours; the mapping
from a domain to a workload is judgment, so validate it against your own app.

| Workload                                          | Typical domains                                                                                     | What the measurements say                                                                        | What teams usually pick              |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Streaming telemetry into many per-entity bindings | Fleet & logistics, grid/SCADA, telecom NOC, manufacturing MES, airline & rail ops, trading blotters | **SignalTree leans** — keyed writes stay flat as unrelated state grows                           | SignalTree                           |
| Offline-first with server-owned collections       | Field service, mobile ops                                                                           | **Application-owned loading + `entityMap`** until a cache helper earns RC authority              | SignalTree                           |
| Deep nested state with audit and undo             | Healthcare, claims, regulated workflows                                                             | **SignalTree leans** — nested leaves and restoration are built in; persistence stays app-owned   | Toss-up; governance decides          |
| CRUD over moderate lists, server round-trips      | CRM, ERP, admin consoles, insurance                                                                 | **Depends on access shape** — compare keyed reads separately from complete projection            | `@ngrx/signals`, on gravity          |
| Drag-driven boards and schedules                  | Dispatch, Gantt, planning                                                                           | **SignalTree leans** — high write frequency, per-item bindings, moderate collections             | Toss-up                              |
| Undo/redo over moderate state                     | Editors-in-a-panel, wizards, bulk edit                                                              | **SignalTree** — `@ngrx/signals` has no undo primitive at all                                    | Hand-rolled history (the 262 ms arm) |
| Whole-dataset reads on every change               | BI and analytics explorers                                                                          | **Depends on modelling** — a plain array leaf is at parity; `entityMap` is the wrong tool        | Toss-up                              |
| Deep undo over **large** collections              | Design tools, media timelines                                                                       | **Measure the edit shape** — immutable-root swap and granular subject replay pay different costs | Purpose-built history                |
| Concurrent editing of one document                | CMS authoring, co-editing                                                                           | **Not a store decision** — a CRDT goes underneath either way                                     | Yjs/Automerge + any store            |
| Large teams, long-lived, hiring-driven            | Banking core, public sector                                                                         | **No technical winner at this altitude**                                                         | NgRx classic — legitimately so       |

Where the two columns disagree, the honest reading is "a toss-up that gravity decides" — not
"something else fits better."

**Reach for SignalTree when you have:**

- **Structured or nested state** — settings, user profiles, workspaces, dashboards, multi-step
  wizards, anything with domains inside domains. `tree.$.workspace.editor.draft.dirty()` reads and
  writes at any depth, with full recursive typing.
- **Collections** — `entityMap()` gives you normalized membership and O(1)
  keyed reads. Keep server loading, freshness, and invalidation in application
  services until a v15 async/cache helper is derived.
- **Optimistic UI** — snapshot with `byId()`, write eagerly, restore on failure; `entityMap`'s
  batch ops keep a burst to one notification. `updateAndReport()` tells you which **paths** changed
  (for partial server-payload sync, audit trails, targeted persistence). See the
  [Ops recipe](docs/guides/composition-recipes.md#2-a-reusable-entity-crud-ops-base).
- **Async data** — keep local loading flags as ordinary state and put
  orchestration in application services or framework primitives.
- **Explainable transitions and DevTools** — inspect why state changed and keep
  user work distinct from external truth. Add `restoration()` only where users
  genuinely need reversible operations.
- **State that will grow.** Starting simple is fine — the shape _is_ the API, so adding a domain or
  attaching a marker at a new node doesn't restructure anything you already wrote. You don't need to
  predict your final shape to start.
- **Multiple stores / feature domains** — one tree per feature with an Ops service in front is the
  recommended architecture, and it scales to many.
- **AI-assisted development** — the historical v10 experiment measured 49% →
  98% codegen accuracy with its then-current `llms.txt`. Current v15 guidance
  is the shipped [`llms.txt`](llms.txt) manifest, alongside package types and
  READMEs.
- **Migrating off `@ngrx/signals`** — use the package types and current migration
  guide; consumer-facing agent skills are intentionally absent until the public
  surface freeze is complete.

**Where something else may fit better:**

- **Every widget reads the whole collection.** A chart-driven analytics explorer re-reads `all()` on
  every change and binds nothing per entity, so it pays the materialization tax and collects none of
  the fan-out benefit — measured at 97.47 µs against 1.90 µs for the per-entity path. Model it as a
  plain array leaf, or use a store that returns its state by reference.
- **Deep undo over large collections.** Restoring writes values back into per-entity signals rather
  than swapping an immutable root reference. If the undo stack _is_ the product
  (design tools, timeline editors), profile that exact edit shape. If you just need undo
  over a big grid, `undoable()` is the lever: designate only the operations that should be
  reversible, and the rest of the grid's churn never enters the undo stack at all.
- **Collaborative document editing.** Merge semantics belong in a CRDT (Yjs, Automerge) underneath
  whatever store you pick; no state library is the right layer for that.
- **A couple of values in one component.** Raw Angular signals (`signal` / `computed` /
  `linkedSignal` / `resource`) are complete for that, and reaching for any store would be
  ceremony. The interesting question isn't "is my app big enough" — it's whether you want the
  batteries above hand-assembled or provided. See
  [SignalTree vs raw Angular signals](docs/compare/native-signals.md).
- **Event-sourcing or CQRS** — use NgRx Store (the classic Redux variant); replaying an event log is
  a different architecture, not a feature gap.
- **Genuinely shape-shifting state** — streaming arbitrary JSON with unknown keys at high frequency
  (log aggregators, fully-dynamic schema editors). Markers and the type system assume a known shape;
  put dynamic payloads in a collection inside a slice instead.
- **A large existing `@ngrx/store` (classic) + heavy RxJS codebase** — the lowest-cognitive-cost
  migration target is `@ngrx/signals`, whose RxJS-flavored model is closer to where you already are.
  See [`docs/compare/ngrx-signalstore.md`](docs/compare/ngrx-signalstore.md) for the decision tree.

## 🤖 Built for the AI-assisted era

SignalTree has treated AI coding agents as API consumers and measured whether
its guidance improves generated code. The v10 experiment used earlier
`llms.txt` and agent-guidance artifacts; those historical materials are not
shipped by the current release. The current v15 manifest is [`llms.txt`](llms.txt).

**Measured (v10.3.3, 2026-06-01):** AI-codegen accuracy goes from **49% cold → 98% primed (+49 percentage points)** when `llms.txt` is in the agent's context. Reproducible across 6 agents (4 frontier + 2 cost-tier) × 8 prompts × 5 libraries × 3 priming modes = **720 cells**. Four of the six agents reach **100/100** when primed.

See the [historical v10 results](scripts/ai-codegen-benchmark/RESULTS-v10.3.3-VS-v10.2.md)
and the reproducible harness for the evidence behind that experiment.

**Don't take our number — re-run it.** The full harness (agents, prompts, libraries, priming modes, and scoring) lives in [`scripts/ai-codegen-benchmark/`](scripts/ai-codegen-benchmark/). Point it at your own agents and prompts and reproduce the delta yourself.

---

## Mental Model

A SignalTree turns a plain JSON object into a tree of Angular signals. Each leaf becomes a `WritableSignal`. Reads and writes use the same shape as any Angular signal — `node()` to read, `.set()` / `.update()` to write. Markers, enhancers, and derived state add capability on top, but they layer onto that base.

```typescript
import { signalTree } from '@signal-tree/angular';

const store = signalTree({
  user: { name: 'Alice', age: 30 },
  settings: { theme: 'dark' },
});

// Read — just call it, like any signal
store.$.user.name(); // 'Alice'

// Write — set or update a leaf, or update the whole tree
store.$.user.name.set('Bob');
store.$.user.age.update((n) => n + 1);
store.$((current) => ({
  ...current,
  settings: { theme: 'light' },
}));
```

In templates, `store.$.user.name()` works exactly like any other signal.

## Install

```bash
# Angular application
npm install @signal-tree/angular

# framework-neutral core (libraries, tests, non-Angular runtimes)
npm install @signal-tree/kernel

# React application
npm install @signal-tree/react
```

`@signal-tree/angular` requires Angular 20, 21, or 22 (see `peerDependencies` in
[`packages/angular/package.json`](packages/angular/package.json)). Import
`signalTree` and everything else from `@signal-tree/angular` in Angular code —
its leaves are native Angular signals (`isSignal()` is `true`, so `toObservable`,
`model()`, and `input()` accept them). The kernel's neutral cells are not
interchangeable with `WritableSignal`. React code likewise imports `signalTree`,
enhancers, markers, and `useSignalTree` from `@signal-tree/react`; import from
`@signal-tree/kernel` directly only in framework-neutral TypeScript.

## Entity Collections

The `entityMap()` marker gives any node a normalized collection with full reactive CRUD:

```typescript
import { signalTree, entityMap } from '@signal-tree/angular';

const store = signalTree({
  users: entityMap<User, number>({ selectId: (u) => u.id }),
});

store.$.users.setAll([
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]);
store.$.users.addOne({ id: 3, name: 'Carol' });
store.$.users.updateOne(1, { name: 'Alice V2' });
store.$.users.removeOne(2);

// Reactive queries — all return signals
store.$.users.all(); // Signal<User[]>
store.$.users.byId(1); // EntityNode<User> | undefined — callable accessor with per-field signals
store.$.users.count(); // Signal<number>
store.$.users.where((u) => u.active); // Signal<User[]>
```

Additional methods: `addMany`, `upsertOne`, `upsertMany`, `updateMany`, `updateWhere`, `replaceOne` (O(1) outright replacement — `updateOne` spreads and cannot remove a key), `removeMany`, `removeWhere`, `clear`, `has`, `ids`, `find`, `prependOne`/`prependMany` (insert at the head without invalidating any row), `changeId(from, to)` (in-place id migration preserving position and held `byId()` handles), and active-entity tracking: `activeId`/`activeEntity` reads plus `setActiveId`/`clearActiveId` — `activeEntity` resolves through `byId`, so it is O(1) and invalidates only when that row changes.

Pass `sortComparer` to keep `all()`/`ids()` sorted on every read (`@ngrx/entity` parity): `entityMap<User>({ selectId, sortComparer: (a, b) => a.name.localeCompare(b.name) })`. Per-entity reads are body-granular — `byId(id).field()` re-runs only when that entity changes.

> **Error codes:** every SignalTree error and dev-mode warning carries a stable, greppable `[ST####]` code. Search it in a stack trace or in [`docs/errors/README.md`](docs/errors/README.md) for the cause and fix. In dev, the core warns on common mistakes (missing `selectId` → `[ST2001]`, wrong-library method names → `[ST2002]`, in-place-mutation no-op writes → `[ST2003]`).

## Markers

A **marker** is a call placed in the state literal that declares special node
behavior at tree creation time. **`entityMap()` is the only marker in v15.**
The historical stored, form, status, async-source, and async-query markers were
removed. Everything else in the state literal is plain data:

```typescript
import { signalTree, entityMap } from '@signal-tree/angular';

const store = signalTree({
  users: entityMap<User>(), // marker — normalized entity collection (see above)
  loadingState: 'idle' as 'idle' | 'loading' | 'loaded' | 'error', // plain leaf
  preference: 'light' as 'light' | 'dark', // plain leaf
});

store.$.loadingState.set('loading');
store.$.users.setAll(data); // entities written directly — loadingState is a sibling
store.$.loadingState.set('loaded');
```

The old cache-aware `entityMap({ load: loader(...) })` surface is also gone.
Use plain `entityMap()` for normalized local membership and write resolved rows
from app-owned services (an `@Injectable` Ops service that runs the fetch and
lands results via `external()`).

## Composition model

A SignalTree store is composed from four distinct, type-safe mechanisms — each handles one concern, rather than funneling everything through a single primitive:

| Concern           | Mechanism                                                                                                                                    | Example                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **State shape**   | the constructor object — state _is_ the JSON, including plain state and surviving markers like `entityMap`                                   | `signalTree({ users: entityMap<User>() })`                              |
| **Derived state** | one config-level `derived` factory — computed signals deep-merged at any path                                                                | `signalTree(state, { derived: $ => ({ activeCount: computed(...) }) })` |
| **Capabilities**  | the `enhancers` config array — construction-time capabilities; low-level `Enhancer` functions are accepted, but no helper/metadata SDK ships | `signalTree(state, { enhancers: [batching(), devTools()] })`            |
| **Actions**       | a plain `@Injectable` Ops service that writes to tree paths — reads (`tree.$`) stay decoupled from writes                                    | `ops.users.select(id)`                                                  |

This deliberately splits across four purpose-built tools what NgRx SignalStore unifies under one `with*` composition primitive (`withState` / `withComputed` / `withMethods` / `signalStoreFeature`). The closest analog to NgRx's reusable-feature primitive (`signalStoreFeature` / `withFeature`) is the `enhancers` array; state, derived state, and actions live in the other three mechanisms. For an honest, axis-by-axis comparison — including where NgRx wins — see [docs/compare/ngrx-signalstore.md](docs/compare/ngrx-signalstore.md).

The sections below detail each mechanism.

## Enhancers

Enhancers add capabilities. Declare the whole set in `signalTree`'s config —
there is no `.with()` and no late enhancement, because the tree's build plan is
derived from the enhancer set and cannot be truthful until that set is known.
Each enhancer is opt-in and tree-shakeable (modern bundlers — Vite, esbuild,
Rollup, webpack 5+). Declaration order does not matter: requirements resolve
against everything in the array and the planner runs providers first. Listing
the same enhancer twice throws a clear error before anything is built —
fail-fast, no silent fallback.

```typescript
import { signalTree, batching, devTools, restoration } from '@signal-tree/angular';

const store = signalTree(
  { count: 0, items: [] },
  {
    enhancers: [
      batching(), // Batch change notifications
      restoration({ maxHistorySize: 50 }), // Undo/redo, 50 retained turns
      devTools(), // Redux DevTools integration
    ],
  }
);
```

| Enhancer        | Purpose                                                        |
| --------------- | -------------------------------------------------------------- |
| `batching()`    | Coalesce change-detection notifications into microtask batches |
| `restoration()` | Undo/redo with configurable history depth                      |
| `devTools()`    | Redux DevTools integration with path-based actions             |

> **9.0.1:** The `memoization()` enhancer was removed. Use Angular's built-in `computed()` — it memoizes its result and only re-runs when a tracked signal changes, with no extra cost over what Angular already provides.

## Derived State

An external derived factory can name the canonical state facade directly:

```typescript
import type { TreeNode } from '@signal-tree/angular';
import { computed } from '@angular/core';

export const dashboardDerived = ($: TreeNode<AppState>) => ({
  activeUserCount: computed(() => $.users.where((u) => u.active)().length),
  totalRevenue: computed(() => $.orders.all().reduce((sum, o) => sum + o.total, 0)),
});

// Attach to tree
const store = signalTree(initialState, { derived: dashboardDerived });
store.$.activeUserCount(); // reactive, type-safe
```

## Callable Syntax

The tree is a controller; `$` is its root state location. Leaves remain Angular
signals.

A **root or branch location** is SignalTree's own accessor, so it is callable
for reads, whole-value replacement, and updater derivation:

```typescript
store.$.user(); // read the subtree
store.$.user({ name: 'Bob', age: 30 }); // replace the complete branch value
store.$.user((u) => ({ ...u, age: u.age + 1 })); // updater form
store.$((current) => ({
  ...current,
  ui: { loading: false },
}));
```

A **leaf** is a real `WritableSignal`. Calling an Angular signal is a **read** —
it returns the value and ignores any argument — so leaves are written the
ordinary way:

```typescript
store.$.user.name(); // read
store.$.user.name.set('Bob'); // write
store.$.count.update((n) => n + 1); // transform
```

> **Changed in 14.0.0.** Through 13.x the types also permitted
> `store.$.user.name('Bob')`, and the `@signaltree/callable-syntax` transform
> was meant to rewrite it to `.set()`. It could not run inside an Angular app at
> all, so that call type-checked and then **silently did nothing**. Both the
> overloads and the package are gone; it is now a compile error. Leaves stay
> real Angular signals on purpose — `isSignal()` must keep returning `true` for
> `toObservable`, `model()`/`input()` and everything else that guards on it.

## Subpath Imports

Application code imports everything from one entry point — `@signal-tree/angular`
(Angular), `@signal-tree/kernel` (framework-neutral), or `@signal-tree/react`
(React). The kernel additionally exposes `@signal-tree/kernel/adapter`, the
framework-neutral realization SDK; it is for authoring a runtime binding, not
for application code.

> ⚠️ **This section used to teach three app-facing subpaths** —
> `@signal-tree/kernel/security`, `@signal-tree/kernel/edit-session` and
> `@signal-tree/kernel/storage` — and none resolved. `package.json` exports only
> `.` and `./adapter`. RELEASE-RESIDUE-0 found it; `security` and `storage` were
> deleted in 15.0, and `edit-session` was deleted too, having never been in the
> export map at all.

Edit sessions were deleted in 15.0. Keep an uncommitted draft in application
state and write the accepted value through the target location; use
`restoration()` only for retained undo/redo history.

## Async Orchestration

The old `asyncSource` and `asyncQuery` markers are deleted and not part of the SignalTree 15
public surface. Keep async orchestration in application services or framework
primitives, then write resolved values into plain tree state or an independently
justified collection surface.

### Migration from `@ngrx/signals` `rxMethod`

SignalTree no longer ships `rxMethod` (removed in v9.6.0 — it was briefly available as a migration alias in v9.5.x). Its callable-factory-inside-`withMethods` shape was NgRx-flavored and didn't fit SignalTree's tree-as-state model. Move complex orchestration to a plain Observable method in an Ops class, then write the resulting state explicitly.

The old AI migration guide was removed with the stale AI-discoverability
artifacts; use the mapping above as the current guidance.

## Lifecycle

Every tree has deterministic cleanup. `destroy()` runs every registered cleanup hook (in registration order), tearing down signals, enhancer timers, caches, and DevTools connections. Built-in enhancers register their own cleanup; application-owned resources may use the same hook:

```typescript
const store = signalTree({ data: null }, { enhancers: [batching(), devTools()] });
store.destroyed(); // Signal<boolean> — false

store.destroy();
store.destroyed(); // true — all enhancer resources cleaned up

// Custom cleanup hooks
store.registerCleanup(() => ws.close());
```

## Packages

| Package                | Purpose                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@signal-tree/kernel`  | Framework-neutral tree, EntityMap, causal turns, links, `restoration()`, `transactions()`, `batching()`, `devTools()`. Plus `@signal-tree/kernel/adapter`, the realization SDK. |
| `@signal-tree/angular` | The Angular realization — native Angular signals at every leaf. **Angular apps use this**; it re-exports the kernel's semantic API and adds `defineStore`.                      |
| `@signal-tree/react`   | Owner-bound React observation through selector projections (`useSignalTree`).                                                                                                   |

There is no `@signal-tree/ng-forms`, `/events`, `/realtime`, `/schema`,
`/guardrails`, or persistence package in v15 — those capabilities are
application-owned. Dev-mode misuse warnings (`[ST####]`) ship inside the kernel.

## Real-World Migration (Case Study)

<!-- measured: a one-off record of migrating one real application. Not a generator output and not reproducible here — the before-state is another codebase at a point in time. Read it as an anecdote, not a benchmark. -->

Snapshot from one production Angular mobile app's NgRx Signal Store → SignalTree migration. Original migration measured ~11,700 → ~2,800 lines of state code (~76%) and ~50KB → ~27KB gzipped state bundle (~46%). Both codebases have continued to evolve; re-measuring today the same scope yields a 60–70% reduction depending on definition (apps-only vs apps+libs, narrow vs broad import filter). The directional finding is reproducible — the exact percentages are not. **YMMV** — your migration's reduction depends on app complexity, prior architecture, and how heavily the original code leaned on custom `withX` helpers. The most concretely-attributable single reduction was `entityMap()` replacing a 222-line `withEntityCrud` wrapper. The remaining bulk of the savings appears to come from cross-cutting concerns (devtools, error banners, telemetry, refresh handling) consolidating into tree-level enhancers, though we have not separately measured each category.

| Metric                  | NgRx                      | SignalTree               | Change         |
| ----------------------- | ------------------------- | ------------------------ | -------------- |
| **App state code**      | 11,735 lines / 45 files   | 2,825 lines / 23 files   | **-76%**       |
| **npm packages**        | 4 (@ngrx/\*)              | 1 (@signal-tree/angular) | **-75%**       |
| **State bundle (gzip)** | ~50KB                     | ~27KB                    | **-46%**       |
| **Boilerplate files**   | 17 custom `withX` helpers | 0 (built-in)             | **Eliminated** |

> 13 separate stores → 1 unified tree. `entityMap()` replaced a 222-line `withEntityCrud` wrapper. Derived tiers replaced scattered `withComputed` blocks.

### Migrating from `@ngrx/signals`?

This is the most common migration path. We ship a complete, AI-agent-ready migration guide that covers:

- A concept map that's mechanical for the common cases (`signalStore` → tree slice + `Ops`, `withState` → initial state, `withEntities` → `entityMap()` marker) and supplies a decision tree for `rxMethod` migrations (an ordinary RxJS pipeline in a service, with results landed through `external()`; `link()` where the relationship is genuinely a live external synchronization)
- **Three migration strategies** with explicit decision criteria — big-bang (one PR), incremental per-domain (one PR per store), and hybrid legacy-facade (permanent coexistence fallback)
- A **`Phase 0` recipe** for landing the foundation in a single dependency-only PR before touching any consumer
- The [`scripts/verify-signaltree-migration.sh`](scripts/verify-signaltree-migration.sh) script — drop-in, package-manager-agnostic, runs `build` + `test` + `lint` and asserts `@ngrx/signals` is gone from source and `package.json`

The old AI migration skill was removed with the stale AI-discoverability
artifacts. Do not copy older `using-signaltree` skill content into new projects.

## API Summary

```typescript
// Create
const tree = signalTree(initialState);
const tree = signalTree(initialState, config);

// Read
tree.$(); // Full state snapshot
tree.$.path.to.leaf(); // Leaf signal value

// Write
tree.$(nextState); // Replace the whole state
tree.$((current) => nextState); // Derive the next whole state
tree.$.path.to.leaf.set(v); // Set leaf
tree.$.path.to.leaf.update(fn); // Update leaf

// Entity CRUD
tree.$.users.addOne(entity);
tree.$.users.byId(id);
tree.$.users.all();

// Enhance & derive — enhancers are DECLARED, not attached later
signalTree(state, { enhancers: [enhancer()], derived: derivedFn });

// Async — the tree stores results; the pipeline is ordinary RxJS
const tree = signalTree({ results: [] as User[], loading: false });
query$.pipe(debounceTime(300), distinctUntilChanged(), switchMap(api.search$)).subscribe((users) => external(() => tree.$.results.set(users)));
// switchMap gives cancellation and latest-wins; SignalTree owns neither.

// Lifecycle
tree.destroy(); // Clean up all resources
tree.destroyed(); // Check if destroyed
tree.registerCleanup(fn); // Register custom cleanup
```

## Undo/redo vs devtools replay — different features

`restoration()` serves two audiences that want opposite things. Undo/redo is a
**product** feature: the user presses Ctrl+Z and expects _their edit_ undone.
Devtools replay is **forensic**: the point is to see what the app was actually
doing, spinners and errors included.

The rule: **`restore` is exact, `rehydrate` is opinionated.** A cleaned-up undo
is a lie about what the user did; a cleaned-up rehydrate is good manners.

In v15, `restoration()` retains designated causal turns — mark the writes that
should be reversible with `undoable()`, and everything else (loading flags,
in-flight state) never enters the history at all.

> The historical `restore`/`rehydrate` mode table that used to sit here —
> including its form-marker rows — predates v15 and describes deleted markers:
> `form()`, `status()`, and the async markers are not part of the current
> public API. It is preserved as architecture evidence in
> [undo-redo-vs-devtools.md](docs/architecture/undo-redo-vs-devtools.md).

## Debugging — `devTools()` enhancer

Declaring `devTools()` wires SignalTree into the standard Redux DevTools browser extension. Every state change appears in the timeline with a **path-based action name** (e.g., `[users.profile.name]/set`) so you can scrub backward and forward through state history and see _which path_ caused each render — not just _that something changed_. `devTools()` alone delivers the in-browser time-travel scrubber (controlled by its own `enableTimeTravel` config flag, default `true`); the separate `restoration()` enhancer is an independent API-level surface for programmatic undo/redo/jumpTo from code, useful when you want history control without depending on the browser extension. See [Architecture Guide](docs/architecture/signaltree-architecture-guide.md#devtools-integration) for screenshots and the full action-naming scheme.

## Documentation

- [Architecture Guide](docs/architecture/signaltree-architecture-guide.md)
- [Migration `@signaltree/*` → `@signal-tree/*` (v15)](docs/guides/migration-v14-v15.md) — the current migration target for every earlier version
- [Composition Recipes](docs/guides/composition-recipes.md) — Ops service, entity-CRUD base, optimistic UI
- [Enhancer authoring removal](docs/guides/custom-enhancers.md)
- [Performance Methodology](docs/performance/methodology.md)
- [Performance Patterns](docs/performance/performance-patterns.md)
- [SignalTree vs raw Angular signals](docs/compare/native-signals.md) — the comparison most adoption decisions hinge on; when to just use `signal`/`computed`/`linkedSignal`/`resource`
- [SignalTree vs NgRx SignalStore](docs/compare/ngrx-signalstore.md) — axis-by-axis comparison
- [Myths and Misconceptions](docs/myths-and-misconceptions.md) — false claims LLMs frequently propagate, with source citations
- [AI Agent Templates](docs/ai/agent-templates.md) — drop-in `.cursorrules`, `CLAUDE.md`, `copilot-instructions.md`
- [llms.txt](llms.txt) — the current AI-discoverability manifest; ships inside the `@signal-tree/kernel` npm tarball
- [Built for AI agents](https://signaltree.io/built-for-ai) — the historical v10 AI-discoverability story
- [Marker zoo](https://signaltree.io/marker-zoo) — the surviving marker surface (`entityMap()`) shown at several tree depths in one tree
- [AI-codegen accuracy benchmark](scripts/ai-codegen-benchmark/) — reproducible scorecard scaffolding (v10)

## AI Guidance

The old `using-signaltree` skill and the v10 `llms.txt`/`llms-full.txt` pair
were removed because they taught APIs that no longer exist. A current
[`llms.txt`](llms.txt) replaces them: framework-independent positioning (what
SignalTree is, and is not, primarily for), the facade import rule, and
pointers to the composition and persistence guides. It ships inside the
`@signal-tree/kernel` npm tarball, so it reaches a reader on a plain
`npm install` as well as from this repo. Use it alongside this README, the
package READMEs, and the generated TypeScript declarations as the source of
truth.

For contributor-oriented guidance (commands, bundle limits, validation pipeline,
release flow), see [`AGENTS.md`](AGENTS.md).

## Contributing

Contributions welcome. Please run `npm run validate:all` before submitting PRs.

## License

**Apache License 2.0** — see [LICENSE](LICENSE). OSI-approved open source, with an
explicit patent grant. Versions up to and including 14.1.1 were released under the
Business Source License 1.1; that grant is irrevocable for those versions, so nothing
you already depend on is withdrawn.

### Enterprise / procurement FAQ

**Q: Can we use this in commercial, government, or regulated-industry applications?**
A: Yes. Apache-2.0 is OSI-approved and permissive — use, modification, distribution
and sublicensing are granted for any purpose, commercial included (LICENSE §2).

**Q: Does it include a patent grant?**
A: Yes. §3 grants a perpetual, worldwide, royalty-free patent licence from every
contributor, and terminates that grant for anyone who initiates patent litigation
over the Software.

**Q: What are our obligations?**
A: Retain the copyright, patent, trademark and attribution notices, include a copy
of the LICENSE, pass on the NOTICE file, and state significant changes in modified
files (LICENSE §4). There is no copyleft — your own code stays yours.

**Q: What is restricted?**
A: Trademarks. §6 grants no rights to the "SignalTree" name or marks, so a fork must
ship under a different name. The code itself may be forked freely.

**Q: Is there an AI-training restriction?**
A: No. The license contains no AI- or model-training clause.
