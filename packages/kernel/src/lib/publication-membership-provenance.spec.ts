import { expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
type Receipt = { read(): Readonly<{ state: string; reason?: string; basis?: string }> };
type Experimental = ReturnType<typeof link> & {
  declare(input: { kind: 'independent' } | { kind: 'dependent'; owners: readonly object[] }, work: () => unknown): Receipt;
};
const flush = async () => { getPathNotifier().flushSync(); for (let i = 0; i < 48; i++) await Promise.resolve(); };
for (const initialConnection of ['live', 'disposed-before-enrollment'] as const)
for (const projection of ['branch', 'root'] as const)
it(`native ordinary membership survives ${initialConnection}/${projection}`, async () => {
  const owner = signalTree({ z: 0 }, { enhancers: [transactions()] });
  const t = signalTree({ a: { x: 7, y: 0 } as { x?: number; y: number } });
  const old = link(t.$.a, { set: () => { /* Destination values are intentionally discarded in this protocol fixture. */ } }) as Experimental;
  const p = owner.transact(() => owner.$.z(7));
  const sent: unknown[] = [];
  let current: Experimental | undefined;
  try {
    old.declare({ kind: 'dependent', owners: [p] }, () => t.$.a({ y: 0 }));
    await flush(); expect(t.$.a()).toEqual({ y: 0 });
    if (initialConnection === 'disposed-before-enrollment') old.dispose();
    current = link(projection === 'branch' ? t.$.a : t.$, { set: value => { sent.push(value); } }) as Experimental;
    const receipt = current.declare({ kind: 'independent' }, () => t.$.a.y(1));
    await flush(); expect(t.$.a()).toEqual({ y: 1 });
    expect(sent).toEqual([]);
    expect(receipt.read()).toMatchObject({ state: 'held', reason: 'pending-dependency' });
    p.confirm(); await flush();
    expect(sent).toEqual([projection === 'branch' ? { y: 1 } : { a: { y: 1 } }]);
    expect(receipt.read()).toMatchObject({ state: 'started' });
    await current.settled();
  } finally { old.dispose(); current?.dispose(); t.destroy(); owner.destroy(); }
});
