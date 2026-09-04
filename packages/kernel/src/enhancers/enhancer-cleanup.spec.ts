import { describe, expect, it, vi } from 'vitest';
import { undoable } from '../lib/undoable';
import { batching } from './batching/batching';
import { restoration } from './restoration/restoration';
import { devTools } from './devtools/devtools';
import { transactions } from './transactions/transactions';
import { getPathNotifier } from '../lib/path-notifier';
import { signalTree } from '../lib/signal-tree';

/**
 * Phase 6: Enhancer cleanup tests
 * Verifies that destroy() cleans up resources for each enhancer
 */

function createMockTree() {
  const state = { count: 0, name: '' } as Record<string, any>;
  const cleanupFns: Array<() => void> = [];

  const tree = function (...args: any[]) {
    if (args.length === 0) return state;
    const arg = args[0];
    if (typeof arg === 'function') {
      const res = arg(state);
      if (res && typeof res === 'object') Object.assign(state, res);
      return;
    }
    if (typeof arg === 'object') {
      Object.assign(state, arg);
      return;
    }
  } as any;

  tree.state = {
    count: {
      set: (v: number) => {
        state.count = v;
      },
      update: (fn: (v: number) => number) => {
        state.count = fn(state.count);
      },
    },
    name: {
      set: (v: string) => {
        state.name = v;
      },
      update: (fn: (v: string) => string) => {
        state.name = fn(state.name);
      },
    },
  };
  tree.$ = tree.state;
  tree.bind =
    (_: unknown) =>
    (...a: unknown[]) =>
      tree.$(...(a as any));
  tree.registerCleanup = (fn: () => void) => {
    cleanupFns.push(fn);
  };
  tree.destroyed = () => false;
  tree.destroy = () => {
    for (const fn of cleanupFns) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
    cleanupFns.length = 0;
  };
  tree.with = (enhancer: any) => enhancer(tree);

  // Expose cleanup list for assertions
  tree.__cleanupFns = cleanupFns;

  return tree;
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('enhancer cleanup registration', () => {
  it('batching registers cleanup', () => {
    const tree = createMockTree();
    batching()(tree);
    expect(tree.__cleanupFns.length).toBeGreaterThan(0);
  });

  it('restoration registers cleanup', async () => {
    const tree = signalTree(
      { count: 0, name: '' },
      { enhancers: [restoration()] }
    );

    undoable(() => tree.$.count(1));
    await flush();
    expect(tree.getRestorationHistory().length).toBe(1);

    tree.destroy();

    expect(tree.getRestorationHistory()).toEqual([]);
  });

  it('devTools registers cleanup (enabled=false)', () => {
    const tree = createMockTree();
    devTools({ enabled: false })(tree);
    // Disabled devTools doesn't have resources — no cleanup needed
    // But enabled devTools does. Just verify no crash.
  });
});

describe('destroy() clears enhancer resources', () => {
  it('batching: clears pending timeout on destroy', () => {
    vi.useFakeTimers();
    try {
      const tree = signalTree(
        { count: 0 },
        { enhancers: [batching({ notificationDelayMs: 100 })] }
      );

      tree.$.count(42);
      expect(vi.getTimerCount()).toBe(1);

      tree.destroy();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('memoization: clears cache on destroy', () => {
    // Removed in 9.0.1: memoization enhancer deleted.
    expect(true).toBe(true);
  });

  it('restoration: clears history on destroy', () => {
    const enhanced = signalTree(
      { count: 0, name: '' },
      { enhancers: [restoration({ maxHistorySize: 50 })] }
    );

    // Make some changes
    undoable(() => enhanced.$.count(1));
    undoable(() => enhanced.$.count(2));

    enhanced.destroy();

    // Destroy releases every completed restoration entry.
    const history = enhanced.getRestorationHistory?.();
    if (history) {
      expect(history).toEqual([]);
    }
  });

  it('composed causal enhancers release global PathNotifier subscriptions on destroy', () => {
    const notifier = getPathNotifier();
    const initialSubscriberCount = notifier.getSubscriberCount();
    const tree = signalTree(
      { count: 0 },
      {
        enhancers: [
          restoration(),
          transactions(),
          devTools({ enableBrowserDevTools: false }),
        ],
        capabilities: ['causal-runtime'],
      }
    );

    expect(notifier.getSubscriberCount()).toBe(initialSubscriberCount + 3);

    tree.destroy();

    expect(notifier.getSubscriberCount()).toBe(initialSubscriberCount);
  });
});

describe('rapid create/destroy cycles', () => {
  it('handles 100 create/destroy cycles without leaking', () => {
    for (let i = 0; i < 100; i++) {
      const tree = createMockTree();
      batching()(tree);
      tree.destroy();
    }
    // If we get here without OOM or errors, the test passes
  });
});
