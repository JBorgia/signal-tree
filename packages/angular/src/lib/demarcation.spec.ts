import { effect, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { entityMap, restoration, signalTree, transactions } from '../index';

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

type Row = { id: string; n: number };

const collectionTree = () =>
  signalTree(
    {
      data: { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
      theme: 'light',
    },
    { enhancers: [restoration(), transactions()] }
  );

describe('Angular demarcation', () => {
  it('an Angular effect observes speculative transaction state', async () => {
    const tree = collectionTree();
    await flush();
    const seen: string[] = [];
    const injector = TestBed.inject(Injector);

    runInInjectionContext(injector, () => {
      effect(() => void seen.push(tree.$.theme()));
    });
    TestBed.tick();

    const pending = tree.transaction(() => tree.$.theme.set('speculative'));
    TestBed.tick();
    await flush();

    expect(seen).toContain('speculative');

    pending.rollback();
    TestBed.tick();
    await flush();

    expect(tree.$.theme()).toBe('light');
    expect(seen[seen.length - 1]).toBe('light');
  });
});
