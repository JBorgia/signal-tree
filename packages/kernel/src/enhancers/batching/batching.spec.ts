import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { signalTree } from '../../lib/signal-tree';
import { interceptLocationWrites } from '../../lib/internals/location-runtime';
import { batching, batchingWithConfig } from './batching';

const createMockTree = () => signalTree({ count: 0, name: '' });

describe('batching enhancer', () => {
  // ==========================================
  // BASIC EXPORTS AND SETUP
  // ==========================================

  describe('exports', () => {
    it('exports factory functions and helpers', () => {
      expect(typeof batching).toBe('function');
      expect(typeof batchingWithConfig).toBe('function');
      expect(typeof batching()).toBe('function');
    });
  });

  // ==========================================
  // CORE PRINCIPLE: SYNCHRONOUS SIGNAL WRITES
  // ==========================================

  describe('synchronous signal writes', () => {
    it('should update signal value immediately via set()', () => {
      const tree = createMockTree();
      const enhanced = batching()(tree);

      enhanced.$.count(5);

      // Value should be updated immediately - no waiting
      expect(tree.$()).toEqual({ count: 5, name: '' });
    });

    it('should update signal value immediately via update()', () => {
      const tree = createMockTree();
      const enhanced = batching()(tree);

      enhanced.$.count((c: number) => c + 10);

      // Value should be updated immediately - no waiting
      expect(tree.$()).toEqual({ count: 10, name: '' });
    });

    it('should support read-after-write pattern', () => {
      const tree = createMockTree();
      const enhanced = batching()(tree);

      // Write then immediately read - this is the critical pattern
      enhanced.$.count(42);
      const value = tree.$().count;

      expect(value).toBe(42); // Immediate, no waiting!
    });

    it('should work with nested object updates', () => {
      const tree = signalTree({
        user: { name: 'Alice', settings: { theme: 'light' } },
      });

      const enhanced = batching()(tree);

      enhanced.$.user.settings.theme('dark');

      expect(tree.$().user.settings.theme).toBe('dark');
    });
  });

  // ==========================================
  // BATCH() - GROUP CD NOTIFICATIONS
  // ==========================================

  describe('batch()', () => {
    it('should execute updates immediately inside batch', () => {
      const tree = createMockTree();
      const enhanced = batching()(tree) as any;

      enhanced.batch(() => {
        enhanced.$.count(1);
        expect(tree.$().count).toBe(1); // Immediate!

        enhanced.$.name('test');
        expect(tree.$().name).toBe('test'); // Immediate!
      });

      expect(tree.$()).toEqual({ count: 1, name: 'test' });
    });

    it('should handle nested batches', () => {
      const tree = createMockTree();
      const enhanced = batching()(tree) as any;

      enhanced.batch(() => {
        enhanced.$.count(1);

        enhanced.batch(() => {
          enhanced.$.name('nested');
          expect(tree.$().name).toBe('nested'); // Immediate even in nested batch
        });

        expect(tree.$().count).toBe(1);
        expect(tree.$().name).toBe('nested');
      });
    });

    it('should handle errors without breaking state', () => {
      const tree = createMockTree();
      const enhanced = batching()(tree) as any;

      expect(() => {
        enhanced.batch(() => {
          enhanced.$.count(5);
          throw new Error('test error');
        });
      }).toThrow('test error');

      // State should still be updated
      expect(tree.$().count).toBe(5);
    });
  });

  // ==========================================
  // COALESCE() - DEDUPLICATE SAME-PATH UPDATES
  // ==========================================

  describe('coalesce()', () => {
    it('should only write final value for same path', () => {
      const tree = createMockTree();
      let writeCount = 0;

      // Track writes
      const release = interceptLocationWrites(tree.$.count, (_operation, proceed) => {
        writeCount++;
        proceed();
      });
      tree.registerCleanup(release);

      const enhanced = batching()(tree) as any;

      enhanced.coalesce(() => {
        enhanced.$.count(1);
        enhanced.$.count(2);
        enhanced.$.count(3);
        enhanced.$.count(4);
        enhanced.$.count(5);
      });

      expect(tree.$().count).toBe(5);
      expect(writeCount).toBe(1); // Only one actual write!
    });

    it('should handle multiple paths independently', () => {
      const tree = createMockTree();
      const enhanced = batching()(tree) as any;

      enhanced.coalesce(() => {
        enhanced.$.count(1);
        enhanced.$.name('a');
        enhanced.$.count(2);
        enhanced.$.name('b');
        enhanced.$.count(3);
        enhanced.$.name('c');
      });

      expect(tree.$().count).toBe(3);
      expect(tree.$().name).toBe('c');
    });
  });

  // ==========================================
  // DISABLED BATCHING
  // ==========================================

  describe('disabled batching', () => {
    it('should work normally when disabled', () => {
      const tree = createMockTree();
      const enhanced = batching({ enabled: false })(tree) as any;

      enhanced.$.count(5);
      expect(tree.$().count).toBe(5);

      // batch() should still work (passthrough)
      enhanced.batch(() => {
        enhanced.$.count(10);
      });
      expect(tree.$().count).toBe(10);
    });

    it('should provide passthrough methods when disabled', () => {
      const tree = createMockTree();
      const enhanced = batching({ enabled: false })(tree) as any;

      expect(typeof enhanced.batch).toBe('function');
      expect(typeof enhanced.coalesce).toBe('function');
      expect(typeof enhanced.hasPendingNotifications).toBe('function');
      expect(typeof enhanced.flushNotifications).toBe('function');
    });
  });

  // ==========================================
  // NOTIFICATION DELAY
  // ==========================================

  describe('notificationDelayMs', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('should delay CD notification by specified ms', async () => {
      const tree = createMockTree();
      const enhanced = batching({ notificationDelayMs: 100 })(tree) as any;

      let notified = false;
      (tree as any).__notifyChangeDetection = () => {
        notified = true;
      };

      enhanced.$.count(5);

      // Value is immediate
      expect(tree.$().count).toBe(5);

      // Notification is delayed
      expect(notified).toBe(false);

      vi.advanceTimersByTime(50);
      expect(notified).toBe(false);

      vi.advanceTimersByTime(50);
      expect(notified).toBe(true);
    });

    it('should ignore deprecated config options and use defaults', async () => {
      const tree = createMockTree();
      // Passing unknown/deprecated options should be ignored, not cause errors
      const enhanced = batching({} as any)(tree) as any;

      let notified = false;
      (tree as any).__notifyChangeDetection = () => {
        notified = true;
      };

      enhanced.$.count(5);
      expect(tree.$().count).toBe(5);

      // With default (notificationDelayMs: 0), notification should happen on microtask
      await Promise.resolve();
      expect(notified).toBe(true);
    });
  });

  // ==========================================
  // PENDING NOTIFICATION TRACKING
  // ==========================================

  describe('notification tracking', () => {
    it('should track pending notifications via hasPendingNotifications()', async () => {
      const tree = createMockTree();
      const enhanced = batching({ notificationDelayMs: 100 })(tree) as any;

      expect(enhanced.hasPendingNotifications()).toBe(false);

      enhanced.$.count(5);

      expect(enhanced.hasPendingNotifications()).toBe(true);
    });

    it('should flush notifications manually via flushNotifications()', () => {
      const tree = createMockTree();
      const enhanced = batching({ notificationDelayMs: 100 })(tree) as any;

      let notified = false;
      (tree as any).__notifyChangeDetection = () => {
        notified = true;
      };

      enhanced.$.count(5);
      expect(notified).toBe(false);

      enhanced.flushNotifications();
      expect(notified).toBe(true);
    });
  });

  // ==========================================
  // BACKWARDS COMPATIBILITY
  // ==========================================

  describe('backwards compatibility', () => {
    // `batchUpdate` was REMOVED in 14.1.1. It was a duplicate of the tree
    // callable: its body was `recursiveUpdate(signalState, arg)`, and with
    // `batching()` attached it wrapped that in `batch()` — so
    // `tree.batchUpdate(x)` was exactly `tree.batch(() => tree.$(x))`.
    // MEASURED equivalent before removal: 0.921 vs 0.925 us at 10 fields,
    // 16.585 vs 16.475 us at 100 (medians of 9 x 2000, overlapping ranges).
    it('batchUpdate no longer exists on any tree shape', () => {
      const enhanced = batching()(createMockTree()) as any;
      const disabled = batching({ enabled: false })(createMockTree()) as any;

      expect(enhanced.batchUpdate).toBeUndefined();
      expect(disabled.batchUpdate).toBeUndefined();
    });

    // (v12 removed the deprecated global functions flushBatchedUpdates /
    // hasPendingUpdates / getBatchQueueSize — use the tree's
    // flushNotifications() / hasPendingNotifications() instead.)

    // Was `highPerformanceBatching()`, deleted in 14.0.0 — v9.0.0 had already
    // removed its export and left the body behind. The preset it wrapped is
    // just this config, so the test now asserts the config works rather than
    // that a wrapper around it exists.
    it('the zero-delay batching config returns a batching enhancer', () => {
      const tree = createMockTree();
      const enhanced = batching({
        enabled: true,
        notificationDelayMs: 0,
      })(tree) as any;

      expect(typeof enhanced.batch).toBe('function');
      expect(typeof enhanced.coalesce).toBe('function');
    });
  });

  // ==========================================
  // ENHANCER CHAIN
  // ==========================================

  describe('enhancer chain', () => {
    it('should preserve root accessor identity', () => {
      const tree = createMockTree();

      const enhanced = batching()(tree);

      expect(enhanced.$ === tree.$).toBe(true);
    });
  });
});

