# Performance Patterns & Guidance

Practical patterns for avoiding common performance pitfalls in SignalTree + Angular apps.

## Batching: When and Why

Use `batching()` when you make **multiple writes in one synchronous turn** and want to consolidate change notifications.

```typescript
// Without batching: each set() triggers a notification
tree.$.firstName.set('Alice');
tree.$.lastName.set('Smith');
tree.$.age.set(30);
// → 3 notifications

// With batching: notifications are coalesced
const tree = signalTree(state, { enhancers: [batching()] });
tree.$.firstName.set('Alice');
tree.$.lastName.set('Smith');
tree.$.age.set(30);
// → 1 notification (coalesced)
```

**Don't use batching** if you only write one field at a time. The enhancer adds overhead per write.

## Memoization: Use Angular's `computed()`

Angular's `computed()` already memoizes by reference equality. In 9.0.1 the `memoization()` enhancer was removed — `computed()` covers every common case with zero additional runtime cost and smaller bundles.

```typescript
import { computed } from '@angular/core';

const totalItems = computed(() => tree.$.items().length);
const activeUsers = computed(() => tree.$.users().filter((u) => u.active));
```

If you need value-equality semantics (e.g. API responses that rebuild the same object), compare inside the consumer or gate updates at the writer (`set`/`update`) rather than re-adding a cache layer.

## Selector Sharing

Avoid creating identical `computed()` expressions across multiple components. Share selectors:

```typescript
// selectors/user.selectors.ts
export const selectActiveUsers = (tree: AppTree) => tree.$.users.where(isActive);
```

Why: Reuse avoids creating many `computed()` instances for the same derived query. `EntitySignal.where(predicate)` caches by function reference — named predicates benefit from this caching; inline arrow functions do not.

## EntitySignal Predicate Caching

```typescript
const isActive = (u: User) => u.active;
const s1 = tree.$.users.where(isActive); // cached
const s2 = tree.$.users.where(isActive); // same Signal instance

// ❌ Not cached — new function reference each time
const s3 = tree.$.users.where((u) => u.active);
```

## Anti-Patterns to Avoid

### Synchronous tight loops

```typescript
// ❌ Don't benchmark like this — it's not how Angular apps behave
for (let i = 0; i < 100000; i++) {
  tree.$.counter.set(i);
}
```

Angular's microtask-based change detection already batches many updates in real apps.

### Thousands of subscribers to one node

Split hot state into separate nodes. Use shared selectors instead of per-component inline computed expressions. Virtualize large lists.

## Incremental materialization (there are no lazy trees)

Lazy proxy-based signal CREATION — `useLazySignals`, `TreeConfig.lazy` and the
`@signaltree/core/lazy` subpath — was removed in 15.0. It had been unreachable
since the subpath was withdrawn from the published surface, and its benefit was
never measured.

What does the work is incremental materialization, on the default path and with
numbers behind it. Every node memoises its materialization, so a read rebuilds
only the subtrees a write actually touched and clean ones come back by
reference:

```text
grid 100x100 (10k leaves)   all 1807.8us | 1 leaf 149.2us | none 0.044us
grid 20x1000 (20k leaves)   all 5066.4us | 1 leaf 311.6us | none 0.045us
```

That is lazy READING, and it needs no configuration. Source:
`packages/core/src/lib/incremental-materialization.spec.ts`.

## Diagnostics

The demo app supports `?quickRun` URL parameter to reduce iterations for CI smoke tests. Do not use for production-quality measurements.
