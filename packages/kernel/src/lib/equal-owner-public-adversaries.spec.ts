// Test-only public-kernel packet against C23. Unexecuted; not a shipping type gate.
import { expect, it } from 'vitest';
import { link, signalTree, transactions, type PendingTransaction } from '../index';

type State = Readonly<{ state: string; basis?: string; reason?: string }>;
type Receipt = Readonly<{ read: () => State }>;
type Declaration = { kind: 'independent' } | { kind: 'dependent'; owners: readonly PendingTransaction[] };
type DeclaredLink = ReturnType<typeof link> & {
  declare(input: Declaration, work: () => unknown): Receipt;
};
function declared(connection: ReturnType<typeof link>): DeclaredLink {
  expect(typeof Reflect.get(connection, 'declare')).toBe('function');
  return connection as DeclaredLink;
}
const drain = async () => {
  for (let i = 0; i < 120; i++) await Promise.resolve();
};
const caught = (work: () => unknown): unknown => {
  try { work(); } catch (error) { return error; }
  return undefined;
};

it.each(['independent', 'dependent'] as const)(
  'pending native ancestor input is respected by a %s declaration',
  async (kind) => {
    const tree = signalTree({ x: 0, pair: { x: 0, y: 0 } }, { enhancers: [transactions()] });
    const sent: { x: number; y: number }[] = [];
    const c = declared(link(tree.$.pair, { set: (value) => { sent.push({ ...value }); } }));
    try {
      const p = tree.transact(() => tree.$.x(7));
      await drain();
      const ownership = p.inspect();
      expect(sent).toEqual([]);
      let calls = 0;
      let receipt: Receipt | undefined;
      const error = caught(() => {
        receipt = c.declare(kind === 'independent' ? { kind } : { kind, owners: [p] }, () => {
          tree.$((input) => {
            calls++;
            expect(input.x).toBe(7);
            return { ...input, pair: { x: input.x, y: input.pair.y } };
          });
        });
      });
      expect(calls).toBe(1);
      if (kind === 'independent') {
        expect(error).toMatchObject({
          code: 'SIGNALTREE_PUBLICATION_DECLARATION_INVALID',
          stage: 'after-callback', reason: 'contradiction',
        });
        expect(receipt).toBeUndefined();
      } else {
        expect(error).toBeUndefined();
        if (!receipt) throw new Error('Dependent declaration returned no receipt');
        expect(Object.isFrozen(receipt)).toBe(true);
        expect(Object.isFrozen(receipt.read())).toBe(true);
      }
      // Contradiction is not rollback of the callback's installed writes.
      expect(tree.$.pair()).toEqual({ x: 7, y: 0 });
      expect(tree.$.x()).toBe(7);
      expect(p.inspect()).toEqual(ownership);
      await drain();
      if (kind === 'dependent') expect(receipt?.read()).toEqual({ state: 'conservative', reason: 'unknown' });
      expect(sent).toEqual([]);
      let settled = false;
      const wait = c.settled().then(() => { settled = true; });
      await drain();
      expect(settled).toBe(false);
      p.confirm();
      await drain();
      expect(sent).toEqual([{ x: 7, y: 0 }]);
      expect(settled).toBe(true);
      await wait;
      if (kind === 'dependent') expect(receipt?.read()).toEqual({ state: 'started', basis: 'surviving' });
      await drain();
      expect(sent).toEqual([{ x: 7, y: 0 }]);
    } finally { c.dispose(); tree.destroy(); }
  }
);

it('a genuinely changed independent successor supersedes the older owned contribution', async () => {
  const tree = signalTree({ x: 0, sibling: 0 }, { enhancers: [transactions()] });
  const sent: number[] = [];
  const c = declared(link(tree.$.x, { set: (value) => { sent.push(value); } }));
  try {
    const p = tree.transact(() => { tree.$.x(7); tree.$.sibling(4); });
    await drain();
    expect(sent).toEqual([]);
    expect(tree.$()).toEqual({ x: 7, sibling: 4 });
    // Changed ordinary7 -> ordinary9: deliberately NOT the equal-owner case.
    const fresh = c.declare({ kind: 'independent' }, () => tree.$.x(9));
    await drain();
    expect(tree.$()).toEqual({ x: 9, sibling: 4 });
    expect(sent).toEqual([9]);
    expect(fresh.read()).toEqual({ state: 'started', basis: 'declared' });
    await c.settled();
    // Same-location replacement survives; untouched owned sibling compensates.
    expect(() => p.rollback()).not.toThrow();
    await drain();
    expect(tree.$()).toEqual({ x: 9, sibling: 0 });
    expect(sent).toEqual([9]);
    tree.$.x(10);
    await drain();
    await c.settled();
    expect(sent).toEqual([9, 10]);
    expect(fresh.read()).toEqual({ state: 'started', basis: 'declared' });
  } finally { c.dispose(); tree.destroy(); }
});

