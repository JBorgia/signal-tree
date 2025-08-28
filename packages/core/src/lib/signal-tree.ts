/**
 * SignalTree Core v2.0.0 - Simplified Architecture
 * Copyright (c) 2025 Jonathan D Borgia
 * MIT License
 */

import { signal, isSignal } from '@angular/core';
import type { SignalTree, DeepSignalify } from './types';

/**
 * Creates a reactive signal tree with the simplified v2.0 architecture.
 * NO CONSTRAINTS for maximum type inference and flexibility.
 */
export function signalTree<T>(initialState: T): SignalTree<T> {
  // Create the deep signal structure
  const signalState = createDeepSignals(initialState);

  // Enhanced with function that supports proper overloads
  function withEnhancers(): SignalTree<T>;
  function withEnhancers<R1>(enhancer1: (tree: SignalTree<T>) => R1): R1;
  function withEnhancers<R1, R2>(
    enhancer1: (tree: SignalTree<T>) => R1,
    enhancer2: (tree: R1) => R2
  ): R2;
  function withEnhancers<R1, R2, R3>(
    enhancer1: (tree: SignalTree<T>) => R1,
    enhancer2: (tree: R1) => R2,
    enhancer3: (tree: R2) => R3
  ): R3;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function withEnhancers(...enhancers: Array<(tree: any) => any>): any {
    if (enhancers.length === 0) return tree;

    return enhancers.reduce((currentTree, enhancer) => {
      return enhancer(currentTree);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }, tree as any);
  }

  // Create the core tree structure
  const tree: SignalTree<T> = {
    $: signalState,
    state: signalState,
    with: withEnhancers,
  };

  return tree;
}

/**
 * Creates deep signal structure using v1.1.5 clean patterns with no constraints
 */
function createDeepSignals<T>(obj: T): DeepSignalify<T> {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return signal(obj) as DeepSignalify<T>;
  }

  if (Array.isArray(obj) || isBuiltInObject(obj)) {
    return signal(obj) as DeepSignalify<T>;
  }

  // Create signals for each property with clean typing
  const result = {} as Record<string, unknown>;

  for (const [key, value] of Object.entries(obj)) {
    // Never double-wrap signals
    if (isSignal(value)) {
      result[key] = value;
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !isBuiltInObject(value)
    ) {
      // Nested object - create recursive structure
      result[key] = createDeepSignals(value);
    } else {
      // Leaf node - just a signal
      result[key] = signal(value);
    }
  }

  return result as DeepSignalify<T>;
}

/**
 * Helper to check if a value is a built-in object that should be treated as primitive
 */
function isBuiltInObject(v: unknown): boolean {
  if (v === null || v === undefined) return false;

  return (
    v instanceof Date ||
    v instanceof RegExp ||
    typeof v === 'function' ||
    v instanceof Map ||
    v instanceof Set ||
    v instanceof WeakMap ||
    v instanceof WeakSet ||
    v instanceof ArrayBuffer ||
    v instanceof DataView ||
    v instanceof Error ||
    v instanceof Promise ||
    (typeof URL !== 'undefined' && v instanceof URL) ||
    (typeof URLSearchParams !== 'undefined' && v instanceof URLSearchParams) ||
    (typeof FormData !== 'undefined' && v instanceof FormData) ||
    (typeof Blob !== 'undefined' && v instanceof Blob) ||
    (typeof File !== 'undefined' && v instanceof File)
  );
}

// Export utilities that work with the tree
export { unwrap } from './utils';
