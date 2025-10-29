# Signal Tree Architecture Investigation

## Date: October 29, 2025

## Critical Discovery: Callable Syntax is a Build-Time Transform

### What I Got Wrong

I initially assumed that `tree.$.count(5)` was using a runtime Proxy pattern to enable callable WritableSignals. This was **completely incorrect**.

### The Truth

**SignalTree has TWO distinct APIs for updating state:**

1. **WritableSignals (leaf primitive values)**:

   - Use `.set(value)` or `.update(fn)` at runtime
   - Callable syntax `signal(value)` requires `@signaltree/callable-syntax` build transform
   - Without the transform, you MUST use `.set()` and `.update()`

2. **NodeAccessors (nested objects)**:
   - Always callable at runtime: `accessor(value)` or `accessor(updater)`
   - No transform needed - this is the default runtime behavior

### How the Callable Syntax Transform Works

```typescript
// Developer writes (with @signaltree/callable-syntax transform):
tree.$.count(5);
tree.$.items([1, 2, 3]);

// Transform converts to (zero runtime overhead):
tree.$.count.set(5);
tree.$.items.set([1, 2, 3]);

// Getters work unchanged (no transform needed):
const value = tree.$.count(); // Reads signal value
```

**Key insight**: The transform is purely a developer experience enhancement. It converts the function-call syntax to the standard Angular signal `.set()` method at **build time**. There is ZERO runtime cost.

### Why This Matters

**Without understanding this, I made several critical mistakes:**

