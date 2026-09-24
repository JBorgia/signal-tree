import { describe, expect, it } from 'vitest';
import { entityMap, link, signalTree } from '../index';

describe('materialized value acquisition through public Link', () => {
  it('preserves special values without claiming a JSON wire codec', async () => {
    const value = {
      date: new Date('2024-01-02T03:04:05Z'),
      map: new Map([['a', 1]]),
      set: new Set([1, 2]),
      big: BigInt(123),
      regex: /hello/gi,
      nested: { date: new Date('2020-01-01T00:00:00Z') },
    };
    const tree = signalTree({
      date: new Date(0),
      map: new Map<string, number>(),
      set: new Set<number>(),
      big: BigInt(0),
      regex: /initial/,
      nested: { date: new Date(1) },
    });
    const connection = link(tree.$, { get: () => value });
    try {
      await connection.retrieve();
      const snapshot = tree.$();
      expect(snapshot.date).toBeInstanceOf(Date);
      expect(snapshot.date.toISOString()).toBe(value.date.toISOString());
      expect(snapshot.map).toBeInstanceOf(Map);
      expect([...snapshot.map]).toEqual([['a', 1]]);
      expect(snapshot.set).toBeInstanceOf(Set);
      expect([...snapshot.set]).toEqual([1, 2]);
      expect(typeof snapshot.big).toBe('bigint');
      expect(snapshot.big).toBe(BigInt(123));
      expect(snapshot.regex).toBeInstanceOf(RegExp);
      expect(snapshot.regex.source).toBe('hello');
      expect(snapshot.regex.flags).toBe('gi');
      expect(snapshot.nested.date.toISOString()).toBe(
        value.nested.date.toISOString()
      );
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
  it('acquires collection rows without serializing marker internals', async () => {
    const rows = [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Lin' },
    ];
    const tree = signalTree({
      rows: entityMap<{ id: number; name: string }, number>(),
    });
    const connection = link(tree.$.rows, { get: () => rows });
    try {
      await connection.retrieve();
      expect(tree.$.rows.all()).toHaveLength(2);
      expect(tree.$.rows.count()).toBe(2);
      expect(tree.$.rows.byId(2)?.()).toEqual(rows[1]);
      expect(tree.$.rows.all()).toEqual(rows);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});
