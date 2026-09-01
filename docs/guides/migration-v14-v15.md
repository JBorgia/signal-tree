# Migration: `@signaltree/*` → `@signal-tree/*` (v15)

> **SignalTree** — Reactive JSON for Angular. JSON branches, reactive leaves.

**If you are on any `@signaltree/*` package, this is the migration you need.**
`@signaltree/*` (no hyphen) is the pre-15 line. SignalTree 15 ships under the
scoped, hyphenated `@signal-tree/*` name, and the multi-package surface is
consolidated into three packages.

15.0 is also an API-reduction release: every API change below removes something
that was either a duplicate of an existing path or a type that described a
grammar the runtime did not have.

Every code sample in this guide is compiled against the shipped types before
publication. If one does not compile for you, that is a bug — please report it.

---

## 0. Package rename and consolidation

### The name changed: `@signaltree/*` → `@signal-tree/*`

Every import specifier changes. There is no dist-tag or alias bridging the two
names — `@signaltree/*` stops at 14.1.1.

### Three packages, not eight

| v14 package (`@signaltree/*`)                     | v15                                                              |
| ------------------------------------------------- | --------------------------------------------------------------- |
| `@signaltree/core`                               | **`@signal-tree/kernel`** — framework-neutral tree, EntityMap, causal turns, links, `restoration()`, `transactions()`, `batching()`, `devTools()` |
| `@signaltree/angular`                            | **`@signal-tree/angular`** — the Angular realization; **Angular apps import `signalTree` from here**, not the kernel (kernel leaves are neutral cells: `isSignal()` is `false`, so `toObservable`/`model()`/`input()` reject them) |
| _(new)_                                          | **`@signal-tree/react`** — owner-bound React observation (`useSignalTree`) |
| `@signaltree/ng-forms`                           | **Removed.** SignalTree 15 does not publish a forms capability. Own form-control wiring and validation in the application. |
| `@signaltree/schema`                             | **Removed.** No published validation capability; validate in application code. |
| `@signaltree/events`                             | **Removed.** No published event-bus capability. |
| `@signaltree/realtime`                           | **Removed.** No published transport/realtime capability; own the socket and write resolved values through ordinary paths or `entityMap`, wrapping external-origin writes in `external()`. |
| `@signaltree/guardrails`                         | **Folded into the kernel.** Dev-mode misuse warnings ship in `@signal-tree/kernel` with stable `[ST####]` codes; there is nothing to install. |
| `@signaltree/shared`                             | **Internal.** Not a published package. |

Older standalone names retired before 14 (`@signaltree/batching`,
`/devtools`, `/entities`, `/memoization`, `/presets`, `/time-travel`,
`/middleware`, `/serialization`, `/callable-syntax`, `/enterprise`, `/async`,
`/ai`) have no v15 successor package — their surviving capabilities are
functions on `@signal-tree/kernel` (`batching()`, `devTools()`, `entityMap()`,
`restoration()`), and the rest were deleted. See §"Also removed" below.

### Steps

```bash
# 1. remove the old scope
npm uninstall @signaltree/core @signaltree/angular @signaltree/ng-forms \
              @signaltree/schema @signaltree/events @signaltree/realtime \
              @signaltree/guardrails @signaltree/shared

# 2. install the new one (Angular app)
npm install @signal-tree/angular
#   framework-neutral / library / test code: npm install @signal-tree/kernel
#   React app:                                 npm install @signal-tree/react
```

```ts
// before
import { signalTree, entityMap } from '@signaltree/core';
import { SignalTree } from '@signaltree/angular';

// after — Angular app
import { signalTree, entityMap, type SignalTree } from '@signal-tree/angular';

// after — framework-neutral code
import { signalTree, entityMap, type SignalTree } from '@signal-tree/kernel';
```

A repo-wide specifier rewrite (`@signaltree/core` → `@signal-tree/angular` in
Angular code, `@signaltree/angular` → `@signal-tree/angular`) covers most of a
codebase. What it will _not_ fix — the `.with()` chain, root-state access,
positional `derived`, and the removed markers — is the rest of this guide.

### Capabilities with no v15 package

