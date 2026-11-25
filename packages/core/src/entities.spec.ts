import { describe, expect, it, vi } from 'vitest';
import { PlainCell, SignalTreeRefusal, entityMap, signalTree } from '@signal-tree/core';
import type { ObserveListener, Plugin, ScopeHandle } from '@signal-tree/core';

interface Order {
  id: number;
  name: string;
  qty: number;
  note?: string;
}

const rows = (): Order[] => [
  { id: 1, name: 'a', qty: 1 },
  { id: 2, name: 'b', qty: 2 },
  { id: 3, name: 'c', qty: 3 },
];

const make = (initial: Order[] = rows()) => signalTree({ orders: entityMap<Order, number>({ rows: initial }), other: { x: 1 } });

function probe(onAttach: (scope: ScopeHandle) => void): Plugin<object> {
  return { name: 'probe', attach: (scope) => (onAttach(scope), { api: {}, detach: () => {} }) };
}

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
};

describe('entityMap reads', () => {
  it('[E4] reads rows by id, in order, with ids() and count()', () => {
    const { $ } = make();
    expect($.orders.count()).toBe(3);
    expect($.orders.ids()).toEqual([1, 2, 3]);
    expect($.orders.all()).toEqual(rows());
    expect($.orders.byId(2)!.get()).toEqual({ id: 2, name: 'b', qty: 2 });
    expect($.orders.byId(9)).toBeUndefined();
  });

  it('[E4][H2] returns frozen rows, and the same all() array while nothing changes', () => {
    const { $ } = make();
    const first = $.orders.all();
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0])).toBe(true);
    expect($.orders.all()).toBe(first);
    expect($.orders.ids()).toBe($.orders.ids());
  });

  it('[E4] never changes an all() result already returned (E4)', () => {
    const { $ } = make();
    const first = $.orders.all();
    $.orders.updateOne(1, { qty: 9 });
    $.orders.addOne({ id: 4, name: 'd', qty: 4 });
    expect(first).toEqual(rows());
    expect($.orders.all()).not.toBe(first);
  });

  it('[H2][O3] includes the rows in tree snapshots, read or not', () => {
    const tree = make();
    expect(tree.$.get().orders).toEqual(rows());
    tree.$.orders.updateOne(1, { name: 'z' });
    expect(tree.$.get().orders[0]!.name).toBe('z');
  });
});

describe('row handles and field cells', () => {
  it('[E2] creates field cells on first access, stable per handle (E2)', () => {
    const { $ } = make();
    const row = $.orders.byId(1)!;
    expect($.orders.byId(1)).toBe(row);
    expect(row.name).toBeInstanceOf(PlainCell);
    expect(row.name).toBe(row.name);
    expect(row.name.get()).toBe('a');
    expect('name' in row).toBe(true);
    expect('missing' in row).toBe(false);
    expect((row as unknown as Record<string, unknown>)['then']).toBeUndefined();
  });

  it('[E2] writes a field through its cell as an update of that row', () => {
    const { $ } = make();
    const qty = $.orders.byId(2)!.qty;
    const seen: number[] = [];
    qty.subscribe(() => seen.push(qty.get()));
    qty.set(20);
    qty.set(20);
    expect($.orders.byId(2)!.get()!.qty).toBe(20);
    expect(seen).toEqual([20]);
    $.orders.updateOne(2, { qty: 21 });
    expect(seen).toEqual([20, 21]);
  });

  it('refuses assignment to a row handle property', () => {
    const { $ } = make();
    expect(() => {
      (($.orders.byId(1) as unknown) as Record<string, unknown>)['qty'] = 1;
    }).toThrow(/ST1004/);
  });

  it('[E1] follows a key change, and never retargets to a row that reuses a removed key (E1)', () => {
    const { $ } = make();
    const row = $.orders.byId(1)!;
    const name = row.name;
    $.orders.changeId(1, 10);
    expect($.orders.byId(10)).toBe(row);
    expect(row.id.get()).toBe(10);
    expect($.orders.ids()).toEqual([10, 2, 3]);
    $.orders.updateOne(10, { id: 11 });
    expect($.orders.byId(11)).toBe(row);
    $.orders.removeOne(11);
    expect(row.get()).toBeUndefined();
    expect(name.get()).toBeUndefined();
    expect(() => name.set('x')).toThrow(/ST1004/);
    $.orders.addOne({ id: 11, name: 'new', qty: 0 });
    expect($.orders.byId(11)).not.toBe(row);
    expect(row.get()).toBeUndefined();
  });

  it('[E2][V1] sees fields added and removed by updates', () => {
    const { $ } = make();
    const note = $.orders.byId(1)!.note;
    expect(note.get()).toBeUndefined();
    $.orders.updateOne(1, { note: 'hi' });
    expect(note.get()).toBe('hi');
    $.orders.setAll([{ id: 1, name: 'a', qty: 1 }]);
    expect(note.get()).toBeUndefined();
    expect('note' in $.orders.byId(1)!).toBe(false);
  });
});

