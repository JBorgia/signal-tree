import { expect, it } from 'vitest';
import { entityMap, link, restoration, signalTree, transactions, undoable } from '../index';
import { getPathNotifier } from './path-notifier';
import { registerMembershipPublication } from './internals/intrinsic-mutation';

const flush = async () => { for (let i = 0; i < 48; i++) await Promise.resolve(); };
type Row = { id: string; n: number; note: number };
const make = () => signalTree({
  left: entityMap<Row, string>(), right: entityMap<Row, string>(),
}, { enhancers: [restoration()] });
const baseline = [{ id: 'a', n: 11, note: 1 }, { id: 'b', n: 12, note: 2 }];
const initial = async (tree: ReturnType<typeof make>) => {
  tree.$.left.addOne({ id: 'a', n: 1, note: 0 });
  tree.$.right.setAll(baseline.map(row => ({ ...row }))); await flush();
};
const author = (tree: ReturnType<typeof make>, reverse = false) => undoable(() => {
  tree.$.left.removeOne('a');
  if (reverse) { tree.$.right.byIdOrFail('b').n(60); tree.$.right.byIdOrFail('a').n(50); }
  else { tree.$.right.byIdOrFail('a').n(50); tree.$.right.byIdOrFail('b').n(60); }
});
const expected = (n: number) => [{ id: 'a', n, note: 1 }, { id: 'b', n: 12, note: 2 }];

it('mixed undo preserves newer callback row with reverse authored constituent order', async () => {
  const tree = make(); let off: () => void = () => undefined;
  const sent: unknown[] = [];
  await initial(tree);
  const c = link(tree.$.right, { set: value => { sent.push(value); } });
  try {
    author(tree, true); await flush(); await c.settled();
    const observed: unknown[] = []; let armed = true;
    off = tree.$.right.tap({ onUpdate() {
      if (!armed) return; armed = false;
      observed.push({ left: tree.$.left.all(), right: tree.$.right.all() });
      tree.$.right.byIdOrFail('a').n(777);
    } });
    tree.undo(); await flush(); await c.settled();
    expect(observed).toEqual([{ left: [{ id: 'a', n: 1, note: 0 }], right: baseline }]);
    expect(tree.$.right.all()).toEqual(expected(777)); expect(sent.at(-1)).toEqual(expected(777));
  } finally { off(); c.dispose(); tree.destroy(); }
});

it('mixed undo cannot replace a callback-authored disjoint row field with an older row image', async () => {
  const tree = make(); let off: () => void = () => undefined;
  const sent: unknown[] = [];
  await initial(tree);
  const c = link(tree.$.right, { set: value => { sent.push(value); } });
  try {
    author(tree); await flush(); await c.settled(); let armed = true;
    const observed: unknown[] = [];
    off = tree.$.right.tap({ onUpdate() {
      if (!armed) return; armed = false; observed.push(tree.$.right.all());
      tree.$.right.byIdOrFail('a').note(99);
    } });
    tree.undo(); await flush(); await c.settled();
    const after = [{ id: 'a', n: 11, note: 99 }, { id: 'b', n: 12, note: 2 }];
    expect(observed).toEqual([baseline]); expect(tree.$.right.all()).toEqual(after); expect(sent.at(-1)).toEqual(after);
  } finally { off(); c.dispose(); tree.destroy(); }
});

it('queued mixed-undo delivery rechecks a newer row authored before first I/O', async () => {
  const tree = make(); let off: () => void = () => undefined;
  const sent: unknown[] = [];
  await initial(tree);
  const c = link(tree.$.right, { set: value => { sent.push(value); } });
  try {
    author(tree); await flush(); await c.settled(); const sentBefore = sent.length; let armed = true;
    off = tree.$.right.tap({ onUpdate() { if (!armed) return; armed = false; tree.$.right.byIdOrFail('a').n(777); } });
    tree.undo(); getPathNotifier().flushSync();
    expect(armed).toBe(false); expect(sent).toHaveLength(sentBefore);
    tree.$.right.byIdOrFail('a').n(888);
    await flush(); await c.settled();
    expect(tree.$.right.all()).toEqual(expected(888)); expect(sent.slice(sentBefore)).toEqual([expected(888)]);
  } finally { off(); c.dispose(); tree.destroy(); }
});

