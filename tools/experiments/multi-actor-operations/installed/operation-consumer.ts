import { signalTree, transactions, type PendingTransaction } from '@signal-tree/kernel';
import { transactionLifecycleReader } from '@signal-tree/kernel/internals';
import { OperationCoordinator, type Review } from './coordinator.mjs';
import { DispatchBackend, type DispatchProposal } from './dispatch-fixture.mjs';

const backend = new DispatchBackend();
const operations = new OperationCoordinator<DispatchProposal>(backend);
const tree = signalTree({ route: 'north', note: '' }, { enhancers: [transactions()] });
const proposal = backend.proposal({ route: 'west' });
operations.create('strict-installed/1', proposal, { kind: 'unknown' });
const local: PendingTransaction = tree.transact(() => tree.$.route('west'));
const review: Review<DispatchProposal> = operations.review('strict-installed/1');
operations.approve(review);
const lifecycle = transactionLifecycleReader(tree);
if (!lifecycle || lifecycle.snapshot().pending.length !== 1) throw new Error('Local authority missing before delivery');
const outcome = await operations.deliver('strict-installed/1');
if (outcome.status !== 'succeeded' || outcome.receipt?.status !== 'applied') throw new Error('No applied receipt');
if (lifecycle.snapshot().pending.length !== 1) throw new Error('Delivery prematurely settled local authority');
local.confirm();
if (lifecycle.snapshot().pending.length !== 0) throw new Error('Local settlement missing');
if (backend.snapshot().values.route !== tree.$.route()) throw new Error('Different applied values');
operations.forget('strict-installed/1'); operations.dispose(); tree.destroy();

if (false) {
  // @ts-expect-error fixture capacity is numeric
  backend.proposal({ capacity: 'ten' });
  // @ts-expect-error declared actor requires its label
  operations.create('invalid', proposal, { kind: 'declared' });
  // @ts-expect-error proposal is deeply immutable
  review.proposal.patch.route = 'east';
  // @ts-expect-error command receipt has no invented durable version
  outcome.receipt?.serverVersion;
  // @ts-expect-error local pending handle has no server receipt
  local.receipt;
}
