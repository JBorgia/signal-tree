# @signal-tree/react

React observation for SignalTree. It connects React's external-store lifecycle
to canonical SignalTree reads without copying state into React.

## Semantic Guidance

The canonical v15 model and composition guidance ships with this package as
[llms.txt](llms.txt). It explains the React facade rule, `link()`
relationships, persistence composition, and causal explanations as projections
rather than retained kernel facts.

## Install

```bash
npm install @signal-tree/react
```

React 18 or 19 is required as a peer dependency. `@signal-tree/react` installs
the framework-neutral kernel as its dependency, so React applications should
construct and enhance trees through this package:

```tsx
import { entityMap, signalTree, useSignalTree } from '@signal-tree/react';

const tree = signalTree({ orders: entityMap<{ id: string; status: string }>() });
```

Framework-neutral libraries may import from `@signal-tree/kernel` directly.

## Observe A Projection

```tsx
function OrderStatus({ tree, orderId }) {
  const status = useSignalTree(tree, ($) => $.orders.byIdOrFail(orderId).status());

  return <output>{status}</output>;
}
```

The tree determines wake scope. The selector determines snapshot scope. Owner
invalidation causes React to reread the selector; it does not force whole-tree
materialization.

Whole-root observation is the same operation with a whole-root projection:

```tsx
const state = useSignalTree(tree, ($) => $());
```

Use whole-root projection only when the component needs whole-root truth.

## Selector Contract

Selectors read synchronously from the supplied root location and must return an
`Object.is`-stable value while their selected truth is unchanged. Scalars,
canonical entity values, and the canonical whole-root snapshot naturally satisfy
this requirement.

An allocating selector does not:

```tsx
// Incorrect: allocates a new object every time React asks for a snapshot.
useSignalTree(tree, ($) => ({ count: $.count() }));
```

Memoize allocating composite results outside the hook. The initial React package
does not define custom equality or selector-memoization semantics.

Selectors may close over ordinary parameters such as an ID. Reading canonical
state from another tree inside the selector is outside contract because only the
supplied owner establishes invalidation scope.

A selector may close over a retained location from the supplied owner, such as
an entity facade held across removal/reactivation. That location remains inside
the same invalidation domain; the supplied owner must cover every canonical read
that can affect the selector result.

## Ownership

SignalTree remains the only state authority. This package owns subscription,
cleanup, and React snapshot observation. It does not mirror state, expose write
APIs, own the tree lifecycle, or change SignalTree's causal semantics.

SSR/hydration policy, React Native validation, custom equality, shared
cross-component subscriptions, and first-party memoized selectors are not part
of the initial surface.
