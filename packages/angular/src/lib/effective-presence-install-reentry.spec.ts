import { expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
// eslint-disable-next-line @nx/enforce-module-boundaries -- White-box regression exercises private kernel/realization coordination.
import { getLocationRuntime } from '../../../kernel/src/lib/internals/location-runtime';

type Row = { id: string; n: number };
for (const query of ['where', 'find', 'sorted-all'] as const) for (const throws of [false, true]) {
  it(`install revision is captured before callback reentry: ${query}, throws=${throws}`, () => {
    let calls = 0; let armed = false;
    const sentinel = new Error('installed revision original sentinel');
    let reenter = () => { /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ };
    const callback = () => {
      calls++;
      if (!armed) return;
      armed = false;
      reenter();
      if (throws) throw sentinel;
    };
    const tree = signalTree({ rows: entityMap<Row, string>({
      sortComparer: query === 'sorted-all' ? (a, b) => { callback(); return a.n - b.n; } : undefined,
    }) }, { enhancers: [transactions()] });
    const rows = tree.$.rows;
    const read = query === 'sorted-all' ? rows.all
      : query === 'where' ? rows.where(() => { callback(); return true; })
      : rows.find(() => { callback(); return true; });
    try {
      rows.addOne({ id: 'z', n: 9 });
      if (query === 'sorted-all') rows.addOne({ id: 'other', n: 2 });
      read(); // A warm projection exercises the current fallback on native runtimes.
      const start = calls;
      reenter = () => rows.updateOne('z', { n: 11 });
      required(getLocationRuntime(tree.$)).runInvalidationGroup(() => {
        rows.updateOne('z', { n: 10 });
        armed = true;
        let first: unknown; let caught: unknown;
        try { first = read(); } catch (error) { caught = error; }
        expect(calls - start).toBe(1);
        expect(caught).toBe(throws ? sentinel : undefined);
        const expected = (n: number) => query === 'sorted-all'
          ? [{ id: 'other', n: 2 }, { id: 'z', n }]
          : query === 'where' ? [{ id: 'z', n }] : { id: 'z', n };
        if (!throws) expect(first).toEqual(expected(10));
        // The explicit next demand, not the first invocation, recomputes.
        expect(read()).toEqual(expected(11));
        expect(calls - start).toBe(2);
        const stable = read();
        expect(read()).toBe(stable); expect(calls - start).toBe(2);
      });
      expect(rows.all().find(row => row.id === 'z')?.n).toBe(11);
    } finally { tree.destroy(); }
  });
}

function required<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) throw new Error("Fixture expected a present value");
  return value;
}
