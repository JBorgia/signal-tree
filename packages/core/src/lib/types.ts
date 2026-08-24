import { Signal, WritableSignal } from '@angular/core';

import type { WriteMetadata } from './mutation-types';
import type { NodeAccessor } from './node-accessor';
import { AsyncQueryMarker, AsyncQuerySignal } from './markers/async-query';
import { AsyncSourceMarker, AsyncSourceSignal } from './markers/async-source';
import type { EntityLoaderSurface } from './markers/entity-loader';
import { StoredMarker, StoredSignal } from './markers/stored';

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
  MutationEnvelope,
  MutationKind,
  PositionId,
  StructuralEffect,
  WriteMetadata,
  WriteAttribution,
} from './mutation-types';
export type { NodeAccessor } from './node-accessor';

// Time travel enhancer configuration (canonical)
export interface TimeTravelConfig {
  /** Enable/disable time travel (default: true) */
  enabled?: boolean;
  /**
   * Maximum number of history entries to keep
   * @default 50
   */
  maxHistorySize?: number;

  /**
   * Whether to include payload information in history entries
   * @default true
   */
  includePayload?: boolean;

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

  /**
   * Custom action names for different operations
   */
  actionNames?: {
    update?: string;
    set?: string;
    batch?: string;
    [key: string]: string | undefined;
  };
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

export type NotFn<T> = T extends (...args: unknown[]) => unknown ? never : T;

// NOTE: A `declare module '@angular/core'` augmentation that added callable
// overloads to Angular's `WritableSignal<T>` previously lived here. It was
// removed because it is a *global* augmentation: importing anything from
// `@signaltree/core` would activate it project-wide and conflict with
// libraries that depend on the original invariant `WritableSignal<T>`
// signature (notably `@ngrx/signals`' `WritableStateSource<T>`, which became
// invariance-incompatible — surfacing as ~30 TS2345 errors in mixed
// `@ngrx/signals` + SignalTree codebases). There is no opt-in replacement:
// `@signaltree/callable-syntax`, which owned that augmentation, was DELETED in
// 14.0.0 because it re-introduced this same conflict and because the build
// transform behind it could never run inside an Angular app. There is no
// supported way to make a raw Angular signal callable-as-setter.

/**
 * A branch (non-leaf) node in the tree.
 *
 * ## READ THIS BEFORE "FIXING" ANYTHING THAT TOUCHES NODES
 *
 * The single fact that explains SignalTree's shape:
 * **only LEAVES are Angular signals.** A node is not a signal at all — it is a
 * plain function built by `makeNodeAccessor` with its child keys hung off it
 * as properties.
 *
 * That gives the two halves of the tree different, deliberate surfaces:
 *
 * | | leaf (`WritableSignal<T>`) | node (`NodeAccessor<T>`) |
 * |---|---|---|
 * | read | `leaf()` | `node()` — unwraps the whole subtree |
 * | write a value | `leaf.set(v)` | `node({ partial })` — deep merge |
 * | write from current | `leaf.update(fn)` | `node(fn)` — fn gets the unwrapped value |
 * | has `.set` / `.update` | yes | **no — and it needs none** |
 *
 * Nodes are callable *by nature*: the three signatures below are the complete
 * write surface, and `node({ a: 1 })` merges — keys you don't pass are left
 * untouched, at every depth. Leaves are the opposite: calling a leaf with an
 * argument does **nothing at all**, because an Angular signal getter ignores
 * extra arguments.
 *
 * As of 14.0.0 that is a COMPILE ERROR rather than a silent no-op:
 * `CallableWritableSignal` no longer declares setter overloads.
 * `@signaltree/callable-syntax` used to promise the leaf form via a build
 * transform and was deleted — it could not run inside an Angular app at all.
 *
 * Two mistakes this comment exists to prevent:
 *
 * 1. **Do not add `.set()`/`.update()` to `NodeAccessor`.** It is not a
 *    missing feature. The call signatures already do both writes, and adding
 *    methods would collide with any state key literally named `set`/`update`.
 * 2. **Do not describe node call-syntax as depending on a build transform,** or
 *    as something to avoid. It is core behaviour and needs zero build tooling.
 *    (A transform once existed for LEAF calls only; it is gone.)
 *
 * Runtime, if you want to confirm rather than trust this comment:
 * `typeof node === 'function'`, `node.set === undefined`,
 * `node.update === undefined`, while `leaf.set` / `leaf.update` are functions.
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
 * `__sliceTypes` property (`EntityMapBuilder`/`LoadingEntityMapBuilder` in
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
type ApplyComputedSlices<TMarker, TBase> = TMarker extends {
  __sliceTypes?: infer S;
}
  ? [LiteralKeys<NonNullable<S>>] extends [never]
    ? TBase
    : TBase & {
        readonly [P in LiteralKeys<NonNullable<S>>]: Signal<NonNullable<S>[P]>;
      }
  : TBase;

// TreeNode represents the runtime shape of the tree where properties are
// accessed by string keys at runtime. Previously this was strictly mapped
// to `keyof T` which caused incompatibilities across packages when an
// enhancer or helper used a different generic parameter name. Relax the
// index signature to permit dynamic string indexing while still preserving
// the mapped keys for better editor DX.
// Default TreeNode maps known keys to either EntitySignal, StoredSignal,
// or CallableWritableSignal and still allows dynamic string indexing at runtime.
export type TreeNode<T> = {
  [K in keyof T]: T[K] extends LoadingEntityMapMarker<
    infer LE,
    infer LK,
    infer LP
  >
    ? ApplyComputedSlices<T[K], LoadingEntitySignal<LE, LK, LP>>
    : T[K] extends EntityMapMarker<infer E, infer Key>
    ? ApplyComputedSlices<T[K], EntitySignal<E, Key>>
    : T[K] extends StoredMarker<infer V>
    ? StoredSignal<V>
    : T[K] extends AsyncSourceMarker<infer V>
    ? AsyncSourceSignal<V>
    : T[K] extends AsyncQueryMarker<infer In, infer Out>
    ? AsyncQuerySignal<In, Out>
    : T[K] extends Primitive
    ? CallableWritableSignal<T[K]>
    : T[K] extends readonly unknown[]
    ? CallableWritableSignal<T[K]>
    : T[K] extends
        | Date
        | RegExp
        | Map<unknown, unknown>
        | Set<unknown>
        | Error
        | ((...args: unknown[]) => unknown)
    ? CallableWritableSignal<T[K]> // Built-in objects → treat as atomic values
    : T[K] extends object
    ? NodeAccessor<T[K]> & TreeNode<T[K]>
    : CallableWritableSignal<T[K]>;
};

// NOTE: The read-only view types (`ReadonlyView`, `ReadonlyStore`,
// `ReadonlyNodeAccessor`, the per-marker `Readonly*Signal` views and their
// reader-key allowlists, and `asReadonly()`) live in `./readonly.ts`. They
// are computed over a tree's ACCUMULATED `$` type (the builder's `TAccum`),
// not over the source `T` — a source-computed view drops every `.derived()`
// computed (RFC 0004 F1), which is why no `ReadonlyTreeNode<T>` mirror of
// `TreeNode<T>` exists here.

// Base SignalTree minimal interface
// v6: primary runtime tree type is `SignalTree<T>`; a deprecated alias
// `SignalTree<T>` is provided at the end of this file for compatibility.
export interface ISignalTree<T> extends NodeAccessor<T> {
  /** Reactive tree-node accessor — the canonical entry point. */
  readonly $: TreeNode<T>;
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
  bind(thisArg?: unknown): NodeAccessor<T>;
  destroy(): void;
  /** Whether this tree has been destroyed. */
  readonly destroyed: Signal<boolean>;
  /**
   * Register a cleanup function to be called when the tree is destroyed.
   * Enhancers should use this to release resources (intervals, subscriptions, etc.).
   */
  registerCleanup(fn: EnhancerCleanup): void;
  /**
   * Apply a partial update and return the dot-paths of leaf signals that
   * actually changed.
   *
   * "Actually changed" is literal: a path appears only if the leaf signal
   * accepted the write. Values that are ref-equal to the current value are
   * skipped before the `set()`, and values that are a NEW reference but
   * DEEP-EQUAL are rejected by the leaf's own `equal` — a re-fetched server
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

/** Cleanup function returned or registered by enhancers. */
export type EnhancerCleanup = () => void;

// Method interfaces
export interface EffectsMethods<T> {
  /** Register an effect that can optionally return a cleanup function */
  effect(fn: (state: T) => void | (() => void)): () => void;

