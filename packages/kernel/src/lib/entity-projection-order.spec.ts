import { describe, expect, it } from 'vitest';

import { entityMap, signalTree } from '../index';
import { restoration } from '../enhancers/restoration/restoration';
import { transactions } from '../enhancers/transactions/transactions';

type Row = { id: number; value: number };
const makeTree = () => signalTree({ rows: entityMap<Row, number>() });
type Rows = ReturnType<typeof makeTree>['$']['rows'];

describe('entity collection projections across structural changes', () => {
  it.each<{
    name: string;
    mutate: (rows: Rows) => void;
    order: number[];
  }>([
    { name: 'append', mutate: (rows) => rows.addOne({ id: 4, value: 4 }), order: [3, 1, 2, 4] },
    { name: 'prepend', mutate: (rows) => rows.prependOne({ id: 4, value: 4 }), order: [4, 3, 1, 2] },
    { name: 'remove', mutate: (rows) => rows.removeOne(1), order: [3, 2] },
    { name: 'reorder', mutate: (rows) => rows.setAll([2, 1, 3].map((id) => ({ id, value: id }))), order: [2, 1, 3] },
    { name: 'clear', mutate: (rows) => rows.clear(), order: [] },
    { name: 'same-key replacement', mutate: (rows) => {
      rows.removeOne(1);
      rows.addOne({ id: 1, value: 10 });
    }, order: [3, 2, 1] },
    { name: 'rename then reuse old key', mutate: (rows) => {
      rows.changeId(1, 10);
      rows.addOne({ id: 1, value: 10 });
    }, order: [3, 1, 2, 1] },
  ])('refreshes a previously read value projection after $name', ({ mutate, order }) => {
    const tree = makeTree();
    try {
      const rows = tree.$.rows;
      rows.setAll([3, 1, 2].map((id) => ({ id, value: id })));
      const before = rows.all();
      mutate(rows);
      expect(rows.all().map((row) => row.id)).toEqual(order);
      expect(before).toEqual([3, 1, 2].map((id) => ({ id, value: id })));
    } finally {
      tree.destroy();
    }
  });

  it('keeps held snapshots, order and lifetime distinct through edits and re-adds', () => {
    const tree = signalTree({ rows: entityMap<Row, number>() });
    try {
      const rows = tree.$.rows;
      rows.setAll([3, 1, 2].map((id) => ({ id, value: id })));
      const initial = rows.all();
      const initialMap = rows.asMap();
      const retired = rows.byId(1);
      rows.updateOne(3, { value: 30 });
      rows.changeId(2, 20);
      rows.removeOne(1);
      rows.prependOne({ id: 1, value: 10 });
      expect(retired?.()).toBeUndefined();
      expect(rows.all()).toEqual([
        { id: 1, value: 10 },
        { id: 3, value: 30 },
        { id: 2, value: 2 },
      ]);
      // changeId changes the collection key, not the entity's stored payload.
      expect([...rows.asMap().keys()]).toEqual([1, 3, 20]);
      expect([...rows.asMap().values()]).toEqual(rows.all());
      expect(initial).toEqual([3, 1, 2].map((id) => ({ id, value: id })));
      expect([...initialMap.keys()]).toEqual([3, 1, 2]);
      rows.setAll([20, 3, 1].map((id) => ({ id, value: -id })));
      expect(rows.all().map((row) => row.id)).toEqual([20, 3, 1]);
      rows.clear();
      expect(rows.all()).toEqual([]);
      expect(rows.asMap().size).toBe(0);
    } finally {
      tree.destroy();
    }
  });

  it('projects restored subjects in their restored order after rollback', () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>() },
      { enhancers: [restoration(), transactions()] }
    );
    try {
      const rows = tree.$.rows;
      rows.setAll([3, 1, 2].map((id) => ({ id, value: id })));
      const before = rows.all();
      const pending = tree.transaction(() => {
        rows.removeOne(1);
        rows.updateOne(3, { value: 30 });
        rows.prependOne({ id: 4, value: 40 });
      });
      expect(rows.all().map((row) => row.id)).toEqual([4, 3, 2]);
      pending.rollback();
      expect(rows.all()).toEqual(before);
      expect([...rows.asMap().keys()]).toEqual([3, 1, 2]);
    } finally {
      tree.destroy();
    }
  });
});
