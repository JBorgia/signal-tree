import { batch, createMemo, createRoot, getOwner, runWithOwner, type Accessor } from 'solid-js';
import { expect, it } from 'vitest';
import { entityMap, signalTree } from '../index';

type Row = { id: string; v: number };

it('INTEGRATED-COLD-0: realizes a Solid collection memo after cold writes and retains future dependencies', () => {
  createRoot(dispose => {
    const tree = signalTree({ rows: entityMap<Row, string>() });
    const rows = tree.$.rows;
    try {
      rows.setAll([{ id: 'a', v: 0 }]);
      rows.updateOne('a', { v: 1 });
      rows.updateOne('a', { v: 2 });
      let runs = 0;
      const query = createMemo(() => {
        runs++;
        return `${rows.all().map(row => row.v).join(',')}|${rows.count()}`;
      });
      expect(query()).toBe('2|1');
      const initial = runs;
      expect(query()).toBe('2|1');
      expect(runs).toBe(initial);
      rows.updateOne('a', { v: 3 });
      expect(query()).toBe('3|1');
      expect(runs).toBeGreaterThan(initial);
      rows.addOne({ id: 'b', v: 4 });
      expect(query()).toBe('3,4|2');
    } finally {
      dispose();
      tree.destroy();
    }
  });
});

it('INTEGRATED-COLD-0: first Solid collection memo can be created in a tap during an open batch', () => {
  createRoot(dispose => {
    const owner = getOwner();
    if (!owner) throw new Error('Missing owned Solid root');
    const tree = signalTree({ rows: entityMap<Row, string>() });
    const rows = tree.$.rows;
    rows.setAll([{ id: 'a', v: 0 }]);
    const held: { query?: Accessor<number> } = {};
    const first: number[] = [];
    const stop = rows.tap({ onUpdate() {
      if (!held.query) runWithOwner(owner, () => {
        const query = createMemo(() => rows.all()[0].v);
        held.query = query;
        first.push(query());
      });
    } });
    try {
      batch(() => {
        rows.updateOne('a', { v: 1 });
        rows.updateOne('a', { v: 2 });
      });
      const query = held.query;
      if (!query) throw new Error('Tap did not acquire its Solid collection memo');
      expect(first).toEqual([1]);
      expect(query()).toBe(2);
      rows.updateOne('a', { v: 3 });
      expect(query()).toBe(3);
      stop();
      rows.updateOne('a', { v: 4 });
      expect(query()).toBe(4);
    } finally {
      stop();
      dispose();
      tree.destroy();
    }
  });
});
