// Prewritten specification draft. NOT EXECUTED. Intended destination:
// packages/kernel/src/lib/possible-owner-window-contract.spec.ts
// Owner-selected policy at readiness 75c645eb; frozen runtime 2dacae7b unchanged.
import { describe, expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import { withWriteContext } from './write-context';

type Receipt = { read(): Readonly<{ state: string; reason?: string; basis?: string }> };
type Declaration = { kind: 'independent' | 'unknown' } | { kind: 'dependent'; owners: readonly object[] };
type Experimental = ReturnType<typeof link> & {
  declare(input: Declaration, work: () => unknown): Receipt;
};
const experimental = (connection: ReturnType<typeof link>) => connection as Experimental;
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 48; i++) await Promise.resolve();
};
const make = () => signalTree({ x: 0, y: 0, z: 0 }, { enhancers: [transactions()] });
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

// No observed read port is implied by any of these three expressions.
// An updater's supplied old argument does not certify its hidden closure inputs.
describe('fixed possible-owner window at ordinary authorship', () => {
  it.each(['literal', 'direct-copy', 'hidden-updater'] as const)(
    '%s waits for already-pending p, not foreign q opened before delivery',
    async mode => {
      const source = make(); const late = make(); const target = make();
      const sent: number[] = [];
      const c = link(target.$.y, { set: value => { sent.push(value); } });
      try {
        const p = source.transact(() => source.$.x(7));
        const pendingP = p.inspect();
        if (mode === 'literal') target.$.y(7);
        else if (mode === 'direct-copy') target.$.y(source.$.x());
        else target.$.y(() => source.$.x());
        // Deliberately no await/flush between authorship and q's admission.
        const q = late.transact(() => late.$.x(9));
        const pendingQ = q.inspect();
        await flush();
        expect(target.$.y()).toBe(7); expect(sent).toEqual([]);
        expect(p.inspect()).toEqual(pendingP); expect(q.inspect()).toEqual(pendingQ);
        let done = false; const wait = c.settled().then(() => { done = true; });
        await flush(); expect(done).toBe(false);
        p.confirm(); await flush();
        expect(sent).toEqual([7]); expect(done).toBe(true);
        expect(q.inspect()).toEqual(pendingQ); expect(late.$.x()).toBe(9);
        await wait;
      } finally { c.dispose(); target.destroy(); late.destroy(); source.destroy(); }
    }
  );

  it('an empty authored window stays empty when foreign q opens before the queued send', async () => {
    const late = make(); const target = make(); const sent: number[] = [];
    const c = link(target.$.y, { set: value => { sent.push(value); } });
    try {
      target.$.y(7);
      getPathNotifier().flushSync(); // Queue delivery, without starting its promise continuation.
      const q = late.transact(() => late.$.x(9)); const pendingQ = q.inspect();
      await flush(); expect(sent).toEqual([7]);
      expect(q.inspect()).toEqual(pendingQ); await c.settled();
    } finally { c.dispose(); target.destroy(); late.destroy(); }
  });

  it('waits for every captured owner, but not a subsequently opened foreign owner', async () => {
    const a = make(); const b = make(); const late = make(); const target = make();
    const sent: number[] = []; const c = link(target.$.y, { set: value => { sent.push(value); } });
    try {
      const p = a.transact(() => a.$.x(1)); const r = b.transact(() => b.$.x(2));
      target.$.y(7);
      const q = late.transact(() => late.$.x(9)); const pendingQ = q.inspect();
      await flush(); expect(sent).toEqual([]);
      p.confirm(); await flush(); expect(sent).toEqual([]);
      r.confirm(); await flush(); expect(sent).toEqual([7]);
      expect(q.inspect()).toEqual(pendingQ); await c.settled();
    } finally { c.dispose(); target.destroy(); late.destroy(); b.destroy(); a.destroy(); }
  });

  it('successful foreign rejection reevaluates an ordinary copied value that survives', async () => {
    const source = make(); const late = make(); const target = make(); const sent: number[] = [];
    const c = link(target.$.y, { set: value => { sent.push(value); } });
    try {
      const p = source.transact(() => source.$.x(7));
      target.$.y(source.$.x());
      const q = late.transact(() => late.$.x(9)); const pendingQ = q.inspect();
      await flush(); expect(sent).toEqual([]);
      p.rollback(); await flush();
      expect(source.$.x()).toBe(0); expect(target.$.y()).toBe(7);
      expect(sent).toEqual([7]); expect(q.inspect()).toEqual(pendingQ); await c.settled();
    } finally { c.dispose(); target.destroy(); late.destroy(); source.destroy(); }
  });

  it('rejection publishes the fresh restored aggregate, not the old speculative payload', async () => {
    const target = make(); const sent: Array<{ x: number; y: number; z: number }> = [];
    const c = link(target.$, { set: value => { sent.push({ ...value }); } });
    try {
      const p = target.transact(() => target.$.y(7));
      target.$.z(8); // Independent surviving ordinary fact makes the final payload useful.
      await flush(); expect(sent).toEqual([]);
      p.rollback(); await flush();
      expect(target.$()).toEqual({ x: 0, y: 0, z: 8 });
      expect(sent).toEqual([{ x: 0, y: 0, z: 8 }]);
      await c.settled();
    } finally { c.dispose(); target.destroy(); }
  });

  it('owner settlement evaluates ordinary truth rather than an inspection overlay', async () => {
    const source = make(); const target = make(); const sent: number[] = [];
    const c = link(target.$.y, { set: value => { sent.push(value); } });
    try {
      const p = source.transact(() => source.$.x(7)); target.$.y(7);
      withWriteContext({ participation: 'inspection' }, () => target.$.y(99));
      await flush(); expect(target.$.y()).toBe(99); expect(sent).toEqual([]);
      p.confirm(); await flush();
      expect(target.$.y()).toBe(99); expect(sent).toEqual([7]); await c.settled();
    } finally { c.dispose(); target.destroy(); source.destroy(); }
  });

  it('replacement captures its own later window instead of inheriting the old grant', async () => {
    const source = make(); const late = make(); const target = make(); const sent: number[] = [];
    const c = link(target.$.y, { set: value => { sent.push(value); } });
    try {
      const p = source.transact(() => source.$.x(1)); target.$.y(7);
      const q = late.transact(() => late.$.x(9)); target.$.y(8);
      await flush(); expect(sent).toEqual([]);
      p.confirm(); await flush(); expect(sent).toEqual([]); expect(target.$.y()).toBe(8);
      q.confirm(); await flush(); expect(sent).toEqual([8]); await c.settled();
    } finally { c.dispose(); target.destroy(); late.destroy(); source.destroy(); }
  });

  it('a qualified independent replacement does not inherit the superseded unknown window', async () => {
    const source = make(); const late = make(); const target = make(); const sent: number[] = [];
    const c = experimental(link(target.$.y, { set: value => { sent.push(value); } }));
    try {
      const p = source.transact(() => source.$.x(1)); target.$.y(7);
      await flush(); expect(sent).toEqual([]);
      const q = late.transact(() => late.$.x(9));
      const receipt = c.declare({ kind: 'independent' }, () => target.$.y(8));
      await flush(); expect(sent).toEqual([8]);
      expect(receipt.read()).toMatchObject({ state: 'started', basis: 'declared' });
      const terminal = receipt.read();
      p.confirm(); q.rollback(); await flush(); expect(sent).toEqual([8]);
      expect(receipt.read()).toEqual(terminal); await c.settled();
    } finally { c.dispose(); target.destroy(); late.destroy(); source.destroy(); }
  });

  it('a qualified dependent write waits only for its declared and actual inputs', async () => {
    const source = make(); const other = make(); const target = make(); const sent: number[] = [];
    const c = experimental(link(target.$.y, { set: value => { sent.push(value); } }));
    try {
      const p = source.transact(() => source.$.x(7));
      const q = other.transact(() => other.$.x(9)); const pendingQ = q.inspect();
      const receipt = c.declare({ kind: 'dependent', owners: [p] }, () => target.$.y(source.$.x()));
      await flush(); expect(sent).toEqual([]); expect(receipt.read().state).toBe('held');
      p.confirm(); await flush(); expect(sent).toEqual([7]);
      expect(receipt.read()).toMatchObject({ state: 'started', basis: 'declared' });
      expect(q.inspect()).toEqual(pendingQ); await c.settled();
    } finally { c.dispose(); target.destroy(); other.destroy(); source.destroy(); }
  });

  it('endpoint reentry authors a new window without changing the old send eligibility', async () => {
    const source = make(); const late = make(); const target = make(); const sent: number[] = [];
    const c = link(target.$.y, { set: value => {
      sent.push(value); if (value === 7) target.$.y(8);
    } });
    try {
      const p = source.transact(() => source.$.x(1)); target.$.y(7);
      const q = late.transact(() => late.$.x(9));
      await flush(); expect(sent).toEqual([]);
      p.confirm(); await flush(); expect(sent).toEqual([7]); expect(target.$.y()).toBe(8);
      q.confirm(); await flush(); expect(sent).toEqual([7, 8]); await c.settled();
    } finally { c.dispose(); target.destroy(); late.destroy(); source.destroy(); }
  });

  it('eligible queued work progresses after an in-flight request despite a late foreign owner', async () => {
    const source = make(); const late = make(); const target = make(); const first = deferred();
    const sent: number[] = []; const c = link(target.$.y, { set: value => {
      sent.push(value); return value === 1 ? first.promise : undefined;
    } });
    try {
      target.$.y(1); await flush(); expect(sent).toEqual([1]);
      const p = source.transact(() => source.$.x(7)); target.$.y(7);
      const q = late.transact(() => late.$.x(9)); const pendingQ = q.inspect();
      await flush(); expect(sent).toEqual([1]);
      p.confirm(); await flush(); expect(sent).toEqual([1]);
      first.resolve(); await flush(); expect(sent).toEqual([1, 7]);
      expect(q.inspect()).toEqual(pendingQ); await c.settled();
    } finally { first.resolve(); c.dispose(); target.destroy(); late.destroy(); source.destroy(); }
  });

  it('disposing held queued work settles its waiter and prevents later delivery', async () => {
    const source = make(); const target = make(); const sent: number[] = [];
    const c = link(target.$.y, { set: value => { sent.push(value); } });
    try {
      const p = source.transact(() => source.$.x(7)); target.$.y(7); await flush();
      let done = false; const wait = c.settled().then(() => { done = true; });
      await flush(); expect(done).toBe(false); expect(sent).toEqual([]);
      c.dispose(); await flush(); expect(done).toBe(true); await wait;
      p.confirm(); await flush(); expect(sent).toEqual([]); await c.settled();
    } finally { c.dispose(); target.destroy(); source.destroy(); }
  });

  it('disposing in-flight work settles local waiters without resurrecting its queued revision', async () => {
    const source = make(); const target = make(); const first = deferred();
    const sent: number[] = []; const completed: number[] = [];
    const c = link(target.$.y, { set: async value => {
      sent.push(value); if (value === 1) await first.promise; completed.push(value);
    } });
    try {
      target.$.y(1); await flush(); expect(sent).toEqual([1]);
      const p = source.transact(() => source.$.x(7)); target.$.y(7); await flush();
      let done = false; const wait = c.settled().then(() => { done = true; });
      await flush(); expect(done).toBe(false);
      c.dispose(); await flush(); expect(done).toBe(true); expect(completed).toEqual([]); await wait;
      p.confirm(); first.resolve(); await flush();
      expect(sent).toEqual([1]); expect(completed).toEqual([1]); await c.settled();
    } finally { first.resolve(); c.dispose(); target.destroy(); source.destroy(); }
  });

  it('destroying an unresolved captured source is not confirmation or successful rejection', async () => {
    const source = make(); const target = make(); const sent: number[] = [];
    const c = link(target.$.y, { set: value => { sent.push(value); } });
    try {
      source.transact(() => source.$.x(7)); target.$.y(7); await flush(); expect(sent).toEqual([]);
      let done = false; const wait = c.settled().then(() => { done = true; });
      source.destroy(); await flush(); expect(sent).toEqual([]); expect(done).toBe(false);
      c.dispose(); await flush(); expect(done).toBe(true); await wait;
    } finally { c.dispose(); target.destroy(); source.destroy(); }
  });

  it('a late target-local owner still gates ordinary delivery after the foreign window clears', async () => {
    const source = make(); const target = make(); const sent: number[] = [];
    const c = link(target.$.y, { set: value => { sent.push(value); } });
    try {
      const p = source.transact(() => source.$.x(1)); target.$.y(7);
      const q = target.transact(() => target.$.z(9)); const pendingQ = q.inspect();
      await flush(); expect(sent).toEqual([]);
      p.confirm(); await flush(); expect(sent).toEqual([]); expect(q.inspect()).toEqual(pendingQ);
      q.confirm(); await flush(); expect(sent).toEqual([7]); await c.settled();
    } finally { c.dispose(); target.destroy(); source.destroy(); }
  });
});