describe('coalesce() + update() — no wall-clock data loss (14.1.1)', () => {
  // BEFORE the fix, updaters were deferred under the key
  // `${path}:update:${Date.now()}`, so two in the same millisecond collided and
  // one was silently dropped. Three `+1`s gave n = 1 when fast and n = 3 when
  // spaced 2ms apart — same code, answer decided by machine speed.
  it('three +1 updaters in one coalesce apply all three', () => {
    const tree = signalTree({ n: 0 }, { enhancers: [batching()] });
    tree.coalesce(() => {
      tree.$.n((v) => v + 1);
      tree.$.n((v) => v + 1);
      tree.$.n((v) => v + 1);
    });
    expect(tree.$.n()).toBe(3);
  });

  it('is independent of wall-clock spacing', () => {
    const spin = (ms: number) => {
      const start = performance.now();
      while (performance.now() - start < ms) {
        /* busy */
      }
    };
    const tree = signalTree({ n: 0 }, { enhancers: [batching()] });
    tree.coalesce(() => {
      tree.$.n((v) => v + 1);
      spin(2);
      tree.$.n((v) => v + 1);
    });
    expect(tree.$.n()).toBe(2);
  });

  // `set` IS coalescable — last value wins, and none of them read the previous.
  it('set still coalesces to the final value', () => {
    const tree = signalTree({ q: '' }, { enhancers: [batching()] });
    tree.coalesce(() => {
      tree.$.q('h');
      tree.$.q('he');
      tree.$.q('hel');
    });
    expect(tree.$.q()).toBe('hel');
  });

  // An updater must see a pending coalesced `set` on its own path, not a stale
  // value — otherwise mixing the two silently discards the set.
  it('an updater observes a pending coalesced set on the same path', () => {
    const tree = signalTree({ n: 0 }, { enhancers: [batching()] });
    tree.coalesce(() => {
      tree.$.n(10);
      tree.$.n((v) => v + 1);
    });
    expect(tree.$.n()).toBe(11);
  });
});
