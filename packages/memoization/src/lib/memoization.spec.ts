import { TestBed } from '@angular/core/testing';
import { signalTree } from '@signaltree/core';
import {
  withMemoization,
  enableMemoization,
  withHighPerformanceMemoization,
  clearAllCaches,
  getGlobalCacheStats,
  memoize,
  cleanupMemoization,
  type MemoizedSignalTree,
} from './memoization';

describe('Memoization', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    clearAllCaches();
  });

  afterEach(() => {
    cleanupMemoization();
  });

  it('should enhance tree with memoization capabilities', () => {
    const tree = signalTree({ count: 0 }).with(
      withMemoization()
    ) as MemoizedSignalTree<{ count: number }>;

    expect(tree.memoizedUpdate).toBeDefined();
    expect(tree.clearMemoCache).toBeDefined();
    expect(tree.getCacheStats).toBeDefined();
    expect(tree.disposeMemoization).toBeDefined();

    tree.disposeMemoization?.();
  });

  it('should cache memoized updates', () => {
    const tree = signalTree({ count: 0, computed: 0 }).with(
      withMemoization()
    ) as MemoizedSignalTree<{ count: number; computed: number }>;

    // Track expensive computation calls
    let computationCalls = 0;
    const expensiveComputation = (count: number) => {
      computationCalls++;
      return count * 2;
    };

    // First memoized update with specific cache key
    tree.memoizedUpdate?.(
      (state) => ({
        computed: expensiveComputation(state.count),
      }),
      'computation1'
    );

    expect(tree.$.computed()).toBe(0);
    expect(computationCalls).toBe(1);

    // Same memoized update with same key and state should use cache
    tree.memoizedUpdate?.(
      (state) => ({
        computed: expensiveComputation(state.count),
      }),
      'computation1'
    );

    expect(tree.$.computed()).toBe(0);
    expect(computationCalls).toBe(1); // Should not increase

    // Different cache key should trigger new computation
    tree.memoizedUpdate?.(
      (state) => ({
        computed: expensiveComputation(state.count),
      }),
      'computation2'
    );

    expect(computationCalls).toBe(2);

    tree.disposeMemoization?.();
  });

  it('should provide cache statistics', () => {
    const tree = signalTree({ count: 0 }).with(
      withMemoization()
    ) as MemoizedSignalTree<{ count: number }>;

    tree.memoizedUpdate?.(() => ({ count: 1 }), 'update1');
    tree.memoizedUpdate?.(() => ({ count: 2 }), 'update2');

    const stats = tree.getCacheStats?.();
    expect(stats?.size).toBe(2);
    expect(stats?.keys).toContain('update1');
    expect(stats?.keys).toContain('update2');

    // First access is not a hit, so with 2 entries and 1 access each, totalHits should be 0
    expect(stats?.totalHits).toBe(0);

    // Access again to generate hits
    tree.memoizedUpdate?.(() => ({ count: 1 }), 'update1');
    const stats2 = tree.getCacheStats?.();
    expect(stats2?.totalHits).toBe(1);

    tree.disposeMemoization?.();
  });

  it('should clear cache correctly', () => {
    const tree = signalTree({ count: 0 }).with(
      withMemoization()
    ) as MemoizedSignalTree<{ count: number }>;

    tree.memoizedUpdate?.(() => ({ count: 1 }), 'update1');
    tree.memoizedUpdate?.(() => ({ count: 2 }), 'update2');

    expect(tree.getCacheStats?.()?.size).toBe(2);

    // Clear specific key
    tree.clearMemoCache?.('update1');
    expect(tree.getCacheStats?.()?.size).toBe(1);
    expect(tree.getCacheStats?.()?.keys).not.toContain('update1');

    // Clear all
    tree.clearMemoCache?.();
    expect(tree.getCacheStats?.()?.size).toBe(0);

    tree.disposeMemoization?.();
  });

  it('should work with enableMemoization convenience function', () => {
    const tree = signalTree({ count: 0 }).with(
      enableMemoization()
    ) as MemoizedSignalTree<{ count: number }>;

    expect(tree.memoizedUpdate).toBeDefined();
    expect(tree.clearCache).toBeDefined(); // Alias should exist
    expect(tree.getCacheStats).toBeDefined();

    tree.memoizedUpdate?.(() => ({ count: 10 }), 'test');
    expect(tree.$.count()).toBe(10);

    tree.disposeMemoization?.();
  });

  it('should work with high performance memoization', () => {
    const tree = signalTree({ count: 0 }).with(
      withHighPerformanceMemoization()
    ) as MemoizedSignalTree<{ count: number }>;

    expect(tree.memoizedUpdate).toBeDefined();

    // Should handle large number of cached entries
    for (let i = 0; i < 100; i++) {
      tree.memoizedUpdate?.(() => ({ count: i }), `update${i}`);
    }

    const stats = tree.getCacheStats?.();
    expect(stats?.size).toBe(100);

    tree.disposeMemoization?.();
  });

  it('should not add methods when disabled', () => {
    const tree = signalTree({ count: 0 }).with(
      withMemoization({ enabled: false })
    ) as MemoizedSignalTree<{ count: number }>;

    // Should not have memoization methods when disabled
    expect(tree.memoizedUpdate).toBeUndefined();
    expect(tree.clearMemoCache).toBeUndefined();
    expect(tree.getCacheStats).toBeUndefined();
  });

  it('should enforce cache size limits', () => {
    const tree = signalTree({ count: 0 }).with(
      withMemoization({ maxCacheSize: 3 })
    ) as MemoizedSignalTree<{ count: number }>;

    // Add more entries than the limit
    tree.memoizedUpdate?.(() => ({ count: 1 }), 'update1');
    tree.memoizedUpdate?.(() => ({ count: 2 }), 'update2');
    tree.memoizedUpdate?.(() => ({ count: 3 }), 'update3');
    tree.memoizedUpdate?.(() => ({ count: 4 }), 'update4');

    // Cache should be limited to maxCacheSize
    const stats = tree.getCacheStats?.();
    expect(stats?.size).toBeLessThanOrEqual(3);

    tree.disposeMemoization?.();
  });

  it('should handle nested state updates', () => {
    const tree = signalTree({
      user: {
        name: 'John',
        age: 30,
      },
      settings: {
        theme: 'dark',
      },
    }).with(withMemoization()) as MemoizedSignalTree<{
      user: { name: string; age: number };
      settings: { theme: string };
    }>;

    tree.memoizedUpdate?.(
      () => ({
        user: { name: 'Jane', age: 25 },
      }),
      'updateUser'
    );

    expect(tree.$.user.name()).toBe('Jane');
    expect(tree.$.user.age()).toBe(25);
    expect(tree.$.settings.theme()).toBe('dark'); // Unchanged

    // Same update should use cache
    let updateCalls = 0;
    tree.memoizedUpdate?.(() => {
      updateCalls++;
      return { user: { name: 'Jane', age: 25 } };
    }, 'updateUser');

    expect(updateCalls).toBe(0); // Should use cache, not call updater

    tree.disposeMemoization?.();
  });

  describe('memoize function', () => {
    it('should memoize function calls', () => {
      let callCount = 0;
      const expensiveFunction = (x: number, y: number) => {
        callCount++;
        return x + y;
      };

      const memoized = memoize(expensiveFunction);

      // First call
      expect(memoized(1, 2)).toBe(3);
      expect(callCount).toBe(1);

      // Same arguments should use cache
      expect(memoized(1, 2)).toBe(3);
      expect(callCount).toBe(1);

      // Different arguments should trigger new call
      expect(memoized(2, 3)).toBe(5);
      expect(callCount).toBe(2);
    });

    it('should work with custom key function', () => {
      let callCount = 0;
      const fn = (obj: { id: number; name: string }) => {
        callCount++;
        return `${obj.id}-${obj.name}`;
      };

      const memoized = memoize(fn, (obj) => obj.id.toString());

      const obj1 = { id: 1, name: 'John' };
      const obj2 = { id: 1, name: 'Jane' }; // Same ID, different name

      expect(memoized(obj1)).toBe('1-John');
      expect(callCount).toBe(1);

      // Should use cache because same ID
      expect(memoized(obj2)).toBe('1-John');
      expect(callCount).toBe(1);
    });
  });

  describe('Global cache management', () => {
    it('should provide global cache statistics', () => {
      const tree1 = signalTree({ count: 0 }).with(
        withMemoization()
      ) as MemoizedSignalTree<{ count: number }>;
      const tree2 = signalTree({ value: 'test' }).with(
        withMemoization()
      ) as MemoizedSignalTree<{ value: string }>;

      tree1.memoizedUpdate?.(() => ({ count: 1 }), 'update1');
      tree2.memoizedUpdate?.(() => ({ value: 'updated' }), 'update2');

      const globalStats = getGlobalCacheStats();
      expect(globalStats.treeCount).toBe(2);
      expect(globalStats.totalSize).toBe(2);
      expect(globalStats.averageCacheSize).toBe(1);

      tree1.disposeMemoization?.();
      tree2.disposeMemoization?.();
    });

    it('should clear all caches', () => {
      const tree1 = signalTree({ count: 0 }).with(
        withMemoization()
      ) as MemoizedSignalTree<{ count: number }>;
      const tree2 = signalTree({ value: 'test' }).with(
        withMemoization()
      ) as MemoizedSignalTree<{ value: string }>;

      tree1.memoizedUpdate?.(() => ({ count: 1 }), 'update1');
      tree2.memoizedUpdate?.(() => ({ value: 'updated' }), 'update2');

      expect(getGlobalCacheStats().totalSize).toBe(2);

      clearAllCaches();

      expect(getGlobalCacheStats().totalSize).toBe(0);
      expect(tree1.getCacheStats?.()?.size).toBe(0);
      expect(tree2.getCacheStats?.()?.size).toBe(0);

      tree1.disposeMemoization?.();
      tree2.disposeMemoization?.();
    });
  });

  describe('TTL (Time To Live)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should expire cache entries after TTL', () => {
      const tree = signalTree({ count: 0 }).with(
        withMemoization({ ttl: 1000 }) // 1 second TTL
      ) as MemoizedSignalTree<{ count: number }>;

      tree.memoizedUpdate?.(() => ({ count: 1 }), 'update1');
      expect(tree.getCacheStats?.()?.size).toBe(1);

      // Fast forward past TTL
      jest.advanceTimersByTime(1001);
      jest.runOnlyPendingTimers();

      // Cache should be cleaned up after TTL expiration
      expect(tree.getCacheStats?.()?.size).toBe(0);

      tree.disposeMemoization?.();
    });

    it('should update timestamp on cache hit for LRU', () => {
      const tree = signalTree({ count: 0 }).with(
        withMemoization({ ttl: 1000, maxCacheSize: 2 })
      ) as MemoizedSignalTree<{ count: number }>;

      // Add two entries
      tree.memoizedUpdate?.(() => ({ count: 1 }), 'update1');

      jest.advanceTimersByTime(100);

      tree.memoizedUpdate?.(() => ({ count: 2 }), 'update2');

      // Access the first entry again (cache hit)
      tree.memoizedUpdate?.(() => ({ count: 1 }), 'update1');

      // Add a third entry (should evict the oldest, which is now update2)
      tree.memoizedUpdate?.(() => ({ count: 3 }), 'update3');

      const stats = tree.getCacheStats?.();
      expect(stats?.size).toBe(2);
      expect(stats?.keys).toContain('update1'); // Should still be there (recently accessed)
      expect(stats?.keys).toContain('update3'); // New entry
      expect(stats?.keys).not.toContain('update2'); // Should be evicted (oldest)

      tree.disposeMemoization?.();
    });
  });

  describe('memoizedComputed', () => {
    it('should create memoized computed signals', () => {
      const tree = signalTree({
        count: 0,
        multiplier: 2,
      }).with(withMemoization()) as MemoizedSignalTree<{
        count: number;
        multiplier: number;
      }>;

      let computations = 0;
      const computed = tree.memoizedComputed?.(() => {
        computations++;
        return tree.$.count() * tree.$.multiplier();
      });

      // First access
      expect(computed?.()).toBe(0);
      expect(computations).toBe(1);

      // Second access with same state should use cache
      expect(computed?.()).toBe(0);
      expect(computations).toBe(1);

      // Change state
      tree.$.count.set(5);

      // Should recompute with new state
      expect(computed?.()).toBe(10);
      expect(computations).toBe(2);

      tree.disposeMemoization?.();
    });

    it('should respect additional dependencies', () => {
      const tree = signalTree({ count: 0 }).with(
        withMemoization()
      ) as MemoizedSignalTree<{ count: number }>;

      let externalDep = 10;
      let computations = 0;

      const computed = tree.memoizedComputed?.(() => {
        computations++;
        return tree.$.count() + externalDep;
      }, [externalDep]);

      expect(computed?.()).toBe(10);
      expect(computations).toBe(1);

      // Change external dep
      externalDep = 20;
      const computed2 = tree.memoizedComputed?.(() => {
        computations++;
        return tree.$.count() + externalDep;
      }, [externalDep]);

      expect(computed2?.()).toBe(20);
      expect(computations).toBe(2);

      tree.disposeMemoization?.();
    });
  });

  describe('disposal', () => {
    it('should clean up resources on disposal', () => {
      const tree = signalTree({ count: 0 }).with(
        withMemoization()
      ) as MemoizedSignalTree<{ count: number }>;

      tree.memoizedUpdate?.(() => ({ count: 1 }), 'update1');
      expect(tree.getCacheStats?.()?.size).toBe(1);
      expect(getGlobalCacheStats().treeCount).toBe(1);

      tree.disposeMemoization?.();

      expect(tree.getCacheStats?.()?.size).toBe(0);
      expect(getGlobalCacheStats().treeCount).toBe(0);
    });
  });
});
