import { describe, expect, it, vi } from 'vitest';
import { PlainCell, SignalTreeError, createPlainAdapter, createSignalTreeFactory, leaf, signalTree } from '@signal-tree/core';

describe('structure and reads', () => {
  it('reads leaves through plain cells and branches as frozen snapshots', () => {
    const tree = signalTree({ user: { name: 'Ada', age: 36 }, count: 1 });
    expect(tree.$.count).toBeInstanceOf(PlainCell);
    expect(tree.$.count.get()).toBe(1);
    expect(tree.$.user.name.get()).toBe('Ada');
    const snap = tree.$.user.get();
    expect(snap).toEqual({ name: 'Ada', age: 36 });
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it('returns the same handle for the same path', () => {
    const tree = signalTree({ a: { b: 1 } });
    expect(tree.$.a).toBe(tree.$.a);
    expect(tree.$.a.b).toBe(tree.$.a.b);
  });

  it('never mutates or freezes the initial state', () => {
    const state = { a: { b: 1, list: [1, 2] }, c: 2 };
    const tree = signalTree(state);
    tree.$.a.b.set(5);
    tree.$.c.set(9);
    tree.$.a.set({ b: 7, list: [3] });
    expect(state).toEqual({ a: { b: 1, list: [1, 2] }, c: 2 });
    expect(Object.isFrozen(state.a)).toBe(false);
  });

  it('copies an array leaf from the initial state when the tree first reads it (#95)', () => {
    const list = [1, 2];
    const tree = signalTree({ list });
    tree.$.list.get();
    list.push(3);
    expect(tree.$.list.get()).toEqual([1, 2]);
  });

  it('treats members named like methods as members', () => {
    const tree = signalTree({ form: { set: 1, get: 2 } });
    expect(tree.$.form.set.get()).toBe(1);
    expect(tree.$.form.get.get()).toBe(2);
  });

  it('answers then and unknown symbols with undefined, so handles are not thenables', () => {
    const tree = signalTree({ a: { b: 1 } });
    expect((tree.$.a as unknown as Record<string, unknown>)['then']).toBeUndefined();
    expect((tree.$.a as unknown as Record<symbol, unknown>)[Symbol.toPrimitive]).toBeUndefined();
    expect('b' in tree.$.a).toBe(true);
    expect('z' in tree.$.a).toBe(false);
  });

  it('refuses assignment to a handle property', () => {
    const tree = signalTree({ a: { b: 1 } });
    expect(() => {
      (tree.$.a as unknown as Record<string, unknown>)['b'] = 2;
    }).toThrow(SignalTreeError);
  });

  it('refuses a non-object initial state', () => {
    expect(() => signalTree(5 as unknown as object)).toThrow(/ST1001/);
    expect(() => signalTree([] as unknown as object)).toThrow(/ST1001/);
  });
});

describe('leaf writes', () => {
  it('writes through the cell and notifies subscribers', () => {
    const tree = signalTree({ a: { b: 1 } });
    const seen: number[] = [];
    tree.$.a.b.subscribe(() => seen.push(tree.$.a.b.get()));
    tree.$.a.b.set(2);
    tree.$.a.b.update((n) => n + 1);
    expect(seen).toEqual([2, 3]);
  });

  it('skips a write of the same value', () => {
    const tree = signalTree({ a: 1 });
    const runs = vi.fn();
    tree.$.a.subscribe(runs);
    tree.$.a.set(1);
    expect(runs).not.toHaveBeenCalled();
  });

  it('copies plain objects and arrays a write supplies', () => {
    const tree = signalTree({ list: [0] as number[], meta: leaf({ x: 1 }) });
    const input = [1, 2];
    tree.$.list.set(input);
    input.push(3);
    expect(tree.$.list.get()).toEqual([1, 2]);
  });

  it('keeps opaque values by identity', () => {
    const date = new Date(0);
    const map = new Map([[1, 2]]);
    const fn = () => 1;
    const marked = { not: 'a branch' };
    const tree = signalTree({ date, map, fn, marked: leaf(marked) });
    expect(tree.$.date.get()).toBe(date);
    expect(tree.$.map.get()).toBe(map);
    expect(tree.$.fn.get()).toBe(fn);
    expect(tree.$.marked.get()).toBe(marked);
    const next = new Date(1);
    tree.$.date.set(next);
    expect(tree.$.date.get()).toBe(next);
    expect(tree.$.marked).toBeInstanceOf(PlainCell);
  });

  it('unwraps leaf() when it is written', () => {
    const tree = signalTree({ meta: leaf({ x: 1 }) as unknown });
    const value = { y: 2 };
    tree.$.meta.set(leaf(value));
    expect(tree.$.meta.get()).toBe(value);
  });
});

describe('whole-value branch writes', () => {
  it('makes the members exactly the written keys', () => {
    const tree = signalTree({ user: { name: 'Ada', age: 36 } as Record<string, unknown> });
    const age = tree.$.user['age']!;
    tree.$.user.set({ name: 'Grace', role: 'admiral' });
    expect(tree.$.user.get()).toEqual({ name: 'Grace', role: 'admiral' });
    expect('age' in tree.$.user.get()).toBe(false);
    expect(age.get()).toBeUndefined();
    expect(tree.$.user['role']!.get()).toBe('admiral');
  });

  it('notifies each changed leaf once and leaves unchanged leaves alone', () => {
    const tree = signalTree({ user: { name: 'Ada', age: 36 } });
    const name = vi.fn();
    const age = vi.fn();
    tree.$.user.name.subscribe(name);
    tree.$.user.age.subscribe(age);
    tree.$.user.set({ name: 'Grace', age: 36 });
    expect(name).toHaveBeenCalledTimes(1);
    expect(age).not.toHaveBeenCalled();
  });

  it('updates a branch from its snapshot', () => {
    const tree = signalTree({ counter: { n: 1 } });
    tree.$.counter.update((c) => ({ n: c.n + 1 }));
    expect(tree.$.counter.n.get()).toBe(2);
    expect(() => tree.$.counter.update(5 as never)).toThrow(/ST1006/);
  });

  it('re-adds only its own path when written beneath an absent member', () => {
    const tree = signalTree({ a: { b: { c: 1, d: 2 } } as Record<string, unknown> });
    const a = tree.$.a as unknown as { set(v: unknown): void; b: { c: PlainCell<number>; d: PlainCell<number> } };
    const c = a.b.c;
    const d = a.b.d;
    a.set({});
    expect(c.get()).toBeUndefined();
    c.set(5);
    expect(tree.$.a.get()).toEqual({ b: { c: 5 } });
    expect(d.get()).toBeUndefined();
  });

  it('holds a non-plain value written over a branch, and re-adds members written beneath it', () => {
    const tree = signalTree({ a: { b: 1 } as { b: number } | null });
    const handle = tree.$.a as unknown as { set(v: unknown): void; get(): unknown; b: PlainCell<number> };
    const b = handle.b;
    handle.set(null);
    expect(handle.get()).toBeNull();
    expect(b.get()).toBeUndefined();
    expect('b' in (handle as object)).toBe(false);
    b.set(3);
    expect(handle.get()).toEqual({ b: 3 });
  });

  it('copies and checks the whole value before changing anything', () => {
    const tree = signalTree({ a: { x: 1, y: 2 } as Record<string, unknown> });
    const bad = JSON.parse('{"x": 5, "y": {"__proto__": {"polluted": true}}}');
    expect(() => tree.$.a.set(bad)).toThrow(/ST1002/);
    expect(tree.$.a.get()).toEqual({ x: 1, y: 2 });
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('refuses a cell or handle written as a value', () => {
    const tree = signalTree({ a: { b: 1 }, c: 0 as unknown });
    expect(() => tree.$.c.set(tree.$.a)).toThrow(/ST1001/);
    expect(() => tree.$.c.set(tree.$.a.b)).toThrow(/ST1001/);
  });

  it('copies the written value, keeping symbol keys and non-enumerable fields, reading getters once', () => {
    const tree = signalTree({ a: {} as Record<PropertyKey, unknown>, opaque: 0 as unknown });
    const sym = Symbol('s');
    let reads = 0;
    const input: Record<PropertyKey, unknown> = { [sym]: 1, get g() {
      reads++;
      return 2;
    } };
    Object.defineProperty(input, 'hidden', { value: 3, enumerable: false });
    tree.$.opaque.set(input);
    const stored = tree.$.opaque.get() as Record<PropertyKey, unknown>;
    expect(stored === input).toBe(false);
    expect(stored[sym]).toBe(1);
    expect(stored['g']).toBe(2);
    expect(stored['hidden']).toBe(3);
    expect(reads).toBe(1);
  });
});

describe('snapshots', () => {
  it('keeps the reference of an unchanged subtree and replaces a changed one', () => {
    const tree = signalTree({ a: { x: 1 }, b: { y: [1, 2] }, c: { z: 1 } });
    tree.$.c.z.get();
    const first = tree.$.get();
    tree.$.a.x.set(2);
    const second = tree.$.get();
    expect(second).not.toBe(first);
    expect(second.a).not.toBe(first.a);
    expect(second.b).toBe(first.b);
    expect(second.c).toBe(first.c);
    expect(Object.isFrozen(second.b.y)).toBe(true);
  });

  it('is not an object live state holds', () => {
    const tree = signalTree({ list: [1, 2], meta: { tags: ['a'] } });
    const snap = tree.$.get();
    expect(snap.list).not.toBe(tree.$.list.get());
    expect(Object.isFrozen(snap.list)).toBe(true);
    expect(Object.isFrozen(tree.$.list.get())).toBe(false);
  });

  it('keeps user symbol keys and stays fresh for branches read after it', () => {
    const sym = Symbol('k');
    const tree = signalTree({ a: { [sym]: 1, b: { c: 1 } } });
    const first = tree.$.get();
    expect((first.a as Record<symbol, unknown>)[sym]).toBe(1);
    tree.$.a.b.c.set(2);
    expect(tree.$.get().a.b.c).toBe(2);
  });
});

describe('turns', () => {
  it('applies each write immediately and notifies once after the turn', () => {
    const tree = signalTree({ a: 1, b: 1 });
    const seen: string[] = [];
    tree.$.a.subscribe(() => seen.push(`a${tree.$.a.get()}`));
    const result = tree.turn(() => {
      tree.$.a.set(2);
      expect(tree.$.a.get()).toBe(2);
      tree.$.a.set(3);
      tree.$.b.set(2);
      return 'done';
    });
    expect(result).toBe('done');
    expect(seen).toEqual(['a3']);
  });

  it('reverts every write and publishes nothing when the turn throws', () => {
    const tree = signalTree({ a: 1, user: { name: 'Ada', age: 1 } as Record<string, unknown> });
    const runs = vi.fn();
    tree.$.a.subscribe(runs);
    const before = tree.$.get();
    expect(() =>
      tree.turn(() => {
        tree.$.a.set(2);
        tree.$.user.set({ name: 'Grace' });
        tree.$.user['extra']!.set(1);
        throw new Error('stop');
      }),
    ).toThrow('stop');
    expect(tree.$.get()).toEqual(before);
    expect(tree.$.user['age']!.get()).toBe(1);
    expect(runs).not.toHaveBeenCalled();
  });

  it('reverts only an inner turn that throws when the outer turn catches it', () => {
    const tree = signalTree({ a: 1, b: 1 });
    tree.turn(() => {
      tree.$.a.set(2);
      try {
        tree.turn(() => {
          tree.$.b.set(2);
          throw new Error('inner');
        });
      } catch {
        // the outer turn goes on
      }
    });
    expect(tree.$.a.get()).toBe(2);
    expect(tree.$.b.get()).toBe(1);
  });

  it('refuses a turn without a function', () => {
    const tree = signalTree({ a: 1 });
    expect(() => tree.turn(5 as never)).toThrow(/ST1006/);
  });
});

describe('construction input', () => {
  it('refuses a __proto__ key, naming its path, when the tree reads into it', () => {
    const state = JSON.parse('{"a": {"__proto__": {"x": 1}}}');
    const tree = signalTree(state);
    expect(() => (tree.$ as unknown as Record<string, unknown>)['a']).toThrow(/ST1002.*"a" > "__proto__"/);
    expect(() => signalTree(JSON.parse('{"__proto__": 1}'))).toThrow(/ST1002/);
  });

  it('refuses a handle or cell of another tree in the initial state', () => {
    const other = signalTree({ x: { y: 1 } });
    expect(() => signalTree({ h: other.$.x })).toThrow(/ST1001/);
    expect(() => signalTree({ c: other.$.x.y })).toThrow(/ST1001/);
  });

  it('keeps literal dotted and empty keys apart from nested paths', () => {
    const tree = signalTree({ 'a.b': 1, a: { b: 2 }, '': 3 } as Record<string, unknown>);
    const root = tree.$ as unknown as Record<string, PlainCell<number>> & { a: { b: PlainCell<number> } };
    expect(root['a.b']!.get()).toBe(1);
    expect(root.a.b.get()).toBe(2);
    expect(root['']!.get()).toBe(3);
  });
});

describe('trees and adapters', () => {
  it('shares nothing between two trees', () => {
    const one = signalTree({ a: 1 });
    const two = signalTree({ a: 1 });
    const runs = vi.fn();
    two.$.a.subscribe(runs);
    one.$.a.set(5);
    expect(two.$.a.get()).toBe(1);
    expect(runs).not.toHaveBeenCalled();
  });

  it('builds on the factory adapter, or on a per-call adapter', () => {
    const shared = createPlainAdapter();
    const factory = createSignalTreeFactory(shared);
    const createCell = vi.spyOn(shared, 'createCell');
    const tree = factory({ a: 1 });
    tree.$.a.set(2);
    expect(createCell).toHaveBeenCalledTimes(1);
    expect(shared.peek(tree.$.a)).toBe(2);
    const own = createPlainAdapter();
    const ownCreate = vi.spyOn(own, 'createCell');
    const other = factory({ a: 1 }, { adapter: own });
    other.$.a.set(3);
    expect(ownCreate).toHaveBeenCalledTimes(1);
    expect(createCell).toHaveBeenCalledTimes(1);
    expect(signalTree({ a: 1 }, { adapter: own }).$.a.get()).toBe(1);
  });

  it('commits through a non-plain adapter for every write path', () => {
    const inner = createPlainAdapter();
    const adapter = {
      tag: 'wrapped' as const,
      createCell: (initial: unknown, route: never) => inner.createCell(initial, route),
      commit: vi.fn((cell: never, value: unknown) => inner.commit(cell, value)),
      peek: (cell: never) => inner.peek(cell),
      batch: (fn: () => void) => inner.batch(fn),
    };
    const tree = signalTree({ a: 1, b: { c: 1 } as Record<string, unknown> }, { adapter: adapter as never });
    const root = tree.$ as unknown as { a: PlainCell<number>; b: { set(v: unknown): void; get(): unknown } };
    root.a.set(1);
    expect(adapter.commit).not.toHaveBeenCalled();
    root.a.set(2);
    root.a.set({ x: 1 } as never);
    root.b.set({ c: 2 });
    tree.turn(() => root.a.set(5));
    expect(adapter.commit).toHaveBeenCalledTimes(3);
    expect(root.b.get()).toEqual({ c: 2 });
    expect(inner.peek(root.a)).toBe(5);
  });

  it('throws a typed error for reads and writes after destroy', () => {
    const tree = signalTree({ a: { b: 1 } });
    const b = tree.$.a.b;
    const a = tree.$.a;
    tree.destroy();
    tree.destroy();
    expect(() => b.get()).toThrow(/ST1003/);
    expect(() => b.set(2)).toThrow(/ST1003/);
    expect(() => a.get()).toThrow(/ST1003/);
    expect(() => tree.$.a).toThrow(/ST1003/);
    expect(() => tree.turn(() => 1)).toThrow(/ST1003/);
  });

  it('behaves the same at any depth', () => {
    let state: Record<string, unknown> = { leaf: 0 };
    for (let i = 0; i < 200; i++) state = { next: state };
    const tree = signalTree(state);
    let node = tree.$ as unknown as Record<string, unknown>;
    for (let i = 0; i < 200; i++) node = node['next'] as Record<string, unknown>;
    const cell = node['leaf'] as PlainCell<number>;
    cell.set(7);
    let snap = tree.$.get() as Record<string, unknown>;
    for (let i = 0; i < 200; i++) snap = snap['next'] as Record<string, unknown>;
    expect(snap['leaf']).toBe(7);
  });
});
