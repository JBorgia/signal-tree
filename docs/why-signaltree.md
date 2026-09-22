# Why SignalTree?

## The short answer

Use SignalTree when your framework's own signals stop being enough: you have
substantial entity state, you need reliable transactions or undo, you need to
tell your own writes apart from updates arriving from outside, or you want the
same state behaviour across more than one framework.

**For a small component or a simple application, your framework's built-in
state is probably all you need.** SignalTree is not trying to be the default
store for everything, and adopting it for a handful of local values will cost
you more than it returns.

## What it looks like

```typescript
import { signalTree, entityMap, restoration, undoable } from '@signal-tree/angular';

type Todo = { id: string; title: string; done: boolean };

const store = signalTree(
  {
    todos: entityMap<Todo>(),
    filter: 'all',
  },
  { enhancers: [restoration()] }
);

// A field reads and writes at the same typed path.
store.$.filter();
store.$.filter.set('open');

// A collection holds records by ID.
store.$.todos.addOne({ id: 't1', title: 'Write it down', done: false });
store.$.todos.byId('t1')?.();

// Mark what a user should be able to take back.
undoable(() => {
  store.$.todos.updateOne('t1', { title: 'Write it down properly' });
});

store.undo();

store.destroy();
```

That is the whole everyday surface: fields, collections, and marking the
operations a user can reverse.

## When it earns its place

**Substantial entity state.** Collections of records that several parts of the
UI read and edit, where you want to bind to one record's fields rather than
re-reading the whole list on every change.

**Undo that survives reality.** Undo in most stores replays a snapshot. If a
server update arrived in between, replaying the snapshot quietly discards it.
SignalTree's undo refuses the whole operation instead of overwriting a newer
external value, and reviving a record revives *that* record rather than a
lookalike that happens to share its ID.

**Telling your writes apart from everyone else's.** A user edit and a server
reconciliation are both writes. Most stores cannot distinguish them, so undo,
optimistic updates and conflict handling all become application code.
SignalTree knows which is which.

**Transactions with real rollback.** Speculative state is visible immediately;
a rollback compensates through the references your UI already holds.

**More than one framework.** The same semantics in Angular, React, Vue and
Solid, each using its own native reactivity rather than a shared wrapper.

## When it does not

- A few local values in one component. Use `signal()`, `ref()`, `useState()`.
- You need loading, caching, request dedup or collaborative merge. Those remain
  application concerns; SignalTree deliberately does not own them.
- You only ever read whole collections. Reading every record after each change
  does different work from reading one field — [measure the way your app uses
  state](https://signaltree.io/benchmarks).
- You want undo everywhere for free. Undo applies only to operations you mark
  with `undoable()`, and requires the `restoration()` enhancer.

## What it costs

SignalTree is not the smallest option and does not claim to be. The kernel is
around 10 KB gzipped before your state; each framework package adds a small
amount on top. The [CHANGELOG](../CHANGELOG.md) records size changes per
release, including regressions.

## Next

- [Glossary](glossary.md) — the vocabulary, in three levels
- [Support policy](support-policy.md) — versioning commitment and framework maturity
- [Comparison with native signals](compare/native-signals.md)
