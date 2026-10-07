import { describe, expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
import { createNativeLocationRuntime } from './internals/native-location-realization';
import { createLocationRuntime } from './internals/location-runtime';
import { NEUTRAL_OBSERVATION_ADAPTER } from './internals/observation-adapter';

type Row = { id: string; rank: number };

describe('transaction projections read current storage without early publication', () => {
  for (const warm of [false, true])
    for (const sorted of [false, true]) {
      it(`reads fresh and held all/count/ids twice (warm=${warm}, sorted=${sorted})`, () => {
        const tree = signalTree(
          {
            rows: entityMap<Row, string>({
              ...(sorted
                ? { sortComparer: (a: Row, b: Row) => a.rank - b.rank }
                : {}),
            }),
          },
          { enhancers: [transactions()] }
        );
        try {
          const rows = tree.$.rows;
          const all = rows.all,
            count = rows.count,
            ids = rows.ids;
          if (warm) {
            expect(all()).toEqual([]);
            expect(count()).toBe(0);
            expect(ids()).toEqual([]);
          }
          const pending = tree.transaction(() => {
            rows.addOne({ id: 'a', rank: 2 });
            expect(all()).toEqual([{ id: 'a', rank: 2 }]);
            expect(count()).toBe(1);
            expect(ids()).toEqual(['a']);
            rows.addOne({ id: 'b', rank: 1 });
            const keys = sorted ? ['b', 'a'] : ['a', 'b'];
            expect(all().map((r) => r.id)).toEqual(keys);
            expect(count()).toBe(2);
            expect(ids()).toEqual(keys);
            expect(rows.all()).toBe(all());
            expect(rows.ids()).toBe(ids());
            expect(rows.count()).toBe(count());
            expect(rows.all).toBe(all);
            expect(rows.count).toBe(count);
            expect(rows.ids).toBe(ids);
            rows.updateOne('a', { rank: 0 });
            expect(all().map((r) => r.id)).toEqual(['a', 'b']);
            expect(all()[0].rank).toBe(0);
            expect(ids()).toEqual(['a', 'b']);
          });
          expect(count()).toBe(2);
          pending.rollback();
          expect(all()).toEqual([]);
          expect(count()).toBe(0);
          expect(ids()).toEqual([]);
        } finally {
          tree.destroy();
        }
      });
    }
  it('publishes final coherent projections once despite reads in the callback', () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>() },
      {
        enhancers: [transactions()],
        derived: ($) => ({
          total: () => $.rows.all().reduce((sum, r) => sum + r.rank, 0),
        }),
      }
    );
    const seen: unknown[] = [];
    const read = () => ({
      ids: tree.$.rows.ids(),
      count: tree.$.rows.count(),
      total: tree.$.total(),
    });
    const releases = [
      tree.$.rows.all,
      tree.$.rows.count,
      tree.$.rows.ids,
      tree.$.total,
    ].map((cell) => cell.subscribe(() => seen.push(read())));
    try {
      const pending = tree.transaction(() => {
        tree.$.rows.addOne({ id: 'a', rank: 2 });
        expect(tree.$.total()).toBe(2);
        tree.$.rows.addOne({ id: 'b', rank: 3 });
        expect(read()).toEqual({ ids: ['a', 'b'], count: 2, total: 5 });
        expect(seen).toEqual([]);
      });
      expect(seen).toEqual(
        Array.from({ length: 4 }, () => ({
          ids: ['a', 'b'],
          count: 2,
          total: 5,
        }))
      );
      pending.confirm();
      expect(seen).toHaveLength(4);
    } finally {
      releases.forEach((off) => off());
      tree.destroy();
    }
  });
});

describe('derived cache freshness and publication are separate', () => {
  it('keeps chains fresh but compares delivery to the pre-group value', () => {
    const runtime = createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
    const n = runtime.createCell(0);
    let computes = 0;
    const double = runtime.createDerived(() => {
      computes++;
      return n() * 2;
    });
    const label = runtime.createDerived(() => `n=${double()}`);
    const seen: string[] = [];
    const off = label.subscribe(() => seen.push(label()));
    try {
      runtime.runInvalidationGroup(() => {
        n(1);
        expect(label()).toBe('n=2');
        expect(label()).toBe('n=2');
        expect(computes).toBe(2);
        n(2);
        expect(label()).toBe('n=4');
        expect(seen).toEqual([]);
      });
      expect(seen).toEqual(['n=4']);
      expect(computes).toBe(3);
      runtime.runInvalidationGroup(() => {
        n(3);
        expect(label()).toBe('n=6');
        n(2);
        expect(label()).toBe('n=4');
      });
      expect(seen).toEqual(['n=4']);
    } finally {
      off();
    }
  });
  it('refreshes membership publishers and epochs before group delivery', () => {
    const runtime = createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
    let present = true;
    const binding = runtime.createWritable(
      () => present,
      () => false
    );
    const epoch = runtime.createEpoch!();
    let value = 1;
    const projected = runtime.createDerived(() => {
      epoch();
      return binding.location() ? value : 0;
    });
    expect(projected()).toBe(1);
    runtime.runInvalidationGroup(() => {
      value = 2;
      runtime.advanceEpoch!(epoch);
      expect(projected()).toBe(2);
      present = false;
      runtime.publish([binding]);
      expect(projected()).toBe(0);
    });
  });
  it("does not publish another runtime's open group", () => {
    const a = createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
    const b = createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
    const x = a.createCell(0),
      y = b.createCell(0);
    const dx = a.createDerived(() => x()),
      dy = b.createDerived(() => y());
    const seen: number[] = [];
    const offX = dx.subscribe(() => seen.push(dx())),
      offY = dy.subscribe(() => undefined);
    try {
      a.runInvalidationGroup(() => {
        x(1);
        expect(dx()).toBe(1);
        y(1);
        expect(seen).toEqual([]);
        x(2);
        expect(dx()).toBe(2);
      });
      expect(seen).toEqual([2]);
    } finally {
      offX();
      offY();
    }
  });
  it('defers framework tokens when intermediate values are read', () => {
    let notifications = 0;
    const runtime = createLocationRuntime({
      createToken: () => ({
        observe() {},
        invalidate() {
          notifications++;
        },
      }),
      runInvalidationGroup: (run) => run(),
    });
    const n = runtime.createCell(0),
      doubled = runtime.createDerived(() => n() * 2);
    expect(doubled()).toBe(0);
    runtime.runInvalidationGroup(() => {
      n(1);
      expect(doubled()).toBe(2);
      n(2);
      expect(doubled()).toBe(4);
      expect(notifications).toBe(0);
    });
    expect(notifications).toBe(1);
  });
});

