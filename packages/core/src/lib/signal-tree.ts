/**
 * SignalTree Core v2.0.0 - MIT License
 * Copyright (c) 2025 Jonathan D Borgia
 * @see https://github.com/JBorgia/signaltree/blob/main/LICENSE
 */

import { signal, WritableSignal, isSignal } from '@angular/core';
import type {
  SignalTree,
  DeepSignalify,
  TreeConfig,
  TreePreset,
} from './types';
import { createLazySignalTree, equal } from './utils';

// ============================================
// PERFORMANCE HEURISTICS
// ============================================

/**
 * Estimates the size of an object for strategy selection
 */
function estimateObjectSize(
  obj: unknown,
  maxDepth = 3,
  currentDepth = 0
): number {
  if (currentDepth >= maxDepth) return 1;
  if (obj === null || obj === undefined) return 0;
  if (typeof obj !== 'object') return 1;

  let size = 0;

  try {
    if (Array.isArray(obj)) {
      size = obj.length;
      const sampleSize = Math.min(3, obj.length);
      for (let i = 0; i < sampleSize; i++) {
        size += estimateObjectSize(obj[i], maxDepth, currentDepth + 1) * 0.1;
      }
    } else {
      const keys = Object.keys(obj);
      size = keys.length;
      const sampleSize = Math.min(5, keys.length);
      for (let i = 0; i < sampleSize; i++) {
        const value = (obj as Record<string, unknown>)[keys[i]];
        size += estimateObjectSize(value, maxDepth, currentDepth + 1) * 0.5;
      }
    }
  } catch {
    return 1;
  }

  return Math.floor(size);
}

/**
 * Determines whether to use lazy signal creation based on object characteristics
 */
function shouldUseLazy(obj: unknown, config: TreeConfig): boolean {
  if (config.useLazySignals !== undefined) {
    return config.useLazySignals;
  }

  if (config.debugMode || config.enableDevTools) {
    return false;
  }

  if (config.batchUpdates && config.useMemoization) {
    return true;
  }

  const estimatedSize = estimateObjectSize(obj);
  return estimatedSize > 50;
}

/**
 * Creates an equality function based on configuration
 */
function createEqualityFn(useShallowComparison: boolean) {
  return useShallowComparison ? Object.is : equal;
}

/**
 * Enhanced built-in object detection
 */
function isBuiltInObject(v: unknown): boolean {
  if (v === null || v === undefined) return false;

  if (
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
    v instanceof Promise
  ) {
    return true;
  }
  return false;
}

/**
 * Adds set and update methods to branch nodes
 */
function enhanceBranchNode<T>(node: DeepSignalify<T>): DeepSignalify<T> {
  // Only add methods to object nodes (not signals or primitives)
  if (!node || typeof node !== 'object' || isSignal(node)) {
    return node;
  }

  // Add non-enumerable set method
  Object.defineProperty(node, 'set', {
    configurable: true,
    enumerable: false,
    value: (partial: Partial<T>) => {
      if (!partial || typeof partial !== 'object') {
        throw new Error('Set must be called with a partial object');
      }

      for (const key in partial) {
        if (!Object.prototype.hasOwnProperty.call(partial, key)) continue;

        const value = partial[key];
        const currentNode = (node as Record<string, unknown>)[key];

        if (isSignal(currentNode)) {
          (currentNode as WritableSignal<unknown>).set(value);
        } else if (
          typeof currentNode === 'object' &&
          currentNode !== null &&
          'set' in currentNode &&
          typeof (currentNode as { set?: unknown }).set === 'function' &&
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          !isBuiltInObject(value)
        ) {
          // Nested branch node - recursive set
          (currentNode as { set: (value: unknown) => void }).set(value);
        }
      }
    },
  });

  // Add non-enumerable update method
  Object.defineProperty(node, 'update', {
    configurable: true,
    enumerable: false,
    value: (updater: (current: T) => Partial<T>) => {
      // Get current state by unwrapping signals
      const current = {} as T;
      for (const key in node) {
        const value = (node as Record<string, unknown>)[key];
        if (isSignal(value)) {
          (current as Record<string, unknown>)[key] = value();
        } else if (typeof value === 'object' && value !== null) {
          // For nested objects, we'd need recursive unwrap
          // For now, pass the node itself
          (current as Record<string, unknown>)[key] = value;
        } else {
          (current as Record<string, unknown>)[key] = value;
        }
      }

      const partial = updater(current);
      (node as { set: (partial: Partial<T>) => void }).set(partial);
    },
  });

  return node;
}

/**
 * Creates signals using signal-store pattern for perfect type inference.
 * Eager creation - all signals created immediately.
 */
