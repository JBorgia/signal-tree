/**
 * Spec tests for the tree's structure and values: BRIEF.md 12.5 rows V1–V7,
 * H2 and X5. Written from the spec; each title carries the row it proves.
 */
import { describe, expect, it } from 'vitest';
import { PlainCell, SignalTreeError, entityMap, leaf, signalTree } from '@signal-tree/core';

type Loose = Record<PropertyKey, unknown>;
const loose = (handle: unknown) => handle as Loose & { get(): unknown; set(v: unknown): void; update(fn: (v: unknown) => unknown): void };

describe('membership by whole-value write', () => {
  it('[V1] makes a branch’s members exactly the written value’s own keys', () => {
    const tree = signalTree({ user: { name: 'Ada', age: 36, role: 'eng' } as Loose });
    const user = loose(tree.$.user);
    user.set({ name: 'Grace', title: 'admiral' });
    expect(user.get()).toEqual({ name: 'Grace', title: 'admiral' });
    expect(Object.keys(user.get() as object)).toEqual(['name', 'title']);
    expect(loose(user['title']).get()).toBe('admiral');
  });

  it('[V1] an omitted member is absent, not present with undefined, on every read path', () => {
    const tree = signalTree({ user: { name: 'Ada', age: 36 } as Loose });
    const user = loose(tree.$.user);
    const age = user['age'] as PlainCell<unknown>;
    user.set({ name: 'Ada' });
    expect(age.get()).toBeUndefined();
    expect('age' in (user.get() as object)).toBe(false);
    expect('age' in (tree.$.get() as { user: object }).user).toBe(false);
    expect('age' in user).toBe(false);
  });

  it('[V1] a write beneath an absent member re-adds only its own path', () => {
    const tree = signalTree({ a: { b: { c: 1, d: 2 }, e: 3 } as Loose });
    const a = loose(tree.$.a);
    const c = loose(a['b'])['c'] as PlainCell<number>;
    a.set({});
    c.set(5);
    expect(a.get()).toEqual({ b: { c: 5 } });
  });

  it('[V1] an updater on an absent member receives undefined', () => {
    const tree = signalTree({ a: { x: 1 } as Loose });
    const a = loose(tree.$.a);
    const x = a['x'] as PlainCell<number | undefined>;
    a.set({});
    let received: unknown = 'not called';
    x.update((value) => {
      received = value;
      return 2;
    });
    expect(received).toBeUndefined();
    expect(a.get()).toEqual({ x: 2 });
  });

  it('[V1] a write that names a row of an absent collection refuses with a typed error', () => {
    const tree = signalTree({ shop: { orders: entityMap<{ id: number }, number>({ rows: [{ id: 1 }] }) } as Loose });
    const shop = loose(tree.$.shop);
    const orders = shop['orders'] as { addOne(r: unknown): void; updateOne(id: number, c: unknown): void; count(): number };
    orders.count();
    shop.set({});
    expect(() => orders.addOne({ id: 2 })).toThrow(SignalTreeError);
    expect(() => orders.updateOne(1, {})).toThrow(SignalTreeError);
    expect((shop.get() as Loose)['orders']).toBeUndefined();
  });

  it('[V1] a turn that throws restores absence and presence exactly', () => {
    const tree = signalTree({ a: { x: 1, y: 2 } as Loose });
    const a = loose(tree.$.a);
    const before = a.get();
    expect(() =>
      tree.turn(() => {
        a.set({ x: 1, z: 3 });
        throw new Error('stop');
      }),
    ).toThrow('stop');
    expect(a.get()).toEqual(before);
    expect('z' in (a.get() as object)).toBe(false);
  });
});

