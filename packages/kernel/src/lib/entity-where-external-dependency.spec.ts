import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';

// Reproduced on npm 15.3.1: where()/find() cached their result by the
// collection's version alone, so a predicate that also reads another signal
// kept returning the old answer after that signal changed.
type Row = { id: number; v: number };
const rows = [1, 2, 3, 4].map((n) => ({ id: n, v: n }));

describe('entity queries whose predicate reads another signal', () => {
  it('where() follows the other signal', () => {
    const tree = signalTree({ min: 2, rows: entityMap<Row, number>() });
    try {
      tree.$.rows.setAll(rows);
      const pred = (r: Row) => r.v >= tree.$.min();
      const view = tree.$.rows.where(pred);
      expect(view().map((r) => r.id)).toEqual([2, 3, 4]);
      tree.$.min(4);
      expect(view().map((r) => r.id)).toEqual([4]);
      tree.$.rows.updateOne(1, { v: 9 });
      expect(view().map((r) => r.id)).toEqual([1, 4]);
    } finally {
      tree.destroy();
    }
  });

  it('find() follows the other signal', () => {
    const tree = signalTree({ want: 2, rows: entityMap<Row, number>() });
    try {
      tree.$.rows.setAll(rows);
      const pred = (r: Row) => r.v === tree.$.want();
      const found = tree.$.rows.find(pred);
      expect(found()?.id).toBe(2);
      tree.$.want(3);
      expect(found()?.id).toBe(3);
    } finally {
      tree.destroy();
    }
  });
});