  /** Subscribe to state changes (simpler alternative to effect) */
  subscribe(fn: (state: T) => void): () => void;
}

/**
 * Configuration for the batching enhancer.
 *
 * IMPORTANT: Signal writes are ALWAYS synchronous.
 * Batching only affects change detection notification timing.
 */
export interface BatchingConfig {
  /**
   * Whether batching is enabled.
   * @default true
   */
  enabled?: boolean;

  /**
   * Delay before flushing CD notifications (ms).
   * 0 = microtask (default), >0 = setTimeout with delay.
   * @default 0
   */
  notificationDelayMs?: number;
}

/**
 * Methods added by the batching() enhancer.
 *
 * IMPORTANT: Signal writes are ALWAYS synchronous.
 * Batching only affects change detection notification timing.
 */
/**
 * ⚠️ NOT generic. None of these members reference the tree's state type, and
 * carrying a phantom `<T = unknown>` made `BatchingMethods<A>` and
 * `BatchingMethods<B>` the same type — safety that reads real and is not.
 * Removed in 14.0.0.
 */
export interface BatchingMethods {
  /**
   * Group multiple updates into a single change detection cycle.
   * Signal values update immediately; CD notification is batched.
   *
   * @example
   * tree.batch(() => {
   *   tree.$.a.set(1);  // Value updates immediately
   *   tree.$.b.set(2);  // Value updates immediately
   *   console.log(tree.$.a()); // Returns 1 ✅
   * });
   * // Single CD notification after batch completes
   */
  batch(fn: () => void): void;
  // See `coalesce()` below for the observable difference: a value read back inside
  // a `batch()` callback is the NEW value; inside `coalesce()` it is the OLD one.

