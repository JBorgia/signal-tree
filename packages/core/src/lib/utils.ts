/**
 * SignalTree Utility Functions v1.1.6 - MIT License
 * @see https://github.com/JBorgia/signaltree/blob/main/LICENSE
 */

import { signal, WritableSignal, isSignal } from '@angular/core';
import type { DeepSignalify } from './types';
import { equal, parsePath } from '@signaltree/runtime-utils';
export { equal };

/**
 * Enhanced deep equality function optimized for SignalTree operations.
 *
 * Performs comprehensive equality checking for all JavaScript types including
 * primitives, objects, arrays, Date, RegExp, Map, Set, and other built-ins.
 * Optimized with early exits and type-specific comparisons for maximum performance.
 *
 * @template T - The type of values being compared
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns True if values are deeply equal, false otherwise
 *
 * @example
 * ```typescript
 * // Primitive comparisons
 * equal(42, 42);           // true
 * equal('hello', 'hello'); // true
 * equal(null, undefined);  // false
 *
 * // Object comparisons
 * equal({ a: 1, b: 2 }, { a: 1, b: 2 }); // true
 * equal({ a: 1 }, { a: 1, b: 2 });       // false
 *
 * // Array comparisons
 * equal([1, 2, 3], [1, 2, 3]);           // true
 * equal([1, [2, 3]], [1, [2, 3]]);       // true (deep)
 *
 * // Complex types
 * equal(new Date('2023-01-01'), new Date('2023-01-01')); // true
 * equal(/abc/gi, /abc/gi);                               // true
 * equal(new Set([1, 2]), new Set([1, 2]));               // true
 * equal(new Map([['a', 1]]), new Map([['a', 1]]));       // true
 * ```
 *
 * @example
 * ```typescript
 * // Usage in SignalTree for change detection
 * const state = signalTree({
 *   user: { name: 'John', age: 30 }
 * });
 *
 * // Internal equal() usage prevents unnecessary updates
 * state.user.set({ name: 'John', age: 30 }); // No change detected
 * state.user.set({ name: 'Jane', age: 30 }); // Change detected
 * ```
 */
// `equal` is implemented in the small runtime-utils package to reduce core bundle size
// ...existing code...

/**
 * Creates a terminal signal with enhanced deep equality comparison.
 *
 * Alternative to Angular's signal() that uses SignalTree's deep equality
 * function for change detection. Useful when you need standalone signals
 * with the same equality semantics as SignalTree.
 *
 * @template T - The type of the signal value
 * @param value - Initial value for the signal
 * @param customEqual - Optional custom equality function (defaults to deep equal)
 * @returns A WritableSignal with deep equality comparison
 *
 * @example
 * ```typescript
 * // Standard Angular signal with reference equality
 * const standardSignal = signal({ count: 0 });
 * standardSignal.set({ count: 0 }); // Triggers update (different reference)
 *
 * // Terminal signal with deep equality
 * const terminalSig = terminalSignal({ count: 0 });
 * terminalSig.set({ count: 0 }); // No update (same value)
 * terminalSig.set({ count: 1 }); // Triggers update (different value)
 * ```
 *
 * @example
 * ```typescript
 * // Custom equality function
 * const userSignal = terminalSignal(
 *   { id: 1, name: 'John' },
 *   (a, b) => a.id === b.id // Only compare by ID
 * );
 *
 * userSignal.set({ id: 1, name: 'Jane' }); // No update (same ID)
 * userSignal.set({ id: 2, name: 'Jane' }); // Triggers update (different ID)
 * ```
 */
export function terminalSignal<T>(
  value: T,
  customEqual?: (a: T, b: T) => boolean
): WritableSignal<T> {
  return signal(value, {
    equal: customEqual || equal,
  });
}

// LRUCache is provided by the small runtime-utils package to avoid duplicating
// this implementation across packages and keep core small.

export { parsePath };

/**
 * Clear internal caches used by the core runtime. This helps release memory
 * during explicit destroy() operations and keeps tests deterministic.
 */
import { clearParsePathCache } from '@signaltree/runtime-utils';

export function clearCaches(): void {
  try {
    clearParsePathCache();
  } catch (err) {
    void err;
  }
}

/**
 * Creates a lazy signal tree using Proxy for on-demand signal creation.
 * Only creates signals when properties are first accessed.
 *
 * @see https://github.com/JBorgia/signaltree/blob/main/docs/api/create-lazy-signal-tree.md
 * @param obj - Source object to lazily signalify
 * @param equalityFn - Equality function for signal comparison
 * @param basePath - Base path for nested objects (internal use)
 * @returns Proxied object that creates signals on first access
 */
export function createLazySignalTree<T extends object>(
  obj: T,
  equalityFn: (a: unknown, b: unknown) => boolean,
  basePath = ''
): DeepSignalify<T> {
  // Lightweight runtime: prefer a runtime-registered lazy factory (set by @signaltree/lazy-tree)
  const lazyFactory = (globalThis as any).__signaltree_lazy_factory__ as
    | undefined
    | ((
        o: object,
        eq: (a: unknown, b: unknown) => boolean,
        p?: string
      ) => unknown);

  if (typeof lazyFactory === 'function') {
    // Delegate to the registered implementation (keeps core tiny)
    return lazyFactory(
      obj as unknown as Record<string, unknown>,
      equalityFn,
      basePath
    ) as DeepSignalify<T>;
  }

  // Fallback: eager creation (simple signals for each property)
  // This ensures core remains functional even when the optional impl isn't installed.
  const store: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    try {
      (store as Record<string, unknown>)[k] = isSignal(v)
        ? v
        : signal(v, { equal: equalityFn });
    } catch (err) {
      (store as Record<string, unknown>)[k] = v;
    }
  }

  return store as unknown as DeepSignalify<T>;
}

/**
 * Native deep equality check for arrays and objects.
 * Alias for the enhanced equal function for backward compatibility.
 */
export const deepEqual = equal;

/**
 * Shallow equality check for objects and arrays.
 */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (
        (a as Record<string, unknown>)[key] !==
        (b as Record<string, unknown>)[key]
      )
        return false;
    }
    return true;
  }

  return false;
}
