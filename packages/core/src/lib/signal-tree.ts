/**
 * SignalTree Core v1.1.6 - MIT License
 * Copyright (c) 2025 Jonathan D Borgia
 * @see https://github.com/JBorgia/signaltree/blob/main/LICENSE
 */

import {
  signal,
  WritableSignal,
  Signal,
  computed,
  effect,
  inject,
  DestroyRef,
  isSignal,
} from '@angular/core';
import type {
  SignalTree,
  DeepSignalify,
  TreeConfig,
  TreePreset,
  Middleware,
  PerformanceMetrics,
  EntityHelpers,
  AsyncActionConfig,
  AsyncAction,
  TimeTravelEntry,
} from './types';
import { equal } from './utils';

// runtime flag for dev logs (typed to avoid any)
const ENABLE_DEV_LOGS_CORE =
  typeof ngDevMode !== 'undefined'
    ? Boolean(ngDevMode as unknown as boolean)
    : typeof process !== 'undefined' &&
      (process as { env?: { NODE_ENV?: string } })
    ? (process as { env?: { NODE_ENV?: string } }).env?.NODE_ENV !==
      'production'
    : false;

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
  // Lightweight heuristic: avoid deep recursion to keep runtime footprint tiny.
  if (obj === null || obj === undefined) return 0;
  if (typeof obj !== 'object') return 1;

  try {
    if (Array.isArray(obj)) return Math.min(1000, obj.length);
    const keys = Object.keys(obj);
    // Count top-level keys only; this gives a quick approximation used for strategy.
    return Math.min(1000, keys.length);
  } catch (err) {
    void err;
    return 1;
  }
}

/**
 * Determines whether to use lazy signal creation based on object characteristics
 */
function shouldUseLazy(obj: unknown, config: TreeConfig): boolean {
  // Explicit configuration takes precedence
  if (config.useLazySignals !== undefined) {
    return config.useLazySignals;
  }

  // Development mode: prefer eager for better debugging
  if (config.debugMode || config.enableDevTools) {
    return false;
  }

  // Performance mode: always use lazy
  if (config.batchUpdates && config.useMemoization) {
    return true;
  }

  // Auto-detect based on size
  const estimatedSize = estimateObjectSize(obj);

  // Use lazy for objects with more than 50 estimated properties
  return estimatedSize > 50;
}

/**
 * Creates an equality function based on configuration.
 *
 * @param useShallowComparison - If true, uses Object.is for comparison; otherwise uses deep equality
 * @returns A function that compares two values for equality
 */
function createEqualityFn(useShallowComparison: boolean) {
  return useShallowComparison ? Object.is : equal;
}

/**
 * Enhanced built-in object detection with comprehensive coverage
 */
