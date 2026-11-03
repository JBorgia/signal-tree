import { expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';

type Receipt = { read(): Readonly<{ state: string; reason?: string; basis?: string }> };
type Experimental = ReturnType<typeof link> & {
  declare(input: { kind: 'independent' } | { kind: 'dependent'; owners: readonly object[] }, work: () => unknown): Receipt;
};
type Pair = { x?: number | undefined; y: number };
const writers = ['branch', 'root', 'updateAndReport'] as const;
type Writer = typeof writers[number];
const observations = ['direct', 'hasOwn', 'in', 'keys', 'entries', 'spread'] as const;
type Observation = typeof observations[number];
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 48; i++) await Promise.resolve();
};
const makeSource = (x: number | undefined) => signalTree(
  { pair: { x, y: 0 } as Pair }, { enhancers: [transactions()] }
);
const hasOwn = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);
const caught = (work: () => void): unknown => { try { work(); } catch (error) { return error; } return undefined; };
const runInput = (source: ReturnType<typeof makeSource>, writer: Writer, consume: (pair: Pair) => void): void => {
  if (writer === 'branch') source.$.pair(input => { consume(input); return input; });
  else if (writer === 'root') source.$(input => { consume(input.pair); return input; });
  else source.updateAndReport(input => { consume(input.pair); return {}; });
};
const present = (pair: Pair, observation: Observation): number => {
  if (observation === 'direct') return pair.x === undefined ? 0 : 1;
  if (observation === 'hasOwn') return hasOwn(pair, 'x') ? 1 : 0;
  if (observation === 'in') return 'x' in pair ? 1 : 0;
  if (observation === 'keys') return Object.keys(pair).includes('x') ? 1 : 0;
  if (observation === 'entries') return Object.entries(pair).some(([key]) => key === 'x') ? 1 : 0;
  return hasOwn({ ...pair }, 'x') ? 1 : 0;
};

for (const writer of writers)
for (const observation of observations)
for (const claim of ['independent', 'dependent'] as const)
it(`supplied absence ${writer}/${observation}/${claim} retains source omission after sibling overwrite`, async () => {
  const source = makeSource(7);
  const target = signalTree({ value: -1 });
  const sent: number[] = [];
  const c = link(target.$.value, { set: value => { sent.push(value); } }) as Experimental;
  const enrollment = observation === 'direct' || observation === 'keys' ? 'none'
    : observation === 'hasOwn' || observation === 'entries' ? 'live' : 'disposed';
  const p = source.transact(() => source.$.pair({ y: 0 }));
  const passive = enrollment === 'none' ? undefined : link(source.$, { set: () => { /* Destination values are intentionally discarded in this protocol fixture. */ } });
  try {
    source.$.pair.y(1);
    if (enrollment === 'disposed') passive?.dispose();
    await flush();
    expect(source.$.pair()).toEqual({ y: 1 });
    const before = p.inspect();
    let receipt: Receipt | undefined;
    const error = caught(() => {
      receipt = c.declare(claim === 'independent' ? { kind: claim } : { kind: claim, owners: [p] }, () => {
        runInput(source, writer, input => target.$.value(present(input, observation)));
      });
    });
    await flush();
    expect(target.$.value()).toBe(0);
    expect(source.$.pair()).toEqual({ y: 1 });
    expect(p.inspect()).toEqual(before);
    expect(sent).toEqual([]);
    if (claim === 'independent') expect(error).toMatchObject({ stage: 'after-callback', reason: 'contradiction' });
    else {
      expect(error).toBeUndefined();
      expect(receipt?.read()).toMatchObject({ state: 'conservative', reason: 'unknown' });
      p.confirm(); await flush();
      expect(sent).toEqual([0]);
      expect(receipt?.read()).toMatchObject({ state: 'started', basis: 'surviving' });
      await c.settled();
    }
  } finally { passive?.dispose(); c.dispose(); target.destroy(); source.destroy(); }
});

for (const writer of writers)
for (const complete of [false, true])
it(`primed ${writer} input refreshes equal-value support while retaining absence (${complete})`, async () => {
  const source = makeSource(7);
  const owner = signalTree({ z: 0 }, { enhancers: [transactions()] });
  const target = signalTree({ value: -1 });
  const sent: number[] = [];
  const c = link(target.$.value, { set: value => { sent.push(value); } }) as Experimental;
  const p = source.transact(() => source.$.pair({ y: 0 }));
  source.$.pair.y(1);
  const sourceConnection = link(source.$.pair, { set: () => { /* Destination values are intentionally discarded in this protocol fixture. */ } }) as Experimental;
  let release: () => void = () => undefined;
  try {
    await flush();
    const primedPair = source.$.pair(); source.$();
    const q = owner.transact(() => owner.$.z(9));
    const events: unknown[] = [];
    release = getPathNotifier().subscribe('pair.y', value => { events.push(value); });
    sourceConnection.declare({ kind: 'dependent', owners: [q] }, () => source.$.pair.y(1));
    await flush();
    expect(events).toEqual([]);
    expect(source.$.pair()).toBe(primedPair);
    let receipt: Receipt | undefined;
    const error = caught(() => {
      receipt = c.declare({ kind: 'dependent', owners: complete ? [p, q] : [p] }, () => {
        runInput(source, writer, input => target.$.value(hasOwn(input, 'x') ? 1 : 0));
      });
    });
    await flush(); expect(target.$.value()).toBe(0); expect(sent).toEqual([]);
    if (!complete) expect(error).toMatchObject({ stage: 'after-callback', reason: 'contradiction' });
    else {
      expect(error).toBeUndefined(); expect(receipt?.read()).toMatchObject({ state: 'held' });
      p.confirm(); await flush(); expect(sent).toEqual([]);
      q.confirm(); await flush(); expect(sent).toEqual([0]);
      expect(receipt?.read()).toMatchObject({ state: 'started', basis: 'declared' });
      await c.settled();
    }
  } finally { release(); sourceConnection.dispose(); c.dispose(); target.destroy(); source.destroy(); owner.destroy(); }
});

