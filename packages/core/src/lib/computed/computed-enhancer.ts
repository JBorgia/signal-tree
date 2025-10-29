import { computed, Signal } from '@angular/core';

import type { EnhancerWithMeta, SignalTree } from '../types';

/**
 * Options for computed signal creation
 */
export interface ComputedOptions {
  /**
   * Whether to use memoization (caching)
   * @default true
   */
  memoize?: boolean;

  /**
   * Custom equality function for memoization
   */
  equal?: (a: unknown, b: unknown) => boolean;
}

/**
 * Enhanced tree with computed capabilities
 */
export interface ComputedEnhancedTree {
  /**
   * Creates a computed signal that automatically tracks dependencies
   * from the tree and memoizes the result.
   *
   * @param fn - Computation function that returns a value
   * @param options - Optional configuration for the computed signal
   * @returns A signal with the computed value
   *
   * @example
   * ```typescript
   * const tree = signalTree({ items: [{ price: 10, qty: 2 }] })
   *   .with(withComputed());
   *
   * // Automatically tracks tree.$.items
   * const total = tree.computed(() =>
   *   tree.$.items().reduce((sum, item) => sum + item.price * item.qty, 0)
   * );
   *
   * console.log(total()); // 20
   * tree.$.items([{ price: 10, qty: 3 }]);
   * console.log(total()); // 30 (automatically recomputed)
   * ```
   */
  computed<R>(fn: () => R, options?: ComputedOptions): Signal<R>;

  /**
   * Creates a named computed signal for easier debugging
   *
   * @param name - Name for debugging purposes
   * @param fn - Computation function
   * @param options - Optional configuration
   * @returns A signal with the computed value
   *
   * @example
   * ```typescript
   * const tree = signalTree({ count: 5 }).with(withComputed());
   *
   * const doubled = tree.namedComputed('doubled', () => tree.$.count() * 2);
   * console.log(doubled()); // 10
   * ```
   */
  namedComputed<R>(
    name: string,
    fn: () => R,
    options?: ComputedOptions
  ): Signal<R>;
}

/**
 * Enhancer that adds computed signal capabilities to a SignalTree.
 *
 * This enhancer allows you to create reactive computed values that automatically
 * track dependencies from the tree and recompute only when those dependencies change.
 *
 * Features:
 * - Automatic dependency tracking using Angular's computed()
 * - Built-in memoization for performance
 * - Custom equality functions for fine-grained control
 * - Named computeds for easier debugging
 *
 * @example
 * ```typescript
 * import { signalTree } from '@signaltree/core';
 * import { withComputed } from '@signaltree/core/computed';
 *
 * const tree = signalTree({
 *   cart: {
 *     items: [
 *       { id: 1, price: 10, quantity: 2 },
 *       { id: 2, price: 20, quantity: 1 }
 *     ],
 *     taxRate: 0.1,
 *     shipping: 5
 *   }
 * }).with(withComputed());
 *
 * // Computed values automatically track dependencies
 * const subtotal = tree.computed(() =>
 *   tree.$.cart.items().reduce((sum, item) =>
 *     sum + item.price * item.quantity, 0
 *   )
 * );
 *
 * const tax = tree.computed(() =>
 *   subtotal() * tree.$.cart.taxRate()
 * );
 *
 * const total = tree.computed(() =>
 *   subtotal() + tax() + tree.$.cart.shipping()
 * );
 *
 * console.log(total()); // 35 + 3.5 + 5 = 43.5
 *
 * // Update triggers automatic recomputation
 * tree.$.cart.items([
 *   { id: 1, price: 10, quantity: 3 }
 * ]);
 * console.log(total()); // 30 + 3 + 5 = 38
 * ```
 *
 * @example
 * ```typescript
 * // Named computed for debugging
 * const tree = signalTree({ users: [] }).with(withComputed());
 *
 * const activeUsers = tree.namedComputed(
 *   'activeUsers',
 *   () => tree.$.users().filter(u => u.active)
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Custom equality for deep comparisons
 * const tree = signalTree({ data: { nested: { value: 1 } } })
 *   .with(withComputed());
 *
 * const deepValue = tree.computed(
 *   () => tree.$.data().nested.value,
 *   {
 *     equal: (a, b) => JSON.stringify(a) === JSON.stringify(b)
 *   }
 * );
 * ```
 */
export function withComputed<T>(): EnhancerWithMeta<
  SignalTree<T>,
  SignalTree<T> & ComputedEnhancedTree
> {
  const enhancer = (
    tree: SignalTree<T>
  ): SignalTree<T> & ComputedEnhancedTree => {
    const enhanced = tree as SignalTree<T> & ComputedEnhancedTree;

    // Add computed method
    enhanced.computed = <R>(
      fn: () => R,
      options: ComputedOptions = {}
    ): Signal<R> => {
      const computedOptions: { equal?: (a: R, b: R) => boolean } = {};

      if (options.equal) {
        computedOptions.equal = options.equal as (a: R, b: R) => boolean;
      }

      // Use Angular's computed for automatic dependency tracking
      return computed(fn, computedOptions);
    };

    // Add namedComputed method (same as computed, name is for debugging)
    enhanced.namedComputed = <R>(
      name: string,
      fn: () => R,
      options: ComputedOptions = {}
    ): Signal<R> => {
      // In development, we could log the name for debugging
      if (
        typeof process !== 'undefined' &&
        process.env?.['NODE_ENV'] === 'development'
      ) {
        const originalFn = fn;
        fn = () => {
          try {
            return originalFn();
          } catch (error) {
            console.error(`[SignalTree] Error in computed "${name}":`, error);
            throw error;
          }
        };
      }

      return enhanced.computed(fn, options);
    };

    return enhanced;
  };

  // Add metadata for enhancer ordering
  enhancer.metadata = {
    name: 'withComputed',
    provides: ['computed', 'namedComputed'],
    requires: [],
  };

  return enhancer;
}
