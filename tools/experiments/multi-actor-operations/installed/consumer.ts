import { external, link, signalTree, transactions, type PendingTransaction, type TransactionInspection } from '@signal-tree/kernel';
import { activeTransactionContext, observeWrites, transactionLifecycleReader, treeRuntimeId, withWriteObservationScope, type ObservedWriteFrame } from '@signal-tree/kernel/internals';

// A strict downstream consumer: inferred native tree type and supported tooling
// seams only. There are no deep imports, casts, ambient module stubs or any types.
const tree = signalTree({ route: 'north', capacity: 10, note: '' }, { enhancers: [transactions()] });
const runtimeId = treeRuntimeId(tree);
if (runtimeId === undefined) throw new Error('Owned tree must have a runtime ID');
const frames: ObservedWriteFrame[] = [];
const off = observeWrites(frame => { if (frame.ownerId === runtimeId) frames.push(frame); });
let transactionId: number | undefined;
const pending: PendingTransaction = tree.transact(() => {
  withWriteObservationScope(runtimeId, 'strict-consumer/operation', () => {
    transactionId = activeTransactionContext()?.id;
    tree.$.route('west');
  });
});
const inspection: TransactionInspection = pending.inspect();
const addresses: (readonly string[] | undefined)[] = inspection.changes.map(change => change.address);
const lifecycle = transactionLifecycleReader(tree);
if (!lifecycle) throw new Error('Transactions must expose lifecycle');
const ids: number[] = lifecycle.snapshot().pending.map(turn => turn.transactionId);
const currentCapacity: number = tree.$.capacity();
external(() => tree.$.capacity(currentCapacity + 1));
const connection = link(tree.$.route, { set(value) { const route: string = value; void route; } });
pending.confirm();
await connection.settled();
connection.dispose(); off(); tree.destroy();
void [frames, addresses, ids, transactionId];

// Wrong value types, fabricated review revisions, and nonexistent lifecycle
// identities must remain rejected by the actual package declarations.
if (false) {
  // @ts-expect-error route accepts strings, never numbers
  tree.$.route(42);
  // @ts-expect-error current inspection has no approval revision
  inspection.revision;
  // @ts-expect-error confirm does not implement revision-conditional approval
  pending.confirm({ expectedRevision: 1 });
  // @ts-expect-error lifecycle IDs are transactionId, not id
  lifecycle.snapshot().pending[0].id;
}
