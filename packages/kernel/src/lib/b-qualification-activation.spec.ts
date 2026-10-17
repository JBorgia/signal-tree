import { describe, expect, it } from 'vitest';
import { signalTree, transactions as barrelTransactions } from '../index';
import { transactions as directTransactions, peekInternalTransactionRuntime } from '../enhancers/transactions/transactions';
import { getNativeOwnershipPublicExperiment } from '../enhancers/transactions/native-ownership-public-experiment';
import { selectNativeOwnershipTransactions } from './internals/native-ownership-public-selection';
describe('B qualification activation canary', () => {
  for (const [name, factory] of [['barrel', barrelTransactions], ['direct', directTransactions]] as const) {
    it(name + ' selects exactly one authority', () => {
      // Explicit selection also makes this canary meaningful in the default suite.
      const tree = signalTree({ x: 0 }, { enhancers: [selectNativeOwnershipTransactions(factory())] });
      try {
        expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe('native-pending');
        expect(peekInternalTransactionRuntime(tree)).toBeUndefined();
        const a=tree.transact(()=>tree.$.x(1)); const b=tree.transact(()=>tree.$.x(2));
        a.rollback(); expect(tree.$.x()).toBe(2); b.rollback(); expect(tree.$.x()).toBe(0);
        expect(peekInternalTransactionRuntime(tree)).toBeUndefined();
      } finally { tree.destroy(); }
    });
  }
});