// A supplied input can carry a fixed uncertainty window without proving that it
// actually consumed the possible owner. Consumption preserves that uncertainty.
for (const qualified of [true, false])
it(`native consumption preserves inherited uncertainty; new declared context=${qualified}`, async () => {
  const owner = make(); const late = make(); const target = make();
  const sent: number[] = [];
  const c = experimental(link(target.$.y, { set: value => { sent.push(value); } }));
  try {
    const p = owner.transact(() => owner.$.x(1));
    target.$.y(7);
    const q = late.transact(() => late.$.x(9)); const pendingQ = q.inspect();
    const consume = () => target.$.y(input => input + 1);
    let receipt: Receipt | undefined;
    if (qualified) expect(() => { receipt = c.declare({ kind: 'independent' }, consume); }).not.toThrow();
    else consume();
    await flush(); expect(target.$.y()).toBe(8); expect(sent).toEqual([]);
    if (qualified) expect(receipt?.read()).toMatchObject({ state: 'conservative', reason: 'unknown' });
    p.confirm(); await flush();
    if (qualified) {
      expect(sent).toEqual([8]);
      expect(receipt?.read()).toMatchObject({ state: 'started', basis: 'surviving' });
      expect(q.inspect()).toEqual(pendingQ);
    } else {
      expect(sent).toEqual([]);
      q.confirm(); await flush(); expect(sent).toEqual([8]);
    }
    await c.settled();
  } finally { c.dispose(); target.destroy(); late.destroy(); owner.destroy(); }
});
