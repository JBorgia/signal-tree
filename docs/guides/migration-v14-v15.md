# Migration: v14 → v15

> **SignalTree** — Reactive JSON for Angular. JSON branches, reactive leaves.

15.0 is an API-reduction release. Every change below removes something that was
either a duplicate of an existing path or a type that described an API grammar
the runtime did not have.

Every code sample in this guide is compiled against the shipped types before
publication. If one does not compile for you, that is a bug — please report it.

---

## At a glance

| Removed                                          | Replacement                                     |
| ------------------------------------------------ | ----------------------------------------------- |
| `SignalTreeBase<T>`                              | `SignalTree<T>`                                 |
| root state properties on the tree (`tree.count`) | `tree.$.count()`                                |
| `tree.with(a)` / `.with(a).with(b)`              | `signalTree(state, { enhancers: [a, b] })`      |
| `composeEnhancers(a, b)`                         | `signalTree(state, { enhancers: [a, b] })`      |
| `tree.derived(fn)` after construction            | `signalTree(state, { derived: fn })` (both work) |

---

## 1. `SignalTreeBase<T>` removed

Use `SignalTree<T>`. This is a rename and nothing else — the two were
character-identical (`ISignalTree<T> & TreeNode<T>`), so no behaviour or
inference changes.

```ts
// before
function inspect(tree: SignalTreeBase<AppState>) {}

// after
function inspect(tree: SignalTree<AppState>) {}
```

The name asserted a base/derived relationship with `SignalTree<T>` that did not
exist, so choosing one over the other communicated something untrue.

---

## 2. `SignalTree<T>` no longer types state on the tree root

**This is the change most likely to affect you, and the code it breaks never
worked at runtime.**

`SignalTree<T>` was `ISignalTree<T> & TreeNode<T>`, which typed the state keys on
the tree object itself. The runtime root has never carried them:

```ts
const tree = signalTree({ count: 0, user: { name: 'Ada' } });

Object.keys(tree); // []           <- no state keys, before or after 15.0
tree.$.count(); // 0
```

So `tree.count` typechecked as a writable signal and was `undefined` at runtime.
15.0 removes the false surface. State is addressed through `$`, and only through
`$`:

```ts
// before — compiled, then failed at runtime
tree.count();
tree.user.name();

// after — the grammar that always worked
tree.$.count();
tree.$.user.name();
tree.$.user(); // read the whole branch
```

If your code compiled _and_ ran on v14, it already used `$` and needs no change.

### Why not add the root properties to the runtime instead?

That would give two ways to address one node — `tree.count()` beside
`tree.$.count()` — and this API deliberately has one. `$` is the state accessor;
the tree callable is for whole-tree reads and writes:

```ts
tree(); // read the whole state
tree({ count: 1 }); // partial merge
tree((current) => ({ ...current, count: 2 })); // functional update
```

### Annotating a tree

`SignalTree<T>` is the canonical type to annotate with, and as of 15.0 the
constructor's return satisfies it:

```ts
import { signalTree, type SignalTree } from '@signaltree/core';

interface AppState {
  count: number;
  user: { name: string };
}

const tree: SignalTree<AppState> = signalTree<AppState>({
  count: 0,
  user: { name: 'Ada' },
});

function inspect(tree: SignalTree<AppState>) {
  return tree.$.count();
}
```

On v14 that annotation did **not** compile, because `SignalTreeBuilder.bind()`
was declared more loosely than the `NodeAccessor<T>` it actually returns. That is
fixed in 15.0.

---

## 3. `.with()` removed — enhancers are declared

**This is the largest change in 15.0.** There is no method that applies an
enhancer to a tree. The whole enhancer set is passed to `signalTree`:

```ts
// before
const tree = signalTree({ count: 0 }).with(timeTravel()).with(batching());

// after
const tree = signalTree(
  { count: 0 },
  { enhancers: [timeTravel(), batching()] }
);
```

`composeEnhancers(a, b)` is removed in the same change, and has the same
replacement — put `a` and `b` in the array.

Built-in enhancers are **factories**; call them:

```ts
import { signalTree, batching, devTools } from '@signaltree/core';

const tree = signalTree({ count: 0 }, { enhancers: [batching(), devTools()] });

tree.batch(() => {
  /* ... */
});
```

