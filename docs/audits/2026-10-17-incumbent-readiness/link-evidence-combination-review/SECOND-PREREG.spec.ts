// Prewritten discriminator matrix. Runtime remains rejected b9eef50d.
import { expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import { withWriteContext } from './write-context';

type Receipt = { read(): Readonly<{ state: string; reason?: string; basis?: string }> };
type Experimental = ReturnType<typeof link> & {
  declare(input: { kind: 'independent' } | { kind: 'dependent'; owners: readonly object[] }, work: () => unknown): Receipt;
};
const make = () => signalTree({ x: 0 }, { enhancers: [transactions()] });
const flush = async () => { getPathNotifier().flushSync(); for (let i = 0; i < 48; i++) await Promise.resolve(); };

for (const input of ['direct', 'saved'] as const)
for (const first of ['destination', 'input'] as const)
it(`${input}: ${first} confirmation alone holds; both confirm delivers with later r pending`, async () => {
  const source = make(); const target = make(); const late = make();
  const sent: number[] = []; const c = link(target.$.x, { set: value => { sent.push(value); } });
  try {
    const q = source.transact(() => source.$.x(7));
    const saved = source.$.x();
    const p = target.transact(() => target.$.x(input === 'saved' ? saved : source.$.x()));
    const r = late.transact(() => late.$.x(9)); const pendingR = r.inspect();
    const pendingP = p.inspect(); const pendingQ = q.inspect();
    await flush(); expect(sent).toEqual([]); expect(target.$.x()).toBe(7);
    expect(p.inspect()).toEqual(pendingP); expect(q.inspect()).toEqual(pendingQ);
    if (first === 'destination') p.confirm(); else q.confirm();
    await flush(); expect(sent).toEqual([]);
    if (first === 'destination') q.confirm(); else p.confirm();
    await flush(); expect(sent).toEqual([7]); expect(target.$.x()).toBe(7);
    expect(r.inspect()).toEqual(pendingR); await c.settled();
  } finally { c.dispose(); target.destroy(); late.destroy(); source.destroy(); }
});

for (const input of ['direct', 'saved'] as const)
for (const first of ['destination', 'input'] as const)
it(`${input}: input rejection ${first === 'input' ? 'before' : 'after'} destination confirmation reevaluates ordinary truth`, async () => {
  const source = make(); const target = make(); const late = make();
  const sent: number[] = []; const c = link(target.$.x, { set: value => { sent.push(value); } });
  try {
    const q = source.transact(() => source.$.x(7)); const saved = source.$.x();
    const p = target.transact(() => target.$.x(input === 'saved' ? saved : source.$.x()));
    const r = late.transact(() => late.$.x(9)); const pendingR = r.inspect();
    withWriteContext({ participation: 'inspection' }, () => target.$.x(99));
    await flush(); expect(sent).toEqual([]); expect(target.$.x()).toBe(99);
    if (first === 'destination') p.confirm(); else q.rollback();
    await flush(); expect(sent).toEqual([]);
    if (first === 'destination') q.rollback(); else p.confirm();
    await flush();
    expect(source.$.x()).toBe(0); expect(target.$.x()).toBe(99);
    expect(sent).toEqual([7]); // Surviving ordinary destination, not displayed99.
    expect(r.inspect()).toEqual(pendingR); await c.settled();
  } finally { c.dispose(); target.destroy(); late.destroy(); source.destroy(); }
});

for (const savedLiteral of [false, true])
it(`qualified independent write in p does not require unrelated q (saved literal=${savedLiteral})`, async () => {
  const source = make(); const target = make(); const late = make();
  const sent: number[] = []; const c = link(target.$.x, { set: value => { sent.push(value); } }) as Experimental;
  try {
    const independent = 8;
    const q = source.transact(() => source.$.x(7)); const pendingQ = q.inspect();
    let receipt: Receipt | undefined;
    // This complete declaration consumes no speculative source input. The
    // destination owner p gates publication but is not a declared input owner.
    const p = target.transact(() => {
      receipt = c.declare({ kind: 'independent' }, () => target.$.x(savedLiteral ? independent : 8));
    });
    const r = late.transact(() => late.$.x(9)); const pendingR = r.inspect();
    await flush(); expect(target.$.x()).toBe(8); expect(sent).toEqual([]);
    expect(receipt?.read().state).toBe('held');
    p.confirm(); await flush(); expect(sent).toEqual([8]);
    expect(receipt?.read()).toMatchObject({ state: 'started', basis: 'declared' });
    const terminal = receipt?.read();
    expect(q.inspect()).toEqual(pendingQ); expect(r.inspect()).toEqual(pendingR);
    q.confirm(); r.rollback(); await flush();
    expect(sent).toEqual([8]); expect(receipt?.read()).toEqual(terminal); await c.settled();
  } finally { c.dispose(); target.destroy(); late.destroy(); source.destroy(); }
});

it('saved input written after its source rejection is new surviving truth, not permanently tainted', async () => {
  const source = make(); const target = make(); const late = make();
  const sent: number[] = []; const c = link(target.$.x, { set: value => { sent.push(value); } });
  try {
    const q = source.transact(() => source.$.x(7)); const saved = source.$.x();
    q.rollback();
    const p = target.transact(() => target.$.x(saved));
    const r = late.transact(() => late.$.x(9)); const pendingR = r.inspect();
    await flush(); expect(source.$.x()).toBe(0); expect(sent).toEqual([]);
    p.confirm(); await flush(); expect(sent).toEqual([7]);
    expect(r.inspect()).toEqual(pendingR); await c.settled();
  } finally { c.dispose(); target.destroy(); late.destroy(); source.destroy(); }
});

it('separating destination ownership cannot erase a known native input contradiction', async () => {
  const source = make(); const target = make();
  const sent: number[] = []; const c = link(target.$.x, { set: value => { sent.push(value); } }) as Experimental;
  try {
    const q = source.transact(() => source.$.x(7)); let caught: unknown;
    const p = target.transact(() => {
      try {
        c.declare({ kind: 'independent' }, () => {
          source.updateAndReport(input => { target.$.x(input.x); return {}; });
        });
      } catch (error) { caught = error; }
    });
    expect(caught).toMatchObject({ stage: 'after-callback', reason: 'contradiction' });
    await flush(); expect(target.$.x()).toBe(7); expect(sent).toEqual([]);
    p.confirm(); await flush(); expect(sent).toEqual([]);
    q.confirm(); await flush(); expect(sent).toEqual([7]); await c.settled();
  } finally { c.dispose(); target.destroy(); source.destroy(); }
});

// Review-added discriminator: newly acquired and inherited uncertainty are not
// interchangeable even when an actual input names the same owner identity.
for (const alsoKnownInput of [false, true])
it(`inherited possible-p remains uncertain with matching actual input=${alsoKnownInput}`, async () => {
  const owner = make(); const uncertain = make(); const target = make(); const late = make();
  const sent: number[] = []; const c = link(target.$.x, { set: value => { sent.push(value); } }) as Experimental;
  try {
    const p = owner.transact(() => owner.$.x(1));
    uncertain.$.x(7); // Unobserved ordinary input acquires W(p), not proven I(p).
    const r = late.transact(() => late.$.x(9)); const pendingR = r.inspect();
    const receipt = c.declare({ kind: 'dependent', owners: [p] }, () => {
      uncertain.updateAndReport(input => {
        if (alsoKnownInput) owner.updateAndReport(known => { target.$.x(input.x + known.x); return {}; });
        else target.$.x(input.x + 1);
        return {};
      });
    });
    await flush(); expect(target.$.x()).toBe(8); expect(sent).toEqual([]);
    expect(receipt.read()).toMatchObject({ state: 'conservative', reason: 'unknown' });
    p.confirm(); await flush(); expect(sent).toEqual([8]);
    expect(receipt.read()).toMatchObject({ state: 'started', basis: 'surviving' });
    expect(r.inspect()).toEqual(pendingR); await c.settled();
  } finally { c.dispose(); target.destroy(); late.destroy(); uncertain.destroy(); owner.destroy(); }
});