`ng-forms`, `schema`, `events`, `realtime`, persistence (`stored()`), the
`asyncSource`/`asyncQuery` markers, and security are gone with no replacement
export. SignalTree 15 owns state, identity, causal turns, links, restoration,
transactions, batching, and DevTools; storage formats, migrations, fetching,
cancellation, retries, validation, form-control behavior, and event routing are
application concerns. Keep local loading flags as ordinary state, run RxJS
pipelines in an `@Injectable` Ops service, and land results with `external()`.

---

## API changes at a glance

| Removed                                             | Replacement                                 |
| --------------------------------------------------- | ------------------------------------------- |
| `@signaltree/*` imports                             | `@signal-tree/*` (see §0)                   |
| `SignalTreeBase<T>`                                 | `SignalTree<T>`                             |
| root state properties on the tree (`tree.count`)    | `tree.$.count()`                            |
| `tree.with(a)` / `.with(a).with(b)`                 | `signalTree(state, { enhancers: [a, b] })`  |
| `composeEnhancers(a, b)`                            | `signalTree(state, { enhancers: [a, b] })`  |
| `signalTree(state, derivedFn)` / `tree.derived(fn)` | `signalTree(state, { derived: derivedFn })` |
| `stored()`, `asyncSource()`, `asyncQuery()`, `form()`, `status()` markers | app-owned state + Ops service; `external()` to land results |

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
the tree is a non-callable controller.

```ts
// 14.x retired syntax
tree();
tree({ count: 1 });
tree((current) => ({ ...current, count: 2 }));

// 15.0
tree.$();
tree.$({ count: 1 });
tree.$((current) => ({ ...current, count: 2 }));
```

### Annotating a tree

`SignalTree<T>` is the canonical type to annotate with, and as of 15.0 the
constructor's return satisfies it:

```ts
import { signalTree, type SignalTree } from '@signal-tree/kernel';

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
const tree = signalTree({ count: 0 }).with(restoration()).with(batching());

// after
const tree = signalTree({ count: 0 }, { enhancers: [restoration(), batching()] });
```

`composeEnhancers(a, b)` is removed in the same change, and has the same
replacement — put `a` and `b` in the array.

Built-in enhancers are **factories**; call them:

```ts
import { signalTree, batching, devTools } from '@signal-tree/kernel';

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
const tree = signalTree({ count: 0 }, { enhancers: [restoration(), batching()] });
tree.canUndo(); // ✅ from the first
tree.batch(() => {}); // ✅ from the second
```

### Conditional enhancers

Build the array, not the tree:

```ts
// before
const tree = isProd ? base : base.with(restoration());

// after
const tree = signalTree(state, {
  enhancers: isProd ? [] : [restoration()],
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
  enhancers: [...standardEnhancers(), restoration()],
});
```

Do not annotate the array's type by hand — inference carries the tuple, and
widening it to `Enhancer<unknown>[]` is how the accumulated additions get lost.

### Derived state

Derived state is declared once with the rest of the construction plan. The
positional factory and fluent method are removed; dependencies among derived
values use ordinary local reactive composition:

```ts
const tree = signalTree(
  { first: 'Ada', last: 'Lovelace' },
  {
    enhancers: [restoration()],
    derived: ($) => {
      const full = computed(() => `${$.first()} ${$.last()}`);
      return { full, greeting: computed(() => `Hello ${full()}`) };
    },
  }
);
```

The configured factory applies lazily on first `$` access, after every enhancer.

---

## Also removed from the public surface

- `createEnhancer`
- `resolveEnhancerOrder`
- `ENHANCER_META`
- `TreeConfig.lazy`, `TreeConfig.useLazySignals`, `LazyFeature` and the
  `@signal-tree/kernel/lazy` subpath — with diagnostics ST1032 and ST1004. Nothing
  to migrate: the subpath had already been withdrawn from the published surface,
  so neither option could be satisfied and `useLazySignals: true` was a no-op.
  Incremental materialization gives large trees cheap reads on the default path.
- `ISignalTree.with()` and the public `SignalTreeBuilder` abstraction — see section 3
- positional `signalTree(state, derivedFactory)` and fluent `tree.derived()` — use `derived: factory`
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
[ ] move derived state into the constructor's singular `derived` factory
[ ] typecheck — every change above is compile-time visible
```
