import { expect, it } from 'vitest';
import { leaf, link, signalTree, transactions } from '../index';

type Declaration = { kind: 'independent' } | { kind: 'dependent'; owners: readonly object[] };
type DeclaringLink = ReturnType<typeof link> & {
  declare(input: Declaration, work: () => unknown): unknown;
};
const drain = async () => {
  for (let i = 0; i < 120; i++) await Promise.resolve();
};
const setup = () => {
  const tree = signalTree({ pair: { x: 0, y: 0 } }, { enhancers: [transactions()] });
  const foreign = signalTree({ q: 0 }, { enhancers: [transactions()] });
  const sent: { x: number; y: number }[] = [];
  const connection = link(tree.$.pair, { set: value => { sent.push(value); } }) as DeclaringLink;
  const q = foreign.transact(() => foreign.$.q(1));
  let p!: ReturnType<typeof tree.transact>;
  connection.declare({ kind: 'dependent', owners: [q] }, () => {
    p = tree.transact(() => tree.$.pair.x(7));
  });
  return { tree, foreign, sent, connection, p, q,
    destroy() { connection.dispose(); tree.destroy(); foreign.destroy(); } };
};

it('completed scalar setters inside an open horizon preserve p and inherited q', async () => {
  const s = setup();
  let calls = 0;
  try {
    await drain();
    const pBefore = s.p.inspect(), qBefore = s.q.inspect();
    s.connection.declare({ kind: 'dependent', owners: [s.p, s.q] }, () => {
      s.tree.$.pair(current => { calls++; return { ...current, y: 1 }; });
      // Setters have returned; declaration validation is still open.
      expect(s.tree.$.pair()).toEqual({ x: 7, y: 1 });
      expect(s.sent).toEqual([]);
    });
    expect(calls).toBe(1);
    expect(s.p.inspect()).toEqual(pBefore);
    expect(s.q.inspect()).toEqual(qBefore);
    await drain(); expect(s.sent).toEqual([]);
    s.p.confirm(); await drain(); expect(s.sent).toEqual([]);
    s.q.confirm(); await drain();
    expect(s.sent).toEqual([{ x: 7, y: 1 }]);
    await s.connection.settled();
    await drain(); expect(s.sent).toEqual([{ x: 7, y: 1 }]);
  } finally { s.destroy(); }
});

it('native scalar support survives closed derived invocations with no source recipient', async () => {
  const tree = signalTree({ pair: { x: 0, y: 0 } }, { enhancers: [transactions()] });
  const foreign = signalTree({ q: 0 }, { enhancers: [transactions()] });
  const anchorTree = signalTree({ value: 0 });
  const anchorSent: number[] = [], sent: { x: number; y: number }[] = [];
  const anchor = link(anchorTree.$.value, { set: value => { anchorSent.push(value); } }) as DeclaringLink;
  let recipient: DeclaringLink | undefined;
  try {
    const q = foreign.transact(() => foreign.$.q(1));
    let p!: ReturnType<typeof tree.transact>;
    anchor.declare({ kind: 'dependent', owners: [q] }, () => {
      p = tree.transact(() => tree.$.pair.x(7));
    });
    let calls = 0;
    for (let i = 0; i < 4; i++) {
      anchor.declare({ kind: 'dependent', owners: [p, q] }, () => {
        tree.$.pair(current => { calls++; return { ...current }; });
      });
    }
    expect(calls).toBe(4); expect(anchorSent).toEqual([]);
    expect(tree.$.pair()).toEqual({ x: 7, y: 0 });
    p.confirm(); await drain();
    recipient = link(tree.$.pair, { set: value => { sent.push(value); } }) as DeclaringLink;
    recipient.declare({ kind: 'independent' }, () => tree.$.pair.y(1));
    await drain(); expect(sent).toEqual([]);
    expect(foreign.$.q()).toBe(1);
    q.confirm(); await drain();
    expect(sent).toEqual([{ x: 7, y: 1 }]);
    await recipient.settled(); await drain();
    expect(sent).toEqual([{ x: 7, y: 1 }]); expect(anchorSent).toEqual([]);
  } finally { recipient?.dispose(); anchor.dispose(); tree.destroy(); foreign.destroy(); anchorTree.destroy(); }
});

