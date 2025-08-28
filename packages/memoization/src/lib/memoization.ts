import { computed, Signal, isSignal, WritableSignal } from '@angular/core';
import { unwrap } from '@signaltree/core';
import type { SignalTree } from '@signaltree/core';

/**
 * Extended SignalTree interface with memoization capabilities
 */
export interface MemoizedSignalTree<T> extends SignalTree<T> {
  memoizedUpdate?: (
    updater: (current: T) => Partial<T>,
    cacheKey?: string
  ) => void;
  memoizedComputed?: <TResult>(
    computation: () => TResult,
    deps?: unknown[]
  ) => Signal<TResult>;
  clearMemoCache?: (key?: string) => void;
  clearCache?: (key?: string) => void; // Alias for compatibility
  getCacheStats?: () => {
    size: number;
    hitRate: number;
    totalHits: number;
    totalMisses: number;
    keys: string[];
  };
  disposeMemoization?: () => void;
}

/**
 * Cache entry interface
 */
interface CacheEntry<T> {
  value: T;
  deps: readonly unknown[];
  timestamp: number;
  hitCount: number;
}

/**
 * Global memoization cache registry
 */
const memoizationCaches = new Map<
  SignalTree<unknown>,
  Map<string, CacheEntry<unknown>>
>();
let globalCleanupInterval: ReturnType<typeof setInterval> | undefined;

/**
 * Configuration options for memoization
 */
export interface MemoizationConfig {
  enabled?: boolean;
  maxCacheSize?: number;
  ttl?: number;
}

/**
 * Deep equality check for cache comparison
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

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
 * Apply partial updates to the signal tree using v2.0 architecture
 */
function applyPartialUpdate<T>(
  signals: any,
  update: Partial<T>,
  basePath = ''
): void {
  for (const [key, value] of Object.entries(update)) {
    const target = signals[key];

    if (!target) {
      console.warn(`Property ${key} does not exist on tree`);
      continue;
    }

    // Handle signals (leaf nodes)
    if (isSignal(target)) {
      (target as WritableSignal<unknown>).set(value);
    }
    // Handle branch nodes with set method
    else if (
      typeof target === 'object' &&
      'set' in target &&
      typeof target.set === 'function'
    ) {
      target.set(value);
    }
    // Handle nested objects recursively
    else if (
      typeof target === 'object' &&
      typeof value === 'object' &&
      value !== null
    ) {
      applyPartialUpdate(
        target,
        value as any,
        basePath ? `${basePath}.${key}` : key
      );
    }
  }
}

/**
 * Start global cleanup interval for TTL management
 */
function startGlobalCleanup(ttl: number): void {
  if (!globalCleanupInterval) {
    globalCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const cache of memoizationCaches.values()) {
        for (const [key, entry] of cache.entries()) {
          if (now - entry.timestamp > ttl) {
            cache.delete(key);
          }
        }
      }
    }, Math.min(ttl, 60000)); // Run at most once per minute
  }
}

/**
 * Enhances a SignalTree with memoization capabilities
 */
