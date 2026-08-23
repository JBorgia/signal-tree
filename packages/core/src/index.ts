/**
 * SignalTree: Reactive JSON for Angular
 *
 * JSON branches, reactive leaves.
 * No actions. No reducers. No selectors.
 * Type-safe, dot-addressable state where data stays plain
 * and reactivity stays invisible.
 *
 * @packageDocumentation
 */

/**
 * Main factory function to create a SignalTree
 * @see {@link signalTree}
 */
export { signalTree } from './lib/signal-tree';

/**
 * Wrap a tree factory in an injectable Angular service (the idiomatic Angular
 * DI pattern for a tree; comparable to NgRx SignalStore's `signalStore()`).
 * @see {@link defineStore}
 */
export { defineStore, type DefineStoreConfig } from './lib/define-store';

/**
 * Type-only read-only narrowing of a tree — same runtime object, no write
 * path offered on the type. The primary readonly surface;
 * `defineStore(factory, { expose: 'readonly' })` is sugar over the same view.
 * @see {@link asReadonly}
 */
export {
  asReadonly,
  // The per-marker reader-key allowlists are not root app API. They exist to
  // TYPE `asReadonly`; an app calls `asReadonly(tree)` and never names them.
  type ReadonlyStore,
  type ReadonlyView,
  type ReadonlyNodeAccessor,
  type ReadonlyEntityNode,
  type ReadonlyEntitySignal,
} from './lib/readonly';

// ============================================
// TYPE EXPORTS
// ============================================

export type {
  // Core types - Main SignalTree interfaces
  ISignalTree,
  SignalTree,
  TreeNode,
  CallableWritableSignal,
  AccessibleNode,
  NodeAccessor,
  Primitive,
  NotFn,

  // Deep path types - For nested entity access (removed in v6)

  // Configuration types
  TreeConfig,

  // Enhancer system types
  Enhancer,
  EnhancerWithMeta,
  // ChainResult removed in v6
  // WithMethod removed in v6 (single-enhancer runtime)

  // Entity types
  EntitySignal,
  EntityMapMarker,
  AddOptions,
  AddManyOptions,
  TimeTravelEntry,
  TransactionMethods,
  TimeTravelMethods,
  PendingTransaction,

  // Enhancer-added method types. Exported so a DOWNSTREAM LIBRARY can name the
  // return type of its own `.with(...)` chain in its emitted .d.ts. `.with()`
  // returns `this & TAdded`, so a helper like
  // `withStandardEnhancers(tree) { return tree.with(batching()).with(devTools(...)) }`
  // infers a type referencing these interfaces; if they aren't on the barrel the
  // consumer's declaration emit can't name them and the helper has to erase its
  // own return type (losing `.batch()`/`.undo()`/… for its callers). Found via a
  // real consumer doing exactly that — see docs/audits/2026-07/.
  DevToolsMethods,
  // `exportDebugSession()`'s return shape, for the same reason: a consumer that
  // stores or forwards a session needs to be able to name its type.
  DevToolsDebugSession,
  DevToolsLogEntry,
  DevToolsModuleMetadata,
  DevToolsPerformanceMetrics,

  // Lifecycle
  EnhancerCleanup,

  // Effects
  EffectsMethods,

  // Update metadata (lifted from guardrails in v9.3 for cross-enhancer use)
  UpdateMetadata,
} from './lib/types';

export { SignalTreeRollbackError } from './lib/types';

// Enhancer-author plumbing (EnhancerMeta, withWriteContext,
// getActiveWriteContext, interceptLeafSignals) is not root app API.

// Entity helpers (runtime)
export { entityMap } from './lib/types';
// `entityMap()` RETURNS these — a consumer could call the most-used API in the
// library and not name what it gave them, which is the same gap the
// serialization config types had.
export type {
  EntityMapBuilder,
  DefaultKey,
  ComputedSliceConfig,
  EntityMapComputedSlices,
  EntitySignalWithSlices,
  EntityMapMarkerWithSlices,
} from './lib/markers/entity-map';
// Derived state types (v7)
export type { WithDerived } from './lib/internals/derived-types';

// Derived helper (v7.2) - for defining derived functions in separate files with proper typing
export { derivedFrom } from './lib/internals/derived-types';

// Builder types (v7)
export type { SignalTreeBuilder } from './lib/internals/builder-types';

// ============================================
// MARKER EXPORTS
// ============================================

export {
  // derived() function removed in v6.3.1 - use computed() directly
  type DerivedMarker,
  type DerivedType,
} from './lib/markers/derived';

// Audit tracker — framework-agnostic tree change logging (moved from
// @signaltree/ng-forms in v13, RFC 0006). Tree-shakeable: unused → not bundled.
export {
  createAuditTracker,
  createAuditCallback,
  type AuditEntry,
  type AuditMetadata,
  type AuditTrackerConfig,
} from './lib/audit/audit';