it('replacement during the horizon preserves a saved input alias without reinstalling its endpoint', async () => {
  const s = setup();
  let saved!: { x: number; y: number };
  let holder: ReturnType<typeof makeHolder> | undefined;
  let oldLink: DeclaringLink | undefined;
  const oldSent: { input: { x: number; y: number }; stamp: number }[] = [];
  function makeHolder(value: { x: number; y: number }) {
    return signalTree({ input: leaf(value), stamp: 0 });
  }
  try {
    s.connection.declare({ kind: 'dependent', owners: [s.p, s.q] }, () => {
      s.tree.$.pair(current => ({ ...current }));
      saved = s.tree.$.pair();
      s.tree.$.pair({ x: 9, y: 0 });
      expect(saved).toEqual({ x: 7, y: 0 });
      expect(s.tree.$.pair()).toEqual({ x: 9, y: 0 });
    });
    holder = makeHolder(saved);
    oldLink = link(holder.$, { set: value => { oldSent.push(value); } }) as DeclaringLink;
    let calls = 0;
    oldLink.declare({ kind: 'dependent', owners: [s.p, s.q] }, () => {
      holder!.$(current => {
        calls++; expect(current.input).toBe(saved);
        return { input: current.input, stamp: 1 };
      });
    });
    expect(calls).toBe(1);
    await drain(); expect(s.sent).toEqual([]); expect(oldSent).toEqual([]);
    s.p.confirm(); await drain(); expect(s.sent).toEqual([]); expect(oldSent).toEqual([]);
    s.q.confirm(); await drain();
    expect(s.sent).toEqual([{ x: 9, y: 0 }]);
    expect(oldSent).toEqual([{ input: { x: 7, y: 0 }, stamp: 1 }]);
    expect(s.tree.$.pair()).toEqual({ x: 9, y: 0 });
    expect(saved).toEqual({ x: 7, y: 0 });
    await Promise.all([s.connection.settled(), oldLink.settled()]);
    await drain(); expect(s.sent).toHaveLength(1); expect(oldSent).toHaveLength(1);
  } finally { oldLink?.dispose(); holder?.destroy(); s.destroy(); }
});

it('disposing the Link inside an outer horizon does not discard source obligations', async () => {
  const s = setup();
  const lateSent: { x: number; y: number }[] = [];
  let late: DeclaringLink | undefined;
  try {
    s.connection.declare({ kind: 'dependent', owners: [s.p, s.q] }, () => {
      s.tree.$.pair(current => ({ ...current }));
      s.connection.dispose();
      expect(s.tree.$.pair()).toEqual({ x: 7, y: 0 });
    });
    await drain(); expect(s.sent).toEqual([]);
    s.p.confirm(); await drain();
    late = link(s.tree.$.pair, { set: value => { lateSent.push(value); } }) as DeclaringLink;
    late.declare({ kind: 'independent' }, () => s.tree.$.pair.y(1));
    await drain(); expect(lateSent).toEqual([]);
    s.q.confirm(); await drain();
    expect(lateSent).toEqual([{ x: 7, y: 1 }]); expect(s.sent).toEqual([]);
    await late.settled(); await drain(); expect(lateSent).toHaveLength(1);
  } finally { late?.dispose(); s.destroy(); }
});

it('throwing outer callback retains nested installed work and leaves fresh declarations usable', async () => {
  const tree = signalTree({ pair: { x: 0, y: 0 } });
  const foreign = signalTree({ q: 0 }, { enhancers: [transactions()] });
  const recovery = signalTree({ value: 0 });
  const sent: { x: number; y: number }[] = [], recovered: number[] = [];
  const parent = link(tree.$.pair, { set: () => { /* This Link owns the outer declaration only. */ } }) as DeclaringLink;
  const fresh = link(recovery.$.value, { set: value => { recovered.push(value); } }) as DeclaringLink;
  let child: DeclaringLink | undefined;
  const sentinel = new Error('outer callback sentinel');
  try {
    const q = foreign.transact(() => foreign.$.q(1));
    let caught: unknown, calls = 0;
    try {
      parent.declare({ kind: 'independent' }, () => {
        tree.$.pair.x(7);
        child = link(tree.$.pair, { set: value => { sent.push(value); } }) as DeclaringLink;
        child.declare({ kind: 'independent' }, () => { calls++; tree.$.pair.y(1); });
        throw sentinel;
      });
    } catch (error) { caught = error; }
    expect(caught).toBe(sentinel); expect(calls).toBe(1);
    expect(tree.$.pair()).toEqual({ x: 7, y: 1 });
    child!.declare({ kind: 'independent' }, () => tree.$.pair.y(8));
    fresh.declare({ kind: 'independent' }, () => recovery.$.value(2));
    await drain(); expect(sent).toEqual([]); expect(recovered).toEqual([2]);
    q.confirm(); await drain();
    expect(sent).toEqual([{ x: 7, y: 8 }]);
    await Promise.all([child!.settled(), fresh.settled()]);
    await drain(); expect(sent).toHaveLength(1); expect(recovered).toEqual([2]);
  } finally { child?.dispose(); parent.dispose(); fresh.dispose(); tree.destroy(); foreign.destroy(); recovery.destroy(); }
});
