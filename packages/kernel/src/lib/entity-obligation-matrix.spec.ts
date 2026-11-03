// Prewritten for entity integration from scalar checkpoint0135ef18.
import { expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import { withWriteContext } from './write-context';

type Receipt = { read(): Readonly<{ state: string; reason?: string; basis?: string }> };
type Experimental = ReturnType<typeof link> & { declare(input: { kind: 'independent' } | { kind: 'dependent'; owners: readonly object[] }, work: () => unknown): Receipt };
const scalar = () => signalTree({ x: 0 }, { enhancers: [transactions()] });
const entity = () => {
  const tree = signalTree({ rows: entityMap<{ id: string; n: number }, string>() }, { enhancers: [transactions()] });
  tree.$.rows.addOne({ id: 'a', n: 1 });
  return tree;
};
const flush = async () => { getPathNotifier().flushSync(); for (let i = 0; i < 120; i++) await Promise.resolve(); };

for (const first of ['destination', 'input'] as const)
for (const saved of [false, true])
it(`entity destination keeps input obligation: ${first} first, saved=${saved}`, async () => {
  const source = scalar(); const target = entity(); const late = scalar(); await flush();
  const sent: unknown[] = []; const c = link(target.$.rows.byIdOrFail('a').n, { set: v => { sent.push(v); } });
  try {
    const q = source.transact(() => source.$.x(7)); const retained = source.$.x();
    const p = target.transact(() => target.$.rows.updateOne('a', { n: saved ? retained : source.$.x() }));
    const r = late.transact(() => late.$.x(9)); const pendingR = r.inspect();
    await flush(); expect(sent).toEqual([]);
    if (first === 'destination') p.confirm(); else q.confirm();
    await flush(); expect(sent).toEqual([]);
    if (first === 'destination') q.confirm(); else p.confirm();
    await flush(); expect(sent).toEqual([7]); expect(r.inspect()).toEqual(pendingR); await c.settled();
  } finally { c.dispose(); target.destroy(); source.destroy(); late.destroy(); }
});

it('qualified literal entity write inside p progresses while unrelated q remains pending', async () => {
  const source = scalar(); const target = entity(); await flush();
  const sent: unknown[] = []; const c = link(target.$.rows.byIdOrFail('a').n, { set: v => { sent.push(v); } }) as Experimental;
  try {
    const q = source.transact(() => source.$.x(7)); const pendingQ = q.inspect(); let receipt: Receipt | undefined;
    const p = target.transact(() => { receipt = c.declare({ kind: 'independent' }, () => target.$.rows.updateOne('a', { n: 8 })); });
    await flush(); expect(sent).toEqual([]); expect(receipt?.read()).toMatchObject({ state: 'held' });
    p.confirm(); await flush(); expect(sent).toEqual([8]); expect(receipt?.read()).toMatchObject({ state: 'started', basis: 'declared' });
    expect(q.inspect()).toEqual(pendingQ); await c.settled();
  } finally { c.dispose(); target.destroy(); source.destroy(); }
});

for (const input of ['field', 'row'] as const)
for (const timing of ['pending', 'confirmed-before', 'confirmed-inside'] as const)
it(`${input} callback captures terminal obligation at consumption: ${timing}`, async () => {
  const source = entity(); const target = scalar(); const late = scalar(); await flush();
  const sent: unknown[] = []; const c = link(target.$.x, { set: v => { sent.push(v); } }) as Experimental;
  try {
    const p = source.transact(() => source.$.rows.updateOne('a', { n: 7 }));
    if (timing === 'confirmed-before') { p.confirm(); await flush(); }
    let receipt: Receipt | undefined; let caught: unknown; let calls = 0;
    try {
      receipt = c.declare({ kind: 'independent' }, () => {
        const row = source.$.rows.byIdOrFail('a');
        if (input === 'field') row.n(value => { calls++; if (timing === 'confirmed-inside') p.confirm(); target.$.x(value + 1); return value; });
        else row(value => { calls++; if (timing === 'confirmed-inside') p.confirm(); target.$.x(value.n + 1); return value; });
      });
    } catch (error) { caught = error; }
    expect(calls).toBe(1); expect(target.$.x()).toBe(8);
    if (timing === 'confirmed-before') expect(caught).toBeUndefined();
    else expect(caught).toMatchObject({ stage: 'after-callback', reason: 'contradiction' });
    const q = late.transact(() => late.$.x(9)); const pendingQ = q.inspect();
    await flush();
    if (timing === 'pending') { expect(sent).toEqual([]); p.confirm(); await flush(); }
    expect(sent).toEqual([8]);
    if (timing === 'confirmed-before') expect(receipt?.read()).toMatchObject({ state: 'started', basis: 'declared' });
    expect(q.inspect()).toEqual(pendingQ); await c.settled();
  } finally { c.dispose(); target.destroy(); source.destroy(); late.destroy(); }
});

it('rejected foreign input reevaluates ordinary entity truth without publishing inspected display', async () => {
  const source = scalar(); const target = entity(); const late = scalar(); await flush();
  const sent: unknown[] = []; const c = link(target.$.rows.byIdOrFail('a').n, { set: v => { sent.push(v); } });
  try {
    const q = source.transact(() => source.$.x(7));
    const p = target.transact(() => target.$.rows.updateOne('a', { n: source.$.x() }));
    const r = late.transact(() => late.$.x(9)); const pendingR = r.inspect();
    withWriteContext({ participation: 'inspection' }, () => target.$.rows.updateOne('a', { n: 99 }));
    p.confirm(); await flush(); expect(sent).toEqual([]);
    q.rollback(); await flush(); expect(target.$.rows.byIdOrFail('a').n()).toBe(99);
    expect(sent).toEqual([7]); expect(r.inspect()).toEqual(pendingR); await c.settled();
  } finally { c.dispose(); target.destroy(); source.destroy(); late.destroy(); }
});

it('native entity input remains source-owned after its only recipient is disposed', async () => {
  const source = entity(); const target = scalar(); await flush();
  const unused = link(source.$.rows.byIdOrFail('a').n, { set: () => undefined });
  const sent: unknown[] = []; const c = link(target.$.x, { set: v => { sent.push(v); } }) as Experimental;
  try {
    const p = source.transact(() => source.$.rows.updateOne('a', { n: 7 })); unused.dispose();
    expect(() => c.declare({ kind: 'independent' }, () => {
      source.$.rows.byIdOrFail('a')(value => { target.$.x(value.n + 1); return value; });
    })).toThrow(expect.objectContaining({ reason: 'contradiction' }));
    await flush(); expect(sent).toEqual([]); p.confirm(); await flush(); expect(sent).toEqual([8]); await c.settled();
  } finally { unused.dispose(); c.dispose(); target.destroy(); source.destroy(); }
});
