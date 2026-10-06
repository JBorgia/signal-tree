# `@signal-tree/kernel`

Framework-neutral SignalTree state: fields and entity collections,
transactions and rollback, undo, external updates through `link()`, batching,
and DevTools.

This is the package framework adapters are built on, so it also documents the
advanced vocabulary (causal turns, restoration designation, the observation
seam). Application developers usually need only the terms in the
[glossary](../../docs/glossary.md)'s first table.

Angular applications should construct trees through `@signal-tree/angular`
(requires Angular 20, 21, or 22 — see `peerDependencies` in
[`packages/angular/package.json`](../angular/package.json)).
React applications should construct and observe trees through
`@signal-tree/react`. Use the kernel directly for framework-neutral runtimes,
libraries, and tests. Framework packages forward this neutral surface by
identity, so an application should use its framework package as its one
SignalTree import root.

## Semantic Guidance

The canonical v15 model and composition guidance ships with this package as
[llms.txt](llms.txt). It explains the facade rule, `link()` relationships,
persistence composition, and why human-readable causal explanations are
projections rather than retained kernel facts.

## Install

```bash
npm install @signal-tree/kernel
```

## Create A Tree

```typescript
import { signalTree } from '@signal-tree/kernel';

const tree = signalTree({
  count: 0,
  user: {
    name: 'Ada',
    active: true,
  },
});
```

`$` is the state facade. Root, branch, and terminal locations support whole-value
reads, replacements, and updater functions. A value call is never a patch;
derive a patched value with an updater.

```typescript
tree.$();
tree.$.user();
tree.$.user({ name: 'Grace', active: true });
tree.$.user((user) => ({ ...user, active: false }));

tree.$.count();
tree.$.count(1);
tree.$.count((count) => count + 1);
```

The state literal defines the public paths. There are no actions, reducers, or
selectors required for ordinary reads and writes.

## Terminal Values

A plain object normally becomes a branch whose properties are locations. Use
`leaf(value)` when an object should remain one atomic value, or when a callable
is state rather than topology:

```typescript
import { leaf, signalTree } from '@signal-tree/kernel';

const tree = signalTree({
  user: { name: 'Ada' },
  bounds: leaf({ min: 0, max: 100 }),
  handler: leaf((value: number) => console.log(value)),
});

tree.$.user.name('Grace');
tree.$.bounds({ min: 10, max: 90 });
tree.$.handler(leaf((value) => persist(value)));
```

At construction, `leaf(object)` stops dot-path expansion. At invocation,
`location(leaf(callable))` distinguishes callable data from the updater grammar.
The wrapper never enters canonical state, snapshots, persistence, restoration,
or links; reads return the original raw value by identity.

Change an atomic value by replacing it through its location. Mutating an object,
array, Map or Set returned by a read is not a recorded write. Restoration records
replacement writes; it does not provide deep-copy isolation for mutable payloads.

## Construction

State, capabilities, and derived values are declared in one construction call:

```typescript
const tree = signalTree(initialState, {
  enhancers: [batching(), restoration(), devTools()],
  derived: ($) => ({
    // Return realization-native computed values here.
  }),
});
```

There is no late `.with()` phase or fluent `.derived()` chain. SignalTree
validates the complete enhancer set before construction and resolves declared
capability requirements from that set.

The neutral kernel does not own framework lifecycle, rendering, dependency
injection, or effect scheduling. Framework packages provide those realizations.

## EntityMap

`entityMap()` creates a normalized collection at any state path.

```typescript
import { entityMap, signalTree } from '@signal-tree/kernel';

type Product = {
  id: number;
  name: string;
  inStock: boolean;
};

const tree = signalTree({
  catalog: {
    products: entityMap<Product, number>({
      selectId: (product) => product.id,
    }),
  },
});

const products = tree.$.catalog.products;

products.addMany([
  { id: 1, name: 'Laptop', inStock: true },
  { id: 2, name: 'Chair', inStock: false },
]);

products.all();
products.ids();
products.count();
products.empty();
products.asMap();
products.has(1)();
products.where((product) => product.inStock)();
products.find((product) => product.name === 'Laptop')();

products.byId(1)?.();
products.byIdOrFail(1)();
products.updateOne(1, { inStock: false });
products.replaceOne(1, { id: 1, name: 'Laptop', inStock: true });
products.upsertOne({ id: 3, name: 'Desk', inStock: true });
products.removeOne(2);
```