  /**
   * Coalesce rapid updates to the same path.
   * Only the final value for each path is written.
   *
   * ## `batch()` vs `coalesce()` — they are NOT interchangeable
   *
   * Both end with the same state, so the docstrings used to imply the same
   * operation reached two ways. They differ in WHEN the write lands, and the
   * difference is observable:
   *
   * | inside the callback | `batch()` | `coalesce()` |
   * | ------------------- | --------- | ------------ |
   * | reading a value you just wrote | the NEW value | the **OLD** value |
   *
   * MEASURED: writing `'X'` then reading inside the callback gives `'X'` under
   * `batch()` and `''` under `coalesce()`. `batch()` writes synchronously and
   * defers only change-detection notification; `coalesce()` defers the WRITE
   * itself and applies the last value per path on exit.
   *
   * So `coalesce()` is wrong for any callback that reads back what it wrote, and
   * `batch()` is wrong when you specifically want intermediate values discarded.
   *
   * ⚠️ An `update(fn)` inside `coalesce()` is NOT coalesced, deliberately. An
   * updater is a read-modify-write, so keeping only the last of three `+1`s would
   * mean `+1`. Updaters apply immediately, after draining any pending coalesced
   * `set` on the same path.
   * Use for high-frequency updates (typing, dragging, etc.)
   *
   * @example
   * tree.coalesce(() => {
   *   tree.$.query.set('h');
   *   tree.$.query.set('he');
   *   tree.$.query.set('hel');
   * });
   * // Only 'hel' is written to the signal
   */
  coalesce(fn: () => void): void;

  /**
   * Check if there are pending CD notifications.
   */
  hasPendingNotifications(): boolean;

