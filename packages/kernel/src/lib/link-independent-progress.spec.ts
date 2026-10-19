import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { entityMap } from './markers/entity-map';
import { link } from './link';
import { external } from './external';
import { linkStateReader } from './internals/link-state-view';
import { getMutationCaptureRuntime } from './internals/mutation-capture-runtime';
import {
  scheduleDurableConsequence,
  getHeldConsequenceCountForTesting,
} from './internals/commit-consequence';
const drain = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
const fixture = () =>
  signalTree(
    {
      x: 0,
      y: 0,
      nested: { n: 0 },
      rows: entityMap<{ id: string; x: number; y: number }, string>(),
    },
    { enhancers: [transactions()] }
  );
describe('Link independent progress through shared consequence authority', () => {
  it.each(['ordinary', 'confirm', 'refused'] as const)(
    'sends independent y while x remains %s',
    async (mode) => {
      const t = fixture();
      const xs: number[] = [];
      const ys: number[] = [];
      const lx = link(t.$.x, {
        set: (v) => {
          xs.push(v);
        },
      });
      const ly = link(t.$.y, {
        set: (v) => {
          ys.push(v);
        },
      });
      try {
        t.$.y(5);
        await drain();
        expect(ys).toEqual([5]);
        t.$.rows.addOne({ id: 'collision', x: 0, y: 0 });
        const p = t.transact(() => {
          t.$.x(1);
          if (mode === 'refused') t.$.rows.removeOne('collision');
        });
        if (mode === 'refused') {
          external(() => t.$.rows.addOne({ id: 'collision', x: 0, y: 0 }));
          expect(() => p.rollback()).toThrow();
        }
        if (mode === 'confirm') t.transact(() => t.$.y(11)).confirm();
        else t.$.y(11);
        await drain();
        expect(ys).toEqual([5, 11]);
        expect(xs).toEqual([]);
        expect(t.$.x()).toBe(1);
        if (mode !== 'refused') {
          p.rollback();
          await drain();
          expect(xs).toEqual([0]);
        } else expect(() => p.rollback()).toThrow();
      } finally {
        lx.dispose();
        ly.dispose();
        t.destroy();
      }
    }
  );
  it('holds a whole branch while allowing a disjoint sibling', async () => {
    const t = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const whole: unknown[] = [];
    const ys: number[] = [];
    const a = link(t.$, {
        set: (v) => {
          whole.push(v);
        },
      }),
      b = link(t.$.y, {
        set: (v) => {
          ys.push(v);
        },
      });
    try {
      const p = t.transact(() => t.$.x(1));
      t.$.y(2);
      await drain();
      expect(whole).toEqual([]);
      expect(ys).toEqual([2]);
      p.rollback();
      await drain();
      expect(whole).toEqual([expect.objectContaining({ x: 0, y: 2 })]);
    } finally {
      a.dispose();
      b.dispose();
      t.destroy();
    }
  });
  it('separates fields of one lifetime and distinct lifetimes', async () => {
    const t = fixture();
    t.$.rows.addMany([
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0, y: 0 },
    ]);
    const a = t.$.rows.byIdOrFail('a'),
      b = t.$.rows.byIdOrFail('b');
    const xs: number[] = [],
      ys: number[] = [],
      bs: number[] = [];
    const links = [
      link(a.x, {
        set: (v) => {
          xs.push(v);
        },
      }),
      link(a.y, {
        set: (v) => {
          ys.push(v);
        },
      }),
      link(b.x, {
        set: (v) => {
          bs.push(v);
        },
      }),
    ];
    try {
      const p = t.transact(() => a.x(1));
      a.y(2);
      b.x(3);
      await drain();
      expect(xs).toEqual([]);
      expect(ys).toEqual([2]);
      expect(bs).toEqual([3]);
      p.rollback();
      await drain();
      expect(xs).toEqual([0]);
    } finally {
      links.forEach((l) => l.dispose());
      t.destroy();
    }
  });
  it('retains order-only authority for the collection without holding unrelated fields', async () => {
    const t = fixture();
    const rows = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0, y: 0 },
    ];
    t.$.rows.addMany(rows);
    const orders: string[][] = [],
      ys: number[] = [];
    const a = link(t.$.rows, {
        set: (v) => {
          orders.push(v.map((r) => r.id));
        },
      }),
      b = link(t.$.rows.byIdOrFail('a').y, {
        set: (v) => {
          ys.push(v);
        },
      });
    try {
      const p = t.transact(() => t.$.rows.setAll([...rows].reverse()));
      t.$.rows.byIdOrFail('a').y(2);
      await drain();
      expect(orders).toEqual([]);
      expect(ys).toEqual([2]);
      p.confirm();
      await drain();
      expect(orders.at(-1)).toEqual(['b', 'a']);
    } finally {
      a.dispose();
      b.dispose();
      t.destroy();
    }
  });
  it('rechecks admission after sending observation opens an intersecting transaction', async () => {
    const t = fixture();
    const sent: number[] = [];
    const l = link(t.$.y, {
      set: (v) => {
        sent.push(v);
      },
    });
    let pending: ReturnType<typeof t.transact> | undefined;
    const reader = linkStateReader(t);
    let armed = true;
    const off = reader.subscribe((event) => {
      if (event.link.sending && armed) {
        armed = false;
        pending = t.transact(() => t.$.y(9));
      }
    });
    try {
      t.$.y(2);
      await drain();
      expect(pending).toBeDefined();
      expect(sent).toEqual([]);
      expect(reader.snapshot().links[0]).toMatchObject({
        held: true,
        sending: false,
      });
      off();
      pending!.rollback();
      await drain();
      expect(sent).toEqual([2]);
    } finally {
      off();
      l.dispose();
      t.destroy();
    }
  });
  it('drops held closures on disposal and destruction', async () => {
    const t = fixture();
    const sent: number[] = [];
    const l = link(t.$.x, {
      set: (v) => {
        sent.push(v);
      },
    });
    const p = t.transact(() => t.$.x(1));
    await drain();
    expect(getHeldConsequenceCountForTesting(t)).toBeGreaterThan(0);
    l.dispose();
    expect(getHeldConsequenceCountForTesting(t)).toBe(0);
    p.rollback();
    await drain();
    expect(sent).toEqual([]);
    t.destroy();
  });
  it('blocks parent membership while keeping sibling addresses independent', async () => {
    const t = signalTree(
      { parent: { child: { n: 1 } }, other: 0 },
      { enhancers: [transactions()] }
    );
    const held = t.$.parent.child!.n;
    const sent: unknown[] = [];
    const other: number[] = [];
    const a = link(held, {
        set: (v) => {
          sent.push(v);
        },
      }),
      b = link(t.$.other, {
        set: (v) => {
          other.push(v);
        },
      });
    try {
      const p = t.transact(() => Reflect.apply(t.$, undefined, [{ other: 0 }]));
      t.$.other(2);
      await drain();
      expect(sent).toEqual([]);
      expect(other).toEqual([2]);
      p.rollback();
      await drain();
      expect(sent.at(-1)).toBe(1);
    } finally {
      a.dispose();
      b.dispose();
      t.destroy();
    }
  });
  it.each(['add', 'remove', 'rekey', 'replace'] as const)(
    'holds affected lifetime fields during %s',
    async (mode) => {
      const t = fixture();
      t.$.rows.addOne({ id: 'a', x: 0, y: 0 });
      const row = t.$.rows.byIdOrFail('a');
      const sent: unknown[] = [];
      const ys: number[] = [];
      const a = link(row.x, {
          set: (v) => {
            sent.push(v);
          },
        }),
        b = link(t.$.y, {
          set: (v) => {
            ys.push(v);
          },
        });
      try {
        const p = t.transact(() => {
          if (mode === 'add') {
            t.$.rows.addOne({ id: 'new', x: 1, y: 0 });
            row.x(2);
          }
          if (mode === 'remove') t.$.rows.removeOne('a');
          if (mode === 'rekey') {
            t.$.rows.changeId('a', 'a2');
            row.x(2);
          }
          if (mode === 'replace') {
            t.$.rows.removeOne('a');
            t.$.rows.addOne({ id: 'a', x: 7, y: 0 });
          }
        });
        t.$.y(3);
        await drain();
        expect(sent).toEqual([]);
        expect(ys).toEqual([3]);
        p.rollback();
        await drain();
        expect(row.x()).toBe(0);
        expect(sent.at(-1)).toBe(0);
      } finally {
        a.dispose();
        b.dispose();
        t.destroy();
      }
    }
  );
  it('compares structured addresses without treating dots or empty keys as separators', async () => {
    const t = signalTree(
      { 'a.b': 0, a: { b: 0 }, '': 0 },
      { enhancers: [transactions()] }
    );
    const dotted: number[] = [],
      nested: number[] = [],
      empty: number[] = [];
    const links = [
      link(t.$['a.b'], {
        set: (v) => {
          dotted.push(v);
        },
      }),
      link(t.$.a.b, {
        set: (v) => {
          nested.push(v);
        },
      }),
      link(t.$[''], {
        set: (v) => {
          empty.push(v);
        },
      }),
    ];
    try {
      const p = t.transact(() => t.$['a.b'](1));
      t.$.a.b(2);
      t.$[''](3);
      await drain();
      expect(dotted).toEqual([]);
      expect(nested).toEqual([2]);
      expect(empty).toEqual([3]);
      p.rollback();
      await drain();
      expect(dotted).toEqual([0]);
    } finally {
      links.forEach((l) => l.dispose());
      t.destroy();
    }
  });
  it('holds pure order evidence during capture reentry before the callback returns', () => {
    const t = fixture();
    const rows = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0, y: 0 },
    ];
    t.$.rows.addMany(rows);
    let delivered = 0;
    const runtime = getMutationCaptureRuntime(t)!;
    const off = runtime.subscribeCollectionOrder!(() =>
      scheduleDurableConsequence({
        claimant: t.$.rows,
        key: 'order-probe',
        dependencyScoped: true,
        run: () => delivered++,
      })
    );
    try {
      const p = t.transact(() => {
        t.$.rows.setAll([...rows].reverse());
        expect(delivered).toBe(0);
      });
      expect(delivered).toBe(0);
      p.confirm();
      expect(delivered).toBe(1);
    } finally {
      off();
      t.destroy();
    }
  });
  it('reads active capture beside an older pending scope before final indexing', () => {
    const t = fixture();
    const sent: string[] = [];
    const schedule = (node: unknown, key: string) =>
      scheduleDurableConsequence({
        claimant: node,
        key,
        dependencyScoped: true,
        run: () => sent.push(key),
      });
    try {
      const p = t.transact(() => t.$.x(1));
      const q = t.transact(() => {
        t.$.y(2);
        schedule(t.$.x, 'x');
        schedule(t.$.y, 'y');
        schedule(t.$.nested.n, 'n');
        expect(sent).toEqual(['n']);
      });
      q.confirm();
      expect(sent).toEqual(['n', 'y']);
      p.rollback();
      expect(sent).toEqual(['n', 'y', 'x']);
    } finally {
      t.destroy();
    }
  });
});
