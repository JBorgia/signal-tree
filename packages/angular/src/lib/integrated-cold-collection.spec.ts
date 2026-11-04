import { computed, type Signal } from '@angular/core';
import { expect, it } from 'vitest';
import { entityMap, signalTree } from '../index';

type Row = { id: string; v: number };

it('INTEGRATED-COLD-0: realizes an Angular collection computed after cold writes and retains future dependencies', () => {
  const tree = signalTree({ rows: entityMap<Row, string>() });
  const rows = tree.$.rows;
  try {
    rows.setAll([{ id: 'a', v: 0 }]);
    rows.updateOne('a', { v: 1 });
    rows.updateOne('a', { v: 2 });
    let runs = 0;
    const query = computed(() => {
      runs++;
      return `${rows.all().map(row => row.v).join(',')}|${rows.count()}`;
    });
    expect(query()).toBe('2|1');
    expect(runs).toBe(1);
    expect(query()).toBe('2|1');
    expect(runs).toBe(1);
    rows.updateOne('a', { v: 3 });
    expect(query()).toBe('3|1');
    expect(runs).toBeGreaterThan(1);
    rows.addOne({ id: 'b', v: 4 });
    expect(query()).toBe('3,4|2');
  } finally {
    tree.destroy();
  }
});

it('INTEGRATED-COLD-0: first Angular collection computation can be acquired inside a write tap', () => {
  const tree = signalTree({ rows: entityMap<Row, string>() });
  const rows = tree.$.rows;
  rows.setAll([{ id: 'a', v: 0 }]);
  const held: { query?: Signal<number> } = {};
  const inTap: number[] = [];
  const stop = rows.tap({ onUpdate() {
    held.query ??= computed(() => rows.all()[0].v);
    // Establish the native dependency during the tap, not after it returns.
    inTap.push(held.query());
  } });
  try {
    rows.updateOne('a', { v: 1 });
    expect(inTap).toEqual([1]);
    rows.updateOne('a', { v: 2 });
    expect(inTap).toEqual([1, 2]);
    const query = held.query;
    if (!query) throw new Error('Tap did not acquire its collection computation');
    expect(query()).toBe(2);
    stop();
    rows.updateOne('a', { v: 3 });
    expect(query()).toBe(3);
  } finally {
    stop();
    tree.destroy();
  }
});