function isBuiltInObject(v: unknown): boolean {
  if (v === null || v === undefined) return false;

  // Core JavaScript built-ins
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
 * Creates a callable proxy that acts like the classic implementation
 */
function createCallableProxy<T>(
  nestedStore: DeepSignalify<T>,
  isBuiltInObjectFn: (v: unknown) => boolean
): DeepSignalify<T> {
  // Create the unwrap logic
  const unwrapFunction = (): T => {
    const unwrapObject = <O>(obj: unknown): O => {
      if (typeof obj !== 'object' || obj === null) {
        return obj as O;
      }

      // Handle signals directly
      if (isSignal(obj)) {
        return (obj as Signal<O>)();
      }

      // If it's a callable nested object (has our special marker), call it
      if (
        typeof obj === 'function' &&
        (obj as (() => unknown) & { __isCallableProxy__?: boolean })
          .__isCallableProxy__ === true
      ) {
        return obj();
      }

      const result = {} as Record<string, unknown>;

      for (const key in obj as Record<string, unknown>) {
        // Skip our special properties
        if (key === 'update' || key === '__isCallableProxy__') continue;

        const value = (obj as Record<string, unknown>)[key];

        if (isSignal(value)) {
          result[key] = (value as Signal<unknown>)();
        } else if (
          typeof value === 'function' &&
          (value as (() => unknown) & { __isCallableProxy__?: boolean })
            .__isCallableProxy__ === true
        ) {
          // It's a callable nested SignalTree node
          result[key] = value();
        } else if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          !isBuiltInObjectFn(value)
        ) {
          result[key] = unwrapObject(value);
        } else {
          result[key] = value;
        }
      }

      return result as O;
    };

    return unwrapObject(nestedStore);
  };

  // Create a callable function with all properties attached
  const callableProxy = new Proxy(unwrapFunction, {
    apply(target) {
      // When called as a function, execute the unwrap logic
      return target();
    },

    get(target, prop) {
      // Return the unwrap function when called
      if (
        prop === Symbol.toPrimitive ||
        prop === 'valueOf' ||
        prop === 'toString'
      ) {
        return () => unwrapFunction();
      }

      // Mark this as a callable proxy
      if (prop === '__isCallableProxy__') {
        return true;
      }

      // Handle update method - supports both functional and imperative styles
      if (prop === 'update') {
        return (
          updaterOrPartial: ((current: T) => Partial<T>) | Partial<T>
        ) => {
          let partialObj: Partial<T>;

          // Check if it's a function (functional style) or object (imperative style)
          if (typeof updaterOrPartial === 'function') {
            // Functional style: update((current) => ({ ...changes }))
            const currentValue = unwrapFunction();
            partialObj = updaterOrPartial(currentValue);
          } else {
            // Imperative style: update({ ...changes })
            partialObj = updaterOrPartial;
          }

          if (!partialObj || typeof partialObj !== 'object') {
            throw new Error('Update must return/receive an object');
          }

          const updateObject = <O>(
            target:
              | Record<string, unknown>
              | ((() => unknown) & { [key: string]: unknown }),
            updates: Partial<O>
          ): void => {
            for (const key in updates) {
              if (!Object.prototype.hasOwnProperty.call(updates, key)) continue;

              const updateValue = updates[key];
              const currentSignalOrState = target[key];

              if (isSignal(currentSignalOrState)) {
                (currentSignalOrState as WritableSignal<unknown>).set(
                  updateValue
                );
              } else if (
                typeof currentSignalOrState === 'function' &&
                (
                  currentSignalOrState as (() => unknown) & {
                    __isCallableProxy__?: boolean;
                  }
                ).__isCallableProxy__ === true &&
                updateValue !== null &&
                typeof updateValue === 'object' &&
                !Array.isArray(updateValue) &&
                !isBuiltInObjectFn(updateValue)
              ) {
                // It's a nested callable proxy - recursively update
                updateObject(
                  currentSignalOrState as Record<string, unknown>,
                  updateValue
                );
              }
            }
          };

          updateObject(nestedStore, partialObj);
        };
      }

      // Do not expose a batchUpdate shim by default. The batching enhancer
      // will attach `batchUpdate` when enabled. Tests expect `batchUpdate`
      // to be undefined unless the enhancer is explicitly applied.

      // Handle set method - shallow merge with current state
      if (prop === 'set') {
        return (partialObj: Partial<T>) => {
          if (!partialObj || typeof partialObj !== 'object') {
            throw new Error('Set must be called with an object');
          }

          const updateObject = <O>(
            target:
              | Record<string, unknown>
              | ((() => unknown) & { [key: string]: unknown }),
            updates: Partial<O>
          ): void => {
            for (const key in updates) {
              if (!Object.prototype.hasOwnProperty.call(updates, key)) continue;

              const updateValue = updates[key];
              const currentSignalOrState = target[key];

              if (isSignal(currentSignalOrState)) {
                (currentSignalOrState as WritableSignal<unknown>).set(
                  updateValue
                );
              } else if (
                typeof currentSignalOrState === 'function' &&
                (
                  currentSignalOrState as (() => unknown) & {
                    __isCallableProxy__?: boolean;
                  }
                ).__isCallableProxy__ === true &&
                updateValue !== null &&
                typeof updateValue === 'object' &&
                !Array.isArray(updateValue) &&
                !isBuiltInObjectFn(updateValue)
              ) {
                // It's a nested callable proxy - recursively update
                updateObject(
                  currentSignalOrState as Record<string, unknown>,
                  updateValue
                );
              }
            }
          };

          updateObject(nestedStore, partialObj);
        };
      }

      // Return the property from the nested store
      return (nestedStore as Record<string | symbol, unknown>)[prop];
    },

    has(target, prop) {
      return prop in nestedStore;
    },

    ownKeys() {
      return Reflect.ownKeys(nestedStore);
    },

    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(nestedStore, prop);
    },
  });

  return callableProxy as DeepSignalify<T>;
}

/**
 * Enhanced function to create signal store with callable nested objects
 */
