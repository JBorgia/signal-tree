import type {
  LeafCarriers,
  ReadonlyLeafCarriers,
  ReadonlyViewLeafCarriers,
} from '../adapter';

export type { Location, ReadonlyLocation } from './internals/cell-runtime';

import type { WriteMetadata } from './mutation-types';
import type { NodeAccessor } from './node-accessor';
import type { CallableSyntax, LeafDefinition } from './leaf';

import type { EnhancerWithMeta, TreeCapability } from './enhancer-types';

export { ENHANCER_META } from './enhancer-types';
export type {
  AccumulatedEnhancerAdditions,
  Enhancer,
  EnhancerMeta,
  EnhancerWithMeta,
  TreeCapability,
} from './enhancer-types';
export type {
  WriteParticipation,
  PositionId,
  StructuralEffect,
  WriteMetadata,
} from './mutation-types';
export type { NodeAccessor } from './node-accessor';

// Time travel enhancer configuration (canonical)
export interface RestorationConfig {
  /** Enable/disable time travel (default: true) */
  enabled?: boolean;
  /**
   * Maximum number of completed history entries to keep. Zero retains none.
   * @default 50
   */
  maxHistorySize?: number;

  // `restorationEligibility` was DELETED in 15.0, having done its only job.
  //
  // It existed to execute the opt-in default flip: 'all' kept the pre-15.0
  // semantic while the suite migrated, 'designated' was the target. Once
  // 'designated' was the default and 1811 tests passed under it, a public
  // eligibility MODE would have been a second restoration-admission door
  // competing with `undoable()` — which is the duplication this release spent
  // its time deleting elsewhere.
  //
  // Restoration admission has exactly one public door: `undoable()`.
}
// Core v6 types — type-safe enhancer architecture

// Primitives
export type Primitive =
  | string
  | number
  | boolean
  | null
  | undefined
  | bigint
  | symbol;

// NOTE: A `declare module '@angular/core'` augmentation that added callable
// overloads to Angular's `WritableCell<T>` previously lived here. It was
// removed because it is a *global* augmentation: importing anything from
// `@signal-tree/kernel` would activate it project-wide and conflict with
// libraries that depend on the original invariant `WritableCell<T>`
// signature (notably `@ngrx/signals`' `WritableStateSource<T>`, which became
// invariance-incompatible — surfacing as ~30 TS2345 errors in mixed
// `@ngrx/signals` + SignalTree codebases). There is no opt-in replacement:
// `@signaltree/callable-syntax`, which owned that augmentation, was DELETED in
// 14.0.0 because it re-introduced this same conflict and because the build
// transform behind it could never run inside an Angular app. There is no
// supported way to make a raw Angular signal callable-as-setter.

/**
 * Every canonical SignalTree location has one callable grammar:
 *
 * | operation | spelling |
 * |---|---|
 * | read | `location()` |
 * | replace | `location(value)` |
 * | derive from current | `location(current => next)` |
 * | replace with callable data | `location(leaf(callable))` |
 *
 * Branch writes replace a complete value; they do not infer a partial merge.
 * There are deliberately no `.set()` or `.update()` methods because state may
 * legally contain keys with those names. `leaf(value)` marks a terminal
 * topology boundary and disambiguates callable data from an updater.
 */
/**
 * The literal (declared) keys of `S`, discarding any `string`/`number` index
 * signature.
 *
 * Needed because `entityMap()` seeds its slice record as `Record<string, never>`
 * and `.computed()` accumulates by intersection — so two slices on one
 * collection type as `Record<string, never> & Record<'a', A> & Record<'b', B>`.
 * A bare `keyof` on that yields `string`, which would map to a junk index
 * signature instead of the two real slice names, and an `extends
 * Record<string, never>` emptiness test wrongly matches it (the intersection is
 * still assignable to the seed). Filtering the index signature out is what
 * makes both the emptiness check and the key mapping correct.
 */
type LiteralKeys<S> = keyof {
  [K in keyof S as string extends K
    ? never
    : number extends K
    ? never
    : K]: S[K];
};

/**
 * Materialize an `entityMap().computed()` slice record onto the collection's
 * signal type.
 *
 * `entityMap()`'s builders track their slices at the type level in a phantom
 * `__sliceTypes` property (`EntityMapBuilder` in
 * `markers/entity-map.ts`). The runtime already attaches each slice as a
 * `computed` on the materialized entity signal, so `tree.$.plants.byUrl()` has
 * always WORKED — this type is what makes it *typed* rather than requiring
 * `(tree.$.plants as any).byUrl()`.
 *
 * A slice-free collection has no literal slice keys and resolves to exactly
 * `EntitySignal<E, K>`, unchanged.
 *
 * Declared here rather than reusing `EntitySignalWithSlices` because
 * `markers/entity-map.ts` imports from this file — the dependency runs one way.
 */
type ApplyComputedSlices<
  TMarker,
  TBase,
  C extends CarrierKind
> = TMarker extends {
  __sliceTypes?: infer S;
}
  ? [LiteralKeys<NonNullable<S>>] extends [never]
    ? TBase
    : TBase & {
        readonly [P in LiteralKeys<NonNullable<S>>]: ReadonlyOf<
          NonNullable<S>[P],
          C
        >;
      }
  : TBase;

