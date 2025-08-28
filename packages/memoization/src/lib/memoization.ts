import { computed, Signal, isSignal } from '@angular/core';
import { unwrap } from '@signaltree/core';
import type { DeepSignalify, SignalTree } from '@signaltree/core';

/**
 * Extended SignalTree interface with memoization capabilities
 */
interface MemoizedSignalTree<T> extends SignalTree<T> {
  memoizedUpdate: (
    updater: (current: T) => Partial<T>,
    cacheKey?: string
  ) => void;
  memoizedComputed: <TResult>(
    computation: () => TResult,
    deps?: unknown[]
  ) => Signal<TResult>;
  clearMemoCache: (key?: string) => void;
  getCacheStats: () => {
    size: number;
    hitRate: number;
    totalHits: number;
    totalMisses: number;
    keys: string[];
  };
}

// Cache entry interface
interface CacheEntry<T> {
  value: T;
  deps: readonly unknown[];
  timestamp: number;
  hitCount: number;
}

// Global memoization cache
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const memoizationCache = new Map<object, Map<string, CacheEntry<unknown>>>();

// Cleanup interval
const cacheCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [, cache] of memoizationCache.entries()) {
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > DEFAULT_TTL) {
        cache.delete(key);
      }
    }
  }
}, 60000);

/**
 * Cleanup the cache interval on app shutdown
 */
export function cleanupMemoizationCache(): void {
  clearInterval(cacheCleanupInterval);
  memoizationCache.clear();
}

/**
 * Configuration options
 */
interface MemoizationConfig {
  enabled?: boolean;
  maxCacheSize?: number;
  ttl?: number;
}

/**
 * Deep equality check
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (
        !deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
      ) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * Enhances a SignalTree with memoization capabilities
 * Properly handles v2.0 architecture with recursive proxying
 */
