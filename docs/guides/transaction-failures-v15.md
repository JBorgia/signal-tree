# Transaction failures and limitations in 15.3.1

This guide describes **published 15.3.1**. Check the
[changelog](../../CHANGELOG.md) and
[support policy](../support-policy.md#transaction-failure-policy) for versioned
behavior. This historical inventory is not a list of defects in 15.4.0.
Repairs in later versions do not change an already-published artifact.

## A thrown error does not guarantee undo

| Failure boundary | State and handle | Consequences and history |
| --- | --- | --- |
| Explicit `pending.rollback()` refuses (existing v15 behavior) | Compensation changes no state; the returned handle remains pending. `confirm()` or another rollback attempt remains available. | The commit scope and its deferred consequences are released despite refusal. Pending authority does **not** mean persistence is still deferred. |
| Automatic rollback refuses before `transaction()` returns a handle (15.3.1) | Surviving writes remain applied; `SignalTreeRollbackError` is thrown; no recovery handle is returned. | Surviving writes are recorded as committed, confirmation is announced, eligible designated undo history is retained, and consequences are released. This applies to callback and post-callback failures. |
| Automatic rollback succeeds | Recorded writes are reversed and the failure is thrown. | The commit scope rolls back and discards its deferred consequences. See the omitted-branch-key defect below: compensation cannot restore changes it did not record. |

Committed here describes local transaction settlement, not backend acceptance.
Undo history requires `restoration()` and designation with `undoable()`; it is
not created for every failed operation. Never blindly retry an entire operation
on error: inspect current state, the failure boundary, and the remote outcome
first. Use application reconciliation and idempotency policy. Do not use
`undo()` or `jumpTo()` to reconcile a failed request.

For an explicit refusal, inspect the structured `SignalTreeRollbackError.cause`.
Settling a newer overlapping pending transaction can permit another attempt,
but **not every refusal becomes retryable**. Since 15.4.2, a pending-created
or pending-rekeyed row that settled later work removed no longer blocks
rollback: the removal already undid that part, so the rest of the transaction
reverses and the row stays absent. Since 15.4.4 the same holds for a field
write to an EXISTING row that settled later work removed (even a plain
`removeOne`): the row's compensation is skipped, the rest reverses, and the row
stays absent (15.4.3 refused with `later-confirmed-dependency`). If the removing
transaction is still open, rollback refuses with `later-pending-dependency`
until it settles. A row that later confirmed work edited and kept still refuses,
and so does a pending removal or rename whose key later work gave to a
different row: that work rests on the key being free. Since 15.4.4 both refuse
as a dependency (`later-confirmed-dependency`, or `later-pending-dependency`
while that work is open); through 15.4.3 the removal refused as
`effect-validation-failed` while the new row stood. Once the new row is removed
again, both refuse while undo history can restore that row (it was added or
removed `undoable()`): through 15.4.3 that rollback was accepted and left two
rows at one key in history (`getRestorationHistory()` and `undo()` threw
"duplicate keys" for good). When nothing can restore it, deleting the
replacement and retrying the rollback works, as a removal's did in 15.3.0. A row added and removed again within one flush
leaves nothing at the key and does not block. `cause.kind`
names the first matching later effect, so a `later-confirmed-dependency`
refusal can still clear once a newer open transaction settles. Keep the handle and choose
reconciliation or confirmation explicitly; do not promise that waiting or
deleting a row will make rollback succeed.

After a rejection, no `undo()`, `redo()` or `jumpTo()` reinstates a value or row
that only the rejected transaction wrote. Undo of a later write restores what
would have been there had the transaction never run: if the transaction wrote
`X` over `A` and a later write put `Y` over `X`, undoing that later write gives
`A`; if a later write removed a row the transaction created, undoing it leaves
the row gone. This holds for scalars, plain branches (fields and optional
members) and entity rows, in either enhancer order, and history states read the
same records. Through 15.4.3 that undo restored the rejected value instead (a
documented limitation since 15.4.2); 15.4.4 adopts the rule above. Undo is still
not a way back to the state before the transaction — it reverses authored
history, and the rejected transaction is not part of it.

A collection order change (`setAll` reordering surviving rows, or an
overwriting `prependMany` moving a row to the front) reverses with the rest of
its transaction or undoable turn, whatever else that turn did to the same
collection, and after later work on the collection is undone or rolled back
(15.4.4; 15.4.3 refused the `setAll` cases and reported success for the
`prependMany` cases while deleting the overwritten row).

It is tracked by identity, not by content: an order change reverses only while
the collection's order is exactly the one it left. While LATER work that
added, removed or reordered rows of that collection stands, the later work
rests on it, so:

- `rollback()` refuses as a **dependency**: `later-confirmed-dependency` when
  that work is settled (a plain write, or a confirmed transaction), and
  `later-pending-dependency` while open transactions account for it. Settle
  the newer transactions first; once they roll back, the order change rolls
  back too. If settled work replaced the order as well, the refusal is
  `later-confirmed-dependency`. Through 15.4.3 this refusal reported
  `effect-validation-failed`.
- `undo()` of the order change throws a typed ST1034 restoration refusal that
  names the collection and the latest standing change to it, while that work
  stands; `getCurrentIndex()` and history are unchanged.

State is unchanged either way, and the transaction stays pending. A later
`updateOne`, or work on another collection, does not block it. A write a
subscriber makes while the order change is being delivered is later work of
this kind: it is a turn of its own and, unless it is `undoable()`, it stands.

Since 15.4.4, rollback also refuses with `later-pending-dependency` while a
NEWER pending transaction omitted, or re-added, a plain branch that encloses a
location this transaction wrote. The newer transaction's before-image of that
branch holds this transaction's value, so reversing this one first would let
the newer one's rollback bring the rejected value back (through 15.4.3 it
did). Settle the newer transaction, then retry. A rollback under a branch that
a later omission hid restores the hidden storage and leaves the branch absent,
so the rejected value cannot come back on a later re-add. A rollback that
would re-add an entity collection the transaction omitted refuses
(`effect-validation-failed`, naming the collection) when something else
changed the collection's rows while it was omitted; state is unchanged. See
"Locations an omission has hidden" in the
[kernel README](../../packages/kernel/README.md#locations-an-omission-has-hidden).

Recoverable pending refusal with a usable recovery handle and consequences
held until explicit confirmation is a **v16 target**, not a current v15 API.

## Observer failures have a bounded containment rule

In 15.3.1, errors in **deferred write subscribers** (including
`observeWrites()` subscribers) and **transaction turn listeners** are contained:
remaining delivery continues, with reports through `onTreeError` and ST2034.
This does not contain every framework computation, effect, or watcher error.
Synchronous write delivery with batching disabled is unchanged.

A subscribed derived computation or framework callback that throws while the
invalidation group closes can instead trigger automatic rollback. Vue rethrows
watcher errors in development but logs them in production, so a watcher failure
can trigger this rollback in development without triggering it in production.
Inside an enclosing Solid `batch()`, `transaction()` can return a handle before
effects run; the error then surfaces from the outer batch, outside this
automatic-abort boundary.

Contained reports to `onTreeError` are limited to 50 per tree per second;
remaining errors go to the console. Development always logs ST2034; production
logs when no listener accepts the report, attribution is missing, or the budget
is exhausted. This is rate limiting, not a termination guarantee. Console hooks
that write state and Link's own `link:set` reports are not covered by that
budget.

## Known failures in published 15.3.1

These limitations were recorded in the 15.3.1 release
[changelog](https://github.com/JBorgia/signal-tree/blob/v15.3.1/CHANGELOG.md#known-issues-not-fixed-here),
reproduced on 15.3.0 and not fixed by 15.3.1. Each item below now says which
version repaired it; every item is repaired by 15.4.4. The status was
re-checked against the 15.3.1 and 15.4.0 sources with the tests named under
[Evidence](#evidence). See the [current changelog](../../CHANGELOG.md) for the
details of each repair.

- **Restored entity rows may not reach Link.** Rollback or undo/redo can restore
  a removed row in the tree while a linked endpoint keeps the row set without it.
  **Fixed in 15.4.0**, which delivers the restored rows; until 15.4.4 they could
  reach the endpoint out of order (see
  [Link failures found later](#link-failures-found-later)).
- **Omitted branch keys are not restored.** A whole-value plain-object branch
  write that omits an existing key removes it without notifying write
  subscribers. A branch Link can receive state the tree does not hold; explicit
  rollback, automatic rollback, and undo restore other keys but not the omitted
  key. The automatic rollback guard cannot see that removal. Write keys
  explicitly or use `entityMap()` for keyed collections. **Fixed in 15.4.0:**
  explicit rollback, automatic rollback and undo restore the omitted key, and a
  branch Link receives the branch without it. 15.4.3 made every reader see the
  removal without enhancers too, and 15.4.4 settles what reads, writes and
  reversals do under an omitted member (kernel README, "Locations an omission
  has hidden").
- **`coalesce()` loses transaction and undo context.** Wrapping a transaction
  in `coalesce()` delays writes until after its callback: rollback reverses
  nothing and failed-transaction writes can still land. Wrapping `undoable()`
  in `coalesce()` records no history. **Fixed in 15.4.0:** a transaction
  opened inside `coalesce()` keeps its writes (rollback reverses them, and a
  failed transaction's writes do not land), and `coalesce(() => undoable(...))`
  records an undoable entry.
- **Same-tick notifications can lose writes.** Merging rollback, undo/redo, or
  entity notifications can lose tree attribution across origins/transactions,
  or collapse writes across same-shaped trees. Link can miss values even when
  tree state is correct. **Fixed in 15.4.0:** in each of the 15.3.1 changelog's
  examples (two overlapping rollbacks newest-first, a rollback then an undo of
  one location, two same-shaped trees each rolling back or undoing, same-tick
  entity writes on two same-shaped trees) the endpoint ends on the tree's
  value.
- **Undo/redo is not reconciled with pending transactions on the same location.**
  Later rollback can reverse through undo/redo; confirmation can commit a write
  the tree no longer holds. **Fixed in 15.4.0:** undo, redo and `jumpTo()` over
  a location a pending transaction wrote refuse with ST1034 until it settles,
  and change nothing.
- **Reentrant observer work can be ordered before the transaction it observes.**
  Work during `transaction()` closure can reach transaction authority first;
  explicit rollback may undo it or make dependency decisions in the wrong
  order. 15.3.1 guards post-callback automatic rollback against later
  writes, including later writes subsequently rolled back. Throwing-callback
  compensation admission remains compatible with v15 and can overwrite a later
  observer write to the same entity row. Do not claim unconditional isolation.
  **Fixed in 15.4.0:** observer work stays later than the transaction it
  observes, so an explicit rollback no longer undoes a later observer write
  (it reverses around it or refuses atomically), and a throwing callback's
  compensation no longer erases a later observer write to the same row. The
  15.3.1 automatic-abort exception above (a refused automatic rollback records
  the surviving writes as committed) is unchanged.
- **Retired entities can retain realization descriptors.** With `transactions()`
  installed, ordinary removals can leave descriptors retained; later
  transactions do not reclaim them. Bound tree ownership and call `destroy()`
  at teardown. This is separate from configured diagnostic history retention.
  **Fixed in 15.4.0:** descriptors follow reversal responsibility; a retired
  subject nothing can still reverse keeps none.
- **Asynchronous Link endpoints have settlement gaps.** Calling `settled()`
  immediately after a write can return before the newly queued send finishes.
  Version 15.4.0 repairs this same-turn race; the repair is not
  present in the published 15.3.1 package. In 15.3.1, while endpoint `set()`
  is in flight, pending uncommitted writes may be sent before a transaction is
  decided (the endpoint still ends on the surviving value); a rejected send can
  let `settled()` resolve before a later value is sent; and `dispose()` does not
  release a `settled()` waiter until that send settles. Do not treat `settled()`
  as a durability receipt or assume all pending writes stay out of storage.
  `tree.destroy()` did not dispose Links either; see
  [Link failures found later](#link-failures-found-later). **Fixed in
  15.4.0:** a pending transaction's write is held while a send is in flight
  and sent only if it confirms, `settled()` waits for a later queued send after
  an earlier one rejects, and `dispose()` releases every waiter at once.
  `settled()` is still not a durability receipt.

A failure inside the internal pending-turn recording step was also outside the
automatic rollback coverage in 15.3.1 through 15.4.3 (no supported trigger is
known). 15.4.4 keeps the transaction's capture until its pending turn exists,
so such a failure is rolled back automatically like any other post-callback
failure.

## Link failures found later

These are not in the 15.3.1 changelog. They were found while auditing the 15.4
line, were still present in 15.4.3, and are repaired in 15.4.4. The reorder and
`destroy()` failures were already present in published 15.3.1 (where restored
rows did not reach Link at all; see above); the others were reproduced on the
15.4 line.

- **Reordering surviving rows never reached Link.** After `setAll([D,C,B,A])`
  over `[A,B,C,D]`, or a `prependMany()`, the tree held the new order while a
  linked endpoint kept the old one. In 15.4.4 a linked collection receives its
  complete `Row[]` in the tree's order after a reorder, a prepend, and the undo,
  redo, `jumpTo()` or rollback of either. A reorder inside a pending
  transaction is sent only if the transaction confirms. An inspection-only
  reorder (devtools) still sends nothing and does not change the order a later
  authored write publishes.
- **Restored rows could reach Link out of order.** From `[A,B,C,D]`,
  `removeMany(['A','B'])` followed by rollback or undo left the tree at
  `[A,B,C,D]` and sent `[C,D,A,B]`, with or without `restoration()`.
  `setAll([X,Y,A,B])` over `[A,B]` sent `[A,B,X,Y]`. Rows restored or added
  ahead of their neighbours now arrive in the tree's order.
- **`tree.destroy()` did not dispose the tree's Links.** A `settled()` waiter on
  a send that never settles waited forever, later writes were still sent, and
  the endpoint's `subscribe()` cleanup never ran. In 15.4.4 `destroy()`
  disposes every Link bound to the tree exactly as `dispose()` does: waiters are
  released, held and queued sends are dropped, and each endpoint cleanup runs
  once. A cleanup that throws no longer escapes `destroy()`; calling
  `dispose()` directly still throws it. `link()` on a tree that is already
  destroyed throws `StudioTreeDestroyedError`, as v15's tooling readers do,
  instead of creating a relationship that can never send.
- **A `sortComparer` collection reached Link in storage order.** A collection
  endpoint receives exactly `all()`, but with `entityMap({ sortComparer })` it
  received insertion order, and editing the sort field never moved the row. It
  now receives the comparer's order, computed from the values Link may publish,
  so a devtools edit of a sort field moves nothing outward.
- **`settled()` could resolve while a reactive write was still queued.** When a
  notifier subscriber wrote the linked location in response to another write
  (one hop or more), or a write was authored after `settled()` in the same
  synchronous turn, `settled()` resolved before that write's send started. It
  now also waits until no notification is queued anywhere, so a hop through
  another tree counts. Another relationship's endpoint work is still not part
  of this relationship's `settled()`.

## Evidence

- [Transaction failure characterization](../../packages/kernel/src/lib/transaction-observer-failure.spec.ts)
  distinguishes explicit refusal, automatic refusal, and successful compensation.
- [Refusal diagnostics](../../packages/kernel/src/enhancers/transactions/rollback-refusal-legibility.spec.ts)
  pins structured refusal causes.
- [Overlapping Link rollback tests](../../packages/kernel/src/lib/link-overlapping-rollback.spec.ts)
  cover the candidate's notification repairs; they do not establish blanket
  framework-effect containment or repair the limitations listed above.
- [Link restore placement](../../packages/kernel/src/lib/link-restore-placement.spec.ts),
  [Link collection reorder](../../packages/kernel/src/lib/link-collection-reorder.spec.ts),
  [sortComparer order](../../packages/kernel/src/lib/link-collection-sort-comparer.spec.ts),
  [Link tree destroy](../../packages/kernel/src/lib/link-tree-destroy.spec.ts)
  and [reactive settlement](../../packages/kernel/src/lib/link-reactive-settlement.spec.ts)
  tests pin the 15.4.4 repairs of the later-found Link failures.

- The 15.3.1 list's repairs, each failing on the 15.3.1 source and passing on
  15.4.0:
  [restored rows reach Link](../../packages/kernel/src/lib/entity-membership-link-restoration.spec.ts),
  [same-tick attribution](../../packages/kernel/src/lib/path-notifier-attribution.spec.ts),
  [undo over pending work](../../packages/kernel/src/enhancers/restoration/pending-overlap.spec.ts)
  and [its admission](../../packages/kernel/src/enhancers/restoration/pending-overlap-admission.spec.ts),
  [reentrant observer order](../../packages/kernel/src/lib/transaction-reentrant-order.spec.ts)
  and [its bookkeeping](../../packages/kernel/src/enhancers/transactions/reentrant-order-bookkeeping.spec.ts),
  [descriptor retention](../../packages/kernel/src/enhancers/transactions/descriptor-retention.spec.ts)
  and [asynchronous Link settlement](../../packages/kernel/src/lib/link-async-settlement.spec.ts).
  [Branch omission](../../packages/kernel/src/lib/branch-omission-correctness.spec.ts)
  and [`coalesce()` scopes](../../packages/kernel/src/enhancers/batching/batching-semantic-scopes.spec.ts)
  use internals 15.3.1 lacks; the
  [installed follow-up comparison](../../tools/check-v15-followups.mjs) runs
  their public cases against the published 15.3.1 tarball, which fails them.

- [Packed refusal lifecycle comparison](../../tools/check-v15-refusal-lifecycle.mjs)
  runs the same public fixture against the exact published 15.3.0 tarball and
  the candidate. It requires five repaired behaviors and three preserved
  controls, and separately reports two unchanged limitations.
