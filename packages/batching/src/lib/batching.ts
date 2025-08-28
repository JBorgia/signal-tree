import { unwrap, parsePath } from '@signaltree/core';
import type { DeepSignalify, SignalTree } from '@signaltree/core';
import { isSignal, WritableSignal } from '@angular/core';

/**
 * Configuration options for intelligent batching behavior.
 * Controls how updates are grouped and processed for optimal performance.
 */
interface BatchingConfig {
  /** Whether batching is enabled (default: true) */
  enabled?: boolean;
  /** Maximum number of updates per batch (default: 100) */
  maxBatchSize?: number;
  /** Delay before auto-flushing batch in milliseconds (default: 16) */
  autoFlushDelay?: number;
  /** Maximum time to wait before forcing batch flush (default: 100) */
  batchTimeoutMs?: number;
}

/**
 * Enhanced SignalTree interface with intelligent batching capabilities.
 * Provides high-performance batch update methods that group multiple state changes.
 *
 * @template T - The state object type
 */
interface BatchingSignalTree<T> extends SignalTree<T> {
  /**
   * Batches multiple state updates into a single change cycle for optimal performance.
   * Groups related updates to prevent UI thrashing and improve rendering efficiency.
   *
   * @param updater - Function that receives current state and returns partial update
   */
  batchUpdate(updater: (current: T) => Partial<T>): void;

  /**
   * Flushes all pending batched updates immediately
   */
  flushBatch(): void;

  /**
   * Returns whether there are pending batched updates
   */
  hasPendingBatch(): boolean;

  /**
   * Returns the number of pending updates in the batch queue
   */
  getBatchSize(): number;
}

/**
 * Represents a queued update in the batching system.
 */
interface BatchedUpdate {
  /** The update function to execute */
  fn: () => void;
  /** Timestamp when the update was queued */
  startTime: number;
  /** Nesting depth for optimal execution order */
  depth: number;
  /** State path for update grouping and optimization */
  path: string;
}

// Global batching manager registry for testing
// Use Map instead of WeakMap since we need to iterate
const batchingManagers = new Map<SignalTree<unknown>, BatchingManager>();

interface BatchingManager {
  flush: () => void;
  getSize: () => number;
  hasPending: () => boolean;
  getQueue: () => BatchedUpdate[];
}

/**
 * Helper to apply partial updates to the signal tree using v2.0 architecture
 */
function applyPartialUpdate<T>(
  signals: DeepSignalify<T>,
  update: Partial<T>,
  addToQueue?: (update: BatchedUpdate) => void,
  basePath = ''
): void {
  for (const [key, value] of Object.entries(update)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const target = (signals as any)[key];
    const currentPath = basePath ? `${basePath}.${key}` : key;

    if (!target) {
      console.warn(`Property ${key} does not exist on tree`);
      continue;
    }

    // Handle signals (leaf nodes)
    if (isSignal(target)) {
      const updateFn = () => {
        (target as WritableSignal<unknown>).set(value);
      };

      if (addToQueue) {
        addToQueue({
          fn: updateFn,
          startTime: performance.now(),
          depth: parsePath(currentPath).length,
          path: currentPath,
        });
      } else {
        updateFn();
      }
    }
    // Handle branch nodes with set method
    else if (
      typeof target === 'object' &&
      'set' in target &&
      typeof target.set === 'function'
    ) {
      if (typeof value === 'object' && value !== null) {
        const updateFn = () => {
          target.set(value);
        };

        if (addToQueue) {
          addToQueue({
            fn: updateFn,
            startTime: performance.now(),
            depth: parsePath(currentPath).length,
            path: currentPath,
          });
        } else {
          updateFn();
        }
      } else {
        console.warn(`Cannot set primitive value ${value} on branch ${key}`);
      }
    }
    // Handle nested objects without set method (recursively apply updates)
    else if (
      typeof target === 'object' &&
      typeof value === 'object' &&
      value !== null
    ) {
      applyPartialUpdate(target, value, addToQueue, currentPath);
    }
  }
}

/**
 * Creates a proxy wrapper that intercepts set/update methods for batching
 */
function createBatchingProxy(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target: any,
  addToQueue: (update: BatchedUpdate) => void,
  path = ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  // Cache for nested proxies
  const proxyCache = new WeakMap();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createProxy = (obj: any, currentPath: string): any => {
    if (!obj || typeof obj !== 'object') return obj;
    if (isSignal(obj)) return obj;

    // Check cache first
    if (proxyCache.has(obj)) {
      return proxyCache.get(obj);
    }

    const proxy = new Proxy(obj, {
      get(target, prop) {
        const value = target[prop];

        // Intercept 'set' method on branch nodes
        if (prop === 'set' && typeof value === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return function (update: any) {
            addToQueue({
              fn: () => value.call(target, update),
              startTime: performance.now(),
              depth: parsePath(currentPath).length,
              path: currentPath,
            });
          };
        }

        // Intercept 'update' method on branch nodes
        if (prop === 'update' && typeof value === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return function (updater: any) {
            addToQueue({
              fn: () => value.call(target, updater),
              startTime: performance.now(),
              depth: parsePath(currentPath).length,
              path: currentPath,
            });
          };
        }

        // For nested objects, create nested proxies
        if (value && typeof value === 'object' && !isSignal(value)) {
          const nestedPath = currentPath
            ? `${currentPath}.${String(prop)}`
            : String(prop);
          return createProxy(value, nestedPath);
        }

        return value;
      },
    });

    proxyCache.set(obj, proxy);
    return proxy;
  };

  return createProxy(target, path);
}

