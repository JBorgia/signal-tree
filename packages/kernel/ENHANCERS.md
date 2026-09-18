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

Key pieces

- `createEnhancer(meta, fn)` — helper that attaches metadata to an enhancer function.
- `ENHANCER_META` — symbol under which metadata is also attached for 3rd-party compatibility.
- `signalTree(state, { enhancers: [...] })` — apply 1..N enhancers to a tree;
  supports optional metadata-based re-ordering via `requires`/`provides`.

Metadata schema

- `name` (string) — optional but recommended: a stable name used for ordering/diagnostics.
- `requires` (string[]) — names of capabilities the enhancer needs present before it runs.
- `provides` (string[]) — names of capabilities the enhancer will add to the tree.

Behavior

- Enhancers may mutate the passed tree (preferred) or return a new object. If the enhancer
  returns the same instance, mutation is assumed. If it returns a new value, that value is used
  for subsequent enhancers.
- If any metadata `requires` are already available from core configuration (for example,
  microtask notification batching when `config.batchUpdates` is true), the sorter treats them
  as satisfied.
- A topological sort orders enhancers that declare metadata. On cycles the system falls back to
  the user-provided order and warns in debug mode.

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

- Prefer mutation (augment `tree` and return it). This preserves identity for consumers holding
  references to the original tree.
- Provide `name` and `provides` for any enhancer that adds public capabilities.
- Use `requires` for enhancers that depend on other features (core or other enhancers).
- All built-in enhancers are available from `@signal-tree/kernel` — no need for separate packages.