describe('writes', () => {
  it('[E4][V5] adds rows at the end, in input order, and copies them (E4, V5)', () => {
    const { $ } = make();
    const input = { id: 4, name: 'd', qty: 4 };
    $.orders.addOne(input);
    $.orders.addMany([{ id: 6, name: 'f', qty: 6 }, { id: 5, name: 'e', qty: 5 }]);
    input.name = 'changed';
    expect($.orders.ids()).toEqual([1, 2, 3, 4, 6, 5]);
    expect($.orders.byId(4)!.get()!.name).toBe('d');
  });

  it('[E1][E4] setAll keeps rows whose key stays, drops the rest, and takes the input order', () => {
    const { $ } = make();
    const two = $.orders.byId(2)!;
    $.orders.setAll([{ id: 3, name: 'C', qty: 3 }, { id: 2, name: 'b', qty: 2 }, { id: 7, name: 'g', qty: 7 }]);
    expect($.orders.ids()).toEqual([3, 2, 7]);
    expect($.orders.byId(2)).toBe(two);
    expect($.orders.byId(1)).toBeUndefined();
    expect($.orders.byId(3)!.get()!.name).toBe('C');
  });

  it('[E3] updateOne merges changes; upsert adds or merges', () => {
    const { $ } = make();
    $.orders.updateOne(1, { qty: 5 });
    expect($.orders.byId(1)!.get()).toEqual({ id: 1, name: 'a', qty: 5 });
    $.orders.updateMany([{ id: 2, changes: { qty: 6 } }, { id: 3, changes: { name: 'q' } }]);
    expect($.orders.all().map((r) => [r.qty, r.name])).toEqual([[5, 'a'], [6, 'b'], [3, 'q']]);
    $.orders.upsertOne({ id: 1, name: 'A', qty: 5 });
    $.orders.upsertMany([{ id: 9, name: 'i', qty: 9 }]);
    expect($.orders.ids()).toEqual([1, 2, 3, 9]);
    expect($.orders.byId(1)!.get()!.name).toBe('A');
  });

  it('[E4] removes rows and closes the gap; clear removes every row', () => {
    const { $ } = make();
    $.orders.removeOne(2);
    expect($.orders.ids()).toEqual([1, 3]);
    $.orders.removeMany([1, 3]);
    expect($.orders.count()).toBe(0);
    $.orders.addMany(rows());
    $.orders.clear();
    expect($.orders.all()).toEqual([]);
  });

  it('[E1][E4][E3] changeId keeps the row position and changes nothing when the key is the same', () => {
    const { $ } = make();
    const listener = vi.fn();
    $.orders.byId(2)!.id.subscribe(listener);
    $.orders.changeId(2, 2);
    expect(listener).not.toHaveBeenCalled();
    $.orders.changeId(2, 20);
    expect($.orders.ids()).toEqual([1, 20, 3]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('[E3] every call is all-or-nothing (E3)', () => {
  const unchanged = (fn: (t: ReturnType<typeof make>) => void, code: string) => {
    const tree = make();
    const before = tree.$.orders.all();
    expect(codeOf(() => fn(tree))).toBe(code);
    expect(tree.$.orders.all()).toEqual(before);
  };

  it('refuses existing, missing, occupied and repeated keys', () => {
    unchanged((t) => t.$.orders.addOne({ id: 1, name: 'x', qty: 0 }), 'ST1010');
    unchanged((t) => t.$.orders.addMany([{ id: 8, name: 'x', qty: 0 }, { id: 8, name: 'y', qty: 0 }]), 'ST1010');
    unchanged((t) => t.$.orders.addMany([{ id: 8, name: 'x', qty: 0 }, { id: 2, name: 'y', qty: 0 }]), 'ST1010');
    unchanged((t) => t.$.orders.updateOne(9, { qty: 1 }), 'ST1011');
    unchanged((t) => t.$.orders.updateMany([{ id: 1, changes: { qty: 7 } }, { id: 9, changes: { qty: 1 } }]), 'ST1011');
    unchanged((t) => t.$.orders.updateMany([{ id: 1, changes: { qty: 7 } }, { id: 1, changes: { qty: 8 } }]), 'ST1010');
    unchanged((t) => t.$.orders.updateOne(1, { id: 2 }), 'ST1010');
    unchanged((t) => t.$.orders.removeOne(9), 'ST1011');
    unchanged((t) => t.$.orders.removeMany([1, 1]), 'ST1010');
    unchanged((t) => t.$.orders.removeMany([1, 9]), 'ST1011');
    unchanged((t) => t.$.orders.changeId(9, 10), 'ST1011');
    unchanged((t) => t.$.orders.changeId(1, 2), 'ST1010');
    unchanged((t) => t.$.orders.setAll([{ id: 1, name: 'x', qty: 0 }, { id: 1, name: 'y', qty: 0 }]), 'ST1010');
  });

  it('allows key changes that swap within one call', () => {
    const { $ } = make();
    $.orders.updateMany([{ id: 1, changes: { id: 2 } }, { id: 2, changes: { id: 1 } }]);
    expect($.orders.all().map((r) => [r.id, r.name])).toEqual([[2, 'a'], [1, 'b'], [3, 'c']]);
  });

  it('[V4][V5] refuses null keys, class-instance rows naming their key, and bad payloads', () => {
    class OrderRow {
      id = 5;
    }
    unchanged((t) => t.$.orders.addOne({ id: null as unknown as number, name: 'x', qty: 0 }), 'ST1012');
    unchanged((t) => t.$.orders.byId(null as unknown as number) ?? t.$.orders.updateOne(null as unknown as number, {}), 'ST1012');
    unchanged((t) => t.$.orders.changeId(1, undefined as unknown as number), 'ST1012');
    const tree = make();
    let refusal: unknown;
    try {
      tree.$.orders.addOne(new OrderRow() as unknown as Order);
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(SignalTreeRefusal);
    expect((refusal as SignalTreeRefusal).code).toBe('ST1013');
    expect((refusal as SignalTreeRefusal).key).toBe(5);
    unchanged((t) => t.$.orders.updateOne(1, 5 as never), 'ST1013');
    unchanged((t) => t.$.orders.addMany(5 as never), 'ST1013');
    unchanged((t) => t.$.orders.updateMany(5 as never), 'ST1013');
    unchanged((t) => t.$.orders.removeMany(5 as never), 'ST1013');
    expect(codeOf(() => entityMap({ selectId: 5 as never }))).toBe('ST1006');
  });
});

describe('keys and selectors', () => {
  it('[V4] keeps 1 and "1" apart (V4)', () => {
    const tree = signalTree({ items: entityMap<{ id: number | string; v: string }, number | string>() });
    tree.$.items.addMany([{ id: 1, v: 'number' }, { id: '1', v: 'string' }]);
    expect(tree.$.items.byId(1)!.get()!.v).toBe('number');
    expect(tree.$.items.byId('1')!.get()!.v).toBe('string');
    expect(tree.$.items.count()).toBe(2);
  });

  it('[E1] uses a custom selector, where an update to the selected fields is a key change; changeId is unavailable', () => {
    const tree = signalTree({ people: entityMap<{ first: string; last: string; age: number }, string>({ selectId: (p) => `${p.first} ${p.last}` }) });
    tree.$.people.addOne({ first: 'Ada', last: 'Lovelace', age: 36 });
    const ada = tree.$.people.byId('Ada Lovelace')!;
    tree.$.people.updateOne('Ada Lovelace', { last: 'King' });
    expect(tree.$.people.byId('Ada King')).toBe(ada);
    ada.age.set(37);
    expect(tree.$.people.byId('Ada King')!.get()!.age).toBe(37);
    expect(codeOf(() => tree.$.people.changeId('Ada King', 'x'))).toBe('ST1014');
  });

  it('[V5] copies rows from the initial state when the tree first reads them (#95)', () => {
    const initial = rows();
    const tree = make(initial);
    tree.$.orders.count();
    initial[0]!.name = 'mutated';
    expect(tree.$.orders.byId(1)!.get()!.name).toBe('a');
  });
});

describe('collections in the tree', () => {
  it('[V1][E4] a whole-value parent write sets the rows, or makes the collection absent', () => {
    const tree = signalTree({ shop: { orders: entityMap<Order, number>({ rows: rows() }), open: true } as Record<string, unknown> });
    const shop = tree.$.shop as unknown as { set(v: unknown): void; get(): Record<string, unknown>; orders: { ids(): number[]; addOne(r: Order): void; count(): number } };
    const orders = shop.orders;
    shop.set({ orders: [{ id: 5, name: 'e', qty: 5 }], open: false });
    expect(orders.ids()).toEqual([5]);
    shop.set({ open: true });
    expect(orders.count()).toBe(0);
    expect(shop.get()).toEqual({ open: true });
    expect(codeOf(() => orders.addOne({ id: 1, name: 'a', qty: 1 }))).toBe('ST1004');
    shop.set({ orders: [{ id: 1, name: 'a', qty: 1 }], open: true });
    expect(orders.ids()).toEqual([1]);
  });

  it('[E3][V1] a whole-value write with a bad collection value refuses before anything changes', () => {
    const tree = signalTree({ shop: { orders: entityMap<Order, number>({ rows: rows() }), open: true } as Record<string, unknown> });
    const shop = tree.$.shop as unknown as { set(v: unknown): void; get(): unknown; orders: { count(): number } };
    shop.orders.count();
    expect(codeOf(() => shop.set({ orders: 'nope', open: false }))).toBe('ST1013');
    expect(codeOf(() => shop.set({ orders: [{ id: 1 }, { id: 1 }], open: false }))).toBe('ST1010');
    expect((shop.get() as { open: boolean }).open).toBe(true);
    expect(shop.orders.count()).toBe(3);
  });

  it('[T13] a turn that throws reverts every collection call in it (T13)', () => {
    const tree = make();
    const row = tree.$.orders.byId(1)!;
    const before = tree.$.get();
    expect(() =>
      tree.turn(() => {
        tree.$.orders.updateOne(1, { qty: 9 });
        tree.$.orders.changeId(1, 10);
        tree.$.orders.removeOne(2);
        tree.$.orders.addOne({ id: 4, name: 'd', qty: 4 });
        tree.$.orders.setAll([{ id: 4, name: 'd', qty: 4 }, { id: 3, name: 'c', qty: 3 }, { id: 10, name: 'a', qty: 1 }]);
        throw new Error('undo');
      }),
    ).toThrow('undo');
    expect(tree.$.get()).toEqual(before);
    expect(tree.$.orders.ids()).toEqual([1, 2, 3]);
    expect(tree.$.orders.byId(1)).toBe(row);
    expect(row.qty.get()).toBe(1);
    expect(row.id.get()).toBe(1);
  });

  it('[T13][V1] a turn that throws reverts a whole-value write that made a collection absent', () => {
    const tree = signalTree({ shop: { orders: entityMap<Order, number>({ rows: rows() }) } as Record<string, unknown> });
    const shop = tree.$.shop as unknown as { set(v: unknown): void; orders: { ids(): number[] } };
    shop.orders.ids();
    expect(() =>
      tree.turn(() => {
        shop.set({});
        throw new Error('undo');
      }),
    ).toThrow('undo');
    expect(shop.orders.ids()).toEqual([1, 2, 3]);
  });

  it('[W1][4.3] collection calls in a scope go through interceptors and reach observers with row and field effects', () => {
    const listener = vi.fn<ObserveListener>();
    const kinds: string[] = [];
    const tree = signalTree({ orders: entityMap<Order, number>({ rows: rows() }) }, {
      plugins: [probe((s) => {
        s.observe(listener);
        s.intercept({ name: 'kinds', intercept: (op, next) => (kinds.push(`${op.kind}:${op.location.join('.')}`), next(op)) });
      })],
    });
    tree.as({ writer: 'agent:x', origin: 'agent' }, () => tree.$.orders.updateOne(1, { qty: 5, name: 'a' }));
    tree.$.orders.addOne({ id: 4, name: 'd', qty: 4 });
    tree.$.orders.removeOne(2);
    tree.$.orders.changeId(3, 30);
    tree.$.orders.byId(4)!.qty.set(40);
    tree.$.orders.updateOne(1, { qty: 5 });
    expect(kinds).toEqual(['update:orders', 'insert:orders', 'remove:orders', 'changeId:orders', 'update:orders', 'update:orders']);
    const calls = listener.mock.calls.map(([effects]) => effects.map((e) => [e.location.join('.'), e.before, e.after]));
    expect(calls[0]).toEqual([['orders.1.qty', 1, 5]]);
    expect(listener.mock.calls[0]![0][0]!.context.writer).toBe('agent:x');
    expect(calls[1]).toEqual([['orders.4', undefined, { id: 4, name: 'd', qty: 4 }]]);
    expect(calls[2]).toEqual([['orders.2', { id: 2, name: 'b', qty: 2 }, undefined]]);
    expect(calls[3]!.map((c) => c[0])).toEqual(['orders.3', 'orders.30', 'orders.30.id']);
    expect(calls[4]).toEqual([['orders.4.qty', 4, 40]]);
    expect(listener).toHaveBeenCalledTimes(5);
  });

  it('[4.3][E3] an interceptor may refuse a collection call, which then changes nothing', () => {
    const tree = signalTree({ orders: entityMap<Order, number>({ rows: rows() }) }, {
      plugins: [probe((s) => s.intercept({ name: 'no', intercept: () => {
        throw new SignalTreeRefusal('ST1004', { detail: 'read-only' });
      } }))],
    });
    expect(codeOf(() => tree.$.orders.addOne({ id: 9, name: 'x', qty: 0 }))).toBe('ST1004');
    expect(tree.$.orders.count()).toBe(3);
  });

  it('[D1] collection reads and writes throw after destroy', () => {
    const tree = make();
    const orders = tree.$.orders;
    const qty = orders.byId(1)!.qty;
    tree.destroy();
    expect(codeOf(() => orders.all())).toBe('ST1003');
    expect(codeOf(() => orders.addOne({ id: 9, name: 'x', qty: 0 }))).toBe('ST1003');
    expect(codeOf(() => qty.get())).toBe('ST1003');
    expect(codeOf(() => qty.set(2))).toBe('ST1003');
  });
});
