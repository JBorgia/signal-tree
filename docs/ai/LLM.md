# SignalTree 15 AI Reference

Current guidance for generating SignalTree 15 code. Package manifests, emitted
types, and package READMEs are authoritative when this document and installed
code disagree.

## Identify The Library

SignalTree is not NgRx SignalStore.

- Angular: `@signal-tree/angular`
- Framework-neutral kernel: `@signal-tree/kernel`
- React observation: `@signal-tree/react`

Do not generate historical `@signaltree/*` package names or invent capability
packages.

## Install For Angular

```bash
npm install @signal-tree/angular@15.0.0-rc.1
```

## Canonical Construction

Declare state, every enhancer, and one derived factory in the initial
`signalTree(...)` call.

```typescript
import { computed } from '@angular/core';
import { batching, defineStore, entityMap, leaf, signalTree } from '@signal-tree/angular';

type User = {
  id: number;
  name: string;
  active: boolean;
};

export const AppTree = defineStore(
  () =>
    signalTree(
      {
        users: entityMap<User, number>({
          selectId: (user) => user.id,
        }),
        selectedId: null as number | null,
        filter: '',
      },
      {
        enhancers: [batching()],
        derived: ($) => {
          const selected = computed(() => {
            const id = $.selectedId();
            return id === null ? null : $.users.byId(id)?.() ?? null;
          });

          return {
            selected,
            selectedName: computed(() => selected()?.name ?? 'None'),
            visibleUsers: computed(() => {
              const filter = $.filter().toLowerCase();
              return $.users.all().filter((user) => user.name.toLowerCase().includes(filter));
            }),
          };
        },
      }
    ),
  { providedIn: 'root' }
);
```

Rules:

- No `.with()` or fluent `.derived()` calls.
- One derived factory; compose dependent values through local computeds.
- Enhancer declaration order is not dependency order.
- Configuration is validated before construction.
- Angular applications construct through the Angular package, not the kernel.

For an external derived factory, type `$` with `TreeNode<State>` from
`@signal-tree/angular`. File organization does not create semantic derived tiers.

## State Access

`$` is the state facade.

```typescript
// Angular leaves: call to read; use native signal methods to write.
tree.$.filter();
tree.$.filter.set('active');
tree.$.filter.update((filter) => filter.trim());

// Branch: call with no argument to read; pass a value or updater to write.
tree.$.profile();
tree.$.profile({ name: 'Ada', timezone: 'UTC' });
tree.$.profile((profile) => ({ ...profile, timezone: 'CST' }));

// Root snapshot.
tree.$();
```

Branch value calls assign the complete branch value; they are not patch
operations. Derive a patched value with the updater form. There is no separate
`.state` or `.unwrap()` API.

Use `leaf(value)` to make a plain object terminal instead of traversable, and to
store callable data without confusing it with an updater:

```typescript
const tree = signalTree({
  range: leaf({ start: 0, end: 10 }),
  callback: leaf((value: number) => console.log(value)),
});

tree.$.range.set({ start: 5, end: 15 });
tree.$.callback.set((value) => persist(value));
```

Angular leaves are native signals. `toWritableSignal(branch)` adapts a callable
object branch when an Angular API requires one writable signal.

## EntityMap

Use `entityMap()` for normalized keyed collections. It may appear at any object
path in initial state.

```typescript
const users = tree.$.users;

users.addOne(user);
users.addMany(moreUsers);
users.setAll(serverUsers);
users.updateOne(user.id, { active: false });
users.replaceOne(user.id, replacement);
users.upsertOne(user);
users.removeOne(user.id);
users.removeMany(ids);
users.clear();

users.byId(user.id)?.();
users.byIdOrFail(user.id)();
users.all();
users.ids();
users.count();
users.empty();
users.has(user.id)();
users.where((candidate) => candidate.active)();
```

Store selected IDs and derive selected entities. Do not duplicate entity objects
beside their EntityMap authority. Hoist frequently evaluated `where` and `find`
predicates so their identity remains stable.

## Application Architecture

For non-trivial applications:

- Components read a read-only `$` facade.
- Injectable Ops services own domain writes and asynchronous orchestration.
- Framework effects own routing, analytics, and storage synchronization.
- Network services own fetching, retries, cancellation, and cache policy.
- Angular forms own form control and validation.

