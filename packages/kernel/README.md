# `@signal-tree/kernel`

Framework-neutral SignalTree state, EntityMap, causal turns, links,
restoration, transactions, batching, and DevTools.

Angular applications should construct trees through `@signal-tree/angular`
(requires Angular 20, 21, or 22 — see `peerDependencies` in
[`packages/angular/package.json`](../angular/package.json)).
React applications should construct and observe trees through
`@signal-tree/react`. Use the kernel directly for framework-neutral runtimes,
libraries, and tests. Framework packages forward this neutral surface by
identity, so an application should use its framework package as its one
SignalTree import root.

## Semantic Guidance

The canonical v15 model and composition guidance ships with this package as
[llms.txt](llms.txt). It explains the facade rule, `link()` relationships,
persistence composition, and why human-readable causal explanations are
projections rather than retained kernel facts.

## Install

```bash
npm install @signal-tree/kernel
```

## Create A Tree

```typescript
import { signalTree } from '@signal-tree/kernel';

const tree = signalTree({
  count: 0,
  user: {
    name: 'Ada',
    active: true,
  },
});
```

`$` is the state facade. Root and branch locations support whole-value reads,
assignments, and updater functions. A value call is never a patch; derive a
patched value with an updater. Leaves are reactive cells with signal-like read,
`set`, and `update` operations.

```typescript
tree.$();
tree.$.user();
tree.$.user({ name: 'Grace', active: true });
tree.$.user((user) => ({ ...user, active: false }));

tree.$.count();
tree.$.count.set(1);
tree.$.count.update((count) => count + 1);
```

The state literal defines the public paths. There are no actions, reducers, or
selectors required for ordinary reads and writes.

## Construction

State, capabilities, and derived values are declared in one construction call:

```typescript
const tree = signalTree(initialState, {
  enhancers: [batching(), restoration(), devTools()],
  derived: ($) => ({
    // Return realization-native computed values here.
  }),
});
```

There is no late `.with()` phase or fluent `.derived()` chain. SignalTree
validates the complete enhancer set before construction and resolves declared
capability requirements from that set.

The neutral kernel does not own framework lifecycle, rendering, dependency
injection, or effect scheduling. Framework packages provide those realizations.

## EntityMap

`entityMap()` creates a normalized collection at any state path.

```typescript
import { entityMap, signalTree } from '@signal-tree/kernel';

type Product = {
  id: number;
  name: string;
  inStock: boolean;
};

const tree = signalTree({
  catalog: {
    products: entityMap<Product, number>({
      selectId: (product) => product.id,
    }),
  },
});

const products = tree.$.catalog.products;

products.addMany([
  { id: 1, name: 'Laptop', inStock: true },
  { id: 2, name: 'Chair', inStock: false },
]);

products.all();
products.ids();
products.count();
products.empty();
products.asMap();
products.has(1)();
products.where((product) => product.inStock)();
products.find((product) => product.name === 'Laptop')();

products.byId(1)?.();
products.byIdOrFail(1)();
products.updateOne(1, { inStock: false });
products.replaceOne(1, { id: 1, name: 'Laptop', inStock: true });
products.upsertOne({ id: 3, name: 'Desk', inStock: true });
products.removeOne(2);
```

EntityMap preserves collection order and stable entity handles across ordinary
updates. `changeId(from, to)` adopts a new key without remove-and-add identity
loss. Keep each entity fact under one EntityMap authority and derive selections
rather than duplicating entity objects elsewhere.

## Read-Only Views

`asReadonly(tree)` narrows the same runtime object to a read-only type. It does
not allocate a second store or create a runtime security boundary.

```typescript
import { asReadonly } from '@signal-tree/kernel';

const reader = asReadonly(tree);
reader.$.count();
reader.$.catalog.products.byId(1)?.();
```

Leaf setters and EntityMap mutation methods are absent from the read-only type.
Use this for consumers that should receive reads while an application-owned Ops
service retains the writable tree.