/**
 * Enhances a SignalTree with intelligent batching capabilities for optimal performance.
 * Automatically groups rapid state updates into efficient batch cycles to eliminate UI thrashing.
 *
 * @template T - The state object type
 * @param config - Configuration options for batching behavior
 * @returns Function that enhances a SignalTree with batching capabilities
 */
export function withBatching<T>(
  config: BatchingConfig = {}
): (tree: SignalTree<T>) => BatchingSignalTree<T> {
  const {
    enabled = true,
    maxBatchSize = 100,
    autoFlushDelay = 16,
    batchTimeoutMs = 100,
  } = config;

  return (tree: SignalTree<T>): BatchingSignalTree<T> => {
    if (!enabled) {
      // When disabled, provide pass-through implementations
      return {
        ...tree,
        batchUpdate: (updater: (current: T) => Partial<T>) => {
          const current = unwrap(tree.$);
          const update = updater(current);
          applyPartialUpdate(tree.$, update);
        },
        flushBatch: () => {
          // No-op when batching is disabled
        },
        hasPendingBatch: () => false,
        getBatchSize: () => 0,
      };
    }

    // Per-instance batching state
    let queue: BatchedUpdate[] = [];
    let isProcessing = false;
    let flushTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let batchStartTime: number | null = null;

    const scheduleFlush = () => {
      if (flushTimeoutId !== undefined) {
        clearTimeout(flushTimeoutId);
      }

      // Use microtask for immediate flush when possible
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(() => flushUpdates());
      } else {
        Promise.resolve().then(() => flushUpdates());
      }

      // Fallback timeout to ensure flush happens
      flushTimeoutId = setTimeout(() => {
        flushTimeoutId = undefined;
        flushUpdates();
      }, autoFlushDelay);
    };

    const flushUpdates = () => {
      if (isProcessing || queue.length === 0) return;

      isProcessing = true;
      const currentQueue = queue;
      queue = [];
      batchStartTime = null;

      if (flushTimeoutId !== undefined) {
        clearTimeout(flushTimeoutId);
        flushTimeoutId = undefined;
      }

      // Sort by depth (deeper updates first) for optimal execution order
      currentQueue.sort((a, b) => b.depth - a.depth);

      // Remove duplicate updates for the same path (keep last)
      const uniqueUpdates = new Map<string, BatchedUpdate>();
      for (const update of currentQueue) {
        uniqueUpdates.set(update.path, update);
      }

      try {
        for (const update of uniqueUpdates.values()) {
          update.fn();
        }
      } finally {
        isProcessing = false;

        // Process any updates that were queued during flush
        if (queue.length > 0) {
          scheduleFlush();
        }
      }
    };

    const addToQueue = (update: BatchedUpdate) => {
      // Start batch timer
      if (batchStartTime === null) {
        batchStartTime = performance.now();
      }

      // Remove existing update for same path
      queue = queue.filter((u) => u.path !== update.path);
      queue.push(update);

      // Check if we need to flush immediately
      const shouldFlushImmediately =
        queue.length >= maxBatchSize ||
        (batchStartTime && performance.now() - batchStartTime > batchTimeoutMs);

      if (shouldFlushImmediately) {
        flushUpdates();
      } else {
        scheduleFlush();
      }
    };

    // Create the batching proxy for the state
    const batchingProxy = createBatchingProxy(tree.$, addToQueue);

    // Create the batch manager
    const manager: BatchingManager = {
      flush: flushUpdates,
      getSize: () => queue.length,
      hasPending: () => queue.length > 0,
      getQueue: () => [...queue],
    };

    // Register the manager for testing (cast to unknown first)
    batchingManagers.set(tree as SignalTree<unknown>, manager);

    // Create enhanced tree
    const enhancedTree: BatchingSignalTree<T> = {
      ...tree,
      $: batchingProxy,
      state: batchingProxy,
      batchUpdate: (updater: (current: T) => Partial<T>) => {
        const current = unwrap(tree.$);
        const update = updater(current);
        applyPartialUpdate(tree.$, update, addToQueue);
      },
      flushBatch: flushUpdates,
      hasPendingBatch: () => queue.length > 0,
      getBatchSize: () => queue.length,
    };

    return enhancedTree;
  };
}

/**
 * Convenience function to enable batching with default settings.
 */
export function enableBatching<T>() {
  return withBatching<T>({ enabled: true });
}

/**
 * Creates high-performance batching configuration optimized for demanding applications.
 */
export function withHighPerformanceBatching<T>() {
  return withBatching<T>({
    enabled: true,
    maxBatchSize: 200,
    autoFlushDelay: 0,
    batchTimeoutMs: 0,
  });
}

/**
 * Manually flushes all pending batched updates immediately across all trees.
 * Useful for testing scenarios or when immediate state consistency is required.
 */
export function flushBatchedUpdates(): void {
  // Flush all registered batching managers
  for (const manager of batchingManagers.values()) {
    manager.flush();
  }
}

/**
 * Returns whether any tree has pending batched updates
 */
export function hasPendingUpdates(): boolean {
  for (const manager of batchingManagers.values()) {
    if (manager.hasPending()) return true;
  }
  return false;
}

/**
 * Returns the total number of pending updates across all trees
 */
export function getBatchQueueSize(): number {
  let total = 0;
  for (const manager of batchingManagers.values()) {
    total += manager.getSize();
  }
  return total;
}

/**
 * Returns all pending batched updates across all trees (for testing)
 */
export function getPendingBatchedUpdates(): BatchedUpdate[] {
  const allUpdates: BatchedUpdate[] = [];
  for (const manager of batchingManagers.values()) {
    allUpdates.push(...manager.getQueue());
  }
  return allUpdates;
}