  /**
   * Manually flush pending CD notifications.
   * Rarely needed - notifications flush automatically on microtask.
   */
  flushNotifications(): void;
}

export interface TransactionMethods {
  transaction(fn: () => void): PendingTransaction;
}

/**
 * Time-travel capability.
 *
 * NOT generic in the state, and that is the point. `getHistory()` returns the
 * history of the tree the methods are attached to, so the state is recovered
 * from polymorphic `this` — which is what the semantics always were. The
 * previous `TimeTravelMethods<T>` carried a second copy of the state type
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
 * State inference is UNCHANGED for consumers: `getHistory()[0].state` is the
 * exact concrete state, through arbitrarily long `.with()` chains.
 */
/**
 * `TimeTravelMethods` deliberately does NOT extend `TransactionMethods` (15.0,
 * TX-SURFACE-0).
 *
 * `timeTravel()` used to ship its own `transaction()` — a second implementation
 * of a concept `transactions()` already owns and the README already documented
 * as belonging there, reaching the public surface silently through an interface
 * extension. It was also the incorrect one: its rollback dependency check read
 * the restoration history rather than its own captured effects, so under opt-in
 * eligibility it stopped refusing unsafe rollbacks. It looked correct only
 * because the old default admitted every authored write to that history.
 *
 * The capabilities compose, which is why deletion was cheaper than repair:
 *
 *   transactions()  groups authored work, owns rollback, announces lifecycle
 *   undoable()      admits the resulting causal turn
 *   timeTravel()    observes that lifecycle and restores admitted turns
 *
 * Install `transactions()` for a transaction boundary. There is no shim, and
 * re-adding one via another interface extension would recreate the duplication —
 * see the negative typing test in `tx-ownership.typing.spec.ts`.
 */
export interface TimeTravelMethods {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  getHistory(): TimeTravelEntry<
    this extends NodeAccessor<infer S> ? S : never
  >[];
  resetHistory(): void;
  jumpTo(index: number): void;
  getCurrentIndex(): number;
  // `pauseRecording()` / `resumeRecording()` / `isRecordingPaused()` were
  // REMOVED in 14.1.1. They could not express "one undo step", only "record
  // nothing" — so the documented recipe needed a synthetic sealing write landing
  // on an invented domain field, and an earlier revision of that guide shipped
  // the destructive version without it. Worse, pause was a GLOBAL mode: an
  // unrelated write inside the window was suppressed too, so correctness needed
  // sole ownership of the tree for its duration. A `for` loop has that; a
  // multi-second `mergeMap` over N requests does not.
  //
  // The replacement is a transaction handle — see
  // docs/architecture/history-the-greenfield-target.md.
  /** Internal time-travel manager exposed for advanced tooling/debugging */
  readonly __timeTravel?: {
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    // `unknown`: this is an inline property type, so `this` is the enclosing
    // interface rather than the tree. Internal tooling surface — state
    // precision belongs on the public getHistory().
    getHistory(): TimeTravelEntry<unknown>[];
    resetHistory(): void;
    jumpTo(index: number): void;
    getCurrentIndex(): number;
  };
}

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

export interface PendingTransaction {
  confirm(): void;
  /**
   * Rolls back the pending optimistic transaction.
   *
   * Throws {@link SignalTreeRollbackError} when SignalTree cannot remove the
   * transaction conservatively without risking later valid work.
   */
  rollback(): void;
}

/** One module's activity record, as reported by {@link DevToolsMethods.exportDebugSession}. */
export interface DevToolsModuleMetadata {
  name: string;
  methods: string[];
  addedAt: Date;
  lastActivity: Date;
  operationCount: number;
  averageExecutionTime: number;
  errorCount: number;
}

/** Aggregate counters, as reported by {@link DevToolsMethods.exportDebugSession}. */
export interface DevToolsPerformanceMetrics {
  totalUpdates: number;
  moduleUpdates: Record<string, number>;
  modulePerformance: Record<string, number>;
  signalGrowth: Record<string, number>;
  memoryDelta: Record<string, number>;
  moduleCacheStats: Record<string, { hits: number; misses: number }>;
}

/** One logged event, as reported by {@link DevToolsMethods.exportDebugSession}. */
export interface DevToolsLogEntry {
  timestamp: Date;
  module: string;
  type: 'composition' | 'method' | 'state' | 'performance';
  data: unknown;
}

/** What {@link DevToolsMethods.exportDebugSession} returns. */
export interface DevToolsDebugSession {
  metrics: DevToolsPerformanceMetrics;
  modules: DevToolsModuleMetadata[];
  logs: DevToolsLogEntry[];
}

export interface DevToolsMethods {
  connectDevTools(name?: string): void;
  disconnectDevTools(): void;
  /**
   * Snapshot the current debug session — metrics, per-module activity, logs.
   *
   * DECLARED IN 15.0, PRESENT SINCE LONG BEFORE. `devTools()` has always
   * attached this at runtime and `devtools.spec.ts` has always asserted it, but
   * it was missing from this interface, so reaching it required a cast — and the
   * demo carried exactly that cast, with a hand-written `compositionHistory`
   * field the runtime does not return. Same runtime-present / type-missing drift
   * already recorded for `destroyed`, `registerCleanup` and `updateAndReport`.
   *
   * It surfaced because removing `.with()` removed the cast that was hiding it.
   */
  exportDebugSession(): DevToolsDebugSession;
}

/**
 * Marker interface indicating entities have been materialized at runtime.
 * Prefer accessing entity collections via `tree.$.prop` (typed as `EntitySignal`).
 */
export interface EntitiesEnabled {
  /** @internal */
  readonly __entitiesEnabled?: true;
}

export interface TimeTravelEntry<T> {
  action: string;
  timestamp: number;
  state: T;
  payload?: unknown;
}

// ============================================
// CONFIGURATION TYPES
// ============================================

export interface TreeConfig {
  batchUpdates?: boolean;
  // `enableTimeTravel` was REMOVED here in 14.1.1: it had ZERO consumers in
  // signal-tree.ts and silently did nothing, while a working flag of the same
  // name lives on `DevToolsConfig`. The one a user reached for first was the
  // dead one. Attach `timeTravel()` as an enhancer instead.

