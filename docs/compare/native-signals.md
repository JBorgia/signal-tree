# SignalTree vs Raw Angular Signals

Raw Angular signals are the framework primitives and the right default for
small, component-owned state. SignalTree is a state library built on those
primitives. Choose it only when its structure and capabilities remove work your
application would otherwise own.

## Short Answer

| Use                 | When                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Raw Angular signals | A component owns a few values, one derived value, or one resource; zero dependency and direct framework semantics matter most |
| SignalTree          | State has durable domain structure, many deep consumers, normalized collections, or product-level restoration/transactions    |
| Either              | The state is moderate and team familiarity matters more than library mechanics                                                |

App size is not the dividing line. Ownership, access patterns, and required
capabilities are.

## What Angular Already Provides

Angular provides:

- `signal()` for writable values
- `computed()` for memoized derivation
- `linkedSignal()` for writable derived state tied to a source
- `effect()` for framework-owned side effects
- `resource()` and `rxResource()` for asynchronous loading

Use these directly for local UI state. SignalTree should not wrap a single
signal merely to create a store-shaped abstraction.

## What SignalTree Adds

SignalTree adds:

- a typed `$` path facade over nested domain state
- granular leaf reactivity without hand-creating every signal
- `entityMap()` for keyed identity, stable handles, ordering, CRUD, and queries
- one config-level derived factory merged into `$`
- `restoration()` for retained undo/redo history
- `transactions()` for pending confirm/rollback workflows
- `devTools()` and deterministic `destroy()` lifecycle
- a framework-neutral kernel shared by Angular and React realizations

SignalTree 15 does not add request ownership, persistence, serialization, forms,
or validation. Those remain application or framework responsibilities.

## Example

Raw signals:

```typescript
const users = signal<User[]>([]);
const selectedId = signal<number | null>(null);
const selected = computed(() => users().find((user) => user.id === selectedId()) ?? null);
```

SignalTree:

```typescript
import { computed } from '@angular/core';
import { entityMap, signalTree } from '@signal-tree/angular';

const tree = signalTree(
  {
    users: entityMap<User, number>({ selectId: (user) => user.id }),
    selectedId: null as number | null,
  },
  {
    derived: ($) => ({
      selected: computed(() => {
        const id = $.selectedId();
        return id === null ? null : $.users.byId(id)?.() ?? null;
      }),
    }),
  }
);
```

The raw version is simpler for one small collection. EntityMap earns its cost
when keyed updates, stable per-entity consumers, ordering, or collection queries
would otherwise be implemented repeatedly.

## Axis By Axis

| Axis                   | Raw signals                                      | SignalTree 15                                                                  |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Component-local values | Native and minimal                               | Usually unnecessary                                                            |
| Deep domain paths      | Hand-created signals or immutable object updates | Typed `$` paths with reactive leaves                                           |
| Derived values         | `computed()`                                     | The same primitive returned from one config-level factory                      |
| Async loading          | `resource`, `rxResource`, RxJS, services         | The same application/framework primitives; resolved values write into the tree |
| Keyed collections      | Application-owned map/index logic                | `entityMap()`                                                                  |
| Persistence            | Application-owned                                | Application-owned                                                              |
| Forms and validation   | Angular forms and validators                     | Angular forms and validators                                                   |
| Undo/redo              | Application-owned                                | `restoration()`                                                                |
| Pending operations     | Application-owned                                | `transactions()`                                                               |
| DevTools               | Angular/browser tooling                          | `devTools()` enhancer                                                          |
| Lifecycle              | Angular owner                                    | Explicit `destroy()`; `defineStore` binds it to `DestroyRef`                   |
| Dependency             | None beyond Angular                              | SignalTree packages                                                            |

## Use Raw Signals When

- State belongs to one component or a short-lived local interaction.
- A single `resource()` owns the complete async need.
- A plain array replaced as a whole matches the read pattern.
- Zero additional dependency is more valuable than a shared state vocabulary.
- The team does not need EntityMap, restoration, transactions, or tree-wide
  path access.

## Use SignalTree When

- Many consumers bind below the top level and write frequency is meaningful.
- Domain paths should remain visible and consistently typed across an app.
- Keyed entities need O(1) lookup and stable per-entity handles.
- Undo/redo or pending transaction authority is part of the product.
- Angular and React realizations must share framework-neutral state semantics.
- Explicit tree lifetime is useful for routes, SSR requests, tests, or temporary
  workflows.

## Costs And Limits

- Materializing a whole tree or EntityMap collection has a cost; do not call
  `.all()` on every change when consumers only need individual entities.
- Large-collection deep undo favors immutable root replacement in some
  workloads. Measure the product's actual history pattern.
- SignalTree defaults to a writable tree. Use `asReadonly()` or read-only
  `defineStore` for consumers that should only read.
- The package is less familiar to tools and developers than native Angular
  primitives. Keep current package types and READMEs available to code agents.

## Performance Evidence

Use executable generators rather than copied numbers:

- `tools/check-bundle-budget.mjs`
- `tools/bench-state-scale.mjs`
- `tools/bench-vs-signalstore.mjs`
- `tools/bench-depth-latency.mjs`

Re-run the workload that matches the application before choosing a library for
performance reasons.

See also [SignalTree vs NgRx SignalStore](ngrx-signalstore.md).
