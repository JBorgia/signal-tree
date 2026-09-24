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
    const callback = register.mock.calls.find(([id]) => id === owner)?.[1];
    expect(callback).toBeDefined();
    tree.destroy();
    // Inspect ownership directly; no timing-dependent GC claim in this control.
    const observers = (
      notifier as unknown as { enqueueObservers: Map<number, unknown> }
    ).enqueueObservers;
    expect(observers.has(owner)).toBe(false);
    register.mockRestore();
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