### Why the chain had to go

Not style. `.with()` had to materialize the tree's markers before applying each
enhancer, so the tree was already built by the time the first enhancer was seen.
Its BUILD PLAN — which capabilities to install, whether to allocate mutation
metadata, whether a physical commit clock is needed — was therefore fixed before
anything was known about what would be attached, so every tree got the maximal
plan and paid for machinery it would never use. Knowing the enhancer set up
front is what makes the plan truthful, and you cannot know a set that is still
being typed.

### What you get back

**Declaration order no longer matters.** `.with()` validated each call against
the enhancers applied so far, so listing a consumer before its provider was an
error even when the configuration was satisfiable. The whole set is known now:
requirements resolve against the union of everything declared, and the planner
runs providers first.

```ts
// legal in 15.0 — the planner orders these correctly
signalTree(state, { enhancers: [needsStorage(), providesStorage()] });
```

**Every configuration problem is reported at once**, before anything is built:

```text
SignalTree could not finalize the enhancer configuration:
  - "consumer" requires capability "storage", but no configured enhancer provides it.
  - enhancer "batching" is configured 2 times; each enhancer may appear once.
```

**Your types still accumulate.** The declared array is a tuple, and every
enhancer's additions are intersected into the result — the same guarantee
`.with()`'s `this & TAdded` gave, without the chain:

```ts
const tree = signalTree({ count: 0 }, { enhancers: [timeTravel(), batching()] });
tree.canUndo(); // ✅ from the first
tree.batch(() => {}); // ✅ from the second
```

### Conditional enhancers

Build the array, not the tree:

```ts
// before
const tree = isProd ? base : base.with(timeTravel());

// after
const tree = signalTree(state, {
  enhancers: isProd ? [] : [timeTravel()],
});
```

Note this is a real behaviour improvement, not just a rewrite: on v14 the
production tree still carried the maximal build plan, because `.with()` fixed
the plan before it knew nothing would be attached. In 15.0 it does not.

### Reusable bundles

If you had a shared enhancer bundle, return the ARRAY and spread it:

```ts
const standardEnhancers = () => [batching(), devTools()];

const tree = signalTree(state, {
  enhancers: [...standardEnhancers(), timeTravel()],
});
```

Do not annotate the array's type by hand — inference carries the tuple, and
widening it to `Enhancer<unknown>[]` is how the accumulated additions get lost.

### Derived state

`.derived()` still works after construction. It can also be declared alongside
the enhancers, which is the shape to prefer when you are already passing config:

```ts
const tree = signalTree(
  { first: 'Ada', last: 'Lovelace' },
  {
    enhancers: [timeTravel()],
    derived: ($) => ({ full: computed(() => `${$.first()} ${$.last()}`) }),
  }
);
```

Both forms apply the factory at the same point — lazily, on first `$` access,
after every enhancer.

---

## Also removed from the public surface

- `createEnhancer`
- `resolveEnhancerOrder`
- `ENHANCER_META`
- `TreeConfig.lazy`, `TreeConfig.useLazySignals`, `LazyFeature` and the
  `@signaltree/core/lazy` subpath — with diagnostics ST1032 and ST1004. Nothing
  to migrate: the subpath had already been withdrawn from the published surface,
  so neither option could be satisfied and `useLazySignals: true` was a no-op.
  Incremental materialization gives large trees cheap reads on the default path.
- `ISignalTree.with()` and `SignalTreeBuilder.with()` — see section 3
- `plannedSignalTree()` / `.build()` — the planned-construction prototype. Its
  behaviour is what `signalTree(state, { enhancers })` now does, so there is no
  second construction path to choose between.

---

## Checklist

```text
[ ] replace SignalTreeBase<T> with SignalTree<T>
[ ] route any tree.<key> state access through tree.$.<key>
[ ] replace tree.with(a).with(b) with signalTree(state, { enhancers: [a, b] })
[ ] replace composeEnhancers(a, b) the same way
[ ] rewrite conditional enhancement as a conditional ARRAY, not a conditional tree
[ ] make sure built-in enhancers are CALLED: [batching()], not [batching]
[ ] typecheck — every change above is compile-time visible
```