describe('opaque values', () => {
  it('[V2] class instances, built-ins, functions and leaf() values are single locations stored by identity', () => {
    class Money {
      constructor(readonly cents: number) {}
    }
    const values = { money: new Money(5), date: new Date(0), map: new Map([[1, 1]]), set: new Set([1]), re: /x/g, bytes: new Uint8Array([1]), fn: () => 1 };
    const marked = { looks: 'like a branch' };
    const tree = signalTree({ ...values, marked: leaf(marked) });
    for (const [key, value] of Object.entries(values)) {
      const handle = (tree.$ as unknown as Loose)[key];
      expect(handle).toBeInstanceOf(PlainCell);
      expect((handle as PlainCell<unknown>).get()).toBe(value);
    }
    expect(tree.$.marked.get()).toBe(marked);
    expect(tree.$.marked).toBeInstanceOf(PlainCell);
  });

  it('[V2] opaque values are never walked into, copied or invoked, and are written and compared as a whole', () => {
    let calls = 0;
    const fn = () => {
      calls++;
      return 1;
    };
    const date = new Date(0);
    const tree = signalTree({ fn, date });
    const seen: unknown[] = [];
    tree.$.date.subscribe(() => seen.push(tree.$.date.get()));
    tree.$.date.set(date);
    const next = new Date(0);
    tree.$.date.set(next);
    expect(seen).toEqual([next]);
    expect(seen[0]).toBe(next);
    expect(tree.$.get().fn).toBe(fn);
    expect(calls).toBe(0);
  });

  it('[V2] snapshots and turn reverts keep opaque values by identity', () => {
    const map = new Map();
    const tree = signalTree({ m: map as Map<unknown, unknown> });
    expect(tree.$.get().m).toBe(map);
    expect(() =>
      tree.turn(() => {
        tree.$.m.set(new Map());
        throw new Error('stop');
      }),
    ).toThrow('stop');
    expect(tree.$.m.get()).toBe(map);
  });
});