it('in-flight forward packet is followed serially by current mixed-undo callback truth', async () => {
  const tree = make(); let off: () => void = () => undefined;
  const sent: unknown[] = []; let acknowledge: () => void = () => undefined;
  const first = new Promise<void>(resolve => { acknowledge = resolve; });
  let active = 0; let maximumActive = 0;
  await initial(tree);
  const c = link(tree.$.right, { set: value => {
    sent.push(value); active++; maximumActive = Math.max(maximumActive, active);
    if (sent.length === 1) return first.finally(() => { active--; });
    active--;
  } });
  try {
    author(tree); await flush();
    const forward = [{ id: 'a', n: 50, note: 1 }, { id: 'b', n: 60, note: 2 }];
    expect(sent).toEqual([forward]); let armed = true;
    off = tree.$.right.tap({ onUpdate() { if (!armed) return; armed = false; tree.$.right.byIdOrFail('a').n(777); } });
    tree.undo(); await flush();
    expect(tree.$.right.all()).toEqual(expected(777)); expect(sent).toEqual([forward]);
    acknowledge(); await flush(); await c.settled();
    expect(sent).toEqual([forward, expected(777)]); expect(maximumActive).toBe(1); expect(active).toBe(0);
  } finally { acknowledge(); off(); c.dispose(); tree.destroy(); }
});

it('private membership participants coexist and release independently of the native Link consumer', async () => {
  const tree = signalTree({ a: { x: 7, y: 0 } as { x?: number; y: number } });
  const x = tree.$.a.x; if (!x) throw new Error('Seeded child unavailable');
  const sent: unknown[] = [];
  const c = link(tree.$.a, { set: value => { sent.push(value); } });
  const records = new Map<string, number>(); const prepared = { a: 0, b: 0 }; const completed = { a: 0, b: 0 };
  let releaseA: () => void = () => undefined; let releaseB: () => void = () => undefined;
  const participant = (label: 'a' | 'b') => registerMembershipPublication(edit => {
    if (edit.key !== 'x') return undefined;
    const count = ++prepared[label];
    return { record: { writes: [{ map: records, key: label, value: count }], adds: [] }, completion: { label } };
  }, () => { completed[label]++; });
  try {
    releaseA = participant('a'); releaseB = participant('b');
    tree.$.a({ y: 0 }); await flush(); await c.settled();
    expect(records.get('a')).toBeGreaterThan(0); expect(records.get('b')).toBeGreaterThan(0);
    expect(completed).toEqual(prepared); expect(sent.at(-1)).toEqual({ y: 0 });
    releaseA(); const aBefore = prepared.a; const bBefore = prepared.b;
    x(7); await flush(); await c.settled();
    expect(prepared.a).toBe(aBefore); expect(prepared.b).toBeGreaterThan(bBefore);
    expect(completed).toEqual(prepared); expect(sent.at(-1)).toEqual({ x: 7, y: 0 });
    releaseB(); const bAfter = prepared.b;
    tree.$.a({ y: 0 }); await flush(); await c.settled();
    expect(prepared.a).toBe(aBefore); expect(prepared.b).toBe(bAfter); expect(sent.at(-1)).toEqual({ y: 0 });
  } finally { releaseA(); releaseB(); c.dispose(); tree.destroy(); }
});

// A pending owner introduced by callback-capable preparation exists at install;
// it is not the later-delivery owner excluded by the fixed-window control.
it('membership preparation reentry is included before the authored unit installs', async () => {
  const source = signalTree({ z: 0 }, { enhancers: [transactions()] });
  const reentrant = signalTree({ z: 0 }, { enhancers: [transactions()] });
  const target = signalTree({ a: { x: 7, y: 0 } as { x?: number; y: number } });
  const sent: unknown[] = [];
  const c = link(target.$.a, { set: value => { sent.push(value); } });
  let release: () => void = () => undefined;
  let q: { confirm(): void; inspect(): unknown } | undefined;
  let callbacks = 0;
  try {
    const p = source.transact(() => source.$.z(1));
    release = registerMembershipPublication(edit => {
      if (edit.key === 'x' && !edit.present) {
        callbacks++;
        if (!q) q = reentrant.transact(() => reentrant.$.z(9));
      }
      return undefined;
    }, () => {});
    target.$.a({ y: 0 });
    expect(callbacks).toBe(1); expect(q).toBeDefined();
    expect(target.$.a()).toEqual({ y: 0 });
    await flush(); expect(sent).toEqual([]);
    p.confirm(); await flush(); expect(sent).toEqual([]);
    expect(() => q?.inspect()).not.toThrow();
    q?.confirm(); await flush();
    expect(sent).toEqual([{ y: 0 }]); await c.settled();
  } finally { release(); c.dispose(); target.destroy(); reentrant.destroy(); source.destroy(); }
});
