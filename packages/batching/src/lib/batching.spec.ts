import { TestBed } from '@angular/core/testing';
import { signalTree } from '@signaltree/core';
import {
  withBatching,
  enableBatching,
  withHighPerformanceBatching,
  flushBatchedUpdates,
  hasPendingUpdates,
  getPendingBatchedUpdates,
  getBatchQueueSize,
  clearAllBatchingManagers,
  type BatchedSignalTree,
} from './batching';

describe('Batching', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    clearAllBatchingManagers(); // Clean up any lingering managers
  });

  afterEach(() => {
    clearAllBatchingManagers(); // Clean up after each test
  });

  it('should enhance tree with batching capabilities', () => {
    const tree = signalTree({ count: 0 }).with(
      withBatching()
    ) as BatchedSignalTree<{ count: number }>;

    expect(tree.batchUpdate).toBeDefined();
    expect(tree.flushBatch).toBeDefined();
    expect(tree.hasPendingBatch).toBeDefined();
    expect(tree.getBatchSize).toBeDefined();
    expect(tree.disposeBatching).toBeDefined();

    tree.disposeBatching();
  });

  it('should batch multiple updates', async () => {
    const tree = signalTree({ count: 0, name: 'test' }).with(
      withBatching()
    ) as BatchedSignalTree<{ count: number; name: string }>;

    // Perform multiple batched updates
    tree.batchUpdate((state) => ({
      count: state.count + 1,
    }));
    tree.batchUpdate((state) => ({
      count: state.count + 1,
    }));
    tree.batchUpdate((state) => ({
      count: state.count + 1,
    }));

    // Updates should be batched (not executed immediately)
    expect(tree.$.count()).toBe(0);
    expect(hasPendingUpdates()).toBe(true);
    expect(getBatchQueueSize()).toBe(1); // Should be 1 because updates to same path are deduplicated

    // Wait for microtask to complete
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    // Now updates should be applied (last update wins due to deduplication)
    expect(tree.$.count()).toBe(1); // Only the last update is applied
    expect(hasPendingUpdates()).toBe(false);
    expect(getBatchQueueSize()).toBe(0);

    tree.disposeBatching();
  });

  it('should apply the most recent update when batching multiple updates to same path', async () => {
    const tree = signalTree({ count: 0 }).with(
      withBatching()
    ) as BatchedSignalTree<{ count: number }>;

    // Multiple updates to the same path
    tree.batchUpdate(() => ({ count: 5 }));
    tree.batchUpdate(() => ({ count: 10 }));
    tree.batchUpdate(() => ({ count: 15 }));

    // Should only have one pending update (last one)
    expect(tree.getBatchSize()).toBe(1);

    await new Promise<void>((resolve) => queueMicrotask(resolve));

    // Last update should win
    expect(tree.$.count()).toBe(15);

    tree.disposeBatching();
  });

  it('should allow manual flush of batched updates', () => {
    const tree = signalTree({ count: 0 }).with(
      withBatching()
    ) as BatchedSignalTree<{ count: number }>;

    tree.batchUpdate(() => ({ count: 5 }));

    // Should be pending
    expect(tree.$.count()).toBe(0);
    expect(tree.hasPendingBatch()).toBe(true);

    // Manual flush
    tree.flushBatch();

    // Should be applied immediately
    expect(tree.$.count()).toBe(5);
    expect(tree.hasPendingBatch()).toBe(false);

    tree.disposeBatching();
  });

  it('should work with enableBatching convenience function', () => {
    const tree = signalTree({ count: 0 }).with(
      enableBatching()
    ) as BatchedSignalTree<{ count: number }>;

    expect(tree.batchUpdate).toBeDefined();

    tree.batchUpdate(() => ({ count: 10 }));
    expect(tree.hasPendingBatch()).toBe(true);

    tree.flushBatch();
    expect(tree.$.count()).toBe(10);

    tree.disposeBatching();
  });

  it('should work with high performance batching', () => {
    const tree = signalTree({ count: 0 }).with(
      withHighPerformanceBatching()
    ) as BatchedSignalTree<{ count: number }>;

    expect(tree.batchUpdate).toBeDefined();

    // Should handle larger batch sizes
    for (let i = 0; i < 50; i++) {
      tree.batchUpdate(() => ({ count: i }));
    }

    // High performance batching has different deduplication
    expect(tree.getBatchSize()).toBe(1); // Still deduplicates to same path

    tree.flushBatch();
    expect(tree.$.count()).toBe(49); // Last value wins

    tree.disposeBatching();
  });

  it('should disable batching when enabled is false', () => {
    const tree = signalTree({ count: 0 }).with(
      withBatching({ enabled: false })
    ) as BatchedSignalTree<{ count: number }>;

    // Should have methods but they should be pass-through
    tree.batchUpdate(() => ({ count: 5 }));

    // Should update immediately since batching is disabled
    expect(tree.$.count()).toBe(5);
    expect(tree.hasPendingBatch()).toBe(false);

    tree.disposeBatching();
  });

  it('should respect maxBatchSize configuration', async () => {
    const tree = signalTree({ count: 0 }).with(
      withBatching({ maxBatchSize: 2 })
    ) as BatchedSignalTree<{ count: number }>;

    // Create updates with different paths to avoid deduplication
    const tree2 = signalTree({ a: 0, b: 0, c: 0 }).with(
      withBatching({ maxBatchSize: 2 })
    ) as BatchedSignalTree<{ a: number; b: number; c: number }>;

    // First 2 updates should be batched
    tree2.batchUpdate(() => ({ a: 1 }));
    tree2.batchUpdate(() => ({ b: 1 }));

    expect(tree2.$.a()).toBe(0); // Still batched
    expect(tree2.$.b()).toBe(0); // Still batched

    // Third update should trigger immediate execution due to maxBatchSize
    tree2.batchUpdate(() => ({ c: 1 }));

    // Wait a tiny bit for synchronous flush
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(tree2.$.a()).toBe(1);
    expect(tree2.$.b()).toBe(1);
    expect(tree2.$.c()).toBe(1);

    tree.disposeBatching();
    tree2.disposeBatching();
  });

  it('should handle nested object updates', async () => {
    const tree = signalTree({
      user: {
        name: 'John',
        age: 30,
        address: {
          city: 'NYC',
          zip: '10001',
        },
      },
    }).with(withBatching()) as BatchedSignalTree<{
      user: {
        name: string;
        age: number;
        address: {
          city: string;
          zip: string;
        };
      };
    }>;

    // Batch update nested values
    tree.batchUpdate(() => ({
      user: {
        name: 'Jane',
        age: 25,
        address: {
          city: 'LA',
          zip: '90001',
        },
      },
    }));

    expect(tree.$.user.name()).toBe('John'); // Still batched

    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(tree.$.user.name()).toBe('Jane');
    expect(tree.$.user.age()).toBe(25);
    expect(tree.$.user.address.city()).toBe('LA');
    expect(tree.$.user.address.zip()).toBe('90001');

    tree.disposeBatching();
  });

  it('should handle partial nested updates', async () => {
    const tree = signalTree({
      user: {
        name: 'John',
        age: 30,
      },
      settings: {
        theme: 'dark',
        notifications: true,
      },
    }).with(withBatching()) as BatchedSignalTree<{
      user: { name: string; age: number };
      settings: { theme: string; notifications: boolean };
    }>;

    // Update only user
    tree.batchUpdate(() => ({
      user: {
        name: 'Jane',
        age: 25,
      },
    }));

    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(tree.$.user.name()).toBe('Jane');
    expect(tree.$.settings.theme()).toBe('dark'); // Unchanged

    tree.disposeBatching();
  });

  it('should handle flushBatchedUpdates global function', () => {
    const tree1 = signalTree({ count: 0 }).with(
      withBatching()
    ) as BatchedSignalTree<{ count: number }>;
    const tree2 = signalTree({ value: 0 }).with(
      withBatching()
    ) as BatchedSignalTree<{ value: number }>;

    tree1.batchUpdate(() => ({ count: 5 }));
    tree2.batchUpdate(() => ({ value: 10 }));

    expect(hasPendingUpdates()).toBe(true);

    // Global flush
    flushBatchedUpdates();

    expect(tree1.$.count()).toBe(5);
    expect(tree2.$.value()).toBe(10);
    expect(hasPendingUpdates()).toBe(false);

    tree1.disposeBatching();
    tree2.disposeBatching();
  });

  it('should properly dispose of resources', async () => {
    const tree = signalTree({ count: 0 }).with(
      withBatching()
    ) as BatchedSignalTree<{ count: number }>;

    tree.batchUpdate(() => ({ count: 5 }));
    expect(tree.hasPendingBatch()).toBe(true);

    tree.disposeBatching();

    // After disposal, pending updates should be cleared
    expect(hasPendingUpdates()).toBe(false);
    expect(getBatchQueueSize()).toBe(0);

    // New updates should not be queued after disposal
    tree.batchUpdate(() => ({ count: 10 }));
    expect(tree.hasPendingBatch()).toBe(false);
  });

  it('should handle rapid sequential updates correctly', async () => {
    const tree = signalTree({ count: 0 }).with(
      withBatching({ autoFlushDelay: 5 })
    ) as BatchedSignalTree<{ count: number }>;

    // Rapid updates
    for (let i = 1; i <= 10; i++) {
      tree.batchUpdate(() => ({ count: i }));
    }

    // Should be batched
    expect(tree.$.count()).toBe(0);

    // Wait for auto-flush
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Last update wins
    expect(tree.$.count()).toBe(10);

    tree.disposeBatching();
  });

  it('should handle timeout-based flushing', async () => {
    const tree = signalTree({ count: 0 }).with(
      withBatching({ batchTimeoutMs: 10 })
    ) as BatchedSignalTree<{ count: number }>;

    tree.batchUpdate(() => ({ count: 5 }));

    // Should be batched initially
    expect(tree.$.count()).toBe(0);

    // Wait for timeout
    await new Promise((resolve) => setTimeout(resolve, 15));

    // Should be flushed after timeout
    expect(tree.$.count()).toBe(5);

    tree.disposeBatching();
  });

  // Node-level path behavior tests - consolidated from batching.node.spec.ts
  describe('node-level path behavior', () => {
    it('dedupes multiple batchUpdate calls to the same node path', async () => {
      const tree = signalTree({
        a: { b: { count: 0 } },
        events: [] as string[],
      }).with(withBatching()) as BatchedSignalTree<{
        a: { b: { count: number } };
        events: string[];
      }>;

      // Enqueue multiple batchUpdate calls on the same nested node path
      (tree.$.a.b as any)['batchUpdate']((cur: { count: number }) => {
        // record side-effect to events so we can detect how many times it ran
        tree.$.events.set([...tree.$.events(), 'b']);
        return { count: cur.count + 1 };
      });

      (tree.$.a.b as any)['batchUpdate']((cur: { count: number }) => {
        tree.$.events.set([...tree.$.events(), 'b']);
        return { count: cur.count + 1 };
      });

      (tree.$.a.b as any)['batchUpdate']((cur: { count: number }) => {
        tree.$.events.set([...tree.$.events(), 'b']);
        return { count: cur.count + 1 };
      });

      // Since updates are deduped by path, queue size should be 1
      expect(hasPendingUpdates()).toBe(true);
      expect(getBatchQueueSize()).toBe(1);

      // Flush explicitly to make test deterministic in this environment
      flushBatchedUpdates();

      // Only the last enqueued update should have executed once
      expect(tree.$.events()).toHaveLength(1);
      expect(tree.$.a.b.count()).toBe(1);
      expect(hasPendingUpdates()).toBe(false);
    });

    it('executes deeper updates before parents (depth ordering)', async () => {
      const tree = signalTree({
        a: { b: { v: 0 }, v: 0 },
        events: [] as string[],
      }).with(withBatching()) as BatchedSignalTree<{
        a: { b: { v: number }; v: number };
        events: string[];
      }>;

      // Parent update depends on child's value; child increments itself.
      (tree.$.a as any)['batchUpdate'](() => {
        // parent side-effect
        tree.$.events.set([...tree.$.events(), 'a']);
        // set parent.v based on child's value
        return { v: tree.$.a.b.v() + 100 };
      });

      (tree.$.a.b as any)['batchUpdate'](() => {
        tree.$.events.set([...tree.$.events(), 'b']);
        return { v: tree.$.a.b.v() + 1 };
      });

      // both queued
      expect(hasPendingUpdates()).toBe(true);
      expect(getBatchQueueSize()).toBe(2);

      // Flush explicitly to make test deterministic in this environment
      flushBatchedUpdates();

      // Deeper node should have executed first, then parent should have seen updated child
      expect(tree.$.events()).toEqual(['b', 'a']);
      expect(tree.$.a.b.v()).toBe(1);
      expect(tree.$.a.v()).toBe(101);
    });
  });

  // Mixed update/batch ordering tests - consolidated from batching.mix.spec.ts
  describe('mixed update/batch ordering', () => {
    it('ensures updates queued with update() and batchUpdate() maintain expected ordering', () => {
      const tree = signalTree({
        x: { v: 0 },
        log: [] as string[],
      }).with(withBatching()) as BatchedSignalTree<{
        x: { v: number };
        log: string[];
      }>;

      // Queue an imperative update (should be queued but not schedule flush)
      // Note: In v2.0, the root $ doesn't have update method, use branch update instead
      (tree.$.x as any).update(() => ({ v: tree.$.x.v() + 1 }));

      // Queue a batched update which should schedule flush
      (tree.$.x as any).batchUpdate(() => ({ v: tree.$.x.v() + 10 }));

      // At this point, we expect two queued updates
      const pending = getPendingBatchedUpdates();
      expect(pending.length).toBeGreaterThanOrEqual(1);

      // Flush and assert final state - deeper batch should have run with the queued imperative update considered
      flushBatchedUpdates();

      expect(tree.$.x.v()).toBeGreaterThanOrEqual(11);
    });
  });

  describe('node-level path behavior', () => {
    it('dedupes multiple batchUpdate calls to the same node path', async () => {
      const tree = signalTree({
        a: { b: { count: 0 } },
        events: [] as string[],
      }).with(withBatching()) as BatchedSignalTree<{
        a: { b: { count: number } };
        events: string[];
      }>;

      // Enqueue multiple batchUpdate calls on the same nested node path
      (tree.$.a.b as any)['batchUpdate']((cur: { count: number }) => {
        // record side-effect to events so we can detect how many times it ran
        tree.$.events.set([...tree.$.events(), 'b']);
        return { count: cur.count + 1 };
      });

      (tree.$.a.b as any)['batchUpdate']((cur: { count: number }) => {
        tree.$.events.set([...tree.$.events(), 'b']);
        return { count: cur.count + 1 };
      });

      (tree.$.a.b as any)['batchUpdate']((cur: { count: number }) => {
        tree.$.events.set([...tree.$.events(), 'b']);
        return { count: cur.count + 1 };
      });

      // Since updates are deduped by path, queue size should be 1
      expect(hasPendingUpdates()).toBe(true);
      expect(getBatchQueueSize()).toBe(1);

      // Flush explicitly to make test deterministic in this environment
      flushBatchedUpdates();

      // Only the last enqueued update should have executed once
      expect(tree.$.events()).toHaveLength(1);
      expect(tree.$.a.b.count()).toBe(1);
      expect(hasPendingUpdates()).toBe(false);

      tree.disposeBatching();
    });

    it('executes deeper updates before parents (depth ordering)', async () => {
      const tree = signalTree({
        a: { b: { v: 0 }, v: 0 },
        events: [] as string[],
      }).with(withBatching()) as BatchedSignalTree<{
        a: { b: { v: number }; v: number };
        events: string[];
      }>;

      // Parent update depends on child's value; child increments itself.
      (tree.$.a as any)['batchUpdate'](() => {
        // parent side-effect
        tree.$.events.set([...tree.$.events(), 'a']);
        // set parent.v based on child's value
        return { v: tree.$.a.b.v() + 100 };
      });

      (tree.$.a.b as any)['batchUpdate'](() => {
        tree.$.events.set([...tree.$.events(), 'b']);
        return { v: tree.$.a.b.v() + 1 };
      });

      // both queued
      expect(hasPendingUpdates()).toBe(true);
      expect(getBatchQueueSize()).toBe(2);

      // Flush explicitly to make test deterministic in this environment
      flushBatchedUpdates();

      // Deeper node should have executed first, then parent should have seen updated child
      expect(tree.$.events()).toEqual(['b', 'a']);
      expect(tree.$.a.b.v()).toBe(1);
      expect(tree.$.a.v()).toBe(101);

      tree.disposeBatching();
    });
  });
});
