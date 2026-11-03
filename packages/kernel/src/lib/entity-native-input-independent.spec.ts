// Prewritten independent entity input controls, predecessor 0135ef18.
// Declarations target only a supported scalar output; no collection declaration.
import { expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';

type Row = { id: string; n?: number };
type Receipt = { read(): Readonly<{ state: string; reason?: string; basis?: string }> };
type Experimental = ReturnType<typeof link> & {
  declare(input: { kind: 'independent' } | { kind: 'dependent'; owners: readonly object[] }, work: () => unknown): Receipt;
};
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 120; i++) await Promise.resolve();
};
const makeSource = () => {
  const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions()] });
  tree.$.rows.addOne({ id: 'a', n: 1 });
  tree.$.rows.addOne({ id: 'b', n: 2 });
  return tree;
};
const attempt = (work: () => void): unknown => {
  try { work(); } catch (error) { return error; }
  return undefined;
};

for (const enrollment of ['none', 'live', 'disposed'] as const)
for (const claim of ['independent', 'dependent'] as const)
it(`native root snapshot observes removed entity: ${enrollment}/${claim}`, async () => {
  const source = makeSource();
  const target = signalTree({ value: -1 });
  const late = signalTree({ x: 0 }, { enhancers: [transactions()] });
  await flush();
  const sent: number[] = [];
  const c = link(target.$.value, { set: value => { sent.push(value); } }) as Experimental;
  const passive = enrollment === 'none' ? undefined : link(source.$.rows, { set: () => undefined });
  try {
    const p = source.transact(() => source.$.rows.removeOne('a'));
    if (enrollment === 'disposed') passive?.dispose();
    await flush();
    const before = p.inspect();
    let receipt: Receipt | undefined;
    let calls = 0;
    const error = attempt(() => {
      receipt = c.declare(claim === 'independent' ? { kind: claim } : { kind: claim, owners: [p] }, () => {
        source.$(input => {
          calls++;
          // Public root snapshot uses {all: Row[]} although its construction type retains the marker.
          const snapshot = input as unknown as { rows: { all: Row[] } };
          expect(snapshot.rows.all).toEqual([{ id: 'b', n: 2 }]);
          target.$.value(snapshot.rows.all.some(row => row.id === 'a') ? 1 : 0);
          return input;
        });
      });
    });
    expect(calls).toBe(1);
    expect(target.$.value()).toBe(0);
    expect(source.$.rows.all()).toEqual([{ id: 'b', n: 2 }]);
    expect(p.inspect()).toEqual(before);
    if (claim === 'independent') expect(error).toMatchObject({ stage: 'after-callback', reason: 'contradiction' });
    else expect(error).toBeUndefined();
    const q = late.transact(() => late.$.x(9));
    const pendingQ = q.inspect();
    await flush(); expect(sent).toEqual([]);
    p.confirm(); await flush(); expect(sent).toEqual([0]);
    if (claim === 'dependent') expect(receipt?.read()).toMatchObject({ state: 'started', basis: 'declared' });
    expect(q.inspect()).toEqual(pendingQ);
    await c.settled();
  } finally { passive?.dispose(); c.dispose(); source.destroy(); target.destroy(); late.destroy(); }
});

for (const claim of ['independent', 'dependent'] as const)
it(`native row argument carries field omission: ${claim}`, async () => {
  const source = makeSource(); const target = signalTree({ value: -1 });
  await flush();
  const sent: number[] = [];
  const c = link(target.$.value, { set: value => { sent.push(value); } }) as Experimental;
  try {
    const p = source.transact(() => source.$.rows.replaceOne('a', { id: 'a' }));
    const before = p.inspect(); let calls = 0; let receipt: Receipt | undefined;
    const error = attempt(() => {
      receipt = c.declare(claim === 'independent' ? { kind: claim } : { kind: claim, owners: [p] }, () => {
        source.$.rows.byIdOrFail('a')(input => {
          calls++;
          expect(input).toEqual({ id: 'a' });
          target.$.value(Object.prototype.hasOwnProperty.call(input, 'n') ? 1 : 0);
          return input;
        });
      });
    });
    expect(calls).toBe(1); expect(target.$.value()).toBe(0); expect(p.inspect()).toEqual(before);
    if (claim === 'independent') expect(error).toMatchObject({ stage: 'after-callback', reason: 'contradiction' });
    else expect(error).toBeUndefined();
    await flush(); expect(sent).toEqual([]);
    p.confirm(); await flush(); expect(sent).toEqual([0]);
    if (claim === 'dependent') expect(receipt?.read()).toMatchObject({ state: 'started', basis: 'declared' });
    await c.settled();
  } finally { c.dispose(); source.destroy(); target.destroy(); }
});

for (const writer of ['updateWhere', 'removeWhere'] as const)
for (const claim of ['independent', 'dependent'] as const)
it(`native ${writer} supplies nonselected candidate: ${claim}`, async () => {
  const source = makeSource(); const target = signalTree({ value: -1 });
  await flush();
  const sent: number[] = [];
  const c = link(target.$.value, { set: value => { sent.push(value); } }) as Experimental;
  try {
    const p = source.transact(() => source.$.rows.updateOne('b', { n: 7 }));
    const before = p.inspect(); const seen: string[] = []; let count: number | undefined;
    let receipt: Receipt | undefined;
    const error = attempt(() => {
      receipt = c.declare(claim === 'independent' ? { kind: claim } : { kind: claim, owners: [p] }, () => {
        const predicate = (input: Row): boolean => {
          seen.push(input.id);
          if (input.id === 'b') { expect(input.n).toBe(7); target.$.value(input.n ?? 0); }
          return false;
        };
        count = writer === 'updateWhere'
          ? source.$.rows.updateWhere(predicate, { n: 99 })
          : source.$.rows.removeWhere(predicate);
      });
    });
    expect(seen).toEqual(['a', 'b']); expect(count).toBe(0);
    expect(source.$.rows.all()).toEqual([{ id: 'a', n: 1 }, { id: 'b', n: 7 }]);
    expect(target.$.value()).toBe(7); expect(p.inspect()).toEqual(before);
    if (claim === 'independent') expect(error).toMatchObject({ stage: 'after-callback', reason: 'contradiction' });
    else expect(error).toBeUndefined();
    await flush(); expect(sent).toEqual([]);
    p.confirm(); await flush(); expect(sent).toEqual([7]);
    if (claim === 'dependent') expect(receipt?.read()).toMatchObject({ state: 'started', basis: 'declared' });
    await c.settled();
  } finally { c.dispose(); source.destroy(); target.destroy(); }
});
