import { describe, expect, it } from 'vitest';
import { ExactSubjectRuns } from './internals/exact-subject-runs';

describe('exact subject runs', () => {
  it('joins ascending and descending batches by reference, preserving gaps and replacements', () => {
    const a = {}, b = {}, runs = new ExactSubjectRuns<object>(Object.is);
    for (let id = 20; id >= 1; id--) expect(runs.tryAppend(id, a)).toBe(true);
    expect(runs.size).toBe(20);
    expect(runs.runCount).toBe(1);
    expect(runs.tryAppend(10, b)).toBe(false);
    expect(runs.runCount).toBe(1);
    expect(runs.get(10)).toBe(a);
    expect(runs.get(9)).toBe(a);
    expect(runs.get(11)).toBe(a);
    expect(runs.delete(10)).toBe(true);
    expect(runs.delete(10)).toBe(false);
    expect(runs.size).toBe(19);
    expect(runs.runCount).toBe(2);
    expect(runs.get(10)).toBeUndefined();
    expect(runs.get(0)).toBeUndefined();
    expect(runs.get(21)).toBeUndefined();
  });

  it('matches an exact Map through deterministic arbitrary insertions, overwrites and splits', () => {
    const values = [{}, {}, {}, {}];
    const runs = new ExactSubjectRuns<object>(Object.is), reference = new Map<number, object>();
    let random = 1701;
    for (let step = 0; step < 2000; step++) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const id = random % 127, value = values[(random >>> 8) % values.length];
      if (random & 128) {
        if (runs.tryAppend(id, value)) reference.set(id, value);
      }
      else expect(runs.delete(id)).toBe(reference.delete(id));
      expect(runs.size).toBe(reference.size);
      for (let key = 0; key < 127; key++) expect(runs.get(key)).toBe(reference.get(key));
      expect([...runs.entries()]).toEqual([...reference].sort(([a], [b]) => a - b));
    }
  });

  it('refuses adverse distinct reverse insertion and invalid numeric keys without changing stored runs', () => {
    const runs = new ExactSubjectRuns<object>(Object.is);
    const first = {};
    expect(runs.tryAppend(10000, first)).toBe(true);
    for (let id = 9999; id >= 1; id--) expect(runs.tryAppend(id, {})).toBe(false);
    expect(runs.size).toBe(1);
    expect(runs.runCount).toBe(1);
    expect([...runs.entries()]).toEqual([[10000, first]]);
    for (const id of [NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(runs.tryAppend(id, {})).toBe(false);
      expect(runs.delete(id)).toBe(false);
      expect(runs.get(id)).toBeUndefined();
      expect([...runs.entries()]).toEqual([[10000, first]]);
    }
  });
});
