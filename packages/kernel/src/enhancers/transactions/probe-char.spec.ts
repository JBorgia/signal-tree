import { describe, expect, it } from 'vitest';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';
type Row = { id: string; name: string };
const make = () => signalTree({ rows: entityMap<Row, string>({ selectId: (r) => r.id }) }, { enhancers: [transactions()] }) as any;
const t = () => Promise.resolve();

const run = async (body: (s: any) => void, flush: boolean) => {
  const s = make();
  s.$.rows.addOne({ id: 'a', name: 'Alpha' });
  await t(); await t();
  const p = s.transaction(() => body(s));
  if (flush) await t();
  p.rollback();
  await t();
  return { ids: s.$.rows.ids(), a: s.$.rows.byId('a')?.()?.name, a2: s.$.rows.byId('a2')?.()?.name };
};

describe('characterise', () => {
  it('all four', async () => {
    for (const flush of [false, true]) {
      console.log(`flush=${flush} rekey+remove :`, JSON.stringify(await run((s) => { s.$.rows.changeId('a','a2'); s.$.rows.removeOne('a2'); }, flush)));
      console.log(`flush=${flush} rekey+update :`, JSON.stringify(await run((s) => { s.$.rows.changeId('a','a2'); s.$.rows.updateOne('a2',{name:'Changed'}); }, flush)));
      console.log(`flush=${flush} rekey only   :`, JSON.stringify(await run((s) => { s.$.rows.changeId('a','a2'); }, flush)));
      console.log(`flush=${flush} remove only  :`, JSON.stringify(await run((s) => { s.$.rows.removeOne('a'); }, flush)));
    }
    expect(true).toBe(true);
  });
});
