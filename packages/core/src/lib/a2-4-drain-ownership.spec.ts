import { describe, expect, it } from 'vitest';

import { getPathNotifier } from './path-notifier';
import { restoration } from '../enhancers/restoration/restoration';
import { scheduleDurableConsequence } from './internals/commit-consequence';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * A2-4 — DRAIN OWNERSHIP. Who legitimately knows about every pending durable
 * write when the host says "we may stop executing very soon"?
 *
 * TWO persisted leaves, because one cannot discriminate between per-node,
 * tree-scoped and process-global ownership. The production shape, from TruckTrax:
 *
 * ```text
 * settings.measurementSystem   debounced durability pending
 * settings.lastConnectedDevice debounced durability pending
 *        ↓
 * Capacitor: app is backgrounding
 *        ↓
 * ONE host invocation
 *        ↓
 * both pending writes durable
 * ```
 *
 * The candidates, and what each would cost the application:
 *
 * ```text
 * per-node     the app retains every controller and calls flush() on each —
 *              rebuilding the capability boundary SignalTree declined to own
 * tree-scoped  one object naturally owns every registration for that tree
 * global       reaches every tree in the process — only justified if production
 *              needs a CROSS-TREE drain, which must be shown, not assumed
 * ```
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

/**
 * A tree-scoped durability capability, built only from what A2-3 proved
 * necessary: the TREE as consequence claimant, plus its own registry of pending
 * writes so a single call can drain them all.
 */
const makeDurability = (tree: object, store: Map<string, unknown>) => {
  const pending = new Map<string, () => void>();
  const durableWrites: string[] = [];
  const paths = new Set<string>();

  const off = getPathNotifier().subscribe('**', (next, _p, path) => {
    if (!paths.has(path)) return;
    // Debounced: the write is ARMED, not performed.
    pending.set(path, () => {
      store.set(path, next);
      durableWrites.push(path);
    });
  });

  return {
    persist(path: string) {
      paths.add(path);
    },
    /** The host drain. One call, every armed write for THIS tree. */
    flush() {
      for (const [path, run] of pending) {
        scheduleDurableConsequence({ claimant: tree, key: path, run });
      }
      pending.clear();
    },
    pendingCount: () => pending.size,
    durableWrites,
    off,
  };
};

describe('A2-4: one host event, two persisted leaves', () => {
  it('a TREE-SCOPED capability drains both from a single call', async () => {
    const store = new Map<string, unknown>();
    const tree = signalTree(
      { measurementSystem: 'metric', lastDevice: null as string | null },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();

    const durability = makeDurability(tree, store);
    durability.persist('measurementSystem');
    durability.persist('lastDevice');

    tree.$.measurementSystem.set('imperial');
    tree.$.lastDevice.set('glinx-7');
    await flush();

    // Both armed, neither durable — the debounce has not elapsed.
    expect(durability.pendingCount()).toBe(2);
    expect(store.size).toBe(0);

    // The host backgrounds. ONE invocation.
    durability.flush();
    await flush();
    durability.off();

    expect(durability.durableWrites.sort()).toEqual([
      'lastDevice',
      'measurementSystem',
    ]);
    expect(store.get('measurementSystem')).toBe('imperial');
    expect(store.get('lastDevice')).toBe('glinx-7');
  });

  it('⚠️ the drain still respects settlement — it is not an override', async () => {
    const store = new Map<string, unknown>();
    const tree = signalTree(
      { measurementSystem: 'metric' },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();

    const durability = makeDurability(tree, store);
    durability.persist('measurementSystem');

    const pending = tree.transaction(() => {
      tree.$.measurementSystem.set('imperial');
    });
    await flush();

    // The host backgrounds MID-TRANSACTION. A drain that simply wrote would
    // make speculative state durable at the worst possible moment — the app is
    // about to stop, so there may be no rollback to correct it.
    durability.flush();
    await flush();
    const duringPending = store.get('measurementSystem');

    pending.rollback();
    await flush();
    durability.off();

    // Routing the drain through the SAME consequence authority means the host
    // cannot accidentally override settlement.
    expect(duringPending).toBeUndefined();
    expect(tree.$.measurementSystem()).toBe('metric');
  });

  it('CONTROL — two INDEPENDENT trees do not share a drain', async () => {
    const storeA = new Map<string, unknown>();
    const storeB = new Map<string, unknown>();
    // ⚠️ DISTINCT PATHS, deliberately. This control first used `theme` in BOTH
    // trees and failed — because the path notifier coalesces by PATH STRING
    // within a flush, with no tree qualification, so tree A's write never
    // reached the stream at all. That is a real defect in a shared observation
    // seam, it is NOT persistence's, and it is carried as its own finding
    // (NOTIFIER-SCOPE-0). Using distinct paths keeps THIS test on ITS question,
    // which is drain ownership.
    const a = signalTree({ alpha: 'light' }, { enhancers: [restoration()] });
    const b = signalTree({ beta: 'light' }, { enhancers: [restoration()] });
    await flush();

    const dA = makeDurability(a, storeA);
    const dB = makeDurability(b, storeB);
    dA.persist('alpha');
    dB.persist('beta');

    a.$.alpha.set('dark');
    b.$.beta.set('solarized');
    await flush();

    dA.flush();
    await flush();

    // ⚠️ THE QUESTION A GLOBAL DRAIN WOULD ANSWER, and it is left OPEN by
    // design. A tree-scoped drain reaches one tree; tree B's armed write is
    // still pending. Whether that is a defect depends on whether production
    // needs ONE host event to drain MULTIPLE trees — which TruckTrax does not
    // demonstrate: its drain call site is a single app tree.
    expect(storeA.get('alpha')).toBe('dark');
    expect(dB.pendingCount()).toBe(1);
    expect(storeB.size).toBe(0);

    dB.flush();
    await flush();
    expect(storeB.get('beta')).toBe('solarized');
    dA.off();
    dB.off();
  });
});
