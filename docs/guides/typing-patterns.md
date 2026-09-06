## Preferred SignalTree Typing Pattern

This page documents the preferred pattern for typing initialized SignalTree state so TypeScript inference preserves literal union types, array element types, and keeps enhancer signatures happy.

### ✅ PREFERRED: Type the initialized object, let inference handle the rest

```typescript
import { signalTree } from '@signal-tree/angular';

type Themes = 'light' | 'dark' | 'system';

// Assert the type on the specific values in the initial state; inference
// propagates the rest of the tree's typing from there.
const store = signalTree({
  user: {
    name: '',
    email: '',
    theme: 'system' as Themes,
  },
  preferences: {
    density: 'comfortable' as 'comfortable' | 'compact',
    pinned: [] as string[],
  },
});
```

### Single Source of Truth for Initial Value AND Type

**Define what a field starts as AND what it can become in one place.**

```typescript
// ✅ PREFERRED: Initial value + type in one place
const tree = signalTree({
  name: 'John' as string, // Starts as 'John', can be any string
  theme: 'dark' as Theme, // Starts as 'dark', can be any Theme
  count: 0 as number, // Starts as 0, can be any number
  items: [] as Item[], // Starts empty, can hold Items
});
```

```typescript
// ❌ AVOID: Type in one place, value in another
interface State {
  name: string; // Type here...
  theme: Theme;
  count: number;
  items: Item[];
}

const tree = signalTree<State>({
  name: 'John', // ...value here (now you have two places to maintain)
  theme: 'dark',
  count: 0,
  items: [],
});
```

### Why?

1. **Single source of debugging** - When a type error occurs, look at the field definition. The fix is right there.

2. **Co-located intent** - You immediately see "this starts as X and can become Y" without jumping between files/locations.

3. **Let inference work for you** - TypeScript propagates the type through the entire tree automatically. You only annotate at the leaves.

4. **Reduced maintenance** - Change the type in one place, not two. No interface to keep in sync.

### Terminal values vs nested nodes

A plain object initializer becomes a **nested node** whose fields are individual
locations:

```typescript
const tree = signalTree({
  firmware: { version: '1.0', channel: 'stable' },
});

tree.$.firmware.version();
tree.$.firmware({ version: '1.1', channel: 'stable' });
```

When an object is one atomic value rather than traversable topology, declare that
fact with `leaf(value)`:

```typescript
import { leaf, signalTree } from '@signal-tree/angular';

const tree = signalTree({
  firmware: leaf<FirmwareDto>({ version: '1.0', channel: 'stable' }),
});

tree.$.firmware.set(dto);
tree.$.firmware.update((firmware) => ({ ...firmware, version: '1.1' }));
```

Callable values always use `leaf()` because an unwrapped function argument is the
updater grammar:

```typescript
const tree = signalTree({
  onSave: leaf((id: string) => console.log(id)),
});

tree.$.onSave(leaf((id) => persist(id)));
tree.$.onSave()('ticket-42');
```

Pick topology deliberately:

| Intent                                           | Initialize as                  | Result             |
| ------------------------------------------------ | ------------------------------ | ------------------ |
| Per-field reactivity (`tree.$.settings.theme()`) | `{ theme: 'dark', ... }`       | Traversable branch |
| Replace one object atomically                    | `leaf({ theme: 'dark', ... })` | Terminal location  |
| Store a function or constructor                  | `leaf(callable)`               | Terminal location  |

The wrapper is consumed at construction or invocation. The raw value, not the
wrapper, appears in reads, snapshots, persistence, restoration, and links. See
[Myth 19](../myths-and-misconceptions.md#myth-19-any-object-i-put-in-the-initial-state-becomes-one-settable-value)
for the longer discussion.