// Async-stream marker — DELETED in 14.0.0, along with its implementation and
// tests. It sat here unexported for several releases while the API question (a
// distinct `asyncStream` marker vs an `accumulate` option on `asyncSource`) went
// unanswered, and leaving 372 lines of one candidate in the tree biased that
// decision toward itself without anyone choosing.
//
// Accumulation is three lines of composition over a plain leaf — and a leaf is
// captured by timeTravel(), appears in tree(), and persists with no marker
// contract to satisfy, which a marker has to earn individually. See
// docs/guides/streaming-accumulation.md. Git has the implementation if the
// answer ever turns out to be "marker".

// Marker processing (v7): `registerMarkerProcessor` is not root app API.

// ============================================
// UTILITY EXPORTS
// ============================================

export {
  // Core utilities - Primary helper functions
  // `equal` (an alias of `deepEqual`) was removed in 14.1.1 — see deep-equal.ts.
  deepEqual,
  toWritableSignal,
  // isNodeAccessor / isTraversableNode / isBuiltInObject / parsePath are not
  // root app API.
} from './lib/utils';

// `getPathNotifier` is not root app API. `composeEnhancers` left the root barrel
// in v12 too and was deleted outright in 15.0 — use `tree.with(a).with(b)`.

// ============================================
// EDIT SESSION (subpath: @signaltree/core/edit-session)
// ============================================

// Moved to '@signaltree/core/edit-session' in v9.
// Import from there to reduce main bundle size.

// ============================================
// SECURITY (subpath: @signaltree/core/security)
// ============================================

// Moved to '@signaltree/core/security' in v9.
// Import from there to reduce main bundle size.

// ============================================
// MEMORY MANAGEMENT EXPORTS
// ============================================
// ENHANCER EXPORTS
// ============================================

// `createEnhancer`, `resolveEnhancerOrder`, `ENHANCER_META` — enhancer-author
// plumbing, not root app API.

// ============================================
// INDIVIDUAL ENHANCER EXPORTS
// ============================================

/**
 * Batching enhancer for high-performance state updates
 *
 * IMPORTANT: Signal writes are ALWAYS synchronous.
 * Batching only affects change detection notification timing.
 *
 * @see {@link batching} for intelligent batching capabilities
 */
export { batching } from './enhancers/batching/batching';

export type { BatchingConfig, BatchingMethods } from './lib/types';

// The `effects()` enhancer was removed in v12 — a SignalTree is made of
// ordinary Angular signals, so use native `effect(() => tree.$.path())`
// (proper injection-context handling; no NG0203 footgun).

/**
 * Time travel enhancer for debugging and undo/redo functionality
 * @see {@link timeTravel} for time travel capabilities
 */
export { timeTravel } from './enhancers/time-travel/time-travel';

/**
 * Transaction enhancer for optimistic updates without temporal history APIs.
 */
export { transactions } from './enhancers/transactions/transactions';

export { persistence } from './enhancers/serialization/serialization';
export type {
  PersistenceConfig,
  PersistenceMethods,
} from './enhancers/serialization/serialization';

/**
 * DevTools enhancer for development and debugging
 * @see {@link devTools} for development tools and Redux DevTools integration
 */
export { devTools } from './enhancers/devtools/devtools';

// ============================================
// CONSTANTS EXPORTS
// ============================================

/**
 * Error messages
 * @see {@link SIGNAL_TREE_MESSAGES} for error/warning messages
 *
 * `SIGNAL_TREE_CONSTANTS` was deleted in 15.0 — every member lost its last
 * consumer with lazy signal creation. See the tombstone in lib/constants.ts.
 */
// SIGNAL_TREE_MESSAGES is not root app API. `isDev` was
// removed from the public surface in 15.0: it had no consumer in this workspace
// or any first-party package, and an app branching on dev mode uses its
// framework's own primitive (Angular's isDevMode()). Core still determines
// dev-ness internally.

// ============================================
// PUBLIC API SUMMARY
// ============================================

/**
 * SignalTree Core API Summary (v9):
 *
 * **Main Factory:**
 * - `signalTree(state, config?)` - Create a reactive signal tree
 *
 * **Markers (things Angular doesn't have):**
 * - `entityMap<T, K>()` - Normalized collections
 * - `stored(key, default)` - localStorage persistence
 *
 * **Enhancers (one function each):**
 * - `batching(config?)` - Batch CD notifications
 * - `timeTravel(config?)` - Undo/redo
 * - `transactions()` - Optimistic transaction rollback without undo/redo history
 * - `devTools(config?)` - Redux DevTools integration
 * - `serialization(config?)` - State serialization
 * - `persistence(config?)` - State persistence
 *
 * **Derived State:**
 * - `.derived($)` - Add computed state to tree
 * - `derivedFrom()` - Helper for separate files
 *
 * @example Basic Usage
 * ```typescript
 * import { signalTree } from '@signaltree/core';
 *
 * const tree = signalTree({ count: 0, user: { name: 'John' } });
 * tree.$.count();          // 0
 * tree.$.user.name();      // 'John'
 * tree.$.count.set(5);     // Update
 * ```
 *
 * @example With Enhancers
 * ```typescript
 * import { signalTree, entityMap, devTools, batching } from '@signaltree/core';
 *
 * const store = signalTree({ users: entityMap<User, number>() })
 *   .with(batching())
 *   .with(devTools({ name: 'MyStore' }));
 *
 * store.$.users.addOne({ id: 1, name: 'Alice' });
 * ```
 */
