# Enhancer System — Overview

This document describes the enhancer system in `@signal-tree/kernel`.
Enhancers are built-in, tree-shakable extensions that augment a `SignalTree`.
They are declared when the tree is constructed:

```ts
const tree = signalTree(state, { enhancers: [batching(), restoration()] });
```

`tree.with(...)` was removed in 15.0 — see the tombstone on `ISignalTree` in
`lib/types.ts` for why a chain made the build plan unknowable.

All enhancers are exported from `@signal-tree/kernel` — no separate packages needed.

## Public capability selection

Declare the built-in factories `batching()`, `restoration()`, `transactions()`,
and `devTools()` in the initial `enhancers` array. The low-level `Enhancer` type
remains public, but `createEnhancer`, `ENHANCER_META`, and metadata-authoring
helpers are not public APIs. Do not import them from internal paths.

The planner validates the declared set before constructing state. Built-in
metadata is an implementation detail; applications select capabilities through
the factories rather than authoring `requires`/`provides` metadata.

## Examples

All enhancers are imported from `@signal-tree/kernel`:

### Declare the enhancer set:

```typescript
import { signalTree, batching, devTools } from '@signal-tree/kernel';

const tree = signalTree({ count: 0 }, { enhancers: [batching(), devTools()] });
```

The enhancers are CALLED — `batching` is a factory that takes config and returns
the enhancer. Every enhancer's methods accumulate onto the constructed tree's
type, so they stay statically available on `tree`.

The whole set is known before any state is materialized, which is the point of
declaring it here rather than chaining: the planner validates all `requires`
against all `provides` at once, so declaration order does not decide whether a
dependency can be satisfied.

> `tree.with(...)` and `composeEnhancers(...)` were both removed in 15.0.
> `composeEnhancers` used one `T` for both its parameter and its return, leaving
> nowhere to carry what an enhancer ADDS, so a composed chain silently lost every
> method it applied. `.with()` carried the types correctly but applied enhancers
> to a tree that was already live, which made the build plan unknowable. The
> `enhancers` array replaces both.

### Add undo over designated work:

```typescript
import { signalTree, batching, restoration, undoable } from '@signal-tree/kernel';

const tree = signalTree({ count: 0 }, { enhancers: [batching(), restoration()] });

undoable(() => tree.$.count(1));
```

Undo covers only the operations you mark with `undoable()`, and requires
`restoration()` to be declared. Preset factories (`createDevTree`,
`TREE_PRESETS`) were removed in 9.0.1; declare the enhancers you want instead.

## Best practices

- Declare the complete capability set at construction.
- Use the framework facade for application imports, or `@signal-tree/kernel`
  for framework-neutral code; no separate capability packages are needed.
- Designate undoable work explicitly and read the
  [current v15 limitations](../../docs/guides/transaction-failures-v15.md) before
  combining transactions, restoration, or notification batching.
