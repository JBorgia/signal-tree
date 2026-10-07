import { describe, expect, it } from 'vitest';
import { asReadonly, entityMap, signalTree, transactions } from '../index';
import { computed, isReadonly, isRef, watch } from 'vue';

type Row = { id: string; rank: number };
describe('native held projection reads during transactions', () => {
  it('keeps native identity and reads current sorted projections after each write', () => {
    const tree = signalTree(
      {
        rows: entityMap<Row, string>({
          sortComparer: (a, b) => a.rank - b.rank,
        }),
      },
      {
        enhancers: [transactions()],
        derived: ($) => ({ size: () => $.rows.count.value }),
      }
    );
    try {
      const { all, count, ids } = tree.$.rows;
      expect(isRef(all)).toBe(true);
      expect(isReadonly(all)).toBe(true);
      const read = () => ({
        all: all.value.map((r) => r.id),
        count: count.value,
        ids: ids.value,
      });
      expect(read()).toEqual({ all: [], count: 0, ids: [] });
      // Owner-approved boundary: SignalTree views are current; a warmed
      // external native computed retains the framework's publication timing.
      const external = computed(() => count.value);
      const externalRead = () => external.value;
      expect(externalRead()).toBe(0);
      const size = tree.$.size;
      expect(size.value).toBe(0);
      const inside: ReturnType<typeof read>[] = [];
      const pending = tree.transaction(() => {
        tree.$.rows.addOne({ id: 'a', rank: 2 });
        inside.push(read());
        expect(size.value).toBe(inside.length);
        expect(externalRead()).toBe(0);
        tree.$.rows.addOne({ id: 'b', rank: 1 });
        inside.push(read());
        expect(size.value).toBe(inside.length);
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

it('keeps synchronous Vue watchers on coherent final state', () => {
  const tree = signalTree(
    { rows: entityMap<Row, string>() },
    { enhancers: [transactions()] }
  );
  const read = () => ({
    count: tree.$.rows.count.value,
    ids: tree.$.rows.all.value.map((r) => r.id),
  });
  const seen: ReturnType<typeof read>[] = [];
  const off = watch(read, (value) => seen.push(value), { flush: 'sync' });
  try {
    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', rank: 2 });
      tree.$.rows.addOne({ id: 'b', rank: 1 });
      expect(seen).toEqual([]);
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((v) => v.count === 2 && v.ids.join(',') === 'a,b')).toBe(
      true
    );
    pending.confirm();
  } finally {
    off();
    tree.destroy();
  }
});

it('keeps a held native readonly leaf view current with stable identity', () => {
  const tree = signalTree({ value: 0 }, { enhancers: [transactions()] });
  try {
    const view = asReadonly(tree);
    const readonly = view.$.value;
    expect(isRef(readonly)).toBe(true);
    // The public whole-tree readonly view is type-only and retains its ref.
    expect(isReadonly(readonly)).toBe(false);
    expect(readonly.value).toBe(0);
    const pending = tree.transaction(() => {
      tree.$.value.value = 1;
      expect(readonly.value).toBe(1);
      expect(view.$.value).toBe(readonly);
    });
    pending.rollback();
    expect(readonly.value).toBe(0);
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
      expect(all.value.map((row) => row.id)).toEqual(['a']);
      expect(count.value).toBe(1);
      expect(ids.value).toEqual(['a']);
      tree.$.rows.addOne({ id: 'b', rank: 2 });
      expect(all.value.map((row) => row.id)).toEqual(['a', 'b']);
      expect(count.value).toBe(2);
      expect(ids.value).toEqual(['a', 'b']);
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
        values.push(rows.count.value);
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
          if ($.rows.count.value === 0) throw failure;
          return $.rows.count.value * 42;
        },
      }),
    }
  );
  try {
    const held = tree.$.guarded;
    // Warm through the external reader once: Vue need not rethrow a cached
    // error on a second read before invalidation. Recovery is tested below.
    const observeGuard = () => {
      try {
        return held.value;
      } catch (error) {
        if (error !== failure) throw error;
        return 'blocked';
      }
    };
    const external = computed(observeGuard);
    expect(external.value).toBe('blocked');
    const pending = tree.transaction(() => {
      expect(() => held.value).toThrow(failure);
      tree.$.rows.addOne({ id: 'ready', rank: 1 });
      expect(held.value).toBe(42);
      expect(tree.$.guarded).toBe(held);
    });
    pending.confirm();
    expect(external.value).toBe(42);
    tree.$.rows.addOne({ id: 'again', rank: 2 });
    expect(external.value).toBe(84);
  } finally {
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
          return $.chooseLeft.value ? $.left.value : $.right.value;
        },
      }),
    }
  );
  try {
    const held = tree.$.selected;
    expect(held.value).toBe(1);
    const external = computed(() => held.value);
    expect(external.value).toBe(1);
    const pending = tree.transaction(() => {
      tree.$.chooseLeft.value = false;
      expect(held.value).toBe(10);
      // Exercise the warmed external computation without prescribing its
      // native timing: scalar carriers may invalidate before the group closes.
      void external.value;
      tree.$.right.value = 11;
      expect(held.value).toBe(11);
      void external.value;
    });
    pending.confirm();
    expect(held.value).toBe(11);
    expect(external.value).toBe(11);
    expect(tree.$.selected).toBe(held);
    const settledComputations = computations;

    tree.$.left.value = 2;
    expect(held.value).toBe(11);
    expect(external.value).toBe(11);
    expect(computations).toBe(settledComputations);

    tree.$.right.value = 12;
    expect(held.value).toBe(12);
    expect(external.value).toBe(12);
    expect(computations).toBeGreaterThan(settledComputations);
  } finally {
    tree.destroy();
  }
});