EntityMap preserves collection order and stable entity handles across ordinary
updates. `changeId(from, to)` adopts a new key without remove-and-add identity
loss. Keep each entity fact under one EntityMap authority and derive selections
rather than duplicating entity objects elsewhere.

## Read-Only Views

`asReadonly(tree)` narrows the same runtime object to a read-only type. It does
not allocate a second store or create a runtime security boundary.

```typescript
import { asReadonly } from '@signal-tree/kernel';

const reader = asReadonly(tree);
reader.$.count();
reader.$.catalog.products.byId(1)?.();
```

Location write overloads and EntityMap mutation methods are absent from the read-only type.
Use this for consumers that should receive reads while an application-owned Ops
service retains the writable tree.

## Built-In Enhancers

### `batching()`

Coalesces notifications for grouped writes and adds the batching capability.

```typescript
const tree = signalTree(state, {
  enhancers: [batching()],
});
```

### `restoration()`

Retains designated causal turns for undo and redo.

```typescript
import { restoration, signalTree, undoable } from '@signal-tree/kernel';

const tree = signalTree(
  { count: 0 },
  {
    enhancers: [restoration({ maxHistorySize: 50 })],
  }
);

// Connect these handlers to separate user actions.
const actions = {
  increment: () => undoable(() => tree.$.count((count) => count + 1)),
  undo: () => tree.undo(),
  redo: () => tree.redo(),
};
```

`undoable()` designates the current synchronous authored turn. It is not an async
scope and does not create a separate state authority. History is recorded when
that turn settles: call undo from a later user action, not immediately after
`undoable()` in the same synchronous function. The tree owner calls `destroy()`
when this store is no longer needed.

`getCurrentIndex()` is the latest applied entry and follows `undo()` and
`redo()` as well as `jumpTo()`; the steps back are `getCurrentIndex() + 1`.
An ordinary (not `undoable()`) write after an undoable one does not remove its
undo: `undo()` restores the turn's own pre-image over it and `redo()` its
after-image. A row the turn added that an ordinary write removed stays absent on
undo; a row it edited that an ordinary write removed comes back as it stood,
with the turn's fields set back (a confirmed transaction that is not undoable
counts as an ordinary write). Where putting a row back would displace any other
row at the same key, or the row was removed by external or realized truth
(`external()`, a Link inbound write), undo or redo refuses with ST1034 and
changes nothing. The row comes back alone: a referrer in another collection
removed with it stays removed.
Undo, redo, `jumpTo()` and transaction rollback restore recorded values without
running a collection's interceptors; taps still fire for the changes they apply
(`onAdd`, `onRemove`, `onUpdate`).

#### Locations an omission has hidden

A whole-value write that leaves out a key omits that member: it and everything
under it are absent, even though their storage is retained. Reading a location
under an omitted member gives `undefined`, through a handle held from before
the omission too, and held consumers follow the omission and a later re-add.
Writing such a location re-adds its path: after `a` is omitted,
`$.a.b.keep(9)` makes `a` equal `{ b: { keep: 9 } }`, and `a`'s other members
stay absent. An updater there receives `undefined`. Undo, redo, `jumpTo()` and
`rollback()` of that write make the path absent again. Supplying an omitted
key as `undefined` in a whole value leaves it absent.

An entity collection under an omitted member, or omitted itself, follows the
same rules. It reads as an absent, empty collection: `all()` is `[]`,
`byId()` is `undefined`, `count()` is `0`, and held row nodes read
`undefined`. A write that adds rows (`addOne()`, `setAll()`, `upsertOne()`,
`clear()` and the rest) re-adds the path carrying only the written rows; the
retained rows never come back. A write that names a row (`updateOne()`,
`removeOne()`, `changeId()` and the rest) throws "Entity with id ... not
found", as on an empty collection, and changes nothing. Undo, redo,
`jumpTo()` and `rollback()` of a re-adding write make the collection absent
again. This holds in a tree whose root holds only collections too.

