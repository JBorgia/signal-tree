<div align="center">
  <img src="https://raw.githubusercontent.com/JBorgia/signal-tree/main/apps/demo/public/signaltree.svg" alt="SignalTree Logo" width="60" height="60" />
</div>

# SignalTree: Reactive JSON

**JSON branches, reactive leaves.**

> No actions. No reducers. No selectors.

## What is @signal-tree/kernel?

SignalTree treats application state as **reactive JSON** — a typed, dot-notation interface to plain JSON-like objects with fine-grained reactivity layered transparently on top.

Supports Angular 20, 21, or 22.

You don't model state as actions, reducers, selectors, or classes — you model it as **data**.

### Core Philosophy

| Principle                | What It Means                                                                |
| ------------------------ | ---------------------------------------------------------------------------- |
| **State is Data**        | Your state shape looks like JSON. No ceremony, no abstractions.              |
| **Dot-Notation Access**  | `tree.$.user.profile.name()` — fully type-safe, IDE-discoverable             |
| **Invisible Reactivity** | You think in data paths, not subscriptions. Reactivity emerges naturally.    |
| **Lazy by Design**       | Signals created only where accessed. Types do heavy lifting at compile time. |

### Technical Features

- Recursive typing with deep nesting and accurate type inference
- Fast operations with sub‑millisecond measurements at 5–20+ levels
- Strong TypeScript safety across nested structures
- Memory efficiency via incremental snapshot materialization
- Small API surface with minimal runtime overhead
- Compact bundle size suited for production

## Import guidance (tree-shaking)

Modern bundlers (webpack 5+, esbuild, Rollup, Vite) **automatically tree-shake barrel imports** from `@signal-tree/kernel`. Both import styles produce identical bundle sizes:

```ts
// ✅ Recommended: Simple and clean
import { signalTree, batching } from '@signal-tree/kernel';

// ⚠️ There is NO subpath form. `@signal-tree/kernel/enhancers/batching` was taught
// here and does not resolve — package.json exports only ".". Everything comes
// from the one entry point.
import { signalTree, batching } from '@signal-tree/kernel';
```

**Measured impact** (with modern bundlers). Reproduce current bundle ceilings with
`node tools/check-bundle-budget.mjs`:

- Core only: ~8.5 KB gzipped
- Core + batching: ~9.3 KB gzipped (barrel vs subpath: identical)
- Unused enhancers: **automatically excluded** by tree-shaking

### Marker Tree-Shaking (Self-Registering)

Built-in public markers such as `entityMap()` are **self-registering** - they only add their processor code when you actually use them:

```ts
// ✅ Only entityMap() code is bundled
import { signalTree, entityMap } from '@signal-tree/kernel';
const tree = signalTree({ users: entityMap<User, number>({ selectId: (user) => user.id }) });

// ✅ Minimal bundle - no marker code included
import { signalTree } from '@signal-tree/kernel';
const tree = signalTree({ count: 0 });
```

**How it works:**

- Each public marker factory registers its processor on first call
- If you never call a marker factory, its code is completely eliminated
- Zero import-time side effects - registration is lazy and automatic

**When to use subpath imports:**

- Older bundlers (webpack <5) with poor tree-shaking
- Explicit control over what gets included
- Personal/team preference for clarity

This repo's ESLint rule is **disabled by default** since testing confirms effective tree-shaking with barrel imports.

### Callable leaf signals (DX sugar only)

SignalTree provides TypeScript support for callable syntax on leaf signals as developer experience sugar:

```typescript
// TypeScript accepts this syntax (with proper tooling):
tree.$.name('Jane'); // Set value
tree.$.count((n) => n + 1); // Update with function

// At build time, transforms convert to:
tree.$.name.set('Jane'); // Direct Angular signal API
tree.$.count.update((n) => n + 1); // Direct Angular signal API

// Reading always works directly:
const name = tree.$.name(); // No transform needed
```

**Key Points:**

- **Branches are callable**: root and branch accessors take the WHOLE next
  value (`node(value)`), or derive it (`node(current => next)`). The value form
  is `T`, not `Partial<T>` — your state type owns its own strictness.
- **Leaves are Angular signals**: write with `.set()` / `.update()`.
- **No build transform required**: `@signaltree/callable-syntax` was deleted; leaf call syntax is not supported.

**Function-valued leaves:**
When a leaf stores a function as its value, use direct `.set(fn)` to assign. Callable `sig(fn)` is treated as an updater.

**Setup:**
No setup is required. Use `.set()` / `.update()` for leaves.

### Measuring performance and size

Performance and bundle size vary by app shape, build tooling, device, and runtime. To get meaningful results for your environment:

- Use the **Benchmark Orchestrator** in the demo app to run calibrated, scenario-based benchmarks across supported libraries with **real-world frequency weighting**. It applies research-based multipliers derived from 40,000+ developer surveys and GitHub analysis, reports statistical summaries (median/p95/p99/stddev), alternates runs to reduce bias, and can export CSV/JSON. When available, memory usage is also reported.
- Use the bundle analysis scripts in `scripts/` to measure your min+gz sizes. Sizes are approximate and depend on tree-shaking and configuration.

## Best Practices (SignalTree-First)

