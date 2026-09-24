// Non-shipping entry: public operations, explicitly instrumented private reads.
export {
  signalTree,
  entityMap,
  transactions,
  restoration,
  external,
  undoable,
} from '../../../packages/kernel/src/index';
export { peekInternalTransactionRuntime as instrumentedTransactionReader } from '../../../packages/kernel/src/enhancers/transactions/transactions';
export { getPathNotifier as instrumentedPathNotifier } from '../../../packages/kernel/src/lib/path-notifier';
