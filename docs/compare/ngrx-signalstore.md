# SignalTree vs `@ngrx/signals`

This is the current comparison between SignalTree 15 and NgRx SignalStore. NgRx
claims are based on the `@ngrx/signals` version pinned by this repository's
benchmark tooling. SignalTree claims are limited to the public v15 package
surfaces.

## Short Answer

Choose SignalTree when you want a domain-shaped state tree, direct path reads
and writes, normalized collections at arbitrary tree locations, and explicit
application services for operations and async work.

Choose NgRx SignalStore when your team wants a larger Angular ecosystem,
read-only consumer state by default, `rxMethod`, reusable `signalStoreFeature`
composition, and conventions close to other NgRx libraries.

Neither library is categorically better. The important difference is ownership
and composition style, not benchmark rank.

## Construction

### NgRx SignalStore

```typescript
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

export const TicketStore = signalStore(
  withState({
    tickets: [] as Ticket[],
    selectedId: null as number | null,
  }),
  withComputed(({ tickets, selectedId }) => ({
    selected: computed(() => tickets().find((ticket) => ticket.id === selectedId()) ?? null),
  })),
  withMethods((store) => ({
    select(id: number | null): void {
      patchState(store, { selectedId: id });
    },
  }))
);
```

NgRx composes state, computed values, methods, hooks, and reusable features at
the store level through `with*` functions.

### SignalTree

```typescript
import { computed } from '@angular/core';
import { entityMap, signalTree } from '@signal-tree/angular';

const tree = signalTree(
  {
    tickets: entityMap<Ticket, number>({
      selectId: (ticket) => ticket.id,
    }),
    selectedId: null as number | null,
  },
  {
    derived: ($) => ({
      selected: computed(() => {
        const id = $.selectedId();
        return id === null ? null : $.tickets.byId(id)?.() ?? null;
      }),
    }),
  }
);
```

SignalTree has one construction grammar: initial state, an optional enhancer
array, and one optional derived factory. It does not have late enhancement or a
reusable feature primitive equivalent to `signalStoreFeature`.

## Axis By Axis

| Axis                      | NgRx SignalStore                                | SignalTree 15                                                                             |
| ------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Mental model              | Store assembled from `with*` features           | Reactive state tree addressed through `$`                                                 |
| State                     | `withState(...)`                                | First `signalTree(...)` argument                                                          |
| Computed state            | `withComputed(...)`                             | One config-level `derived` factory                                                        |
| Methods                   | `withMethods(...)`                              | Direct writes or application-owned Ops services                                           |
| Reusable composition      | `signalStoreFeature(...)`                       | No direct equivalent; use state factories, derived factories, and explicit services       |
| Angular DI                | `signalStore(...)` class                        | `defineStore(...)` provider                                                               |
| Default consumer mutation | Protected state by default                      | Writable tree by default; `asReadonly(...)` or read-only `defineStore` is explicit        |
| Collections               | `withEntities(...)`                             | `entityMap()` at any state path                                                           |
| Async orchestration       | `rxMethod(...)` and RxJS                        | Application service, RxJS, or Angular resource; resolved writes enter the tree explicitly |
| Undo/redo                 | DevTools timeline or application implementation | `restoration()` with designated `undoable()` turns                                        |
| Pending confirm/rollback  | Application implementation                      | `transactions()`                                                                          |
| DevTools                  | NgRx/toolkit ecosystem                          | `devTools()` enhancer                                                                     |
| Persistence               | Application or community plugin                 | Application-owned in v15                                                                  |
| Forms                     | Angular forms and ecosystem integrations        | Angular forms or ordinary application state; no SignalTree forms package                  |
| Framework scope           | Angular                                         | Neutral kernel plus Angular and React realizations                                        |

## Reads And Writes

NgRx encourages writes through methods and protects consumer state by default:

```typescript
store.select(42);
store.selected();
```

SignalTree exposes path-addressed reads and writes:

```typescript
tree.$.selectedId.set(42);
tree.$.selected();
```

For production applications, SignalTree recommends that components receive a
read-only `$` facade plus explicit Ops methods. NgRx gets closer to that shape by
default; SignalTree makes the boundary an application architecture decision.

```typescript
@Injectable({ providedIn: 'root' })
export class TicketOps {
  private readonly tree = inject(AppTree);

  select(id: number | null): void {
    this.tree.$.selectedId(id);
  }
}
```

This is a real NgRx advantage for teams that want mutation protection without
building a facade. SignalTree's advantage is that low-level path mutation
remains available where it is appropriate, including tests and small stores.

## Entity Collections

NgRx entities compose at the store level and support named collections when one
store owns several entity types. Mutations are state updaters passed through
`patchState`.

SignalTree's `entityMap()` is a state marker and can occur at any object path:

