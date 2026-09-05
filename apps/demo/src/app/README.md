# SignalTree Examples

This directory contains comprehensive examples demonstrating SignalTree usage patterns.

## Files Overview

### 📁 **Core Examples**

#### `standard-syntax-examples.ts`

The one syntax reference. Every write goes through the API that actually works:

- `tree.$.prop.set('value')` — replace an Angular leaf
- `tree.$.prop.update(fn)` — derive an Angular leaf
- `tree.$.branch({ ... })` — replace a complete branch value
- `tree.$({ ... })` — replace the complete root value
- `tree.$(current => ({ ...current, changed }))` — derive the next root value

Nothing to install; nothing to configure.

> **Root and branch calls are kernel behavior.** Terminal leaves use the
> application facade's native carrier: Angular `Signal`s, Vue refs, and kernel
> locations. This is unrelated to the retired `@signaltree/callable-syntax`
> build transform.

Use `leaf(value)` when a plain object should remain terminal instead of becoming
a branch, or when a callable is data rather than an updater:

```typescript
const tree = signalTree({
  range: leaf({ start: 0, end: 10 }),
  callback: leaf((value: number) => console.log(value)),
});

tree.$.range.set({ start: 5, end: 15 });
tree.$.callback.set((value) => console.info(value));
```

## Example Categories

The file covers these patterns:

### 1. **Basic Operations**

- Direct value updates
- Functional updates
- Getter operations
- Type-safe operations

### 2. **Nested Object Operations**

- Deep property access
- Nested object updates
- Complex object transformations
- Multi-level state management

### 3. **Array Operations**

- Adding/removing items
- Mapping transformations
- Filtering operations
- Complex array manipulations

### 4. **Conditional and Complex Updates**

- State machine patterns
- Loading/error handling
- Filter management
- Conditional logic

### 5. **Working with Optional Values**

- Nullable types
- Optional properties
- Default value handling
- Type guards

### 6. **Performance and Batching**

- Multiple rapid updates
- Analytics patterns
- Event tracking
- Bulk operations

## Usage

```bash
npx ts-node apps/demo/src/app/sanity-checks/standard-syntax-examples.ts
```

## What is callable, and what is not

The tree is a controller. Root and object branches use the kernel's callable
whole-value grammar. `leaf(value)` controls topology; terminal values use the
active facade's native leaf carrier.

| Target     | Canonical shape             | Read             | Write                                             |
| ---------- | --------------------------- | ---------------- | ------------------------------------------------- |
| **Root**   | root location               | `tree.$()`       | `tree.$(value)` / `tree.$(fn)`                    |
| **Branch** | branch location             | `tree.$.user()`  | `tree.$.user(value)` / `tree.$.user(fn)`          |
| **Leaf**   | Angular `WritableSignal<T>` | `tree.$.count()` | `tree.$.count.set(5)` / `tree.$.count.update(fn)` |

Calling a root or branch with no argument reads it; a complete value replaces
it, and an updater derives the next value. Angular terminal leaves are already
native `WritableSignal`s. Callable data needs `leaf()` only when declaring
topology; `.set(callable)` is unambiguous at write time.
