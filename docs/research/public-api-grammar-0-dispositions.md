# PUBLIC-API-GRAMMAR-0 — name dispositions

> **Placement settled first.** `CAPABILITY-SURFACE-0` reported KEEP METHODS, so
> these names apply to the surface actually being kept. Dispositioned by
> **use-site inspection**, not by taxonomy — the rename pass must not become
> "fix everything that sounds unusual".

## APPLY

### `proposal()` -> `propose()` — unshipped, change directly

A verb beside `accept()` / `reject()`. `proposal()` returning a `Proposal` was a
noun-as-method. Not in 15.2.1, so no bridge is owed.

### `transaction()` -> `transact()` — SHIPPED, needs a bridge

Same defect, same fix, but it shipped in 15.2.1 and the support policy promises
a documented migration path before removal.

```ts
store.transact(...)      // canonical
store.transaction(...)   // @deprecated -> transact()
```

Deprecated spelling removed in the next major. Not permanent aliasing — a
bounded bridge that establishes the final vocabulary immediately.

## REJECTED — the taxonomy was wrong

### `empty` -> `isEmpty()` — REJECTED

**`empty` is not a method.** It is
`readonly empty: ReadonlyOf<boolean, C>` — a reactive signal property, read by
calling because that is how every signal in this library is read.

It sits in a block the source itself labels _"Queries (readonly properties
returning signals)"_, beside `all`, `count`, `ids` and `asMap`. Its own doc
records the decision:

> v10.3 canonical name — aligns with FormControl-style bare-boolean accessors
> used across `status` / `form` / `asyncSource` markers.

So renaming it would break a documented cross-marker convention, make it the
odd one out among its own siblings, reverse a deliberate prior decision, and
cost a deprecation bridge to do it.

The audit flagged it as "a boolean query sitting beside a mutating `clear()`".
That reads `empty()` and `clear()` as the same kind of callable. They are not:
`clear(): void` is a method, `empty` is a property whose value is a signal.
Adjacency in a type declaration is not a grammar defect.

### `settled()` — KEEP

`Link.settled(): Promise<void>`. Every real use site supplies the temporal
reading:

```ts
await connection.settled();
await persistence.settled();
```

Checked for the collision that would have justified a change: a boolean
`settled()` does appear in docs on a `status()` slice — but `status` is not
exported from the kernel barrel, so there is no shipped ambiguity. The name
only looks like a predicate when read in isolation in an inventory, which is an
artifact of the taxonomy rather than a defect users meet.

### `tap(handlers)` — KEEP

Takes a BAG of observers — `onAdd`, `onUpdate`, `onRemove`, `onChange` — and
returns an unsubscribe. The `on` is already inside the payload, so forcing the
method itself into `onX` would be wrong for a multi-handler registration.

### `intercept(handlers)` — KEEP

Genuinely intercepts: `InterceptContext` exposes `block(reason)` and
`transform(value)`, applied synchronously to a mutation. That is an operation,
not an event subscription, and the name says so.

### `exportDebugSession()` — KEEP

Accurately describes what it does. Whether it classifies as query or command
creates no naming defect.

## The gating hole is much larger than one method

The grammar audit found that `proposal()` evaded `api-baseline` because the
baseline is export-oriented and `proposal()` was added to the already-exported
`TransactionMethods`. Checked against the committed baseline, the hole is not
one method:

```text
settled              not in baseline
tap                  not in baseline
intercept            not in baseline
empty                not in baseline
exportDebugSession   not in baseline
transaction          not in baseline
proposal             not in baseline
```

**No callable member of any exported interface is in the public API baseline.**
The gate records exported symbols — functions and types — so the entire method
surface of the library is invisible to it. `transaction()` has shipped since
15.2.1 without the API gate ever knowing it exists.

A surface gate must therefore inventory **owner + callable + classification**:

```yaml
owner: tree
name: transact
category: command
capability: transactions
since: 15.3.0
```
