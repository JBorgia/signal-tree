# SignalTree Application Architecture

This guide defines the recommended application architecture for SignalTree 15.
It describes the current public packages and construction model. Historical
alternatives remain available in git history; they are not compatibility
requirements for new applications.

## Recommended Architecture (TL;DR)

Use one tree for an application state authority unless a shorter ownership
boundary justifies another tree.

1. Construct Angular trees through `@signal-tree/angular`, React trees through
   `@signal-tree/react`, and framework-neutral trees through
   `@signal-tree/kernel`.
2. Declare state, all enhancers, and one derived factory in the initial
   `signalTree(...)` call.
3. Let components read a read-only `$` facade.
4. Put writes and asynchronous orchestration in explicit operation services.
5. Keep network fetching, persistence, scheduling, and framework effects at the
   application boundary.
6. Call `destroy()` when the tree's owner is torn down. `defineStore` binds this
   automatically to Angular's injector lifetime.

There is no late enhancement, fluent `.derived()` chain, effects enhancer,
persistence enhancer, form package, or framework-neutral global installation.

## Package Ownership

| Package                | Owns                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `@signal-tree/kernel`  | Framework-neutral state, EntityMap, links, restoration, transactions, batching, and DevTools |
| `@signal-tree/angular` | Angular signal realization, `defineStore`, and Angular interop                               |
| `@signal-tree/react`   | React owner-bound observation                                                                |

Applications should import construction from their framework package. The
kernel remains appropriate for framework-neutral runtimes, libraries, and tiny
fake realizations used in tests.

## One Construction Grammar

Angular example:

```typescript
import { computed } from '@angular/core';
import { batching, defineStore, entityMap, restoration, signalTree } from '@signal-tree/angular';

type Ticket = {
  id: number;
  title: string;
  closed: boolean;
};

export const AppTree = defineStore(
  () =>
    signalTree(
      {
        tickets: entityMap<Ticket, number>({
          selectId: (ticket) => ticket.id,
        }),
        selectedId: null as number | null,
        filter: '',
      },
      {
        enhancers: [batching(), restoration({ maxHistorySize: 50 })],
        derived: ($) => {
          const selected = computed(() => {
            const id = $.selectedId();
            return id === null ? null : $.tickets.byId(id)?.() ?? null;
          });

          return {
            selected,
            visibleTickets: computed(() => {
              const filter = $.filter().toLowerCase();
              return $.tickets.all().filter((ticket) => ticket.title.toLowerCase().includes(filter));
            }),
            canCloseSelected: computed(() => selected()?.closed === false),
          };
        },
      }
    ),
  { providedIn: 'root' }
);
```

The derived factory runs once after enhancer setup. When one computed depends on
another, keep the first in a local and return both. Do not create dependency
"tiers" through repeated construction calls.

Declaration order in `enhancers` is not dependency order. SignalTree validates
the complete set before construction and resolves provider requirements from
that set.

## Read, Write, React

### Read

Components read from `$`. Root and object branches are callable whole-value
accessors. Terminal leaves use the facade's native carrier: Angular signals,
Vue refs, or neutral kernel locations.

```typescript
const selected = tree.$.selected();
const filter = tree.$.filter();
const snapshot = tree.$();
```

Expose `asReadonly(tree)` when a consumer should not mutate state. On the
read-only EntityMap surface, mutation methods are absent and `byId()` returns a
read-only entity node.

### Write

Use explicit operation methods for domain writes. This keeps components from
coordinating multi-step mutations and gives asynchronous work one owner.

```typescript
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TicketOps {
  private readonly tree = inject(AppTree);
  private readonly api = inject(TicketApi);

  select(id: number | null): void {
    this.tree.$.selectedId.set(id);
  }

  async refresh(): Promise<void> {
    const tickets = await this.api.list();
    this.tree.$.tickets.setAll(tickets);
  }

  closeSelected(): void {
    const selected = this.tree.$.selected();
    if (selected) {
      this.tree.$.tickets.updateOne(selected.id, { closed: true });
    }
  }
}
```

A service may expose a read-only tree facade alongside operation namespaces when
an application wants a single injection point. That facade is application
structure, not another state authority.

### React

Use the framework's own effect primitive for application side effects. Effects
observe state; they do not become SignalTree capabilities.

```typescript
import { effect, inject, Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TicketFilterSync {
  private readonly tree = inject(AppTree);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      void this.router.navigate([], {
        queryParams: { filter: this.tree.$.filter() || null },
      });
    });
  }
}
```

## Domain Shape

Prefer domain-grouped state when data and its local UI state change together:

```typescript
const state = {
  tickets: {
    entities: entityMap<Ticket, number>({
      selectId: (ticket) => ticket.id,
    }),
    status: 'idle' as 'idle' | 'loading' | 'loaded' | 'error',
    error: null as Error | null,
  },
};
```