Some details of that rule:
- **Retained rows are removed silently.** A re-adding write removes the
  retained rows before it adds its own. Taps do not see that removal, but
  history records it, so a reversal restores the rows.
- **Invalid input changes nothing.** A re-adding write whose input makes it
  throw (a missing row, a `selectId` that throws, or an id given twice to a
  strict `addMany()` or `prependMany()`) throws before anything changes.
- **A blocked write still removes the retained rows.** An interceptor that
  blocks the write's own rows runs after the retained rows were removed. The
  collection stays absent and empty, and history holds the removal. Undoing
  it restores the rows and re-adds the path to the collection, as undoing
  any write under an omitted member does.
- **Link and path observers see what the tree exposes.** A Link endpoint
  whose location is absent receives `undefined` (`[]` for a collection), and
  a re-add sends what the location then reads. Undo, redo, `jumpTo()` and
  `rollback()` write an absent location's retained storage without
  publishing it.
- **The selection is kept.** `activeId()` keeps its value and `activeEntity()`
  reads `undefined`. A re-adding write clears the selection, as `clear()`
  does.
- **Taps during a reversal see physical rows.** While undo, redo, `jumpTo()`
  or `rollback()` writes an absent collection's retained rows, a tap on it
  that calls `byId()` sees those rows. Its projections (`all()`, `count()`,
  `has()`) still read it absent.
- **Writes from inside a whole value or a reversal of the same tree.** The
  whole value or reversal decides that tree's membership. So a tap or sync
  effect that runs during it and writes an absent location of that same tree
  does not re-add its path. The write goes to retained storage and stays
  invisible; for a collection, its other retained rows are not removed
  first. A write to another tree is an ordinary write.

Undo, redo and `jumpTo()` treat a location under an omitted member like this:

- **Omitted by external truth** (inside `external()`): the reversal refuses
  with ST1034, names the omitted member and the location, and changes
  nothing.
- **Omitted by an ordinary write**: the reversal restores its own locations
  over that write, as it would over any later ordinary write. It re-adds
  only the members on the way to those locations; every other member the
  omission removed stays absent. Retained storage never supplies a value.
- **Not re-addable** (an omitted entity collection, for example): the
  reversal refuses and says why.
- **Pending work under it**: re-adding a member that a pending transaction
  wrote under refuses with ST1034 until that transaction settles.

An entity collection that the reversed operation omitted or re-added, itself
or inside a branch, is restored: undo, redo, `jumpTo()` and `rollback()` put
back its membership, and its rows are the ones it held when it was hidden.
If something other than the reversal changed those rows while it was hidden
(a write through a handle held on it), the reversal refuses, names the
collection and changes nothing. The same holds for a collection inside a
branch that a reversal re-adds for an earlier write.

