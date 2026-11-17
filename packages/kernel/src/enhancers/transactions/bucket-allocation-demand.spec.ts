import { expect, it, vi } from 'vitest';

// Candidate-only mechanism witness. Run public semantic cases separately on
// the unchanged baseline. Constructor observation is not a CPU/heap benchmark.
it('constructs only the proposed eager capture containers, then preserves useful scalar and entity work', async () => {
  vi.resetModules();
  const { signalTree } = await import('../../lib/signal-tree');
  const { entityMap } = await import('../../lib/markers/entity-map');
  const { transactions, peekInternalTransactionRuntime } = await import(
    './transactions'
  );
  const { getPathNotifier } = await import('../../lib/path-notifier');
  const OriginalMap = globalThis.Map,
    OriginalSet = globalThis.Set;
  const counts = { Map: 0, Set: 0 };
  let readingStack = false;
  const wrap = <T extends MapConstructor | SetConstructor>(
    Target: T,
    kind: 'Map' | 'Set'
  ): T =>
    new Proxy(Target, {
      construct(target, args, newTarget) {
        const value = Reflect.construct(target, args, newTarget);
        // Stack source-map formatting can itself allocate maps. Do not recurse.
        if (!readingStack) {
          readingStack = true;
          try {
            if (/at createCaptureBucket\s*\(/.test(new Error().stack ?? ''))
              counts[kind]++;
          } finally {
            readingStack = false;
          }
        }
        return value;
      },
    });
  const make = () =>
    signalTree(
      { x: 0, rows: entityMap<{ id: string; n: number }, string>() },
      { enhancers: [transactions({ history: { retain: 0 } })] }
    );
  let tree: ReturnType<typeof make> | undefined;
  globalThis.Map = wrap(OriginalMap, 'Map');
  globalThis.Set = wrap(OriginalSet, 'Set');
  try {
    tree = make();
    expect(counts).toEqual({ Map: 7, Set: 2 });
    const scalar = tree.transact(() => tree!.$.x(7));
    expect(tree.$.x()).toBe(7);
    expect(peekInternalTransactionRuntime(tree)!.getPendingTurnCount()).toBe(1);
    // Includes construction plus the exact scalar open/probe/fold paths on this line.
    expect(counts).toEqual({ Map: 7 * 4, Set: 2 * 4 });
    scalar.rollback();
    expect(tree.$.x()).toBe(0);
    const useful = tree.transact(() => {
      tree!.$.x(9);
      tree!.$.rows.addOne({ id: 'a', n: 1 });
      tree!.$.rows.addOne({ id: 'b', n: 2 });
    });
    expect(tree.$.rows.all()).toEqual([
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
    ]);
    useful.rollback();
    expect(tree.$.x()).toBe(0);
    expect(tree.$.rows.all()).toEqual([]);
    const later = tree.transact(() => tree!.$.rows.addOne({ id: 'c', n: 3 }));
    later.confirm();
    expect(tree.$.rows.all()).toEqual([{ id: 'c', n: 3 }]);
    expect(peekInternalTransactionRuntime(tree)!.getPendingTurnCount()).toBe(0);
    expect(counts.Map).toBeGreaterThan(7 * 4);
  } finally {
    globalThis.Map = OriginalMap;
    globalThis.Set = OriginalSet;
    tree?.destroy();
    getPathNotifier().flushSync();
  }
});
