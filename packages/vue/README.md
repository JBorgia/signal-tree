# `@signal-tree/vue`

Vue observation for SignalTree. State remains owned by the framework-neutral
kernel; this package lets Vue track direct dot-path reads.

## Install

```bash
npm install @signal-tree/vue
```

Vue 3.5 or newer is required as a peer dependency.

The canonical v15 model and composition guidance ships with this package as
[llms.txt](llms.txt).

## Use

```ts
import { computed } from 'vue';
import { signalTree } from '@signal-tree/vue';

const tree = signalTree({ profile: { name: 'Ada' } });
const name = computed(() => tree.$.profile.name());

tree.$.profile.name('Grace');
```

Locations are not Vue refs. For a Vue API such as `v-model` that requires a
writable ref, use Vue's native writable `computed`:

```ts
const nameModel = computed({
  get: () => tree.$.profile.name(),
  set: (value: string) => tree.$.profile.name(value),
});
```

This keeps one state authority and one write grammar while Vue owns only its
observation boundary.