```typescript
const tree = signalTree({
  organizations: {
    selected: {
      members: entityMap<User, number>({
        selectId: (user) => user.id,
      }),
    },
  },
});

tree.$.organizations.selected.members.setAll(users);
const user = tree.$.organizations.selected.members.byId(42)?.();
```

EntityMap owns identity, stable entity handles, insertion order, and collection
queries. Do not duplicate selected entities beside the collection; store an ID
and derive the projection.

## Derived State

Both libraries use Angular `computed()` for Angular applications.

NgRx computed values are one composition feature among others. SignalTree deep
merges the result of its one derived factory into `$`, so a projection can live
beside the state it describes.

When a SignalTree computed depends on another computed, compose through an
ordinary local:

```typescript
const tree = signalTree(state, {
  derived: ($) => {
    const selected = computed(() => $.tickets.byId($.selectedId() ?? -1)?.());
    return {
      selected,
      canCloseSelected: computed(() => selected()?.closed === false),
    };
  },
});
```

SignalTree does not have derived tiers or a fluent derived chain in v15.

## Async And RxJS

NgRx SignalStore's `rxMethod` is the more integrated option when a team wants
RxJS pipelines declared as store methods.

SignalTree intentionally leaves request ownership, cancellation, retry, and
cache policy to application services or framework primitives:

```typescript
@Injectable({ providedIn: 'root' })
export class UserOps {
  private readonly tree = inject(AppTree);
  private readonly api = inject(UserApi);

  async refresh(): Promise<void> {
    const users = await this.api.list();
    external(() => this.tree.$.users.setAll(users));
  }
}
```

`external()` classifies a synchronous write as external truth so restoration
does not claim authority over it. Acquire data first; do not pass an async
callback to `external()`.

## Persistence And Forms

SignalTree 15 does not publish persistence, serialization, storage, or forms
packages. Applications own storage payloads and migration policy. Angular owns
form control and validation behavior.

NgRx has a larger community ecosystem for both concerns. That ecosystem is a
practical advantage when an existing plugin matches the application's contract.

## Restoration And Transactions

SignalTree's `restoration()` retains designated causal turns for undo and redo.
It is not a request rollback mechanism. `transactions()` owns an explicit
pending operation that can be confirmed or rolled back.

These capabilities are useful when the product needs them, but their presence
should not decide the library choice for applications that do not.

## Lifecycle

Both libraries integrate with Angular ownership boundaries. SignalTree also
exposes explicit `destroy()` because the neutral kernel cannot assume a
framework lifecycle. `defineStore` connects tree destruction to Angular
`DestroyRef`.

Any test, SSR request, route, or temporary workflow that directly constructs a
SignalTree owns its destruction.

## Bundle Size And Performance

Both libraries are fast enough for ordinary UI state. Use this repository's
executable tools for current SignalTree measurements:

- `tools/check-bundle-budget.mjs` for enforced bundle ceilings
- `tools/bench-vs-signalstore.mjs` for task-level comparison
- `tools/bench-depth-latency.mjs` for path-depth behavior

Do not compare package tarball size, raw `dist` size, or a barrel file in place
of the application bundle a consumer actually ships. Re-run benchmarks on the
workload that matters before making a performance-driven choice.

## Where NgRx SignalStore Wins

- Larger community, ecosystem, and training-data footprint.
- Read-only consumer state by default.
- First-class `rxMethod` ergonomics.
- Reusable `signalStoreFeature` composition.
- Easier conceptual migration from other NgRx libraries.

## Where SignalTree Wins

- State shape and access paths remain visibly aligned.
- EntityMap can live at any state path.
- Derived projections merge into the same `$` namespace.
- Framework-neutral semantics are shared by Angular and React realizations.
- Restoration and pending transactions are explicit, distinct capabilities.
- Direct path operations keep small stores and focused tests concise.

## Migration Guidance

From NgRx SignalStore, migrate domain by domain rather than translating every
`with*` function mechanically:

| NgRx SignalStore     | SignalTree                                                                           |
| -------------------- | ------------------------------------------------------------------------------------ |
| `withState`          | Initial state object                                                                 |
| `withComputed`       | Config-level `derived` factory                                                       |
| `withMethods`        | Ops service methods                                                                  |
| `withEntities`       | `entityMap()`                                                                        |
| `rxMethod`           | Application-owned RxJS or async service                                              |
| `withHooks`          | Framework lifecycle or effect owner                                                  |
| `signalStoreFeature` | No direct equivalent; separate state, derivation, capability, and operation concerns |

A legacy application may reveal a missing requirement, but should not dictate
the target architecture. Preserve only concepts that survive on their own
semantic value.

## Further Reading

- [SignalTree application architecture](../architecture/signaltree-architecture-guide.md)
- [Myths and misconceptions](../myths-and-misconceptions.md)
- [Performance methodology](../performance/methodology.md)