describe('construction input', () => {
  it('[V3] a cell or handle belonging to another tree refuses with a typed error naming its path (#95: when the tree first reads it)', () => {
    const other = signalTree({ x: { y: 1 } });
    let error: unknown;
    try {
      signalTree({ inner: { stolen: other.$.x } });
      const tree = signalTree({ inner: { stolen: other.$.x.y } });
      void (tree.$ as unknown as Loose)['inner'];
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(SignalTreeError);
    expect((error as SignalTreeError).path).toEqual(['inner', 'stolen']);
    expect(() => signalTree({ h: other.$.x })).toThrow(SignalTreeError);
  });

  it('[V3] a non-object initial state refuses with a typed error', () => {
    for (const state of [1, 'x', null, [], new Date()]) expect(() => signalTree(state as never)).toThrow(SignalTreeError);
  });
});

describe('key identity', () => {
  it('[V4] a literal key containing "." or "@", or the empty key, is its own location', () => {
    const tree = signalTree({ 'a.b': 1, a: { b: 2 }, 'x@y': 3, x: { y: 4 }, '': 5 } as Loose);
    const root = loose(tree.$);
    expect((root['a.b'] as PlainCell<number>).get()).toBe(1);
    expect((loose(root['a'])['b'] as PlainCell<number>).get()).toBe(2);
    expect((root['x@y'] as PlainCell<number>).get()).toBe(3);
    expect((root[''] as PlainCell<number>).get()).toBe(5);
    (root['a.b'] as PlainCell<number>).set(10);
    expect(tree.$.get()).toEqual({ 'a.b': 10, a: { b: 2 }, 'x@y': 3, x: { y: 4 }, '': 5 });
  });

  it('[V4] entity keys keep their type, so 1 and "1" are different rows, through writes and reverts', () => {
    const tree = signalTree({ rows: entityMap<{ id: number | string; v: string }, number | string>() });
    tree.$.rows.addMany([{ id: 1, v: 'n' }, { id: '1', v: 's' }]);
    tree.$.rows.updateOne('1', { v: 'S' });
    expect(tree.$.rows.byId(1)!.get()!.v).toBe('n');
    expect(tree.$.rows.ids()).toEqual([1, '1']);
    expect(() =>
      tree.turn(() => {
        tree.$.rows.removeOne(1);
        throw new Error('stop');
      }),
    ).toThrow('stop');
    expect(tree.$.rows.ids()).toEqual([1, '1']);
    expect(typeof tree.$.rows.ids()[0]).toBe('number');
  });

  it('[V4] a null or undefined entity key refuses with a typed error', () => {
    const tree = signalTree({ rows: entityMap<{ id: number | null | undefined }, number>() });
    expect(() => tree.$.rows.addOne({ id: null })).toThrow(SignalTreeError);
    expect(() => tree.$.rows.addOne({ id: undefined })).toThrow(SignalTreeError);
    expect(tree.$.rows.count()).toBe(0);
  });
});

describe('caller input is never owned', () => {
  it('[V5] after a write the caller may mutate its input without changing tree state', () => {
    const tree = signalTree({ list: [] as number[], meta: { tags: [] as string[] }, rows: entityMap<{ id: number; v: { n: number } }, number>() });
    const list = [1, 2];
    const meta = { tags: ['a'] };
    const row = { id: 1, v: { n: 1 } };
    tree.$.list.set(list);
    tree.$.meta.set(meta);
    tree.$.rows.addOne(row);
    list.push(3);
    meta.tags.push('b');
    row.v.n = 99;
    expect(tree.$.get().list).toEqual([1, 2]);
    expect(tree.$.get().meta).toEqual({ tags: ['a'] });
    expect(tree.$.rows.byId(1)!.get()!.v.n).toBe(1);
  });

  it('[V5] the tree never freezes or mutates caller input', () => {
    const input = { a: { b: 1 } };
    const tree = signalTree({ x: {} as Loose });
    tree.$.x.set(input);
    tree.$.get();
    expect(loose(loose(tree.$.x)['a'])['b']).toBeDefined();
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.a)).toBe(false);
    expect(input).toEqual({ a: { b: 1 } });
  });

  it('[V5] a stored row keeps its symbol keys and non-enumerable fields', () => {
    const tag = Symbol('tag');
    const row: Loose = { id: 1, [tag]: 'kept' };
    Object.defineProperty(row, 'hidden', { value: 'also kept', enumerable: false });
    const tree = signalTree({ rows: entityMap<Loose, number>() });
    tree.$.rows.addOne(row);
    const snap = tree.$.rows.byId(1)!.get() as Loose;
    expect(snap[tag]).toBe('kept');
    expect(snap['hidden']).toBe('also kept');
  });

  it('[V5] a class-instance row refuses with a typed error naming its key', () => {
    class Row {
      id = 7;
    }
    const tree = signalTree({ rows: entityMap<{ id: number }, number>() });
    let error: unknown;
    try {
      tree.$.rows.addOne(new Row());
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(SignalTreeError);
    expect((error as SignalTreeError).key).toBe(7);
    expect(tree.$.rows.count()).toBe(0);
  });

  it('[V5] opaque values stay stored by identity', () => {
    const date = new Date(0);
    const tree = signalTree({ rows: entityMap<{ id: number; at: Date }, number>(), at: null as Date | null });
    tree.$.rows.addOne({ id: 1, at: date });
    tree.$.at.set(date);
    expect(tree.$.rows.byId(1)!.get()!.at).toBe(date);
    expect(tree.$.at.get()).toBe(date);
  });
});

describe('stable handles', () => {
  it('[V6] reading the same path returns the same handle every time, before and after whole-value writes that remove and re-add it', () => {
    const tree = signalTree({ a: { b: { c: 1 } } as Loose });
    const a = loose(tree.$.a);
    const b = a['b'];
    const c = loose(b)['c'];
    a.set({});
    expect(a['b']).toBe(b);
    expect(loose(a['b'])['c']).toBe(c);
    a.set({ b: { c: 2 } });
    expect(a['b']).toBe(b);
    expect(loose(b)['c']).toBe(c);
    expect((c as PlainCell<number>).get()).toBe(2);
  });

  it('[V6] the same handle inside and outside turns, always reading the current value', () => {
    const tree = signalTree({ a: { b: 1 } });
    const outside = tree.$.a.b;
    tree.turn(() => {
      expect(tree.$.a.b).toBe(outside);
      tree.$.a.b.set(2);
      expect(outside.get()).toBe(2);
    });
    expect(tree.$.a.b).toBe(outside);
    expect(outside.get()).toBe(2);
  });
});