function enhanceNestedObject<T>(
  nestedStore: DeepSignalify<T>,
  isBuiltInObjectFn: (v: unknown) => boolean
): DeepSignalify<T> {
  return createCallableProxy<T>(nestedStore, isBuiltInObjectFn);
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
        // Skip symbol keys for now (handle separately if needed)
        if (typeof key === 'symbol') continue;

        // Never double-wrap signals
        if (isSignal(value)) {
          (store as Record<string, unknown>)[key] = value;
          continue;
        }

        // Handle different value types
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
          // Nested objects - recurse (recursive call handles enhancement)
          const nestedStore = createSignalStore(value, equalityFn);
          (store as Record<string, unknown>)[key] = nestedStore;
        }
      } catch (error) {
        console.warn(
          `[SignalTree] Failed to create signal for key "${key}":`,
          error
        );
        // Fallback: treat as primitive
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

  // Wrap the entire store in a callable proxy for root-level access
  return enhanceNestedObject<T>(store as DeepSignalify<T>, isBuiltInObject);
}

/**
 * Core function to create a basic SignalTree with enhanced safety and smart strategy selection.
 * This provides the minimal functionality without advanced features.
 *
 * @template T - The state object type (NO constraints - maximum flexibility)
 * @param obj - The initial state object
 * @param config - Configuration options for the tree
 * @returns A basic SignalTree with core functionality
 */
function create<T>(obj: T, config: TreeConfig = {}): SignalTree<T> {
  // Validate input
  if (obj === null || obj === undefined) {
    throw new Error('Cannot create SignalTree from null or undefined');
  }

  const equalityFn = createEqualityFn(config.useShallowComparison ?? false);
  const useLazy = shouldUseLazy(obj, config);

  // runtime flag for dev logs (typed to avoid any)
  const ENABLE_DEV_LOGS_CORE =
    typeof ngDevMode !== 'undefined'
      ? Boolean(ngDevMode as unknown as boolean)
      : typeof process !== 'undefined' &&
        (process as { env?: { NODE_ENV?: string } })
      ? (process as { env?: { NODE_ENV?: string } }).env?.NODE_ENV !==
        'production'
      : false;

  // Log strategy selection in debug mode
  if (config.debugMode && ENABLE_DEV_LOGS_CORE) {
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
      // Try runtime-registered lazy factory exposed on globalThis
      const factory = (globalThis as any).__signaltree_lazy_factory__ as
        | undefined
        | ((
            o: object,
            eq: (a: unknown, b: unknown) => boolean,
            p?: string
          ) => unknown);

      if (typeof factory === 'function') {
        signalState = factory(
          obj as object,
          equalityFn
        ) as unknown as DeepSignalify<T>;
      } else {
        // No lazy factory available at runtime; fall back to eager creation
        signalState = createSignalStore(
          obj,
          equalityFn
        ) as unknown as DeepSignalify<T>;
      }
    } else {
      signalState = createSignalStore(
        obj,
        equalityFn
      ) as unknown as DeepSignalify<T>;
    }
  } catch (error) {
    // Fallback to eager if lazy fails
    if (useLazy) {
      console.warn(
        '[SignalTree] Lazy creation failed, falling back to eager:',
        error
      );
      signalState = createSignalStore(
        obj,
        equalityFn
      ) as unknown as DeepSignalify<T>;
    } else {
      throw error;
    }
  }

  const resultTree = {
    state: signalState,
    $: signalState, // $ points to the same state object
  } as SignalTree<T>;

  enhanceTree(resultTree, config);
  return resultTree;
}

/**
 * Enhances a tree with basic functionality ('with', destroy).
 * The state itself (tree.$) provides the callable unwrapping and update functionality.
 *
 * @template T - The state object type
 * @param tree - The tree to enhance with basic functionality
 * @param config - Configuration used during tree creation
 * @returns The enhanced tree with composition ('with') and destroy methods
 */
