import { expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import { diagnostics } from './experimental-publication/private';

type Receipt = { read(): Readonly<{ state: string; reason?: string; basis?: string }> };
type Experimental = ReturnType<typeof link> & {
  declare(input: { kind: 'independent' | 'unknown' } | { kind: 'dependent'; owners: readonly object[] }, work: () => unknown): Receipt;
};
const flush = async () => { getPathNotifier().flushSync(); for (let i = 0; i < 48; i++) await Promise.resolve(); };
const catchError = (work: () => unknown) => { try { work(); } catch (error) { return error; } return undefined; };

for (const local of [false, true])
it(`adjudicated wider input uses ordinary ${local ? 'local held' : 'foreign independent'} fallback only`, async () => {
  const owner = signalTree({ z: 0 }, { enhancers: [transactions()] });
  const t = signalTree({ x: 0, z: 0, pair: { x: 0, y: 0 } }, { enhancers: [transactions()] });
  const sent: unknown[] = [];
  const c = link(t.$.pair, { set: value => { sent.push(value); } }) as Experimental;
  const p = local ? t.transact(() => t.$.z(7)) : owner.transact(() => owner.$.z(7));
  try {
    const receipt = c.declare({ kind: local ? 'unknown' : 'independent' }, () => t.$(input => ({ ...input, pair: { x: input.x + 1, y: input.pair.y } })));
    await flush();
    expect(t.$.pair()).toEqual({ x: 1, y: 0 });
    if (local) {
      expect(sent).toEqual([]);
      expect(receipt.read()).toMatchObject({ state: 'conservative', reason: 'unknown' });
      p.confirm(); await flush();
    }
    expect(sent).toEqual([{ x: 1, y: 0 }]);
    expect(receipt.read()).toMatchObject({ state: 'started', basis: 'surviving' });
    if (!local) { expect(owner.$.z()).toBe(7); p.confirm(); }
    await c.settled();
  } finally { c.dispose(); t.destroy(); owner.destroy(); }
});

it('disposing a declaring connection does not release foreign input support still used by another', async () => {
  const owner = signalTree({ z: 0 }, { enhancers: [transactions()] });
  const t = signalTree({ pair: { x: 0, y: 0 } });
  const left: unknown[] = [], right: unknown[] = [];
  const a = link(t.$.pair, { set: value => { left.push(value); } }) as Experimental;
  const b = link(t.$.pair, { set: value => { right.push(value); } }) as Experimental;
  const p = owner.transact(() => owner.$.z(7));
  try {
    const receipt = a.declare({ kind: 'dependent', owners: [p] }, () => t.$.pair.x(7));
    await flush(); expect(left).toEqual([]); expect(right).toEqual([]);
    a.dispose(); expect(receipt.read()).toMatchObject({ state: 'disposed' });
    const error = catchError(() => b.declare({ kind: 'independent' }, () => t.$.pair(input => ({ x: input.x, y: 1 }))));
    await flush(); expect(t.$.pair()).toEqual({ x: 7, y: 1 }); expect(right).toEqual([]);
    expect(error).toMatchObject({ stage: 'after-callback', reason: 'contradiction' });
    p.confirm(); await flush(); expect(right).toEqual([{ x: 7, y: 1 }]);
    expect(receipt.read()).toMatchObject({ state: 'disposed' }); await b.settled();
  } finally { a.dispose(); b.dispose(); t.destroy(); owner.destroy(); }
});

it('connection cleanup returns registry counts after repeated validation and pending cycles with receipts retained', async () => {
  await flush(); const before = diagnostics(); const retained: Receipt[] = [];
  for (let cycle = 0; cycle < 12; cycle++) {
    const owner = signalTree({ z: 0 }, { enhancers: [transactions()] });
    const t = signalTree({ y: 0 });
    const c = link(t.$.y, { set: () => { /* Destination values are intentionally discarded in this protocol fixture. */ } }) as Experimental;
    const p = owner.transact(() => owner.$.z(7));
    try {
      retained.push(c.declare({ kind: 'dependent', owners: [p] }, () => t.$.y(7)));
      await flush(); expect(retained.at(-1)?.read()).toMatchObject({ state: 'held' });
      c.dispose(); p.confirm();
    } finally { c.dispose(); t.destroy(); owner.destroy(); }
    await flush();
  }
  expect(retained).toHaveLength(12);
  expect(retained.every(receipt => receipt.read().state === 'disposed')).toBe(true);
  const after = diagnostics();
  for (const key of ['connections', 'operations', 'activeFrames', 'listeners', 'latest', 'ownerCells', 'pendingOwners', 'sources'] as const) {
    expect(after[key], key).toBe(before[key]);
  }
});
