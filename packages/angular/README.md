# `@signal-tree/angular`

Angular-native SignalTree realization. State, identity, entity behavior, and
causal semantics remain in `@signal-tree/kernel`; terminal leaves are native
Angular signals and work directly in templates and `computed()`.

## Semantic Guidance

The canonical v15 model and composition guidance ships with this package as
[llms.txt](llms.txt). It explains the Angular facade rule, `link()`
relationships, persistence composition, and causal explanations as projections
rather than retained kernel facts.

## Install

```bash
npm install @signal-tree/angular
```

`@signal-tree/angular` installs `@signal-tree/kernel` as an exact dependency.
Angular itself remains a peer dependency supplied by the application. This is
the complete SignalTree facade for Angular applications: import `signalTree`,
markers, enhancers, and types from this package rather than mixing kernel
imports into Angular application code.

Angular applications should construct state through this package, not through
the neutral kernel package:

```ts
import { asReadonly, batching, entityMap, signalTree } from '@signal-tree/angular';

type User = { id: number; name: string };

const tree = signalTree(
  {
    users: entityMap<User, number>({ selectId: (user) => user.id }),
    selectedId: null as number | null,
  },
  {
    enhancers: [batching()],
    derived: ($) => {
      const selected = () => {
        const id = $.selectedId();
        return id === null ? null : $.users.byId(id)?.() ?? null;
      };
      return {
        selected,
        selectedName: () => selected()?.name ?? 'None',
      };
    },
  }
);

const reader = asReadonly(tree);
reader.$.selectedName();
```

There is one construction grammar: state, enhancers, and one derived factory are
declared together in `signalTree(...)`. Derived values are zero-argument recipes
that SignalTree memoizes as native readonly Angular signals.

Use `defineStore` for Angular dependency injection. State leaves already have
native Angular signal identity and methods:

```ts
tree.$.selectedId.set(42);
tree.$.selectedId.update((id) => (id ?? 0) + 1);
```

`toWritableSignal()` remains useful for adapting a callable root or object
branch to APIs such as Signal Forms. Passing an ordinary leaf without options
returns that same `WritableSignal`; `{ undoable: true }` creates a distinct
ingress that designates writes for restoration:

```ts
const profileModel = toWritableSignal(tree.$.profile, injector, {
  undoable: true,
});
```

Application components
should normally receive a read-only `$` plus explicit operation services for
writes and asynchronous work.

## Initial values and external reactivity

Pass initial values to `signalTree()`, not existing Angular signals. Direct
signals (including readonly and computed signals) at the root or a nested branch
are rejected with a path-specific error, and known signal types are rejected by
TypeScript. SignalTree creates its own native signals so it owns their writes.

```ts
import { signal, untracked } from '@angular/core';
import { leaf, signalTree } from '@signal-tree/angular';

const existing = signal(1);
const tree = signalTree({ count: leaf(untracked(existing)) });
```

This takes an independent snapshot; later writes to `existing` do not update
`tree`. For an object snapshot, copy the value too if you need independent object
identity. `leaf(existing)` explicitly stores the signal itself as data. Reading
that leaf returns the original signal; its inner writes remain outside tree
transactions and restoration.

Validation stops at explicit `leaf(...)`, marker definitions, arrays and built-in
terminal values. Their contents remain data, not separately owned tree locations.
Ordinary functions remain valid callable data. These checks apply to initial
construction, not arbitrary later writes or foreign reactivity from other libraries.
