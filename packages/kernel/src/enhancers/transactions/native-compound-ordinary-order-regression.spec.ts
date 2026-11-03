import { describe, expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../../index';
import { withWriteContext } from '../../lib/write-context';
import { getOwnedSubjectIds } from '../../lib/internals/owned-mutation';

const tick = async () => {
  for (let i = 0; i < 100; i++) await Promise.resolve();
};
type Row = { id: string; n: number };

describe('compound ordinary order rejection regression', () => {
  it('keeps untouched inspected order out of the ordinary Link payload after structural rejection', async () => {
    const tree = signalTree(
      { x: 0, rows: entityMap<Row, string>() },
      { enhancers: [transactions()] }
    );
    const rows = tree.$.rows;
    rows.setAll([
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
      { id: 'c', n: 3 },
    ]);
    await tick();
    const sent: Row[][] = [];
    const connection = link(rows, {
      set: (value) => {
        sent.push(structuredClone(value));
      },
    });
    try {
      rows.updateOne('b', { n: 4 });
      await tick();
      await connection.settled();
      const baseline = [
        { id: 'a', n: 1 },
        { id: 'b', n: 4 },
        { id: 'c', n: 3 },
      ];
      expect(sent).toHaveLength(1);
      expect(sent[0]).toEqual(baseline);
      const oldA = rows.byIdOrFail('a'),
        b = rows.byIdOrFail('b');
      withWriteContext({ participation: 'inspection' }, () => {
        rows.removeOne('a');
        rows.addOne({ id: 'x', n: 99 });
        rows.setAll([
          { id: 'c', n: 3 },
          { id: 'b', n: 4 },
          { id: 'x', n: 99 },
        ]);
      });
      await tick();
      await connection.settled();
      expect(rows.ids()).toEqual(['c', 'b', 'x']);
      expect(sent).toHaveLength(1);
      expect(sent.at(-1)).toEqual(baseline);
      const x = rows.byIdOrFail('x');
      const pending = tree.transact(() =>
        rows.setAll([
          { id: 'c', n: 3 },
          { id: 'a', n: 9 },
          { id: 'x', n: 99 },
        ])
      );
      const freshA = rows.byIdOrFail('a'),
        changes = pending.inspect().changes;
      for (const row of [oldA, b, x, freshA]) {
        const subject = getOwnedSubjectIds(row.n)![0];
        expect(changes.some((change) => change.subject === subject)).toBe(true);
      }
      pending.rollback();
      await tick();
      await connection.settled();
      expect(rows.byIdOrFail('a')).toBe(oldA);
      expect(rows.byIdOrFail('b')).toBe(b);
      expect(oldA()).toEqual({ id: 'a', n: 1 });
      expect(b()).toEqual({ id: 'b', n: 4 });
      expect(freshA()).toBeUndefined();
      expect(x()).toBeUndefined();
      expect(rows.byId('x')).toBeUndefined();
      // Physical inspection placement is deliberately not prescribed here.
      // Ordinary egress must preserve the preexisting authored A/B/C order.
      expect(sent.at(-1)).toEqual(baseline);
      expect(
        sent.some((value) => value.some((row) => row.id === 'x' || row.n === 9))
      ).toBe(false);
      rows.updateOne('b', { n: 5 });
      await tick();
      await connection.settled();
      expect(sent.at(-1)).toEqual([
        { id: 'a', n: 1 },
        { id: 'b', n: 5 },
        { id: 'c', n: 3 },
      ]);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});
