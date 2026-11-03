import { expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import { preparePublicationMutations } from './internals/intrinsic-mutation';

type Receipt = { read(): Readonly<{ state: string; reason?: string; basis?: string }> };
type Declaration = { kind: 'independent' } | { kind: 'dependent'; owners: readonly object[] };
type Experimental = ReturnType<typeof link> & { declare(input: Declaration, work: () => unknown): Receipt };
const make = () => signalTree({ x: 0 }, { enhancers: [transactions()] });
const flush = async () => { getPathNotifier().flushSync(); for (let i = 0; i < 48; i++) await Promise.resolve(); };

it.each(['independent', 'dependent'] as const)('confirmation inside an updater cannot rewrite its captured input: %s', async kind => {
  const source = make(); const target = make(); const late = make(); const sent: number[] = [];
  const c = link(target.$.x, { set: v => { sent.push(v); } }) as Experimental;
  try {
    const p = source.transact(() => source.$.x(7));
    const q = late.transact(() => late.$.x(9)); const pendingQ = q.inspect();
    let receipt: Receipt | undefined; let caught: unknown; let calls = 0;
    try {
      receipt = c.declare(kind === 'independent' ? { kind } : { kind, owners: [p] }, () => {
        source.updateAndReport(input => { calls++; p.confirm(); target.$.x(input.x + 1); return {}; });
      });
    } catch (error) { caught = error; }
    if (kind === 'independent') expect(caught).toMatchObject({ stage: 'after-callback', reason: 'contradiction' });
    else expect(caught).toBeUndefined();
    expect(calls).toBe(1); expect(target.$.x()).toBe(8);
    await flush(); expect(q.inspect()).toEqual(pendingQ);
    if (kind === 'independent') {
      // The invalid declaration exposes its installation-time W(q).
      expect(sent).toEqual([]); q.confirm(); await flush();
    }
    expect(sent).toEqual([8]);
    if (kind === 'dependent') expect(receipt?.read()).toMatchObject({ state: 'started', basis: 'declared' });
    await c.settled();
  } finally { c.dispose(); target.destroy(); source.destroy(); late.destroy(); }
});

it('confirmation during return validation does not erase an installed contradiction', async () => {
  const source = make(); const target = make(); const sent: number[] = [];
  const c = link(target.$.x, { set: v => { sent.push(v); } }) as Experimental;
  try {
    const p = source.transact(() => source.$.x(7));
    expect(() => c.declare({ kind: 'independent' }, () => {
      source.updateAndReport(input => { target.$.x(input.x + 1); return {}; });
      return { get then() { p.confirm(); return undefined; } };
    })).toThrow(expect.objectContaining({ stage: 'after-callback', reason: 'contradiction' }));
    await flush(); expect(target.$.x()).toBe(8); expect(sent).toEqual([8]); await c.settled();
  } finally { c.dispose(); target.destroy(); source.destroy(); }
});

it('confirmed input does not hide a different pending input in the same native snapshot', async () => {
  const source = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
  const target = make(); const late = make(); const sent: number[] = [];
  const c = link(target.$.x, { set: v => { sent.push(v); } }) as Experimental;
  try {
    const p = source.transact(() => source.$.x(7)); p.confirm(); await flush();
    const q = source.transact(() => source.$.y(9));
    const r = late.transact(() => late.$.x(11)); const pendingR = r.inspect();
    const receipt = c.declare({ kind: 'dependent', owners: [q] }, () => {
      source.updateAndReport(input => { target.$.x(input.x + input.y); return {}; });
    });
    await flush(); expect(sent).toEqual([]); expect(receipt.read()).toMatchObject({ state: 'held' });
    q.confirm(); await flush(); expect(sent).toEqual([16]);
    expect(receipt.read()).toMatchObject({ state: 'started', basis: 'declared' });
    expect(r.inspect()).toEqual(pendingR); await c.settled();
  } finally { c.dispose(); target.destroy(); source.destroy(); late.destroy(); }
});

it('confirmed possible-owner history remains uncertainty rather than becoming declared proof', async () => {
  const owner = make(); const source = make(); const target = make(); const late = make(); const sent: number[] = [];
  const c = link(target.$.x, { set: v => { sent.push(v); } }) as Experimental;
  try {
    const p = owner.transact(() => owner.$.x(7)); source.$.x(7); p.confirm(); await flush();
    const q = late.transact(() => late.$.x(9)); const pendingQ = q.inspect();
    const receipt = c.declare({ kind: 'independent' }, () => {
      source.updateAndReport(input => { target.$.x(input.x + 1); return {}; });
    });
    expect(receipt.read()).toMatchObject({ state: 'conservative', reason: 'unknown' });
    await flush(); expect(sent).toEqual([8]);
    expect(receipt.read()).toMatchObject({ state: 'started', basis: 'surviving' });
    expect(q.inspect()).toEqual(pendingQ); await c.settled();
  } finally { c.dispose(); target.destroy(); source.destroy(); owner.destroy(); late.destroy(); }
});

it('historical confirmation does not remove an explicit enclosing validation declaration', async () => {
  const owner = make(); const target = make(); const sent: number[] = [];
  const c = link(target.$.x, { set: v => { sent.push(v); } }) as Experimental;
  try {
    const p = owner.transact(() => owner.$.x(7)); p.confirm(); await flush();
    expect(() => c.declare({ kind: 'dependent', owners: [p] }, () => {
      c.declare({ kind: 'independent' }, () => target.$.x(8));
    })).toThrow(expect.objectContaining({ stage: 'after-callback', reason: 'contradiction' }));
    await flush(); expect(target.$.x()).toBe(8); expect(sent).toEqual([8]); await c.settled();
  } finally { c.dispose(); target.destroy(); owner.destroy(); }
});

it('confirmed absence is consumable without retaining its historical removal owner as an input constraint', async () => {
  const source = signalTree({ rows: { x: 7 } as Record<string, number> }, { enhancers: [transactions()] });
  const target = make(); const late = make(); const sent: number[] = [];
  const c = link(target.$.x, { set: v => { sent.push(v); } }) as Experimental;
  try {
    const p = source.transact(() => source.$.rows({})); p.confirm(); await flush();
    const q = late.transact(() => late.$.x(9)); const pendingQ = q.inspect();
    const receipt = c.declare({ kind: 'independent' }, () => {
      source.updateAndReport(input => { expect(Object.prototype.hasOwnProperty.call(input.rows, 'x')).toBe(false); target.$.x(8); return {}; });
    });
    await flush(); expect(sent).toEqual([8]); expect(receipt.read()).toMatchObject({ state: 'started', basis: 'declared' });
    expect(q.inspect()).toEqual(pendingQ); await c.settled();
  } finally { c.dispose(); target.destroy(); source.destroy(); late.destroy(); }
});

it.each(['independent', 'dependent'] as const)('preparer confirmation preserves earlier input capture: %s', async kind => {
  const source = make(); const target = make(); const late = make(); const sent: number[] = [];
  const c = link(target.$.x, { set: v => { sent.push(v); } }) as Experimental;
  const p = source.transact(() => source.$.x(7)); let preparationCalls = 0; let updaterCalls = 0;
  const release = preparePublicationMutations(target.$.x, () => { preparationCalls++; p.confirm(); return undefined; }, () => {/* No completion side effect in this preparation probe. */})!;
  try {
    let receipt: Receipt | undefined; let caught: unknown;
    try {
      receipt = c.declare(kind === 'independent' ? { kind } : { kind, owners: [p] }, () => {
        source.updateAndReport(input => { updaterCalls++; target.$.x(input.x + 1); return {}; });
      });
    } catch (error) { caught = error; }
    if (kind === 'independent') expect(caught).toMatchObject({ stage: 'after-callback', reason: 'contradiction' });
    else expect(caught).toBeUndefined();
    const q = late.transact(() => late.$.x(9)); const pendingQ = q.inspect();
    await flush(); expect(preparationCalls).toBe(1); expect(updaterCalls).toBe(1); expect(sent).toEqual([8]);
    if (kind === 'dependent') expect(receipt?.read()).toMatchObject({ state: 'started', basis: 'declared' });
    expect(q.inspect()).toEqual(pendingQ); await c.settled();
  } finally { release(); c.dispose(); target.destroy(); source.destroy(); late.destroy(); }
});

it('confirmed historical validation becomes discharged input without altering active validation rules', async () => {
  const owner = make(); const source = make(); const target = make(); const late = make(); const sent: number[] = [];
  const first = link(source.$.x, { set: () => {/* The intermediate endpoint is not the observed output. */} }) as Experimental;
  const c = link(target.$.x, { set: v => { sent.push(v); } }) as Experimental;
  try {
    const p = owner.transact(() => owner.$.x(7));
    const original = first.declare({ kind: 'dependent', owners: [p] }, () => source.$.x(7));
    p.confirm(); await flush(); expect(original.read()).toMatchObject({ state: 'started', basis: 'declared' }); first.dispose();
    const q = late.transact(() => late.$.x(9)); const pendingQ = q.inspect();
    const receipt = c.declare({ kind: 'independent' }, () => {
      source.updateAndReport(input => { target.$.x(input.x + 1); return {}; });
    });
    await flush(); expect(sent).toEqual([8]); expect(receipt.read()).toMatchObject({ state: 'started', basis: 'declared' });
    expect(original.read()).toMatchObject({ state: 'started', basis: 'declared' });
    expect(q.inspect()).toEqual(pendingQ); await c.settled();
  } finally { first.dispose(); c.dispose(); target.destroy(); source.destroy(); owner.destroy(); late.destroy(); }
});

it('confirmation cannot turn inherited invalid evidence into declared permission', async () => {
  const owner = make(); const source = make(); const target = make(); const sent: number[] = [];
  const first = link(source.$.x, { set: () => {/* The intermediate endpoint is not the observed output. */} }) as Experimental;
  const c = link(target.$.x, { set: v => { sent.push(v); } }) as Experimental;
  try {
    const p = owner.transact(() => owner.$.x(7));
    expect(() => first.declare({ kind: 'independent' }, () => {
      owner.updateAndReport(input => { source.$.x(input.x); return {}; });
    })).toThrow(expect.objectContaining({ reason: 'contradiction' }));
    p.confirm(); await flush();
    const receipt = c.declare({ kind: 'independent' }, () => {
      source.updateAndReport(input => { target.$.x(input.x + 1); return {}; });
    });
    expect(receipt.read()).toMatchObject({ state: 'conservative', reason: 'invalid-declaration' });
    await flush(); expect(sent).toEqual([8]); expect(receipt.read()).toMatchObject({ state: 'started', basis: 'surviving' });
    await c.settled();
  } finally { first.dispose(); c.dispose(); target.destroy(); source.destroy(); owner.destroy(); }
});
