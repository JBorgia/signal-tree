import { expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import { withWriteContext } from './write-context';

type Receipt = { read(): Readonly<{ state: string; reason?: string; basis?: string }> };
type Experimental = ReturnType<typeof link> & {
  declare(input: { kind: 'independent' }, work: () => unknown): Receipt;
};
const make = () => signalTree({ x: 0 }, { enhancers: [transactions()] });
const flush = async () => { getPathNotifier().flushSync(); for (let i = 0; i < 48; i++) await Promise.resolve(); };

it('inherited possible-p is not erased by a new destination owned by the same p', async () => {
  const target = make(); const uncertain = make(); const late = make();
  const sent: number[] = []; const c = link(target.$.x, { set: value => { sent.push(value); } }) as Experimental;
  let receipt: Receipt | undefined;
  try {
    const p = target.transact(() => {
      // Controlled enhancer boundary: omit the ambient transaction metadata on
      // this other source's write while p is pending. This supplies W(p), not
      // D(p), and is not claimed as an ordinary application-level trigger.
      withWriteContext({}, () => uncertain.$.x(7));
      receipt = c.declare({ kind: 'independent' }, () => {
        uncertain.updateAndReport(input => { target.$.x(input.x + 1); return {}; });
      });
    });
    const r = late.transact(() => late.$.x(9)); const pendingR = r.inspect();
    await flush(); expect(target.$.x()).toBe(8); expect(sent).toEqual([]);
    expect(receipt?.read()).toMatchObject({ state: 'conservative', reason: 'unknown' });
    p.confirm(); await flush(); expect(sent).toEqual([8]);
    expect(receipt?.read()).toMatchObject({ state: 'started', basis: 'surviving' });
    expect(r.inspect()).toEqual(pendingR); await c.settled();
  } finally { c.dispose(); target.destroy(); uncertain.destroy(); late.destroy(); }
});

it('consuming an earlier p-authored value creates an input obligation even for destination p', async () => {
  const target = make(); const sent: number[] = [];
  const c = link(target.$.x, { set: value => { sent.push(value); } }) as Experimental;
  let caught: unknown;
  try {
    const p = target.transact(() => {
      target.$.x(7);
      try { c.declare({ kind: 'independent' }, () => target.$.x(input => input + 1)); }
      catch (error) { caught = error; }
    });
    expect(caught).toMatchObject({ stage: 'after-callback', reason: 'contradiction' });
    await flush(); expect(target.$.x()).toBe(8); expect(sent).toEqual([]);
    p.confirm(); await flush(); expect(sent).toEqual([8]); await c.settled();
  } finally { c.dispose(); target.destroy(); }
});