A pending transaction's `rollback()` reverses its writes even when a later
omission has hidden them: under an omitted branch it restores the retained
storage and leaves the branch absent. Nothing a rejected transaction wrote can
come back later, whether through undo, redo, `jumpTo()` or a re-add. Rollback
order can matter here; see [Lifetime](#lifetime).

An undo refused for a reason found before anything is applied ("Unsupported
scoped undo effect at ...") reports `refused` to the restoration reader, as
ST1034 does; the message is unchanged.

### `transactions()`

Adds an explicit pending operation that can be confirmed or rolled back. Use it
for pending authority, not as a synonym for retained undo history.

Confirmed records are retained only while a live obligation needs them — a
confirmed turn is released once no older pending turn could still consult it.
Diagnostic history is a separate, explicitly bounded facility:

```ts
transactions({ history: { retain: 100 } });
```

Without it, `confirmedTurnReader` reports `retention.truncated === true` with no
turns. That is deliberately distinguishable from "nothing happened", which
reports `truncated === false`.

### `devTools()`

Connects the tree to Redux DevTools and adds the typed debug-session surface.

```typescript
const tree = signalTree(state, {
  enhancers: [devTools({ name: 'Application' })],
});

const session = tree.exportDebugSession();
```

## External Truth

`external()` classifies synchronous writes whose authoritative decision came
from outside the current authored operation. Restoration observes those writes
but does not claim them as undoable authored work.

```typescript
import { external } from '@signal-tree/kernel';

const rows = await api.list();
external(() => tree.$.rows.setAll(rows));
```

Acquire data first. Passing an async callback to `external()` is invalid because
the classification scope ends when the callback returns.

## Links

`link()` expresses a live relationship between state locations while preserving
the kernel's authority and causal-turn semantics. Use it for genuine ongoing
synchronization, not as a request wrapper or migration bridge.

## Errors

Observe library-reported diagnostics through `onTreeError()`:

```typescript
import { onTreeError } from '@signal-tree/kernel';

const stop = onTreeError((event) => {
  console.error(event.operation, event.treeId, event.path, event.error);
});

stop();
```

Applications observe errors; reporting remains owned by the library.

## Persistence, Async Work, And Forms

SignalTree 15 does not publish persistence, serialization, async-request, or
forms capabilities. Applications own storage formats, migrations, fetching,
cancellation, retries, validation, and form control behavior.

Write resolved external data through ordinary paths or EntityMap, using
`external()` when restoration must not claim the write. Use framework effects or
application services for storage synchronization.

## Lifetime

A tree owns runtime resources until `destroy()` releases them.

```typescript
const tree = signalTree({ value: 1 });

try {
  tree.$.value(2);
} finally {
  tree.destroy();
}
```

Application-root stores may live for the process lifetime. Component, route,
SSR-request, test, and temporary-workflow trees have bounded owners and must be
destroyed at that boundary. Dropping the last local reference is not prompt
resource reclamation.

Angular's `defineStore` binds tree destruction to `DestroyRef`. Direct kernel
construction remains the caller's responsibility.

Failed pending-transaction rollback throws `SignalTreeRollbackError`, whose
stable `code` and structured `cause` distinguish refusal from application
errors.

An explicit refusal changes no state, retires no pending authority, and leaves the
transaction **pending**, so `confirm()` and a retried `rollback()` both remain
available. Reversing an older transaction while a newer overlapping one is
still open refuses (`cause.kind === 'later-pending-dependency'`); settle the
newer one first. Existing v15 behavior nevertheless releases the commit scope
and its deferred consequences on refusal; pending does not mean persistence is
still deferred. Since 15.4.2, a pending-created or pending-rekeyed row that
settled later work removed no longer blocks rollback; the rest of the turn
reverses and the row stays absent. While the removing transaction is open,
rollback refuses with `later-pending-dependency`. Since 15.4.4 the same holds
for a field write to an existing row that settled later work removed. Deleting
an entity is still not a general way to make rollback retryable: a
pending-created row later work edited and kept keeps refusing, and a pending
removal or rename whose key later work gave to another row refuses as a
dependency while that row stands or undo history can restore it. An order change
(`setAll` reordering rows, an overwriting `prependMany`) refuses as a dependency
while later work on the collection stands.

After a rejection, no `undo()`, `redo()` or `jumpTo()` reinstates a value or row
that only the rejected transaction wrote (15.4.4): undo of a later write restores
what was there before the transaction.

Since 15.4.4 the same retryable refusal (`later-pending-dependency`) applies
when the newer pending transaction omitted, or re-added, a plain branch that
encloses a location the older one wrote. The newer transaction's before-image
of that branch holds the older value, so reversing the older one first would
let the newer one's rollback bring the rejected value back. Once the newer one
settles (confirmed or rolled back), retrying the older rollback succeeds.

**15.3.1 automatic-abort exception:** if the callback throws or a
post-callback step fails before `transaction()` returns its handle, SignalTree
attempts rollback. If that automatic rollback is refused, the surviving writes
are recorded as committed, eligible undo history is retained, durable
consequences are released, and `transaction()` throws `SignalTreeRollbackError`.
There is no recovery handle on this v15 path. A thrown error therefore does not
guarantee that the writes were undone. This exception does not apply to an
explicit `pending.rollback()` call. Successful automatic rollback reverses
recorded writes and discards deferred consequences. Never blindly retry the
entire operation after an error or use undo for request reconciliation.
Recoverable pending refusal is a v16 target, not current API. See
[Transaction failure policy and the 15.3.1 failure inventory](https://github.com/JBorgia/signal-tree/blob/v15.3.1/docs/guides/transaction-failures-v15.md)
for the historical defect inventory and bounded observer-containment rule,
including Vue mode differences and enclosing Solid batches. Consult the
[15.4.0 changelog](https://github.com/JBorgia/signal-tree/blob/v15.4.0/CHANGELOG.md)
for subsequent repairs.

## Exports

The package publishes three code entry points:

- `@signal-tree/kernel`
- `@signal-tree/kernel/adapter`
- `@signal-tree/kernel/internals` — supported tooling observation seam

The adapter entry point is the framework-neutral observation SDK. It is not a
compatibility layer or an application convenience surface.

- `createSignalTreeFactory(observation)` binds framework observation to tree
  construction.
- `isConstructionBranch(value)` identifies recursively traversed construction
  definitions, excluding explicit leaves, markers and terminal containers.
  Framework facades use this boundary for their own input validation; native
  reactive identity checks remain framework-owned.
- `isNodeAccessor(value)` distinguishes a root or branch accessor from a
  terminal location when a realization must route framework integration.
- `replaceLocation(location, value)` applies raw replacement ingress when the
  caller already knows the operation semantics, including callable state; it
  does not re-enter the authored updater grammar.
- `observeOwnerInvalidation(owner, callback)` wakes a framework observer so it
  can reread canonical truth.
- `readCanonicalSnapshot(owner)` reads the owner-qualified whole-tree snapshot.
- `withRestorationDesignation(callback)` identifies framework-originated user
  writes that are eligible for restoration.

An `ObservationAdapter` supplies dependency tokens and
`runInvalidationGroup(run)` so transactions and restoration can apply all
changes before framework observers are notified. It never owns or mirrors
location state.

An adapter may also supply an epoch, which lets a framework invalidate a whole
subject through one native primitive instead of one carrier per field:

- `createEpoch()` returns an `EpochHandle` — an opaque callable the adapter
  owns. The kernel stores it, passes it back, and never writes through it or
  inspects what is inside.
- `advanceEpoch(epoch)` marks that handle stale. The kernel calls this; the
  adapter decides what the framework does about it.

The two are a pair. An adapter that supplies one without the other does not
receive an epoch at all, because a handle the kernel cannot advance would
silently stop invalidating. `EpochHandle` is exported from
`@signal-tree/kernel/adapter` alongside `ObservationAdapter` and
`ObservationToken`.

## Redux DevTools collection display

The optional `entityKeyedView` setting adds an id-keyed `byId` view alongside
an EntityMap's `all` array in Redux DevTools snapshots. It is off by default
because it increases payload size. Keys come from `id`, `key`, or `uuid`; the
keyed view is omitted if any included entity lacks a key. This is display data:
the existing `all` representation and time-travel hydration remain unchanged.

## Tooling observation

**In 15.4.0:** pending transaction lifecycle, restoration lineage,
entity membership and Link activity are available through four read-only readers:
`transactionLifecycleReader`, `restorationReader`, `entityMembershipReader` and
`linkStateReader`. `stateLocationReader` maps a recorded effect or write to its
current structured location. Confirmed-turn effects add `fieldSegments` for entity
fields and `plainBranchMembership` (presence before/after) for plain optional
members, so an omission is distinguishable from a member set to `undefined`.
See the [15.4.0 runtime observation guide](https://github.com/JBorgia/signal-tree/blob/v15.4.0/docs/guides/runtime-observation.md).
These exports supply facts to tooling; they do not retain a diagnostic history
or confirm backend acceptance.

`@signal-tree/kernel/internals` is a supported observation seam for tools such as
Studio. Application code continues to use its framework facade; these exports
are not additions to the kernel root API.

- `treeRuntimeId` exposes runtime identity for equality and map keys, never a persisted identity.
- `treeCapabilities` reports construction capabilities; an empty list is a bare tree.
- `confirmedTurnReader` reads retained committed consequences without installing history. Its `ConfirmedTurnReader`, `ConfirmedTurnSnapshot`, `ConfirmedTurnView`, `ConfirmedTurnEffectView`, `ConfirmedTurnEffectKind` and `ConfirmedTurnRetention` types describe that window, including retention limits. A tree that has not asked for diagnostic history retains nothing for the reader, and `ConfirmedTurnRetention.truncated` says so rather than presenting an empty window as a complete one — it is asserted by the transaction authority, never inferred from gaps in turn ids. Reads after destruction throw `StudioTreeDestroyedError`.
- `observeWrites` subscribes to `ObservedWriteFrame` observation. A notification does not establish a causal relationship, intermediate attempted write, or complete history.
- `activeTransactionContext` returns the synchronous transaction callback's owner and local ID, or `undefined` outside that scope. It does not report confirmation or propagate across `await`.
- `withWriteObservationScope` associates writes with a bounded, owner-qualified tooling token during a synchronous callback. `ObservedWriteFrame.declaredScopes` uses `DeclaredWriteScopes` to preserve retained `tokens`, `includesUnscoped` contributions and `omitted` overflow when notifications coalesce. Declarations describe scope membership, not proven input dependencies or exclusive causes. Observer delivery does not inherit the scope.

Internally, `getConfirmedTurnRecords` supplies retained records to the tooling
projection. Tools consume `confirmedTurnReader`; the raw internal transaction
runtime accessor is not the supported inspection contract.

Studio is a separate private product with an explicit development-only attachment. Its adapter and query engine are not public npm packages. Tooling must retain unknown/unsupported distinctions and must not infer causality from event timing.

## License

Apache-2.0. See [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE).


### Duplicate replacement input

`setAll()` replaces a collection by key. Within one incoming payload, the last
row for a repeated key wins; an existing row with that key is an ordinary update.
Supply distinct stable keys rather than a shared fallback for missing IDs.
Version 15.4.0 adds a once-per-collection development warning (ST2001)
without changing replacement semantics. Published 15.3.1 does not warn for
non-null duplicate keys. Numeric `1` and string `"1"` remain distinct keys.
Since 15.4.4 a batch call naming one id twice applies its copies in order:
`addMany` and `prependMany` in strict mode throw before writing, skip keeps the
first copy, overwrite keeps the last copy in the first copy's place, and
`upsertMany` merges the copies. `removeMany` and `updateMany` remove or update
a repeated id once, while still intercepting and tapping every listing.

Version 15.4.0 checks `setAll()` staging after user callbacks.
If an interceptor or ID selector changes collection membership, keys or order,
the outer replacement refuses before applying its staged writes. The callback's
already-completed writes remain. Field-only callback writes do not trigger this
structural refusal. Prefer interceptors that validate or transform input instead
of changing the same collection's topology.
Version 15.4.4 adds a narrower refusal to `addOne`, `addMany`, `prependOne`,
`prependMany`, `upsertMany`, `updateMany` and `removeMany`. When a callback
changes the collection's membership or order, or the key of a row the call
names, the call throws `Cannot <method>: collection topology changed during
staging` before it writes. Unlike `setAll`, these calls allow a key change to
a row they do not name.

## Independent editors and connections

Keep shared records in an owned tree. Give each independently closable editor or
connection its own lifetime; native local form state may be enough for a draft.
A declared EntityMap supports dynamic data membership, not runtime installation
of composite slices. Separate trees do not share transactions or undo history.
Destroy directly created trees at their ownership boundary.

See the [owned sessions guide](../../docs/guides/owned-sessions.md) for the Angular
reference demo, stale-save policy, same-ID replacement and cleanup tests. Use this
package’s own reactive/lifecycle integration when applying the pattern.
