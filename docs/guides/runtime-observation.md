# Observe runtime activity without changing state

**Introduced in 15.4.0 (unreleased).** Tooling can inspect pending transactions,
undo history, collection membership and linked-state activity without installing
an enhancer or issuing application commands. Import these readers from the
supported `@signal-tree/kernel/internals` entry. Application state reads and
writes still use the application's framework facade.

Use the reader that answers your question:

| Reader | Current snapshot | Subsequent events |
| --- | --- | --- |
| `transactionLifecycleReader(tree)` | Pending transactions and whether their consequence hold is released | Open, stage, local confirmation, rollback, refusal |
| `restorationReader(tree)` | Stable history entry IDs, recorded transaction relations, undo/redo availability | History changes and undo/redo/jump outcomes |
| `entityMembershipReader(tree)` | Collection locations, typed entity keys, lifetime IDs and membership order | Add, remove, rekey and reorder |
| `linkStateReader(tree)` | Active relationships, supported directions, dirty/held/queued/send/retrieval activity | Activity changes, failures and disposal |

Transaction and restoration readers return `undefined` when the corresponding
capability is absent. This differs from an available reader with an empty
snapshot. Readers never install missing capabilities. Disposed relationships
are absent from the Link snapshot; their disposal is observable while subscribed.

## Attach and release an observer

A snapshot includes a sequence boundary. A subscription receives new events only;
it does not replay earlier events. Take the snapshot and subscribe synchronously
without application mutations or an `await` between them. If your own callbacks
cause reentrant application work, preserve event sequence and distinguish an
emission-time snapshot from a later read of current state.

```ts
import { signalTree, transactions } from '@signal-tree/kernel';
import { transactionLifecycleReader } from '@signal-tree/kernel/internals';

const tree = signalTree({ count: 0 }, { enhancers: [transactions()] });
const reader = transactionLifecycleReader(tree);
if (reader) {
  const initial = reader.snapshot();
  console.log(initial.pending);
  const stop = reader.subscribe(event => console.log(event.kind, event.transactionId));
  const pending = tree.transaction(() => tree.$.count(1));
  pending.confirm();
  stop();
}
tree.destroy();
```

Unsubscribe when a view stops recording. Destroy a bounded-lifetime tree at its
ownership boundary. Destruction releases subscriptions; held readers refuse
further reads. Listener exceptions cannot fail an application operation.
Snapshots and delivered events cannot be used to mutate runtime state.

## What the facts do and do not mean

- A transaction confirmation is local settlement. It says nothing about server
  acceptance or durable storage. A refusal explicitly reports whether pending
  authority remains and whether that operation's consequence hold was released.
- Restoration entry IDs are separate from transaction IDs. Use only the
  transaction relations that the restoration owner actually recorded.
- Entity identity includes the tree, collection location and entity lifetime.
  A new entity using the same business key is not the old entity. Numeric `1`
  and string `"1"` remain distinct. Collection membership order is separate from
  any row-value sorting configured for presentation.
- Paths are diagnostic labels. Use the structured location and typed keys for
  addressing; never split a label on dots. `"a.b"` is a valid literal key.
- A Link is a latest-value reconciler. `queued` counts scheduled reconciliation
  jobs, not an outbound queue of every application value. Failure events contain
  no endpoint URL, payload, stack or raw exception.

The readers do not keep terminal transaction history or an audit ledger. A tool
that records events owns its memory budget, pause/clear behavior, and truthful
coverage reporting. Attaching late, pausing, dropping records or connecting to an
older runtime must never be presented as a complete history.
