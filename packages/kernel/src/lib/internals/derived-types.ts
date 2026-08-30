import type { ReadableCell, WritableCell } from './cell-runtime';
import type { CarrierKind, LeafOf, ReadonlyOf } from '../types';

/**
 * Derived State Type Utilities
 *
 * Type definitions for the derived state system in SignalTree v7.
 */

// =============================================================================
// DERIVED STATE TYPES
// =============================================================================

/**
 * Converts a derived state definition into its signal representation.
 * - WritableCell<T> → WritableCell<T> (preserved — e.g. `linked()`, so `.set()` type-checks)
 * - ReadableCell<T> → ReadableCell<T> (pass through unchanged)
 * - Objects → Recursive processing
 *
 * NOTE: WritableSignal is checked BEFORE Signal because it extends Signal —
 * checking Signal first would widen `linked()`/`linkedSignal()` results to
 * read-only and break `$.x.set()`.
 */
export type ProcessDerivedOf<T, C extends CarrierKind> =
  T extends WritableCell<infer W>
  ? LeafOf<W, C>
  : T extends ReadableCell<infer S>
  ? ReadonlyOf<C, S>
  : T extends object
  ? { [P in keyof T]: ProcessDerivedOf<T[P], C> }
  : never;

export type ProcessDerived<T> = ProcessDerivedOf<T, 'cell'>;

/**
 * Deep merges source TreeNode and derived types.
 * Derived signals are merged into the source structure.
 *
 * Rules:
 * - Key in both: merge recursively if both are objects, otherwise derived wins
 * - Key only in source: preserve source type
 * - Key only in derived: add derived type
 */
export type DeepMergeTree<TSource, TDerived> = {
  [K in keyof TSource | keyof TDerived]: K extends keyof TSource
    ? K extends keyof TDerived
      ? // Key exists in both - merge recursively or derived overwrites
        TSource[K] extends object
        ? TDerived[K] extends object
          ? TSource[K] &
              DeepMergeTree<TSource[K], ProcessDerived<TDerived[K]>> // Merge objects
          : TSource[K] // Derived is non-object, keep source
        : ProcessDerived<TDerived[K]> // Source is primitive, derived overwrites
      : // Key only in source
        TSource[K]
    : // Key only in derived
    K extends keyof TDerived
    ? ProcessDerived<TDerived[K]>
    : never;
};

// =============================================================================
// EXTERNAL DERIVED UTILITIES
// =============================================================================

/**
 * Type utility to represent a tree after a derived tier has been applied.
 * Simplifies intermediate type definitions for external derived functions.
 *
 * When defining derived functions in separate files, you need intermediate types
 * to tell TypeScript what `$` contains at each tier. This utility reduces boilerplate.
 *
 * @typeParam TTree - The tree type before this derived tier
 * @typeParam TDerivedFn - The derived function type (typeof yourDerivedFn)
 *
 * @example
 * ```typescript
 * // Instead of manually writing:
 * type AppTreeWithTier1 = AppTreeBase & {
 *   $: AppTreeBase['$'] & ReturnType<typeof tier1Derived>;
 * };
 *
 * // Use DerivedOf:
 * type AppTreeWithTier1 = DerivedOf<AppTreeBase, typeof tier1Derived>;
 * type AppTreeWithTier2 = DerivedOf<AppTreeWithTier1, typeof tier2Derived>;
 * ```
 */
export type DerivedOf<
  TTree extends { $: object },
  TDerivedFn extends ($: TTree['$']) => object
> = TTree & {
  $: TTree['$'] & ReturnType<TDerivedFn>;
};

/**
 * Helper for defining derived tier functions in external files with proper typing.
 * This is a typed identity function - zero runtime overhead.
 *
 * When derived functions are in separate files, TypeScript cannot infer the `$`
 * parameter type from the call site. This helper provides the type context.
 *
 * The return type uses `($: any) => TReturn` intentionally. This allows the
 * `.derived()` method to properly infer the return type (TReturn) while still
 * providing full type checking for `$` inside the function body via TTree['$'].
 *
 * @typeParam TTree - The tree type that this derived tier expects
 * @param fn - The derived function that receives `$` and returns derived state
 * @returns The same function cast to accept any $ (for .derived() compatibility)
 *
 * @example
 * ```typescript
 * // In tier-entity-resolution.derived.ts
 * import { derivedFrom } from '@signal-tree/kernel';
 * import type { AppTreeBase } from '../app-tree';
 *
 * const derived = derivedFrom<AppTreeBase>();
 *
 * export const entityResolutionDerived = derived($ => ({
 *   driver: {
 *     current: computed(() => {
 *       const id = $.selected.driverId();
 *       return id != null ? $.drivers.byId(id)?.() ?? null : null;
 *     })
 *   }
 * }));
 *
 * // In app-tree.ts - use with regular .derived()
 * signalTree({ ... })
 *   .derived(entityResolutionDerived)  // Works exactly as before
 * ```
 */
export function derivedFrom<TTree extends { $: object }>(): <
  TReturn extends object
>(
  fn: ($: TTree['$']) => TReturn
) => ($: TTree['$']) => TReturn {
  // Return a function that takes the actual derived function
  // This allows TTree to be specified explicitly while TReturn is inferred
  return <TReturn extends object>(fn: ($: TTree['$']) => TReturn) =>
    fn as ($: TTree['$']) => TReturn;
}
