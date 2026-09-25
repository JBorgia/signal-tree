import { describe, expect, it } from 'vitest';

import { getTreeRealizationDescriptors } from './internals/causal-runtime/tree-realization-adapter';
import { entityMap } from './markers/entity-map';
import { link } from './link';
import { getPathNotifier } from './path-notifier';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

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

    const p1 = tree.transaction(() => tree.$.x(1));
    await flush();
    const p2 = tree.transaction(() => {
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
    const p1 = tree.transaction(() => tree.$.x(1));
    await flush();
    const p2 = tree.transaction(() => {
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
    const p1 = tree.transaction(() => tree.$.x(1));
    await flush();
    const p2 = tree.transaction(() => tree.$.x(5));
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
    const p1 = tree.transaction(() => tree.$.y(1));
    await flush();
    const p2 = tree.transaction(() => tree.$.x(2));
    await flush();
    const p3 = tree.transaction(() => {
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
    const p1 = tree.transaction(() => tree.$.rows.updateOne('A', { score: 1 }));
    await flush();
    const p2 = tree.transaction(() => {
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
    const p1 = tree.transaction(() => tree.$.x(1));
    await flush();
    // p2's writes are still in its OPEN bucket, not yet a pending turn, when
    // p1 settles.
    const p2 = tree.transaction(() => {
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
    const p1 = tree.transaction(() => tree.$.x(1));
    await flush();
    const p2 = tree.transaction(() => {
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

  it('spared descriptors are collected once nothing pending needs them', async () => {
    const tree = signalTree({ x: 0, z: 0 }, { enhancers: [transactions()] });
    const descriptors = () =>
      getTreeRealizationDescriptors(tree as unknown as object)?.size ?? 0;
    // A lone transaction leaves nothing behind; that is the baseline.
    tree.transaction(() => tree.$.x(1)).confirm();
    await flush();
    const baseline = descriptors();

    const p1 = tree.transaction(() => tree.$.x(2));
    await flush();
    const p2 = tree.transaction(() => {
      tree.$.z(9);
      tree.$.x(5);
    });
    await flush();
    p1.confirm(); // must spare x's descriptor: p2 still needs it
    await flush();
    expect(descriptors()).toBeGreaterThan(baseline);
    p2.rollback();
    await flush();
    // Nothing is pending any more, so nothing spared may remain.
    expect(descriptors()).toBe(baseline);
    // And a later transaction cycle still ends at the baseline.
    tree.transaction(() => tree.$.x(3)).confirm();
    await flush();
    expect(descriptors()).toBe(baseline);
    tree.destroy();
  });

  it('control: a lone rollback still notifies and settles', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const relation = link(tree.$.x, { set: (v) => void sent.push(v) });
    await flush();
    sent.length = 0;
    const p = tree.transaction(() => tree.$.x(1));
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
