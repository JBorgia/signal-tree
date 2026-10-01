import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { entityMembershipReader } from './internals/entity-membership-view';
import { restoration } from '../enhancers/restoration/restoration';

// `array.push(...items)` passes every item as an argument, and V8 throws
// "Maximum call stack size exceeded" past ~10^5 arguments. Found by the
// 2026-09-30 performance audit: a 200k-row setAll threw while membership was
// observed (Studio's entity evidence).
type Row = { id: number; n: number };
const rows = (count: number, offset = 0): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: i + offset, n: i }));
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
// Past V8's ~1.2e5 argument limit, small enough for a restoration-enabled undo.
const LARGE = 130_000;

describe('entity batches larger than the argument limit', () => {
  it('setAll, replace and clear with membership observed', () => {
    const tree = signalTree({ rows: entityMap<Row, number>() });
    const reader = entityMembershipReader(tree)!;
    let events = 0;
    const stop = reader.subscribe(() => events++);
    try {
      tree.$.rows.setAll(rows(LARGE));
      tree.$.rows.setAll(rows(LARGE, LARGE));
      tree.$.rows.setAll([]);
      expect(tree.$.rows.count()).toBe(0);
      expect(events).toBeGreaterThan(0);
    } finally {
      stop();
      tree.destroy();
    }
  });

  it('undo and redo of a setAll that replaced every row', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>() },
      { enhancers: [restoration()] }
    );
    try {
      tree.$.rows.setAll(rows(LARGE));
      await flush();
      undoable(() => tree.$.rows.setAll(rows(LARGE, LARGE)));
      await flush();
      tree.undo();
      expect(tree.$.rows.count()).toBe(LARGE);
      expect(tree.$.rows.ids()[0]).toBe(0);
      tree.redo();
      expect(tree.$.rows.ids()[0]).toBe(LARGE);
    } finally {
      tree.destroy();
    }
  }, 120_000);
});

// Removal neighbours were found with a linear search per removed row, so
// replacing or clearing a collection was O(n^2): 40k rows took ~2 s. Doubling
// the size of a linear operation roughly doubles its time; quadratic quadruples.
describe('setAll removal cost scales linearly', () => {
  const time = (count: number, next: (count: number) => Row[]) => {
    const tree = signalTree({ rows: entityMap<Row, number>() });
    tree.$.rows.setAll(rows(count));
    const start = performance.now();
    tree.$.rows.setAll(next(count));
    const elapsed = performance.now() - start;
    tree.destroy();
    return elapsed;
  };
  const ratio = (next: (count: number) => Row[]) => {
    time(2_000, next); // warm the JIT
    const best = (count: number) =>
      Math.min(time(count, next), time(count, next), time(count, next));
    const small = best(8_000);
    const large = best(64_000);
    return large / small;
  };

  it('replacing every id', () => {
    // 8x the rows: ~8x if linear, ~64x if quadratic. The wide margin keeps a
    // loaded machine from failing a linear run (4x/9 and 8x/24 versions
    // flaked under the full suite's parallel load).
    expect(ratio((count) => rows(count, count))).toBeLessThan(32);
  });

  it('clearing with setAll([])', () => {
    expect(ratio(() => [])).toBeLessThan(32);
  });
});