describe('depth and size', () => {
  const deep = (depth: number) => {
    let state: Loose = { leaf: 0 };
    for (let i = 0; i < depth; i++) state = { next: state };
    return state;
  };
  const walk = (start: unknown, depth: number) => {
    let node = start as Loose;
    for (let i = 0; i < depth; i++) node = node['next'] as Loose;
    return node;
  };

  it('[V7] writes, observation, turn reverts and snapshots behave the same at any depth', () => {
    const depth = 2_000;
    const tree = signalTree(deep(depth));
    const cell = walk(tree.$, depth)['leaf'] as PlainCell<number>;
    const seen: number[] = [];
    cell.subscribe(() => seen.push(cell.get()));
    cell.set(1);
    expect(() =>
      tree.turn(() => {
        cell.set(2);
        throw new Error('stop');
      }),
    ).toThrow('stop');
    expect(cell.get()).toBe(1);
    expect(walk(tree.$.get(), depth)['leaf']).toBe(1);
    expect(seen).toEqual([1]);
  });

  it('[V7] entity calls larger than the engine’s call-argument limit behave as small ones', () => {
    const size = 140_000;
    const rows = Array.from({ length: size }, (_, id) => ({ id, v: 0 }));
    const tree = signalTree({ rows: entityMap<{ id: number; v: number }, number>() });
    tree.$.rows.addMany(rows);
    expect(tree.$.rows.count()).toBe(size);
    tree.$.rows.updateMany(rows.map((r) => ({ id: r.id, changes: { v: 1 } })));
    expect(tree.$.rows.all()[size - 1]).toEqual({ id: size - 1, v: 1 });
    tree.$.rows.setAll(rows.slice().reverse());
    expect(tree.$.rows.ids()[0]).toBe(size - 1);
    expect(tree.$.get().rows).toHaveLength(size);
    expect(() =>
      tree.turn(() => {
        tree.$.rows.removeMany(rows.map((r) => r.id));
        throw new Error('stop');
      }),
    ).toThrow('stop');
    expect(tree.$.rows.count()).toBe(size);
  });
});

describe('snapshots', () => {
  it('[H2] a snapshot contains exactly the tree’s state, with no markers, internal references or brands', () => {
    const marked = { opaque: true };
    const tree = signalTree({ a: { b: 1 }, m: leaf(marked), rows: entityMap<{ id: number }, number>({ rows: [{ id: 1 }] }) });
    const snap = tree.$.get();
    expect(snap).toEqual({ a: { b: 1 }, m: marked, rows: [{ id: 1 }] });
    expect(Reflect.ownKeys(snap)).toEqual(['a', 'm', 'rows']);
    expect(Reflect.ownKeys(snap.a)).toEqual(['b']);
    expect(Array.isArray(snap.rows)).toBe(true);
  });

  it('[H2] its plain objects and arrays are frozen, never change after it is taken, and are not objects live state holds', () => {
    const tree = signalTree({ a: { list: [1] }, rows: entityMap<{ id: number; v: number }, number>({ rows: [{ id: 1, v: 1 }] }) });
    const snap = tree.$.get();
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.a)).toBe(true);
    expect(Object.isFrozen(snap.a.list)).toBe(true);
    expect(Object.isFrozen(snap.rows)).toBe(true);
    expect(Object.isFrozen(snap.rows[0])).toBe(true);
    expect(snap.a.list).not.toBe(tree.$.a.list.get());
    tree.$.a.list.set([2]);
    tree.$.rows.updateOne(1, { v: 2 });
    expect(snap.a.list).toEqual([1]);
    expect(snap.rows[0]!.v).toBe(1);
  });

  it('[H2] user symbol keys are kept, and opaque values appear by identity', () => {
    const sym = Symbol('user');
    const date = new Date(0);
    const tree = signalTree({ a: { [sym]: 'kept', at: date } });
    const snap = tree.$.get();
    expect((snap.a as Loose)[sym]).toBe('kept');
    expect(snap.a.at).toBe(date);
  });

  it('[H2] an unchanged subtree keeps its reference from one snapshot to the next; a changed one gets a new reference', () => {
    const tree = signalTree({ a: { x: 1 }, b: { y: { z: 1 } }, rows: entityMap<{ id: number; v: number }, number>({ rows: [{ id: 1, v: 1 }, { id: 2, v: 1 }] }) });
    const first = tree.$.get();
    tree.$.a.x.set(2);
    tree.$.rows.updateOne(1, { v: 2 });
    const second = tree.$.get();
    expect(second).not.toBe(first);
    expect(second.a).not.toBe(first.a);
    expect(second.b).toBe(first.b);
    expect(second.b.y).toBe(first.b.y);
    expect(second.rows).not.toBe(first.rows);
    expect(second.rows[1]).toBe(first.rows[1]);
    expect(tree.$.get()).toBe(second);
  });
});

