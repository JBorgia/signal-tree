import { afterEach, describe, expect, it } from 'vitest';

import { restoration, signalTree } from '../index';
import { getOwnedPositionIds } from './internals/owned-metadata';
import {
  getNodeAddress,
  getPositionRegistry,
} from './internals/position-registry';
import {
  clearProductionSubstrateStatsForTesting,
  installProductionSubstrateStatsForTesting,
  resetProductionSubstrateStatsForTesting,
} from './internals/production-substrate-stats';

/**
 * v16 slice 8g: the work omission and re-adding leave on ordinary reads,
 * writes and partial merges, counted rather than timed
 * (`.claude/evidence/perf-15.4.4`, items 1-3; timings in
 * `.claude/evidence/v16/slice8g/perf`).
 */

afterEach(() => clearProductionSubstrateStatsForTesting());

const deep = () => ({
  a: { b: { c: { d: { n: 0 } } } },
  side: { x: 0 },
  count: 0,
});
type Deep = {
  $: ((value?: unknown) => unknown) & {
    a: { b: { c: { d: { n: (value?: number) => number } } } };
  };
  updateAndReport(value: unknown): unknown;
  destroy(): void;
};

describe('absence after an omission (v16 8g, perf item 1)', () => {
  it('reads and writes walk nothing once every omitted member is back', () => {
    const tree = signalTree(deep()) as unknown as Deep;
    try {
      const leaf = tree.$.a.b.c.d.n;
      tree.$({ side: { x: 0 }, count: 0 }); // omits a
      tree.$(deep()); // re-adds it: nothing in the tree is omitted
      const stats = installProductionSubstrateStatsForTesting();
      resetProductionSubstrateStatsForTesting(stats);
      let sum = 0;
      for (let i = 0; i < 500; i++) sum += leaf();
      for (let i = 0; i < 500; i++) leaf(i);
      expect(sum).toBe(0);
      expect(leaf()).toBe(499);
      expect(stats.absenceWalks).toBe(0);
    } finally {
      tree.destroy();
    }
  });

  it('with another member omitted, a location walks its links once per membership change', () => {
    const tree = signalTree(deep()) as unknown as Deep;
    try {
      const leaf = tree.$.a.b.c.d.n;
      tree.$({ side: { x: 0 }, count: 0 }); // omits a: links its locations
      tree.$({ a: { b: { c: { d: { n: 0 } } } }, count: 0 }); // re-adds a, omits side
      const stats = installProductionSubstrateStatsForTesting();
      resetProductionSubstrateStatsForTesting(stats);
      let sum = 0;
      for (let i = 0; i < 500; i++) sum += leaf();
      for (let i = 0; i < 500; i++) leaf(i);
      expect(sum).toBe(0);
      expect(leaf()).toBe(499);
      // One walk for the read path's first answer; the cache holds after.
      expect(stats.absenceWalks).toBeLessThanOrEqual(2);
      // A membership change invalidates the answer: one more walk. This
      // write only omits (side stays omitted), so nothing else advances it.
      tree.$({ count: 0 }); // omits a again
      resetProductionSubstrateStatsForTesting(stats);
      expect(leaf()).toBeUndefined();
      expect(leaf()).toBeUndefined();
      expect(stats.absenceWalks).toBe(1);
    } finally {
      tree.destroy();
    }
  });
});

describe('liveness stays while any member is omitted (v16 8g, perf item 1)', () => {
  it('re-adding one of two omitted members leaves the other absent', () => {
    const tree = signalTree({
      a: { n: 1 },
      side: { x: 2 },
      count: 0,
    }) as unknown as {
      $: ((value?: unknown) => unknown) & {
        a: { n: (value?: number) => number };
        side: { x: (value?: number) => number };
      };
      destroy(): void;
    };
    try {
      const x = tree.$.side.x;
      tree.$({ count: 1 }); // omits a and side
      tree.$({ a: { n: 3 }, count: 1 }); // re-adds a only
      expect(tree.$()).toEqual({ a: { n: 3 }, count: 1 });
      expect(x()).toBeUndefined();
      expect(tree.$.a.n()).toBe(3);
    } finally {
      tree.destroy();
    }
  });
});

describe('a partial merge with nothing omitted (v16 8g, perf item 2)', () => {
  it('examines no member keys, observed or not', () => {
    // Another tree's restoration makes path observation active.
    const keep = signalTree({ x: 0 }, { enhancers: [restoration()] });
    const wide: Record<string, number> = {};
    for (let i = 0; i < 200; i++) wide['f' + i] = i;
    const tree = signalTree(wide) as unknown as {
      $: () => Record<string, number>;
      updateAndReport(value: unknown): unknown;
      destroy(): void;
    };
    try {
      const stats = installProductionSubstrateStatsForTesting();
      resetProductionSubstrateStatsForTesting(stats);
      for (let i = 0; i < 100; i++) tree.updateAndReport({ f1: i });
      expect(tree.$()['f1']).toBe(99);
      expect(stats.membershipKeysVisited).toBe(0);
    } finally {
      tree.destroy();
      keep.destroy();
    }
  });

  it('still re-adds a supplied omitted member', () => {
    const tree = signalTree({ a: { v: 1 }, b: 2 }) as unknown as {
      $: ((value?: unknown) => unknown) & { b: (value?: number) => number };
      updateAndReport(value: unknown): unknown;
      destroy(): void;
    };
    try {
      tree.$({ b: 3 }); // omits a
      expect(tree.$()).toEqual({ b: 3 });
      tree.updateAndReport({ a: { v: 5 } });
      expect(tree.$()).toEqual({ a: { v: 5 }, b: 3 });
    } finally {
      tree.destroy();
    }
  });
});

describe('one address per node (v16 8g, perf item 3)', () => {
  // The accessor's backing store (`peerOf` in member-membership.ts).
  const STORE = Symbol.for('SignalTree:NodeStore');
  it('the accessor, its store and the registry share one frozen address', () => {
    const tree = signalTree(
      { a: { b: { n: 1 } }, m: 2 },
      { enhancers: [restoration()] }
    ) as unknown as {
      $: { a: { b: { n: () => number } & object } & object; m: () => number };
      destroy(): void;
    };
    try {
      const branch = tree.$.a.b as unknown as Record<symbol, object>;
      const address = getNodeAddress(branch);
      expect(address).toEqual(['a', 'b']);
      expect(Object.isFrozen(address)).toBe(true);
      expect(branch[STORE]).toBeDefined();
      expect(getNodeAddress(branch[STORE])).toBe(address);
      const leaf = tree.$.a.b.n;
      const leafAddress = getNodeAddress(leaf);
      expect(leafAddress).toEqual(['a', 'b', 'n']);
      expect(Object.isFrozen(leafAddress)).toBe(true);
      const position = getOwnedPositionIds(leaf)?.[0];
      expect(position).toBeTypeOf('number');
      expect(
        getPositionRegistry(tree.$ as object)?.addressFor(position as number)
      ).toBe(leafAddress);
    } finally {
      tree.destroy();
    }
  });
});
