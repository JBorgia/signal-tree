import { describe, expect, it } from 'vitest';

import { deepClone } from './deep-clone';
import { getChanges } from './get-changes';

/**
 * These are small pure functions used by kernel production paths. A quiet wrong
 * answer surfaces somewhere else entirely, so their edge cases stay pinned at
 * the owning package boundary.
 */
describe('deepClone', () => {
  it('clones nested objects by value', () => {
    const original = { a: { b: { c: 1 } } };
    const copy = deepClone(original);

    copy.a.b.c = 2;

    expect(original.a.b.c).toBe(1);
  });

  it('clones arrays', () => {
    const original = [{ n: 1 }, { n: 2 }];
    const copy = deepClone(original);
    copy[0].n = 99;
    expect(original[0].n).toBe(1);
  });

  it('preserves Date, Map and Set as their own types', () => {
    const copy = deepClone({
      when: new Date(0),
      map: new Map([['k', 1]]),
      set: new Set([1, 2]),
    });

    expect(copy.when).toBeInstanceOf(Date);
    expect(copy.map).toBeInstanceOf(Map);
    expect(copy.set).toBeInstanceOf(Set);
    expect(copy.map.get('k')).toBe(1);
  });

  it('passes primitives and null straight through', () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone('s')).toBe('s');
    expect(deepClone(null)).toBeNull();
    expect(deepClone(undefined)).toBeUndefined();
  });

  it('survives a CYCLE rather than recursing forever', () => {
    // The case that turns a utility into a hang.
    const cyclic: Record<string, unknown> = { name: 'root' };
    cyclic['self'] = cyclic;

    const copy = deepClone(cyclic) as Record<string, unknown>;

    expect(copy['name']).toBe('root');
    expect(copy['self']).toBe(copy);
  });

  it('treats functions as opaque references', () => {
    const fn = () => 1;
    const copy = deepClone({ fn });
    expect(copy.fn).toBe(fn);
  });

  describe('the MANUAL fallback', () => {
    /**
     * `structuredClone` handles almost everything, so the hand-written cloner
     * below it was 47% covered — the branches for Date, Map, Set and Array
     * never ran, because the fast path took every case first.
     *
     * `structuredClone` THROWS on a function, and `deepClone` catches that and
     * falls through. So a payload carrying a function alongside the interesting
     * types is what exercises the fallback, without stubbing a global or
     * resetting the module registry.
     */
    const forceFallback = <T>(value: T) =>
      deepClone({ fn: () => 1, value }).value;

    it('clones a Date through the fallback', () => {
      const cloned = forceFallback(new Date(1234));
      expect(cloned).toBeInstanceOf(Date);
      expect(cloned.getTime()).toBe(1234);
    });

    it('clones a Map through the fallback', () => {
      const cloned = forceFallback(new Map([['k', { n: 1 }]]));
      expect(cloned).toBeInstanceOf(Map);
      expect(cloned.get('k')).toEqual({ n: 1 });
      expect(cloned.get('k')).not.toBe(undefined);
    });

    it('clones a Set through the fallback', () => {
      const cloned = forceFallback(new Set([1, 2, 3]));
      expect(cloned).toBeInstanceOf(Set);
      expect([...cloned]).toEqual([1, 2, 3]);
    });

    it('clones an Array deeply through the fallback', () => {
      const source = [{ n: 1 }, { n: 2 }];
      const cloned = forceFallback(source);
      cloned[0].n = 99;
      expect(source[0].n).toBe(1);
    });

    it('handles a cycle through the fallback', () => {
      const cyclic: Record<string, unknown> = { name: 'root' };
      cyclic['self'] = cyclic;
      const cloned = forceFallback(cyclic) as Record<string, unknown>;
      expect(cloned['self']).toBe(cloned);
    });
  });
});

describe('getChanges', () => {
  it('reports only the keys that differ', () => {
    expect(getChanges({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual({ b: 3 });
  });

  it('is empty when nothing changed', () => {
    expect(getChanges({ a: 1 }, { a: 1 })).toEqual({});
  });

  it('reports a key that was added', () => {
    expect(getChanges({ a: 1 }, { a: 1, b: 2 } as never)).toEqual({ b: 2 });
  });

  it('reports a value changing to undefined', () => {
    expect(getChanges({ a: 1 }, { a: undefined } as never)).toEqual({
      a: undefined,
    });
  });
});
