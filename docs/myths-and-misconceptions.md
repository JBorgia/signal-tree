# SignalTree Myths And Misconceptions

This catalog corrects recurring claims about the SignalTree 15 public surface.
Current package manifests, emitted types, and executable gates are authoritative.
Older documentation and package names are historical evidence, not fallback API.

## Myth 1: Derived State Requires A Separate Layer

**Claim:** Derived values must live in a separate store or selector service.

**Correction:** SignalTree accepts one `derived` factory in its construction
config and deep-merges the returned computed signals into `$`.

```typescript
import { computed } from '@angular/core';
import { signalTree } from '@signal-tree/angular';

const tree = signalTree(
  { firstName: 'Ada', lastName: 'Lovelace' },
  {
    derived: ($) => ({
      fullName: computed(() => `${$.firstName()} ${$.lastName()}`),
    }),
  }
);

tree.$.fullName();
```

There is no fluent `.derived()` chain or `derivedFrom` helper in v15. External
factories can type their `$` parameter with the exported `TreeNode<T>` type.

## Myth 2: Enhancers Can Be Added Later

**Claim:** Construct a tree and add capabilities through `.with(...)` later.

**Correction:** The complete enhancer set is declared in the initial
`signalTree(...)` call. SignalTree validates and orders that set before
construction.

```typescript
const tree = signalTree(state, {
  enhancers: [batching(), restoration(), devTools()],
});
```

There is no second construction phase and no late enhancement API.

## Myth 3: Angular Applications Should Import The Kernel

**Claim:** Angular applications should construct trees from
`@signal-tree/kernel` because it contains the core API.

**Correction:** Construct Angular trees through `@signal-tree/angular`. It
realizes kernel semantics with native Angular signals and owns Angular DI and
lifecycle integration. Use the kernel directly for framework-neutral runtimes.

```typescript
import { defineStore, signalTree } from '@signal-tree/angular';

export const CounterTree = defineStore(() => signalTree({ count: 0 }), { providedIn: 'root' });
```

## Myth 4: EntityMap Must Live At The Root

**Claim:** A normalized collection must be a top-level store feature.

**Correction:** `entityMap()` is a state marker and may appear at any object
path in the initial state.

```typescript
const tree = signalTree({
  organization: {
    selectedTeam: {
      members: entityMap<User, number>({ selectId: (user) => user.id }),
    },
  },
});
```

The marker materializes at that exact path. Keep each entity fact under one
EntityMap authority and derive selections by ID.

## Myth 5: SignalTree Ships Async Request State

**Claim:** SignalTree has a loader, query marker, or `rxMethod` equivalent that
owns fetching, cancellation, and status.

**Correction:** SignalTree 15 leaves request orchestration to application
services, RxJS, or framework primitives. Resolved data is written into ordinary
state or EntityMap.

Use `external()` when a synchronous write represents external truth and must not
be claimed by restoration history:

```typescript
const users = await api.list();
external(() => tree.$.users.setAll(users));
```

Acquire first. An async callback passed to `external()` is invalid because the
classification scope is synchronous.

## Myth 6: SignalTree Owns Persistence And Serialization

**Claim:** Add a persistence enhancer or import a storage package.

**Correction:** SignalTree 15 publishes neither persistence nor serialization
capabilities. The application owns storage format, migrations, hydration,
errors, and durability policy.

```typescript
const saved = localStorage.getItem('settings');
if (saved) tree.$.settings(JSON.parse(saved));

effect(() => {
  localStorage.setItem('settings', JSON.stringify(tree.$.settings()));
});
```

SSR follows the same boundary: validate an application-defined payload and
construct the tree from it.

## Myth 7: SignalTree Includes A Forms Package

**Claim:** A SignalTree form marker or companion package owns Angular forms.

**Correction:** SignalTree 15 has no forms package or form marker. Use Angular
forms for control, validation, and submission behavior, or keep a bounded draft
as ordinary application state.

`restoration()` is appropriate only when undo/redo history is a product
requirement. It is not a general form-state dependency.

## Myth 8: Every `$` Location Has The Same Call Syntax

**Claim:** Every location is callable for both reads and writes.

**Correction:** Root and branch locations are SignalTree accessors. They support
whole-value reads, assignments, and updater functions. A value call is never a
patch; derive a patched value through the updater form. Leaves remain native
framework signals: call to read, use `.set()` or `.update()` to write.

```typescript
tree.$.user();
tree.$.user({ name: 'Grace', active: true });
tree.$.user.name();
tree.$.user.name.set('Grace');
```

The old callable-leaf write transform was removed because the apparent write
could type-check while doing nothing at runtime.

## Myth 9: SignalTree Has A Separate `.state` Property

**Claim:** Read state from `tree.state` and methods from `tree.$`.

**Correction:** `$` is the state facade. It preserves the same domain paths for
reads, writes, EntityMap operations, and derived values.

```typescript
tree.$();
tree.$.user.name();
tree.$.users.byId(42)?.();
```

## Myth 10: SignalTree Prevents Component Mutation By Default

**Claim:** Injecting a tree always exposes read-only state.

**Correction:** A normal tree is writable. Use `asReadonly(tree)` or
`defineStore(factory, { expose: 'readonly' })` when consumers should receive a
read-only facade. Put domain writes in explicit Ops services.

NgRx SignalStore protects consumer state by default; that is a genuine
difference, not a SignalTree feature under another name.

## Myth 11: Restoration Is Optimistic Request Rollback

**Claim:** Undoing history is equivalent to rolling back a pending server
operation.

**Correction:** `restoration()` navigates retained, designated causal turns.
`transactions()` owns explicit pending work that can be confirmed or rolled
back. These are different authority models.

External server truth should enter through `external()` so undo does not claim
ownership over it.

## Myth 12: Dropping A Tree Reference Releases Its Resources Promptly

**Claim:** Garbage collection is enough for every tree lifetime.

**Correction:** A tree owns runtime resources until `destroy()` releases them.
Application-root stores may live for the process lifetime. Component, route,
SSR-request, test, and temporary-workflow stores must be destroyed at their
ownership boundary.

`defineStore` binds destruction to Angular `DestroyRef`. Directly constructed
trees remain the caller's responsibility.

## Myth 13: More Packages From Older Releases Are Still Available

**Claim:** Historical names such as core, events, guardrails, ng-forms, storage,
or time-travel can still be installed or imported for missing capabilities.

**Correction:** SignalTree 15 has three public packages:

- `@signal-tree/kernel`
- `@signal-tree/angular`
- `@signal-tree/react`

Use package manifests and emitted types as the source of truth. A retired name
in migration history does not imply a compatibility package.

## Myth 14: A Neutral Name Proves Kernel Ownership

**Claim:** A framework integration belongs in the kernel if its interface has no
framework name.

**Correction:** Ownership follows the semantic question. Framework lifecycle,
diagnostics, scheduler, rendering, dependency injection, and primitive identity
belong to the framework realization. The kernel owns only behavior SignalTree
requires regardless of framework.

A proposed adapter port should be implementable naturally by Angular, React,
Solid, Vue, Svelte, or a tiny fake without pretending to satisfy one framework's
lifecycle.

## Further Reading

- [Application architecture](architecture/signaltree-architecture-guide.md)
- [NgRx SignalStore comparison](compare/ngrx-signalstore.md)
- [Repository authority map](repository-map.md)