/**
 * ⚠️ THE COMMENT THAT WAS HERE WAS STALE, AND IT DESCRIBED SOMETHING ABSENT.
 *
 * It said the index signature had been "relaxed to permit dynamic string
 * indexing … for better editor DX". There is no catch-all index signature in
 * this type and there never was: `TreeNode<T>` is a pure RECURSIVE MAPPED TYPE.
 * When `T` is open-keyed — `keyof Record<string, V>` IS `string` — the mapping
 * derives descendant shape for arbitrary keys as a CONSEQUENCE of recursively
 * mapping the author's `T`, not as a hand-written dynamic-indexing affordance.
 *
 * That distinction is load-bearing (OPEN-KEY-OWNERSHIP-0). The open question is
 * NOT whether SignalTree should expose keyed child locations — the recursive
 * mapper already derives them from `T`. It is:
 *
 *     CAN THE RUNTIME MAKE THE RECURSIVE TYPE MODEL TRUE WHEN STRUCTURAL KEYS
 *     APPEAR AFTER CONSTRUCTION?
 *
 * Measured today, it cannot: `tree.$.rows['neverMaterialised']` typechecks,
 * is `undefined` at runtime, and throws "loc is not a function" when called —
 * see `open-key-reachability.spec.ts`, which executes that target claim.
 *
 *     AN UNREACHABLE CAPABILITY IS A FALSE CLAIM, NOT A STALE DOC.
 *
 * ⚠️ AN EARLIER REVISION OF THIS TYPE COLLAPSED OPEN-KEYED OBJECTS INTO ONE
 * OPAQUE WHOLE-VALUE LOCATION (`string extends keyof T ? Record<never, never>`),
 * on the reasoning that arbitrary descendants were an accidental DX artifact.
 * That was REVERTED: it deleted a capability the recursive model derives
 * legitimately, and it cost every hybrid `interface X extends Record<string,
 * unknown>` its child topology — measured, 23 sites, most of them generic
 * CONSTRAINTS rather than open-key intent. The burden is on proving the runtime
 * CANNOT carry dynamic keys, not on proving the type should stop promising them.
 */
/**
 * Universal recursive shape law shared by every framework facade.
 */
export type CarrierKind = keyof LeafCarriers<unknown> &
  keyof ReadonlyLeafCarriers<unknown> &
  keyof ReadonlyViewLeafCarriers<unknown>;
export type LeafOf<T, C extends CarrierKind> = LeafCarriers<T>[C];

export type TreeNodeOf<T, C extends CarrierKind> = {
  [K in keyof T]: T[K] extends LeafDefinition<infer Value>
    ? LeafOf<Value, C>
    : T[K] extends EntityMapMarker<infer E, infer Key>
    ? ApplyComputedSlices<T[K], EntitySignalOf<E, Key, C>, C>
    : T[K] extends Primitive
    ? LeafOf<T[K], C>
    : T[K] extends readonly unknown[]
    ? LeafOf<T[K], C>
    : T[K] extends
        | Date
        | RegExp
        | Map<unknown, unknown>
        | Set<unknown>
        | Error
        | ((...args: unknown[]) => unknown)
    ? LeafOf<T[K], C> // Built-in objects → treat as atomic values
    : T[K] extends object
    ? NodeAccessor<ResolveLeafDefinitions<T[K]>> & TreeNodeOf<T[K], C>
    : LeafOf<T[K], C>;
};

export type TreeNode<T> = TreeNodeOf<T, 'location'>;

export type ResolveLeafDefinitions<T> = T extends LeafDefinition<infer Value>
  ? Value
  : T extends EntityMapMarker<infer _Entity, infer _Key>
  ? T
  : T extends readonly unknown[]
  ? T
  : T extends
      | Date
      | RegExp
      | Map<unknown, unknown>
      | Set<unknown>
      | Error
      | CallableSyntax
  ? T
  : T extends object
  ? { [K in keyof T]: ResolveLeafDefinitions<T[K]> }
  : T;

// NOTE: The read-only view types (`ReadonlyView`, `ReadonlyStore`,
// `ReadonlyNodeAccessor`, the per-marker `Readonly*Signal` views and their
// reader-key allowlists, and `asReadonly()`) live in `./readonly.ts`. They
// are computed over a tree's ACCUMULATED `$` type (the builder's `TAccum`),
// not over the source `T` — a source-computed view drops configured derived
// computed (RFC 0004 F1), which is why no `ReadonlyTreeNode<T>` mirror of
// `TreeNode<T>` exists here.

// Base SignalTree minimal interface
// v6: primary runtime tree type is `SignalTree<T>`; a deprecated alias
// `SignalTree<T>` is provided at the end of this file for compatibility.
/**
 * The readonly projection of a universal location.
 */
export type ReadonlyOf<
  T,
  C extends CarrierKind = 'location'
> = ReadonlyLeafCarriers<T>[C];

export type ReadonlyViewLeafOf<
  T,
  C extends CarrierKind = 'location'
> = ReadonlyViewLeafCarriers<T>[C];

/**
 * The universal tree contract shared by every framework facade.
 * The canonical whole-tree NaturalValue reader returns the correct committed
 * snapshot. Repeated reads return the same root object while committed truth is
 * unchanged. The greenfield tree controller is non-callable; its root `$`
 * accessor owns the same read / whole-value replacement / updater grammar as
 * every ordinary state node. After a change, identity of arbitrary unchanged
 * descendants is not a public contract; implementations may reuse them to
 * materialize snapshots cheaply.
 */
export interface ISignalTreeOf<
  T,
  C extends CarrierKind,
  TAccum = TreeNodeOf<T, C>
