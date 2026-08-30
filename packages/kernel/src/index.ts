/**
 * SignalTree: framework-neutral reactive application state with causal semantics
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

/**
 * Type-only read-only narrowing of a tree — same runtime object, no write
 * path offered on the type. The primary readonly surface;
 * `defineStore(factory, { expose: 'readonly' })` is sugar over the same view.
 * @see {@link asReadonly}
 */
export {
  // The per-marker reader-key allowlists are not root app API. They exist to
  // TYPE `asReadonly`; an app calls `asReadonly(tree)` and never names them.
  //
  // ⚠️ `asReadonly` IS KEPT BY PRE-RELEASE-PUBLIC-SURFACE-DEDUPE-0, on a FAILED
  // deterministic case rather than on inertia. A probe suggesting deletion
  // showed `ReadonlyView<typeof tree.$> = tree.$` expresses the narrowing and
  // blocks `.set` — but it addressed the NAMESPACE. For the CALLABLE tree,
  // `ReadonlyView<typeof tree>` loses the call signature, so the annotation
  // cannot express a tree's readonly projection at all. SUBJECT-ADDRESS RULE:
  // a probe must address the same node the API does.
  asReadonly,
} from './lib/readonly';

// ============================================
// TYPE EXPORTS
// ============================================

export type {
  // Core types - Main SignalTree interfaces
  SignalTree,
  TreeNode,
  WritableLeaf,
  AccessibleNode,
  NodeAccessor,
  Primitive,

  // Deep path types - For nested entity access (removed in v6)

  // Configuration types
  TreeConfig,

  // Enhancer system types
  Enhancer,
  // ChainResult removed in v6
  // WithMethod removed in v6 (single-enhancer runtime)

  // Entity types
  EntitySignal,
  EntityMapMarker,
  AddOptions,
  AddManyOptions,

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
  // `exportDebugSession()`'s return shape, for the same reason: a consumer that
  // stores or forwards a session needs to be able to name its type.

  // Lifecycle
  EnhancerCleanup,

  // Effects

  // Update metadata (lifted from guardrails in v9.3 for cross-enhancer use)
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

// ============================================
// MARKER EXPORTS
// ============================================

// TOMBSTONE: `DerivedMarker` / `DerivedType`.
//
// `derived()` was removed in v6.3.1, so for nine major versions these named a
// shape no caller could produce. Exporting a type whose only constructor is gone
// does not preserve compatibility — it advertises one.

// Audit tracker — framework-agnostic tree change logging (moved from
// @signaltree/ng-forms in v13, RFC 0006). Tree-shakeable: unused → not bundled.
export {} from './lib/audit/audit';

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
/**
 * The generic diagnostic observer.
 *
 * ⚠️ `reportTreeError` stays INTERNAL — library code reports, applications
 * observe. `TreeErrorSource` no longer exists, `clearTreeErrorListenersForTesting`
 * is a test helper, and `PositionRegistry` is not dragged public merely because
 * `TreeId` is.
 */
export { onTreeError } from './lib/internals/error-reporter';
export type { TreeErrorEvent } from './lib/internals/error-reporter';
export type { TreeId } from './lib/internals/position-registry';

export { link } from './lib/link';
// `NaturalValue` is deliberately NOT re-exported. It is type-inference
// machinery: `link(source, endpoint)` infers without the caller ever naming it,
// and no third-party authoring need has earned the symbol. It stays exported
// from `link.ts` for declaration emit only.
export type { Link, LinkEndpoint } from './lib/link';

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
//   this comment used to say   "Moved to '@signal-tree/kernel/edit-session' in v9.
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

// ⚠️ RE-EXPORTED FROM THEIR OWNER MODULES, not redeclared. TYPE-BARREL-CONVERGENCE-0
// moved these declarations out of `lib/types.ts` in 15.0. The public import
// contract is unchanged — `import type { BatchingMethods } from
// '@signal-tree/kernel'` still resolves — it now resolves to the ONE canonical
// declaration, beside the enhancer that owns it.
//
//     A PUBLIC RE-EXPORT MAY SURVIVE A MOVE. A SECOND DECLARATION MAY NOT.
export type {
  BatchingConfig,
  BatchingMethods,
} from './enhancers/batching/batching.types';
export type {
  RestorationMethods,
  RestorationHistoryEntry,
} from './enhancers/restoration/restoration.types';
export type {
  DevToolsMethods,
  DevToolsLogEntry,
} from './enhancers/devtools/devtools.types';

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
// PUBLIC because `defineStore(..., 'readonly')` RETURNS it: a kept public API
// must have a nameable return type. The rest of the readonly machinery stays internal.
export type { ReadonlyStore } from './lib/readonly';
// PUBLIC for the same reason as `ReadonlyStore`: `TransactionMethods.transaction()`
// RETURNS it, and a kept public API must have a nameable return type.
export type { PendingTransaction } from './enhancers/transactions/transactions.types';
export type { TransactionMethods } from './enhancers/transactions/transactions.types';
export { transactions } from './enhancers/transactions/transactions';

export type {} from './enhancers/serialization/serialization';

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
 *
 * **Derived State:**
 * - `signalTree(state, { derived })` - Declare computed state
 *
 * @example Basic Usage
 * ```typescript
 * import { signalTree } from '@signal-tree/kernel';
 *
 * const tree = signalTree({ count: 0, user: { name: 'John' } });
 * tree.$.count();          // 0
 * tree.$.user.name();      // 'John'
 * tree.$.count.set(5);     // Update
 * ```
 *
 * @example With Enhancers
 * ```typescript
 * import { signalTree, entityMap, devTools, batching } from '@signal-tree/kernel';
 *
 * const store = signalTree({ users: entityMap<User, number>() })
 *   .with(batching())
 *   .with(devTools({ name: 'MyStore' }));
 *
 * store.$.users.addOne({ id: 1, name: 'Alice' });
 * ```
 */

// PUBLIC-SIGNATURE-CLOSURE-0. Each of these is a FIRST-ORDER CONTRACT TYPE: it
// appears directly in the signature of a KEEP public API and names a value the
// consumer supplies or receives. Found mechanically, not one failure at a time —
// `PendingTransaction` and `ReadonlyStore` were the same class, discovered the
// hard way.
//
//     A TYPE NAMED BY A KEPT PUBLIC API'S SIGNATURE CANNOT BE INTERNAL.
//
// Implementation machinery (the `*Of` carrier binders, ProcessDerived,
// AccumulatedEnhancerAdditions, NaturalValue) stays internal: consumers never
// name it, and exporting it would be "export everything the compiler touches".
export type {
  DevToolsConfig,
  EntityConfig,
  RestorationConfig,
  MutationOptions,
} from './lib/types';
export type { TreeCapability, EnhancerWithMeta } from './lib/enhancer-types';
export type { DevToolsDebugSession } from './enhancers/devtools/devtools.types';
