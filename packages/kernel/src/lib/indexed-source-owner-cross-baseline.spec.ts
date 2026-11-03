import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { signalTree, entityMap, transactions, link, type Link } from '../index';
import { withWriteContext } from './write-context';
const tick = async () => {
  for (let i = 0; i < 100; i++) await Promise.resolve();
};
type Row = { id: string; n: number };
describe('indexed source owner connection baselines', () => {
  it('preserves inspection-seeded removal and later latent update adoption', async () => {
    const t = signalTree(
      { rows: entityMap<Row, string>() },
      { enhancers: [transactions()] }
    );
    const r = t.$.rows;
    const sends: Row[][][] = [[], []];
    const cs: Link[] = [];
    try {
      r.addOne({ id: 'a', n: 1 });
      await tick();
      cs.push(
        link(r, {
          set: (v) => {
            sends[0].push(structuredClone(v));
          },
        })
      );
      withWriteContext({ participation: 'inspection' }, () =>
        r.addOne({ id: 'x', n: 9 })
      );
      await tick();
      cs.push(
        link(r, {
          set: (v) => {
            sends[1].push(structuredClone(v));
          },
        })
      );
      r.removeOne('x');
      await tick();
      await Promise.all(cs.map((c) => c.settled()));
      assert.deepEqual(
        sends[1].at(-1)?.map((x) => x.id),
        ['a']
      );
      withWriteContext({ participation: 'inspection' }, () => {
        r.addOne({ id: 'x', n: 9 });
        r.setAll([
          { id: 'x', n: 9 },
          { id: 'a', n: 1 },
        ]);
      });
      await tick();
      r.updateOne('x', { n: 10 });
      await tick();
      await Promise.all(cs.map((c) => c.settled()));
      assert.deepEqual(
        sends[0].at(-1)?.map((x) => x.id),
        ['x', 'a']
      );
      assert.equal(sends[0].at(-1)?.[0].n, 10);
    } finally {
      for (const c of cs) c.dispose();
      t.destroy();
    }
  });
});