> {
  /** Canonical root state accessor: read, whole-value replace, or derive. */
  readonly $: NodeAccessor<T> & TAccum;
  /**
   * `with()` IS GONE, ON PURPOSE — this note is the tombstone.
   *
   * Enhancers are declared in `signalTree`'s config and applied once, during
   * construction. Late enhancement is not deprecated-with-a-shim; it is
   * removed, because it was what made the build plan unknowable: `.with()` had
   * to materialize before applying each enhancer, so the plan was fixed before
   * the first enhancer was ever seen and every tree got the maximal plan.
   *
   * The accumulated enhancer surface still reaches the caller — through the
   * return type of `signalTree`, via `AccumulatedEnhancerAdditions`.
   *
   * Do NOT re-add a `with()` here "for compatibility". It would be a second
   * construction engine with its own copy of duplicate detection and
   * requirement checking, able to disagree with
   * `assertEnhancerConfigurationValid` about the same configuration — which is
   * exactly the state 15.0 removed.
   */
  destroy(): void;
  /** Whether this tree has been destroyed. */
  readonly destroyed: ReadonlyOf<boolean, C>;
  /**
   * Register a cleanup function to be called when the tree is destroyed.
   * Enhancers should use this to release resources (intervals, subscriptions, etc.).
   */
  registerCleanup(fn: EnhancerCleanup): void;
  /**
   * Apply a partial update and return the dot-paths of locations that
   * actually changed.
   *
   * "Actually changed" is literal: a path appears only if the location
   * accepted the write. Values that are ref-equal to the current value are
   * skipped before replacement, and values that are a NEW reference but
   * DEEP-EQUAL are rejected by the location's own equality policy — a re-fetched server
   * payload that matches what you already hold reports `[]`, not every key
   * in the payload.
   *
   * Useful for partial server-payload sync, change-log/audit trails, and
   * targeted persistence.
   *
   * @example
   * ```ts
   * const changed = tree.updateAndReport(serverPayload);
   * if (changed.length) persistKeys(changed);
   * ```
   */
  updateAndReport(updates: Partial<T> | ((current: T) => Partial<T>)): string[];
  // Allow enhancers to attach runtime methods — consumers should cast to the
  // specific enhanced shape they expect (e.g. `SignalTree<T> & BatchingMethods<T>`).
}

export type ISignalTree<T, TAccum = TreeNode<T>> = ISignalTreeOf<
  T,
  'location',
  TAccum
>;

/** Cleanup function returned or registered by enhancers. */
export type EnhancerCleanup = () => void;

// Method interfaces
// TOMBSTONE: `EffectsMethods`.
//
// A PUBLIC TYPE DESCRIBING AN ENHANCER THAT NO LONGER EXISTS. `effects()` was
// removed years ago; the interface kept shipping, nothing implemented it, and
// the root README still listed the enhancer as "deprecated, removal next major"
// long after the removal. A type nobody can obtain is not compatibility.

/**
 * Methods added by the batching() enhancer.
 *
 * IMPORTANT: Signal writes are ALWAYS synchronous.
 * Batching only affects change detection notification timing.
 */

/**
 * Time-travel capability.
 *
 * NOT generic in the state, and that is the point. `getRestorationHistory()` returns the
 * history of the tree the methods are attached to, so the state is recovered
 * from polymorphic `this` — which is what the semantics always were. The
 * previous `RestorationMethods<T>` carried a second copy of the state type
 * purely so the enhancer could transport it, and that generic is what forced
 * enhancer signatures to name `ISignalTree<T>`.
 *
 * THE CONDITIONAL IS INLINE ON PURPOSE. A named `StateOf<T>` helper reads
 * better here but has no independent public concept to own, and it cannot stay
 * private: the declaration pipeline keeps a non-exported INTERFACE (see
 * `EnhancerHost`) but PRUNES a non-exported type alias while leaving the
 * reference to it behind — emitting a `.d.ts` that names an undeclared type.
 * That is invisible under `skipLibCheck` and a hard error without it. Inlining
 * makes the emitted signature self-contained without adding a public symbol.
 *
 * State inference is preserved for consumers:
 * `getRestorationHistory()[0].state` is the exact concrete state when
 * restoration is supplied through the declarative enhancer tuple.
 */

/**
 * Thrown when a pending transaction cannot be rolled back conservatively.
 *
 * The public contract is intentionally narrow: callers only need to know that
 * rollback failed and the optimistic state may need reconciliation or refetch.
 * Richer causal details may be attached as an internal `cause` payload for
 * tooling, but that shape is not part of the application-facing API.
 */
export class SignalTreeRollbackError extends Error {
  readonly code = 'SIGNALTREE_ROLLBACK_FAILED';
  // NOT declared as a field. Whether `cause` exists on `Error` depends on the
  // lib target, and the workspace disagrees: the demo's compiler requires
  // `override` (TS4114) while core's rollup build rejects it as not present in
  // the base (TS4113). Assigning without declaring satisfies both.

  constructor(
    message = 'SignalTree could not rollback the pending transaction',
    options?: { cause?: unknown }
  ) {
    super(message);
    this.name = 'SignalTreeRollbackError';
    (this as { cause?: unknown }).cause = options?.cause;
    Object.setPrototypeOf(this, SignalTreeRollbackError.prototype);
  }
}

/**
 * Marker interface indicating entities have been materialized at runtime.
 * Prefer accessing entity collections via `tree.$.prop` (typed as `EntitySignal`).
 */
export interface EntitiesEnabled {
  /** @internal */
  readonly __entitiesEnabled?: true;
}

// ============================================
// CONFIGURATION TYPES
// ============================================

