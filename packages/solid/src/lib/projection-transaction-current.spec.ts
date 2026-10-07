import { describe, expect, it } from 'vitest';
import { asReadonly, entityMap, signalTree, transactions } from '../index';
import { createComputed, createMemo, createRoot, createSignal } from 'solid-js';

type Row = { id: string; rank: number };
describe('native held projection reads during transactions', () => {
  it('uses the live Solid client runtime', () => {
    createRoot((dispose) => {
      const [n, set] = createSignal(0);
      let runs = 0;
      createComputed(() => {
        n();
        runs++;
      });
      set(1);
      expect(runs).toBe(2);
      dispose();
    });
  });

  it('keeps native identity and reads current sorted projections after each write', () => {
    const tree = signalTree(
      {
        rows: entityMap<Row, string>({
          sortComparer: (a, b) => a.rank - b.rank,
        }),
      },
      {
        enhancers: [transactions()],
        derived: ($) => ({ size: () => $.rows.count() }),
      }
    );
    try {
      const { all, count, ids } = tree.$.rows;

      const read = () => ({
        all: all().map((r) => r.id),
        count: count(),
        ids: ids(),
      });
      expect(read()).toEqual({ all: [], count: 0, ids: [] });
      // Owner-approved boundary: SignalTree views are current; a warmed
      // external native computed retains the framework's publication timing.
      let disposeExternal!: () => void;
      const externalRead = createRoot((dispose) => {
        disposeExternal = dispose;
        return createMemo(() => count());
      });
      expect(externalRead()).toBe(0);
      const size = tree.$.size;
      expect(size()).toBe(0);
      const inside: ReturnType<typeof read>[] = [];
      const pending = tree.transaction(() => {
        tree.$.rows.addOne({ id: 'a', rank: 2 });
        inside.push(read());
        expect(size()).toBe(inside.length);
        expect(externalRead()).toBe(0);
        tree.$.rows.addOne({ id: 'b', rank: 1 });
        inside.push(read());
        expect(size()).toBe(inside.length);
        expect(externalRead()).toBe(0);
        expect(tree.$.rows.all).toBe(all);
        expect(tree.$.rows.count).toBe(count);
        expect(tree.$.rows.ids).toBe(ids);
      });
      const after = read();
      expect(externalRead()).toBe(2);
      expect(tree.$.size).toBe(size);
      pending.rollback();
      expect(read()).toEqual({ all: [], count: 0, ids: [] });
      expect(externalRead()).toBe(0);
      disposeExternal();

      expect(after).toEqual({ all: ['b', 'a'], count: 2, ids: ['b', 'a'] });
      expect(inside).toEqual([
        { all: ['a'], count: 1, ids: ['a'] },
        { all: ['b', 'a'], count: 2, ids: ['b', 'a'] },
      ]);
    } finally {
      tree.destroy();
    }
  });
});

it('keeps a held native readonly leaf view current with stable identity', () => {
  const tree = signalTree({ value: 0 }, { enhancers: [transactions()] });
  try {
    const view = asReadonly(tree);
    const readonly = view.$.value;

    expect(readonly()).toBe(0);
    const pending = tree.transaction(() => {
      tree.$.value.set(1);
      expect(readonly()).toBe(1);
      expect(view.$.value).toBe(readonly);
    });
    pending.rollback();
    expect(readonly()).toBe(0);
    expect(view.$.value).toBe(readonly);
  } finally {
    tree.destroy();
  }
});

it('reads a cold held projection after each write without forcing delivery', () => {
  const tree = signalTree(
    { rows: entityMap<Row, string>() },
    { enhancers: [transactions()] }
  );
  try {
    const { all, count, ids } = tree.$.rows;
    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', rank: 1 });
      expect(all().map((row) => row.id)).toEqual(['a']);
      expect(count()).toBe(1);
      expect(ids()).toEqual(['a']);
      tree.$.rows.addOne({ id: 'b', rank: 2 });
      expect(all().map((row) => row.id)).toEqual(['a', 'b']);
      expect(count()).toBe(2);
      expect(ids()).toEqual(['a', 'b']);
    });
    pending.confirm();
  } finally {
    tree.destroy();
  }
});

