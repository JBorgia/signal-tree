/**
 * `@signal-tree/react` - React observation plus the complete SignalTree
 * application surface.
 *
 * React observes framework-neutral SignalTree truth through
 * `useSyncExternalStore`; it does not replace the kernel's tree carrier. React
 * applications therefore construct, synchronize, and enhance trees through
 * this package, then observe them with `useSignalTree`.
 */
export {
  signalTree,
  entityMap,
  link,
  restoration,
  undoable,
  external,
  asReadonly,
  batching,
  devTools,
  transactions,
  onTreeError,
  SignalTreeRollbackError,
} from '@signal-tree/kernel';

export type {
  SignalTree,
  TreeNode,
  WritableLeaf,
  AccessibleNode,
  NodeAccessor,
  Primitive,
  TreeConfig,
  Enhancer,
  EnhancerCleanup,
  EntitySignal,
  EntityMapMarker,
  AddOptions,
  AddManyOptions,
  EntityMapBuilder,
  DefaultKey,
  ComputedSliceConfig,
  EntityMapComputedSlices,
  EntitySignalWithSlices,
  EntityMapMarkerWithSlices,
  Link,
  LinkEndpoint,
  TreeId,
  TreeErrorEvent,
  BatchingConfig,
  BatchingMethods,
  RestorationMethods,
  RestorationHistoryEntry,
  PendingTransaction,
  TransactionMethods,
  DevToolsConfig,
  DevToolsMethods,
  DevToolsLogEntry,
  DevToolsDebugSession,
  EntityConfig,
  MutationOptions,
  ReadonlyStore,
  TreeCapability,
  EnhancerWithMeta,
} from '@signal-tree/kernel';

export { useSignalTree } from './use-signal-tree.js';