> 📖 **Full guide**: [Implementation Patterns](https://github.com/JBorgia/signal-tree/blob/main/docs/IMPLEMENTATION_PATTERNS.md)

Follow these principles for idiomatic SignalTree code:

### 1. Expose signals directly (no computed wrappers)

```typescript
const tree = signalTree(initialState); // No entities() enhancer needed in v7+ (deprecated in v6, removed in v7)
const $ = tree.$; // Shorthand for state access

// ✅ SignalTree-first: Direct signal exposure
return {
  selectedUserId: $.selected.userId, // Direct from $ tree
  loadingState: $.loading.state,
  selectedUser, // Actual derived state (computed)
};

// ❌ Anti-pattern: Unnecessary computed wrappers
return {
  selectedUserId: computed(() => $.selected.userId()), // Adds indirection
};
```

### 2. Use `ReturnType` inference (SignalTree-first)

```typescript
// Let SignalTree infer the type - no manual interface needed!
import type { createUserTree } from './user.tree';
export type UserTree = ReturnType<typeof createUserTree>;

// Factory function - no explicit return type needed
export function createUserTree() {
  const tree = signalTree(initialState); // entities() not needed in v7+
  return {
    selectedUserId: tree.$.selected.userId, // Type inferred automatically
    // ...
  };
}
```

### 3. Use `computed()` only for derived state

```typescript
// ✅ Correct: Derived from multiple signals
const selectedUser = computed(() => {
  const id = $.selected.userId();
  return id ? $.users.byId(id)() : null;
});

// ❌ Wrong: Wrapping an existing signal
const selectedUserId = computed(() => $.selected.userId()); // Unnecessary!
```

### 4. Use EntitySignal API directly

```typescript
// ✅ SignalTree-native
const user = $.users.byId(123)(); // O(1) lookup
const allUsers = $.users.all; // Get all
$.users.setAll(usersFromApi); // Replace all

// ❌ NgRx-style (avoid)
const user = entityMap()[123]; // Requires intermediate object
```

### Notification Batching

SignalTree automatically batches _notification delivery_ to subscribers and change detection to the end of the current microtask. This prevents render thrashing when multiple values are updated together and preserves immediate read-after-write semantics (values update synchronously, notifications are deferred).

**Example**

```typescript
// Multiple updates in the same microtask are coalesced into a single notification
tree.$.form.name.set('Alice');
tree.$.form.email.set('alice@example.com');
tree.$.form.submitted.set(true);
// → Subscribers are notified once at the end of the microtask with final values
```

**Testing**

When tests need synchronous notification delivery, use `flushSync()`:

```typescript
it('updates state', () => {
  tree.$.count.set(5);
  await Promise.resolve();
  expect(subscriber).toHaveBeenCalledWith(5, 0);
});
```

Alternatively, await a microtask (`await Promise.resolve()`) to allow the automatic flush to occur.

**Opting out**

To disable automatic microtask batching for a specific tree instance:

```typescript
const tree = signalTree(initialState, { batching: false });
```

Use this only for rare cases that truly require synchronous notifications (most apps should keep batching enabled).

## Quick start

### Installation

```bash
npm install @signal-tree/kernel
```

### Deep nesting example

```typescript
import { signalTree } from '@signal-tree/kernel';

// Strong type inference at deep nesting levels
const tree = signalTree({
  enterprise: {
    divisions: {
      technology: {
        departments: {
          engineering: {
            teams: {
              frontend: {
                projects: {
                  signaltree: {
                    releases: {
                      v1: {
                        features: {
                          recursiveTyping: {
                            validation: {
                              tests: {
                                extreme: {
                                  depth: 15,
                                  typeInference: true,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});

// Type inference at deep nesting levels
const depth = tree.$.enterprise.divisions.technology.departments.engineering.teams.frontend.projects.signaltree.releases.v1.features.recursiveTyping.validation.tests.extreme.depth();
console.log(`Depth: ${depth}`);

// Type-safe updates at unlimited depth
tree.$.enterprise.divisions.technology.departments.engineering.teams.frontend.projects.signaltree.releases.v1.features.recursiveTyping.validation.tests.extreme.depth(25); // Perfect type safety!
```

### Basic usage

```typescript
import { signalTree } from '@signal-tree/kernel';

// Create a simple tree
const tree = signalTree({
  count: 0,
  message: 'Hello World',
});

// Read values (these are Angular signals)
console.log(tree.$.count()); // 0
console.log(tree.$.message()); // 'Hello World'

// Update values
tree.$.count(5);
tree.$.message('Updated!');

// Use in an Angular component
@Component({
  template: ` <div>Count: {{ tree.$.count() }}</div>
    <div>Message: {{ tree.$.message() }}</div>
    <button (click)="increment()">+1</button>`,
})
class SimpleComponent {
  tree = tree;

  increment() {
    this.tree.$.count((n) => n + 1);
  }
}
```

### Intermediate usage (nested state)

```typescript
// Create hierarchical state
const tree = signalTree({
  user: {
    name: 'John Doe',
    email: 'john@example.com',
    preferences: {
      theme: 'dark',
      notifications: true,
    },
  },
  ui: {
    loading: false,
    errors: [] as string[],
  },
});

// Access nested signals with full type safety
tree.$.user.name('Jane Doe');
tree.$.user.preferences.theme('light');
tree.$.ui.loading(true);

// Computed values from nested state
const userDisplayName = computed(() => {
  const user = tree.$.user();
  return `${user.name} (${user.email})`;
});

// Effects that respond to changes
effect(() => {
  if (tree.$.ui.loading()) {
    console.log('Loading started...');
  }
});
```

### Reactive computations with computed()

SignalTree works seamlessly with Angular's `computed()` for creating efficient reactive computations. These computations automatically update when their dependencies change and are memoized for optimal performance.

```typescript
import { computed, effect } from '@angular/core';
import { signalTree } from '@signal-tree/kernel';

const tree = signalTree({
  users: [
    { id: '1', name: 'Alice', active: true, role: 'admin' },
    { id: '2', name: 'Bob', active: false, role: 'user' },
    { id: '3', name: 'Charlie', active: true, role: 'user' },
  ],
  filters: {
    showActive: true,
    role: 'all' as 'all' | 'admin' | 'user',
  },
});

// Basic computed - automatically memoized
const userCount = computed(() => tree.$.users().length);

// Complex filtering computation
const filteredUsers = computed(() => {
  const users = tree.$.users();
  const filters = tree.$.filters();

  return users.filter((user) => {
    if (filters.showActive && !user.active) return false;
    if (filters.role !== 'all' && user.role !== filters.role) return false;
    return true;
  });
});

// Derived computation from other computed values
const activeAdminCount = computed(() => filteredUsers().filter((user) => user.role === 'admin' && user.active).length);

// Performance-critical computation with complex logic
const userStatistics = computed(() => {
  const users = tree.$.users();

  return {
    total: users.length,
    active: users.filter((u) => u.active).length,
    admins: users.filter((u) => u.role === 'admin').length,
    averageNameLength: users.reduce((acc, u) => acc + u.name.length, 0) / users.length,
  };
});

// Dynamic computed functions (factory pattern)
const userById = (id: string) => computed(() => tree.$.users().find((user) => user.id === id));

// Usage in effects
effect(() => {
  console.log(`Filtered users: ${filteredUsers().length}`);
  console.log(`Statistics:`, userStatistics());
});

// Best Practices:
// 1. Use computed() for derived state that depends on signals
// 2. Keep computations pure - no side effects
// 3. Leverage automatic memoization for expensive operations
// 4. Chain computed values for complex transformations
// 5. Use factory functions for parameterized computations
```

### Performance optimization with computed values

Computed values are Angular-native and memoized by default:

```typescript
import { computed } from '@angular/core';
import { signalTree } from '@signal-tree/kernel';

const tree = signalTree({
  items: Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    value: Math.random(),
    category: `cat-${i % 10}`,
  })),
});

// Expensive computation - automatically cached by Angular computed()
const expensiveComputation = computed(() => {
  return tree.$.items()
    .filter((item) => item.value > 0.5)
    .reduce((acc, item) => acc + Math.sin(item.value * Math.PI), 0);
});

// The computation only runs when tree.$.items() actually changes
// Subsequent calls return cached result
```

### Advanced usage (full state tree)

```typescript
interface AppState {
  auth: {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
  };
  data: {
    users: User[];
    posts: Post[];
    cache: Record<string, unknown>;
  };
  ui: {
    theme: 'light' | 'dark';
    sidebar: {
      open: boolean;
      width: number;
    };
    notifications: Notification[];
  };
}

const tree = signalTree<AppState>({
  auth: {
    user: null,
    token: null,
    isAuthenticated: false,
  },
  data: {
    users: [],
    posts: [],
    cache: {},
  },
  ui: {
    theme: 'light',
    sidebar: { open: true, width: 250 },
    notifications: [],
  },
});

// Complex updates with type safety
tree((state) => ({
  auth: {
    ...state.auth,
    user: { id: '1', name: 'John' },
    isAuthenticated: true,
  },
  ui: {
    ...state.ui,
    notifications: [...state.ui.notifications, { id: '1', message: 'Welcome!', type: 'success' }],
  },
}));

// Get entire state as plain object
const currentState = tree();
console.log('Current app state:', currentState);
```

## Core features

### 1) Hierarchical signal trees

Create deeply nested reactive state with automatic type inference:

```typescript
const tree = signalTree({
  user: { name: '', email: '' },
  settings: { theme: 'dark', notifications: true },
  todos: [] as Todo[],
});

// Access nested signals with full type safety
tree.$.user.name(); // string signal
tree.$.settings.theme.set('light'); // type-checked value
tree.$.todos.update((todos) => [...todos, newTodo]); // array operations
```

### 2) TypeScript inference

SignalTree provides complete type inference without manual typing:

```typescript
// Automatic inference from initial state
const tree = signalTree({
  count: 0, // Inferred as WritableSignal<number>
  name: 'John', // Inferred as WritableSignal<string>
  active: true, // Inferred as WritableSignal<boolean>
  items: [] as Item[], // Inferred as WritableSignal<Item[]>
  config: {
    theme: 'dark' as const, // Inferred as WritableSignal<'dark'>
    settings: {
      nested: true, // Deep nesting maintained
    },
  },
});

// Type-safe access and updates
tree.$.count.set(5); // ✅ number
tree.$.count.set('invalid'); // ❌ Type error
tree.$.config.theme.set('light'); // ❌ Type error ('dark' const)
tree.$.config.settings.nested.set(false); // ✅ boolean
```

### 3) Manual state management

Core provides basic state updates. For advanced entity management, use the built-in `entities` enhancer:

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

const tree = signalTree({
  users: [] as User[],
});

// Entity CRUD operations using core methods
function addUser(user: User) {
  tree.$.users.update((users) => [...users, user]);
}

function updateUser(id: string, updates: Partial<User>) {
  tree.$.users.update((users) => users.map((user) => (user.id === id ? { ...user, ...updates } : user)));
}

function removeUser(id: string) {
  tree.$.users.update((users) => users.filter((user) => user.id !== id));
}

// Manual queries using computed signals
const userById = (id: string) => computed(() => tree.$.users().find((user) => user.id === id));
const activeUsers = computed(() => tree.$.users().filter((user) => user.active));
```

### 4) Manual async state management

Core provides basic state updates. For advanced async helpers, use the built-in async helpers (`createAsyncOperation`, `trackAsync`):

```typescript
const tree = signalTree({
  users: [] as User[],
  loading: false,
  error: null as string | null,
});

// Manual async operation management
async function loadUsers() {
  tree.$.loading.set(true);
  tree.$.error.set(null);

  try {
    const users = await api.getUsers();
    tree.$.users.set(users);
  } catch (error) {
    tree.$.error.set(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    tree.$.loading.set(false);
  }
}

// Usage in component
@Component({
  template: `
    @if (tree.$.loading()) {
    <div>Loading...</div>
    } @else if (tree.$.error()) {
    <div class="error">{{ tree.$.error() }}</div>
    } @else { @for (user of tree.$.users(); track user.id) {
    <user-card [user]="user" />
    } }
    <button (click)="loadUsers()">Refresh</button>
  `,
})
class UsersComponent {
  tree = tree;
  loadUsers = loadUsers;
}
```

### 5) Performance considerations

### 6) Enhancers and composition

SignalTree Core provides a complete set of built-in enhancers. Each enhancer is a focused, tree-shakeable extension that adds specific functionality.

#### Available Enhancers (All in @signal-tree/kernel)

All enhancers are exported directly from `@signal-tree/kernel`:

**Performance Enhancers:**

- `batching()` - Batch updates to reduce recomputation and rendering

**Data Management:**

- `serialization()` - State persistence and SSR support
- `persistence()` - Auto-save to localStorage/IndexedDB

**Development Tools:**

- `devTools()` - Redux DevTools auto-connect, path actions, and time-travel dispatch
- `restoration()` - Undo/redo functionality

`devTools()` also adds `tree.exportDebugSession()`, which returns a
`DevToolsDebugSession` snapshot — aggregate metrics, per-module activity, and the
log buffer — for saving or attaching to a bug report:

```typescript
import { signalTree, devTools } from '@signal-tree/kernel';
import type { DevToolsDebugSession } from '@signal-tree/kernel';

const tree = signalTree(state, { enhancers: [devTools({ name: 'MyApp' })] });

const session: DevToolsDebugSession = tree.exportDebugSession();
// session.metrics · session.modules · session.logs
```

It has always been attached at runtime; 15.0 is where it was finally declared on
`DevToolsMethods`, so reaching it no longer needs a cast. `devTools({ enabled:
false })` returns an empty session rather than throwing.

#### Additional Packages

These are the **only** separate packages in the SignalTree ecosystem:

- **`@signaltree/ng-forms`** - Angular Forms integration (separate package)

#### Composition Patterns

**Basic Enhancement:**

```typescript
import { signalTree, batching, devTools } from '@signal-tree/kernel';

// Declare the whole set — there is no late enhancement
const tree = signalTree(
  { count: 0 },
  {
    enhancers: [
      batching(), // Performance optimization
      devTools(), // Development tools
    ],
  }
);
```

**Performance-Focused Stack:**

```typescript
import { signalTree, batching, entityMap } from '@signal-tree/kernel';

const tree = signalTree(
  {
    products: entityMap<Product>(),
    ui: { loading: false },
  },
  { enhancers: [batching()] }
); // Batch updates for optimal rendering

// Entity CRUD operations
tree.$.products.addOne(newProduct);
tree.$.products.setAll(productsFromApi);

// Entity queries
const electronics = tree.$.products.all.filter((p) => p.category === 'electronics');
```

**Full-Stack Application:**

```typescript
import { signalTree, persistence, restoration } from '@signal-tree/kernel';

const tree = signalTree(
  {
    user: null as User | null,
    preferences: { theme: 'light' },
  },
  { enhancers: [persistence({ key: 'app-state' }), restoration()] }
); // Undo/redo support

// For async operations, use manual async or async helpers
async function fetchUser(id: string) {
  tree.$.loading.set(true);
  try {
    const user = await api.getUser(id);
    tree.$.user.set(user);
  } catch (error) {
    tree.$.loading.set(error.message);
  } finally {
    tree.$.loading.set(false);
  }
}

// Automatic state persistence
tree.$.preferences.theme('dark'); // Auto-saved

// Time travel
tree.undo(); // Revert changes
```

#### Core Stubs

SignalTree Core includes all enhancer functionality built-in. No separate packages needed:

```typescript
import { signalTree, entityMap } from '@signal-tree/kernel';

// Without entityMap - use manual array updates
const basic = signalTree({ users: [] as User[] });
basic.$.users.update((users) => [...users, newUser]);

// With entityMap - use entity helpers
const enhanced = signalTree({
  users: entityMap<User>(),
});

enhanced.$.users.addOne(newUser); // ✅ Advanced CRUD operations
enhanced.$.users.byId(123)(); // ✅ O(1) lookups
enhanced.$.users.all; // ✅ Get all as array
```

Core includes several performance optimizations:

```typescript
// Lazy signal creation (default)
const tree = signalTree({
  largeObject: {
    // Signals only created when accessed
    level1: { level2: { level3: { data: 'value' } } },
  },
});

// Custom equality function
const tree2 = signalTree(
  {
    items: [] as Item[],
  },
  {
    useShallowComparison: false, // Deep equality (default)
  }
);

// Immutable update; snapshot materialization reuses internal work where possible
tree.update((state) => ({
  ...state, // Reuses unchanged parts
  newField: 'value',
}));
```

### 7) App-local Helpers

SignalTree 15.0 no longer publishes a generic custom marker/enhancer authoring
SDK. Use the built-in primitives from `@signal-tree/kernel`, and keep app-specific
behavior in ordinary Angular signals, services, or helper functions around the
tree you own.

#### Helper Example

```typescript
import { signal, type Signal } from '@angular/core';
import { signalTree } from '@signal-tree/kernel';

interface WithLogger {
  log(message: string): void;
  history: Signal<string[]>;
}

function createLoggedTree(config?: { maxHistory?: number }) {
  const maxHistory = config?.maxHistory ?? 100;
  const tree = signalTree({ count: 0 });
  const historySignal = signal<string[]>([]);
  return Object.assign(tree, {
    log: (msg: string) => historySignal.update((history) => [...history, msg].slice(-maxHistory)),
    history: historySignal.asReadonly(),
  } satisfies WithLogger);
}

// Usage
const tree = createLoggedTree();
tree.log('Tree created');
```

### 8) Derived State

SignalTree declares **derived state** with one config-level factory. Compose
dependencies with ordinary local `computed` references inside that factory.

#### Basic Usage (Inline Derived)

When derived functions are defined inline, TypeScript automatically infers all types:

```typescript
import { signalTree, entityMap } from '@signal-tree/kernel';
import { computed } from '@angular/core';

const tree = signalTree(
  {
    users: entityMap<User, number>(),
    selectedUserId: null as number | null,
  },
  {
    derived: ($) => {
      const selectedUser = computed(() => {
        const id = $.selectedUserId();
        return id != null ? $.users.byId(id)?.() ?? null : null;
      });
      return {
        selectedUser,
        isAdmin: computed(() => selectedUser()?.role === 'admin'),
      };
    },
  }
);

// Usage
tree.$.selectedUser(); // User | null (computed signal)
tree.$.isAdmin(); // boolean (computed signal)
```

Keep the factory beside tree construction so contextual typing flows from
`signalTree`. Application modules may still own ordinary helper functions that
return signals; call those helpers from the one factory rather than creating a
staged construction protocol.

## Built-in Markers

SignalTree provides four built-in markers that handle common state patterns Angular doesn't provide out of the box. All markers are **self-registering** and **tree-shakeable** - only the markers you use are included in your bundle.

### 9) `entityMap<E, K>()` - Normalized Collections

Creates a normalized entity collection with O(1) lookups by ID. Includes chainable `.computed()` for derived slices.

```typescript
import { signalTree, entityMap } from '@signal-tree/kernel';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  inStock: boolean;
}

const tree = signalTree({
  products: entityMap<Product, number>()
    .computed('electronics', (all) => all.filter((p) => p.category === 'electronics'))
    .computed('inStock', (all) => all.filter((p) => p.inStock))
    .computed('totalValue', (all) => all.reduce((sum, p) => sum + p.price, 0)),
});

// EntitySignal API
tree.$.products.setMany([
  { id: 1, name: 'Laptop', category: 'electronics', price: 999, inStock: true },
  { id: 2, name: 'Chair', category: 'furniture', price: 199, inStock: false },
]);

tree.$.products.all();              // Product[] - all entities
tree.$.products.asMap();            // ReadonlyMap<number, Product>
tree.$.products.byId(1);            // EntityNode<Product> | undefined
tree.$.products.byIdOrFail(1);      // EntityNode<Product> or throws
tree.$.products.ids();              // number[]
tree.$.products.count();            // number
tree.$.products.empty();            // boolean
tree.$.products.has(1)();           // boolean signal
tree.$.products.where((p) => p.inStock)(); // Product[] signal
tree.$.products.find((p) => p.price > 500)(); // Product | undefined signal
tree.$.products.setActiveId(1);
tree.$.products.activeId();         // number | undefined
tree.$.products.activeEntity();     // Product | undefined
tree.$.products.clearActiveId();

// Computed slices (reactive, type-safe)
tree.$.products.electronics();      // Signal<Product[]> - auto-updates
tree.$.products.inStock();          // Signal<Product[]>
tree.$.products.totalValue();       // Signal<number>

// CRUD operations
tree.$.products.addOne({ id: 3, name: 'Desk', category: 'furniture', price: 299, inStock: true });
tree.$.products.addMany([...]);
tree.$.products.prependOne({ id: 0, name: 'Featured', category: 'electronics', price: 499, inStock: true });
tree.$.products.prependMany([...]);
tree.$.products.updateOne(1, { price: 899 });
tree.$.products.replaceOne(1, { id: 1, name: 'Laptop Pro', category: 'electronics', price: 1299, inStock: true });
tree.$.products.upsertOne({ id: 1, name: 'Updated', category: 'electronics', price: 899, inStock: true });
tree.$.products.upsertMany([...]);
tree.$.products.changeId(3, 30);
tree.$.products.removeOne(1);
tree.$.products.removeMany([1, 2]);
tree.$.products.clear();
```

#### Custom ID Selection

```typescript
interface User {
  odataId: string; // Not named 'id'
  email: string;
}

const tree = signalTree({
  users: entityMap<User, string>(),
});

// Specify selectId when upserting
tree.$.users.upsertOne(user, { selectId: (u) => u.odataId });
```

### 10) Manual Async State

Use ordinary state for local operation flags. The old cache-aware
`entityMap({ load: loader(...) })` surface is not part of the current RC public
API; keep loading/freshness orchestration in application services.

```typescript
import { signalTree } from '@signal-tree/kernel';

const tree = signalTree({
  users: {
    data: [] as User[],
    loadStatus: 'idle' as 'idle' | 'loading' | 'loaded' | 'error',
  },
});

tree.$.users.loadStatus.set('loading');

tree.$.users.loadStatus(); // 'idle' | 'loading' | 'loaded' | 'error'
tree.$.users.loadStatus.set('loaded');
```

### 11) `link()` — synchronize a location with an external endpoint

One primitive, three directions. `link(x, y)` keeps a SignalTree location in step
with something outside the tree, and decides for itself what the location's value
is — you never annotate it.

```ts
import { link, signalTree } from '@signal-tree/kernel';

const tree = signalTree({ settings: { theme: 'light' } });

const connection = link(tree.$.settings, {
  get: () => api.load(), // Y -> X, on retrieve()
  set: (value) => api.save(value), // X -> Y, once per settled turn
  subscribe: (next) => socket.on('cfg', next), // Y -> X, live
});

await connection.retrieve();
await connection.settled();
connection.dispose();
```

The handle has exactly three members. A rejected outbound `set()` is reported to
`onTreeError` with the owning `treeId` and the linked `path`; the authored value
is NOT rolled back, the queue survives, and `settled()` resolves rather than
throwing — which is why the handle needs no error member of its own.

**What it will not carry.** An inspection write — a devtools scrub — moves what
you see and deliberately does not become external truth. `link()` publishes the
value that is _eligible_ to be authoritative, not whatever the tree currently
holds.

⚠️ `x` must be an OWNED SignalTree location, enforced at runtime rather than by
the type: a `computed` and a bare `WritableSignal` are structurally identical to
an owned leaf.

### 12) `onTreeError()` — the one error surface

```ts
import { onTreeError } from '@signal-tree/kernel';

const off = onTreeError((e) => {
  console.error(e.operation, e.treeId, e.path, e.error);
});
```

Every failure the library reports for itself arrives here: a rejected
`link:set`, a refused restoration, a persistence write that threw. `treeId`
distinguishes two same-shaped trees; `path` is the STATE location, never a
storage key or an endpoint address.

### 13) Persistence

The old `stored(key, default, options?)` marker and storage-key helpers are not
part of the current release-candidate public surface. Keep persistence in an
application service for now, then write the resulting values into SignalTree
through ordinary state or `entityMap()` APIs.

### 14) ~~Angular Forms Integration~~ — `@signaltree/ng-forms` was DELETED

**This section taught `import { createFormTree, ngFormValidators } from
'@signaltree/ng-forms'`, and that package no longer exists** — deleted in
`41373050` (NGF-DEL), after NGF-0 found it did not earn its place. The README kept
teaching it because `lint-readme-apis` validates SYMBOLS against built entry
points and a specifier for a package that is not built is checked against
nothing. `check-documented-imports.mjs` exists because of this.

For Angular `FormGroup` interop, use `toWritableSignal()` to bridge a tree node
into a form control, or hold form state as ordinary tree state and write it back
through `undoable()` when the edit should be reversible.

### Manual async error handling

```typescript
const tree = signalTree({
  data: null as ApiData | null,
  loading: false,
  error: null as Error | null,
  retryCount: 0,
});

async function loadDataWithRetry(attempt = 0) {
  tree.$.loading.set(true);
  tree.$.error.set(null);

  try {
    const data = await api.getData();
    tree.$.data.set(data);
    tree.$.loading.set(false);
    tree.$.retryCount.set(0);
  } catch (error) {
    if (attempt < 3) {
      // Retry logic
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      return loadDataWithRetry(attempt + 1);
    }

    tree.$.loading.set(false);
    tree.$.error.set(error instanceof Error ? error : new Error('Unknown error'));
    tree.$.retryCount.update((count) => count + 1);
  }
}

// Error boundary component
@Component({
  template: `
    @if (tree.$.error()) {
    <div class="error-boundary">
      <h3>Something went wrong</h3>
      <p>{{ tree.$.error()?.message }}</p>
      <p>Attempts: {{ tree.$.retryCount() }}</p>
      <button (click)="retry()">Retry</button>
      <button (click)="clear()">Clear Error</button>
    </div>
    } @else {
    <!-- Normal content -->
    }
  `,
})
class ErrorHandlingComponent {
  tree = tree;

  retry() {
    loadDataWithRetry();
  }

  clear() {
    this.tree.$.error.set(null);
  }
}
```

### State update error handling

```typescript
const tree = signalTree({
  items: [] as Item[],
  validationErrors: [] as string[],
});

// Safe update with validation
function safeUpdateItem(id: string, updates: Partial<Item>) {
  try {
    tree.update((state) => {
      const itemIndex = state.items.findIndex((item) => item.id === id);
      if (itemIndex === -1) {
        throw new Error(`Item with id ${id} not found`);
      }

      const updatedItem = { ...state.items[itemIndex], ...updates };

      // Validation
      if (!updatedItem.name?.trim()) {
        throw new Error('Item name is required');
      }

      const newItems = [...state.items];
      newItems[itemIndex] = updatedItem;

      return {
        items: newItems,
        validationErrors: [], // Clear errors on success
      };
    });
  } catch (error) {
    tree.$.validationErrors.update((errors) => [...errors, error instanceof Error ? error.message : 'Unknown error']);
  }
}
```

## Package composition patterns

SignalTree Core is designed for modular composition. Start minimal and add features as needed.

### Basic Composition

```typescript
import { signalTree } from '@signal-tree/kernel';

// Core provides the foundation
const tree = signalTree({
  users: [] as User[],
  ui: { loading: false },
});

// Basic operations included in core
tree.$.users.set([...users, newUser]);
tree.$.ui.loading.set(true);
tree.effect(() => console.log('State changed'));
```

### Performance-Enhanced Composition

```typescript
import { computed } from '@angular/core';
import { signalTree, batching } from '@signal-tree/kernel';

// Add performance optimizations
const tree = signalTree(
  {
    products: [] as Product[],
    filters: { category: '', search: '' },
  },
  { enhancers: [batching()] }
);

tree.batch(() => {
  tree.$.products.update((products) => [...products, ...newProducts]);
  tree.$.filters.category.set('electronics');
});

// Expensive computations are automatically cached
const filteredProducts = computed(() => {
  return tree.$.products()
    .filter((p) => p.category.includes(tree.$.filters.category()))
    .filter((p) => p.name.includes(tree.$.filters.search()));
});
```

### Data Management Composition

```typescript
import { signalTree, entityMap } from '@signal-tree/kernel';

// Add data management capabilities (+2.77KB total)
const tree = signalTree({
  users: entityMap<User>(),
  posts: entityMap<Post>(),
  ui: { loading: false, error: null as string | null },
});

// Advanced entity operations via tree.$ accessor
tree.$.users.addOne(newUser);
tree.$.users.where((u) => u.active);
tree.$.users.updateMany(['1'], { status: 'active' });

// Entity helpers work with nested structures
// Example: deeply nested entities in a domain-driven design pattern
const appTree = signalTree({
  app: {
    data: {
      users: entityMap<User>(),
      products: entityMap<Product>(),
    },
  },
  admin: {
    data: {
      logs: entityMap<AuditLog>(),
      reports: entityMap<Report>(),
    },
  },
});

// Access nested entities using tree.$ accessor
appTree.$.app.data.users.where((u) => u.isAdmin); // Filtered signal
appTree.$.app.data.products.count(); // Count signal
appTree.$.admin.data.logs.all(); // All items as array
appTree.$.admin.data.reports.ids(); // ID array signal

// For async operations, use manual async or async helpers
async function fetchUsers() {
  tree.$.ui.loading.set(true);
  try {
    const users = await api.getUsers();
    tree.$.users.setAll(users);
  } catch (error) {
    tree.$.ui.error.set(error.message);
  } finally {
    tree.$.ui.loading.set(false);
  }
}
```

### Full-Featured Development Composition

```typescript
import { signalTree, batching, persistence, restoration, devTools } from '@signal-tree/kernel';

// Full development stack (example)
const tree = signalTree(
  {
    app: {
      user: null as User | null,
      preferences: { theme: 'light' },
      data: { users: [], posts: [] },
    },
  },
  {
    enhancers: [
      batching(), // Performance
      persistence({ key: 'my-app-state' }),
      restoration({
        // Undo/redo
        maxHistory: 50,
      }),
      devTools({
        // Debug tools (dev only)
        name: 'MyApp',
        enableTimeTravel: true,
        includePaths: ['app.*', 'ui.*'],
        formatPath: (path) => path.replace(/\.(\d+)/g, '[$1]'),
      }),
    ],
  }
);

// Rich feature set available
async function fetchUser(id: string) {
  return await api.getUser(id);
}
tree.$.app.data.users.byId(userId)(); // O(1) lookup
tree.undo(); // Time travel
tree.save(); // Persistence
```

For optimistic workflows, `transactions()` adds an explicit tree-local
transaction boundary. `transaction(fn)` groups synchronous writes into one
pending turn; callers can `confirm()` it or `rollback()` it. A rollback that
cannot be applied conservatively throws `SignalTreeRollbackError`, leaving the
surviving authoritative state intact for reconciliation or refetch.

### Production-Ready Composition

```typescript
import { signalTree, batching, persistence } from '@signal-tree/kernel';

// Production build (no dev tools)
const tree = signalTree(initialState, {
  enhancers: [
    batching(), // Performance optimization
    persistence({ key: 'app-v1.2.3' }),
  ],
});

// Clean, efficient, production-ready
```

### Conditional Enhancement

```typescript
import { signalTree, batching, devTools, restoration } from '@signal-tree/kernel';

const isDevelopment = process.env['NODE_ENV'] === 'development';

// Conditional enhancement based on environment
const tree = signalTree(state, {
  enhancers: [
    batching(), // Always include performance
    ...(isDevelopment
      ? [
          // Development-only features
          devTools(),
          restoration(),
        ]
      : []),
  ],
});
```

### Measuring bundle size

Bundle sizes depend on your build, tree-shaking, and which enhancers you include. Use the scripts in `scripts/` to analyze min+gz for your configuration.

### Migration Strategy

Start with core and grow incrementally:

```typescript
// Phase 1: Start with core
const tree = signalTree(state);

// Phase 2: Add performance when needed — as a NEW tree, not by enhancing this
// one. A tree's capabilities are fixed at construction.
const tree2 = signalTree(state, { enhancers: [batching()] });

// Phase 3: Use entityMap for normalized local collections
const tree3 = signalTree({ users: entityMap<User>() }, { enhancers: [batching()] });

// Each phase is fully functional and production-ready
```

Conditional features are a conditional ARRAY, decided before the tree exists:

```typescript
const enhancers = [...(isDevelopment ? [devTools()] : []), ...(needsPerformance ? [batching()] : []), ...(needsTimeTravel ? [restoration()] : [])];

const tree = signalTree(initialState, { enhancers });
```

This is what replaced reassigning `tree = tree.with(...)` in a chain of `if`s,
and it is better than a rewrite of the same thing: on the old path the tree was
already built before the first `if` ran, so it carried the full build plan
whichever branch was taken. Here a build with no `restoration()` does not install
the machinery `restoration()` needs.

### Service-based pattern

```typescript
@Injectable()
class AppStateService {
  private tree = signalTree({
    user: null as User | null,
    settings: { theme: 'light' as const },
  });

  // Expose specific parts
  readonly user$ = this.tree.$.user;
  readonly settings$ = this.tree.$.settings;

  // Expose specific actions
  setUser(user: User) {
    this.tree.$.user.set(user);
  }

  updateSettings(settings: Partial<Settings>) {
    this.tree.$.settings.update((current) => ({
      ...current,
      ...settings,
    }));
  }

  // For advanced features, return the tree
  getTree() {
    return this.tree;
  }
}
```

## Measuring performance

For fair, reproducible measurements that reflect your app and hardware, use the **Benchmark Orchestrator** in the demo. It calibrates runs per scenario and library, applies **real-world frequency weighting** based on research analysis, reports robust statistics, and supports CSV/JSON export. Avoid copying fixed numbers from docs; results vary.

## Example

```typescript
// Complete user management component
@Component({
  template: `
    <div class="user-manager">
      <!-- User List -->
      <div class="user-list">
        @if (userTree.$.loading()) {
        <div class="loading">Loading users...</div>
        } @else if (userTree.$.error()) {
        <div class="error">
          {{ userTree.$.error() }}
          <button (click)="loadUsers()">Retry</button>
        </div>
        } @else { @for (user of users.selectAll()(); track user.id) {
        <div class="user-card">
          <h3>{{ user.name }}</h3>
          <p>{{ user.email }}</p>
          <button (click)="editUser(user)">Edit</button>
          <button (click)="deleteUser(user.id)">Delete</button>
        </div>
        } }
      </div>

      <!-- User Form -->
      <form (ngSubmit)="saveUser()" #form="ngForm">
        <input [(ngModel)]="userTree.$.form.name()" name="name" placeholder="Name" required />
        <input [(ngModel)]="userTree.$.form.email()" name="email" type="email" placeholder="Email" required />
        <button type="submit" [disabled]="form.invalid">{{ userTree.$.form.id() ? 'Update' : 'Create' }} User</button>
        <button type="button" (click)="clearForm()">Clear</button>
      </form>
    </div>
  `,
})
class UserManagerComponent implements OnInit {
  userTree = signalTree({
    users: [] as User[],
    loading: false,
    error: null as string | null,
    form: { id: '', name: '', email: '' },
  });

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.loadUsers();
  }

  async loadUsers() {
    this.userTree.$.loading.set(true);
    this.userTree.$.error.set(null);

    try {
      const users = await this.userService.getUsers();
      this.userTree.$.users.set(users);
    } catch (error) {
      this.userTree.$.error.set(error instanceof Error ? error.message : 'Load failed');
    } finally {
      this.userTree.$.loading.set(false);
    }
  }

  editUser(user: User) {
    this.userTree.$.form.set(user);
  }

  async saveUser() {
    try {
      const form = this.userTree.$.form();
      if (form.id) {
        await this.userService.updateUser(form.id, form);
        this.updateUser(form.id, form);
      } else {
        const newUser = await this.userService.createUser(form);
        this.addUser(newUser);
      }
      this.clearForm();
    } catch (error) {
      this.userTree.$.error.set(error instanceof Error ? error.message : 'Save failed');
    }
  }

  private addUser(user: User) {
    this.userTree.$.users.update((users) => [...users, user]);
  }

  private updateUser(id: string, updates: Partial<User>) {
    this.userTree.$.users.update((users) => users.map((user) => (user.id === id ? { ...user, ...updates } : user)));
  }

  deleteUser(id: string) {
    if (confirm('Delete user?')) {
      this.removeUser(id);
      this.userService.deleteUser(id).catch((error) => {
        this.userTree.$.error.set(error.message);
        this.loadUsers(); // Reload on error
      });
    }
  }

  private removeUser(id: string) {
    this.userTree.$.users.update((users) => users.filter((user) => user.id !== id));
  }

  clearForm() {
    this.userTree.$.form.set({ id: '', name: '', email: '' });
  }
}
```

    ]

}
}));

// Get entire state as plain object
const currentState = tree.unwrap();
console.log('Current app state:', currentState);

```
});
```

## Core features

### Hierarchical signal trees

```typescript
const tree = signalTree({
  user: { name: '', email: '' },
  settings: { theme: 'dark', notifications: true },
  todos: [] as Todo[],
});

