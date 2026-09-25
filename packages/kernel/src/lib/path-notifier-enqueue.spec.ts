import { describe, expect, it, vi } from 'vitest';
import { PathNotifier, getPathNotifier } from './path-notifier';
import { getPositionRegistry } from './internals/position-registry';
import { signalTree } from './signal-tree';
import {
  transactions,
  peekInternalTransactionRuntime,
} from '../enhancers/transactions/transactions';
import { link } from './link';

const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('private enqueue observation', () => {
  it('is owner scoped, synchronous, immutable across coalescing, and idempotently released', () => {
    const notifier = new PathNotifier();
    const seen: unknown[] = [];
    const off = notifier.observeEnqueue(11, (entry) => seen.push(entry));
    const positions = [2];
    notifier.notify('x', 1, 0, 'x', undefined, positions, undefined, 22);
    expect(seen).toEqual([]);
    notifier.notify('x', 1, 0, 'x', undefined, positions, undefined, 11);
    positions[0] = 99;
    notifier.notify('x', 0, 1, 'x', undefined, [2], undefined, 11);
    expect(seen).toMatchObject([
      { newValue: 1, oldValue: 0, positionIds: [2] },
      { newValue: 0, oldValue: 1, positionIds: [2] },
    ]);
    expect(Object.isFrozen(seen[0])).toBe(true);
    off();
    const second = vi.fn();
    const offSecond = notifier.observeEnqueue(11, second);
    off();
    notifier.notify('x', 3, 0, 'x', undefined, [2], undefined, 11);
    expect(second).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(2);
    offSecond();
    notifier.clear();
  });

  it('contains observer exceptions without interrupting a canonical mutation', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const report = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const off = getPathNotifier().observeEnqueue(
      getPositionRegistry(tree.$)!.id,
      () => {
        throw new Error('observer');
      }
    );
    try {
      expect(() => tree.$.x(1)).not.toThrow();
      expect(tree.$.x()).toBe(1);
      await flush();
      expect(report).toHaveBeenCalled();
    } finally {
      off();
      tree.destroy();
      report.mockRestore();
    }
  });

  it('does not duplicate turns or publish a pending before settlement', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const connection = link(tree.$.x, {
      set: (value) => {
        sent.push(value);
      },
    });
    try {
      const runtime = peekInternalTransactionRuntime(tree)!;
      const created = vi.fn();
      const off = runtime.onPendingCreated(created);
      const pending = tree.transact(() => tree.$.x(1));
      await flush();
      pending.inspect();
      pending.inspect();
      expect(created).toHaveBeenCalledTimes(1);
      expect(runtime.getPendingTurnCount()).toBe(1);
      expect(runtime.getConfirmedTurnCount()).toBe(0);
      expect(sent).toEqual([]);
      pending.confirm();
      await connection.settled();
      expect(sent).toEqual([1]);
      expect(runtime.getPendingTurnCount()).toBe(0);
      off();
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('releases the owner callback at tree destruction', () => {
    const notifier = getPathNotifier();
    const register = vi.spyOn(notifier, 'observeEnqueue');
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const owner = getPositionRegistry(tree.$)!.id;
    // Registration is on demand (L19), so open a turn to register it.
    const pending = tree.transact(() => tree.$.x(1));
    const callback = register.mock.calls.find(([id]) => id === owner)?.[1];
    expect(callback).toBeDefined();
    void pending;
    tree.destroy();
    // Inspect ownership directly; no timing-dependent GC claim in this control.
    const observers = (
      notifier as unknown as { enqueueObservers: Map<number, unknown> }
    ).enqueueObservers;
    expect(observers.has(owner)).toBe(false);
    register.mockRestore();
  });

  // L19: an idle tree must not pay for evidence it will never record.
  const observerCount = (owner: number): number => {
    const observers = (
      getPathNotifier() as unknown as {
        enqueueObservers: Map<number, Set<unknown>>;
      }
    ).enqueueObservers;
    return observers.get(owner)?.size ?? 0;
  };

  it('does not register the evidence observer on a tree that never transacts', () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const owner = getPositionRegistry(tree.$)!.id;
    for (let i = 0; i < 10; i++) tree.$.x(i);
    expect(observerCount(owner)).toBe(0);
    tree.destroy();
  });

  it('registers before the first write inside transact(), so inspect() sees it', () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const owner = getPositionRegistry(tree.$)!.id;
    let registeredDuringCallback = -1;
    const pending = tree.transact(() => {
      registeredDuringCallback = observerCount(owner);
      tree.$.x(1);
    });
    expect(registeredDuringCallback).toBe(1);
    expect(pending.inspect().changes).toEqual([
      { path: 'x', address: ['x'], status: 'current' },
    ]);
    pending.confirm();
    tree.destroy();
  });

  it('stays registered while any turn is pending and releases at quiescence', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const owner = getPositionRegistry(tree.$)!.id;
    const first = tree.transact(() => tree.$.x(1));
    await flush();
    const second = tree.transact(() => tree.$.y(2));
    await flush();
    first.confirm();
    await flush();
    // One turn is still pending, so a later write must still be observed.
    expect(observerCount(owner)).toBe(1);
    tree.$.y(3);
    await flush();
    expect(second.inspect().changes).toEqual([
      { path: 'y', address: ['y'], status: 'superseded' },
    ]);
    second.confirm();
    await flush();
    expect(observerCount(owner)).toBe(0);
    tree.destroy();
  });

  it('releases after a rollback empties the tree', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const owner = getPositionRegistry(tree.$)!.id;
    const pending = tree.transact(() => tree.$.x(1));
    await flush();
    pending.rollback();
    await flush();
    expect(tree.$.x()).toBe(0);
    expect(observerCount(owner)).toBe(0);
    tree.destroy();
  });

  it('scopes registration per tree', async () => {
    const a = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const b = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const ownerA = getPositionRegistry(a.$)!.id;
    const ownerB = getPositionRegistry(b.$)!.id;
    const pending = a.transact(() => a.$.x(1));
    await flush();
    expect(observerCount(ownerA)).toBe(1);
    expect(observerCount(ownerB)).toBe(0);
    pending.confirm();
    await flush();
    a.destroy();
    b.destroy();
  });

  it('does not churn registration across a synchronous burst of transactions', async () => {
    const notifier = getPathNotifier();
    const register = vi.spyOn(notifier, 'observeEnqueue');
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const owner = getPositionRegistry(tree.$)!.id;
    for (let i = 1; i <= 50; i++) tree.transact(() => tree.$.x(i)).confirm();
    // Quiescent between every pair, but release is deferred, so one registration.
    expect(register.mock.calls.filter(([id]) => id === owner)).toHaveLength(1);
    expect(observerCount(owner)).toBe(1);
    await flush();
    expect(observerCount(owner)).toBe(0);
    register.mockRestore();
    tree.destroy();
  });

  it('keeps the observer when a turn reopens before the deferred release runs', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const owner = getPositionRegistry(tree.$)!.id;
    tree.transact(() => tree.$.x(1)).confirm(); // schedules a deferred release
    const reopened = tree.transact(() => tree.$.x(2)); // before the microtask runs
    await flush(); // the deferred release fires here and must stand down
    expect(observerCount(owner)).toBe(1);
    tree.$.x(3);
    await flush();
    expect(reopened.inspect().changes).toEqual([
      { path: 'x', address: ['x'], status: 'superseded' },
    ]);
    reopened.confirm();
    await flush();
    expect(observerCount(owner)).toBe(0);
    tree.destroy();
  });

  it('is safe to destroy while a deferred release is pending', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const owner = getPositionRegistry(tree.$)!.id;
    tree.transact(() => tree.$.x(1)).confirm();
    tree.destroy();
    await expect(flush()).resolves.toBeUndefined();
    expect(observerCount(owner)).toBe(0);
  });

  it('re-registers for a later transaction after releasing', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const owner = getPositionRegistry(tree.$)!.id;
    tree.transact(() => tree.$.x(1)).confirm();
    await flush();
    expect(observerCount(owner)).toBe(0);
    const again = tree.transact(() => tree.$.x(2));
    expect(observerCount(owner)).toBe(1);
    expect(again.inspect().changes).toEqual([
      { path: 'x', address: ['x'], status: 'current' },
    ]);
    again.confirm();
    tree.destroy();
  });
  it('fails inspection closed after a hostile record prevents chronology capture', () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const report = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const runtime = peekInternalTransactionRuntime(tree)!;
      const pending = tree.transact(() => tree.$.x(1));
      const [turn] = runtime.getPendingTurnIds();
      const hostile = Object.defineProperty({}, 'x', {
        enumerable: true,
        get() {
          throw new Error('hostile record');
        },
      });
      expect(() =>
        getPathNotifier().notify(
          'hostile',
          hostile,
          { x: 0 },
          'hostile',
          undefined,
          [999],
          undefined,
          getPositionRegistry(tree.$)!.id
        )
      ).not.toThrow();
      expect(() => runtime.describePendingTurn(turn)).toThrow(
        'inspection unavailable'
      );
      expect(tree.$.x()).toBe(1);
      // The low-level settlement handle does not depend on the inspection UI.
      pending.confirm();
      // Discard the synthetic hostile delivery after proving the enqueue seam.
      getPathNotifier().clear();
      getPathNotifier().emitReset();
      const fresh = tree.transact(() => tree.$.x(2));
      expect(fresh.inspect().changes).toEqual([
        { path: 'x', address: ['x'], status: 'current' },
      ]);
    } finally {
      tree.destroy();
      report.mockRestore();
    }
  });
});
