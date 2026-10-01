import { describe, expect, it } from 'vitest';

import { entityMap, signalTree } from '../index';

interface Row {
  id: number;
  value: number;
}

describe('entity value projection allocation', () => {
  it.each([false, true])(
    'does not allocate discarded key/value tuples for all() (sorted=%s)',
    (sorted) => {
      const rows = Array.from({ length: 64 }, (_, id) => ({ id, value: id }));
      const tree = signalTree({
        rows: entityMap<Row, number>({
          selectId: (row) => row.id,
          ...(sorted
            ? { sortComparer: (a: Row, b: Row) => b.value - a.value }
            : {}),
        }),
      });
      try {
        tree.$.rows.setAll(rows);
        const values = new Set(rows);
        let pairs = 0;
        const originalPush = Array.prototype.push;
        // A spy would itself push call records and recurse. Restore this narrow
        // instrumentation before assertions or other test-framework work.
        Array.prototype.push = function (this: unknown[], ...items: unknown[]) {
          for (const item of items) {
            if (Array.isArray(item) && item.length === 2 && values.has(item[1]))
              pairs++;
          }
          return originalPush.apply(this, items);
        };
        let all: Row[];
        let map: ReadonlyMap<number, Row>;
        let valuePairs: number;
        try {
          all = tree.$.rows.all();
          valuePairs = pairs;
          // Positive control: a map projection actually consumes key/value pairs.
          map = tree.$.rows.asMap();
        } finally {
          Array.prototype.push = originalPush;
        }
        expect(all).toEqual(sorted ? [...rows].reverse() : rows);
        expect(map.size).toBe(rows.length);
        expect(pairs - valuePairs).toBe(rows.length);
        expect(valuePairs).toBe(0);
        tree.$.rows.updateOne(0, { value: 100 });
        const fresh = tree.$.rows.all();
        expect(fresh).not.toBe(all);
        expect(all.find((row) => row.id === 0)?.value).toBe(0);
        expect(fresh.find((row) => row.id === 0)?.value).toBe(100);
        expect(tree.$.rows.ids()).toEqual(
          sorted
            ? [
                0,
                ...rows
                  .slice(1)
                  .reverse()
                  .map((row) => row.id),
              ]
            : rows.map((row) => row.id)
        );
      } finally {
        tree.destroy();
      }
    }
  );
});
