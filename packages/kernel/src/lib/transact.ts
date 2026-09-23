import { peekInternalTransactionRuntime } from '../enhancers/transactions/transactions';
import type {
  PendingTransaction,
  TransactionsCapability,
} from '../enhancers/transactions/transactions.types';
import type { ISignalTree } from './types';

/**
 * CAPABILITY-SURFACE-0 arm B. `transaction()` as a standalone operation.
 *
 * Identical turn authority; only reachability moves.
 */
export function transact<T extends object>(
  tree: ISignalTree<T> & TransactionsCapability,
  fn: () => void
): PendingTransaction {
  const runtime = peekInternalTransactionRuntime(tree);
  if (!runtime) {
    throw new Error(
      'transact() requires the transactions() enhancer on this tree.'
    );
  }
  return runtime.transaction(fn);
}
