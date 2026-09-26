import { describe, expect, it } from 'vitest';

import { getTreeRealizationDescriptors } from './internals/causal-runtime/tree-realization-adapter';
import { getHeldConsequenceCountForTesting } from './internals/commit-consequence';
import { entityMap } from './markers/entity-map';
import { link } from './link';
import { getPathNotifier } from './path-notifier';
import { signalTree } from './signal-tree';
import { undoable } from './undoable';
import { transactions } from '../enhancers/transactions/transactions';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * LINK-OVERLAP-ROLLBACK-0. Reproduced on the installed 15.3.0 package.
 *
 * Two overlapping transactions write the same location. The earlier one
 * confirms, then the later one rolls back. The tree correctly ends at the
 * earlier confirmed value, but the rollback's compensation reached no
 * notifier subscriber, so a linked endpoint kept the rolled-back value and
 * `settled()` never resolved.
 *
 * Cause: settling the earlier transaction forgot realization descriptors that
 * the still-pending later transaction needed, and a compensation with no
 * descriptor has no path to notify on.
 */
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const settledWithin = (l: { settled(): Promise<void> }, ms = 200) =>
  Promise.race([
    l.settled().then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), ms)),
  ]);

describe('link across overlapping transactions', () => {
  it('earlier confirms, later rolls back: the endpoint ends at the surviving value', async () => {
    const tree = signalTree({ x: 0, z: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const relation = link(tree.$.x, { set: (v) => void sent.push(v) });
    await flush();
    sent.length = 0;

    const p1 = tree.transact(() => tree.$.x(1));
    await flush();
    const p2 = tree.transact(() => {
      tree.$.z(9);
      tree.$.x(5);
    });
    await flush();
    p1.confirm();
    await flush();
    p2.rollback();
    await flush();

    expect(tree.$.x()).toBe(1);
    expect(await settledWithin(relation)).toBe(true);
    expect(sent.at(-1)).toBe(1);
    expect(sent).not.toContain(5);
    relation.dispose();
    tree.destroy();
  });

  it('the later rollback notifies subscribers of its compensation', async () => {
    const tree = signalTree({ x: 0, z: 0 }, { enhancers: [transactions()] });
    const seen: string[] = [];
    const off = getPathNotifier().subscribe('**', (v, prev, path) => {
      if (path === 'x' || path === 'z') seen.push(`${path}:${prev}->${v}`);
    });
    const p1 = tree.transact(() => tree.$.x(1));
    await flush();
    const p2 = tree.transact(() => {
      tree.$.z(9);
      tree.$.x(5);
    });
    await flush();
    p1.confirm();
    await flush();
    seen.length = 0;
    p2.rollback();
    await flush();

    expect(seen).toEqual(expect.arrayContaining(['x:5->1', 'z:9->0']));
    off();
    tree.destroy();
  });

  it('single-write later transaction, same order', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const relation = link(tree.$.x, { set: (v) => void sent.push(v) });
    await flush();
    sent.length = 0;
    const p1 = tree.transact(() => tree.$.x(1));
    await flush();
    const p2 = tree.transact(() => tree.$.x(5));
    await flush();
    p1.confirm();
    await flush();
    p2.rollback();
    await flush();
    expect(tree.$.x()).toBe(1);
    expect(await settledWithin(relation)).toBe(true);
    expect(sent.at(-1)).toBe(1);
    relation.dispose();
    tree.destroy();
  });

  it('three overlapping transactions: middle confirms, newest rolls back, oldest confirms', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const relation = link(tree.$.x, { set: (v) => void sent.push(v) });
    await flush();
    sent.length = 0;
    const p1 = tree.transact(() => tree.$.y(1));
    await flush();
    const p2 = tree.transact(() => tree.$.x(2));
    await flush();
    const p3 = tree.transact(() => {
      tree.$.x(3);
      tree.$.y(3);
    });
    await flush();
    p2.confirm();
    await flush();
    p3.rollback();
    await flush();
    p1.confirm();
    await flush();
    expect(tree.$.x()).toBe(2);
    expect(await settledWithin(relation)).toBe(true);
    expect(sent.at(-1)).toBe(2);
    relation.dispose();
    tree.destroy();
  });

  it('entity field overlap: the endpoint ends at the surviving row', async () => {
    type Row = { id: string; score: number };
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }), z: 0 },
      { enhancers: [transactions()] }
    );
    tree.$.rows.addOne({ id: 'A', score: 0 });
    await flush();
    const sent: Row[][] = [];
    const relation = link(tree.$.rows, {
      set: (v) => void sent.push(v as Row[]),
    });
    await flush();
    sent.length = 0;
    const p1 = tree.transact(() => tree.$.rows.updateOne('A', { score: 1 }));
    await flush();
    const p2 = tree.transact(() => {
      tree.$.z(9);
      tree.$.rows.updateOne('A', { score: 5 });
    });
    await flush();
    p1.confirm();
    await flush();
    p2.rollback();
    await flush();
    expect(tree.$.rows.byIdOrFail('A')().score).toBe(1);
    expect(await settledWithin(relation)).toBe(true);
    const last = sent.at(-1);
    expect(last?.find((r) => r.id === 'A')?.score).toBe(1);
    relation.dispose();
    tree.destroy();
  });

  it('an earlier turn settled INSIDE a later callback spares what that callback wrote', async () => {
    const tree = signalTree({ x: 0, z: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const relation = link(tree.$.x, { set: (v) => void sent.push(v) });
    await flush();
    sent.length = 0;
    const p1 = tree.transact(() => tree.$.x(1));
    await flush();
    // p2's writes are still in its OPEN bucket, not yet a pending turn, when
    // p1 settles.
    const p2 = tree.transact(() => {
      tree.$.z(9);
      tree.$.x(5);
      p1.confirm();
    });
    await flush();
    p2.rollback();
    await flush();
    expect(tree.$.x()).toBe(1);
    expect(await settledWithin(relation)).toBe(true);
    expect(sent.at(-1)).toBe(1);
    relation.dispose();
    tree.destroy();
  });

  it('an earlier turn settled after a MID-CALLBACK flush spares the open bucket', async () => {
    // Guard, not a public path: no public entry point flushes the notifier
    // inside a callback today (nesting is rejected, restoration flushes at
    // 'staged'). An internal flush would capture p2's writes into its OPEN
    // bucket, and nothing would recreate the descriptor p1 then forgets.
    const tree = signalTree({ x: 0, z: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const relation = link(tree.$.x, { set: (v) => void sent.push(v) });
    await flush();
    sent.length = 0;
    const p1 = tree.transact(() => tree.$.x(1));
    await flush();
    const p2 = tree.transact(() => {
      tree.$.z(9);
      tree.$.x(5);
      getPathNotifier().flushSync();
      p1.confirm();
    });
    await flush();
    p2.rollback();
    await flush();
    expect(tree.$.x()).toBe(1);
    expect(await settledWithin(relation)).toBe(true);
    expect(sent.at(-1)).toBe(1);
    relation.dispose();
    tree.destroy();
  });

  it('a lone transaction still forgets the descriptor it created', async () => {
    // Sparing applies only while a pending turn needs a descriptor; without
    // one the settlement still collects, so the map does not grow per write.
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const descriptors = () =>
      getTreeRealizationDescriptors(tree as unknown as object)?.size ?? 0;
    const before = descriptors();
    tree.transact(() => tree.$.x(1)).confirm();
    await flush();
    tree.transact(() => tree.$.x(2)).rollback();
    await flush();
    expect(descriptors()).toBe(before);
    tree.destroy();
  });

  it('restoration undo after two overlapping confirmed transactions still notifies', async () => {
    // The spared descriptor must keep the protection a later transaction's
    // before-snapshot gives it. Collecting it silenced this undo: the tree
    // went back to 1 while the endpoint stayed on 2.
    const tree = signalTree(
      { x: 0 },
      { enhancers: [restoration({ maxHistorySize: 10 }), transactions()] }
    );
    const sent: number[] = [];
    const relation = link(tree.$.x, { set: (v) => void sent.push(v) });
    await flush();
    sent.length = 0;
    const p1 = tree.transact(() => undoable(() => tree.$.x(1)));
    await flush();
    const p2 = tree.transact(() => undoable(() => tree.$.x(2)));
    await flush();
    p1.confirm();
    await flush();
    p2.confirm();
    await flush();
    tree.undo();
    await flush();
    expect(tree.$.x()).toBe(1);
    expect(await settledWithin(relation)).toBe(true);
    expect(sent.at(-1)).toBe(1);
    relation.dispose();
    tree.destroy();
  });

  it('settled() resolves after repeated flushes behind an UNRELATED pending transaction', async () => {
    // The widest trigger of the orphaned release signal: no overlap and no
    // rollback. On 15.3.0 two flushes of the linked source while any
    // transaction was pending left settled() waiting forever, although the
    // endpoint itself received the right value.
    const tree = signalTree(
      { x: 0, other: 0 },
      { enhancers: [transactions()] }
    );
    const sent: number[] = [];
    const relation = link(tree.$.x, { set: (v) => void sent.push(v) });
    await flush();
    sent.length = 0;
    const pending = tree.transact(() => tree.$.other(1));
    await flush();
    tree.$.x(10);
    await flush();
    tree.$.x(20);
    await flush();
    pending.confirm();
    await flush();
    expect(await settledWithin(relation)).toBe(true);
    expect(sent.at(-1)).toBe(20);
    relation.dispose();
    tree.destroy();
  });

  it('one transaction writing two separately linked locations reaches both endpoints', async () => {
    // Every relationship used to share one collapse key, so the second link's
    // flush replaced the first one's held consequence while the transaction
    // was open: endpoint A never received 1 and its settled() never resolved.
    const tree = signalTree({ a: 0, b: 0 }, { enhancers: [transactions()] });
    const sentA: number[] = [];
    const sentB: number[] = [];
    const linkA = link(tree.$.a, { set: (v) => void sentA.push(v) });
    const linkB = link(tree.$.b, { set: (v) => void sentB.push(v) });
    await flush();
    sentA.length = 0;
    sentB.length = 0;
    const pending = tree.transact(() => {
      tree.$.a(1);
      tree.$.b(2);
    });
    await flush();
    pending.confirm();
    await flush();
    expect(await settledWithin(linkA)).toBe(true);
    expect(await settledWithin(linkB)).toBe(true);
    expect(sentA.at(-1)).toBe(1);
    expect(sentB.at(-1)).toBe(2);
    linkA.dispose();
    linkB.dispose();
    tree.destroy();
  });

  it('two links on one location both receive a write held behind a pending transaction', async () => {
    const tree = signalTree(
      { x: 0, other: 0 },
      { enhancers: [transactions()] }
    );
    const first: number[] = [];
    const second: number[] = [];
    const l1 = link(tree.$.x, { set: (v) => void first.push(v) });
    const l2 = link(tree.$.x, { set: (v) => void second.push(v) });
    await flush();
    first.length = 0;
    second.length = 0;
    const pending = tree.transact(() => tree.$.other(1));
    await flush();
    tree.$.x(7);
    await flush();
    pending.confirm();
    await flush();
    expect(await settledWithin(l1)).toBe(true);
    expect(await settledWithin(l2)).toBe(true);
    expect(first.at(-1)).toBe(7);
    expect(second.at(-1)).toBe(7);
    l1.dispose();
    l2.dispose();
    tree.destroy();
  });

  it('undo and redo stay observable whichever overlapping transaction settles first', async () => {
    // A settlement can forget a scalar descriptor that restoration history
    // still needs; the undo must then notify on the effect's own path.
    const orders = [
      ['c2', 'c1'],
      ['r2', 'c1'],
      ['c2', 'r1'],
      ['r2', 'r1'],
      ['c1', 'c2'],
      ['c1', 'r2'],
    ] as const;
    for (const order of orders) {
      const tree = signalTree(
        { x: 0 },
        { enhancers: [restoration({ maxHistorySize: 10 }), transactions()] }
      );
      const sent: number[] = [];
      const relation = link(tree.$.x, { set: (v) => void sent.push(v) });
      await flush();
      const p1 = tree.transact(() => undoable(() => tree.$.x(1)));
      await flush();
      const p2 = tree.transact(() => undoable(() => tree.$.x(2)));
      await flush();
      for (const step of order) {
        const pending = step.endsWith('1') ? p1 : p2;
        if (step.startsWith('c')) pending.confirm();
        else pending.rollback();
        await flush();
      }
      tree.undo();
      await flush();
      expect([order.join(','), sent.at(-1)]).toEqual([
        order.join(','),
        tree.$.x(),
      ]);
      tree.redo();
      await flush();
      expect([order.join(','), sent.at(-1)]).toEqual([
        order.join(','),
        tree.$.x(),
      ]);
      relation.dispose();
      tree.destroy();
    }
  });

  it('undo after an undoable write inside a confirmed transaction is observed', async () => {
    const tree = signalTree(
      { x: 0 },
      { enhancers: [restoration({ maxHistorySize: 10 }), transactions()] }
    );
    const sent: number[] = [];
    const relation = link(tree.$.x, { set: (v) => void sent.push(v) });
    await flush();
    tree.transact(() => undoable(() => tree.$.x(1))).confirm();
    await flush();
    tree.undo();
    await flush();
    expect(tree.$.x()).toBe(0);
    expect(sent.at(-1)).toBe(0);
    relation.dispose();
    tree.destroy();
  });

  it('rolling back two overlapping transactions newest-first in one tick is observed', async () => {
    // The two compensations coalesce; the merged write must keep its tree.
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const relation = link(tree.$.x, { set: (v) => void sent.push(v) });
    await flush();
    const t3 = tree.transact(() => tree.$.x(3));
    await flush();
    const t4 = tree.transact(() => tree.$.x(4));
    await flush();
    t4.rollback();
    t3.rollback();
    await flush();
    expect(tree.$.x()).toBe(0);
    expect(await settledWithin(relation)).toBe(true);
    expect(sent.at(-1)).toBe(0);
    relation.dispose();
    tree.destroy();
  });

  it('same-tick entity writes on two same-shaped trees reach both trees', async () => {
    type Row = { id: string; v: number };
    const make = () =>
      signalTree(
        { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
        { enhancers: [transactions()] }
      );
    const a = make();
    const b = make();
    a.$.rows.addOne({ id: 'r1', v: 1 });
    b.$.rows.addOne({ id: 'r1', v: 1 });
    await flush();
    const sentA: Row[][] = [];
    const sentB: Row[][] = [];
    const linkA = link(a.$.rows, { set: (v) => void sentA.push(v as Row[]) });
    const linkB = link(b.$.rows, { set: (v) => void sentB.push(v as Row[]) });
    await flush();
    a.$.rows.updateOne('r1', { v: 2 });
    b.$.rows.updateOne('r1', { v: 3 });
    await flush();
    expect(sentA.at(-1)?.[0]?.v).toBe(2);
    expect(sentB.at(-1)?.[0]?.v).toBe(3);
    linkA.dispose();
    linkB.dispose();
    a.destroy();
    b.destroy();
  });

  it('a disposed link does not stay held behind a pending transaction', async () => {
    const tree = signalTree(
      { x: 0, other: 0 },
      { enhancers: [transactions()] }
    );
    const pending = tree.transact(() => tree.$.other(1));
    await flush();
    for (let i = 1; i <= 5; i++) {
      const relation = link(tree.$.x, { set: () => undefined });
      tree.$.x(i);
      await flush();
      relation.dispose();
    }
    expect(getHeldConsequenceCountForTesting(tree.$)).toBe(0);
    pending.confirm();
    tree.destroy();
  });

  it('control: a lone rollback still notifies and settles', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const relation = link(tree.$.x, { set: (v) => void sent.push(v) });
    await flush();
    sent.length = 0;
    const p = tree.transact(() => tree.$.x(1));
    await flush();
    p.rollback();
    await flush();
    expect(tree.$.x()).toBe(0);
    expect(await settledWithin(relation)).toBe(true);
    expect(sent).not.toContain(1);
    relation.dispose();
    tree.destroy();
  });
});
