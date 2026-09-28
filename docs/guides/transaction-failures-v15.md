# Transaction failures and current v15 limitations

This guide describes existing v15 behavior and the **unreleased 15.3.1
candidate**. Candidate fixes are not a
claim that 15.3.1 is published. Check the [changelog](../../CHANGELOG.md),
[support policy](../support-policy.md#transaction-failure-policy), and
[npm registry](https://www.npmjs.com/org/signal-tree) for release status.

## A thrown error does not guarantee undo

| Failure boundary | State and handle | Consequences and history |
| --- | --- | --- |
| Explicit `pending.rollback()` refuses (existing v15 behavior) | Compensation changes no state; the returned handle remains pending. `confirm()` or another rollback attempt remains available. | The commit scope and its deferred consequences are released despite refusal. Pending authority does **not** mean persistence is still deferred. |
| Automatic rollback refuses before `transaction()` returns a handle (unreleased candidate) | Surviving writes remain applied; `SignalTreeRollbackError` is thrown; no recovery handle is returned. | Surviving writes are recorded as committed, confirmation is announced, eligible designated undo history is retained, and consequences are released. This applies to callback and post-callback failures. |
| Automatic rollback succeeds | Recorded writes are reversed and the failure is thrown. | The commit scope rolls back and discards its deferred consequences. See the omitted-branch-key defect below: compensation cannot restore changes it did not record. |

Committed here describes local transaction settlement, not backend acceptance.
Undo history requires `restoration()` and designation with `undoable()`; it is
not created for every failed operation. Never blindly retry an entire operation
on error: inspect current state, the failure boundary, and the remote outcome
first. Use application reconciliation and idempotency policy. Do not use
`undo()` or `jumpTo()` to reconcile a failed request.

For an explicit refusal, inspect the structured `SignalTreeRollbackError.cause`.
Settling a newer overlapping pending transaction can permit another attempt,
but **not every refusal becomes retryable**. A pending-created row that is
later edited by confirmed work and then removed can still refuse rollback
because of that confirmed dependency. Removing the entity does not erase the
dependency. Keep the handle and choose reconciliation or confirmation
explicitly; do not promise that waiting or deleting a row will make rollback
succeed.

Recoverable pending refusal with a usable recovery handle and consequences
held until explicit confirmation is a **v16 target**, not a current v15 API.

## Observer failures have a bounded containment rule

In the unreleased candidate, errors in **deferred write subscribers** (including
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

## Known failures still present in the candidate

These are the live limitations recorded in the candidate
[changelog](../../CHANGELOG.md#known-issues-not-fixed-here), reproduced on
15.3.0 and not fixed by this patch. No fix version is promised.

- **Restored entity rows may not reach Link.** Rollback or undo/redo can restore
  a removed row in the tree while a linked endpoint keeps the row set without it.
- **Omitted branch keys are not restored.** A whole-value plain-object branch
  write that omits an existing key removes it without notifying write
  subscribers. A branch Link can receive state the tree does not hold; explicit
  rollback, automatic rollback, and undo restore other keys but not the omitted
  key. The automatic rollback guard cannot see that removal. Write keys
  explicitly or use `entityMap()` for keyed collections.
- **`coalesce()` loses transaction and undo context.** Wrapping a transaction
  in `coalesce()` delays writes until after its callback: rollback reverses
  nothing and failed-transaction writes can still land. Wrapping `undoable()`
  in `coalesce()` records no history. Do not compose these scopes this way.
- **Same-tick notifications can lose writes.** Merging rollback, undo/redo, or
  entity notifications can lose tree attribution across origins/transactions,
  or collapse writes across same-shaped trees. Link can miss values even when
  tree state is correct.
- **Undo/redo is not reconciled with pending transactions on the same location.**
  Later rollback can reverse through undo/redo; confirmation can commit a write
  the tree no longer holds. Avoid that overlap.
- **Reentrant observer work can be ordered before the transaction it observes.**
  Work during `transaction()` closure can reach transaction authority first;
  explicit rollback may undo it or make dependency decisions in the wrong
  order. The candidate guards post-callback automatic rollback against later
  writes, including later writes subsequently rolled back. Throwing-callback
  compensation admission remains compatible with v15 and can overwrite a later
  observer write to the same entity row. Do not claim unconditional isolation.
- **Retired entities can retain realization descriptors.** With `transactions()`
  installed, ordinary removals can leave descriptors retained; later
  transactions do not reclaim them. Bound tree ownership and call `destroy()`
  at teardown. This is separate from configured diagnostic history retention.
- **Asynchronous Link endpoints have settlement gaps.** While endpoint `set()`
  is in flight, pending uncommitted writes may be sent before a transaction is
  decided (the endpoint still ends on the surviving value); a rejected send can
  let `settled()` resolve before a later value is sent; and `dispose()` does not
  release a `settled()` waiter until that send settles. Do not treat `settled()`
  as a durability receipt or assume all pending writes stay out of storage.

A failure inside the internal pending-turn recording step is also outside the
automatic rollback coverage; no supported trigger is known.

## Evidence

- [Transaction failure characterization](../../packages/kernel/src/lib/transaction-observer-failure.spec.ts)
  distinguishes explicit refusal, automatic refusal, and successful compensation.
- [Refusal diagnostics](../../packages/kernel/src/enhancers/transactions/rollback-refusal-legibility.spec.ts)
  pins structured refusal causes.
- [Overlapping Link rollback tests](../../packages/kernel/src/lib/link-overlapping-rollback.spec.ts)
  cover the candidate's notification repairs; they do not establish blanket
  framework-effect containment or repair the limitations listed above.

- [Packed refusal lifecycle comparison](../../tools/check-v15-refusal-lifecycle.mjs)
  runs the same public fixture against the exact published 15.3.0 tarball and
  the candidate. It requires five repaired behaviors and three preserved
  controls, and separately reports two unchanged limitations.