  // `useLazySignals` and `lazy` were REMOVED in 15.0 — see the tombstone after
  // this interface. Both were inert: the subpath that supplied the feature was
  // withdrawn from the published surface, so neither option could be satisfied.
  useShallowComparison?: boolean;
  maxCacheSize?: number;
  trackPerformance?: boolean;
  /** Name shown in devtools. Was also spelled `treeName` on DevToolsConfig; that alias is gone in 14.1.1. */
  name?: string;
  enableDevTools?: boolean;
  debugMode?: boolean;
  useStructuralSharing?: boolean;

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
   * signals, which are merged in at the same point a chained `.derived()` call
   * would have applied them: lazily, on first `$` access, after every enhancer
   * has been applied.
   *
   * The parameter is typed `never` here on purpose. `TreeConfig` has no `T` to
   * name, so the honest declaration is the bottom type — every concrete factory
   * `($: TreeNode<T>) => TDerived` is assignable to it. The real typing, and the
   * `ProcessDerived<TDerived>` in the result, come from the `signalTree`
   * overload that recognises this field.
   */
  derived?: ($: never) => object;

  /**
   * Construction-time security validation, built with the `security()` helper
   * from `@signaltree/core/security`. When present, its `validate()` runs
   * synchronously during construction to reject prototype pollution, XSS, and
   * function values.
   *
   * v11 change: pass `security: security(config)` (from the `/security`
   * subpath), not a raw `SecurityValidatorConfig`. This keeps `SecurityValidator`
   * (~2.4KB) out of every bundle that doesn't opt in.
   *
   * @default undefined (no security validation)
   *
   * @example
   * ```ts
   * import { signalTree } from '@signaltree/core';
   * import { security, SecurityPresets } from '@signaltree/core/security';
   *
   * const tree = signalTree(state, { security: security({ preventXSS: true }) });
   * const strict = signalTree(state, { security: security(SecurityPresets.strict().getConfig()) });
   * ```
   */

}

/**
 * LAZY SIGNAL CREATION IS GONE IN 15.0 — `TreeConfig.lazy`,
 * `TreeConfig.useLazySignals`, the `LazyFeature` type, the
 * `@signaltree/core/lazy` subpath, the lazy proxy and `SignalMemoryManager`.
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


/**
 * Branded loading feature produced by the `loader()` helper and passed as the
 * `load` option of {@link EntityMapMarker}'s config:
 * `entityMap({ load: loader(fn, opts) })`.
 *
 * Exact `security()` precedent: the helper closure is the *only* reference to
 * the loader machinery (`attachLoader`), so importing `entityMap` without
 * `loader` tree-shakes the loader/cache/SWR code out. The phantom `__entity`/
 * `__params` members carry `E`/`P` so the loading overload can recover the
 * entity and scope-param types for inference; they never exist at runtime.
 *
 * @typeParam E - entity row type
 * @typeParam P - scope-param type (`void` for a global collection)
 */
export interface LoaderFeature<E, P = void> {
  readonly __signalTreeLoader: true;
  /** @internal Attaches loader machinery to a materialized entity signal. */
  attach(entity: unknown): void;
  /** @internal Type-level only — carries `E` for inference. */
  readonly __entity?: E;
  /** @internal Type-level only — carries the scope-param type `P`. */
  readonly __params?: P;
}

// TOMBSTONE: `FormHistoryOptions`, `FormHistoryApi` and
// `FormHistorySharedAuthority` went with `trackHistory()` in TH-DEL.
//
// TH-0 measured the reason and it is not disuse. `trackHistory` undid by
// WRITING BACK — `model.update(m => ({...m, ...next}))` — so over a SignalTree
// branch its undo was a new authored mutation, which `timeTravel()` then
// recorded as forward motion. The two systems did not merely overlap: a
// `tree.undo()` after a `hist.undo()` REDID the edit. Over a plain Angular
// signal it was correct, but that is the case with no SignalTree involvement,
// so there was no ownership claim on either branch.
//
// Do not reintroduce a generic writable-signal history here. For state in a
// tree, `timeTravel()` is the restoration authority; for a signal outside one,
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
 * A cache-aware (single-scope) loading entityMap marker — produced by `entityMap({ load, … })`.
 * Materializes into an {@link EntitySignal} plus the loader surface
 * ({@link EntityLoaderSurface}). Distinguished from a plain marker by `__hasLoad`
 * so the type resolver can add the loader methods only when `load` is configured.
 *
 * @typeParam P - scope/params type (`void` for the global, parameterless form).
 */
export interface LoadingEntityMapMarker<E, K extends string | number, P = void>
  extends EntityMapMarker<E, K> {
  readonly __hasLoad: true;
  readonly __loadParams?: P;
}

/**
 * An {@link EntitySignal} augmented with the cache-aware (single-scope) loader surface — the
 * materialized form of `entityMap({ load, … })`.
 */
export type LoadingEntitySignal<
  E,
  K extends string | number = string,
  P = void
> = EntitySignal<E, K> & EntityLoaderSurface<P>;

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
export type EntityNode<E> = {
  (): E;
  (value: E): void;
  (updater: (current: E) => E): void;
} & {
  [P in keyof E]: E[P] extends object
    ? E[P] extends readonly unknown[]
      ? CallableWritableSignal<E[P]>
      : EntityNode<E[P]>
    : CallableWritableSignal<E[P]>;
};

/**
 * EntitySignal provides reactive entity collection management.
 */
export interface EntitySignal<E, K extends string | number = string> {
  // Explicit access
  byId(id: K): EntityNode<E> | undefined;
  byIdOrFail(id: K): EntityNode<E>;

