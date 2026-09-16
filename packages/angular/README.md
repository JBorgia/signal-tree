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

## Application-store ownership

Use `defineStore(() => signalTree(...))` for an Angular-owned application store.
`signalTree` selects Angular reactivity and constructs the tree; `defineStore`
creates its injectable token and binds destruction to the providing injector.
The factory runs in injection context and must return a fresh owned object or
function, not a primitive or a tree borrowed from another owner. Cleanup errors
are reported with Angular's default `ErrorHandler` so later store cleanup can
still run. This does not resolve the application's custom handler: that handler
may itself depend on a store, and the owning injector is already destroyed when
teardown runs.

```ts
import { inject } from '@angular/core';
import { defineStore, signalTree } from '@signal-tree/angular';

export const SettingsStore = defineStore(() => signalTree({ theme: 'light' }), { providedIn: 'root' });

// In an Angular injection context:
const settings = inject(SettingsStore);
```

Omit `providedIn` and add the token to a component's `providers` for a separate
store per component. A consumer borrowing an injected store does not destroy
it. Do not wrap a borrowed tree in another `defineStore`: that registers a
second owner. Root/request injectors must themselves be destroyed by the
application or SSR host at the end of their lifetime.

### Readonly state and operations share one owner

`expose: 'readonly'` narrows the token for **all** consumers, including an Ops
service. It does not create a separate writable injection path. When components
need readonly state and operations need writes, keep the owner token internal
and expose its readonly `$` through a non-owning Angular provider:

```ts
import { inject, Injectable, InjectionToken, type Provider } from '@angular/core';
import { asReadonly, defineStore, signalTree } from '@signal-tree/angular';

const CounterTree = defineStore(() => signalTree({ count: 0 }));

@Injectable()
export class CounterOps {
  private readonly tree = inject(CounterTree);
  readonly state = asReadonly(this.tree).$;

  increment(): void {
    this.tree.$.count.update((count) => count + 1);
  }
}

export const COUNTER_STATE = new InjectionToken<CounterOps['state']>('CounterState');

export function provideCounterStore(): Provider[] {
  return [CounterTree, CounterOps, { provide: COUNTER_STATE, useFactory: () => inject(CounterOps).state }];
}
```

Register `provideCounterStore()` at application bootstrap for one application
owner, or in a component's `providers` for independent local owners. Register
Ops and the reader together with the tree at the intended scope. Components use
`inject(COUNTER_STATE).count()` and `inject(CounterOps).increment()`; only
`CounterTree` owns teardown. The reader exposes neither writers nor `destroy()`.
Readonly remains a compile-time boundary, not runtime access control.

For stores where every injected consumer should be readonly, the existing
`expose: 'readonly'` option is sufficient. Prefer an inferred config literal or
`{ expose: 'readonly' } satisfies DefineStoreConfig`; widening to
`DefineStoreConfig` erases the information required to choose the readonly
return type.

## Tree construction

Inside the store factory, declare state, enhancers, and derived recipes together.
The following standalone example uses explicit cleanup; this lower-level form
also serves tests and intentionally manual lifetimes:

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
tree.destroy(); // End the explicitly owned standalone example.
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
