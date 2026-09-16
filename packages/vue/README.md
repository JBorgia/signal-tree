# `@signal-tree/vue`

Vue-native SignalTree realization. State remains owned by the framework-neutral
kernel; terminal leaves are Vue refs and derived values are computed refs.

## Install

```bash
npm install @signal-tree/vue
```

Vue 3.5 or newer is required as a peer dependency.

The canonical v15 model and composition guidance ships with this package as
[llms.txt](llms.txt).

## Use

```ts
import { signalTree } from '@signal-tree/vue';

const tree = signalTree(
  { profile: { name: 'Ada' } },
  {
    derived: ($) => ({
      greeting: () => `Hello, ${$.profile.name.value}`,
    }),
  }
);

tree.$.profile.name.value = 'Grace';
console.log(tree.$.greeting.value); // Hello, Grace
```

The ref can be passed directly to `watch()`, `computed()`, or `v-model`.
Object branches and the root `$` remain callable whole-value accessors. Vue owns
dependency tracking; the kernel remains the only state and write authority.

## Initial values and external reactivity

Pass plain initial values to `signalTree()`. Existing Vue refs, computed refs,
and reactive or readonly proxies at the root or a nested branch are rejected
with a path-specific error. Ref types are also rejected by TypeScript; proxies
require runtime checks because their types can look like ordinary objects.

```ts
import { ref } from 'vue';
import { leaf, signalTree } from '@signal-tree/vue';

const existing = ref(1);
const tree = signalTree({ count: leaf(existing.value) });
```

This takes an independent scalar snapshot. For objects, copy the needed values
into plain data; `toRaw()` alone shares the underlying object and is not an
independent copy. `leaf(existing)` explicitly stores a ref or proxy as data.
Its inner mutations remain outside tree transactions and restoration.

Validation stops at explicit `leaf(...)`, marker definitions, arrays and built-in
terminal values. Their contents remain data, not separately owned tree locations.
Ordinary functions remain valid callable data. These checks apply to initial
construction, not arbitrary later writes or foreign reactivity from other libraries.