export function withMemoization<T>(
  config: MemoizationConfig = {}
): (tree: SignalTree<T>) => MemoizedSignalTree<T> {
  const { enabled = true, maxCacheSize = 1000, ttl } = config;

  return (tree: SignalTree<T>): MemoizedSignalTree<T> => {
    if (!enabled) {
      // When disabled, add no-op methods
      const enhanced = tree as MemoizedSignalTree<T>;
      enhanced.memoizedUpdate = (updater) => {
        // Just apply the update directly through root branch
        applyRootUpdate(tree, updater);
      };
      enhanced.memoizedComputed = (computation) => computed(computation);
      enhanced.clearMemoCache = () => {
        // No-op when disabled
      };
      enhanced.getCacheStats = () => ({
        size: 0,
        hitRate: 0,
        totalHits: 0,
        totalMisses: 0,
        keys: [],
      });
      return enhanced;
    }

    // Initialize cache for this tree
    const cache = new Map<string, CacheEntry<unknown>>();
    memoizationCache.set(tree as object, cache);

    // Enforce cache size limits
    const enforceCacheLimit = () => {
      if (cache.size > maxCacheSize) {
        const entries = Array.from(cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = entries.slice(0, cache.size - maxCacheSize + 1);
        toRemove.forEach(([key]) => cache.delete(key));
      }
    };

    // Keep track of whether we're in a cached operation
    let applyingCached = false;

    /**
     * Create memoization proxy that recursively wraps nested objects
     * This properly intercepts set/update methods at all levels
     */
    function createMemoizationProxy(target: any, path = ''): any {
      // Don't proxy signals
      if (isSignal(target)) {
        return target;
      }

      // Don't proxy non-objects
      if (!target || typeof target !== 'object') {
        return target;
      }

      return new Proxy(target, {
        get(obj, prop) {
          const value = obj[prop];

          // Intercept 'set' method on branch nodes
          if (prop === 'set' && typeof value === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return function (partial: any) {
              if (applyingCached) {
                // If we're applying a cached result, just call original
                return value.call(obj, partial);
              }

              // For memoization, we cache based on the input
              const cacheKey = `set_${path}_${JSON.stringify(partial)}`;

              // Check if we've seen this exact update before
              const cached = cache.get(cacheKey);
              if (cached) {
                cached.hitCount++;
                // Apply the cached update
                applyingCached = true;
                try {
                  return value.call(obj, cached.value);
                } finally {
                  applyingCached = false;
                }
              }

              // Not cached, apply and store
              cache.set(cacheKey, {
                value: partial,
                deps: [partial],
                timestamp: Date.now(),
                hitCount: 1,
              });

              enforceCacheLimit();
              return value.call(obj, partial);
            };
          }

          // Intercept 'update' method on branch nodes
          if (prop === 'update' && typeof value === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return function (updater: any) {
              if (applyingCached) {
                // If we're applying a cached result, just call original
                return value.call(obj, updater);
              }

              // Get current state for this branch
              const currentBranchState = unwrapBranch(obj);
              const cacheKey = `update_${path}_${JSON.stringify(
                currentBranchState
              )}`;

              // Check cache
              const cached = cache.get(cacheKey);
              if (cached && deepEqual(cached.deps, [currentBranchState])) {
                cached.hitCount++;
                // Apply cached result
                applyingCached = true;
                try {
                  return value.call(obj, () => cached.value);
                } finally {
                  applyingCached = false;
                }
              }

              // Compute and cache
              const result = updater(currentBranchState);
              cache.set(cacheKey, {
                value: result,
                deps: [currentBranchState],
                timestamp: Date.now(),
                hitCount: 1,
              });

              enforceCacheLimit();
              return value.call(obj, updater);
            };
          }

          // Recursively proxy nested objects (but not signals)
          if (value && typeof value === 'object' && !isSignal(value)) {
            const nestedPath = path ? `${path}.${String(prop)}` : String(prop);
            return createMemoizationProxy(value, nestedPath);
          }

          return value;
        },
      });
    }

    // Helper to unwrap a branch (not the whole tree)
    function unwrapBranch(branch: any): any {
      const result: any = {};
      for (const key in branch) {
        if (key === 'set' || key === 'update') continue;
        if (!Object.prototype.hasOwnProperty.call(branch, key)) continue;

        const value = branch[key];
        if (isSignal(value)) {
          result[key] = (value as Signal<unknown>)();
        } else if (value && typeof value === 'object') {
          result[key] = unwrapBranch(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    }

    // Apply proxy to the tree's state
    const originalState = tree.$;
    tree.$ = createMemoizationProxy(originalState) as DeepSignalify<T>;
    tree.state = tree.$;

    // Add memoized update method
    (tree as MemoizedSignalTree<T>).memoizedUpdate = (
      updater: (current: T) => Partial<T>,
      cacheKey?: string
    ) => {
      const key = cacheKey || `manual_${Date.now()}`;
      const currentState = unwrap(tree.$);

      // Check cache
      const cached = cache.get(key);
      if (cached && deepEqual(cached.deps, [currentState])) {
        cached.hitCount++;
        // Apply cached result
        applyRootUpdate(tree, () => cached.value as Partial<T>);
        return;
      }

      // Compute new result
      const result = updater(currentState);

      // Cache the result
      cache.set(key, {
        value: result,
        deps: [currentState],
        timestamp: Date.now(),
        hitCount: 1,
      });

      // Apply update
      applyRootUpdate(tree, () => result);
      enforceCacheLimit();
    };

    // Add memoized computed
    (tree as MemoizedSignalTree<T>).memoizedComputed = <TResult>(
      computation: () => TResult,
      deps?: unknown[]
    ) => {
      return computed(() => {
        const currentState = unwrap(tree.$);
        const allDeps = deps ? [currentState, ...deps] : [currentState];
        const key = `computed_${JSON.stringify(allDeps)}`;

        const cached = cache.get(key);
        if (cached && deepEqual(cached.deps, allDeps)) {
          cached.hitCount++;
          return cached.value as TResult;
        }

        const result = computation();
        cache.set(key, {
          value: result,
          deps: allDeps,
          timestamp: Date.now(),
          hitCount: 1,
        });

        enforceCacheLimit();
        return result;
      });
    };

    // Add cache management methods
    (tree as MemoizedSignalTree<T>).clearMemoCache = (key?: string) => {
      if (key) {
        cache.delete(key);
      } else {
        cache.clear();
      }
    };

    (tree as MemoizedSignalTree<T>).getCacheStats = () => {
      let totalHits = 0;
      let totalMisses = 0;

      for (const entry of cache.values()) {
        totalHits += entry.hitCount || 0;
        totalMisses += Math.floor((entry.hitCount || 0) / 2);
      }

      const hitRate =
        totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;

      return {
        size: cache.size,
        hitRate,
        totalHits,
        totalMisses,
        keys: Array.from(cache.keys()),
      };
    };

    // Setup TTL cleanup if configured
    if (ttl) {
      const cleanup = () => {
        const now = Date.now();
        for (const [key, entry] of cache.entries()) {
          if (now - entry.timestamp > ttl) {
            cache.delete(key);
          }
        }
      };

      const intervalId = setInterval(cleanup, ttl);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tree as any)._memoCleanupInterval = intervalId;
    }

    return tree as MemoizedSignalTree<T>;
  };
}

/**
 * Helper to apply update at root level
 * In v2.0, we need to handle the fact that root may or may not have update/set
 */
function applyRootUpdate<T>(
  tree: SignalTree<T>,
  updater: (current: T) => Partial<T>
): void {
  const root = tree.$ as any;

  // Check if root has update method (it should if it's a branch)
  if ('update' in root && typeof root.update === 'function') {
    root.update(updater);
  }
  // Fallback: try set with the full update
  else if ('set' in root && typeof root.set === 'function') {
    const current = unwrap(tree.$);
    const update = updater(current);
    root.set(update);
  }
  // Last resort: manually update properties
  else {
    const current = unwrap(tree.$);
    const updates = updater(current);
    for (const [key, value] of Object.entries(updates)) {
      if (key in root) {
        const prop = root[key];
        if (isSignal(prop)) {
          (prop as any).set(value);
        } else if (prop && typeof prop === 'object' && 'set' in prop) {
          prop.set(value);
        }
      }
    }
  }
}

/**
 * Convenience functions
 */
export function enableMemoization<T>() {
  return withMemoization<T>({ enabled: true });
}

export function withHighPerformanceMemoization<T>() {
  return withMemoization<T>({
    enabled: true,
    maxCacheSize: 10000,
    ttl: 300000,
  });
}

export function clearAllCaches(): void {
  memoizationCache.forEach((cache) => cache.clear());
}

export function getGlobalCacheStats() {
  let totalSize = 0;
  let totalHits = 0;
  let treeCount = 0;

  memoizationCache.forEach((cache) => {
    treeCount++;
    totalSize += cache.size;
    for (const entry of cache.values()) {
      totalHits += entry.hitCount || 0;
    }
  });

  return {
    treeCount,
    totalSize,
    totalHits,
    averageCacheSize: treeCount > 0 ? totalSize / treeCount : 0,
  };
}