describe('prototype safety', () => {
  const pristine = () => {
    expect(({} as Loose)['polluted']).toBeUndefined();
    expect(([] as unknown as Loose)['polluted']).toBeUndefined();
    expect((Function.prototype as unknown as Loose)['polluted']).toBeUndefined();
  };
  const proto = (value: string) => JSON.parse(`{"__proto__": ${value}}`);

  it('[X5] a "__proto__" key refuses with a typed error naming its path, from initial state, writes, updaters and rows', () => {
    const attempts: [string, () => unknown][] = [
      ['initial', () => signalTree(proto('{"polluted": 1}'))],
      ['nested initial', () => (signalTree({ a: proto('{"polluted": 1}') }).$ as unknown as Loose)['a']],
      ['write', () => signalTree({ a: {} as Loose }).$.a.set({ b: proto('{"polluted": 1}') })],
      ['updater', () => signalTree({ a: { b: 1 } as Loose }).$.a.update(() => proto('{"polluted": 1}'))],
      ['row', () => signalTree({ rows: entityMap<Loose, number>() }).$.rows.addOne({ id: 1, ...{}, v: proto('{"polluted": 1}') })],
      ['leaf value', () => signalTree({ v: null as unknown }).$.v.set({ deep: proto('{"polluted": 1}') })],
    ];
    for (const [name, attempt] of attempts) {
      let error: unknown;
      try {
        attempt();
      } catch (caught) {
        error = caught;
      }
      expect(error, name).toBeInstanceOf(SignalTreeError);
      expect((error as SignalTreeError).path?.at(-1), name).toBe('__proto__');
      pristine();
    }
  });

  it('[X5] keys named "constructor" or "prototype" are own data', () => {
    const tree = signalTree({ constructor: 1, prototype: { x: 2 } } as Loose);
    const root = loose(tree.$);
    expect((root['constructor'] as unknown as PlainCell<number>).get()).toBe(1);
    expect((loose(root['prototype'])['x'] as PlainCell<number>).get()).toBe(2);
    (root['constructor'] as unknown as PlainCell<number>).set(3);
    expect(tree.$.get()).toEqual({ constructor: 3, prototype: { x: 2 } });
    pristine();
  });

  it('[X5] inherited properties are never read as state', () => {
    const tree = signalTree({ a: { own: 1 } as Loose });
    expect((loose(tree.$)['toString'] as unknown as PlainCell<unknown>).get()).toBeUndefined();
    expect(Object.keys(tree.$.get())).toEqual(['a']);
    tree.$.a.set({ own: 2 });
    expect(Object.keys(tree.$.a.get())).toEqual(['own']);
    pristine();
  });
});
