import { expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';

type Receipt = { read(): Readonly<{ state: string; reason?: string; basis?: string }> };
type Experimental = ReturnType<typeof link> & {
  declare(input: { kind: 'independent' } | { kind: 'dependent'; owners: readonly object[] }, work: () => unknown): Receipt;
};
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 48; i++) await Promise.resolve();
};

for (const writer of ['root', 'branch', 'updateAndReport'] as const)
for (const enrollment of ['none', 'late', 'dispose-in-updater'] as const)
for (const claim of ['independent', 'dependent'] as const)
it(`native provenance ${writer}/${enrollment}/${claim}`, async () => {
  const source = signalTree({ pair: { x: 0 }, x: 0 }, { enhancers: [transactions()] });
  const target = signalTree({ y: 0 }, { enhancers: [transactions()] });
  const x = writer === 'branch' ? source.$.pair.x : source.$.x;
  // Original write precedes every connection. Recipient enrollment cannot own it.
  const p = source.transact(() => x(7));
  const sent: number[] = [];
  const c = link(target.$.y, { set: value => { sent.push(value); } }) as Experimental;
  const passive = enrollment === 'none' ? undefined : link(source.$, { set: () => { /* Destination values are intentionally discarded in this protocol fixture. */ } });
  let receipt: Receipt | undefined;
  let error: unknown;
  try {
    const before = p.inspect();
    const copy = (value: number) => {
      if (enrollment === 'dispose-in-updater') passive?.dispose();
      target.$.y(value);
    };
    try {
      receipt = c.declare(claim === 'independent' ? { kind: 'independent' } : { kind: 'dependent', owners: [p] }, () => {
        if (writer === 'branch') source.$.pair(input => { copy(input.x); return { x: 2 }; });
        else if (writer === 'root') source.$(input => { copy(input.x); return { ...input, x: 2 }; });
        else source.updateAndReport(input => { copy(input.x); return { x: 2 }; });
      });
    } catch (caught) { error = caught; }
    await flush();
    expect(x()).toBe(2);
    expect(target.$.y()).toBe(7);
    expect(before.changes).toEqual([{ path: writer === 'branch' ? 'pair.x' : 'x', address: writer === 'branch' ? ['pair', 'x'] : ['x'], subject: undefined, status: 'current' }]);
    expect(p.inspect().changes).toEqual([{ path: writer === 'branch' ? 'pair.x' : 'x', address: writer === 'branch' ? ['pair', 'x'] : ['x'], subject: undefined, status: 'superseded' }]);
    expect(sent).toEqual([]);
    if (claim === 'independent') {
      expect(error).toMatchObject({ stage: 'after-callback', reason: 'contradiction' });
    } else {
      expect(error).toBeUndefined();
      expect(receipt?.read()).toMatchObject({ state: 'held', reason: 'pending-dependency' });
      p.confirm();
      await flush();
      expect(sent).toEqual([7]);
      expect(receipt?.read()).toMatchObject({ state: 'started', basis: 'declared' });
      await c.settled();
    }
  } finally {
    c.dispose(); passive?.dispose(); source.destroy(); target.destroy();
  }
});