describe('publication remains coherent under reentry', () => {
  it('contains a throwing subscriber and delivers its reentrant write', () => {
    const runtime = createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
    const n = runtime.createCell(0);
    const doubled = runtime.createDerived(() => n() * 2);
    const other = runtime.createDerived(() => n() * 3);
    const first: number[] = [],
      second: number[] = [];
    const offFirst = doubled.subscribe(() => {
      first.push(doubled());
      if (n() === 2) n(3);
      throw new Error('contained observer');
    });
    const offSecond = other.subscribe(() => second.push(other()));
    try {
      runtime.runInvalidationGroup(() => {
        n(1);
        expect(doubled()).toBe(2);
        n(2);
        expect(doubled()).toBe(4);
        expect(first).toEqual([]);
        expect(second).toEqual([]);
      });
      expect(first).toEqual([4, 6]);
      expect(second).toEqual([9]);
      expect(n()).toBe(3);
    } finally {
      offFirst();
      offSecond();
    }
  });

  it('retains pending delivery when an intermediate read changes dependencies', () => {
    const runtime = createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
    const choose = runtime.createCell(true),
      left = runtime.createCell(1),
      right = runtime.createCell(9);
    const selected = runtime.createDerived(() => (choose() ? left() : right()));
    const seen: number[] = [];
    const off = selected.subscribe(() => seen.push(selected()));
    try {
      runtime.runInvalidationGroup(() => {
        left(2);
        expect(selected()).toBe(2);
        choose(false);
        expect(selected()).toBe(9);
        left(3);
        expect(selected()).toBe(9);
        expect(seen).toEqual([]);
      });
      expect(seen).toEqual([9]);
      left(4);
      expect(seen).toEqual([9]);
      right(10);
      expect(seen).toEqual([9, 10]);
    } finally {
      off();
    }
  });
});

it('a foreign neutral runtime publishes the original binding cache and observers', () => {
  const owner = createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
  const publishing = createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
  let present = true;
  const binding = owner.createWritable(
    () => present,
    () => false
  );
  const view = owner.createDerived(() => binding.location());
  const seen: boolean[] = [];
  const off = view.subscribe(() => seen.push(view()));
  try {
    publishing.runInvalidationGroup(() => {
      present = false;
      publishing.publish([binding]);
      expect(view()).toBe(false);
      expect(seen).toEqual([]);
    });
    expect(seen).toEqual([false]);
  } finally {
    off();
  }
});

it('a foreign native runtime cannot bypass a neutral publisher cache', () => {
  const owner = createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
  const foreign = createNativeLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
  let present = true;
  const binding = owner.createWritable(
    () => present,
    () => false
  );
  const view = owner.createDerived(() => binding.location());
  const seen: boolean[] = [];
  const off = view.subscribe(() => seen.push(view()));
  try {
    expect(view()).toBe(true);
    foreign.runInvalidationGroup(() => {
      present = false;
      foreign.publish([binding]);
      expect(view()).toBe(false);
      expect(seen).toEqual([]);
    });
    expect(view()).toBe(false);
    expect(seen).toEqual([false]);
  } finally {
    off();
  }
});

it('prepared replay taps read all installed targets before observer delivery', () => {
  const tree = signalTree(
    { a: entityMap<Row, string>(), b: entityMap<Row, string>(), n: 0 },
    {
      enhancers: [transactions()],
      derived: ($) => ({ doubled: () => $.n() * 2 }),
    }
  );
  const delivered: number[] = [];
  let off: (() => void) | undefined;
  try {
    const pending = tree.transaction(() => {
      tree.$.a.addOne({ id: 'a', rank: 1 });
      tree.$.b.addOne({ id: 'b', rank: 1 });
      tree.$.n(1);
    });
    const allB = tree.$.b.all;
    const doubled = tree.$.doubled;
    expect(allB().map((row) => row.id)).toEqual(['b']);
    expect(doubled()).toBe(2);
    off = doubled.subscribe(() => delivered.push(doubled()));
    const seen: unknown[] = [];
    tree.$.a.tap({
      onRemove: () =>
        seen.push({
          b: allB().map((row) => row.id),
          directB: tree.$.b.byId('b'),
          doubled: doubled(),
          n: tree.$.n(),
          delivered: [...delivered],
        }),
    });
    pending.rollback();
    expect(seen).toEqual([
      {
        b: [],
        directB: undefined,
        doubled: 0,
        n: 0,
        delivered: [],
      },
    ]);
    expect(delivered).toEqual([0]);
  } finally {
    off?.();
    tree.destroy();
  }
});
