import { signal, type Signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { entityMap, leaf, signalTree } from '../index';

function createFeature<
  K extends string | number,
  E extends { id: K },
  F extends object
>(filter: F) {
  return signalTree(
    {
      feature: {
        rows: entityMap<E, K>({ selectId: (entity) => entity.id }).computed(
          'rowKeys',
          (rows) => rows.map((row) => row.id)
        ),
        filter: leaf(filter),
      },
    },
    { derived: ($) => ({ filterCopy: () => $.feature.filter() }) }
  );
}

describe('Angular opaque construction boundaries', () => {
  it('preserves a generic filter by identity and materializes generic entity slices', () => {
    const external = signal('open');
    const filter = { status: external };
    const tree = createFeature<
      number,
      { id: number; title: string },
      typeof filter
    >(filter);
    try {
      expect(tree.$.feature.filter()).toBe(filter);
      expect(tree.$.filterCopy()).toBe(filter);
      tree.$.feature.rows.addOne({ id: 7, title: 'Ticket' });
      expect(tree.$.feature.rows.rowKeys()).toEqual([7]);
      expect(tree.$.feature.rows.byId(7)?.title()).toBe('Ticket');
      external.set('closed');
      expect(tree.$.feature.filter().status()).toBe('closed');
    } finally {
      tree.destroy();
    }
  });

  it('stores an ordinary function returning a signal without invoking it', () => {
    let calls = 0;
    const factory = (count: number): Signal<number> => {
      calls += 1;
      return signal(count);
    };
    const tree = signalTree({ factory });
    try {
      expect(calls).toBe(0);
      expect(tree.$.factory()).toBe(factory);
      expect(calls).toBe(0);
      expect(tree.$.factory()(3)()).toBe(3);
      expect(calls).toBe(1);
    } finally {
      tree.destroy();
    }
  });
});
