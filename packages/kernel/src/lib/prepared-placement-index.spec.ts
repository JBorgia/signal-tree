import { expect, it, vi } from 'vitest';
import { signalTree, entityMap, transactions } from '../index';
import { StructuralStore } from './physical/structural-store';

// Count only private prepared-map iteration, not legitimate full-order output.
for (const size of [32, 128, 512]) {
  for (const operation of ['setAll', 'prependMany'] as const) {
    it(`${operation} resolves ${size} staged keys with linear map work`, () => {
      const original = StructuralStore.prototype.preparePlacement;
      let visits = 0;
      const spy = vi
        .spyOn(StructuralStore.prototype, 'preparePlacement')
        .mockImplementation(function (this: StructuralStore<string | number>) {
          const stage = original.call(this);
          const iterate = stage.patch[Symbol.iterator].bind(stage.patch);
          stage.patch[Symbol.iterator] = () => {
            const iterator = iterate();
            const next = iterator.next.bind(iterator);
            iterator.next = () => {
              const step = next();
              if (!step.done) visits++;
              return step;
            };
            return iterator;
          };
          return stage;
        });
      const tree = signalTree({
        rows: entityMap<{ id: number; n: number }, number>(),
      });
      try {
        const input = Array.from({ length: size }, (_, id) => ({ id, n: id }));
        tree.$.rows[operation](input);
        expect(tree.$.rows.ids()).toEqual(input.map((row) => row.id));
        expect(visits).toBeLessThanOrEqual(2 * size);
      } finally {
        spy.mockRestore();
        tree.destroy();
      }
    });
  }
}

it('keeps replacement lifetime and restored old lifetime key lookup distinct', () => {
  const tree = signalTree(
    { rows: entityMap<{ id: string; n: number }, string>() },
    { enhancers: [transactions()] }
  );
  const rows = tree.$.rows;
  rows.setAll([
    { id: 'a', n: 1 },
    { id: 'b', n: 2 },
  ]);
  const held = rows.byIdOrFail('a');
  try {
    const p = tree.transact(() => {
      rows.removeOne('a');
      rows.prependMany([{ id: 'a', n: 9 }]);
    });
    expect(rows.ids()).toEqual(['a', 'b']);
    expect(held()).toBeUndefined();
    p.rollback();
    expect(rows.ids()).toEqual(['a', 'b']);
    expect(rows.byIdOrFail('a')()).toEqual({ id: 'a', n: 1 });
    expect(held()).toEqual({ id: 'a', n: 1 });
  } finally {
    tree.destroy();
  }
});
