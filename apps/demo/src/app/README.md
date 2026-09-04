# SignalTree Examples

This directory contains comprehensive examples demonstrating SignalTree usage patterns.

## Files Overview

### 📁 **Core Examples**

#### `standard-syntax-examples.ts`

The one syntax reference. Every write goes through the API that actually works:

- `tree.$.prop('value')` — replace a leaf
- `tree.$.prop(fn)` — derive a leaf
- `tree.$.branch({ ... })` — replace a complete branch value
- `tree.$({ ... })` — replace the complete root value
- `tree.$(current => ({ ...current, changed }))` — derive the next root value

Nothing to install; nothing to configure.

> **v15 callable locations are kernel behavior.** This is not the retired
> `@signaltree/callable-syntax` build transform. The same runtime object reads,
> replaces, and derives without framework-specific write methods.

Use `leaf(value)` when a plain object should remain terminal instead of becoming
a branch, or when a callable is data rather than an updater:

```typescript
const tree = signalTree({
  range: leaf({ start: 0, end: 10 }),
  callback: leaf((value: number) => console.log(value)),
});

tree.$.range({ start: 5, end: 15 });
tree.$.callback(leaf((value) => console.info(value)));
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

This is the whole rule: the tree is a controller and every state location uses
the same callable grammar. `leaf(value)` controls topology; framework-native
signals are explicit adapter views.

| Target     | Canonical shape        | Read             | Write                                    |
| ---------- | ---------------------- | ---------------- | ---------------------------------------- |
| **Root**   | root location          | `tree.$()`       | `tree.$(value)` / `tree.$(fn)`           |
| **Branch** | branch location        | `tree.$.user()`  | `tree.$.user(value)` / `tree.$.user(fn)` |
| **Leaf**   | terminal `Location<T>` | `tree.$.count()` | `tree.$.count(5)` / `tree.$.count(fn)`   |

Calling a location with no argument reads it. Calling it with a complete value
replaces it. Calling it with an updater derives the next value. A callable value
is wrapped for that invocation as `location(leaf(callable))`, so argument shape
never has to guess intent. Angular code that specifically needs a
`WritableSignal` creates an explicit `toWritableSignal(location)` view.