  // Queries (readonly properties returning signals)
  readonly all: Signal<E[]>;
  readonly count: Signal<number>;
  readonly ids: Signal<K[]>;
  has(id: K): Signal<boolean>;
  /**
   * True when the collection has no entities. v10.3 canonical name —
   * aligns with FormControl-style bare-boolean accessors used across
   * `status` / `form` / `asyncSource` markers.
   */
  readonly empty: Signal<boolean>;
  /**
   * The collection as a `ReadonlyMap`, keyed by id. Renamed from `map` in 14.1.1 —
   * `map` read as a projection beside `all()`, which is what `.map(fn)` means to
   * every JS developer.
   */
  readonly asMap: Signal<ReadonlyMap<K, E>>;
  where(predicate: (entity: E) => boolean): Signal<E[]>;
  find(predicate: (entity: E) => boolean): Signal<E | undefined>;

  // Active entity — the master/detail primitive.
  //
  // Added in 14.0.0 after a capability audit found elf and Akita both ship it
  // and every team otherwise hand-rolls `activeId: null` plus a derived lookup.
  // `activeEntity` resolves through `byId`, so it is O(1) and invalidates only
  // when THAT row changes — finer-grained than the filtered-stream versions the
  // other libraries offer.
  readonly activeId: Signal<K | undefined>;
  readonly activeEntity: Signal<E | undefined>;
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
export interface PersistenceConfig {
  key: string;
  storage?: Storage;
  debounceMs?: number;
  filter?: (path: string) => boolean;
  serialize?: (state: unknown) => string;
  deserialize?: (json: string) => unknown;
}

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
  [K in keyof T]: T[K] extends LoadingEntityMapMarker<
    infer LE,
    infer LK,
    infer LP
  >
    ? ApplyComputedSlices<T[K], LoadingEntitySignal<LE, LK, LP>>
    : T[K] extends EntityMapMarker<infer E, infer Key>
    ? ApplyComputedSlices<T[K], EntitySignal<E, Key>>
    : T[K] extends StoredMarker<infer V>
    ? StoredSignal<V>
    : T[K] extends AsyncSourceMarker<infer V>
    ? AsyncSourceSignal<V>
    : T[K] extends AsyncQueryMarker<infer In, infer Out>
    ? AsyncQuerySignal<In, Out>
    : T[K] extends object
    ? DeepEntityAwareTreeNode<T[K]>
    : CallableWritableSignal<T[K]>;
};

/**
 * Shallow public tree node used by default in most public APIs.
 * This avoids eagerly expanding deeply nested types and keeps
 * editor/CI responsiveness high while preserving common DX.
 * Consumers who want the fully expanded shape can opt-in via
 * `TypedSignalTree<T>` (see below) or use `DeepEntityAwareTreeNode`.
 */
export type EntityAwareTreeNode<T> = {
  [K in keyof T]: T[K] extends LoadingEntityMapMarker<
    infer LE,
    infer LK,
    infer LP
  >
    ? ApplyComputedSlices<T[K], LoadingEntitySignal<LE, LK, LP>>
    : T[K] extends EntityMapMarker<infer E, infer Key>
    ? ApplyComputedSlices<T[K], EntitySignal<E, Key>>
    : T[K] extends StoredMarker<infer V>
    ? StoredSignal<V>
    : T[K] extends AsyncSourceMarker<infer V>
    ? AsyncSourceSignal<V>
    : T[K] extends AsyncQueryMarker<infer In, infer Out>
    ? AsyncQuerySignal<In, Out>
    : CallableWritableSignal<T[K]>;
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

// `CallableWritableSignal<T>` is declared as an interface (not an
// intersection) so TypeScript's overload-resolution picks the getter
// `(): T` first when `Signal<T>` inference walks the call signatures —
// e.g. for `toObservable(tree.$.x)`. Prior to 9.2.0 the global
// `declare module '@angular/core'` augmentation in core also added
// these overloads to the base `WritableSignal<T>` and incidentally
// masked the ordering issue; the interface form makes the contract
// self-contained.
export interface CallableWritableSignal<T> extends WritableSignal<T> {
  (): T;
  // ⚠️ 14.0.0 — THE SETTER OVERLOADS ARE GONE. They typed a call that did
  // nothing.
  //
  //   (value: NotFn<T>): void;
  //   (updater: (current: T) => T): void;
  //
  // A LEAF IS A REAL ANGULAR SIGNAL. Calling one is a READ; it returns the
  // value and discards the argument. Measured: `tree.$.count(5)` on a leaf
  // holding 0 left it at 0, silently. The same expression one level up —
  // `tree.$.user({ name: 'Bob' })` — DOES work, because a branch is our own
  // accessor and we own its call semantics. So the type promised a uniformity
  // the runtime never had, and the failure was invisible at both compile time
  // and run time.
  //
  // `@signaltree/callable-syntax` existed to close that gap by rewriting
  // `leaf(v)` to `leaf.set(v)` at build time. It cannot be delivered to an
  // Angular app at all (RFC 0008 §4, verified against a real build:
  // `@angular/build:application` exposes no `plugins`; `codePlugins` runs after
  // ngtsc has claimed every `.ts` — a probe received ZERO files; ngtsc's
  // transformer list is hardcoded; ts-patch goes inert under `isolatedModules`).
  // Angular is this library's primary audience, so for most users these
  // overloads could never have become true.
  //
  // The alternative — wrap every leaf so the call really sets — was measured
  // and rejected. Cost was not the problem (~4% on a set+get, inside noise);
  // IDENTITY was: a wrapper is not a signal. `isSignal(wrapper)` is `false` and
  // `Symbol(SIGNAL)` is absent, so `toObservable`, `model()`/`input()` interop
  // and every third-party tool that guards on `isSignal` would break. Trading
  // that for call-site sugar is a bad trade, and "leaves are real Angular
  // signals" is the interop guarantee the whole design rests on.
  //
  // Write a leaf with `.set()` / `.update()`. Branches stay callable.
}

export type AccessibleNode<T> = NodeAccessor<T> & TreeNode<T>;

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