function enhanceTree<T>(
  tree: SignalTree<T>,
  config: TreeConfig = {}
): SignalTree<T> {
  // Track if this tree uses lazy signals for proper cleanup
  const isLazy = config.useLazySignals ?? shouldUseLazy(tree.state, config);

  // Private cleanup registry for enhancers and internals to register teardown
  const CLEANUP_REGISTRY = Symbol.for('__signaltree_cleanup_registry__');
  // Idempotent destroyed flag
  const DESTROYED_FLAG = Symbol.for('__signaltree_destroyed__');

  // Initialize registry if not present
  try {
    if (!(CLEANUP_REGISTRY in tree)) {
      Object.defineProperty(tree, CLEANUP_REGISTRY, {
        value: [] as Array<() => void>,
        configurable: true,
        enumerable: false,
        writable: false,
      });
    }
    // Provide a non-enumerable register helper for enhancers
    if (!('__registerCleanup' in tree)) {
      Object.defineProperty(tree, '__registerCleanup', {
        value: (fn: () => void) => {
          try {
            const reg = (tree as any)[CLEANUP_REGISTRY] as Array<() => void>;
            reg.push(fn);
          } catch (err) {
            void err;
          }
        },
        configurable: true,
        enumerable: false,
        writable: false,
      });
    }
  } catch (err) {
    void err;
  }

  // 'with' implementation for function composition
  tree.with = (<TResult = SignalTree<T>>(
    ...fns: Array<(input: unknown) => unknown>
  ): TResult => {
    if (fns.length === 0) {
      return tree as unknown as TResult;
    }

    return fns.reduce((acc, fn) => {
      if (typeof fn !== 'function') {
        throw new Error("All 'with' arguments must be functions");
      }
      try {
        return fn(acc);
      } catch (error) {
        console.error("[SignalTree] 'with' function failed:", error);
        throw error;
      }
    }, tree as unknown) as TResult;
  }) as SignalTree<T>['with'];

  // Enhanced destroy with proper cleanup
  tree.destroy = () => {
    try {
      // Ensure idempotent destroy
      if ((tree as any)[DESTROYED_FLAG]) return;
      try {
        Object.defineProperty(tree, DESTROYED_FLAG, {
          value: true,
          configurable: true,
          enumerable: false,
          writable: false,
        });
      } catch (err) {
        void err;
      }

      // Run registered cleanup functions from enhancers and internals
      try {
        const reg = (tree as any)[CLEANUP_REGISTRY] as Array<() => void>;
        if (Array.isArray(reg)) {
          for (const fn of reg.slice()) {
            try {
              fn();
            } catch (err) {
              console.warn('[SignalTree] cleanup error:', err);
            }
          }
          reg.length = 0;
        }
      } catch (err) {
        void err;
      }

      // Clean up lazy signal proxies if they exist (backwards compat)
      if (isLazy) {
        const state = tree.state as unknown;
        if (state && typeof state === 'object' && '__cleanup__' in state) {
          const cleanup = (state as { __cleanup__: unknown }).__cleanup__;
          if (typeof cleanup === 'function') {
            try {
              cleanup();
            } catch (err) {
              console.warn('[SignalTree] lazy cleanup error:', err);
            }
          }
        }
      }

      // Clear pending batched updates if available
      try {
        // Import function at runtime to avoid circular static import
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const { clearPendingBatchedUpdates } = require('@signaltree/batching');
        if (typeof clearPendingBatchedUpdates === 'function') {
          try {
            clearPendingBatchedUpdates();
          } catch (err) {
            void err;
          }
        }
      } catch (err) {
        void err;
      }

      // Clear core caches
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const { clearCaches } = require('./utils');
        if (typeof clearCaches === 'function') {
          try {
            clearCaches();
          } catch (err) {
            void err;
          }
        }
      } catch (err) {
        void err;
      }

      if (config.debugMode) {
        console.log('[SignalTree] Tree destroyed');
      }
    } catch (error) {
      console.error('[SignalTree] Error during cleanup:', error);
    }
  };

  // Add stub implementations for advanced features
  addStubMethods(tree, config);

  return tree;
}

/**
 * Adds stub implementations for advanced features
 */