// Access nested signals with full type safety
tree.$.user.name(); // string
tree.$.settings.theme.set('light');
tree.$.todos.update((todos) => [...todos, newTodo]);
```

### Manual entity management

```typescript
// Manual CRUD operations
const tree = signalTree({
  todos: [] as Todo[],
});

function addTodo(todo: Todo) {
  tree.$.todos.update((todos) => [...todos, todo]);
}

function updateTodo(id: string, updates: Partial<Todo>) {
  tree.$.todos.update((todos) => todos.map((todo) => (todo.id === id ? { ...todo, ...updates } : todo)));
}

function removeTodo(id: string) {
  tree.$.todos.update((todos) => todos.filter((todo) => todo.id !== id));
}

// Manual queries with computed signals
const todoById = (id: string) => computed(() => tree.$.todos().find((todo) => todo.id === id));
const allTodos = computed(() => tree.$.todos());
const todoCount = computed(() => tree.$.todos().length);
```

### Manual async state management

```typescript
async function loadUsers() {
  tree.$.loading.set(true);

  try {
    const users = await api.getUsers();
    tree.$.users.set(users);
  } catch (error) {
    tree.$.error.set(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    tree.$.loading.set(false);
  }
}

// Use in components
async function handleLoadUsers() {
  await loadUsers();
}
```

### Reactive effects

```typescript
// Create reactive effects
tree.effect((state) => {
  console.log(`User: ${state.user.name}, Theme: ${state.settings.theme}`);
});

// Manual subscriptions
const unsubscribe = tree.subscribe((state) => {
  // Handle state changes
});
```

## Tree lifetime and `destroy()`

A `SignalTree` owns runtime resources for the lifetime of the tree — per-leaf
signals, the entity stores behind `entityMap()`, notifier subscriptions, and
whatever the enhancers you declared installed. **When a tree is created with a
bounded lifetime, call `destroy()` when that lifetime ends.**

Two categories, and only the second needs anything from you:

```text
LONG-LIVED APPLICATION STORE
  created once, lives as long as the application
  destroy() at application or root-service teardown, if at all

BOUNDED-LIFETIME STORE
  a test
  an SSR request
  a route- or component-owned feature store
  a temporary workflow, a store recreated on navigation
  → destroy() at the ownership boundary
```

Angular makes the bounded case easy: create the tree in a service provided at
the component or route level and call `destroy()` from `ngOnDestroy`, or hand it
to `DestroyRef`.

```typescript
@Injectable() // provided by the component/route, not in root
export class FeatureStore implements OnDestroy {
  private tree = signalTree({ rows: entityMap<Row, string>({ selectId: (r) => r.id }) });
  readonly rows = this.tree.$.rows.all;

  ngOnDestroy() {
    this.tree.destroy();
  }
}
```

### Why this is a requirement and not a warning about leaks

Dropping the last reference to a tree that has taken writes is **not** sufficient
for prompt reclamation. Measured — six identical stores built in one process,
10,000 rows each, `tools/probe-history-sample-isolation.mjs`:

```text
build            1        2        3        4        5        6
abandoned    89.65   174.08   263.14   355.81   452.13      OOM
destroyed     7.08     7.21     7.28     7.28     7.37     7.38
isolated     89.65    89.66    89.63    89.62    89.65    89.65
```

The `isolated` row is one store per process: a single tree costs the same every
time, so there is no unbounded growth inside a tree. The `abandoned` row is the
same six builds in one process without `destroy()` — nothing is released. The
`destroyed` row is those six builds calling it.

So the accurate statement is **"a tree owns resources until you destroy it"**,
not "SignalTree leaks unless destroyed". The experiment disproves the second: the
resources are owned, reclaimable on request, and bounded per tree. What it
establishes is an ownership contract, and the cost of ignoring it scales with how
many trees you create rather than how long one lives.

## Core API reference

### signalTree()

```typescript
const tree = signalTree(initialState, config?);
```

### Tree Methods

```typescript
// State access
tree.$.property(); // Read signal value
tree.$.property.set(value); // Update signal
tree.unwrap(); // Get plain object

// Tree operations
tree.update(updater); // Update entire tree
tree.effect(fn); // Create reactive effects
tree.subscribe(fn); // Manual subscriptions
tree.destroy(); // Cleanup resources

// Entity helpers (when using entityMap + entities)
// tree.$.users.addOne(user);    // Add single entity
// tree.$.users.byId(id)();      // O(1) lookup by ID
// tree.$.users.all;         // Get all as array
// tree.$.users.selectBy(pred);  // Filtered signal
```

## Extending with enhancers

SignalTree Core includes all enhancers built-in:

```typescript
import { signalTree, batching, restoration } from '@signal-tree/kernel';

const tree = signalTree(initialState, { enhancers: [batching(), restoration()] });
```

### Available enhancers

All enhancers are included in `@signal-tree/kernel`:

- **batching()** - Batch multiple updates for better performance
- **devTools()** - Redux DevTools integration for debugging
- **restoration()** - Undo/redo functionality & state history
- **serialization()** - State persistence & SSR support

### Marking an operation undoable

`undoable()` designates the authored causal turn containing its writes as
eligible for undo. It does **not** create a causal-turn boundary.

```ts
import { signalTree, restoration, undoable } from '@signal-tree/kernel';

const tree = signalTree(
  { doc: { title: '' }, ui: { panel: 'none' } },
  {
    enhancers: [restoration({ maxHistorySize: 50 })],
  }
);

function rename(title: string) {
  undoable(() => tree.$.doc.title.set(title));
}
```

Two consequences follow from "the turn, not the write", and both are worth
knowing before you meet them:

```ts
// One designated write promotes the WHOLE turn. These reverse together,
// because writes in the same tick are one causal turn.
undoable(() => tree.$.doc.title.set('edited'));
tree.$.ui.panel.set('inspector');

// Two scopes in one tick are ONE undo step, for the same reason.
undoable(() => tree.$.a.set(1));
undoable(() => tree.$.b.set(2));
```

If you need separate undo steps, separate the turns — an ordinary event boundary
already does that, which is why there is no boundary API.

The scope is synchronous. An async callback is refused with `ST1033` rather than
silently designating nothing:

```ts
const data = await load();
undoable(() => tree.$.x.set(data)); // ✅ designate the synchronous write
```

When a framework owns the write and there is no callback to wrap — Angular
Signal Forms writes its model from inside its own DOM listener — designate at
the mutation door instead:

```ts
const model = toWritableSignal(tree.$.editForm, injector, { undoable: true });
```

That is ingress designation, not "this branch is historical": a write to the same
branch through an ordinary tree handle stays non-undoable.

An `undo()` that cannot be applied is refused rather than partially applied —
see `ST1034` in [docs/errors](../../docs/errors/README.md).

### Applying externally acquired truth

`external()` is the mirror of `undoable()`. It declares that the contained writes
are truth acquired from outside the authored operation, rather than work the user
did:

```ts
import { external, signalTree, restoration } from '@signal-tree/kernel';

const rows = await api.getRows();
external(() => tree.$.rows.setAll(rows));
```

Without it, a refresh is indistinguishable from a user edit — it becomes an undo
step, and the next `undo()` reverts **the server's value** to a stale client one.

What it declares, on the two axes SignalTree keeps separate:

```text
origin         external    where the value came from
participation  realized    how it may take part in causal mechanisms
```

It classifies provenance; it does not buy exemption from consequences. External
truth still participates: it can make a pending transaction rollback unsafe (the
rollback is refused rather than discarding truth the transaction does not own),
and it is protected from being discarded by an `undo()` (`ST1034`). What it never
does is become an authored turn — no undo step, and no transaction contribution.

The scope is synchronous, and an async callback is refused with `ST1035` rather
than silently applying the server's value as authored work:

```ts
// ❌ throws ST1035 — the write lands after the classification is restored
external(async () => {
  const rows = await api.getRows();
  tree.$.rows.setAll(rows);
});

// ✅ acquire first, then classify the synchronous write
const rows = await api.getRows();
external(() => tree.$.rows.setAll(rows));
```

That is the shape acquisition actually has: fetching is asynchronous and belongs
to whatever owns the request — Angular's `resource()`, an RxJS pipeline, a plain
`fetch` — while applying the result is a single synchronous SignalTree event.

### SSR transfer vs storage restore

`deserialize()` accepts `{ transfer: true }` to mark a payload as an **SSR
transfer** rather than a storage restore. Both cross a process boundary, and
they want opposite answers from any marker that owns a live source:

```ts
// client bootstrap
const ts = inject(TransferState);
if (ts.hasKey(KEY)) tree.deserialize(ts.get(KEY, '{}'), { transfer: true });
```

A `localStorage` payload may be days old, so a loader-backed marker is right to
decline it and fetch something better. A server payload was fetched milliseconds
ago and the local loader has not run, so declining it ships the bytes into the
page and then refetches, wasting the transfer entirely. RFC 0014 records the
measurement behind that.

With `transfer: true`, a loader-backed `entityMap` accepts the
payload. It deliberately does not change two things: an in-flight `LOADING`
status is still normalised (a request in flight on the server is not in flight
here), and a form's `touched` is still not restored. Defaults to `false`. RFC 0014.

## When to use core only

Perfect for:

- ✅ Simple to medium applications
- ✅ Prototype and MVP development
- ✅ When bundle size is critical
- ✅ Learning signal-based state management
- ✅ Applications with basic state needs

Consider enhancers when you need:

- ⚡ Performance optimization (`batching()`)
- 🐛 Advanced debugging (`devTools()`)
- ↩️ Undo/redo (`restoration()`)

Consider separate packages when you need:

- 📝 Angular forms integration (`@signaltree/ng-forms`)

## Migration from NgRx

```typescript
// Step 1: Create parallel tree
const tree = signalTree(initialState);

// Step 2: Gradually migrate components
// Before (NgRx)
users$ = this.store.select(selectUsers);

// After (SignalTree)
users = this.tree.$.users;

// Step 3: Replace effects with manual async operations
// Before (NgRx)
loadUsers$ = createEffect(() =>
  this.actions$.pipe(
    ofType(loadUsers),
    switchMap(() => this.api.getUsers())
  )
);

// After (SignalTree Core)
async loadUsers() {
  try {
    const users = await api.getUsers();
    tree.$.users.set(users);
  } catch (error) {
    tree.$.error.set(error.message);
  }
}

// Or use manual async patterns
loadUsers = async () => {
  tree.$.loading.set(true);
  try {
    const users = await api.getUsers();
    tree.$.users.set(users);
  } catch (error) {
    tree.$.error.set(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    tree.$.loading.set(false);
  }
};
```

## Examples

### Simple Counter

```typescript
const counter = signalTree({ count: 0 });

// In component
@Component({
  template: ` <button (click)="increment()">{{ counter.$.count() }}</button> `,
})
class CounterComponent {
  counter = counter;

  increment() {
    this.counter.$.count.update((n) => n + 1);
  }
}
```

### User Management

```typescript
const userTree = signalTree({
  users: [] as User[],
  loading: false,
  error: null as string | null,
});

async function loadUsers() {
  userTree.$.loading.set(true);
  try {
    const users = await api.getUsers();
    userTree.$.users.set(users);
    userTree.$.error.set(null);
  } catch (error) {
    userTree.$.error.set(error instanceof Error ? error.message : 'Load failed');
  } finally {
    userTree.$.loading.set(false);
  }
}

function addUser(user: User) {
  userTree.$.users.update((users) => [...users, user]);
}

// In component
@Component({
  template: `
    @if (userTree.$.loading()) {
    <spinner />
    } @else { @for (user of userTree.$.users(); track user.id) {
    <user-card [user]="user" />
    } }
  `,
})
class UsersComponent {
  userTree = userTree;

  ngOnInit() {
    loadUsers();
  }

  addUser(userData: Partial<User>) {
    const newUser = { id: crypto.randomUUID(), ...userData } as User;
    addUser(newUser);
  }
}
```

## Available extension packages

All enhancers are now consolidated in the core package. The following features are available directly from `@signal-tree/kernel`:

### Performance & Optimization

<!-- measured: historical enhancer delta table; remeasure with `node tools/measure-enhancer-deltas.mjs` before publishing updated figures. -->

- **batching()** (+1.27KB gzipped) - Batch multiple updates for better performance

### Development Tools

<!-- measured: historical enhancer delta table; remeasure with `node tools/measure-enhancer-deltas.mjs` before publishing updated figures. -->

- **devTools()** (+2.49KB gzipped) - Development tools & Redux DevTools integration
- **restoration()** (+1.75KB gzipped) - Undo/redo functionality & state history

### Integration & Convenience

<!-- measured: historical enhancer delta table; remeasure with `node tools/measure-enhancer-deltas.mjs` before publishing updated figures. -->

- **serialization()** (+0.84KB gzipped) - State persistence & SSR support

### Quick Start with Extensions

All enhancers are now available from the core package:

```bash
# Install only the core package - all features included
npm install @signal-tree/kernel

# Common app APIs are available from @signal-tree/kernel:
import {
  signalTree,
  batching,
  devTools,
  restoration,
  persistence,
  entityMap,
} from '@signal-tree/kernel';
```

## Companion Packages

While `@signal-tree/kernel` includes comprehensive built-in enhancers for most use cases, the SignalTree ecosystem also provides specialized companion packages for specific needs:

## Package Selection Guide

**Start with just `@signal-tree/kernel`** - it includes comprehensive enhancers for most applications:

- Performance optimization (batching, memoization)
- Data management (entities, async operations)
- Development tools (devtools, time-travel)
- State persistence (serialization)

**Add companion packages when you need:**

| Package | When to Add | Bundle Impact |
| ------- | ----------- | ------------- |

**Installation:**

```bash
npm install @signal-tree/kernel
```

## Links

- [SignalTree Documentation](https://signaltree.io)
- [GitHub Repository](https://github.com/JBorgia/signal-tree)
- [NPM Package](https://www.npmjs.com/package/@signal-tree/kernel)
- [Interactive Examples](https://signaltree.io/examples)

## 📄 License

MIT License with AI Training Restriction - see the [LICENSE](../../LICENSE) file for details.

---

**Ready to get started?** This core package provides everything you need for most applications. Add extensions only when you need them! 🚀