it('acknowledging an earlier send does not release a newer owner-held equal whole write', async () => {
  const tree = signalTree({ pair: { x: 0, y: 0 } }, { enhancers: [transactions()] });
  const sent: { x: number; y: number }[] = [];
  let releaseFirst!: () => void;
  const firstAck = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const c = declared(link(tree.$.pair, {
    set: (value) => {
      sent.push({ ...value });
      return sent.length === 1 ? firstAck : Promise.resolve();
    },
  }));
  try {
    tree.$.pair.x(1);
    await drain();
    expect(sent).toEqual([{ x: 1, y: 0 }]); // Endpoint really started and is unresolved.
    const p = tree.transact(() => tree.$.pair.x(7));
    await drain();
    const ownership = p.inspect();
    const held = c.declare({ kind: 'independent' }, () => tree.$.pair({ x: 7, y: 0 }));
    await drain();
    expect(tree.$.pair()).toEqual({ x: 7, y: 0 });
    expect(p.inspect()).toEqual(ownership);
    expect(sent).toEqual([{ x: 1, y: 0 }]);
    expect(held.read()).toEqual({ state: 'no-write' });
    let settled = false;
    const wait = c.settled().then(() => { settled = true; });
    releaseFirst();
    await drain();
    expect(settled).toBe(false);
    expect(p.inspect()).toEqual(ownership);
    expect(sent).toEqual([{ x: 1, y: 0 }]);
    expect(held.read()).toEqual({ state: 'no-write' });
    p.confirm();
    await drain();
    expect(sent).toEqual([{ x: 1, y: 0 }, { x: 7, y: 0 }]);
    expect(settled).toBe(true);
    await wait;
    expect(held.read()).toEqual({ state: 'no-write' });
    await drain();
    expect(sent).toEqual([{ x: 1, y: 0 }, { x: 7, y: 0 }]);
    c.dispose();
    expect(held.read()).toEqual({ state: 'no-write' });
  } finally { releaseFirst(); c.dispose(); tree.destroy(); }
});

it('return-shape getter reentry stays in the horizon but cannot poison a later declaration', async () => {
  const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
  const later = signalTree({ n: 0 });
  const sent: number[] = [], freshSent: number[] = [];
  const c = declared(link(tree.$.y, { set: (value) => { sent.push(value); } }));
  const fresh = declared(link(later.$.n, { set: (value) => { freshSent.push(value); } }));
  try {
    const p = tree.transact(() => tree.$.x(7));
    const ownership = p.inspect();
    let getters = 0, nestedCalls = 0;
    const error = caught(() => c.declare({ kind: 'independent' }, () => ({
      get then() {
        getters++;
        c.declare({ kind: 'dependent', owners: [p] }, () => { nestedCalls++; tree.$.y(7); });
        return undefined; // Not async; the nested declared dependency is the contradiction.
      },
    })));
    expect(error).toMatchObject({
      code: 'SIGNALTREE_PUBLICATION_DECLARATION_INVALID',
      stage: 'after-callback', reason: 'contradiction',
    });
    expect(getters).toBe(1);
    expect(nestedCalls).toBe(1);
    await drain();
    expect(tree.$()).toEqual({ x: 7, y: 7 });
    expect(p.inspect()).toEqual(ownership);
    expect(sent).toEqual([]);
    const recovery = fresh.declare({ kind: 'independent' }, () => later.$.n(1));
    await drain();
    expect(freshSent).toEqual([1]);
    expect(recovery.read()).toEqual({ state: 'started', basis: 'declared' });
    expect(p.inspect()).toEqual(ownership); // Recovery did not settle the original owner.
    await fresh.settled();
    expect(sent).toEqual([]);
    c.dispose();
    p.rollback();
    await drain();
    expect(tree.$()).toEqual({ x: 0, y: 7 });
    expect(sent).toEqual([]);
    expect(freshSent).toEqual([1]);
  } finally { c.dispose(); fresh.dispose(); tree.destroy(); later.destroy(); }
});

it('primary callback error survives nested contradiction and exited context does not leak', async () => {
  const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
  const later = signalTree({ n: 0 });
  const sent: number[] = [], freshSent: number[] = [];
  const c = declared(link(tree.$.y, { set: (value) => { sent.push(value); } }));
  const fresh = declared(link(later.$.n, { set: (value) => { freshSent.push(value); } }));
  const primary = Object.freeze({ failure: 'public callback primary' });
  try {
    const p = tree.transact(() => tree.$.x(7));
    const ownership = p.inspect();
    let nestedCalls = 0;
    const error = caught(() => c.declare({ kind: 'independent' }, () => {
      c.declare({ kind: 'dependent', owners: [p] }, () => { nestedCalls++; tree.$.y(7); });
      tree.$.y(8);
      throw primary;
    }));
    expect(error).toBe(primary);
    expect(nestedCalls).toBe(1);
    await drain();
    expect(tree.$()).toEqual({ x: 7, y: 8 });
    expect(p.inspect()).toEqual(ownership);
    expect(sent).toEqual([]);
    const recovery = fresh.declare({ kind: 'independent' }, () => later.$.n(2));
    await drain();
    expect(freshSent).toEqual([2]);
    expect(recovery.read()).toEqual({ state: 'started', basis: 'declared' });
    expect(p.inspect()).toEqual(ownership);
    await fresh.settled();
    expect(sent).toEqual([]);
    c.dispose();
    p.rollback();
    await drain();
    expect(tree.$()).toEqual({ x: 0, y: 8 });
    expect(sent).toEqual([]);
    expect(freshSent).toEqual([2]);
  } finally { c.dispose(); fresh.dispose(); tree.destroy(); later.destroy(); }
});