function addStubMethods<T>(tree: SignalTree<T>, config: TreeConfig): void {
  // Stub implementations for advanced features (will log warnings)
  // Note: batchUpdate and related batching helpers are provided by the
  // optional @signaltree/batching enhancer. We intentionally do not add a
  // shim here on the core SignalTree or on the callable proxy (`tree.$`) to
  // avoid brittle proxy-wrapping and to keep core semantics stable. If a
  // consumer calls `tree.$.batchUpdate` without installing the batching
  // enhancer, they'll receive a runtime error — this encourages explicit
  // installation of the batching package and prevents surprising behavior.

  tree.memoize = <R>(fn: (tree: T) => R, cacheKey?: string): Signal<R> => {
    console.warn(
      '⚠️ memoize() called but memoization is not enabled.',
      'To enable memoized computations, install @signaltree/memoization'
    );
    void cacheKey; // Mark as intentionally unused
    return computed(() => fn(tree.$()));
  };

  tree.effect = (fn: (tree: T) => void) => {
    try {
      effect(() => fn(tree.$()));
    } catch (error) {
      // Fallback for test environments without injection context
      if (config.debugMode && ENABLE_DEV_LOGS_CORE) {
        console.warn('Effect requires Angular injection context', error);
      }
    }
  };

  tree.subscribe = (fn: (tree: T) => void): (() => void) => {
    try {
      const destroyRef = inject(DestroyRef);
      let isDestroyed = false;

      const effectRef = effect(() => {
        if (!isDestroyed) {
          fn(tree.$());
        }
      });

      const unsubscribe = () => {
        isDestroyed = true;
        effectRef.destroy();
      };

      destroyRef.onDestroy(unsubscribe);
      return unsubscribe;
    } catch (error) {
      // Fallback for test environment
      if (config.debugMode && ENABLE_DEV_LOGS_CORE) {
        console.warn('Subscribe requires Angular injection context', error);
      }
      fn(tree.$());
      return () => {
        // No-op unsubscribe
      };
    }
  };

  // Performance stubs
  tree.optimize = () => {
    if (config.debugMode && ENABLE_DEV_LOGS_CORE) {
      console.warn(
        '⚠️ optimize() called but tree optimization is not available.'
      );
    }
  };

  tree.clearCache = () => {
    if (config.debugMode) {
      console.warn('⚠️ clearCache() called but caching is not available.');
    }
  };

  tree.invalidatePattern = (): number => {
    if (config.debugMode) {
      console.warn(
        '⚠️ invalidatePattern() called but performance optimization is not enabled.'
      );
    }
    return 0;
  };

  tree.getMetrics = (): PerformanceMetrics => {
    // Return actual metrics if we're tracking them
    return {
      updates: 0,
      computations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageUpdateTime: 0,
    };
  };

  // Middleware stubs
  tree.addTap = (middleware: Middleware<T>) => {
    if (config.debugMode) {
      console.warn(
        '⚠️ addTap() called but middleware support is not available.'
      );
    }
    void middleware;
  };

  tree.removeTap = (id: string) => {
    if (config.debugMode) {
      console.warn(
        '⚠️ removeTap() called but middleware support is not available.'
      );
    }
    void id;
  };

  // Entity helpers stub
  tree.asCrud = <E extends { id: string | number }>(): EntityHelpers<E> => {
    if (config.debugMode) {
      console.warn('⚠️ asCrud() called but entity helpers are not available.');
    }
    return {} as EntityHelpers<E>;
  };

  // Async action stub
  tree.asyncAction = <TInput, TResult>(
    operation: (input: TInput) => Promise<TResult>,
    asyncConfig: AsyncActionConfig<T, TResult> = {}
  ): AsyncAction<TInput, TResult> => {
    if (config.debugMode) {
      console.warn(
        '⚠️ asyncAction() called but async actions are not available.'
      );
    }
    void operation;
    void asyncConfig;
    return {} as AsyncAction<TInput, TResult>;
  };

  // Time travel stubs
  tree.undo = () => {
    if (config.debugMode) {
      console.warn('⚠️ undo() called but time travel is not available.');
    }
  };

  tree.redo = () => {
    if (config.debugMode) {
      console.warn('⚠️ redo() called but time travel is not available.');
    }
  };

  tree.getHistory = (): TimeTravelEntry<T>[] => {
    if (config.debugMode) {
      console.warn('⚠️ getHistory() called but time travel is not available.');
    }
    return [];
  };

  tree.resetHistory = () => {
    if (config.debugMode) {
      console.warn(
        '⚠️ resetHistory() called but time travel is not available.'
      );
    }
  };
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Creates a reactive signal tree with smart progressive enhancement.
 */
export function signalTree<T>(obj: T): SignalTree<T>;

/**
 * Creates a reactive signal tree with preset configuration.
 */
export function signalTree<T>(obj: T, preset: TreePreset): SignalTree<T>;

/**
 * Creates a reactive signal tree with custom configuration.
 */
export function signalTree<T>(obj: T, config: TreeConfig): SignalTree<T>;

/**
 * Main SignalTree factory function with superior type inference.
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
    // Map preset to configuration
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
        useLazySignals: false, // Eager for better debugging
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