1. ❌ All computed enhancer tests used `tree.$.value(10)` instead of `tree.$.value.set(10)`
2. ❌ Assumed signals weren't being updated when the issue was using the wrong API
3. ❌ Thought Angular's `computed()` wasn't tracking dependencies (it was!)
4. ❌ Believed there was a Proxy pattern issue (there isn't one for WritableSignals)

## Architecture Deep Dive

### No Proxies for WritableSignals

Looking at `signal-tree.ts` line 37:

```typescript
// Note: Callable syntax is supported via optional build-time transform only.
// No runtime Proxy wrapping is applied to writable signals to keep zero-cost semantics.
```

**WritableSignals are pure Angular signals** - no wrapping, no Proxies, zero overhead.

### NodeAccessors Use Functions, Not Proxies

NodeAccessors are **callable functions** created by `makeNodeAccessor()`:

```typescript
function makeNodeAccessor<T>(): NodeAccessor<T> {
  const accessor = function (arg?: unknown): T | void {
    if (arguments.length === 0) {
      return unwrap(accessor); // Read
    }
    if (typeof arg === 'function') {
      const updater = arg as (current: T) => T;
      const currentValue = unwrap(accessor) as T;
      const newValue = updater(currentValue);
      recursiveUpdate(accessor, newValue);
    } else {
      recursiveUpdate(accessor, arg); // Direct set
    }
  } as NodeAccessor<T>;

  return accessor;
}
```

**This is a plain function**, not a Proxy! It has signal properties attached to it via `Object.defineProperty()`.

### The tree.$ Structure

`tree.$` is just a **plain object** containing:

- **WritableSignals** for primitive values (created by Angular's `signal()`)
- **NodeAccessors** for nested objects (callable functions with signal properties)

```typescript
Object.defineProperty(tree, '$', { value: signalState, enumerable: false });
```

No Proxy involved!

## What Actually Happened in My Tests

### The Failing Test

```typescript
tree.$.firstName('Jane'); // ❌ WRONG - callable syntax without transform
expect(tree.$.firstName()).toBe('Jane'); // ❌ Failed - value didn't change
```

**Why it failed**: `tree.$.firstName` is a `WritableSignal`, not a `NodeAccessor`. Without the callable-syntax transform, calling it as a function does nothing. We must use `.set()`:

```typescript
tree.$.firstName.set('Jane'); // ✅ CORRECT
expect(tree.$.firstName()).toBe('Jane'); // ✅ Passes
```

### Why Angular computed() Works Perfectly

```typescript
const fullName = tree.computed(() => `${tree.$.firstName()} ${tree.$.lastName()}`);

tree.$.firstName.set('Jane');
expect(fullName()).toBe('Jane Doe'); // ✅ Works!
```

Angular's `computed()` **perfectly tracks SignalTree signals** because:

1. `tree.$.firstName()` reads the signal value
2. Angular's reactivity system tracks this read
3. When we call `.set()`, Angular detects the change
4. The computed automatically recomputes

**There is NO issue with Angular computed tracking SignalTree signals!**

## Architectural Patterns

### Pattern 1: Leaf Values (Primitives, Arrays, Built-in Objects)

```typescript
const tree = signalTree({
  count: 0, // WritableSignal<number>
  name: 'John', // WritableSignal<string>
  items: [1, 2, 3], // WritableSignal<number[]>
});

// Runtime API (no transform):
tree.$.count.set(5);
tree.$.name.update((n) => n.toUpperCase());
tree.$.items.set([...tree.$.items(), 4]);

// With callable-syntax transform:
tree.$.count(5);
tree.$.name((n) => n.toUpperCase());
tree.$.items([...tree.$.items(), 4]);
```

### Pattern 2: Nested Objects

```typescript
const tree = signalTree({
  user: {
    // NodeAccessor
    profile: {
      // NodeAccessor
      name: 'John', // WritableSignal<string>
      age: 30, // WritableSignal<number>
    },
  },
});

// NodeAccessors are always callable (no transform needed):
tree.$.user({ profile: { name: 'Jane', age: 25 } });
tree.$.user.profile({ name: 'Jane', age: 25 });

// Leaf signals need .set() without transform:
tree.$.user.profile.name.set('Jane');
tree.$.user.profile.age.set(25);

// Or with callable-syntax transform:
tree.$.user.profile.name('Jane');
tree.$.user.profile.age(25);
```

## Files Audited and Fixed

### ✅ Fixed: `computed-enhancer.spec.ts`

**Changes made:**

- `tree.$.firstName('Jane')` → `tree.$.firstName.set('Jane')`
- `tree.$.value(10)` → `tree.$.value.set(10)`
- `tree.$.items([...])` → `tree.$.items.set([...])`
- `tree.$.count(5)` → `tree.$.count.set(5)`
- `tree.$.numbers([...])` → `tree.$.numbers.set([...])`
- `tree.$.a(5)` → `tree.$.a.set(5)`
- `tree.$.c(10)` → `tree.$.c.set(10)`
- `tree.$.user.settings.theme('light')` → `tree.$.user.settings.theme.set('light')`

**Kept correct usage:**

- `tree.$.data({ nested: { value: 1 } })` ← NodeAccessor, always callable!

**Result:** All 13 computed enhancer tests now pass ✅

### ✅ Verified Correct: `computed-enhancer.ts`

The enhancer only **reads** from signals using `()`, which is always correct:

```typescript
const fullName = tree.computed(() => `${tree.$.firstName()} ${tree.$.lastName()}`);
```

No writes in the enhancer code, so no API issues.

### ⚠️ Documentation Needs Update

The JSDoc examples in `computed-enhancer.ts` show:

```typescript
tree.$.cart.items([{ price: 10, qty: 3 }]);
```

This assumes the callable-syntax transform is active. Should add a note or show both APIs.

## Remaining Work

### Files to Audit

1. ✅ `packages/core/src/lib/computed/computed-enhancer.ts` - Only reads, no issues
2. ✅ `packages/core/src/lib/computed/computed-enhancer.spec.ts` - Fixed all API misuse
3. ⏳ `packages/core/src/lib/batching/batching.spec.ts` - Likely has same issues
4. ⏳ Check all other test files for `tree.$.prop(value)` pattern
5. ⏳ Update JSDoc to clarify callable syntax requires transform
6. ⏳ Review README examples for consistency

### Documentation Updates Needed

1. Add note to computed enhancer JSDoc about callable syntax
2. Update examples to show both APIs (with/without transform)
3. Clarify in docs when `.set()` is required vs callable syntax
4. Add section explaining NodeAccessors vs WritableSignals

## Key Takeaways

### What SignalTree Actually Is

**SignalTree is NOT:**

- ❌ A Proxy-based state management system
- ❌ A wrapper around Angular signals that adds overhead
- ❌ Something that requires runtime callable syntax

**SignalTree IS:**

- ✅ A recursive type system for building signal trees
- ✅ Direct use of Angular's `signal()` for leaf values
- ✅ Callable functions (NodeAccessors) for nested objects
- ✅ Zero-cost abstraction with optional build-time transforms

### Why This Architecture is Brilliant

1. **Zero Runtime Overhead**: WritableSignals are pure Angular signals
2. **Type Safety**: Full TypeScript inference at unlimited depth
3. **Flexibility**: Works with or without the callable-syntax transform
4. **Composability**: NodeAccessors enable elegant nested updates
5. **Performance**: No Proxy overhead, direct signal access

### Lessons Learned

1. **Always read the documentation thoroughly** - The callable-syntax README was clear
2. **Don't assume patterns from other frameworks** - This isn't MobX or Zustand
3. **Test with the actual runtime behavior** - My debug test revealed the truth immediately
4. **Understand the type system vs runtime behavior** - TypeScript types don't equal runtime code
5. **Build-time transforms are powerful** - Zero-cost DX improvements

## Summary

The investigation revealed that SignalTree uses a **dual API pattern**:

- **NodeAccessors** (nested objects) are always callable at runtime
- **WritableSignals** (leaf values) require `.set()/.update()` unless the callable-syntax transform is active

This design provides:

- Maximum performance (zero overhead)
- Type safety (full inference)
- Developer experience (optional transforms)
- Framework integration (pure Angular signals)

All issues in my implementation were due to **incorrect API usage**, not architectural problems. The framework works exactly as designed.
