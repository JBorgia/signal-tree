# AI Agent Template For SignalTree 15

Use this template in a project's agent instructions when the application uses
SignalTree 15. Keep the package types and package READMEs authoritative; this
text is a compact routing aid, not a replacement API specification.

There is intentionally no consumer-facing SignalTree skill in v15 yet. The old
skill taught deleted APIs and was removed pending the public-surface freeze. Do
not point agents at a historical skill path.

## Full Template

````markdown
# SignalTree 15

This Angular application uses `@signal-tree/angular`. Do not generate
`@ngrx/signals` or `@ngrx/store` code unless the task explicitly asks for it.

## Packages

- Construct Angular trees with `@signal-tree/angular`.
- Use `@signal-tree/kernel` only for framework-neutral runtimes and contracts.
- Use `@signal-tree/react` for React owner-bound observation.
- Do not invent packages or revive historical `@signaltree/*` names.

## Construction

There is one construction grammar. Declare initial state, all enhancers, and one
derived factory in the initial call:

```typescript
import { computed } from '@angular/core';
import { batching, defineStore, entityMap, leaf, signalTree } from '@signal-tree/angular';

export const AppTree = defineStore(
  () =>
    signalTree(
      {
        users: entityMap<User, number>({
          selectId: (user) => user.id,
        }),
        selectedId: null as number | null,
      },
      {
        enhancers: [batching()],
        derived: ($) => {
          const selected = computed(() => {
            const id = $.selectedId();
            return id === null ? null : $.users.byId(id)?.() ?? null;
          });
          return { selected };
        },
      }
    ),
  { providedIn: 'root' }
);
```

- Do not use `.with()` or fluent `.derived()` calls.
- Compose dependent zero-argument recipes through local variables in the one factory.
- An external derived factory can type `$` with `TreeNode<State>`.
- The `Enhancer` function type remains available for advanced composition, but
  no public helper, dependency-metadata, or custom-marker authoring SDK ships.

## State Access

`$` is the state facade.

- Read a leaf: `tree.$.user.name()`.
- Replace a leaf: `tree.$.user.name(value)`.
- Derive a leaf: `tree.$.user.name((current) => next)`.
- Read a branch: `tree.$.user()`.
- Replace a branch: `tree.$.user(value)`.
- Update a branch: `tree.$.user((current) => next)`.
- Read the full snapshot: `tree.$()`.
- There is no separate `.state` or `.unwrap()` accessor.

Root, branch, and terminal leaves are universal locations with the same callable
grammar. In Angular, direct reads participate in dependency tracking without
making the location an Angular `Signal`.

Use `leaf(value)` when a plain object should remain one atomic terminal instead
of becoming a branch. Callable data always needs the wrapper, including when it
is replaced, because a bare function argument means "derive":

```typescript
const tree = signalTree({
  bounds: leaf({ min: 0, max: 100 }),
  onSave: leaf((id: number) => console.log(id)),
});

tree.$.bounds({ min: 10, max: 90 });
tree.$.onSave(leaf((id) => persist(id)));
```

Use `toWritableSignal(location)` only at an Angular API boundary that requires
native `WritableSignal` identity; the returned view has `.set()` and `.update()`.

## EntityMap

Place `entityMap()` at any object path in initial state. Use its current method
signatures:

```typescript
tree.$.users.addOne(user);
tree.$.users.addMany(users);
tree.$.users.setAll(users);
tree.$.users.updateOne(id, changes);
tree.$.users.replaceOne(id, entity);
tree.$.users.removeOne(id);
tree.$.users.byId(id)?.();
tree.$.users.all();
tree.$.users.count();
```

Store selected IDs and derive selected entities. Do not duplicate collection
entities elsewhere in state.

## Application Architecture

Components should normally receive read-only `$` state plus explicit Ops
methods. Put domain writes and asynchronous orchestration in injectable Ops
services. Use `asReadonly(tree)` or
`defineStore(factory, { expose: 'readonly' })` for read-only consumers.

Network requests, retries, cancellation, persistence, routing, analytics, and
forms belong to application services or framework primitives. SignalTree 15 has
no async marker, persistence enhancer, serialization enhancer, storage package,
or forms package.

Use `external(() => synchronousWrite())` when a write represents external truth
and restoration must not claim it. Acquire asynchronous data before entering the
scope.

## Capabilities

Declare built-in capabilities in `enhancers`:

- `batching()` for grouped notification behavior.
- `restoration()` for retained undo/redo history.
- `transactions()` for pending confirm/rollback workflows.
- `devTools()` for Redux DevTools integration.

`undoable()` designates a synchronous authored turn for restoration. It is not
an async scope. Restoration and transactions are different authority models.

## Lifetime

A tree owns resources until `destroy()` runs. App-root stores may live for the
application lifetime. Component, route, SSR-request, test, and temporary trees
must be destroyed at their ownership boundary. `defineStore` binds this to
Angular `DestroyRef`.

## Source Of Truth

When uncertain, read the installed package declarations and READMEs. Do not use
historical migration documents as current API guidance.
````

## Compact Template

```markdown
This Angular app uses SignalTree 15 from `@signal-tree/angular`. State,
`enhancers`, and one `derived` factory are declared together in
`signalTree(...)`; there is no `.with()` or fluent `.derived()`. Read through
`tree.$`; every location accepts whole values or updater functions. Use
`leaf(value)` for atomic objects and callable data. Put writes and async orchestration in Ops
services; keep HTTP, persistence, forms, routing, and effects application-owned.
Use `entityMap()` for normalized collections, `external()` for synchronous
external-truth writes, `restoration()` + `undoable()` for retained undo history,
and `transactions()` for pending confirm/rollback. Prefer read-only component
access via `asReadonly` or read-only `defineStore`. Destroy every bounded-life
tree. Current package types and READMEs override historical documentation.
```

## Related Guidance

- [Application architecture](../architecture/signaltree-architecture-guide.md)
- [AI reference](LLM.md)
- [Myths and misconceptions](../myths-and-misconceptions.md)
