import { describe, expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';

const drain = async () => {
  for (let i = 0; i < 120; i++) await Promise.resolve();
};
type Row = { id: string; n?: number };

describe('angular native entity Link address', () => {
  for (const enhanced of [false, true]) {
    it(`${
      enhanced ? 'enhanced' : 'bare'
    } omission and later authored value progress`, async () => {
      const tree = signalTree(
        { rows: entityMap<Row, string>() },
        { enhancers: enhanced ? [transactions()] : [] }
      );
      tree.$.rows.addOne({ id: 'a', n: 1 });
      await drain();
      const row = tree.$.rows.byIdOrFail('a');
      const field = row.n;
      if (field === undefined) throw new Error('Seeded field handle missing');
      const sent: unknown[] = [];
      const c = link(field, {
        set: (value) => {
          sent.push(value);
        },
      });
      try {
        tree.$.rows.replaceOne('a', { id: 'a' });
        let settled = false;
        const wait = c.settled().then(() => {
          settled = true;
        });
        await drain();
        expect(field()).toBeUndefined();
        expect(sent).toEqual([undefined]);
        expect(settled).toBe(true);
        await wait;
        field.set(4);
        await drain();
        expect(field()).toBe(4);
        expect(sent).toEqual([undefined, 4]);
      } finally {
        c.dispose();
        tree.destroy();
      }
    });
  }
});
