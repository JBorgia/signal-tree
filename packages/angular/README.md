# @signal-tree/angular

Angular realization for SignalTree. It uses native Angular `Signal` and
`WritableSignal` carriers while keeping state, entity, and causal semantics in
`@signal-tree/kernel`.

## Install

```bash
npm install @signal-tree/angular
```

`@signal-tree/angular` installs `@signal-tree/kernel` as an exact dependency.
Angular itself remains a peer dependency supplied by the application.

Angular applications should construct state through this package, not through
the neutral kernel package:

```ts
import { computed } from '@angular/core';
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
      const selected = computed(() => {
        const id = $.selectedId();
        return id === null ? null : $.users.byId(id)?.() ?? null;
      });
      return {
        selected,
        selectedName: computed(() => selected()?.name ?? 'None'),
      };
    },
  }
);

const reader = asReadonly(tree);
reader.$.selectedName();
```

There is one construction grammar: state, enhancers, and one derived factory are
declared together in `signalTree(...)`. Derived values compose through ordinary
local `computed` references inside that factory.

Use `defineStore` for Angular dependency injection and `toWritableSignal` when a
branch must cross an Angular writable-signal boundary. Application components
should normally receive a read-only `$` plus explicit operation services for
writes and asynchronous work.
