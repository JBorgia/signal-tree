import { describe, expect, it } from 'vitest';
import { restoration, signalTree, transactions, undoable } from '../index';
import { applyPlainBranchMemberSnapshot } from './internals/plain-branch-membership';
import { getOwnedPositionIds } from './internals/owned-metadata';

type Leaf = { (): number | undefined; (value: number): void };
type Tree = {
  $: ((value?: unknown) => unknown) & { a: { b: { c: { d: { n: Leaf } } } } };
  destroy(): void;
};
const shape = () => ({
  a: { b: { c: { d: { n: 0 } } } },
  side: { x: 0 },
  count: 0,
});
const make = () => signalTree(shape()) as unknown as Tree;
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
function descriptorReads(run: () => void): number {
  const original = Object.getOwnPropertyDescriptor;
  let count = 0;
  Object.getOwnPropertyDescriptor = (target, key) => {
    count++;
    return original(target, key);
  };
  try {
    run();
    return count;
  } finally {
    Object.getOwnPropertyDescriptor = original;
  }
}
function enumeratedKeys(run: () => void): number {
  const original = Object.getOwnPropertyNames;
  let count = 0;
  Object.getOwnPropertyNames = (target) => {
    const keys = original(target);
    count += keys.length;
    return keys;
  };
  try {
    run();
    return count;
  } finally {
    Object.getOwnPropertyNames = original;
  }
}

describe('membership work follows its tree and affected keys', () => {
  it('present re-added locations do not walk ancestors on repeated reads or writes', () => {
    const tree = make();
    try {
      const leaf = tree.$.a.b.c.d.n;
      tree.$({ side: { x: 0 }, count: 0 });
      tree.$(shape());
      expect(leaf()).toBe(0);
      const reads = descriptorReads(() => {
        for (let i = 0; i < 100; i++) leaf();
      });
      const writes = descriptorReads(() => {
        for (let i = 1; i <= 100; i++) leaf(i);
      });
      expect(leaf()).toBe(100);
      expect(reads).toBe(0);
      expect(writes).toBe(0);
    } finally {
      tree.destroy();
    }
  });
  it('another tree changing membership does not invalidate a cached answer', () => {
    const a = make();
    const b = make();
    try {
      const leaf = a.$.a.b.c.d.n;
      a.$({ count: 0 });
      a.$(shape());
      expect(leaf()).toBe(0);
      b.$({ count: 0 });
      const reads = descriptorReads(() => {
        expect(leaf()).toBe(0);
      });
      expect(reads).toBe(0);
      a.$({ count: 1 });
      expect(leaf()).toBeUndefined();
      leaf(7);
      expect(leaf()).toBe(7);
      expect(a.$()).toEqual({ a: { b: { c: { d: { n: 7 } } } }, count: 1 });
    } finally {
      a.destroy();
      b.destroy();
    }
  });
  it('a one-key partial update never enumerates the whole observed branch', async () => {
    const values = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`f${i}`, i])
    );
    const tree = signalTree(values, { enhancers: [restoration()] });
    try {
      await flush();
      const visited = enumeratedKeys(() =>
        undoable(() => tree.updateAndReport({ f1: 999 }))
      );
      expect(tree.$.f1()).toBe(999);
      expect(tree.$.f199()).toBe(199);
      expect(visited).toBeLessThanOrEqual(1);
      await flush();
      tree.undo();
      expect(tree.$.f1()).toBe(1);
    } finally {
      tree.destroy();
    }
  });
  it('partial updates re-add supplied omitted fields without losing unrelated fields', async () => {
    const tree = signalTree(
      { a: 1, b: 2, c: 3 },
      { enhancers: [restoration()] }
    );
    try {
      (tree.$ as unknown as (value: unknown) => void)({ b: 2, c: 3 });
      await flush();
      undoable(() => tree.updateAndReport({ a: 9 }));
      await flush();
      expect(tree.$()).toEqual({ a: 9, b: 2, c: 3 });
      tree.undo();
      expect(tree.$()).toEqual({ b: 2, c: 3 });
      tree.redo();
      expect(tree.$()).toEqual({ a: 9, b: 2, c: 3 });
    } finally {
      tree.destroy();
    }
  });
});

it('history locates a retained member by structured address without searching unrelated branches', async () => {
  const tree = signalTree(
    {
      noise: Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [`n${i}`, { value: i }])
      ),
      'a.b': { 'c/d': { keep: 1, omitted: 2 } },
    },
    { enhancers: [restoration()] }
  );
  try {
    const member = tree.$['a.b']['c/d'].omitted;
    undoable(() =>
      (tree.$['a.b']['c/d'] as unknown as (v: unknown) => void)({ keep: 1 })
    );
    await flush();
    const position = getOwnedPositionIds(member)?.[0];
    expect(position).toBeDefined();
    let restored: unknown;
    const snapshot = tree.$();
    const visited = enumeratedKeys(() => {
      restored = applyPlainBranchMemberSnapshot(
        tree.$,
        snapshot,
        position!,
        true,
        2
      );
    });
    expect(restored).toEqual({
      ...snapshot,
      'a.b': { 'c/d': { keep: 1, omitted: 2 } },
    });
    expect(visited).toBe(0);
    expect(() =>
      applyPlainBranchMemberSnapshot(
        tree.$['a.b'],
        tree.$['a.b'](),
        position!,
        true,
        2
      )
    ).toThrow('Plain branch history location is unavailable');
  } finally {
    tree.destroy();
  }
});

it('an unrelated observed tree does not enable whole-branch capture', async () => {
  const value = (offset: number) =>
    Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`f${i}`, i + offset])
    );
  const plain = signalTree(value(0));
  let observed: ReturnType<typeof observedTree> | undefined;
  function observedTree() {
    return signalTree({ n: 0 }, { enhancers: [restoration()] });
  }
  try {
    await flush();
    // Whole-value reconciliation itself must inspect omitted membership.
    // Compare that useful baseline with the exact same work under a foreign
    // observer; zero enumeration would forbid required reconciliation too.
    const baseline = enumeratedKeys(() => plain.$(value(1)));
    expect(plain.$.f199()).toBe(200);
    observed = observedTree();
    await flush();
    const visited = enumeratedKeys(() => plain.$(value(2)));
    expect(plain.$.f199()).toBe(201);
    expect(visited).toBe(baseline);
    const tracked = observed;
    undoable(() => tracked.$.n(3));
    await flush();
    expect(tracked.getRestorationHistory()).toHaveLength(1);
    tracked.undo();
    expect(tracked.$.n()).toBe(0);
  } finally {
    plain.destroy();
    observed?.destroy();
  }
});

it('membership capture does not evaluate omitted readonly recipes', () => {
  let computations = 0;
  const tree = signalTree(
    { keep: 0, optional: 7 } as { keep: number; optional?: number },
    {
      enhancers: [transactions()],
      derived: ($) => ({
        cold: () => {
          computations++;
          return $.keep() + 1;
        },
      }),
    }
  );
  try {
    const optional = tree.$.optional;
    const pending = tree.transaction(() => tree.$({ keep: 1 }));
    expect(computations).toBe(0);
    expect(tree.$.keep()).toBe(1);
    expect(optional?.()).toBeUndefined();
    pending.rollback();
    expect(tree.$.keep()).toBe(0);
    expect(optional?.()).toBe(7);
    expect(computations).toBe(0);
  } finally {
    tree.destroy();
  }
});