export interface TreeConfig {
  // ⚠️ `batchUpdates` was RETIRED in 15.0 — BATCH-UPDATES-INTENT-0.
  //
  // Its original requirement was to avoid repeated observer delivery, and that
  // requirement SURVIVES: the optional delivery engine still queues and
  // coalesces notifications, because that layer owns notification cost.
  //
  // What did not survive is the tree-level policy. `batchUpdates: false` also
  // exposed synchronous, uncoalesced observer delivery — an implementation
  // consequence of disabling the optimization, never a documented contract.
  // This file's own docs said "Signal writes are ALWAYS synchronous; batching
  // only affects change detection notification timing", so no promise about
  // observer timing was ever made.
  //
  //     AN OPTIMIZATION KNOB DOES NOT BECOME A SEMANTIC CONTRACT JUST BECAUSE
  //     DISABLING THE OPTIMIZATION EXPOSES DIFFERENT TIMING.
  //
  // It was also the wrong owner: a TreeConfig field configuring the observer
  // DELIVERY scheduler, which is why its value lived at package lifetime and a
  // second tree silently reconfigured the first (measured). Delivery timing is
  // per-observer, not per-tree — Angular UI, DevTools, audit and external
  // bridges legitimately want different scheduling, and one tree-global boolean
  // cannot express that.
  //
  // Zero authored first-party claimants across 1,815 files (BATCH-UPDATES-
  // SURVIVAL-0.2). Synchronous delivery may return later at an OBSERVER-specific
  // boundary if a real consumer earns it.
  //
  // `enableTimeTravel` was REMOVED here in 14.1.1: it had ZERO consumers in
  // signal-tree.ts and silently did nothing, while a working flag of the same
  // name lives on `DevToolsConfig`. The one a user reached for first was the
  // dead one. Attach `restoration()` as an enhancer instead.

  // `useLazySignals` and `lazy` were REMOVED in 15.0 — see the tombstone after
  // this interface. Both were inert: the subpath that supplied the feature was
  // withdrawn from the published surface, so neither option could be satisfied.
  useShallowComparison?: boolean;

  // ⚠️ FIVE OPTIONS WERE DELETED HERE IN 15.0 — TREE-CONFIG-DEAD-SURFACE-0.
  //
  //     name                  enableDevTools        maxCacheSize
  //     trackPerformance      useStructuralSharing
  //
  // Each measured ZERO production readers, resolved by declaration symbol
  // (tools/tree-config-consumers.mjs), and zero consumers anywhere else in the
  // workspace. On the same run the instrument found real readers for
  // `enhancers`, `capabilities`, `derived`, `useShallowComparison` and
  // `debugMode` — so this is a measurement, not a detector that saw nothing.
  //
  // This is a stronger case than `batchUpdates` above. That option at least had
  // a real behavioural distinction nobody claimed; these had no reader at all:
  //
  //     A CONFIGURATION INPUT WITH NO READER CANNOT AFFECT THE CONFIGURED
  //     SYSTEM.
  //
  //     PUBLIC AUTHORING SYNTAX WITHOUT A PRODUCTION DECISION IS NOT A
  //     CAPABILITY.
  //
  // `useStructuralSharing` is the clearest reason not to keep them inert: its
  // spelling tells an author it controls how state is shared, and it controlled
  // nothing. An inert option that reads as a capability is worse than an absent
  // one. No deprecation, no alias, no relocation, and deliberately NO attempt to
  // implement the behaviour their names imply — that would be inventing a
  // feature from a spelling.
  //
  // `debugMode` SURVIVES and sits below: it has two real readers, both
  // logging-only (DEBUG-MODE-OWNERSHIP-0 — owner DIAGNOSTIC).
  debugMode?: boolean;

  /**
   * Enhancers to apply, declared up front.
   *
   * The whole set has to be known before the tree is built, because the build
   * plan is derived from it: which capabilities to resolve, whether to install
   * mutation metadata, whether a physical commit clock is needed. A chained
   * `.with()` could not supply that -- it had to materialize before applying
   * each enhancer, so the plan was always fixed before the first enhancer was
   * seen.
   *
   * Declaration order does not matter. Requirements are validated against the
   * union of everything configured, then the set is topologically ordered so
   * providers run before consumers.
   */
  enhancers?: readonly EnhancerWithMeta<unknown>[];

  /**
   * Capabilities to install regardless of which enhancers are configured.
   *
   * Enhancers normally declare what they need, and that is the ordinary path.
   * This exists for the case with no enhancer to speak for the requirement:
   * driving the causal runtime directly, or a consumer that wants position
   * topology without adopting a feature that happens to imply it. Dependencies
   * resolve the same way -- requesting `causal-runtime` also installs
   * `mutation-capture` and `position-topology`.
   */
  capabilities?: readonly TreeCapability[];

  /**
   * Derived state, declared with the enhancers rather than chained after them.
   *
   * Runs against the tree's `$` and returns a partial shape of `computed()`
   * signals, merged lazily on first `$` access after every enhancer is applied.
   *
   * The parameter is typed `never` here on purpose. `TreeConfig` has no `T` to
   * name, so the honest declaration is the bottom type — every concrete factory
   * `($: TreeNode<T>) => TDerived` is assignable to it. The real typing, and the
   * `ProcessDerived<TDerived>` in the result, come from the `signalTree`
   * overload that recognises this field.
   */
  derived?: ($: never) => object;

  // RELEASE-RESIDUE-0: an ORPHANED JSDoc block sat here — twenty lines telling
  // readers to `import { security, SecurityPresets } from
  // '@signal-tree/kernel/security'` and to pass `security: security(config)`. The
  // FIELD it documented was already gone with SEC-DEL; only its documentation
  // survived, inside a live public interface, describing a subpath that no
  // longer resolves. The tombstone that matters is in `signal-tree.ts`.
}