export function withMemoization<T extends Record<string, unknown>>(
  config: MemoizationConfig = {}
): (tree: SignalTree<T>) => MemoizedSignalTree<T> {
  const {
    enabled = true,
    maxCacheSize = 1000,
    ttl = 5 * 60 * 1000, // 5 minutes default
  } = config;

  return (tree: SignalTree<T>): MemoizedSignalTree<T> => {
    const enhanced = tree as MemoizedSignalTree<T>;

    if (!enabled) {
      // When disabled, don't add any methods
      return enhanced;
    }

    // Initialize cache for this tree
    const cache = new Map<string, CacheEntry<unknown>>();
    memoizationCaches.set(tree as SignalTree<unknown>, cache);

    // Start global cleanup if needed
    if (ttl && ttl > 0) {
      startGlobalCleanup(ttl);
    }

    // Cache statistics tracking
    let totalMisses = 0;

    // Enforce cache size limits
    const enforceCacheLimit = () => {
      if (cache.size > maxCacheSize) {
        // Remove oldest entries (LRU)
        const entries = Array.from(cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = entries.slice(0, cache.size - maxCacheSize + 1);
        toRemove.forEach(([key]) => cache.delete(key));
      }
    };

    // Add memoized update method
    enhanced.memoizedUpdate = (
      updater: (current: T) => Partial<T>,
      cacheKey?: string
    ) => {
      const key = cacheKey || `update_${Date.now()}_${Math.random()}`;
      const currentState = unwrap(tree.$);

      // Check cache
      const cached = cache.get(key);
      if (cached && deepEqual(cached.deps[0], currentState)) {
        cached.hitCount++;
        cached.timestamp = Date.now(); // Update timestamp for LRU
        // Apply cached result
        applyPartialUpdate(tree.$, cached.value as Partial<T>);
        return;
      }

      // Cache miss
      totalMisses++;

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
      applyPartialUpdate(tree.$, result);
      enforceCacheLimit();
    };

    // Add memoized computed
    enhanced.memoizedComputed = <TResult>(
      computation: () => TResult,
      deps: unknown[] = []
    ) => {
      return computed(() => {
        const currentState = unwrap(tree.$);
        const allDeps = [currentState, ...deps];
        const key = `computed_${JSON.stringify(allDeps)}`;

        const cached = cache.get(key);
        if (cached && deepEqual(cached.deps, allDeps)) {
          cached.hitCount++;
          cached.timestamp = Date.now(); // Update for LRU
          return cached.value as TResult;
        }

        totalMisses++;
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
    enhanced.clearMemoCache = (key?: string) => {
      if (key) {
        cache.delete(key);
      } else {
        cache.clear();
      }
    };

    // Alias for compatibility
    enhanced.clearCache = enhanced.clearMemoCache;

    enhanced.getCacheStats = () => {
      let totalHits = 0;

      for (const entry of cache.values()) {
        totalHits += Math.max(0, entry.hitCount - 1); // First access is not a hit
      }

      const totalAccesses = totalHits + totalMisses;
      const hitRate = totalAccesses > 0 ? totalHits / totalAccesses : 0;

      return {
        size: cache.size,
        hitRate,
        totalHits,
        totalMisses,
        keys: Array.from(cache.keys()),
      };
    };

    // Disposal method
    enhanced.disposeMemoization = () => {
      cache.clear();
      memoizationCaches.delete(tree as SignalTree<unknown>);

      // Stop global cleanup if no more caches
      if (memoizationCaches.size === 0 && globalCleanupInterval) {
        clearInterval(globalCleanupInterval);
        globalCleanupInterval = undefined;
      }
    };

    return enhanced;
  };
}

/**
 * Convenience functions
 */
export function enableMemoization<T extends Record<string, unknown>>() {
  return withMemoization<T>({ enabled: true });
}

export function withHighPerformanceMemoization<
  T extends Record<string, unknown>
>() {
  return withMemoization<T>({
    enabled: true,
    maxCacheSize: 10000,
    ttl: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Clear all memoization caches
 */
export function clearAllCaches(): void {
  for (const cache of memoizationCaches.values()) {
    cache.clear();
  }
}

/**
 * Get global cache statistics
 */
export function getGlobalCacheStats() {
  let totalSize = 0;
  let totalHits = 0;

  for (const cache of memoizationCaches.values()) {
    totalSize += cache.size;
    for (const entry of cache.values()) {
      totalHits += Math.max(0, entry.hitCount - 1);
    }
  }

  const treeCount = memoizationCaches.size;

  return {
    treeCount,
    totalSize,
    totalHits,
    averageCacheSize: treeCount > 0 ? totalSize / treeCount : 0,
  };
}

/**
 * Memoize a standalone function
 */
export function memoize<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  keyFn?: (...args: TArgs) => string
): (...args: TArgs) => TResult {
  const cache = new Map<string, TResult>();

  return (...args: TArgs): TResult => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Cleanup all memoization resources
 */
export function cleanupMemoization(): void {
  clearAllCaches();
  if (globalCleanupInterval) {
    clearInterval(globalCleanupInterval);
    globalCleanupInterval = undefined;
  }
  memoizationCaches.clear();
}
