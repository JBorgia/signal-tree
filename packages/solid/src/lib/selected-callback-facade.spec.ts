import { expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
import { createMemo, createRoot } from 'solid-js';

// Public facades only. These reads are acquired in the tap, as required by the
// existing fresh-projection contract. Native computed timing is tested apart.
it('realizes fresh tap reads and preserves later callback writes', async () => {
  const tree = signalTree(
    { rows: entityMap<{ id: string; n: number }, string>() },
    { enhancers: [transactions()] }
  );
  const rows = tree.$.rows;
  rows.setAll([
    { id: 'A', n: 1 },
    { id: 'C', n: 3 },
  ]);
  rows.setActiveId('A');
  const snapshot = () => ({
    id: rows.activeId(),
    active: rows.activeEntity()?.n,
    ids: [...rows.ids()],
    all: rows.all().map((row) => ({ ...row })),
    count: rows.count(),
    empty: rows.empty(),
    map: [...rows.asMap().keys()],
    hasA: rows.has('A')(),
    where: rows
      .where((row) => row.n > 0)()
      .map((row) => row.id),
    found: rows.find((row) => row.id === 'A')()?.n,
  });
  let armed = false;
  let calls = 0;
  const frames: ReturnType<typeof snapshot>[] = [];
  const stop = rows.tap({
    onRemove: (id) => {
      if (!armed || id !== 'D') return;
      calls++;
      frames.push(snapshot());
      const heldId = rows.activeId;
      const heldAll = rows.all;
      const heldActive = rows.activeEntity;

      expect(heldId()).toBe('A');
      expect(heldActive()?.n).toBe(1);
      expect(heldAll().map((row) => row.id)).toEqual(['A', 'C']);
      rows.setActiveId(heldId() === 'A' ? 'C' : 'wrong-selection');
      rows.updateOne('C', { n: 9 });
      // The tap-fresh readers remain fresh even if retained across a nested write.
      expect(heldId()).toBe('C');
      expect(heldActive()?.n).toBe(9);
      expect(heldAll().find((row) => row.id === 'C')?.n).toBe(9);
      frames.push(snapshot());
    },
  });
  try {
    expect(snapshot().id).toBe('A');
    const pending = tree.transact(() => {
      rows.changeId('A', 'X');
      rows.addOne({ id: 'D', n: 4 });
    });
    await Promise.resolve();
    expect(snapshot().id).toBe('X');
    armed = true;
    pending.rollback();
    await Promise.resolve();
    expect(calls).toBe(1);
    expect(frames).toEqual([
      {
        id: 'A',
        active: 1,
        ids: ['A', 'C'],
        all: [
          { id: 'A', n: 1 },
          { id: 'C', n: 3 },
        ],
        count: 2,
        empty: false,
        map: ['A', 'C'],
        hasA: true,
        where: ['A', 'C'],
        found: 1,
      },
      {
        id: 'C',
        active: 9,
        ids: ['A', 'C'],
        all: [
          { id: 'A', n: 1 },
          { id: 'C', n: 9 },
        ],
        count: 2,
        empty: false,
        map: ['A', 'C'],
        hasA: true,
        where: ['A', 'C'],
        found: 1,
      },
    ]);
    expect(snapshot()).toEqual(frames[1]);
  } finally {
    stop();
    tree.destroy();
  }
});

it('keeps ordinary selected observation granular and native computations cached during the callback', async () => {
  let dispose = () => {};
  const tree = signalTree(
    { rows: entityMap<{ id: string; n: number }, string>() },
    { enhancers: [transactions()] }
  );
  const rows = tree.$.rows;
  rows.setAll([
    { id: 'A', n: 1 },
    { id: 'C', n: 3 },
  ]);
  rows.setActiveId('A');
  let runs = 0;
  const view = createRoot((release) => {
    dispose = release;
    return createMemo(() => {
      runs++;
      return rows.activeEntity()?.n;
    });
  });
  let selectionRuns = 0;
  let disposeSelection = () => {};
  const selectionView = createRoot((release) => {
    disposeSelection = release;
    return createMemo(() => {
      selectionRuns++;
      return rows.activeId();
    });
  });
  let armed = false;
  let callbackCount = 0;
  const stop = rows.tap({
    onRemove: (id) => {
      if (!armed || id !== 'D') return;
      callbackCount++;
      const before = runs;
      const beforeSelection = selectionRuns;
      expect(selectionView()).toBe('X');
      expect(view()).toBe(1);
      // Reading the fresh library facade must not invalidate the app's memo.
      expect(rows.activeId()).toBe('A');
      expect(rows.activeEntity()?.n).toBe(1);
      expect(runs).toBe(before);
      rows.setActiveId('C');
      expect(selectionView()).toBe('X');
      expect(view()).toBe(1);
      expect(selectionRuns).toBe(beforeSelection);
      expect(runs).toBe(before);
    },
  });
  try {
    expect(view()).toBe(1);
    const warm = runs;
    rows.updateOne('C', { n: 4 });
    expect(view()).toBe(1);
    expect(runs).toBe(warm);
    const pending = tree.transact(() => {
      rows.changeId('A', 'X');
      rows.addOne({ id: 'D', n: 4 });
    });
    await Promise.resolve();
    expect(rows.activeId()).toBe('X');
    expect(view()).toBe(1);
    expect(selectionView()).toBe('X');
    armed = true;
    pending.rollback();
    await Promise.resolve();
    expect(callbackCount).toBe(1);
    expect(selectionView()).toBe('C');
    expect(view()).toBe(4);
    expect(runs).toBeGreaterThan(warm);
  } finally {
    stop();
    tree.destroy();
    dispose();
    disposeSelection();
  }
});

it.each(['rekey', 'clear'] as const)(
  'preserves a callback selection followed by %s',
  async (mode) => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; n: number }, string>() },
      { enhancers: [transactions()] }
    );
    const rows = tree.$.rows;
    rows.setAll([
      { id: 'A', n: 1 },
      { id: 'C', n: 3 },
    ]);
    rows.setActiveId('A');
    let armed = false;
    let calls = 0;
    const expected = mode === 'rekey' ? 'Y' : undefined;
    const stop = rows.tap({
      onRemove: (id) => {
        if (!armed || id !== 'D') return;
        calls++;
        expect(rows.activeId()).toBe('A');
        rows.setActiveId('C');
        if (mode === 'rekey') rows.changeId('C', 'Y');
        else rows.clearActiveId();
        expect(rows.activeId()).toBe(expected);
        expect(rows.activeEntity()?.n).toBe(mode === 'rekey' ? 3 : undefined);
      },
    });
    try {
      const pending = tree.transact(() => {
        rows.changeId('A', 'X');
        rows.addOne({ id: 'D', n: 4 });
      });
      await Promise.resolve();
      armed = true;
      pending.rollback();
      await Promise.resolve();
      expect(calls).toBe(1);
      expect(rows.activeId()).toBe(expected);
      expect(rows.activeEntity()?.n).toBe(mode === 'rekey' ? 3 : undefined);
      expect(rows.ids()).toEqual(mode === 'rekey' ? ['A', 'Y'] : ['A', 'C']);
    } finally {
      stop();
      tree.destroy();
    }
  }
);
