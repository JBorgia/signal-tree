import { TestBed } from '@angular/core/testing';
import { signalTree, type SignalTree } from '@signaltree/core';
import { withBatching, flushBatchedUpdates } from './batching';
import { withDevTools, attachDevToolsSync } from '@signaltree/devtools';

describe('Enhancer composition order (batching <-> devtools)', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  type BatchUpdater = (
    u: (s: { count: number }) => Partial<{ count: number }>
  ) => void;

  it('works when batching is applied before devtools', () => {
    const initial = { count: 0 };
    const tree = signalTree(initial).with(
      withBatching(),
      withDevTools({ enableBrowserDevTools: false })
    );

    // Attach full devtools synchronously for deterministic test behavior
    attachDevToolsSync(tree as unknown as SignalTree<{ count: number }>, {
      enableBrowserDevTools: false,
    });

    // Ensure batchUpdate exists on root
    type BatchUpdater = (
      u: (s: { count: number }) => Partial<{ count: number }>
    ) => void;
    expect(
      typeof (tree.$ as unknown as { batchUpdate?: BatchUpdater }).batchUpdate
    ).toBe('function');

    (tree.$ as unknown as { batchUpdate: BatchUpdater }).batchUpdate((s) => ({
      count: (s as { count: number }).count + 1,
    }));
    flushBatchedUpdates();

    expect(tree.state.count()).toBe(1);

    const metrics = (
      tree as unknown as {
        __devTools: { metrics: () => { totalUpdates: number } };
      }
    ).__devTools.metrics();
    // core module should have recorded at least one update
    expect(metrics.totalUpdates).toBeGreaterThanOrEqual(1);
  });

  it('works when devtools is applied before batching', () => {
    const initial = { count: 0 };
    const tree = signalTree(initial).with(
      withDevTools({ enableBrowserDevTools: false }),
      withBatching()
    );

    attachDevToolsSync(tree as unknown as SignalTree<{ count: number }>, {
      enableBrowserDevTools: false,
    });

    expect(
      typeof (tree.$ as unknown as { batchUpdate?: BatchUpdater }).batchUpdate
    ).toBe('function');

    (tree.$ as unknown as { batchUpdate: BatchUpdater }).batchUpdate((s) => ({
      count: (s as { count: number }).count + 2,
    }));
    flushBatchedUpdates();

    expect(tree.state.count()).toBe(2);

    const metrics = (
      tree as unknown as {
        __devTools: { metrics: () => { totalUpdates: number } };
      }
    ).__devTools.metrics();
    expect(metrics.totalUpdates).toBeGreaterThanOrEqual(1);
  });
});
