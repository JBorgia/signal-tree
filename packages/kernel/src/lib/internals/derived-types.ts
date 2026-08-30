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
export type ProcessDerivedOf<T, C extends CarrierKind> = T extends WritableCell<
  infer W
>
  ? LeafOf<W, C>
  : T extends ReadableCell<infer S>
  ? ReadonlyOf<C, S>
  : T extends object
  ? { [P in keyof T]: ProcessDerivedOf<T[P], C> }
  : never;