A flat shape is fine for small stores. The important invariant is ownership:
store each fact once, retain entity identity in EntityMap, and derive projections
instead of duplicating selected or filtered objects.

## Async Work

SignalTree does not own HTTP requests, cancellation policy, retries, or cache
invalidation. Keep those decisions in application services or framework
primitives, then write resolved values into ordinary state or EntityMap.

Use `external()` when an external synchronization write must remain outside
restoration history:

```typescript
import { external } from '@signal-tree/angular';

external(() => {
  tree.$.tickets.setAll(serverTickets);
});
```

Use `link()` only when the relationship is genuinely live synchronization, not
as a general request wrapper.

## Persistence And Hydration

SignalTree 15 does not publish persistence or serialization enhancers. The
application owns storage format, migration, error handling, and hydration
policy.

```typescript
const saved = localStorage.getItem('app-state');
if (saved) {
  tree.$(JSON.parse(saved));
}

effect(() => {
  localStorage.setItem('app-state', JSON.stringify(tree.$()));
});
```

For SSR, serialize an application-defined payload and construct the client tree
from the validated payload. Do not treat arbitrary runtime values as a
framework-owned serialization contract.

## Forms And Drafts

There is no `@signaltree/ng-forms` package in v15. Keep form state in Angular
forms or ordinary tree state. A bounded draft can be committed through an Ops
method; use `restoration()` only when retained undo/redo history is a product
requirement.

## Restoration And Transactions

`restoration()` records eligible causal turns and provides undo/redo history.
`undoable()` marks an authored turn as eligible; it does not create a new turn.

Use `transactions()` for an explicit pending workflow that must later be
confirmed or rolled back. Transactions and restoration solve different
problems: pending authority versus retained historical navigation.

## DevTools Integration

Declare `devTools()` in the construction config. It connects the tree to Redux
DevTools and adds the typed debug-session surface.

```typescript
const tree = signalTree(state, {
  enhancers: [devTools({ name: 'Tickets' })],
});

const session = tree.exportDebugSession();
```

Do not use DevTools as an application event bus. Domain behavior remains in Ops
methods and application effects.

## Tree Lifetime

A tree owns runtime resources until `destroy()` releases them.

- An app-root store may live for the entire application.
- A component, route, SSR request, test, or temporary workflow owns a bounded
  tree and must destroy it at that boundary.
- `defineStore` registers destruction with Angular `DestroyRef`.
- Test harnesses that construct trees in loops must destroy each tree.

Dropping the last local reference is not a prompt cleanup mechanism.

## Multiple Trees

Use multiple trees only when they have distinct owners or lifetimes, such as an
app-root store and an isolated route workflow. Do not split one authority merely
to shorten files or imitate feature modules.

Before adding a tree, answer:

1. Who creates and destroys it?
2. Which facts does it own exclusively?
3. How do cross-tree relationships avoid duplicate authority?
4. Why is a domain branch in the existing tree insufficient?

## Testing

Test state semantics and operations separately:

```typescript
it('closes the selected ticket', () => {
  const tree = signalTree({
    tickets: entityMap<Ticket, number>({ selectId: (ticket) => ticket.id }),
    selectedId: 1,
  });

  tree.$.tickets.addOne({ id: 1, title: 'A', closed: false });
  tree.$.tickets.updateOne(1, { closed: true });

  expect(tree.$.tickets.byId(1)?.()?.closed).toBe(true);
  tree.destroy();
});
```

Use Angular injection tests for `defineStore` lifecycle and Ops services. Use
type tests to prove read-only consumers cannot reach mutation methods.

## Decision Guide

| Need                              | Place it                                        |
| --------------------------------- | ----------------------------------------------- |
| Owned mutable fact                | Initial tree state                              |
| Normalized collection             | `entityMap()`                                   |
| Stable computed projection        | The single config-level `derived` factory       |
| Domain mutation                   | Ops method                                      |
| HTTP, retry, cancellation         | Application service or framework primitive      |
| Router, analytics, storage effect | Framework effect or application service         |
| Undo/redo                         | `restoration()` and explicit `undoable()` turns |
| Pending confirm/rollback          | `transactions()`                                |
| Framework-specific lifecycle      | Framework package                               |
| Bounded resource cleanup          | Owning boundary and `destroy()`                 |

## Anti-Patterns

- Importing Angular construction from the neutral kernel.
- Calling deleted fluent `.with()` or `.derived()` APIs.
- Inventing multiple derived tiers instead of composing local computeds.
- Putting network, persistence, routing, or form ownership into a kernel
  enhancer.
- Exposing a writable tree to components that only need reads.
- Storing selected or filtered entity copies beside their EntityMap authority.
- Creating trees without naming their owner and destruction boundary.
- Preserving a legacy migration concept in the target architecture solely to
  reduce migration work.

The target architecture is derived from current semantics and ownership. A
legacy application may falsify it, but does not define it.
