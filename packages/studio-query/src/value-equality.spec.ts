import { describe, expect, it } from 'vitest';
import { compareTransportedValues as compare } from './value-equality';

describe('transported value comparison', () => {
  it('uses SameValue scalar semantics', () => {
    for (const value of [undefined, null, true, 7, 'hello', BigInt(2), NaN]) expect(compare(value, value)).toBe('equal');
    expect(compare(-0, 0)).toBe('different');
    expect(compare(2, '2')).toBe('different');
  });
  it('compares cloned data without depending on object key insertion order', () => {
    expect(compare({ a: 1, b: [2] }, { b: [2], a: 1 })).toBe('equal');
    expect(compare(Object.assign(Object.create(null), { a: 1 }), { a: 1 })).toBe('equal');
    expect(compare({ a: undefined }, {})).toBe('different');
  });
  it('preserves array length, holes and extra own properties', () => {
    expect(compare(Array(2), Array(2))).toBe('equal');
    expect(compare(Array(2), [undefined, undefined])).toBe('different');
    expect(compare([], Array(1))).toBe('different');
    expect(compare(Object.assign([1], { tag: 2 }), [1])).toBe('different');
  });
  it('compares Date timestamps including invalid dates', () => {
    expect(compare(new Date(1), new Date(1))).toBe('equal');
    expect(compare(new Date(1), new Date(2))).toBe('different');
    expect(compare(new Date(NaN), new Date(NaN))).toBe('equal');
  });
  it('compares Maps and Sets in observable insertion order', () => {
    expect(compare(new Map([[{ x: 1 }, [2]]]), new Map([[{ x: 1 }, [2]]]))).toBe('equal');
    expect(compare(new Set([1, 2]), new Set([2, 1]))).toBe('different');
    expect(compare(new Map([[1, 'a'], [2, 'b']]), new Map([[2, 'b'], [1, 'a']]))).toBe('different');
  });
  it('preserves cyclic and shared-reference topology in both directions', () => {
    const self: { self?: unknown } = {}; self.self = self;
    expect(compare(self, structuredClone(self))).toBe('equal');
    const child = { x: 1 }; const shared = { a: child, b: child }; const split = { a: { x: 1 }, b: { x: 1 } };
    expect(compare(shared, structuredClone(shared))).toBe('equal');
    expect(compare(shared, split)).toBe('different');
    expect(compare(split, shared)).toBe('different');
    const map = new Map(); map.set(map, map);
    expect(compare(map, structuredClone(map))).toBe('equal');
  });
  it('does not call getters, coercions or iterators supplied by objects', () => {
    let called = 0;
    const getter = { get value() { called++; return 1; } };
    expect(compare(getter, getter)).toBe('unknown');
    const map = new Map(); Object.defineProperty(map, Symbol.iterator, { value: () => { called++; } });
    expect(compare(map, map)).toBe('unknown');
    expect(called).toBe(0);
  });
  it('refuses unsupported values even when reference-identical', () => {
    class Other { x = 1; }
    for (const value of [new Other(), new Uint8Array([1]), /x/, Symbol('s'), () => 1, { [Symbol('x')]: 1 }, Object.defineProperty({}, 'x', { value: 1 })]) {
      expect(compare(value, value)).toBe('unknown');
    }
  });
  it('refuses excessive depth, width, string size and bigint magnitude', () => {
    let deep: unknown = 1; for (let i = 0; i < 70; i++) deep = { child: deep };
    for (const value of [deep, Array(5000).fill(1), 'x'.repeat(1024 * 1024), BigInt(1) << BigInt(5000)]) {
      expect(compare(value, value)).toBe('unknown');
    }
  });
});