/**
 * LAZY SIGNAL CREATION IS GONE IN 15.0 — `TreeConfig.lazy`,
 * `TreeConfig.useLazySignals`, the `LazyFeature` type, the
 * `@signal-tree/kernel/lazy` subpath, the lazy proxy and `SignalMemoryManager`.
 *
 * It was already unreachable. `18fe5781` withdrew the subpath from
 * `package.json` exports and from the rollup entry list, so `lazy()` could not
 * be imported by any consumer — while `TreeConfig.lazy` still accepted it,
 * `useLazySignals` still claimed to force it, and ST1032 still told users at
 * runtime to import from a path that does not ship. An option nobody can
 * satisfy is worse than an absent one: it reads as a capability.
 *
 * It was also never derived. `check-rc-public-dispositions.mjs` records it as
 * "UNPLACED threshold-driven subpath; no RC authority recorded", the 15.0
 * product-core map leaves row 34 "unassigned to any layer", and no benchmark in
 * this repo ever measured it — there is no arm, no figure, no document.
 *
 * What DOES survive is the thing people actually wanted from it. Incremental
 * materialization memoises each node and returns clean subtrees by reference,
 * so reading a 10k-leaf tree after one leaf changed costs 149µs against 1808µs
 * for a full rebuild (`incremental-materialization.spec.ts`). That is lazy
 * READING, measured, on the default path. The deleted feature was lazy
 * CREATION through a Proxy, and its benefit was never established.
 *
 * If large-state construction cost turns out to matter, measure it first —
 * `bench-workload-classes.mjs` BULK_LOAD constructs 100k entities in ~159ms —
 * and let the number justify the mechanism. Do not restore this on the argument
 * that it used to be here.
 */

// TOMBSTONE: `FormHistoryOptions`, `FormHistoryApi` and
// `FormHistorySharedAuthority` went with `trackHistory()` in TH-DEL.
//
// TH-0 measured the reason and it is not disuse. `trackHistory` undid by
// WRITING BACK — `model.update(m => ({...m, ...next}))` — so over a SignalTree
// branch its undo was a new authored mutation, which `restoration()` then
// recorded as forward motion. The two systems did not merely overlap: a
// `tree.undo()` after a `hist.undo()` REDID the edit. Over a plain Angular
// signal it was correct, but that is the case with no SignalTree involvement,
// so there was no ownership claim on either branch.
//
// Do not reintroduce a generic writable-signal history here. For state in a
// tree, `restoration()` is the restoration authority; for a signal outside one,
// this library is not in the picture. See
// docs/architecture/v15-production-surface-audit.md, TH-0.

// ============================================
// FEATURE TYPES
// ============================================

// ============================================
// ENTITY MAP & SIGNAL TYPES
// ============================================

/**
 * Entity configuration options
 */
export interface EntityConfig<E, K extends string | number = string> {
  /**
   * Extract ID from entity. Default: (e) => e.id
   * Required if entity doesn't have 'id' property.
   */
  selectId?: (entity: E) => K;

  /**
   * Optional comparator that keeps `all` and `ids` in a stable sorted order
   * (parity with @ngrx/entity's `sortComparer`). When provided, the `all()`
   * and `ids()` signals reflect this order regardless of insertion order;
   * `map()` retains insertion order. Omit for insertion-order collections.
   *
   * @example
   * entityMap<User>({ sortComparer: (a, b) => a.name.localeCompare(b.name) })
   */
  sortComparer?: (a: E, b: E) => number;

  /**
   * Entity-level hooks (run before collection hooks)
   */
  hooks?: {
    /** Transform or block before add. Return false to block, entity to transform. */
    beforeAdd?: (entity: E) => E | false;
    /** Transform or block before update. Return false to block, changes to transform. */
    beforeUpdate?: (id: K, changes: Partial<E>) => Partial<E> | false;
    /** Block before remove. Return false to block. */
    beforeRemove?: (id: K, entity: E) => boolean;
  };
}

/**
 * Unique symbol for EntityMapMarker branding.
 * NOT EXPORTED - this prevents external code from creating types that satisfy EntityMapMarker.
 * This is critical for correct type inference in generic contexts.
 */
declare const ENTITY_MAP_BRAND: unique symbol;

/**
 * Runtime marker for entity collections.
 * Uses a unique symbol brand to ensure only types created via entityMap() can satisfy this interface.
 * This prevents generic mapped type conditionals from producing unions.
 */
export interface EntityMapMarker<E, K extends string | number> {
  /** Unique brand - only satisfiable by entityMap() since symbol is not exported */
  readonly [ENTITY_MAP_BRAND]: { __entity: E; __key: K };
  /** Runtime marker so enhancers can detect entity collections */
  readonly __isEntityMap: true;
  /** Persisted config used when materializing the EntitySignal */
  readonly __entityMapConfig?: EntityConfig<E, K>;
}

/**
 * Create an entity map marker for use in signalTree state definition.
 * This is the ONLY way to create a type that satisfies EntityMapMarker,
 * since the brand symbol is not exported.
 *
 * @example
 * ```typescript
 * const tree = signalTree({
 *   users: entityMap<User>(),
 *   products: entityMap<Product, number>(),
 * });
 * ```
 *
 * @see {@link ./markers/entity-map.ts} for the self-registering implementation
 */
// Re-export from self-registering marker module
export { entityMap } from './markers/entity-map';

/**
 * Mutation options
 */
export interface MutationOptions {
  onError?: (error: Error) => void;
}

export interface AddOptions<E, K> extends MutationOptions {
  selectId?: (entity: E) => K;
}

export interface AddManyOptions<E, K> extends AddOptions<E, K> {
  mode?: 'strict' | 'skip' | 'overwrite';
}

/**
 * Tap handlers - observe entity lifecycle events
 */