## Built-In Enhancers

### `batching()`

Coalesces notifications for grouped writes and adds the batching capability.

```typescript
const tree = signalTree(state, {
  enhancers: [batching()],
});
```

### `restoration()`

Retains designated causal turns for undo and redo.

```typescript
import { restoration, signalTree, undoable } from '@signal-tree/kernel';

const tree = signalTree(
  { count: 0 },
  {
    enhancers: [restoration({ maxHistorySize: 50 })],
  }
);

undoable(() => tree.$.count.set(1));
tree.undo();
tree.redo();
```

`undoable()` designates the current synchronous authored turn. It is not an async
scope and does not create a separate state authority.

### `transactions()`

Adds an explicit pending operation that can be confirmed or rolled back. Use it
for pending authority, not as a synonym for retained undo history.

### `devTools()`

Connects the tree to Redux DevTools and adds the typed debug-session surface.

```typescript
const tree = signalTree(state, {
  enhancers: [devTools({ name: 'Application' })],
});

const session = tree.exportDebugSession();
```

## External Truth

`external()` classifies synchronous writes whose authoritative decision came
from outside the current authored operation. Restoration observes those writes
but does not claim them as undoable authored work.

```typescript
import { external } from '@signal-tree/kernel';

const rows = await api.list();
external(() => tree.$.rows.setAll(rows));
```

Acquire data first. Passing an async callback to `external()` is invalid because
the classification scope ends when the callback returns.

## Links

`link()` expresses a live relationship between state locations while preserving
the kernel's authority and causal-turn semantics. Use it for genuine ongoing
synchronization, not as a request wrapper or migration bridge.

## Errors

Observe library-reported diagnostics through `onTreeError()`:

```typescript
import { onTreeError } from '@signal-tree/kernel';

const stop = onTreeError((event) => {
  console.error(event.operation, event.treeId, event.path, event.error);
});

stop();
```

Applications observe errors; reporting remains owned by the library.

## Persistence, Async Work, And Forms

SignalTree 15 does not publish persistence, serialization, async-request, or
forms capabilities. Applications own storage formats, migrations, fetching,
cancellation, retries, validation, and form control behavior.

Write resolved external data through ordinary paths or EntityMap, using
`external()` when restoration must not claim the write. Use framework effects or
application services for storage synchronization.

## Lifetime

A tree owns runtime resources until `destroy()` releases them.

```typescript
const tree = signalTree({ value: 1 });

try {
  tree.$.value.set(2);
} finally {
  tree.destroy();
}
```

Application-root stores may live for the process lifetime. Component, route,
SSR-request, test, and temporary-workflow trees have bounded owners and must be
destroyed at that boundary. Dropping the last local reference is not prompt
resource reclamation.

Angular's `defineStore` binds tree destruction to `DestroyRef`. Direct kernel
construction remains the caller's responsibility.

Failed pending-transaction rollback throws `SignalTreeRollbackError`, whose
stable `code` and structured `cause` distinguish refusal from application
errors.

## Exports

The package publishes two code entry points:

- `@signal-tree/kernel`
- `@signal-tree/kernel/adapter`

The adapter entry point is the framework-neutral observation SDK. It is not a
compatibility layer or an application convenience surface.

- `createSignalTreeFactory(observation)` binds framework observation to tree
  construction.
- `observeOwnerInvalidation(owner, callback)` wakes a framework observer so it
  can reread canonical truth.
- `readCanonicalSnapshot(owner)` reads the owner-qualified whole-tree snapshot.
- `withRestorationDesignation(callback)` identifies framework-originated user
  writes that are eligible for restoration.

An `ObservationAdapter` supplies dependency tokens and
`runInvalidationGroup(run)` so transactions and restoration can apply all
changes before framework observers are notified. It never owns or mirrors
location state.

## License

Apache-2.0. See [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE).