function createSignalStore<T>(
  obj: T,
  equalityFn: (a: unknown, b: unknown) => boolean
): DeepSignalify<T> {
  // Handle primitives and null/undefined
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return signal(obj, { equal: equalityFn }) as unknown as DeepSignalify<T>;
  }

  // Handle arrays - treat as primitive signal
  if (Array.isArray(obj)) {
    return signal(obj, { equal: equalityFn }) as unknown as DeepSignalify<T>;
  }

  // Handle built-in objects - treat as primitive signal
  if (isBuiltInObject(obj)) {
    return signal(obj, { equal: equalityFn }) as unknown as DeepSignalify<T>;
  }

  const store: Partial<DeepSignalify<T>> = {};
  const processedObjects = new WeakSet<object>();

  // Prevent circular references
  if (processedObjects.has(obj as object)) {
    console.warn(
      '[SignalTree] Circular reference detected, creating reference signal'
    );
    return signal(obj, { equal: equalityFn }) as unknown as DeepSignalify<T>;
  }
  processedObjects.add(obj as object);

  try {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      try {
        if (typeof key === 'symbol') continue;

        if (isSignal(value)) {
          (store as Record<string, unknown>)[key] = value;
          continue;
        }

        if (value === null || value === undefined) {
          (store as Record<string, unknown>)[key] = signal(value, {
            equal: equalityFn,
          });
        } else if (typeof value !== 'object') {
          // Primitives
          (store as Record<string, unknown>)[key] = signal(value, {
            equal: equalityFn,
          });
        } else if (Array.isArray(value) || isBuiltInObject(value)) {
          // Arrays and built-in objects
          (store as Record<string, unknown>)[key] = signal(value, {
            equal: equalityFn,
          });
        } else {
          // Nested objects - recurse and enhance
          const nestedStore = createSignalStore(value, equalityFn);
          (store as Record<string, unknown>)[key] =
            enhanceBranchNode(nestedStore);
        }
      } catch (error) {
        console.warn(
          `[SignalTree] Failed to create signal for key "${key}":`,
          error
        );
        (store as Record<string, unknown>)[key] = signal(value, {
          equal: equalityFn,
        });
      }
    }

    // Handle symbol properties if present
    const symbols = Object.getOwnPropertySymbols(obj);
    for (const sym of symbols) {
      const value = (obj as Record<symbol, unknown>)[sym];
      try {
        if (isSignal(value)) {
          (store as Record<symbol, unknown>)[sym] = value;
        } else {
          (store as Record<symbol, unknown>)[sym] = signal(value, {
            equal: equalityFn,
          });
        }
      } catch (error) {
        console.warn(
          `[SignalTree] Failed to create signal for symbol key:`,
          error
        );
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to create signal store: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }

  // Enhance the root store with set/update methods
  return enhanceBranchNode(store as DeepSignalify<T>);
}

/**
 * Core function to create a minimal SignalTree with composable enhancers
 */
function create<T>(obj: T, config: TreeConfig = {}): SignalTree<T> {
  // Validate input
  if (obj === null || obj === undefined) {
    throw new Error('Cannot create SignalTree from null or undefined');
  }

  const equalityFn = createEqualityFn(config.useShallowComparison ?? false);
  const useLazy = shouldUseLazy(obj, config);

  if (config.debugMode) {
    const estimatedSize = estimateObjectSize(obj);
    console.log(
      `[SignalTree] Creating tree with ${
        useLazy ? 'lazy' : 'eager'
      } strategy (estimated size: ${estimatedSize})`
    );
  }

  // Create signals using appropriate strategy
  let signalState: DeepSignalify<T>;

  try {
    if (useLazy && typeof obj === 'object') {
      signalState = createLazySignalTree(
        obj as object,
        equalityFn
      ) as unknown as DeepSignalify<T>;
    } else {
      signalState = createSignalStore(obj, equalityFn);
    }
  } catch (error) {
    if (useLazy) {
      console.warn(
        '[SignalTree] Lazy creation failed, falling back to eager:',
        error
      );
      signalState = createSignalStore(obj, equalityFn);
    } else {
      throw error;
    }
  }

  // Create minimal tree with just $ and with
  const tree: SignalTree<T> = {
    $: signalState,
    state: signalState, // Alias for backward compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    with<R>(...enhancers: Array<(tree: any) => any>): R {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return enhancers.reduce((acc, enhance) => enhance(acc), this as any) as R;
    },
  };

  return tree;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Creates a minimal reactive signal tree with composable enhancers
 */
export function signalTree<T>(obj: T): SignalTree<T>;

/**
 * Creates a reactive signal tree with preset configuration
 */
export function signalTree<T>(obj: T, preset: TreePreset): SignalTree<T>;

/**
 * Creates a reactive signal tree with custom configuration
 */
export function signalTree<T>(obj: T, config: TreeConfig): SignalTree<T>;

/**
 * Main SignalTree factory function
 */
export function signalTree<T extends Record<string, unknown>>(
  obj: Required<T>,
  configOrPreset?: TreeConfig | TreePreset
): SignalTree<Required<T>>;

export function signalTree<T>(
  obj: T,
  configOrPreset?: TreeConfig | TreePreset
): SignalTree<T>;

export function signalTree<T>(
  obj: T,
  configOrPreset?: TreeConfig | TreePreset
): SignalTree<T> {
  // Handle preset strings
  if (typeof configOrPreset === 'string') {
    const presetConfigs: Record<TreePreset, Partial<TreeConfig>> = {
      basic: {
        useLazySignals: false,
        debugMode: false,
      },
      performance: {
        useLazySignals: true,
        batchUpdates: true,
        useMemoization: true,
        useShallowComparison: true,
      },
      development: {
        useLazySignals: false,
        debugMode: true,
        enableDevTools: true,
        trackPerformance: true,
      },
      production: {
        useLazySignals: true,
        batchUpdates: true,
        useMemoization: true,
        debugMode: false,
      },
    };

    const config = presetConfigs[configOrPreset];
    if (!config) {
      console.warn(
        `Unknown preset: ${configOrPreset}, using default configuration`
      );
      return create(obj, {});
    }
    return create(obj, config);
  }

  // Handle configuration objects or default
  const config = configOrPreset || {};
  return create(obj, config);
}
