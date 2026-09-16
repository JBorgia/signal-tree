# `@signal-tree/react`

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

## Server Rendering

`useSignalTree()` reads the same canonical selector snapshot during server
rendering, so React SSR does not require a mirrored store or a separate server
adapter. Hydration should construct the tree from the same application state
used by the server render before mounting the client tree.

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

Construct an application-owned tree outside React rendering, then pass it through
props or ordinary React context. Components borrow that tree: unmounting a
consumer removes its subscription and must not destroy the shared owner.

```tsx
import { createRoot } from 'react-dom/client';
import { signalTree, useSignalTree } from '@signal-tree/react';

const tree = createStore();

function Count({ tree }: { tree: ReturnType<typeof createStore> }) {
  return <output>{useSignalTree(tree, ($) => $.count())}</output>;
}

function createStore() {
  return signalTree({ count: 0 });
}

const root = createRoot(document.getElementById('root')!);
root.render(<Count tree={tree} />);

// Called by the application owner when this application is disposed.
function disposeApp() {
  root.unmount();
  tree.destroy();
}
```

Do not construct resource-owning trees during component rendering, including
`useState`, `useMemo`, or `useRef` initialization. Render attempts can be
repeated or abandoned. An effect cleanup that destroys a borrowed tree is also
incorrect: StrictMode can replay effects while the application still owns it.
For a bounded workflow, create the tree at its explicit owner boundary and
destroy it after its consumers have unmounted.

For SSR, create one tree per request and release it when that render finishes:

```tsx
import { renderToString } from 'react-dom/server';

function renderRequest(count: number) {
  const tree = signalTree({ count });
  try {
    return renderToString(<Count tree={tree} />);
  } finally {
    tree.destroy();
  }
}
```

A module-level server tree would share state between requests. For streaming
SSR, retain the request owner until rendering completes or aborts; returning a
stream is not the end of its lifetime. Hydration must start with the same state
that produced the server output. Dropping the last reference does not promptly
release tree resources; bounded owners must call `destroy()`.

React Native validation, custom equality, shared cross-component subscriptions,
and first-party memoized selectors are not part of the initial surface.
