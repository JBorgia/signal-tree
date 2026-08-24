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
  RestorationHistoryEntry,
  TransactionMethods,
  RestorationMethods,
  PendingTransaction,

  // Enhancer-added method types. Exported so a DOWNSTREAM LIBRARY can name the
  // return type of its own composition helper in its emitted .d.ts. The finding
  // predates 15.0 and is described in the `.with()` terms it was found in;
  // `.with()` itself is gone, and the need survives it. `.with()` returned
  // `this & TAdded`, so a helper like
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
  WriteMetadata,
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
// captured by restoration(), appears in tree(), and persists with no marker
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

/**
 * @see {@link undoable} — designates an authored causal turn as eligible for
 *   undo. The one public door onto restoration eligibility; the engine's own
 *   vocabulary (`participation`, `intent`, `origin`, restoration designation
 *   metadata) stays internal.
 */
export { undoable } from './lib/undoable';

/**
 * @see {@link external} — classifies the contained writes as state whose
 *   authoritative decision came from OUTSIDE the current authored operation
 *   (`origin: external`, `participation: realized`). Causal authority, not
 *   threads or processes. The one public door onto external-truth
 *   classification; `withWriteContext` stays enhancer plumbing.
 */
export { external } from './lib/external';

// `getPathNotifier` is not root app API. `composeEnhancers` left the root barrel
// in v12 too and was deleted outright in 15.0 — pass the enhancers declaratively:
// `signalTree(state, { enhancers: [a, b] })`. (`.with()` was deleted in 15.0 as
// well; this comment recommended it for one release after it stopped existing.)

// ============================================
// EDIT SESSION — DELETED IN 15.0
// ============================================
//
// `createEditSession` / `createTreeEditSession` / `EditSession` are gone, and the
// reason is that RELEASE-RESIDUE-0 found they were never reachable.
//
//   this comment used to say   "Moved to '@signaltree/core/edit-session' in v9.
//                               Import from there to reduce main bundle size."
//   package.json exports       { ".", "./package.json" }
//
// That subpath never existed in the export map. The capability was implemented,
// tested and documented — and unreachable by any consumer for six major versions.
// Its only importers were its own specs.
//
// "Implemented and tested" is not evidence that something should ship, and
// publishing it now would turn an archaeological accident into a permanent v15
// commitment. Candidate A converged on one package with one "." entry point; the
// MATRIX-CLOSE rule is that only DEMONSTRATED third-party authoring need earns
// public surface, and no consumer has ever demonstrated this one.
//
// If the capability later earns a consumer it comes back deliberately, through
// the established public topology — not by resurrecting the subpath.

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
 * Restoration enhancer for debugging and undo/redo functionality
 * @see {@link restoration} for restoration capabilities
 */
export { restoration } from './enhancers/restoration/restoration';

/**
 * Transaction enhancer for optimistic updates without temporal history APIs.
 */
export { transactions } from './enhancers/transactions/transactions';

export { persistence } from './enhancers/serialization/serialization';
export type { StorageAdapter } from './enhancers/serialization/storage-adapters';
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
 * SignalTree Core API Summary (15.0):
 *
 * ⚠️ This list is a CLAIM OF PUBLIC API and is gated as one
 * (`documented-symbols` in tools/verify-gates.mjs). Two entries survived their
 * own removal here and nothing caught it: `c53aa416` ("remove stored marker
 * from public rc surface") swept the READMEs, guides and demo but left
 * ``- `stored(key, default)` `` in this summary, and `serialization` stopped
 * being exported before Candidate A while still being advertised. Adding a
 * bullet for something this file does not export now fails the gate.
 *
 * **Main Factory:**
 * - `signalTree(state, config?)` - Create a reactive signal tree
 *
 * **Markers (things Angular doesn't have):**
 * - `entityMap<T, K>()` - Normalized collections
 *
 * **Enhancers (one function each):**
 * - `batching(config?)` - Batch CD notifications
 * - `restoration(config?)` - Undo/redo
 * - `transactions()` - Optimistic transaction rollback without undo/redo history
 * - `devTools(config?)` - Redux DevTools integration
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