export interface TapHandlers<E, K extends string | number> {
  onAdd?: (entity: E, id: K) => void;
  onUpdate?: (id: K, changes: Partial<E>, entity: E) => void;
  onRemove?: (id: K, entity: E) => void;
  onChange?: () => void;
}

/**
 * Intercept context for blocking/transforming mutations
 */
export interface InterceptContext<T> {
  block(reason?: string): void;
  transform(value: T): void;
  readonly blocked: boolean;
  readonly blockReason: string | undefined;
}

/**
 * Intercept handlers - block or transform mutations before they happen
 */
export interface InterceptHandlers<E, K extends string | number> {
  onAdd?: (entity: E, ctx: InterceptContext<E>) => void;
  onUpdate?: (
    id: K,
    changes: Partial<E>,
    ctx: InterceptContext<Partial<E>>
  ) => void;
  onRemove?: (id: K, entity: E, ctx: InterceptContext<void>) => void;
}

/**
 * Entity node with deep signal access
 */
export type EntityNodeOf<E, C extends CarrierKind> = {
  (): E;
  (value: E): void;
  (updater: (current: E) => E): void;
} & {
  [P in keyof E]: E[P] extends object
    ? E[P] extends readonly unknown[]
      ? LeafOf<E[P], C>
      : EntityNodeOf<E[P], C>
    : LeafOf<E[P], C>;
};

export type EntityNode<E> = EntityNodeOf<E, 'location'>;

/**
 * EntitySignal provides reactive entity collection management.
 */
/**
 * The entity contract, parametric over the carrier. INTERNAL.
 *
 * TYPE-A-PACKAGE-BINDING-0. Entity surfaces hard-coded the carrier independently
 * of the tree, so Angular consumers saw neutral cells for `row.name`, `.empty`
 * and `.asReadonly()` even after the tree bound `'angular'`. Only the DECLARED
 * carrier changes here: EntityMap identity, membership, ordering, selection,
 * changeId and bulk semantics are untouched, as is the runtime.
 */
export interface EntitySignalOf<
  E,
  K extends string | number,
  C extends CarrierKind
> {
  // Explicit access
  byId(id: K): EntityNodeOf<E, C> | undefined;
  byIdOrFail(id: K): EntityNodeOf<E, C>;

  // Queries (readonly properties returning signals)
  readonly all: ReadonlyOf<E[], C>;
  readonly count: ReadonlyOf<number, C>;
  readonly ids: ReadonlyOf<K[], C>;
  has(id: K): ReadonlyOf<boolean, C>;
  /**
   * True when the collection has no entities. v10.3 canonical name —
   * aligns with FormControl-style bare-boolean accessors used across
   * `status` / `form` / `asyncSource` markers.
   */
  readonly empty: ReadonlyOf<boolean, C>;
  /**
   * The collection as a `ReadonlyMap`, keyed by id. Renamed from `map` in 14.1.1 —
   * `map` read as a projection beside `all()`, which is what `.map(fn)` means to
   * every JS developer.
   */
  readonly asMap: ReadonlyOf<ReadonlyMap<K, E>, C>;
  where(predicate: (entity: E) => boolean): ReadonlyOf<E[], C>;
  find(predicate: (entity: E) => boolean): ReadonlyOf<E | undefined, C>;

  // Active entity — the master/detail primitive.
  //
  // Added in 14.0.0 after a capability audit found peer stores ship it
  // and every team otherwise hand-rolls `activeId: null` plus a derived lookup.
  // `activeEntity` resolves through `byId`, so it is O(1) and invalidates only
  // when THAT row changes — finer-grained than the filtered-stream versions the
  // other libraries offer.
  readonly activeId: ReadonlyOf<K | undefined, C>;
  readonly activeEntity: ReadonlyOf<E | undefined, C>;
  setActiveId(id: K | undefined): void;
  clearActiveId(): void;

  // Mutations
  addOne(entity: E, opts?: AddOptions<E, K>): K;
  addMany(entities: E[], opts?: AddManyOptions<E, K>): K[];
  /** Insert at the FRONT. Feeds, chat logs, activity streams. */
  prependOne(entity: E, opts?: AddOptions<E, K>): K;
  prependMany(entities: E[], opts?: AddManyOptions<E, K>): K[];
  /**
   * Change an entity's id in place, preserving its position.
   *
   * The missing half of optimistic creation: insert with a temp id, then adopt
   * the id the server assigned. Without it the only option is remove-then-add,
   * which loses list position, orphans any node held from `byId(tempId)`, and
   * breaks any UI state keyed by the old id.
   */
  changeId(from: K, to: K): void;
  /** Merge `changes` into the entity at `id`. The patch half of the write surface. */
  updateOne(id: K, changes: Partial<E>, opts?: MutationOptions): void;
  /**
   * REPLACE the entity at `id` outright — the missing half of `updateOne`.
   *
   * `updateOne` spreads (`{ ...entity, ...changes }`), so it cannot REMOVE a key.
   * Before this existed the only replace was `setAll(all().map(...))`: whole-collection
   * work to change one row, which is the anti-pattern the library exists to avoid.
   * This is O(1) and position-preserving.
   *
   * Takes the id explicitly and deliberately. A `setOne(entity)` that derived the
   * key via `selectId` would write to the wrong slot whenever `changeId` has left
   * `entity.id` disagreeing with the storage key — the caller's id cannot drift.
   */
  replaceOne(id: K, entity: E, opts?: MutationOptions): void;
  updateMany(ids: K[], changes: Partial<E>, opts?: MutationOptions): void;
  updateWhere(predicate: (entity: E) => boolean, changes: Partial<E>): number;
  upsertOne(entity: E, opts?: AddOptions<E, K>): K;
  upsertMany(entities: E[], opts?: AddOptions<E, K>): K[];
  removeOne(id: K, opts?: MutationOptions): void;
  removeMany(ids: K[], opts?: MutationOptions): void;
  removeWhere(predicate: (entity: E) => boolean): number;
  /** Empty the collection. There is no `removeAll` alias — this is the one name. */
  clear(): void;
  setAll(entities: E[], opts?: AddOptions<E, K>): void;

  // Hooks
  tap(handlers: TapHandlers<E, K>): () => void;
  intercept(handlers: InterceptHandlers<E, K>): () => void;
}

