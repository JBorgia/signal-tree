import { expect, it } from 'vitest';
import { effect, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { entityMap, signalTree, transactions } from '../index';

it('public callback discriminator sees restored library selection before choosing newer C', async () => {
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
  const read = () => ({
    activeId: rows.activeId(),
    ids: [...rows.ids()],
    all: rows.all().map((row) => ({ ...row })),
    directA: rows.byId('A')?.()?.n ?? null,
  });
  expect(read()).toEqual({
    activeId: 'A',
    ids: ['A', 'C'],
    all: [
      { id: 'A', n: 1 },
      { id: 'C', n: 3 },
    ],
    directA: 1,
  });
  const seen: ReturnType<typeof read>[] = [];
  TestBed.configureTestingModule({});
  const observer = runInInjectionContext(TestBed.inject(Injector), () =>
    effect(() => {
      seen.push(read());
    })
  );
  TestBed.tick();
  const callbacks: ReturnType<typeof read>[] = [];
  let armed = false;
  const untap = rows.tap({
    onRemove: (id) => {
      if (armed && id === 'D') {
        callbacks.push(read());
        rows.setActiveId('C');
      }
    },
  });
  try {
    const pending = tree.transact(() => {
      rows.changeId('A', 'X');
      rows.addOne({ id: 'D', n: 4 });
    });
    await Promise.resolve();
    TestBed.tick();
    expect(read().activeId).toBe('X');
    expect(read().ids).toEqual(['X', 'C', 'D']);
    armed = true;
    pending.rollback();
    await Promise.resolve();
    TestBed.tick();
    const final = read();
    console.log(
      'selection-public-angular',
      JSON.stringify({ callbacks, final, seen })
    );
    expect(callbacks).toEqual([
      {
        activeId: 'A',
        ids: ['A', 'C'],
        all: [
          { id: 'A', n: 1 },
          { id: 'C', n: 3 },
        ],
        directA: 1,
      },
    ]);
    expect(final).toEqual({
      activeId: 'C',
      ids: ['A', 'C'],
      all: [
        { id: 'A', n: 1 },
        { id: 'C', n: 3 },
      ],
      directA: 1,
    });
    expect(seen.at(-1)).toEqual(final);
  } finally {
    untap();
    observer.destroy();
    TestBed.resetTestingModule();
    tree.destroy();
  }
});
