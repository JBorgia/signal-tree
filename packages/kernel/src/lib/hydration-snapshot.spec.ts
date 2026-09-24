import { describe, expect, it } from 'vitest';
import { entityMap, leaf, signalTree } from '../index';

describe('existing hydration snapshot contract', () => {
  it('keeps markers inside an opaque leaf as payload during root reads and writes', () => {
    type Row = { id: string; value: number };
    const opaque = { marker: entityMap<Row, string>() };
    const tree = signalTree({
      terminal: leaf(opaque),
      rows: entityMap<Row, string>(),
    });
    try {
      expect(tree.$().terminal).toEqual(opaque);
      tree.$({ terminal: opaque, rows: [{ id: 'a', value: 1 }] });
      tree.$((current) => {
        expect(current.rows.all).toEqual([{ id: 'a', value: 1 }]);
        expect(current.terminal).toEqual(opaque);
        return { ...current, rows: current.rows.all };
      });
      expect(tree.$().terminal).toEqual(opaque);
      expect(tree.$().rows).toEqual({ all: [{ id: 'a', value: 1 }] });
    } finally {
      tree.destroy();
    }
  });
  it.each(['canonical', 'array'] as const)(
    'accepts %s collection input at root and branch',
    (shape) => {
      type Row = { id: string; value: number };
      const tree = signalTree({
        rows: entityMap<Row, string>(),
        nested: { rows: entityMap<Row, string>(), label: 'before' },
        terminal: leaf({ all: 'opaque' }),
        date: new Date(0),
      });
      const rows = [
        { id: 'b', value: 2 },
        { id: 'a', value: 1 },
      ];
      const collection = shape === 'canonical' ? { all: rows } : rows;
      const root = tree.$;
      const branch = tree.$.nested;
      try {
        root({
          rows: collection,
          nested: { rows: collection, label: 'root' },
          terminal: { all: 'opaque' },
          date: new Date(1),
        });
        expect(tree.$.rows.all()).toEqual(rows);
        expect(root()).toEqual({
          rows: { all: rows },
          nested: { rows: { all: rows }, label: 'root' },
          terminal: { all: 'opaque' },
          date: new Date(1),
        });
        branch({
          rows:
            shape === 'canonical'
              ? { all: [...rows].reverse() }
              : [...rows].reverse(),
          label: 'branch',
        });
        expect(branch()).toEqual({
          rows: { all: [...rows].reverse() },
          label: 'branch',
        });
        branch((current) => ({ ...current, rows: current.rows.all }));
        const snapshot = root();
        root(snapshot);
        expect(root()).toEqual(snapshot);
      } finally {
        tree.destroy();
      }
    }
  );
});