it('retains held projection and query identities inside taps', () => {
  const tree = signalTree(
    { rows: entityMap<Row, string>() },
    { enhancers: [transactions()] }
  );
  try {
    const rows = tree.$.rows;
    const predicate = (row: Row) => row.rank > 0;
    const cells = () => [
      rows.all,
      rows.count,
      rows.ids,
      rows.asMap,
      rows.empty,
      rows.activeEntity,
      rows.where(predicate),
      rows.find(predicate),
    ];
    const held = cells();
    const identities: boolean[] = [];
    const values: number[] = [];
    rows.tap({
      onAdd: () => {
        identities.push(cells().every((cell, i) => cell === held[i]));
        values.push(rows.count());
      },
    });
    const pending = tree.transaction(() => {
      rows.addOne({ id: 'a', rank: 1 });
      rows.addOne({ id: 'b', rank: 2 });
    });
    expect(identities).toEqual([true, true]);
    expect(values).toEqual([1, 2]);
    pending.confirm();
  } finally {
    tree.destroy();
  }
});

it('recovers a held derived from a native error and retains external tracking', () => {
  const failure = new Error('not ready');
  const tree = signalTree(
    { rows: entityMap<Row, string>() },
    {
      enhancers: [transactions()],
      derived: ($) => ({
        guarded: () => {
          if ($.rows.count() === 0) throw failure;
          return $.rows.count() * 42;
        },
      }),
    }
  );
  let disposeExternal: (() => void) | undefined;
  try {
    const held = tree.$.guarded;
    expect(() => held()).toThrow(failure);
    const observeGuard = () => {
      try {
        return held();
      } catch (error) {
        if (error !== failure) throw error;
        return 'blocked';
      }
    };
    const external = createRoot((dispose) => {
      disposeExternal = dispose;
      return createMemo(observeGuard);
    });
    expect(external()).toBe('blocked');
    const pending = tree.transaction(() => {
      expect(() => held()).toThrow(failure);
      tree.$.rows.addOne({ id: 'ready', rank: 1 });
      expect(held()).toBe(42);
      expect(tree.$.guarded).toBe(held);
    });
    pending.confirm();
    expect(external()).toBe(42);
    tree.$.rows.addOne({ id: 'again', rank: 2 });
    expect(external()).toBe(84);
  } finally {
    disposeExternal?.();
    tree.destroy();
  }
});

it('retargets native dependencies after reading a conditional derived inside a transaction', () => {
  let computations = 0;
  const tree = signalTree(
    { chooseLeft: true, left: 1, right: 10 },
    {
      enhancers: [transactions()],
      derived: ($) => ({
        selected: () => {
          computations++;
          return $.chooseLeft() ? $.left() : $.right();
        },
      }),
    }
  );
  let disposeExternal: (() => void) | undefined;
  try {
    const held = tree.$.selected;
    expect(held()).toBe(1);
    const external = createRoot((dispose) => {
      disposeExternal = dispose;
      return createMemo(() => held());
    });
    expect(external()).toBe(1);
    const pending = tree.transaction(() => {
      tree.$.chooseLeft.set(false);
      expect(held()).toBe(10);
      // Exercise the warmed external computation without prescribing its
      // native timing: scalar carriers may invalidate before the group closes.
      void external();
      tree.$.right.set(11);
      expect(held()).toBe(11);
      void external();
    });
    pending.confirm();
    expect(held()).toBe(11);
    expect(external()).toBe(11);
    expect(tree.$.selected).toBe(held);
    const settledComputations = computations;

    tree.$.left.set(2);
    expect(held()).toBe(11);
    expect(external()).toBe(11);
    expect(computations).toBe(settledComputations);

    tree.$.right.set(12);
    expect(held()).toBe(12);
    expect(external()).toBe(12);
    expect(computations).toBeGreaterThan(settledComputations);
  } finally {
    disposeExternal?.();
    tree.destroy();
  }
});
