import { computed, Signal } from '@angular/core';

import type { EnhancerWithMeta, SignalTree } from '../../src/lib/types';

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
   */
  computed<R>(fn: () => R, options?: ComputedOptions): Signal<R>;

  /**
   * Creates a named computed signal for easier debugging
   */
  namedComputed<R>(
    name: string,
    fn: () => R,
    options?: ComputedOptions
  ): Signal<R>;
}

export function withComputed<T>(): EnhancerWithMeta<
  SignalTree<T>,
  SignalTree<T> & ComputedEnhancedTree
> {
  const enhancer = (
    tree: SignalTree<T>
  ): SignalTree<T> & ComputedEnhancedTree => {
    const enhanced = tree as SignalTree<T> & ComputedEnhancedTree;

    enhanced.computed = <R>(fn: () => R, options: ComputedOptions = {}) => {
      const computedOptions: { equal?: (a: R, b: R) => boolean } = {};

      if (options.equal) {
        computedOptions.equal = options.equal as (a: R, b: R) => boolean;
      }

      return computed(fn, computedOptions);
    };

    enhanced.namedComputed = <R>(
      name: string,
      fn: () => R,
      options: ComputedOptions = {}
    ) => {
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

  enhancer.metadata = {
    name: 'withComputed',
    provides: ['computed', 'namedComputed'],
    requires: [],
  };

  return enhancer;
}