export type EntitySignal<
  E,
  K extends string | number = string
> = EntitySignalOf<E, K, 'location'>;

/**
 * @deprecated The old EntityHelpers interface is deprecated and will be removed in v6.0.
 * Use the new Map-based entity API instead:
 *
 * **Migration:**
 * ```typescript
 * // Old (deprecated):
 * interface State { users: User[] }
 * const tree = signalTree<State>({ users: [] });
 * const helpers = tree.entities<User>('users');
 * helpers.add(user);
 * helpers.selectById(id)();
 *
 * // New (recommended):
 *
 * interface State { users: entityMap<User> }
 * const tree = signalTree<State>({ users: entityMap<User>() });
 * tree.$.users.addOne(user);
 * tree.$.users.byId(id)?.();
 * ```
 *
 * @see entityMap for the new marker function
 */
// Legacy `EntityHelpers` removed — v6 uses `EntitySignal` via `tree.$.prop`.

// LoggingConfig / LogEntry / ValidationConfig were removed in 14.0.0. They
// described enhancers that do not exist on this surface, were reachable from no
// entry point, and were referenced by nothing — de-exporting them is what let
// eslint finally see they were dead.
export interface DevToolsConfig {
  /** Enable Redux DevTools browser extension */
  enableBrowserDevTools?: boolean;
  /** Enable internal logging */
  enableLogging?: boolean;
  /** Performance warning threshold (ms) */
  performanceThreshold?: number;
  /** Enable Redux DevTools time-travel integration */
  enableTimeTravel?: boolean;
  /**
   * Name shown in Redux DevTools.
   *
   * The `treeName` alias was REMOVED in 14.1.1 — the source called it "legacy
   * support" and `name ?? treeName` meant `name` always won anyway.
   */
  name?: string;
  /** Enable/disable devtools connection */
  enabled?: boolean;
  /** Log actions to console */
  logActions?: boolean;
  /** Max history entries to keep */
  maxAge?: number;
  /** Limit sends to at most once every N milliseconds (0 = no limit) */
  rateLimitMs?: number;
  /** Limit sends by rate (overrides rateLimitMs if provided) */
  maxSendsPerSecond?: number;
  /** Only include actions matching these path patterns */
  includePaths?: string[];
  /** Exclude actions matching these path patterns */
  excludePaths?: string[];
  /** Customize how paths are formatted for display */
  formatPath?: (path: string) => string;
  /** Maximum serialization depth for devtools state snapshots */
  maxDepth?: number;
  /** Maximum array length to serialize per path */
  maxArrayLength?: number;
  /** Maximum string length to serialize per field */
  maxStringLength?: number;
  /** Optional custom serializer for devtools state snapshots */
  serialize?: (state: unknown) => unknown;
  /**
   * Configuration for sharing a single Redux DevTools instance across multiple stores.
   * When provided, stores with the same id will share a single DevTools connection.
   */
  aggregatedReduxInstance?: {
    id: string;
    name?: string;
  };
  features?: {
    jump?: boolean;
    skip?: boolean;
    reorder?: boolean;
  };
}

/**
 * Type utilities for entities
 */
// EntityType / EntityKeyType / IsEntityMap were removed in 14.0.0: unreachable
// from every entry point and referenced by nothing, in either this repo or a
// consumer's — the exports map has no wildcard, so no consumer could import
// them even deliberately.

/**
 * TreeNode augmented with entity signals
 */
/**
 * Deep recursive tree node shape used for advanced, opt-in typing.
 * This expands nested objects into `EntitySignal` / `EntityNode` shapes
 * and is intentionally expensive for TypeScript to compute. Exported
 * as `DeepEntityAwareTreeNode` so callers can opt-in when they need
 * the full deep inference.
 */
export type DeepEntityAwareTreeNode<T> = {
  [K in keyof T]: T[K] extends EntityMapMarker<infer E, infer Key>
    ? ApplyComputedSlices<T[K], EntitySignal<E, Key>, 'location'>
    : T[K] extends object
    ? DeepEntityAwareTreeNode<T[K]>
    : WritableLeaf<T[K]>;
};

/**
 * Shallow public tree node used by default in most public APIs.
 * This avoids eagerly expanding deeply nested types and keeps
 * editor/CI responsiveness high while preserving common DX.
 * Consumers who want the fully expanded shape can opt-in via
 * `TypedSignalTree<T>` (see below) or use `DeepEntityAwareTreeNode`.
 */
export type EntityAwareTreeNode<T> = {
  [K in keyof T]: T[K] extends EntityMapMarker<infer E, infer Key>
    ? ApplyComputedSlices<T[K], EntitySignal<E, Key>, 'location'>
    : WritableLeaf<T[K]>;
};

/**
 * Opt-in alias providing the full depth-expanded SignalTree typing.
 * Use when you explicitly want deep compile-time inference for nested
 * structures. Example:
 *
 *   type MyTyped = TypedSignalTree<MyState>;
 *   const typed = tree as MyTyped;
 *
 * This keeps the default common path fast while preserving power for
 * advanced users.
 */
