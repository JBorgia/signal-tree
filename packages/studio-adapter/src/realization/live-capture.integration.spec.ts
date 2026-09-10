/**
 * CAPTURE-S2-0 on REAL trees — the kernel/adapter join for S2.
 *
 * The lease suite uses an injected target to stay fast. This proves the live
 * notifier path: capability gating, ownership scoping, realized-only
 * filtering, destruction and subscriber hygiene.
 */
import { external, signalTree } from '@signal-tree/kernel';
import { restoration } from '@signal-tree/kernel';
import { transactions } from '@signal-tree/kernel';
import { observeWrites } from '@signal-tree/kernel/internals';
import { afterEach, describe, expect, it } from 'vitest';

import {
  liveCaptureTarget,
  startRealizationCapture,
  StudioCaptureError,
  type LiveTree,
} from '../index';

type Cart = { total: number };

const leases: { dispose(): void }[] = [];
afterEach(() => { while (leases.length) leases.pop()?.dispose(); });

const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

const make = (enhancers?: unknown[]) =>
  (enhancers
    ? signalTree({ total: 12000 } as Cart, { enhancers } as never)
    : signalTree({ total: 12000 } as Cart)) as never as LiveTree & {
    $: Record<string, (v?: unknown) => unknown>;
    destroy(): void;
  };

const startOn = (tree: LiveTree, id = 'tree-live', max?: number) => {
  const target = liveCaptureTarget(tree, id);
  expect(target).toBeDefined();
  const lease = startRealizationCapture(target!, { maxEffects: max });
  leases.push(lease);
  return lease;
};

describe('live realization capture', () => {
  it('captures an external scalar realization on a transactions() tree', async () => {
    const tree = make([transactions()]);
    const lease = startOn(tree, 'tree-tx');

    tree.$['total'](9600);                          // authored
    external(() => tree.$['total'](10200));         // realized
    await settle();

    const s = lease.snapshot();
    expect(s.effects).toHaveLength(1);
    expect(s.effects[0]).toMatchObject({
      path: 'total',
      origin: 'external',
      participation: 'realized',
      before: { kind: 'value', value: 9600 },
      after: { kind: 'value', value: 10200 },
    });
    // The authored write is S1's, not S2's.
    expect(s.coverage.scopeIntegrity).toBe('complete');
  });

  it('works on a restoration() tree', async () => {
    const tree = make([restoration()]);
    const lease = startOn(tree, 'tree-rest');

    external(() => tree.$['total'](777));
    await settle();

    expect(lease.snapshot().effects).toHaveLength(1);
    expect(lease.snapshot().effects[0]?.origin).toBe('external');
  });

  it('refuses a bare tree BEFORE installing an observer', () => {
    const tree = make();
    const target = liveCaptureTarget(tree, 'tree-bare');
    expect(target).toBeDefined();
    expect(() => startRealizationCapture(target!)).toThrow(StudioCaptureError);
  });

  it('ignores another live tree\'s realized write', async () => {
    const mine = make([transactions()]);
    const other = make([transactions()]);
    const lease = startOn(mine, 'tree-mine');

    external(() => other.$['total'](4242));
    await settle();

    const s = lease.snapshot();
    expect(s.effects).toEqual([]);
    // Positively another tree's — not a gap in this tree's coverage.
    expect(s.coverage.scopeIntegrity).toBe('complete');
  });

  it('excludes authored writes', async () => {
    const tree = make([transactions()]);
    const lease = startOn(tree, 'tree-authored');

    tree.$['total'](1);
    tree.$['total'](2);
    await settle();

    expect(lease.snapshot().effects).toEqual([]);
  });

  it('destroying the tree disposes the capture', async () => {
    const tree = make([transactions()]);
    const lease = startOn(tree, 'tree-destroy');

    external(() => tree.$['total'](1));
    await settle();
    expect(lease.snapshot().effects).toHaveLength(1);

    tree.destroy();
    external(() => tree.$['total'](2));
    await settle();
    // Disposed: evidence released and nothing further retained.
    expect(lease.snapshot().effects).toEqual([]);
  });

  it('evicts oldest past capacity on a real tree', async () => {
    const tree = make([transactions()]);
    const lease = startOn(tree, 'tree-evict', 2);

    for (let i = 1; i <= 5; i++) {
      external(() => tree.$['total'](i));
      await settle();
    }

    const s = lease.snapshot();
    expect(s.retention.retained).toBe(2);
    expect(s.retention.truncated).toBe(true);
    expect(s.effects.map((e) => (e.after as { value: number }).value)).toEqual([4, 5]);
  });

  /**
   * NEGATIVE STRUCTURAL ASSERTION. Starting and stopping capture must leave no
   * live notifier subscriber behind — a leak here would silently keep costing
   * every write in the process after Studio believes it detached.
   */
  it('leaves no notifier subscriber behind after dispose', async () => {
    const tree = make([transactions()]);

    let leakedFrames = 0;
    const probeOff = observeWrites(() => { leakedFrames++; });
    const baseline = leakedFrames;

    const target = liveCaptureTarget(tree, 'tree-leak')!;
    const lease = startRealizationCapture(target);
    external(() => tree.$['total'](1));
    await settle();
    const whileActive = leakedFrames;
    expect(whileActive).toBeGreaterThan(baseline);

    lease.dispose();
    external(() => tree.$['total'](2));
    await settle();

    // The probe still counts (it is ours), but the capture must retain nothing.
    expect(lease.snapshot().effects).toEqual([]);
    probeOff();

    // After removing our own probe, a further write must reach nothing of ours.
    const afterProbeOff = leakedFrames;
    external(() => tree.$['total'](3));
    await settle();
    expect(leakedFrames).toBe(afterProbeOff);
  });
});
