import { expect, it } from 'vitest';
import { signalTree, entityMap, transactions } from '../index';

for (const count of [16, 64, 256, 1024]) {
  it(`rollback does not rebuild every pending addition prefix at ${count}`, () => {
    const rows = (offset: number) =>
      Array.from({ length: count }, (_, n) => ({ id: n + offset, n }));
    const tree = signalTree(
      { rows: entityMap<{ id: number; n: number }, number>() },
      { enhancers: [transactions()] }
    );
    const original = Array.prototype.map;
    let visits = 0;
    try {
      tree.$.rows.setAll(rows(0));
      const transaction = tree.transact(() => {
        tree.$.rows.setAll(rows(count));
        tree.$.rows.addOne({ id: 0, n: -1 });
      });
      Array.prototype.map = function <T, U>(
        this: T[],
        callback: (value: T, index: number, array: T[]) => U,
        thisArg?: unknown
      ): U[] {
        const first: unknown = this[0];
        if (
          first &&
          typeof first === 'object' &&
          'structural' in first &&
          first.structural === 'add'
        )
          visits += this.length;
        return original.call(this, callback, thisArg) as U[];
      };
      try {
        transaction.rollback();
      } finally {
        Array.prototype.map = original;
      }
      expect(tree.$.rows.ids()).toEqual(rows(0).map((row) => row.id));
      expect(tree.$.rows.all()).toEqual(rows(0));
      expect(visits).toBeLessThanOrEqual(4 * count);
    } finally {
      Array.prototype.map = original;
      tree.destroy();
    }
  });
}
