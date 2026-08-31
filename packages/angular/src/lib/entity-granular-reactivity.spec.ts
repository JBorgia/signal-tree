import { computed } from '@angular/core';

import { entityMap, signalTree } from '../index';

interface Row {
  id: number;
  v: number;
}

const makeRows = () => {
  const tree = signalTree({ rows: entityMap<Row, number>() });
  return tree.$.rows;
};

describe('Angular entityMap granular reactivity', () => {
  it('byId(absent) re-runs when the entity appears', () => {
    const rows = makeRows();
    let runs = 0;
    const probe = computed(() => {
      runs++;
      return rows.byId(5)?.v() ?? -1;
    });

    expect(probe()).toBe(-1);
    expect(runs).toBe(1);

    rows.addOne({ id: 5, v: 42 });

    expect(probe()).toBe(42);
    expect(runs).toBe(2);
  });

  it('updating one entity does not re-run a reader of another', () => {
    const rows = makeRows();
    rows.addMany([
      { id: 1, v: 0 },
      { id: 2, v: 0 },
    ]);
    let runs = 0;
    const first = computed(() => {
      runs++;
      return rows.byId(1)?.v();
    });

    first();
    expect(runs).toBe(1);

    rows.updateOne(2, { v: 99 });
    first();

    expect(runs).toBe(1);
  });

  it('activeEntity does not recompute when an unrelated row changes', () => {
    const rows = makeRows();
    rows.addMany([
      { id: 1, v: 1 },
      { id: 2, v: 2 },
      { id: 3, v: 3 },
    ]);
    rows.setActiveId(2);
    let evaluations = 0;
    const active = computed(() => {
      evaluations++;
      return rows.activeEntity()?.v;
    });
    active();
    const before = evaluations;

    rows.updateOne(3, { v: 99 });
    active();

    expect(evaluations).toBe(before);
  });

  it('activeEntity recomputes when the active row changes', () => {
    const rows = makeRows();
    rows.addMany([
      { id: 1, v: 1 },
      { id: 2, v: 2 },
      { id: 3, v: 3 },
    ]);
    rows.setActiveId(2);
    let evaluations = 0;
    const active = computed(() => {
      evaluations++;
      return rows.activeEntity()?.v;
    });
    active();
    const before = evaluations;

    rows.updateOne(2, { v: 22 });
    active();

    expect(evaluations).toBeGreaterThan(before);
  });
});
