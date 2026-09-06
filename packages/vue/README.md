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
