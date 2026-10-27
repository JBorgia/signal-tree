// Diagnostic predecessor analogue. The before-p send is a source-derived prediction,
// not a newly selected product oracle for entity inputs.
import { expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import { withWriteContext } from './write-context';
type Receipt = { read(): Readonly<{ state: string; reason?: string; basis?: string }> };
type Experimental = ReturnType<typeof link> & { declare(input: { kind: 'independent' }, work: () => unknown): Receipt };
const flush = async () => { getPathNotifier().flushSync(); for(let i=0;i<120;i++) await Promise.resolve(); };
it('diagnostic scalar root input inspection uncertainty has no inherited owner window', async () => {
  const source = signalTree({ n: 1 }, { enhancers: [transactions()] });
  const target = signalTree({ value: 0 });
  const late = signalTree({ x: 0 }, { enhancers: [transactions()] });
  await flush();
  const sent: number[] = [];
  const c = link(target.$.value, { set: value => { sent.push(value); } }) as Experimental;
  try {
    const p = source.transact(() => source.$.n(7));
    withWriteContext({ participation: 'inspection' }, () => source.$.n(99));
    await flush(); const pendingP = p.inspect(); let calls = 0;
    const receipt = c.declare({ kind: 'independent' }, () => source.$(input => {
      calls++; expect(input.n).toBe(99); target.$.value(input.n); return input;
    }));
    expect(calls).toBe(1); expect(target.$.value()).toBe(99);
    const immediate = receipt.read();
    expect(immediate).toMatchObject({ state: 'conservative', reason: 'unknown' });
    const q = late.transact(() => late.$.x(9)); const pendingQ = q.inspect();
    await flush();
    console.log('SCALAR-INSPECTION-TIMING', JSON.stringify({ immediate, beforeConfirm: sent, receipt: receipt.read(), pUnchanged: JSON.stringify(p.inspect())===JSON.stringify(pendingP), qUnchanged: JSON.stringify(q.inspect())===JSON.stringify(pendingQ) }));
    expect(sent).toEqual([99]);
    expect(receipt.read()).toMatchObject({ state: 'started', basis: 'surviving' });
    expect(p.inspect()).toEqual(pendingP); expect(q.inspect()).toEqual(pendingQ);
    p.confirm(); await flush(); expect(sent).toEqual([99]); await c.settled();
  } finally { c.dispose(); target.destroy(); source.destroy(); late.destroy(); }
});