```typescript
import { Injectable, inject } from '@angular/core';
import { external } from '@signal-tree/angular';

@Injectable({ providedIn: 'root' })
export class UserOps {
  private readonly tree = inject(AppTree);
  private readonly api = inject(UserApi);

  select(id: number | null): void {
    this.tree.$.selectedId(id);
  }

  async refresh(): Promise<void> {
    const users = await this.api.list();
    external(() => this.tree.$.users.setAll(users));
  }
}
```

Use `asReadonly(tree)` or
`defineStore(factory, { expose: 'readonly' })` when a consumer should not receive
mutation methods. This is compile-time narrowing of the same runtime object, not
a security boundary.

## External Truth

Use `external()` for a synchronous write whose authority came from outside the
current authored operation:

```typescript
const tickets = await api.list();
external(() => tree.$.tickets.setAll(tickets));
```

Acquire data first. Do not pass an async callback to `external()`; its causal
classification scope is synchronous.

Use `link()` only for a genuine live synchronization relationship, not as a
request wrapper.

## Built-In Capabilities

Declare capabilities in `enhancers`:

| API              | Purpose                                      |
| ---------------- | -------------------------------------------- |
| `batching()`     | Group notification work                      |
| `restoration()`  | Retained undo/redo history                   |
| `transactions()` | Pending confirm/rollback workflows           |
| `devTools()`     | Redux DevTools and debug-session integration |

### Restoration

```typescript
const tree = signalTree({ title: '' }, { enhancers: [restoration({ maxHistorySize: 50 })] });

undoable(() => tree.$.title.set('Draft'));
tree.undo();
tree.redo();
```

`undoable()` designates a synchronous authored turn. It does not create an async
scope. Writes classified with `external()` are observed but are not claimed as
undoable authored history.

### Transactions

Use `transactions()` when an operation is pending and must later be confirmed or
rolled back. Transactions and restoration are different authority models; do
not use undo as a substitute for request reconciliation.

## Persistence And SSR

SignalTree 15 has no public persistence or serialization enhancer. Applications
own payload format, migrations, storage errors, hydration validation, and
durability.

```typescript
const saved = localStorage.getItem('settings');
if (saved) tree.$.settings(JSON.parse(saved));

effect(() => {
  localStorage.setItem('settings', JSON.stringify(tree.$.settings()));
});
```

For SSR, validate an application-defined payload and construct the client tree
from it.

## Forms

SignalTree 15 has no form marker or forms companion package. Use Angular forms,
or hold a bounded draft as ordinary application state. Use restoration only when
retained undo/redo is a product requirement.

## Lifetime

Every tree owns resources until `destroy()` runs.

- App-root trees may live for the application lifetime.
- Component, route, SSR-request, test, and temporary trees have bounded owners.
- `defineStore` binds destruction to Angular `DestroyRef`.
- Directly constructed trees must be destroyed by their owner.

```typescript
const tree = signalTree({ value: 1 });
try {
  tree.$.value.set(2);
} finally {
  tree.destroy();
}
```

## Do Not Generate

- Historical `@signaltree/*` package names.
- `.with()`, fluent `.derived()`, `derivedFrom`, or a separate `.state` facade.
- Async, status, persistence, serialization, storage, forms, or custom marker
  capabilities that are not in current package types.
- `tree.update`, `tree.unwrap`, `tree.effect`, or `tree.subscribe`.
- One-argument `entityMap.updateOne(entity)`; use `updateOne(id, changes)`.
- Callable writes on Angular leaves; use `.set()` or `.update()`.
- Bare callable state at construction; declare it with `leaf(callable)`.
- Multiple trees without distinct state authority and lifetime ownership.

## Historical Note

SignalTree releases before v15 used different scopes and several APIs that no
longer exist. Migration records may name them as evidence. They are not current
fallbacks and should not be copied into generated code.

## Further Reading

- [Application architecture](../architecture/signaltree-architecture-guide.md#recommended-architecture-tldr)
- [NgRx SignalStore comparison](../compare/ngrx-signalstore.md)
- [Myths and misconceptions](../myths-and-misconceptions.md)
- [Kernel README](../../packages/kernel/README.md)
