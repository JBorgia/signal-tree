import { vi } from 'vitest';
// Qualification-only module seam; production activation remains unchanged.
vi.mock('../../../../../packages/kernel/src/enhancers/transactions/transactions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../packages/kernel/src/enhancers/transactions/transactions')>();
  const { selectNativeOwnershipTransactions } = await import('../../../../../packages/kernel/src/lib/internals/native-ownership-public-selection');
  return {
    ...actual,
    transactions: (...args: Parameters<typeof actual.transactions>) =>
      selectNativeOwnershipTransactions(actual.transactions(...args)),
  };
});

// Prove the wrapper itself activates B, rather than relying on explicit selection
// in the existing B controls. This hook runs only in the dedicated canary file.
import { beforeAll, expect } from 'vitest';
beforeAll(async () => {
  if (!expect.getState().testPath?.endsWith('b-qualification-activation.spec.ts')) return;
  const { signalTree, transactions } = await import('../../../../../packages/kernel/src/index');
  const { transactions: direct, peekInternalTransactionRuntime } = await import('../../../../../packages/kernel/src/enhancers/transactions/transactions');
  const { getNativeOwnershipPublicExperiment } = await import('../../../../../packages/kernel/src/enhancers/transactions/native-ownership-public-experiment');
  for (const factory of [transactions, direct]) {
    const tree=signalTree({x:0},{enhancers:[factory()]});
    try {
      expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe('native-pending');
      expect(peekInternalTransactionRuntime(tree)).toBeUndefined();
    } finally { tree.destroy(); }
  }
});