for (const writer of writers)
for (const omitted of [false, true])
it(`${writer} distinguishes own undefined from pending ordinary absence (${omitted})`, async () => {
  const source = makeSource(undefined);
  const owner = signalTree({ z: 0 }, { enhancers: [transactions()] });
  const target = signalTree({ value: -1 });
  const sent: number[] = [];
  const c = link(target.$.value, { set: value => { sent.push(value); } }) as Experimental;
  const p = omitted ? source.transact(() => source.$.pair({ y: 0 })) : owner.transact(() => owner.$.z(9));
  try {
    const receipt = c.declare(omitted ? { kind: 'dependent', owners: [p] } : { kind: 'independent' }, () => {
      runInput(source, writer, input => { expect(input.x).toBeUndefined(); target.$.value(hasOwn(input, 'x') ? 1 : 0); });
    });
    await flush();
    if (omitted) {
      expect(target.$.value()).toBe(0); expect(sent).toEqual([]);
      expect(receipt.read()).toMatchObject({ state: 'held' });
      p.confirm(); await flush(); expect(sent).toEqual([0]);
    } else { expect(target.$.value()).toBe(1); expect(sent).toEqual([1]); }
    expect(receipt.read()).toMatchObject({ state: 'started', basis: 'declared' });
    await c.settled();
  } finally { c.dispose(); target.destroy(); source.destroy(); owner.destroy(); }
});

for (const writer of writers)
it(`${writer} excludes an independently masked dormant pending payload`, async () => {
  const source = makeSource(7);
  const target = signalTree({ value: -1 });
  const sent: number[] = [];
  const c = link(target.$.value, { set: value => { sent.push(value); } }) as Experimental;
  const sourceConnection = link(source.$.pair, { set: () => { /* Destination values are intentionally discarded in this protocol fixture. */ } }) as Experimental;
  const x = source.$.pair.x;
  if (!x) throw new Error('Seeded child unavailable');
  const p = source.transact(() => x(77));
  try {
    sourceConnection.declare({ kind: 'independent' }, () => source.$.pair({ y: 0 }));
    await flush(); expect(source.$.pair()).toEqual({ y: 0 });
    const receipt = c.declare({ kind: 'independent' }, () => {
      runInput(source, writer, input => target.$.value(hasOwn(input, 'x') ? 1 : 0));
    });
    await flush(); expect(target.$.value()).toBe(0); expect(sent).toEqual([0]);
    expect(receipt.read()).toMatchObject({ state: 'started', basis: 'declared' });
    expect(() => p.inspect()).not.toThrow(); await c.settled();
  } finally { sourceConnection.dispose(); c.dispose(); target.destroy(); source.destroy(); }
});

for (const writer of writers)
it(`${writer} observes independently reactivated same retained member`, async () => {
  const source = makeSource(7);
  const held = source.$.pair.x;
  if (!held) throw new Error('Seeded child unavailable');
  const target = signalTree({ value: -1 });
  const sent: number[] = [];
  const c = link(target.$.value, { set: value => { sent.push(value); } }) as Experimental;
  const sourceConnection = link(source.$.pair, { set: () => { /* Destination values are intentionally discarded in this protocol fixture. */ } }) as Experimental;
  const p = source.transact(() => source.$.pair({ y: 0 }));
  try {
    sourceConnection.declare({ kind: 'independent' }, () => { held(7); source.$.pair.y(1); });
    await flush(); expect(source.$.pair()).toEqual({ x: 7, y: 1 }); expect(source.$.pair.x).toBe(held);
    const receipt = c.declare({ kind: 'independent' }, () => {
      runInput(source, writer, input => target.$.value(hasOwn(input, 'x') ? 1 : 0));
    });
    await flush(); expect(target.$.value()).toBe(1); expect(sent).toEqual([1]);
    expect(receipt.read()).toMatchObject({ state: 'started', basis: 'declared' });
    expect(() => p.inspect()).not.toThrow(); await c.settled();
  } finally { sourceConnection.dispose(); c.dispose(); target.destroy(); source.destroy(); }
});
