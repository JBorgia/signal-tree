import { expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
import { computed, isRef, isReadonly } from 'vue';

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
    id: rows.activeId.value,
    active: rows.activeEntity.value?.n,
    ids: [...rows.ids.value],
    all: rows.all.value.map((row) => ({ ...row })),
    count: rows.count.value,
    empty: rows.empty.value,
    map: [...rows.asMap.value.keys()],
    hasA: rows.has('A').value,
    where: rows.where((row) => row.n > 0).value.map((row) => row.id),
    found: rows.find((row) => row.id === 'A').value?.n,
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
      expect(isRef(heldId)).toBe(true);
      expect(isReadonly(heldId)).toBe(true);
      expect(isRef(heldAll)).toBe(true);
      expect(heldId.value).toBe('A');
      expect(heldActive.value?.n).toBe(1);
      expect(heldAll.value.map((row) => row.id)).toEqual(['A', 'C']);
      rows.setActiveId(heldId.value === 'A' ? 'C' : 'wrong-selection');
      rows.updateOne('C', { n: 9 });
      // The tap-fresh readers remain fresh even if retained across a nested write.
      expect(heldId.value).toBe('C');
      expect(heldActive.value?.n).toBe(9);
      expect(heldAll.value.find((row) => row.id === 'C')?.n).toBe(9);
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
  const view = computed(() => {
    runs++;
    return rows.activeEntity.value?.n;
  });
  let selectionRuns = 0;
  const selectionView = computed(() => {
    selectionRuns++;
    return rows.activeId.value;
  });
  let armed = false;
  let callbackCount = 0;
  const stop = rows.tap({
    onRemove: (id) => {
      if (!armed || id !== 'D') return;
      callbackCount++;
      const before = runs;
      const beforeSelection = selectionRuns;
      expect(selectionView.value).toBe('X');
      expect(view.value).toBe(1);
      // Reading the fresh library facade must not invalidate the app's memo.
      expect(rows.activeId.value).toBe('A');
      expect(rows.activeEntity.value?.n).toBe(1);
      expect(runs).toBe(before);
      rows.setActiveId('C');
      expect(selectionView.value).toBe('X');
      expect(view.value).toBe(1);
      expect(selectionRuns).toBe(beforeSelection);
      expect(runs).toBe(before);
    },
  });
  try {
    expect(view.value).toBe(1);
    const warm = runs;
    rows.updateOne('C', { n: 4 });
    expect(view.value).toBe(1);
    expect(runs).toBe(warm);
    const pending = tree.transact(() => {
      rows.changeId('A', 'X');
      rows.addOne({ id: 'D', n: 4 });
    });
    await Promise.resolve();
    expect(rows.activeId.value).toBe('X');
    expect(view.value).toBe(1);
    expect(selectionView.value).toBe('X');
    armed = true;
    pending.rollback();
    await Promise.resolve();
    expect(callbackCount).toBe(1);
    expect(selectionView.value).toBe('C');
    expect(view.value).toBe(4);
    expect(runs).toBeGreaterThan(warm);
  } finally {
    stop();
    tree.destroy();
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
        expect(rows.activeId.value).toBe('A');
        rows.setActiveId('C');
        if (mode === 'rekey') rows.changeId('C', 'Y');
        else rows.clearActiveId();
        expect(rows.activeId.value).toBe(expected);
        expect(rows.activeEntity.value?.n).toBe(
          mode === 'rekey' ? 3 : undefined
        );
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
      expect(rows.activeId.value).toBe(expected);
      expect(rows.activeEntity.value?.n).toBe(mode === 'rekey' ? 3 : undefined);
      expect(rows.ids.value).toEqual(
        mode === 'rekey' ? ['A', 'Y'] : ['A', 'C']
      );
    } finally {
      stop();
      tree.destroy();
    }
  }
);

it('retains coherent native metadata on one callback-acquired reader', () => {
  const tree = signalTree({
    rows: entityMap<{ id: string; n: number }, string>(),
  });
  let callbacks = 0;
  const stop = tree.$.rows.tap({
    onAdd: () => {
      callbacks++;
      const held = tree.$.rows.ids;
      const before = held.effect;
      expect(held.value).toEqual(['A']);
      const after = held.effect;
      console.log('retained-native-metadata', Object.is(before, after));
      expect(after).toBe(before);
    },
  });
  try {
    tree.$.rows.addOne({ id: 'A', n: 1 });
    expect(callbacks).toBe(1);
  } finally {
    stop();
    tree.destroy();
  }
});

it('current-read real tap queries evaluate each recipe once across held ABA writes', async () => {
  const tree = signalTree({rows:entityMap<{id:string;n:number}, string>()}, {enhancers:[transactions()]});
  const rows = tree.$.rows; rows.setAll([{id:'A',n:1},{id:'C',n:3}]);
  let armed = false, callbacks = 0;
  const stop = rows.tap({onRemove: id => {
    if (!armed || id !== 'D') return; callbacks++;
    let predicates = 0;
    const query = rows.where(row => {predicates++; return row.n > 0;});
    const nested = rows.find(row => row.id === 'C');
    for (const n of [3,9,3]) {
      rows.updateOne('C',{n}); const before = predicates;
      const value = query.value;
      expect(predicates-before).toBe(2);
      expect(value.map(row => row.id)).toEqual(['A','C']);
      expect(value.find(row => row.id === 'C')?.n).toBe(n);
      expect(nested.value?.n).toBe(n);
    }
    let failures = 0, shouldThrow = true;
    const error = new Error('query sentinel');
    const throwing = rows.where(() => {failures++; if (shouldThrow) throw error; return true;});
    expect(() => throwing.value).toThrow(error); expect(failures).toBe(1);
    shouldThrow = false; const before = failures;
    expect(throwing.value.length).toBe(2); expect(failures-before).toBe(2);
  }});
  try {
    const pending = tree.transact(() => rows.addOne({id:'D',n:4}));
    await Promise.resolve(); armed = true; pending.rollback(); await Promise.resolve();
    expect(callbacks).toBe(1);
  } finally {stop();tree.destroy();}
});
