import { expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
import { getLocationRuntime } from './internals/location-runtime';

const Z = { id: 'z', n: 9 };
type Row = typeof Z;
for (const query of ['where', 'find'] as const) for (const throws of [false, true]) {
  it(`predicate presence reentry preserves first result/error without retry: ${query}, throws=${throws}`, () => {
    const tree = signalTree({ a: { rows: entityMap<typeof Z, string>() }, other: 0 }, { enhancers: [transactions()] });
    const rows = tree.$.a.rows;
    const sentinel = new Error('predicate original sentinel');
    let calls = 0;
    const read = rows[query](() => {
      calls++;
      tree.$({ other: 0 } as { a: { rows: { all: Row[] }; n: number }; other: number });
      if (throws) throw sentinel;
      return true;
    });
    try {
      rows.addOne(Z);
      let first: unknown; let caught: unknown;
      getLocationRuntime(tree.$)!.runInvalidationGroup(() => {
        try { first = read(); } catch (error) { caught = error; }
        expect(calls).toBe(1);
        expect(caught).toBe(throws ? sentinel : undefined);
        if (!throws) expect(first).toEqual(query === 'where' ? [Z] : Z);
        // A separate demand must not reuse a value computed while present.
        expect(read()).toEqual(query === 'where' ? [] : undefined);
        expect(calls).toBe(1);
      });
      expect(tree.$()).toEqual({ other: 0 });
      rows.addOne(Z);
      // Predicate is deliberately still armed: a later explicit call again
      // invokes it once, retaining the original error/result policy.
      caught = undefined;
      try { first = read(); } catch (error) { caught = error; }
      expect(calls).toBe(2);
      expect(caught).toBe(throws ? sentinel : undefined);
      if (!throws) expect(first).toEqual(query === 'where' ? [Z] : Z);
    } finally { tree.destroy(); }
  });
}
