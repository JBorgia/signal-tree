import { signalTree } from './lib/signal-tree';
import { transactions } from './enhancers/transactions/transactions';
import { transact } from './lib/transact';
import { propose } from './lib/propose';

// WITH the enhancer — must compile.
const withCap = signalTree({ x: 0 }, { enhancers: [transactions()] });
transact(withCap, () => withCap.$.x(1));
propose(withCap, () => withCap.$.x(2));

// WITHOUT the enhancer — must be a compile error, not runtime discovery.
const withoutCap = signalTree({ x: 0 });
// @ts-expect-error transact() requires the transactions() capability.
transact(withoutCap, () => withoutCap.$.x(1));
// @ts-expect-error propose() requires the transactions() capability.
propose(withoutCap, () => withoutCap.$.x(2));
