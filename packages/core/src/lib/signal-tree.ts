/**
 * SignalTree Core v2.0.0 - Simplified Architecture
 * Copyright (c) 2025 Jonathan D Borgia
 * MIT License
 */

import { signal, WritableSignal, isSignal } from '@angular/core';
import type { SignalTree, DeepSignalify } from './types';

/**
 * Creates a reactive signal tree with the simplified v2.0 architecture.
 *
 * @template T - The state object type
 * @param initialState - The initial state object
 * @returns A SignalTree with reactive state and enhancer composition
 */
export function signalTree<T extends Record<string, unknown>>(
  initialState: T
): SignalTree<T> {
  // Create the deep signal structure
  const signalState = createDeepSignals(initialState);

  // Create the core tree structure
  const tree: SignalTree<T> = {
    $: signalState,
    state: signalState, // Alias for backward compatibility

    with<R>(...enhancers: Array<(tree: SignalTree<T>) => R>): R {
      return enhancers.reduce((currentTree, enhancer) => {
        return enhancer(currentTree as SignalTree<T>);
      }, tree as unknown) as R;
    },
  };

  return tree;
}

/**
 * Creates deep signal structure with proper typing and methods
 */
function createDeepSignals<T>(obj: T): DeepSignalify<T> {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return signal(obj) as DeepSignalify<T>;
  }

  if (Array.isArray(obj) || isBuiltInObject(obj)) {
    return signal(obj) as DeepSignalify<T>;
  }

  // Create signals for each property
  const result = {} as Record<string, unknown>;

  for (const [key, value] of Object.entries(obj)) {
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !isBuiltInObject(value)
    ) {
      // Nested object - create recursive structure
      const nestedSignals = createDeepSignals(value);
      result[key] = nestedSignals;

      // Add set and update methods as non-enumerable properties
      Object.defineProperty(result[key], 'set', {
        enumerable: false,
        configurable: true,
        value: function (partial: Partial<typeof value>) {
          applyPartialUpdate(this, partial);
        },
      });

      Object.defineProperty(result[key], 'update', {
        enumerable: false,
        configurable: true,
        value: function (
          updater: (current: typeof value) => Partial<typeof value>
        ) {
          const current = unwrapBranch(this);
          const update = updater(current);
          applyPartialUpdate(this, update);
        },
      });
    } else {
      // Leaf node - just a signal
      result[key] = signal(value);
    }
  }

  return result as DeepSignalify<T>;
}

/**
 * Helper to apply partial updates to nested signal structures
 */
function applyPartialUpdate<T>(
  target: Record<string, unknown>,
  update: Partial<T>
): void {
  for (const [key, value] of Object.entries(
    update as Record<string, unknown>
  )) {
    const targetProp = target[key];

    if (isSignal(targetProp)) {
      // It's a signal - update it
      (targetProp as WritableSignal<unknown>).set(value);
    } else if (
      targetProp &&
      typeof targetProp === 'object' &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !isBuiltInObject(value)
    ) {
      // Nested object with set method - recursively update
      if ('set' in targetProp && typeof targetProp.set === 'function') {
        targetProp.set(value);
      } else {
        applyPartialUpdate(targetProp as Record<string, unknown>, value);
      }
    }
  }
}

/**
 * Helper to unwrap a branch node to plain object (for update method)
 */
function unwrapBranch<T>(branch: Record<string, unknown>): T {
  const result = {} as Record<string, unknown>;

  for (const key in branch) {
    // Skip methods
    if (key === 'set' || key === 'update') continue;
    if (!Object.prototype.hasOwnProperty.call(branch, key)) continue;

    const value = branch[key];

    if (isSignal(value)) {
      result[key] = value();
    } else if (value && typeof value === 'object') {
      // Nested branch - recurse
      result[key] = unwrapBranch(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result as T;
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
