import { appendFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { leaf, link, signalTree, transactions } from '../index';
const drain = async () => { for (let i = 0; i < 120; i++) await Promise.resolve(); };
const errorRecord = (error: unknown) => error instanceof Error
  ? Object.assign({ message: error.message }, error) : error ?? null;
const record = (value: unknown) => {
  if (process.env.ST_OPAQUE_INPUT_OUTPUT) appendFileSync(process.env.ST_OPAQUE_INPUT_OUTPUT, JSON.stringify(value) + '\n');
};

for (const named of ['r', 's', 'both'] as const) {
  it(`opaque saved payload r and current holder s are conjunctive: names ${named}`, async () => {
    const source = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const holder = signalTree({ input: leaf({ x: 0 }) }, { enhancers: [transactions()] });
    const target = signalTree({ y: 0 });
    const sent: number[] = [];
    const c = link(target.$.y, { set: value => { sent.push(value); } });
    try {
      const r = source.transact(() => source.$.x(7));
      const saved = source.$();
      const s = holder.transact(() => holder.$.input(saved));
      const beforeR = r.inspect(), beforeS = s.inspect();
      let calls = 0, same = false, error: unknown;
      try {
        c.declare({ kind: 'dependent', owners: named === 'r' ? [r] : named === 's' ? [s] : [r, s] }, () => {
          holder.updateAndReport(current => {
            calls++; same = current.input === saved;
            target.$.y(current.input.x);
            return {};
          });
        });
      } catch (caught) { error = caught; }
      await drain();
      const initial = [...sent];
      const ownersUnchanged = JSON.stringify([r.inspect(), s.inspect()]) === JSON.stringify([beforeR, beforeS]);
      // Settle the sole named owner first: missing responsibility must still hold.
      const first = named === 's' ? s : r, second = named === 's' ? r : s;
      first.confirm(); await drain(); const afterFirst = [...sent];
      second.confirm(); await drain(); await c.settled(); await drain();
      const final = [...sent];
      c.dispose(); target.$.y(8); await drain();
      record({ named, calls, same, ownersUnchanged, error: errorRecord(error), initial, afterFirst, final, afterDispose: sent });
      expect(calls).toBe(1); expect(same).toBe(true); expect(ownersUnchanged).toBe(true);
      expect(saved).toEqual({ x: 7 }); expect(holder.$.input()).toBe(saved);
      expect(initial).toEqual([]); expect(afterFirst).toEqual([]);
      expect(final).toEqual([7]); expect(sent).toEqual([7]); expect(target.$.y()).toBe(8);
      if (named === 'both') expect(error).toBeUndefined();
      else expect(error).toMatchObject({ code: 'SIGNALTREE_PUBLICATION_DECLARATION_INVALID', stage: 'after-callback', reason: 'contradiction' });
    } finally { c.dispose(); target.destroy(); holder.destroy(); source.destroy(); }
  });
}

it('saved opaque payload predating new q is not recertified from its original source', async () => {
  const source = signalTree({ pair: { x: 7 } });
  const saved = source.$();
  const holder = signalTree({ input: leaf(saved) });
  const foreign = signalTree({ q: 0 }, { enhancers: [transactions()] });
  const target = signalTree({ y: 0 });
  const sent: number[] = [];
  const c = link(target.$.y, { set: value => { sent.push(value); } });
  try {
    const q = foreign.transact(() => foreign.$.q(7));
    const ownership = q.inspect(); let authorCalls = 0;
    foreign.updateAndReport(current => { authorCalls++; source.$.pair.x(current.q); return {}; });
    await drain(); let calls = 0, same = false, error: unknown;
    try {
      c.declare({ kind: 'independent' }, () => {
        holder.updateAndReport(current => {
          calls++; same = current.input === saved;
          target.$.y(current.input.pair.x); return {};
        });
      });
    } catch (caught) { error = caught; }
    await drain(); const before = [...sent];
    const ownerUnchanged = JSON.stringify(q.inspect()) === JSON.stringify(ownership);
    q.confirm(); await drain(); await c.settled(); await drain();
    record({ named: 'saved-before-q', authorCalls, calls, same, ownerUnchanged, error: errorRecord(error), before, after: sent });
    expect([authorCalls, calls]).toEqual([1, 1]); expect(same).toBe(true); expect(ownerUnchanged).toBe(true);
    expect(saved).toEqual({ pair: { x: 7 } }); expect(holder.$.input()).toBe(saved);
    expect(sent).toEqual([7]); expect(before).toEqual([7]); expect(error).toBeUndefined();
  } finally { c.dispose(); target.destroy(); foreign.destroy(); holder.destroy(); source.destroy(); }
});
