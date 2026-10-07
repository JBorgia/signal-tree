import { expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';

it('a sequential replay tap reads held projections matching direct reads', () => {
  const tree = signalTree(
    {
      a: entityMap<{ id: string; n: number }, string>(),
      b: entityMap<{ id: string; n: number }, string>(),
    },
    { enhancers: [transactions()] }
  );
  try {
    tree.$.a.addOne({ id: 'a', n: 0 });
    tree.$.b.addOne({ id: 'b', n: 0 });
    const pending = tree.transaction(() => {
      tree.$.a.updateOne('a', { n: 1 });
      tree.$.b.updateOne('b', { n: 2 });
    });
    const a = tree.$.a.all;
    const b = tree.$.b.all;
    expect(a()[0].n).toBe(1);
    expect(b()[0].n).toBe(2);
    const snapshots: { held: number[]; direct: number[] }[] = [];
    const off = tree.$.a.tap({
      onUpdate: () =>
        snapshots.push({
          held: [a()[0].n, b()[0].n],
          direct: [tree.$.a.byIdOrFail('a')().n, tree.$.b.byIdOrFail('b')().n],
        }),
    });
    try {
      pending.rollback();
      // Value-only replay applies writes sequentially; taps read current storage.
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].held).toEqual(snapshots[0].direct);
      expect(snapshots[0].held[0]).toBe(0);
      expect(a()[0].n).toBe(0);
      expect(b()[0].n).toBe(0);
    } finally {
      off();
    }
  } finally {
    tree.destroy();
  }
});

it('a declarative replay tap reads every installed collection target', () => {
  const tree = signalTree(
    {
      a: entityMap<{ id: string; n: number }, string>(),
      b: entityMap<{ id: string; n: number }, string>(),
    },
    { enhancers: [transactions()] }
  );
  try {
    tree.$.a.setAll([
      { id: 'a', n: 0 },
      { id: 'x', n: 9 },
    ]);
    tree.$.b.setAll([
      { id: 'b', n: 0 },
      { id: 'y', n: 8 },
    ]);
    const pending = tree.transaction(() => {
      // Reorder surviving rows in both collections: unlike a single removal,
      // these produce order deltas and require aggregate target installation.
      tree.$.a.setAll([
        { id: 'x', n: 9 },
        { id: 'a', n: 1 },
      ]);
      tree.$.b.setAll([
        { id: 'y', n: 8 },
        { id: 'b', n: 2 },
      ]);
    });
    const a = tree.$.a.all;
    const b = tree.$.b.all;
    expect(a()).toEqual([
      { id: 'x', n: 9 },
      { id: 'a', n: 1 },
    ]);
    expect(b()).toEqual([
      { id: 'y', n: 8 },
      { id: 'b', n: 2 },
    ]);
    const snapshots: {
      held: (number | undefined)[];
      direct: number[];
      aIds: string[];
      bIds: string[];
    }[] = [];
    const off = tree.$.a.tap({
      onUpdate: () =>
        snapshots.push({
          held: [
            a().find((row) => row.id === 'a')?.n,
            b().find((row) => row.id === 'b')?.n,
          ],
          direct: [tree.$.a.byIdOrFail('a')().n, tree.$.b.byIdOrFail('b')().n],
          aIds: tree.$.a.ids(),
          bIds: tree.$.b.ids(),
        }),
    });
    try {
      pending.rollback();
      expect(snapshots).toEqual([
        {
          held: [0, 0],
          direct: [0, 0],
          aIds: ['a', 'x'],
          bIds: ['b', 'y'],
        },
      ]);
      expect(a()).toEqual([
        { id: 'a', n: 0 },
        { id: 'x', n: 9 },
      ]);
      expect(b()).toEqual([
        { id: 'b', n: 0 },
        { id: 'y', n: 8 },
      ]);
    } finally {
      off();
    }
  } finally {
    tree.destroy();
  }
});

it('ordinary subscribers never read retained rows during omission replay', () => {
  const branch = {
    rows: entityMap<{ id: string; n: number }, string>(),
    s: 0,
  };
  // The root is a branch record. Only its seeded member is used; replacing
  // the record with {} omits that member without mounting any new topology.
  const initial: Record<string, typeof branch> = { a: branch };
  const tree = signalTree(initial, { enhancers: [transactions()] });
  try {
    const rows = tree.$.a?.rows;
    if (!rows) throw new Error('the seeded collection was not realized');
    rows.setAll([{ id: 'old', n: 9 }]);
    tree.$({});
    const pending = tree.transaction(() => rows.addOne({ id: 'new', n: 1 }));
    const all = rows.all;
    expect(all()).toEqual([{ id: 'new', n: 1 }]);
    const seen: { ids: string[]; count: number; directOld: unknown }[] = [];
    const off = all.subscribe(() =>
      seen.push({
        ids: all().map((row) => row.id),
        count: rows.count(),
        directOld: rows.byId('old')?.(),
      })
    );
    try {
      pending.rollback();
      // Positive delivery assertion: cannot pass by never notifying.
      expect(seen).toEqual([{ ids: [], count: 0, directOld: undefined }]);
      expect(all()).toEqual([]);
      expect(rows.byId('old')).toBeUndefined();
    } finally {
      off();
    }
  } finally {
    tree.destroy();
  }
});
