import type { CarrierKind, ReadonlyOf } from '../types';

/**
 * Derived State Type Utilities
 *
 * Type definitions for the derived state system in SignalTree v7.
 */

// =============================================================================
// DERIVED STATE TYPES
// =============================================================================

/**
 * Converts zero-argument computation recipes into readonly locations and
 * recursively maps nested derived namespaces. Derived state has one runtime
 * authority: SignalTree evaluates and memoizes each recipe. A callable supplied
 * by a framework is still treated as a recipe; its writable surface is never
 * inherited by the resulting location.
 */
export type ProcessDerivedOf<
  T,
  C extends CarrierKind = 'location'
> = T extends (...args: never[]) => infer R
  ? ReadonlyOf<R, C>
  : T extends object
  ? { [P in keyof T]: ProcessDerivedOf<T[P], C> }
  : never;
