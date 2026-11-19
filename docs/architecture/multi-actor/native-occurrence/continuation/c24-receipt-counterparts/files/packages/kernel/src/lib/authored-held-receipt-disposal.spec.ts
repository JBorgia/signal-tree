// Separate authored-revision counterweight to the equal/no-write counterparts.
// Test-only C23 public-shaped capability; no runtime internals or execution claim.
import { expect, it } from 'vitest';
import { link, signalTree, transactions, type PendingTransaction } from '../index';

type State = Readonly<{ state: string; reason?: string; basis?: string }>;
type Receipt = Readonly<{ read: () => State }>;
type DeclaredLink = ReturnType<typeof link> & {
  declare(input: { kind: 'dependent'; owners: readonly PendingTransaction[] }, work: () => void): Receipt;
};
const drain = async () => {
  for (let i = 0; i < 120; i++) await Promise.resolve();
};

it('disposing a genuinely authored dependent revision terminates its held receipt and releases the waiter', async () => {
  const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
  const sent: number[] = [];
  const connection = link(tree.$.y, { set: (value) => { sent.push(value); } });
  expect(typeof Reflect.get(connection, 'declare')).toBe('function');
  const c = connection as DeclaredLink;
  try {
    const p = tree.transact(() => tree.$.x(7));
    await drain();
    const ownership = p.inspect();
    expect(tree.$()).toEqual({ x: 7, y: 0 });
    expect(sent).toEqual([]);
    let calls = 0;
    // Changed y0 -> y7, with an authentic pending contributor: not an equal no-op.
    const receipt = c.declare({ kind: 'dependent', owners: [p] }, () => {
      calls++;
      tree.$.y(tree.$.x());
    });
    await drain();
    expect(calls).toBe(1);
    expect(tree.$()).toEqual({ x: 7, y: 7 });
    expect(p.inspect()).toEqual(ownership);
    expect(sent).toEqual([]);
    const held = receipt.read();
    expect(held).toEqual({ state: 'held', reason: 'pending-dependency' });
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(Object.isFrozen(held)).toBe(true);
    let settled = false;
    const wait = c.settled().then(() => { settled = true; });
    await drain();
    expect(settled).toBe(false);
    c.dispose();
    await drain();
    expect(settled).toBe(true);
    await wait;
    expect(receipt.read()).toEqual({ state: 'disposed' });
    expect(Object.isFrozen(receipt.read())).toBe(true);
    expect(held).toEqual({ state: 'held', reason: 'pending-dependency' });
    expect(p.inspect()).toEqual(ownership);
    expect(tree.$()).toEqual({ x: 7, y: 7 });
    expect(sent).toEqual([]);
    p.rollback();
    await drain();
    expect(tree.$()).toEqual({ x: 0, y: 7 });
    expect(receipt.read()).toEqual({ state: 'disposed' });
    expect(sent).toEqual([]);
    tree.$.y(9);
    await drain();
    expect(tree.$.y()).toBe(9);
    expect(receipt.read()).toEqual({ state: 'disposed' });
    expect(sent).toEqual([]);
  } finally { c.dispose(); tree.destroy(); }
});
