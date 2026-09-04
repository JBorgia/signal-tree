# `@signal-tree/angular`

Angular observation for SignalTree. State, locations, entity behavior, and
causal semantics remain in `@signal-tree/kernel`; hidden Angular tokens make
direct location reads reactive in templates and `computed()`.

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
that SignalTree memoizes as universal readonly locations.

Use `defineStore` for Angular dependency injection and `toWritableSignal` when a
location must cross an Angular writable-signal boundary. Canonical writes stay
callable; the explicit view has native Angular methods:

```ts
tree.$.selectedId(42);

const selectedIdSignal = toWritableSignal(tree.$.selectedId);
selectedIdSignal.set(7);
selectedIdSignal.update((id) => id + 1);
```

Application components
should normally receive a read-only `$` plus explicit operation services for
writes and asynchronous work.