// TypedSignalTree was removed in 14.0.0. A spec comment already described it as
// "unexported" while it was in fact exported and reachable by nobody; it is now
// simply gone, and the comment is true.

/**
 * Internal path notifier interface
 * @internal
 */
export interface PathNotifier {
  subscribe(pattern: string, handler: PathHandler): () => void;
  intercept(pattern: string, fn: PathInterceptor): () => void;
  notify(
    path: string,
    value: unknown,
    prev: unknown,
    ownerPath?: string,
    subjectIds?: number[],
    positionIds?: number[],
    meta?: WriteMetadata
  ): void;
}

type PathHandler = (
  value: unknown,
  prev: unknown,
  path: string,
  ownerPath?: string,
  source?: string,
  subjectIds?: number[],
  positionIds?: number[],
  meta?: WriteMetadata
) => void;

type PathInterceptor = (
  ctx: {
    path: string;
    value: unknown;
    prev: unknown;
    blocked: boolean;
    blockReason?: string;
  },
  next: () => void
) => void | Promise<void>;

// ============================================
// BACKWARDS-COMPAT & CONVENIENCE TYPES (stable exports expected by consumers)
// These are intentionally simple aliases or fallbacks to keep the public API stable
// while allowing internal refactors of the type system.

/**
 * Compatibility alias for the public writable location shared by every
 * framework package. New declarations should prefer `Location<T>`.
 */
export type WritableLeaf<T> = LeafOf<T, 'location'>;

export type AccessibleNodeOf<
  T,
  C extends CarrierKind
> = NodeAccessor<T> & TreeNodeOf<T, C>;

export type AccessibleNode<T> = AccessibleNodeOf<T, 'location'>;

// Removed v5 legacy helper types to reduce public surface area in v6

/**
 * Canonical public tree contract — the ONE name a consumer should annotate
 * with:
 *
 * ```ts
 * function inspect(tree: SignalTree<AppState>) { ... }
 * interface Store { tree: SignalTree<AppState>; }
 * ```
 *
 * **State nodes are reached through `$`. State properties are NOT copied onto
 * the root callable.** `tree.$.count()` is the grammar; `tree.count` is not,
 * and there is deliberately only one way to address a node.
 *
 * This alias previously read `ISignalTree<T> & TreeNode<T>`, justified in a
 * comment as "properties copied to the root callable ... legacy consumers rely
 * on this". No such copying happens for state keys — the only copy loop
 * (`signal-tree.ts`) copies ENHANCER result keys and skips tree members. A
 * runtime probe on `signalTree({ count, tags, user })` reports
 * `Object.keys(tree)` as `[]` and `tree.count` as `undefined`, while the keys
 * are present on `tree.$`. So the type described a DIFFERENT API grammar from
 * the runtime, and typechecked `tree.count` green against a value that has no
 * such property. Removing `& TreeNode<T>` makes the contract honest.
 *
 * Currently REPRESENTED BY `ISignalTree<T>`; that is implementation vocabulary
 * scheduled for internalization, not a promise about the future algebra.
 * `SignalTree<T>` is the contract, and it is the name that survives.
 */
export type SignalTree<T> = ISignalTree<T>;

// ============================================
// TYPE GUARDS
// ============================================

// `isSignalTree()` lived here and is DELETED in 15.0. It tested
// `'with' in value`, so after `.with()` was removed in 223b355a it returned
// FALSE for every SignalTree that exists. Nothing broke, because nothing
// imported it.
//
// Read how it got there, because the shape repeats. It was on the public barrel
// with the note "narrows to the core tree contract, so it belongs on the core
// barrel", and 1e5c1167 removed it from the barrel to satisfy `demo-coverage`
// (every root export must be demonstrated in the demo app) rather than because
// anyone judged it unearned. Un-exported to make a gate green, then unreachable,
// then silently wrong.
//
// If a tree guard is wanted, write it against the v15 shape — `$`, `state`,
// `destroy`, callable — and demonstrate it, like every other barrel export.

/** Canonical tree-construction overloads shared by every framework facade. */
import type { ProcessDerivedOf } from './internals/derived-types';
import type { Enhancer } from '../enhancers/types';
import type { AccumulatedEnhancerAdditions } from './enhancer-types';

export interface SignalTreeFactoryOf<C extends CarrierKind> {
  <
    T extends object,
    TDerived extends object,
    const E extends readonly Enhancer<unknown>[] = readonly []
  >(
    initialState: T,
    config: Omit<TreeConfig, 'enhancers' | 'derived'> & {
      enhancers?: E;
      derived: ($: TreeNodeOf<T, C>) => TDerived;
    }
  ): ISignalTreeOf<
    ResolveLeafDefinitions<T>,
    C,
    TreeNodeOf<T, C> & ProcessDerivedOf<TDerived, C>
  > &
    AccumulatedEnhancerAdditions<E>;
  <T extends object, const E extends readonly Enhancer<unknown>[]>(
    initialState: T,
    config: Omit<TreeConfig, 'enhancers' | 'derived'> & {
      enhancers: E;
      derived?: never;
    }
  ): ISignalTreeOf<ResolveLeafDefinitions<T>, C, TreeNodeOf<T, C>> &
    AccumulatedEnhancerAdditions<E>;
  <T extends object>(
    initialState: T,
    config?: Omit<TreeConfig, 'enhancers' | 'derived'> & {
      enhancers?: never;
      derived?: never;
    }
  ): ISignalTreeOf<ResolveLeafDefinitions<T>, C, TreeNodeOf<T, C>>;
}

export type SignalTreeFactory = SignalTreeFactoryOf<'location'>;
