/**
 * SignalTree Builder Types
 *
 * Type definitions for the SignalTreeBuilder used in v7.
 */
import type { CarrierKind, ReadonlyOf } from '../types';

import type { ProcessDerived } from './derived-types';
import type { NodeAccessor, TreeNode } from '../types';

// =============================================================================
// SIGNAL TREE BUILDER
// =============================================================================

/**
 * Builder for constructing SignalTree with chained derived layers.
 * Provides fluent API for adding derived state and enhancers.
 *
 * @typeParam TSource - The raw source state type
 * @typeParam TAccum - The accumulated $ type (TreeNode<TSource> & derived signals)
 *
 * @example
 * ```typescript
 * // a derived value from whatever runtime the consumer installed
 * import { signalTree } from '@signal-tree/kernel';
 *
 * const tree = signalTree({ count: 0 })
 *   .derived(($) => ({
 *     doubled: computed(() => $.count() * 2)
 *   }))
 *   .derived(($) => ({
 *     quadrupled: computed(() => $.doubled() * 2)  // ✓ $.doubled is typed
 *   }));
 * ```
 */
export interface SignalTreeBuilderOf<
  TSource,
  TAccum,
  C extends CarrierKind
> {
  // Callable (backward compatible with NodeAccessor)
  (): TSource;
  (value: Partial<TSource>): void;
  (updater: (current: TSource) => TSource): void;

  // State accessors with accumulated type
  readonly $: TAccum;
  readonly state: TAccum;

  // `with()` is GONE in v15. Enhancers are declared in `signalTree`'s config
  // and the accumulated surface arrives through the return type instead — see
  // `AccumulatedEnhancerAdditions`. It is not deprecated-but-present: late
  // enhancement was what made the build plan unknowable, so there is no runtime
  // method to describe here.

  // From ISignalTree
  /**
   * Returns the tree callable bound to `thisArg` — a `NodeAccessor<TSource>`,
   * i.e. all three call forms, with the read form returning `TSource`.
   *
   * This was declared `(value?: TSource) => TSource | void`, which collapsed
   * the three overloads into one lossy signature and made the read form return
   * `TSource | void`. The runtime never behaved that way: `signal-tree.ts`
   * defines `bind` as returning a `NodeAccessor<T>`, and the builder copies
   * that function verbatim. So the declaration under-promised what the runtime
   * already delivered — the same runtime-present / type-missing drift recorded
   * above for `destroyed`, `registerCleanup` and `updateAndReport`.
   *
   * It also had a consumer-visible consequence beyond `bind` itself: because
   * `SignalTree<T>` requires `ISignalTree<T>`'s `bind(): NodeAccessor<T>`, the
   * lossy signature made `const tree: SignalTree<S> = signalTree(...)` fail to
   * compile. Gated by `signal-tree-type-matrix.typing.spec.ts` section C.
   */
  bind(thisArg?: unknown): NodeAccessor<TSource>;
  destroy(): void;
  /**
   * Whether this tree has been destroyed. Present at runtime on every
   * `signalTree()` return (copied from the ISignalTree lifecycle in
   * signal-tree.ts) but was missing from this builder type — the docs
   * correctly taught it while `signalTree({...}).destroyed` failed to
   * compile (M3 acceptance test, run 2, 2026-07-23).
   */
  // SWEEP DISPOSITION: **LEAF-SHAPE, not KERNEL-SEMANTIC.** Neutralizing this
  // to `ReadableCell<boolean>` broke `signal-tree-type-matrix` row
  // `_builtDestroyed: ReadableCell<boolean>` — a row whose own docblock records that
  // this contract was broken before and "caught by a different accident, never
  // by a gate." Consumers pass `tree.destroyed` to Angular APIs, so the Angular
  // package must keep publishing `ReadableCell<boolean>`. Carrier-bound at the split:
  // kernel -> ReadableCell<boolean>, angular -> ReadableCell<boolean>.
  readonly destroyed: ReadonlyOf<C, boolean>;
  /**
   * Register a cleanup function called on tree destroy. Same runtime-present
   * but type-missing gap as `destroyed` — see note above.
   */
  registerCleanup(fn: () => void): void;

  /**
   * Apply a partial update and return the dot-paths of leaf signals that
   * actually changed. See {@link ISignalTree.updateAndReport}.
   *
   * Same runtime-present-but-type-missing gap as `destroyed` above:
   * `signalTree({...}).updateAndReport(payload)` worked at runtime (the
   * builder forwards it) but failed to compile. Caught by the skills doc
   * linter in 13.5.0, while documenting it as the replacement for the
   * deprecated `@signaltree/enterprise` — so the entire recommended
   * migration target did not typecheck.
   */
  updateAndReport(
    updates: Partial<TSource> | ((current: TSource) => Partial<TSource>)
  ): string[];

  // `batchUpdate` was REMOVED in 14.1.1 — a duplicate of the tree callable.
  // Use `tree(partial)`, or `tree.batch(() => tree(partial))` to batch notifications.

  /**
   * Add a layer of derived state.
   * Each layer can reference all previous layers.
   *
   * @param factory - Function that receives accumulated $ and returns derived definitions
   * @returns Builder with accumulated types for chaining
   */
  derived<TDerived extends object>(
    factory: ($: TAccum) => TDerived
  // ⚠️ SELF-REFERENCE MUST PRESERVE THE CARRIER. Returning the neutral
  // `SignalTreeBuilder` alias here dropped `C`, so `.derived(...)` handed an
  // Angular consumer a builder whose `destroyed` was a `ReadableCell` — a
  // carrier lie one call into the chain.
  ): SignalTreeBuilderOf<TSource, TAccum & ProcessDerived<TDerived>, C>;
}

/**
 * PUBLIC kernel builder. Same two parameters consumers always wrote; the
 * carrier is bound here so `destroyed` is a neutral readable cell. The Angular
 * package binds `'angular'` through `SignalTreeFactoryOf`, which is why its
 * `tree.destroyed` is a real `Signal<boolean>`.
 */
export type SignalTreeBuilder<TSource, TAccum = TreeNode<TSource>> =
  SignalTreeBuilderOf<TSource, TAccum, 'cell'>;
