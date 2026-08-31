import { undoable } from '../../lib/undoable';
import { describe, expect, it, vi } from 'vitest';

import { getTreeRealizationPort } from '../../lib/internals/causal-runtime/tree-realization-adapter';
import { entityMap } from '../../lib/markers/entity-map';
import { interceptLeafSignals } from '../../lib/internals/intercept-leaf-signals';
import { signalTree } from '../../lib/signal-tree';
import { SignalTreeRollbackError } from '../../lib/types';
import { transactions } from '../transactions/transactions';
import { enableRestoration, restoration, withRestoration } from './restoration';

type ScopedAuthorityNode = {
  __positionIds?: number[];
};

type InternalRestorationManager = {
  undoAt(positionId: number): boolean;
  redoAt(positionId: number): boolean;
  canUndoAt(positionId: number): boolean;
  canRedoAt(positionId: number): boolean;
  containsPosition(
    authorityPositionId: number,
    participantPositionId: number
  ): boolean;
  getFrontier(positionId: number): number;
};

describe('restoration enhancer', () => {
  const expectRollbackError = (
    attempt: () => void,
    expectedCause: Record<string, unknown>
  ): void => {
    try {
      attempt();
      throw new Error('Expected rollback to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(SignalTreeRollbackError);
      const rollbackError = error as SignalTreeRollbackError;
      expect(rollbackError.code).toBe('SIGNALTREE_ROLLBACK_FAILED');
      // ⚠️ STRENGTHENED, NOT LOOSENED. This asserted the message was EXACTLY
      // the constant — which is what made the TX-SURFACE-0 legibility
      // regression invisible: both refusal kinds produced that identical
      // sentence, and the kind survived only on `.cause`, which a thrown
      // error's message never shows. The assertion now requires the constant as
      // a PREFIX and requires the message to name which refusal happened.
      expect(rollbackError.message).toContain(
        'SignalTree could not rollback the pending transaction'
      );
      expect(rollbackError.message).toContain(
        (expectedCause as { kind: string }).kind
      );
      expect(rollbackError.cause).toMatchObject(expectedCause);
    }
  };

  it('exports factory and aliases', () => {
    expect(typeof restoration).toBe('function');
    expect(typeof restoration()).toBe('function');
    expect(typeof withRestoration).toBe('function');
    expect(typeof enableRestoration).toBe('function');
  });

  it('records a single restoration history entry per PathNotifier flush when batching is enabled', async () => {
    // Create the enhanced store
    const store = (await import('../../lib/signal-tree')).signalTree(
      { count: 0 },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    // Ensure global notifier is in default state and enabled for batching
    const { resetPathNotifier, getPathNotifier } = await import(
      '../../lib/path-notifier'
    );
    resetPathNotifier();
    const notifier = getPathNotifier();
    notifier.setBatchingEnabled(true);

    // DISPOSITION OF THE FORMER REENTRANT TEST: direct notifier.notify(...)
    // injection is an internal delivery mechanism, not an application write,
    // and one-microtask completion is not part of its contract. Reentrant tree
    // mutation remains supported and is characterized separately below using a
    // real tree write plus flushSync().
    //
    // Two designated writes land in one notifier flush and therefore produce
    // one history entry containing the final value.
    undoable(() => {
      store.$.count.set(1);
      store.$.count.set(2);
    });

    // Allow microtask flush
    await Promise.resolve();

    const history = t.getRestorationHistory();
    // INIT + 1 batch
    expect(history.length).toBeGreaterThanOrEqual(2);
    // Ensure the last entry reflects the latest value (not every PathNotifier will change tree, but restoration should snapshot tree.$())
    const last = history[history.length - 1];
    expect(last.state).toBeDefined();
  });

  it('records a reentrant subscriber mutation driven by a real tree write', async () => {
    const store = (await import('../../lib/signal-tree')).signalTree(
      { count: 0 },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const restorationRuntime = (store as any).__restoration;
    const { resetPathNotifier, getPathNotifier } = await import(
      '../../lib/path-notifier'
    );
    resetPathNotifier();
    const notifier = getPathNotifier();
    const unsubscribe = notifier.subscribe('count', (value) => {
      if (value === 1) {
        undoable(() => store.$.count.set(2));
      }
    });

    try {
      undoable(() => store.$.count.set(1));
      notifier.flushSync();

      expect(store.$.count()).toBe(2);
      expect(restorationRuntime.getRestorationHistory().at(-1)?.state).toEqual({
        count: 2,
      });
    } finally {
      unsubscribe();
      store.destroy();
    }
  });

  it('records history when a top-level leaf signal is written via .set()', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = (await import('../../lib/signal-tree')).signalTree(
      { count: 0 },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;
    const initial = t.getRestorationHistory().length;

    undoable(() => (store as any).$.count.set(5));

    await Promise.resolve();
    await Promise.resolve();

    const history = t.getRestorationHistory();
    expect(history.length).toBeGreaterThan(initial);
    expect(history[history.length - 1].state).toEqual({ count: 5 });
  });

  it('records history when a nested leaf signal is written via .set()', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = (await import('../../lib/signal-tree')).signalTree(
      { user: { profile: { name: 'Ada' } } },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;
    const initial = t.getRestorationHistory().length;

    undoable(() => (store as any).$.user.profile.name.set('Grace'));

    await Promise.resolve();
    await Promise.resolve();

    const history = t.getRestorationHistory();
    expect(history.length).toBeGreaterThan(initial);
    expect(history[history.length - 1].state).toEqual({
      user: { profile: { name: 'Grace' } },
    });
  });

  it('returns a pending transaction: visible immediately, absent from confirmed history until confirm', async () => {
    const { getPathNotifier, resetPathNotifier } = await import(
      '../../lib/path-notifier'
    );
    resetPathNotifier();
    getPathNotifier().setBatchingEnabled(false);

    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        trucks: entityMap<{ id: number; driverId: number | null }, number>({
          selectId: (row) => row.id,
        }),
        orders: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;
    t.resetRestorationHistory();
    const baseline = t.getTurns().length;
    const baselineHistory = t.getRestorationHistory().length;

    const pending = store.transaction(() => {
      undoable(() => store.$.drivers.addOne({ id: 7, status: 'assigned' }));
      undoable(() => store.$.trucks.addOne({ id: 12, driverId: 7 }));
      undoable(() => store.$.orders.addOne({ id: 99, status: 'dispatched' }));
    });

    expect(store.$.drivers.all()).toEqual([{ id: 7, status: 'assigned' }]);
    expect(store.$.trucks.all()).toEqual([{ id: 12, driverId: 7 }]);
    expect(store.$.orders.all()).toEqual([{ id: 99, status: 'dispatched' }]);
    expect(store.canUndo()).toBe(false);
    expect(t.getRestorationHistory()).toHaveLength(baselineHistory);
    expect(t.getTurns()).toHaveLength(baseline + 1);

    const pendingTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    expect(t.getTurnStatus(pendingTurn.id)).toBe('pending');

    pending.confirm();

    const turns = t.getTurns();
    expect(turns).toHaveLength(baseline + 1);
    expect(store.canUndo()).toBe(true);
    expect(t.getRestorationHistory()).toHaveLength(baselineHistory + 1);
    const confirmedTurn = turns.at(-1) as {
      id: number;
      state: {
        drivers: { all: { id: number; status: string }[] };
        trucks: { all: { id: number; driverId: number | null }[] };
        orders: { all: { id: number; status: string }[] };
      };
      __ownerPaths?: string[];
      __positionIds?: number[];
    };
    expect(confirmedTurn.state).toEqual({
      drivers: { all: [{ id: 7, status: 'assigned' }] },
      trucks: { all: [{ id: 12, driverId: 7 }] },
      orders: { all: [{ id: 99, status: 'dispatched' }] },
    });
    expect([...(confirmedTurn.__ownerPaths ?? [])].sort()).toEqual([
      'drivers',
      'orders',
      'trucks',
    ]);
    expect(confirmedTurn.__positionIds).toHaveLength(3);
    expect(t.getTurnStatus(confirmedTurn.id)).toBe('applied');
  });

  it('rollback removes a pending transaction contribution without entering confirmed history', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        inside: '',
        outside: '',
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;
    t.resetRestorationHistory();
    const baseline = t.getTurns().length;
    const baselineHistory = t.getRestorationHistory().length;

    const pending = store.transaction(() => {
      undoable(() => store.$.inside.set('grouped'));
    });

    expect(store.$().inside).toBe('grouped');
    expect(store.canUndo()).toBe(false);
    expect(t.getTurns()).toHaveLength(baseline + 1);

    pending.rollback();

    expect(store.$()).toEqual({ inside: '', outside: '' });
    expect(store.canUndo()).toBe(false);
    expect(t.getRestorationHistory()).toHaveLength(baselineHistory);
    expect(t.getTurns()).toHaveLength(baseline);
  });

  it('does not capture writes scheduled after the explicit transaction callback returns', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        inside: '',
        outside: '',
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;
    t.resetRestorationHistory();
    const baseline = t.getTurns().length;
    const baselineHistory = t.getRestorationHistory().length;

    const pending = store.transaction(() => {
      undoable(() => store.$.inside.set('grouped'));
    });

    undoable(() => store.$.outside.set('later'));

    await Promise.resolve();
    await Promise.resolve();

    expect(store.$()).toEqual({ inside: 'grouped', outside: 'later' });
    expect(store.canUndo()).toBe(true);
    expect(t.getRestorationHistory()).toHaveLength(baselineHistory + 1);
    expect(t.getTurns()).toHaveLength(baseline + 2);

    pending.confirm();

    const turns = t.getTurns();
    expect(turns).toHaveLength(baseline + 2);
    expect(t.getRestorationHistory()).toHaveLength(baselineHistory + 2);
    const pendingTurn = turns.at(-2) as {
      id: number;
      state: { inside: string; outside: string };
      __ownerPaths?: string[];
    };
    const laterTurn = turns.at(-1) as {
      state: { inside: string; outside: string };
      __ownerPaths?: string[];
    };
    expect(pendingTurn.state).toEqual({ inside: 'grouped', outside: '' });
    expect(pendingTurn.__ownerPaths).toEqual(['inside']);
    expect(t.getTurnStatus(pendingTurn.id)).toBe('applied');
    expect(laterTurn.state).toEqual({ inside: 'grouped', outside: 'later' });
    expect(laterTurn.__ownerPaths).toEqual(['outside']);
  });

  it('rejects nested explicit transactions', () => {
    const store = signalTree(
      { count: 0 },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );

    expect(() =>
      store.transaction(() => {
        undoable(() => store.$.count.set(1));
        store.transaction(() => {
          undoable(() => store.$.count.set(2));
        });
      })
    ).toThrow(/nested transaction/i);
  });

  it('rolls back a thrown transaction callback through the realization port and records no turn', async () => {
    const { getPathNotifier, resetPathNotifier } = await import(
      '../../lib/path-notifier'
    );
    resetPathNotifier();
    getPathNotifier().setBatchingEnabled(false);

    const store = signalTree(
      { left: '', right: '' },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;
    t.resetRestorationHistory();
    const baseline = t.getTurns().length;
    const realizationPort = getTreeRealizationPort(store.$);
    if (!realizationPort) {
      throw new Error('Expected tree-owned realization port');
    }
    const applySpy = vi.spyOn(realizationPort, 'applyAtomically');

    expect(() =>
      store.transaction(() => {
        undoable(() => store.$.left.set('L'));
        undoable(() => store.$.right.set('R'));
        throw new Error('boom');
      })
    ).toThrow('boom');

    expect(store.$()).toEqual({ left: '', right: '' });
    expect(applySpy).toHaveBeenCalledTimes(1);

    const turns = t.getTurns();
    expect(turns).toHaveLength(baseline);
  });

  it('preserves causal order when a pending transaction is confirmed after a later confirmed turn', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      { x: '', y: '' },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;
    t.resetRestorationHistory();

    const pending = store.transaction(() => {
      undoable(() => store.$.x.set('pending'));
    });

    undoable(() => store.$.y.set('confirmed-later'));
    await Promise.resolve();
    await Promise.resolve();

    expect(store.canUndo()).toBe(true);
    const beforeConfirmTurns = t.getTurns();
    expect(beforeConfirmTurns.at(-2)?.state).toEqual({ x: 'pending', y: '' });
    expect(beforeConfirmTurns.at(-1)?.state).toEqual({
      x: 'pending',
      y: 'confirmed-later',
    });

    pending.confirm();

    expect(store.canUndo()).toBe(true);
    store.undo();
    expect(store.$()).toEqual({ x: 'pending', y: '' });
    store.undo();
    expect(store.$()).toEqual({ x: '', y: '' });
  });

  it('rolls back a pending scalar write through the realization port while preserving a later unrelated confirmed write', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        a: { x: 1 },
        b: { y: 2 },
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const realizationPort = getTreeRealizationPort(store.$);
    if (!realizationPort) {
      throw new Error('Expected tree-owned realization port');
    }
    const applySpy = vi.spyOn(realizationPort, 'applyAtomically');

    const pending = store.transaction(() => {
      undoable(() => store.$.a.x.set(10));
    });

    undoable(() => store.$.b.y.set(20));
    await Promise.resolve();
    await Promise.resolve();

    pending.rollback();

    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(store.$()).toEqual({
      a: { x: 1 },
      b: { y: 20 },
    });
  });

  it('rolls back a pending write while preserving a later sibling write under the same owner', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        profile: {
          name: '',
          email: 'old@example.com',
        },
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );

    const pending = store.transaction(() => {
      undoable(() => store.$.profile.name.set('Jon'));
    });

    undoable(() => store.$.profile.email.set('new@example.com'));
    await Promise.resolve();
    await Promise.resolve();

    pending.rollback();

    expect(store.$()).toEqual({
      profile: {
        name: '',
        email: 'new@example.com',
      },
    });
  });

  it('preserves a later confirmed replace write on the same scalar path', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      { x: 'A' },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    const pending = store.transaction(() => {
      undoable(() => store.$.x.set('B'));
    });

    undoable(() => store.$.x.set('C'));
    await Promise.resolve();
    await Promise.resolve();

    expect(store.$()).toEqual({ x: 'C' });
    expect(t.getRestorationHistory()).toHaveLength(2);
    expect(t.getTurns()).toHaveLength(3);

    pending.rollback();

    expect(store.$()).toEqual({ x: 'C' });
  });

  it('keeps pending and later same-microtask scalar writes as separate causal turns', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      { x: 10 },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    const pending = store.transaction(() => {
      undoable(() => store.$.x.set(20));
    });

    undoable(() => store.$.x.update((value) => (value as number) + 5));
    await Promise.resolve();
    await Promise.resolve();

    expect(store.$()).toEqual({ x: 25 });
    expect(t.getRestorationHistory()).toHaveLength(2);
    expect(t.getTurns()).toHaveLength(3);
    expect(t.getTurnStatus(t.getTurns().at(-2)?.id)).toBe('pending');
    expect(t.getTurnStatus(t.getTurns().at(-1)?.id)).toBe('applied');

    void pending;
  });

  it('preserves a later same-microtask replace write when rolling back a pending replace', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      { x: 10 },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );

    const pending = store.transaction(() => {
      undoable(() => store.$.x.set(20));
    });

    undoable(() => store.$.x.set(25));
    await Promise.resolve();
    await Promise.resolve();

    pending.rollback();

    expect(store.$()).toEqual({ x: 25 });
  });

  it('rejects rollback when a later same-microtask update derives from pending state', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      { x: 10 },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );

    const pending = store.transaction(() => {
      undoable(() => store.$.x.set(20));
    });

    undoable(() => store.$.x.update((value) => (value as number) + 5));
    await Promise.resolve();
    await Promise.resolve();

    expectRollbackError(() => pending.rollback(), {
      kind: 'later-confirmed-dependency',
    });
    expect(store.$()).toEqual({ x: 25 });
  });

  it('treats set then update in one later confirmed turn as replace for rollback classification', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      { x: 10 },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );

    const pending = store.transaction(() => {
      undoable(() => store.$.x.set(20));
    });

    undoable(() => store.$.x.set(100));
    undoable(() => store.$.x.update((value) => (value as number) + 5));
    await Promise.resolve();
    await Promise.resolve();

    pending.rollback();

    expect(store.$()).toEqual({ x: 105 });
  });

  it('treats update then set in one later confirmed turn as replace for rollback classification', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      { x: 10 },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );

    const pending = store.transaction(() => {
      undoable(() => store.$.x.set(20));
    });

    undoable(() => store.$.x.update((value) => (value as number) + 5));
    undoable(() => store.$.x.set(100));
    await Promise.resolve();
    await Promise.resolve();

    pending.rollback();

    expect(store.$()).toEqual({ x: 100 });
  });

  it('treats set then set in one later confirmed turn as replace for rollback classification', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      { x: 10 },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );

    const pending = store.transaction(() => {
      undoable(() => store.$.x.set(20));
    });

    undoable(() => store.$.x.set(100));
    undoable(() => store.$.x.set(105));
    await Promise.resolve();
    await Promise.resolve();

    pending.rollback();

    expect(store.$()).toEqual({ x: 105 });
  });

  it('treats update then update in one later confirmed turn as derive for rollback classification', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      { x: 10 },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );

    const pending = store.transaction(() => {
      undoable(() => store.$.x.set(20));
    });

    undoable(() => store.$.x.update((value) => (value as number) + 5));
    undoable(() => store.$.x.update((value) => (value as number) + 7));
    await Promise.resolve();
    await Promise.resolve();

    expectRollbackError(() => pending.rollback(), {
      kind: 'later-confirmed-dependency',
      pendingEffect: { kind: 'set' },
      conflictingEffect: { kind: 'set', mutationIntent: 'derive' },
    });
    expect(store.$()).toEqual({ x: 32 });
  });

  it('rolls back callable partial writes at leaf precision', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      { count: 10, title: 'Original' },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );

    const pending = store.transaction(() => {
      store.$({
        count: 20,
        title: 'Pending',
      });
    });

    undoable(() => store.$.count.set(30));
    await Promise.resolve();
    await Promise.resolve();

    pending.rollback();

    expect(store.$()).toEqual({ count: 30, title: 'Original' });
  });

  it('rolls back a pending add while preserving later work on a different SubjectId', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 18, name: 'existing' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.addOne({ id: 17, name: 'pending' }));
    });

    undoable(() => store.$.rows.byIdOrFail(18).name.set('later'));
    await Promise.resolve();
    await Promise.resolve();

    pending.rollback();

    expect(store.$.rows.ids()).toEqual([18]);
    expect(store.$.rows.byIdOrFail(18).name()).toBe('later');
  });

  it('rejects rollback of a pending add when later same-subject field set depends on that existence', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.addOne({ id: 17, name: 'pending' }));
    });

    undoable(() => store.$.rows.byIdOrFail(17).name.set('later'));
    await Promise.resolve();
    await Promise.resolve();

    expectRollbackError(() => pending.rollback(), {
      kind: 'later-confirmed-dependency',
      pendingEffect: { kind: 'add' },
      conflictingEffect: { kind: 'set' },
    });
    expect(store.$.rows.ids()).toEqual([17]);
    expect(store.$.rows.byIdOrFail(17).name()).toBe('later');
  });

  it('rejects rollback of a pending add when later same-subject field update depends on that existence', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.addOne({ id: 17, name: 'pending' }));
    });

    undoable(() => store.$.rows.byIdOrFail(17).name.update((value) => `${value}-updated`));
    await Promise.resolve();
    await Promise.resolve();

    expectRollbackError(() => pending.rollback(), {
      kind: 'later-confirmed-dependency',
      pendingEffect: { kind: 'add' },
      conflictingEffect: { kind: 'set' },
    });
    expect(store.$.rows.ids()).toEqual([17]);
    expect(store.$.rows.byIdOrFail(17).name()).toBe('pending-updated');
  });

  it('rolls back a pending remove while restoring anchors and preserving later work on a different SubjectId', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 16, name: 'A' }));
    undoable(() => store.$.rows.addOne({ id: 17, name: 'B' }));
    undoable(() => store.$.rows.addOne({ id: 18, name: 'C' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    const originalSubject = (store.$.rows.byIdOrFail(17).name as any)
      .__subjectIds?.[0] as number;

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.removeOne(17));
    });

    undoable(() => store.$.rows.byIdOrFail(18).name.set('later'));
    await Promise.resolve();
    await Promise.resolve();

    pending.rollback();

    expect(store.$.rows.ids()).toEqual([16, 17, 18]);
    expect(store.$.rows.byIdOrFail(17).name()).toBe('B');
    expect(store.$.rows.byIdOrFail(18).name()).toBe('later');
    expect((store.$.rows.byIdOrFail(17).name as any).__subjectIds?.[0]).toBe(
      originalSubject
    );
  });

  it('does not expose a supported same-subject field path after a pending remove', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 17, name: 'pending-remove' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.removeOne(17));
    });

    expect(store.$.rows.byId(17)).toBeUndefined();
    expect(() => store.$.rows.byIdOrFail(17)).toThrow(
      /Entity with id 17 not found/
    );

    pending.rollback();

    expect(store.$.rows.ids()).toEqual([17]);
    expect(store.$.rows.byIdOrFail(17).name()).toBe('pending-remove');
  });

  it('rejects rollback of a pending remove when the restore key is occupied by a different SubjectId', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 17, name: 'original' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.removeOne(17));
    });

    undoable(() => store.$.rows.addOne({ id: 17, name: 'replacement' }));
    await Promise.resolve();
    await Promise.resolve();

    // MIGRATED for TX-SURFACE-0. The refusal still happens and its structured
    // `kind` is unchanged; what changed is the PROSE. restoration's deleted
    // implementation named the underlying refusal in `errorMessage`, while
    // `transactions()`' compensation path surfaces the wrapped error's own
    // message instead. Asserting the machine-readable field rather than the
    // sentence — and the legibility difference is recorded as a follow-up rather
    // than quietly accepted.
    expectRollbackError(() => pending.rollback(), {
      kind: 'effect-validation-failed',
    });
    expect(store.$.rows.ids()).toEqual([17]);
    expect(store.$.rows.byIdOrFail(17).name()).toBe('replacement');
  });

  it('rolls back a pending rekey while preserving later work on a different SubjectId', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'target' }));
    undoable(() => store.$.rows.addOne({ id: 18, name: 'other' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    const originalSubject = (store.$.rows.byIdOrFail(7).name as any)
      .__subjectIds?.[0] as number;

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.changeId(7, 42));
    });

    undoable(() => store.$.rows.byIdOrFail(18).name.set('later'));
    await Promise.resolve();
    await Promise.resolve();

    pending.rollback();

    expect(store.$.rows.ids()).toEqual([7, 18]);
    expect(store.$.rows.byIdOrFail(7).name()).toBe('target');
    expect(store.$.rows.byIdOrFail(18).name()).toBe('later');
    expect((store.$.rows.byIdOrFail(7).name as any).__subjectIds?.[0]).toBe(
      originalSubject
    );
  });

  it('treats an explicit transaction boundary as a flush boundary for surrounding ordinary writes', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        status: 'idle',
        other: 'before',
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;
    t.resetRestorationHistory();
    const baseline = t.getTurns().length;
    const baselineHistory = t.getRestorationHistory().length;

    undoable(() => store.$.status.set('queued-before'));

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.addOne({ id: 17, name: 'pending' }));
    });

    undoable(() => store.$.other.set('queued-after'));
    await Promise.resolve();
    await Promise.resolve();

    expect(t.getRestorationHistory()).toHaveLength(baselineHistory + 2);

    pending.confirm();

    const turns = t.getTurns();
    expect(turns).toHaveLength(baseline + 3);

    const beforeTurn = turns.at(-3) as {
      __ownerPaths?: string[];
      state: { status: string; other: string; rows: { all: unknown[] } };
    };
    const pendingTurn = turns.at(-2) as {
      __ownerPaths?: string[];
      state: {
        status: string;
        other: string;
        rows: { all: Array<{ id: number; name: string }> };
      };
    };
    const afterTurn = turns.at(-1) as {
      __ownerPaths?: string[];
      state: {
        status: string;
        other: string;
        rows: { all: Array<{ id: number; name: string }> };
      };
    };

    expect(beforeTurn.__ownerPaths).toEqual(['status']);
    expect(beforeTurn.state).toEqual({
      status: 'queued-before',
      other: 'before',
      rows: { all: [] },
    });
    expect(pendingTurn.__ownerPaths).toEqual(['rows']);
    expect(pendingTurn.state).toEqual({
      status: 'queued-before',
      other: 'before',
      rows: { all: [{ id: 17, name: 'pending' }] },
    });
    expect(afterTurn.__ownerPaths).toEqual(['other']);
    expect(afterTurn.state).toEqual({
      status: 'queued-before',
      other: 'queued-after',
      rows: { all: [{ id: 17, name: 'pending' }] },
    });
  });

  it('flushes queued ordinary writes without retaining an aborted transaction turn', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        a: 0,
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;
    t.resetRestorationHistory();
    const baseline = t.getTurns().length;
    const baselineHistory = t.getRestorationHistory().length;

    undoable(() => store.$.a.set(1));

    expect(() =>
      store.transaction(() => {
        undoable(() => store.$.rows.addOne({ id: 17, name: 'pending' }));
        throw new Error('boom');
      })
    ).toThrow('boom');

    expect(store.$()).toEqual({
      a: 1,
      rows: { all: [] },
    });
    expect(t.getRestorationHistory()).toHaveLength(baselineHistory + 1);
    expect(t.getTurns()).toHaveLength(baseline + 1);

    const survivingTurn = t.getTurns().at(-1) as {
      __ownerPaths?: string[];
      state: { a: number; rows: { all: unknown[] } };
    };
    expect(survivingTurn.__ownerPaths).toEqual(['a']);
    expect(survivingTurn.state).toEqual({ a: 1, rows: { all: [] } });
  });

  it('preserves a later same-subject field set when rolling back a pending rekey', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'target' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.changeId(7, 42));
    });

    undoable(() => store.$.rows.byIdOrFail(42).name.set('later'));
    await Promise.resolve();
    await Promise.resolve();

    pending.rollback();

    expect(store.$.rows.ids()).toEqual([7]);
    expect(store.$.rows.byIdOrFail(7).name()).toBe('later');
  });

  it('captures both rekey and same-subject field set inside a standalone pending transaction', async () => {
    const { getPathNotifier, resetPathNotifier } = await import(
      '../../lib/path-notifier'
    );
    resetPathNotifier();
    getPathNotifier().setBatchingEnabled(false);

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    ) as {
      $: {
        rows: {
          addOne(row: { id: number; name: string }): void;
          changeId(from: number, to: number): void;
          byIdOrFail(id: number): { name: { set(value: string): void } };
        };
      };
      transaction(fn: () => void): { confirm(): void; rollback(): void };
      __restoration: {
        resetRestorationHistory(): void;
        getTurns(): Array<{ id: number; __effects?: Array<{ kind: string }> }>;
      };
    };

    undoable(() => store.$.rows.addOne({ id: 7, name: 'temp' }));
    await Promise.resolve();
    await Promise.resolve();

    const t = store.__restoration;
    t.resetRestorationHistory();

    store.transaction(() => {
      undoable(() => store.$.rows.changeId(7, 42));
      undoable(() => store.$.rows.byIdOrFail(42).name.set('stable'));
    });

    expect(
      t
        .getTurns()
        .at(-1)
        ?.__effects?.map((effect) => effect.kind)
    ).toEqual(['rekey', 'set']);
  });

  it('keeps transaction authority singular for composed transactions() + restoration() rekey plus scalar writes', async () => {
    const { getPathNotifier, resetPathNotifier } = await import(
      '../../lib/path-notifier'
    );
    resetPathNotifier();
    getPathNotifier().setBatchingEnabled(false);

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      {
        enhancers: [transactions(), restoration()],
        capabilities: ['causal-runtime'],
      }
    ) as {
      $: {
        rows: {
          addOne(row: { id: number; name: string }): void;
          changeId(from: number, to: number): void;
          byIdOrFail(id: number): {
            name: { (): string; set(value: string): void };
          };
          ids(): number[];
        };
      };
      transaction(fn: () => void): { confirm(): void; rollback(): void };
      __transactions: {
        getConfirmedTurnCount(): number;
        getPendingTurnCount(): number;
      };
      __restoration: {
        resetRestorationHistory(): void;
        getRestorationHistory(): unknown[];
        getTurns(): Array<{ id: number; __effects?: Array<{ kind: string }> }>;
        getTurnStatus(id: number | undefined): string | undefined;
      };
    };

    undoable(() => store.$.rows.addOne({ id: 7, name: 'temp' }));
    await Promise.resolve();
    await Promise.resolve();

    const t = store.__restoration;
    t.resetRestorationHistory();
    const baselineHistory = t.getRestorationHistory().length;
    const baselineTurns = t.getTurns().length;
    const baselineTransactionConfirmed =
      store.__transactions.getConfirmedTurnCount();
    const baselineTransactionPending =
      store.__transactions.getPendingTurnCount();

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.changeId(7, 42));
      undoable(() => store.$.rows.byIdOrFail(42).name.set('stable'));
    });

    expect(store.$.rows.ids()).toEqual([42]);
    // OWNERSHIP INVERTED by TX-SURFACE-0, and this assertion is the clearest
    // record of it. It used to require `transactions()`' counts to stay at
    // BASELINE while a transaction was pending — which was only true because
    // restoration's duplicate `transaction()` had overwritten the real one, so
    // the enhancer named in this test's title was not the one being exercised.
    //
    // Now `transactions()` is the singular authority, so the pending turn is
    // ITS pending turn. The property the title claims is finally what the test
    // measures.
    expect([
      store.__transactions.getConfirmedTurnCount(),
      store.__transactions.getPendingTurnCount(),
    ]).toEqual([baselineTransactionConfirmed, baselineTransactionPending + 1]);
    expect(t.getRestorationHistory()).toHaveLength(baselineHistory);
    expect(t.getTurns()).toHaveLength(baselineTurns + 1);
    expect(t.getTurnStatus(t.getTurns().at(-1)?.id)).toBe('pending');
    expect(
      t
        .getTurns()
        .at(-1)
        ?.__effects?.map((effect) => effect.kind)
    ).toEqual(['rekey', 'set']);

    pending.rollback();

    expect(store.$.rows.ids()).toEqual([7]);
    expect(store.$.rows.byIdOrFail(7).name()).toBe('temp');
    expect([
      store.__transactions.getConfirmedTurnCount(),
      store.__transactions.getPendingTurnCount(),
    ]).toEqual([baselineTransactionConfirmed, baselineTransactionPending]);
    expect(t.getRestorationHistory()).toHaveLength(baselineHistory);
    expect(t.getTurns()).toHaveLength(baselineTurns);
  });

  it('preserves a later same-subject field update when rolling back a pending rekey', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'target' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.changeId(7, 42));
    });

    undoable(() => store.$.rows.byIdOrFail(42).name.update((value) => `${value}-updated`));
    await Promise.resolve();
    await Promise.resolve();

    pending.rollback();

    expect(store.$.rows.ids()).toEqual([7]);
    expect(store.$.rows.byIdOrFail(7).name()).toBe('target-updated');
  });

  it('rejects rollback of a pending rekey when later work touches the same structural dimension', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'target' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.changeId(7, 42));
    });

    undoable(() => store.$.rows.changeId(42, 99));
    await Promise.resolve();
    await Promise.resolve();

    expectRollbackError(() => pending.rollback(), {
      kind: 'later-confirmed-dependency',
      pendingEffect: { kind: 'rekey' },
      conflictingEffect: { kind: 'rekey' },
    });
    expect(store.$.rows.ids()).toEqual([99]);
    expect(store.$.rows.byIdOrFail(99).name()).toBe('target');
  });

  it('fails atomically when rolling back a pending rekey would restore into an occupied original key', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'target' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    const originalSubject = (store.$.rows.byIdOrFail(7).name as any)
      .__subjectIds?.[0] as number;

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.changeId(7, 42));
    });

    undoable(() => store.$.rows.addOne({ id: 7, name: 'occupier' }));
    await Promise.resolve();
    await Promise.resolve();

    // MIGRATED for TX-SURFACE-0. The refusal still happens and its structured
    // `kind` is unchanged; what changed is the PROSE. restoration's deleted
    // implementation named the underlying refusal in `errorMessage`, while
    // `transactions()`' compensation path surfaces the wrapped error's own
    // message instead. Asserting the machine-readable field rather than the
    // sentence — and the legibility difference is recorded as a follow-up rather
    // than quietly accepted.
    expectRollbackError(() => pending.rollback(), {
      kind: 'effect-validation-failed',
    });
    expect(store.$.rows.ids()).toEqual([42, 7]);
    expect(store.$.rows.byIdOrFail(42).name()).toBe('target');
    expect(store.$.rows.byIdOrFail(7).name()).toBe('occupier');
    expect((store.$.rows.byIdOrFail(42).name as any).__subjectIds?.[0]).toBe(
      originalSubject
    );
  });

  it('restores a removed row before the surviving after-anchor when the before-anchor is gone', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 16, name: 'A' }));
    undoable(() => store.$.rows.addOne({ id: 17, name: 'B' }));
    undoable(() => store.$.rows.addOne({ id: 18, name: 'C' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.removeOne(17));
    });

    undoable(() => store.$.rows.removeOne(16));
    await Promise.resolve();
    await Promise.resolve();

    pending.rollback();

    expect(store.$.rows.ids()).toEqual([17, 18]);
    expect(store.$.rows.byIdOrFail(17).name()).toBe('B');
    expect(store.$.rows.byIdOrFail(18).name()).toBe('C');
  });

  it('restores a removed row after the surviving before-anchor when the after-anchor is gone', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 16, name: 'A' }));
    undoable(() => store.$.rows.addOne({ id: 17, name: 'B' }));
    undoable(() => store.$.rows.addOne({ id: 18, name: 'C' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.removeOne(17));
    });

    undoable(() => store.$.rows.removeOne(18));
    await Promise.resolve();
    await Promise.resolve();

    pending.rollback();

    expect(store.$.rows.ids()).toEqual([16, 17]);
    expect(store.$.rows.byIdOrFail(16).name()).toBe('A');
    expect(store.$.rows.byIdOrFail(17).name()).toBe('B');
  });

  it('treats a reused anchor key as invalid and restores relative to surviving subject anchors', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 16, name: 'A' }));
    undoable(() => store.$.rows.addOne({ id: 17, name: 'B' }));
    undoable(() => store.$.rows.addOne({ id: 18, name: 'C' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.removeOne(17));
    });

    undoable(() => store.$.rows.removeOne(16));
    undoable(() => store.$.rows.addOne({ id: 16, name: 'replacement-anchor' }));
    await Promise.resolve();
    await Promise.resolve();

    pending.rollback();

    expect(store.$.rows.ids()).toEqual([17, 18, 16]);
    expect(store.$.rows.byIdOrFail(17).name()).toBe('B');
    expect(store.$.rows.byIdOrFail(18).name()).toBe('C');
    expect(store.$.rows.byIdOrFail(16).name()).toBe('replacement-anchor');
  });

  it.todo(
    'characterizes rollback when both remove anchors are gone and no retained structural fact proves placement'
  );

  it('makes confirm and rollback idempotent in their own terminal direction', () => {
    const store = signalTree(
      { value: '' },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );

    const confirmed = store.transaction(() => {
      undoable(() => store.$.value.set('confirmed'));
    });
    confirmed.confirm();
    confirmed.confirm();
    expect(store.$()).toEqual({ value: 'confirmed' });

    const rolledBack = store.transaction(() => {
      undoable(() => store.$.value.set('rolled-back'));
    });
    rolledBack.rollback();
    rolledBack.rollback();
    expect(store.$()).toEqual({ value: 'confirmed' });
  });

  it('rejects mixed terminal transitions on a transaction handle', () => {
    const store = signalTree(
      { value: '' },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );

    const confirmed = store.transaction(() => {
      undoable(() => store.$.value.set('confirmed'));
    });
    confirmed.confirm();
    expect(() => confirmed.rollback()).toThrow(/confirmed transaction/i);

    const rolledBack = store.transaction(() => {
      undoable(() => store.$.value.set('rolled-back'));
    });
    rolledBack.rollback();
    expect(() => rolledBack.confirm()).toThrow(/rolled back transaction/i);
  });

  it('records one canonical turn across multiple owner positions in one flush', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        trucks: entityMap<{ id: number; driverId: number | null }, number>({
          selectId: (row) => row.id,
        }),
        orders: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'assigned' }));
    undoable(() => store.$.trucks.addOne({ id: 12, driverId: 7 }));
    undoable(() => store.$.orders.addOne({ id: 99, status: 'dispatched' }));

    await Promise.resolve();
    await Promise.resolve();

    const entry = t.getRestorationHistory().at(-1) as {
      __turnId?: number;
      __positionIds?: number[];
    };
    const turnId = entry.__turnId;
    const positionIds = [...(entry.__positionIds ?? [])].sort((a, b) => a - b);
    const turn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
      historyIndex: number;
    };

    expect(turnId).toBeDefined();
    expect(positionIds).toHaveLength(3);
    expect(turn.id).toBe(turnId);
    expect([...(turn.__positionIds ?? [])].sort((a, b) => a - b)).toEqual(
      positionIds
    );
    expect(turn.historyIndex).toBe(t.getRestorationHistory().length - 1);

    for (const positionId of positionIds) {
      expect(t.getTurnIdsForPosition(positionId)).toEqual([turnId]);
    }
  });

  it('indexes one position across many turns without duplicating the canonical turn', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        trucks: entityMap<{ id: number; driverId: number | null }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'assigned' }));
    undoable(() => store.$.trucks.addOne({ id: 12, driverId: 7 }));
    await Promise.resolve();
    await Promise.resolve();

    const firstTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };

    undoable(() => store.$.drivers.updateOne(7, { status: 'released' }));
    await Promise.resolve();
    await Promise.resolve();

    const secondTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const driverPositionId = secondTurn.__positionIds?.[0];
    const truckPositionId = (firstTurn.__positionIds ?? []).find(
      (positionId) => positionId !== driverPositionId
    );

    expect(firstTurn.__positionIds).toHaveLength(2);
    expect(secondTurn.__positionIds).toEqual([driverPositionId]);
    expect(truckPositionId).toBeDefined();
    expect(t.getTurnIdsForPosition(driverPositionId)).toEqual([
      firstTurn.id,
      secondTurn.id,
    ]);
    expect(t.getTurnIdsForPosition(truckPositionId as number)).toEqual([
      firstTurn.id,
    ]);
  });

  it('resolves the full canonical turn from any indexed position', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        trucks: entityMap<{ id: number; driverId: number | null }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'assigned' }));
    undoable(() => store.$.trucks.addOne({ id: 12, driverId: 7 }));

    await Promise.resolve();
    await Promise.resolve();

    const entry = t.getRestorationHistory().at(-1) as {
      __turnId?: number;
      __positionIds?: number[];
    };
    const turnId = entry.__turnId as number;
    const [leftPositionId, rightPositionId] = entry.__positionIds ?? [];

    expect(t.getTurnIdsForPosition(leftPositionId)).toEqual([turnId]);
    expect(t.getTurnIdsForPosition(rightPositionId)).toEqual([turnId]);
    expect(t.getTurn(turnId)).toMatchObject({
      id: turnId,
      __positionIds: expect.arrayContaining([leftPositionId, rightPositionId]),
    });
  });

  it('stores the restoration history entry and canonical turn as the same object reference', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        trucks: entityMap<{ id: number; driverId: number | null }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'assigned' }));
    undoable(() => store.$.trucks.addOne({ id: 12, driverId: 7 }));

    await Promise.resolve();
    await Promise.resolve();

    const historyIndex = t.getRestorationHistory().length - 1;
    const turnId = t.getRestorationHistory().at(-1).__turnId as number;

    expect(t.getTurnRef(turnId)).toBe(t.getRestorationHistoryRef(historyIndex));
  });

  it('undoes the frontier closure needed to keep every position prefix-closed', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        trucks: entityMap<{ id: number; driverId: number | null }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    undoable(() => store.$.trucks.addOne({ id: 12, driverId: null }));

    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    undoable(() => store.$.trucks.byIdOrFail(12).driverId.set(7));

    await Promise.resolve();
    await Promise.resolve();

    const firstTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('released'));

    await Promise.resolve();
    await Promise.resolve();

    const secondTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const driverPositionId = secondTurn.__positionIds?.[0] as number;
    const truckPositionId = (firstTurn.__positionIds ?? []).find(
      (positionId: number) => positionId !== driverPositionId
    ) as number;

    expect(t.resolveUndoClosure(truckPositionId)).toEqual([
      secondTurn.id,
      firstTurn.id,
    ]);

    expect(t.undoPosition(truckPositionId)).toEqual([
      secondTurn.id,
      firstTurn.id,
    ]);
    expect(t.getAppliedTurnIdsForPosition(driverPositionId)).toEqual([]);
    expect(t.getAppliedTurnIdsForPosition(truckPositionId)).toEqual([]);
    expect(t.getFrontier(driverPositionId)).toBe(0);
    expect(t.getFrontier(truckPositionId)).toBe(0);
    expect(t.isTurnApplied(firstTurn.id)).toBe(false);
    expect(t.isTurnApplied(secondTurn.id)).toBe(false);
    expect(store.$.drivers.byIdOrFail(7).status()).toBe('idle');
    expect(store.$.trucks.byIdOrFail(12).driverId()).toBeNull();
  });

  it('undoes transitive dependents until the closure reaches a fixed point', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        trucks: entityMap<{ id: number; driverId: number | null }, number>({
          selectId: (row) => row.id,
        }),
        orders: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        depots: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    undoable(() => store.$.trucks.addOne({ id: 12, driverId: null }));
    undoable(() => store.$.orders.addOne({ id: 99, status: 'new' }));
    undoable(() => store.$.depots.addOne({ id: 5, status: 'ready' }));

    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    undoable(() => store.$.trucks.byIdOrFail(12).driverId.set(7));

    await Promise.resolve();
    await Promise.resolve();

    const firstTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const driverPositionId = firstTurn.__positionIds?.[0] as number;
    const truckPositionId = firstTurn.__positionIds?.[1] as number;

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('loading'));
    undoable(() => store.$.orders.byIdOrFail(99).status.set('queued'));

    await Promise.resolve();
    await Promise.resolve();

    const secondTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const orderPositionId = (secondTurn.__positionIds ?? []).find(
      (positionId: number) => positionId !== driverPositionId
    ) as number;

    undoable(() => store.$.orders.byIdOrFail(99).status.set('dispatched'));

    await Promise.resolve();
    await Promise.resolve();

    const thirdTurn = t.getTurns().at(-1) as {
      id: number;
    };

    undoable(() => store.$.depots.byIdOrFail(5).status.set('busy'));

    await Promise.resolve();
    await Promise.resolve();

    const fourthTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const depotPositionId = fourthTurn.__positionIds?.[0] as number;

    expect(t.resolveUndoClosure(truckPositionId)).toEqual([
      thirdTurn.id,
      secondTurn.id,
      firstTurn.id,
    ]);

    expect(t.undoPosition(truckPositionId)).toEqual([
      thirdTurn.id,
      secondTurn.id,
      firstTurn.id,
    ]);
    expect(t.getAppliedTurnIdsForPosition(driverPositionId)).toEqual([]);
    expect(t.getAppliedTurnIdsForPosition(truckPositionId)).toEqual([]);
    expect(t.getAppliedTurnIdsForPosition(orderPositionId)).toEqual([]);
    expect(t.getAppliedTurnIdsForPosition(depotPositionId)).toEqual([
      fourthTurn.id,
    ]);
    expect(t.getFrontier(driverPositionId)).toBe(0);
    expect(t.getFrontier(truckPositionId)).toBe(0);
    expect(t.getFrontier(orderPositionId)).toBe(0);
    expect(t.getFrontier(depotPositionId)).toBe(1);
    expect(t.isTurnApplied(firstTurn.id)).toBe(false);
    expect(t.isTurnApplied(secondTurn.id)).toBe(false);
    expect(t.isTurnApplied(thirdTurn.id)).toBe(false);
    expect(t.getTurnStatus(fourthTurn.id)).toBe('applied');
    expect(store.$.drivers.byIdOrFail(7).status()).toBe('idle');
    expect(store.$.trucks.byIdOrFail(12).driverId()).toBeNull();
    expect(store.$.orders.byIdOrFail(99).status()).toBe('new');
    expect(store.$.depots.byIdOrFail(5).status()).toBe('busy');
  });

  it('preserves an unrelated later turn while selectively undoing a closure', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        trucks: entityMap<{ id: number; driverId: number | null }, number>({
          selectId: (row) => row.id,
        }),
        orders: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    undoable(() => store.$.trucks.addOne({ id: 12, driverId: null }));
    undoable(() => store.$.orders.addOne({ id: 99, status: 'new' }));

    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    undoable(() => store.$.trucks.byIdOrFail(12).driverId.set(7));
    await Promise.resolve();
    await Promise.resolve();

    const firstTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const driverPositionId = firstTurn.__positionIds?.[0] as number;
    const truckPositionId = firstTurn.__positionIds?.[1] as number;

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('released'));
    await Promise.resolve();
    await Promise.resolve();

    const secondTurn = t.getTurns().at(-1) as { id: number };

    undoable(() => store.$.orders.byIdOrFail(99).status.set('queued'));
    await Promise.resolve();
    await Promise.resolve();

    const thirdTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const orderPositionId = thirdTurn.__positionIds?.[0] as number;

    expect(t.resolveUndoClosure(truckPositionId)).toEqual([
      secondTurn.id,
      firstTurn.id,
    ]);

    expect(t.undoPosition(truckPositionId)).toEqual([
      secondTurn.id,
      firstTurn.id,
    ]);

    expect(store.$.drivers.byIdOrFail(7).status()).toBe('idle');
    expect(store.$.trucks.byIdOrFail(12).driverId()).toBeNull();
    expect(store.$.orders.byIdOrFail(99).status()).toBe('queued');
    expect(t.getAppliedTurnIdsForPosition(driverPositionId)).toEqual([]);
    expect(t.getAppliedTurnIdsForPosition(truckPositionId)).toEqual([]);
    expect(t.getAppliedTurnIdsForPosition(orderPositionId)).toEqual([
      thirdTurn.id,
    ]);
    expect(t.getTurnStatus(firstTurn.id)).toBe('unapplied');
    expect(t.getTurnStatus(secondTurn.id)).toBe('unapplied');
    expect(t.getTurnStatus(thirdTurn.id)).toBe('applied');
  });

  it('fails before mutating state or frontiers when a closure contains an unsupported effect', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        trucks: entityMap<{ id: number; driverId: number | null }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    undoable(() => store.$.trucks.addOne({ id: 12, driverId: null }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    undoable(() => store.$.trucks.byIdOrFail(12).driverId.set(7));
    await Promise.resolve();
    await Promise.resolve();

    const firstTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('released'));
    await Promise.resolve();
    await Promise.resolve();

    const secondTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const driverPositionId = secondTurn.__positionIds?.[0] as number;
    const truckPositionId = (firstTurn.__positionIds ?? []).find(
      (positionId: number) => positionId !== driverPositionId
    ) as number;

    const poisonedTurn = t.getTurnRef(firstTurn.id) as {
      __effects?: Array<Record<string, unknown>>;
    };
    poisonedTurn.__effects?.push({
      kind: 'set',
      position: driverPositionId,
      ownerPath: 'drivers',
      path: 'drivers.7.status',
      before: { invalid: true },
      after: 'ignored',
      subject: 999,
    });

    expect(() => t.undoPosition(truckPositionId)).toThrow(
      'Unsupported scoped undo effect'
    );
    expect(store.$.drivers.byIdOrFail(7).status()).toBe('released');
    expect(store.$.trucks.byIdOrFail(12).driverId()).toBe(7);
    expect(t.getAppliedTurnIdsForPosition(driverPositionId)).toEqual([
      firstTurn.id,
      secondTurn.id,
    ]);
    expect(t.getAppliedTurnIdsForPosition(truckPositionId)).toEqual([
      firstTurn.id,
    ]);
  });

  it('reapplies prerequisite closure oldest-to-newest when redoing from a dependent position', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        trucks: entityMap<{ id: number; driverId: number | null }, number>({
          selectId: (row) => row.id,
        }),
        orders: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    undoable(() => store.$.trucks.addOne({ id: 12, driverId: null }));
    undoable(() => store.$.orders.addOne({ id: 99, status: 'new' }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    undoable(() => store.$.trucks.byIdOrFail(12).driverId.set(7));
    await Promise.resolve();
    await Promise.resolve();
    const firstTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('loading'));
    undoable(() => store.$.orders.byIdOrFail(99).status.set('queued'));
    await Promise.resolve();
    await Promise.resolve();
    const secondTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const orderPositionId = (secondTurn.__positionIds ?? []).find(
      (positionId: number) =>
        positionId !== (firstTurn.__positionIds?.[0] as number)
    ) as number;

    undoable(() => store.$.orders.byIdOrFail(99).status.set('dispatched'));
    await Promise.resolve();
    await Promise.resolve();
    const thirdTurn = t.getTurns().at(-1) as { id: number };

    const truckPositionId = firstTurn.__positionIds?.[1] as number;
    expect(t.undoPosition(truckPositionId)).toEqual([
      thirdTurn.id,
      secondTurn.id,
      firstTurn.id,
    ]);

    expect(t.resolveRedoClosure(orderPositionId)).toEqual([
      firstTurn.id,
      secondTurn.id,
    ]);
    expect(t.redoPosition(orderPositionId)).toEqual([
      firstTurn.id,
      secondTurn.id,
    ]);

    expect(store.$.drivers.byIdOrFail(7).status()).toBe('loading');
    expect(store.$.trucks.byIdOrFail(12).driverId()).toBe(7);
    expect(store.$.orders.byIdOrFail(99).status()).toBe('queued');
    expect(t.getTurnStatus(firstTurn.id)).toBe('applied');
    expect(t.getTurnStatus(secondTurn.id)).toBe('applied');
    expect(t.getTurnStatus(thirdTurn.id)).toBe('unapplied');
  });

  it('reapplies transitive prerequisites while preserving unrelated applied state', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        trucks: entityMap<{ id: number; driverId: number | null }, number>({
          selectId: (row) => row.id,
        }),
        orders: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        depots: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        yards: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    undoable(() => store.$.trucks.addOne({ id: 12, driverId: null }));
    undoable(() => store.$.orders.addOne({ id: 99, status: 'new' }));
    undoable(() => store.$.depots.addOne({ id: 5, status: 'ready' }));
    undoable(() => store.$.yards.addOne({ id: 2, status: 'clear' }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    undoable(() => store.$.trucks.byIdOrFail(12).driverId.set(7));
    await Promise.resolve();
    await Promise.resolve();
    const firstTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const truckPositionId = firstTurn.__positionIds?.[1] as number;

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('loading'));
    undoable(() => store.$.orders.byIdOrFail(99).status.set('queued'));
    await Promise.resolve();
    await Promise.resolve();
    const secondTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };

    undoable(() => store.$.orders.byIdOrFail(99).status.set('dispatched'));
    undoable(() => store.$.depots.byIdOrFail(5).status.set('busy'));
    await Promise.resolve();
    await Promise.resolve();
    const thirdTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const depotPositionId = (thirdTurn.__positionIds ?? []).find(
      (positionId: number) =>
        positionId !==
        ((secondTurn.__positionIds ?? []).find(
          (candidate: number) =>
            candidate !== (firstTurn.__positionIds?.[0] as number)
        ) as number)
    ) as number;

    undoable(() => store.$.yards.byIdOrFail(2).status.set('occupied'));
    await Promise.resolve();
    await Promise.resolve();
    const fourthTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const yardPositionId = fourthTurn.__positionIds?.[0] as number;

    expect(t.undoPosition(truckPositionId)).toEqual([
      thirdTurn.id,
      secondTurn.id,
      firstTurn.id,
    ]);
    expect(t.resolveRedoClosure(depotPositionId)).toEqual([
      firstTurn.id,
      secondTurn.id,
      thirdTurn.id,
    ]);
    expect(t.redoPosition(depotPositionId)).toEqual([
      firstTurn.id,
      secondTurn.id,
      thirdTurn.id,
    ]);

    expect(store.$.drivers.byIdOrFail(7).status()).toBe('loading');
    expect(store.$.trucks.byIdOrFail(12).driverId()).toBe(7);
    expect(store.$.orders.byIdOrFail(99).status()).toBe('dispatched');
    expect(store.$.depots.byIdOrFail(5).status()).toBe('busy');
    expect(store.$.yards.byIdOrFail(2).status()).toBe('occupied');
    expect(t.getAppliedTurnIdsForPosition(yardPositionId)).toEqual([
      fourthTurn.id,
    ]);
    expect(t.getTurnStatus(fourthTurn.id)).toBe('applied');
  });

  it('canonically truncates abandoned future turns across every position index on a new write', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        trucks: entityMap<{ id: number; driverId: number | null }, number>({
          selectId: (row) => row.id,
        }),
        orders: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    undoable(() => store.$.trucks.addOne({ id: 12, driverId: null }));
    undoable(() => store.$.orders.addOne({ id: 99, status: 'new' }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    undoable(() => store.$.trucks.byIdOrFail(12).driverId.set(7));
    await Promise.resolve();
    await Promise.resolve();
    const firstTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const firstPositionIds = firstTurn.__positionIds ?? [];

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('loading'));
    undoable(() => store.$.orders.byIdOrFail(99).status.set('queued'));
    await Promise.resolve();
    await Promise.resolve();
    const secondTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const secondPositionIds = secondTurn.__positionIds ?? [];
    const driverPositionId = firstPositionIds.find((positionId: number) =>
      secondPositionIds.includes(positionId)
    ) as number;
    const orderPositionId = secondPositionIds.find(
      (positionId: number) => !firstPositionIds.includes(positionId)
    ) as number;

    undoable(() => store.$.orders.byIdOrFail(99).status.set('dispatched'));
    await Promise.resolve();
    await Promise.resolve();
    const thirdTurn = t.getTurns().at(-1) as { id: number };

    expect(t.undoPosition(driverPositionId)).toEqual([
      thirdTurn.id,
      secondTurn.id,
    ]);

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('staged'));
    await Promise.resolve();
    await Promise.resolve();

    const fourthTurn = t.getTurns().at(-1) as { id: number };

    expect(store.$.drivers.byIdOrFail(7).status()).toBe('staged');
    expect(t.getTurn(secondTurn.id)).toBeUndefined();
    expect(t.getTurn(thirdTurn.id)).toBeUndefined();
    expect(t.getTurnIdsForPosition(orderPositionId)).toEqual([]);
    expect(t.resolveRedoClosure(orderPositionId)).toEqual([]);
    expect(t.redoPosition(orderPositionId)).toEqual([]);
    expect(t.getAppliedTurnIdsForPosition(driverPositionId)).toEqual([
      firstTurn.id,
      fourthTurn.id,
    ]);
  });

  it('truncates the global canonical future even when the new write is on an unrelated position', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        trucks: entityMap<{ id: number; driverId: number | null }, number>({
          selectId: (row) => row.id,
        }),
        orders: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        depots: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    undoable(() => store.$.trucks.addOne({ id: 12, driverId: null }));
    undoable(() => store.$.orders.addOne({ id: 99, status: 'new' }));
    undoable(() => store.$.depots.addOne({ id: 5, status: 'ready' }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    undoable(() => store.$.trucks.byIdOrFail(12).driverId.set(7));
    await Promise.resolve();
    await Promise.resolve();
    const firstTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const driverPositionId = firstTurn.__positionIds?.[0] as number;

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('loading'));
    undoable(() => store.$.orders.byIdOrFail(99).status.set('queued'));
    await Promise.resolve();
    await Promise.resolve();
    const secondTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const orderPositionId = (secondTurn.__positionIds ?? []).find(
      (positionId: number) => positionId !== driverPositionId
    ) as number;

    undoable(() => store.$.orders.byIdOrFail(99).status.set('dispatched'));
    await Promise.resolve();
    await Promise.resolve();
    const thirdTurn = t.getTurns().at(-1) as { id: number };

    expect(t.undoPosition(driverPositionId)).toEqual([
      thirdTurn.id,
      secondTurn.id,
    ]);

    undoable(() => store.$.depots.byIdOrFail(5).status.set('busy'));
    await Promise.resolve();
    await Promise.resolve();

    const fourthTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const depotPositionId = fourthTurn.__positionIds?.[0] as number;

    expect(t.getTurn(secondTurn.id)).toBeUndefined();
    expect(t.getTurn(thirdTurn.id)).toBeUndefined();
    expect(t.getRestorationHistory().map((entry: { id: number }) => entry.id)).toEqual([
      1,
      firstTurn.id,
      fourthTurn.id,
    ]);
    expect(t.getTurnIdsForPosition(driverPositionId)).toEqual([firstTurn.id]);
    expect(t.getTurnIdsForPosition(orderPositionId)).toEqual([]);
    expect(t.resolveRedoClosure(driverPositionId)).toEqual([]);
    expect(t.resolveRedoClosure(orderPositionId)).toEqual([]);
    expect(t.redoPosition(driverPositionId)).toEqual([]);
    expect(t.redoPosition(orderPositionId)).toEqual([]);
    expect(t.getAppliedTurnIdsForPosition(depotPositionId)).toEqual([
      fourthTurn.id,
    ]);
  });

  it('keeps TurnId monotonic after truncation and a new write', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, status: 'one' }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.rows.byIdOrFail(7).status.set('two'));
    await Promise.resolve();
    await Promise.resolve();
    const firstTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };

    undoable(() => store.$.rows.byIdOrFail(7).status.set('three'));
    await Promise.resolve();
    await Promise.resolve();
    const secondTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };

    undoable(() => store.$.rows.byIdOrFail(7).status.set('four'));
    await Promise.resolve();
    await Promise.resolve();
    const thirdTurn = t.getTurns().at(-1) as { id: number };

    expect(t.undoPosition(firstTurn.__positionIds?.[0] as number)).toEqual([
      thirdTurn.id,
    ]);

    undoable(() => store.$.rows.byIdOrFail(7).status.set('five'));
    await Promise.resolve();
    await Promise.resolve();
    const fourthTurn = t.getTurns().at(-1) as { id: number };

    expect(fourthTurn.id).toBeGreaterThan(thirdTurn.id);
  });

  it('coalesces repeated writes to one scalar path into one canonical effect', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string; active: boolean }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'one', active: false }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.rows.byIdOrFail(7).name.set('two'));
    undoable(() => store.$.rows.byIdOrFail(7).name.set('three'));
    undoable(() => store.$.rows.byIdOrFail(7).name.set('four'));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as {
      __effects?: Array<{
        kind: string;
        path: string;
        before: unknown;
        after: unknown;
        subject?: number;
        position: number;
      }>;
    };

    expect(turn.__effects).toHaveLength(1);
    expect(turn.__effects?.[0]).toMatchObject({
      kind: 'set',
      path: 'rows.7.name',
      before: 'one',
      after: 'four',
    });
    expect(turn.__effects?.[0].subject).toBeTypeOf('number');
    expect(turn.__effects?.[0].position).toBeTypeOf('number');
  });

  it('suppresses a canonical turn when every scalar effect coalesces to net zero', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string; active: boolean }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'one', active: false }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();
    const baselineTurnCount = t.getTurns().length;
    const baselineRestorationCount = t.getRestorationHistory().length;

    undoable(() => store.$.rows.byIdOrFail(7).name.set('two'));
    undoable(() => store.$.rows.byIdOrFail(7).name.set('one'));
    await Promise.resolve();
    await Promise.resolve();

    expect(t.getTurns()).toHaveLength(baselineTurnCount);
    expect(t.getRestorationHistory()).toHaveLength(baselineRestorationCount);
  });

  it('retains only non-zero scalar effects in a mixed flush', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string; active: boolean }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'one', active: false }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.rows.byIdOrFail(7).name.set('two'));
    undoable(() => store.$.rows.byIdOrFail(7).name.set('one'));
    undoable(() => store.$.rows.byIdOrFail(7).active.set(true));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as {
      __effects?: Array<{
        kind: string;
        path: string;
        before: unknown;
        after: unknown;
      }>;
    };

    expect(turn.__effects).toEqual([
      expect.objectContaining({
        kind: 'set',
        path: 'rows.7.active',
        before: false,
        after: true,
      }),
    ]);
  });

  it('keeps independent scalar effects separate while sharing owner and subject identity', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string; active: boolean }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'one', active: false }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.rows.byIdOrFail(7).name.set('two'));
    undoable(() => store.$.rows.byIdOrFail(7).active.set(true));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as {
      __effects?: Array<{
        kind: string;
        path: string;
        before: unknown;
        after: unknown;
        subject?: number;
        position: number;
      }>;
    };

    expect(turn.__effects).toHaveLength(2);
    expect(turn.__effects?.map((effect) => effect.path).sort()).toEqual([
      'rows.7.active',
      'rows.7.name',
    ]);
    expect(turn.__effects?.every((effect) => effect.kind === 'set')).toBe(true);
    expect(turn.__effects?.[0].subject).toEqual(turn.__effects?.[1].subject);
    expect(turn.__effects?.[0].position).toEqual(turn.__effects?.[1].position);
  });

  it('undoes and redoes a single collection remove while preserving SubjectId and order', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    store.$.rows.addMany([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ]);
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.rows.removeOne(2));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
      __effects?: Array<{ kind: string; subject?: number; key?: number }>;
    };
    const collectionPositionId = turn.__positionIds?.[0] as number;
    const removeEffect = turn.__effects?.[0] as {
      kind: string;
      subject?: number;
      key?: number;
    };

    expect(store.$.rows.ids()).toEqual([1, 3]);
    expect(turn.__effects).toEqual([
      expect.objectContaining({
        kind: 'remove',
        subject: expect.any(Number),
        key: 2,
      }),
    ]);

    expect(t.undoPosition(collectionPositionId)).toEqual([turn.id]);
    expect(store.$.rows.ids()).toEqual([1, 2, 3]);
    expect(store.$.rows.byIdOrFail(2).name.__subjectIds?.[0]).toBe(
      removeEffect.subject
    );

    expect(t.redoPosition(collectionPositionId)).toEqual([turn.id]);
    expect(store.$.rows.ids()).toEqual([1, 3]);
  });

  it('undoes a collection remove closure while preserving an unrelated later scalar turn', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    store.$.rows.addMany([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ]);
    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.rows.removeOne(2));
    await Promise.resolve();
    await Promise.resolve();
    const removeTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const collectionPositionId = removeTurn.__positionIds?.[0] as number;

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    await Promise.resolve();
    await Promise.resolve();
    const scalarTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const driverPositionId = scalarTurn.__positionIds?.[0] as number;

    expect(t.undoPosition(collectionPositionId)).toEqual([removeTurn.id]);
    expect(store.$.rows.ids()).toEqual([1, 2, 3]);
    expect(store.$.drivers.byIdOrFail(7).status()).toBe('assigned');
    expect(t.getAppliedTurnIdsForPosition(driverPositionId)).toEqual([
      scalarTurn.id,
    ]);
  });

  it('undos and redoes one mixed turn containing collection remove and scalar effects atomically', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        orders: entityMap<{ id: number; state: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    store.$.rows.addMany([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ]);
    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    undoable(() => store.$.orders.addOne({ id: 31, state: 'open' }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.rows.removeOne(2));
    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    undoable(() => store.$.orders.byIdOrFail(31).state.set('dispatched'));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
      __effects?: Array<{ kind: string; path: string }>;
    };
    const [collectionPositionId, driverPositionId, orderPositionId] =
      turn.__positionIds ?? [];

    expect(turn.__effects?.map((effect) => effect.kind).sort()).toEqual([
      'remove',
      'set',
      'set',
    ]);
    expect(turn.__effects?.map((effect) => effect.path).sort()).toEqual([
      'drivers.7.status',
      'orders.31.state',
      'rows.2',
    ]);
    expect(t.resolveUndoClosure(orderPositionId as number)).toEqual([turn.id]);

    expect(t.undoPosition(orderPositionId as number)).toEqual([turn.id]);
    expect(store.$.rows.ids()).toEqual([1, 2, 3]);
    expect(store.$.drivers.byIdOrFail(7).status()).toBe('idle');
    expect(store.$.orders.byIdOrFail(31).state()).toBe('open');
    expect(t.getFrontier(collectionPositionId as number)).toBe(0);
    expect(t.getFrontier(driverPositionId as number)).toBe(0);
    expect(t.getFrontier(orderPositionId as number)).toBe(0);

    expect(t.redoPosition(collectionPositionId as number)).toEqual([turn.id]);
    expect(store.$.rows.ids()).toEqual([1, 3]);
    expect(store.$.drivers.byIdOrFail(7).status()).toBe('assigned');
    expect(store.$.orders.byIdOrFail(31).state()).toBe('dispatched');
  });

  it('undoes and redoes an added row while preserving SubjectId continuity', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    t.resetRestorationHistory();

    undoable(() => store.$.rows.addOne({ id: 7, name: 'B' }));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
      __effects?: Array<{
        kind: string;
        subject?: number;
        key?: number;
      }>;
    };
    const positionId = turn.__positionIds?.[0] as number;
    const addEffect = turn.__effects?.[0] as {
      subject: number;
      key: number;
    };

    expect(turn.__effects).toEqual([
      expect.objectContaining({
        kind: 'add',
        key: 7,
        subject: expect.any(Number),
      }),
    ]);
    expect(store.$.rows.byIdOrFail(7).name.__subjectIds?.[0]).toBe(
      addEffect.subject
    );

    expect(t.undoPosition(positionId)).toEqual([turn.id]);
    expect(store.$.rows.ids()).toEqual([]);

    expect(t.redoPosition(positionId)).toEqual([turn.id]);
    expect(store.$.rows.ids()).toEqual([7]);
    expect(store.$.rows.byIdOrFail(7).name.__subjectIds?.[0]).toBe(
      addEffect.subject
    );
  });

  it('replays a prepended add at its anchored position', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 1, name: 'A' }));
    undoable(() => store.$.rows.addOne({ id: 3, name: 'C' }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.rows.prependOne({ id: 2, name: 'B' }));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
      __effects?: Array<{
        kind: string;
        subject?: number;
        afterSubject?: number;
      }>;
    };
    const positionId = turn.__positionIds?.[0] as number;
    const addEffect = turn.__effects?.[0] as {
      subject: number;
      afterSubject?: number;
    };

    expect(store.$.rows.ids()).toEqual([2, 1, 3]);
    expect(addEffect.afterSubject).toBe(
      store.$.rows.byIdOrFail(1).name.__subjectIds?.[0]
    );

    expect(t.undoPosition(positionId)).toEqual([turn.id]);
    expect(store.$.rows.ids()).toEqual([1, 3]);

    expect(t.redoPosition(positionId)).toEqual([turn.id]);
    expect(store.$.rows.ids()).toEqual([2, 1, 3]);
    expect(store.$.rows.byIdOrFail(2).name.__subjectIds?.[0]).toBe(
      addEffect.subject
    );
  });

  it('undos and redoes a mixed add turn atomically', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 1, name: 'A' }));
    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.rows.addOne({ id: 2, name: 'B' }));
    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
      __effects?: Array<{ kind: string }>;
    };
    const [collectionPositionId, driverPositionId] = turn.__positionIds ?? [];

    expect(turn.__effects?.map((effect) => effect.kind).sort()).toEqual([
      'add',
      'set',
    ]);

    expect(t.undoPosition(driverPositionId as number)).toEqual([turn.id]);
    expect(store.$.rows.ids()).toEqual([1]);
    expect(store.$.drivers.byIdOrFail(7).status()).toBe('idle');
    expect(t.getFrontier(collectionPositionId as number)).toBe(0);
    expect(t.getFrontier(driverPositionId as number)).toBe(0);

    expect(t.redoPosition(collectionPositionId as number)).toEqual([turn.id]);
    expect(store.$.rows.ids()).toEqual([1, 2]);
    expect(store.$.drivers.byIdOrFail(7).status()).toBe('assigned');
  });

  it('fails atomically when redoing a mixed add turn cannot restore the added subject', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 1, name: 'A' }));
    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.rows.addOne({ id: 2, name: 'B' }));
    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const [collectionPositionId, driverPositionId] = turn.__positionIds ?? [];

    expect(t.undoPosition(driverPositionId as number)).toEqual([turn.id]);
    expect(store.$.rows.ids()).toEqual([1]);
    expect(store.$.drivers.byIdOrFail(7).status()).toBe('idle');

    const poisonedTurn = t.getTurnRef(turn.id) as {
      __effects?: Array<Record<string, unknown>>;
    };
    const addEffect = poisonedTurn.__effects?.find(
      (effect) => effect.kind === 'add'
    );
    if (!addEffect) {
      throw new Error('Expected add effect');
    }
    addEffect.key = 1;

    expect(() => t.redoPosition(collectionPositionId as number)).toThrow(
      'Unsupported scoped undo effect at structural-drift'
    );
    expect(store.$.rows.ids()).toEqual([1]);
    expect(store.$.drivers.byIdOrFail(7).status()).toBe('idle');
    expect(
      t.getAppliedTurnIdsForPosition(collectionPositionId as number)
    ).toEqual([]);
    expect(t.getAppliedTurnIdsForPosition(driverPositionId as number)).toEqual(
      []
    );
    expect(t.getFrontier(collectionPositionId as number)).toBe(0);
    expect(t.getFrontier(driverPositionId as number)).toBe(0);
  });

  it('keeps owner paths stable across changeId while notifier paths change', async () => {
    const { getPathNotifier, resetPathNotifier } = await import(
      '../../lib/path-notifier'
    );
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;
    const initial = t.getRestorationHistory().length;
    const seenPaths: string[] = [];
    const notifier = getPathNotifier();
    const unsubscribe = notifier.subscribe('rows.*', (_next, _prev, path) => {
      seenPaths.push(path);
    });

    undoable(() => store.$.rows.addOne({ id: -1, name: 'temp' }));
    await Promise.resolve();
    await Promise.resolve();
    const addEntry = t.getRestorationHistory().at(-1);
    expect(t.getRestorationHistory().length).toBeGreaterThan(initial);

    undoable(() => store.$.rows.changeId(-1, 42));
    await Promise.resolve();
    await Promise.resolve();
    const changeIdEntry = t.getRestorationHistory().at(-1);
    const observed = t.getObservedBatches();

    unsubscribe();

    expect(addEntry?.__ownerPaths).toEqual(['rows']);
    expect(changeIdEntry?.__ownerPaths).toEqual(['rows']);
    expect(observed.at(-2)).toEqual({
      action: 'batch',
      ownerPaths: ['rows'],
      recorded: true,
    });
    expect(observed.at(-1)).toEqual({
      action: 'batch',
      ownerPaths: ['rows'],
      recorded: true,
    });
    // Same-reference rekeys still carry canonical structural metadata through
    // PathNotifier transport, so generic subscribers observe the rekey path.
    expect(seenPaths).toEqual(['rows.-1', 'rows.42']);
  });

  it('records the user branch, not the replay branch, when undo and a user write share a tick', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      { count: 0 },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.count.set(1));
    await Promise.resolve();
    await Promise.resolve();

    undoable(() => store.$.count.set(2));
    await Promise.resolve();
    await Promise.resolve();

    t.undo();
    undoable(() => store.$.count.set(3));
    await Promise.resolve();
    await Promise.resolve();

    const historyStates = t
      .getRestorationHistory()
      .map((entry: { state: { count: number } }) => entry.state.count);

    expect(store.$().count).toBe(3);
    expect(historyStates).toEqual([0, 1, 3]);
  });

  it('does not retain a user transition when a queued user write is undone in the same tick', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      { count: 0 },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.count.set(1));
    await Promise.resolve();
    await Promise.resolve();

    undoable(() => store.$.count.set(2));
    await Promise.resolve();
    await Promise.resolve();

    undoable(() => store.$.count.set(3));
    t.undo();
    await Promise.resolve();
    await Promise.resolve();

    const historyStates = t
      .getRestorationHistory()
      .map((entry: { state: { count: number } }) => entry.state.count);

    expect(store.$().count).toBe(1);
    expect(historyStates).not.toContain(3);
    expect(historyStates.at(-1)).toBe(1);
  });

  it('keeps one owner position stable while row subjects churn', async () => {
    const { getPathNotifier, resetPathNotifier } = await import(
      '../../lib/path-notifier'
    );
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const notifier = getPathNotifier();
    const t = (store as any).__restoration;
    const liveOwnerTokens: number[][] = [];
    const liveSubjectTokens: number[][] = [];
    const replayOwnerTokens: number[][] = [];

    const unsubscribe = notifier.subscribe(
      'rows',
      (_next, _prev, _path, _ownerPath, source, subjectIds, positionIds) => {
        if (source === 'restoration') {
          return;
        }
        if (subjectIds && subjectIds.length > 0) {
          liveSubjectTokens.push(subjectIds);
        }
        if (positionIds && positionIds.length > 0) {
          liveOwnerTokens.push(positionIds);
        }
      }
    );
    const restoreReplayObserver = interceptLeafSignals(
      (store as any).$,
      // ⚠️ READS THE INTERCEPTOR'S OWN ARGUMENT, not `meta.positionIds` — that
      // copy was deleted in 15.0, and this carrier staying green on the switch
      // is what PROVED it duplicate. Contrast the subject carriers below, which
      // could not make the same switch.
      (_path, _next, _prev, meta, _ownerPath, _subjectIds, positionIds) => {
        if (meta?.origin !== 'restoration') {
          return;
        }
        if (Array.isArray(positionIds) && positionIds.length > 0) {
          replayOwnerTokens.push(positionIds as number[]);
        }
      }
    );

    undoable(() => store.$.rows.addOne({ id: 7, name: 'original' }));
    await Promise.resolve();
    await Promise.resolve();
    const ownerAfterFirstAdd = [
      ...((t.getRestorationHistory().at(-1) as { __positionIds?: number[] })
        ?.__positionIds ?? []),
    ];
    const subjectAfterFirstAdd = [
      ...((t.getRestorationHistory().at(-1) as { restorationSubjectIds?: number[] })
        ?.restorationSubjectIds ?? []),
    ];

    undoable(() => store.$.rows.addOne({ id: 8, name: 'second' }));
    await Promise.resolve();
    await Promise.resolve();
    const ownerAfterSecondAdd = [
      ...((t.getRestorationHistory().at(-1) as { __positionIds?: number[] })
        ?.__positionIds ?? []),
    ];
    const subjectAfterSecondAdd = [
      ...((t.getRestorationHistory().at(-1) as { restorationSubjectIds?: number[] })
        ?.restorationSubjectIds ?? []),
    ];

    undoable(() => store.$.rows.changeId(7, 70));
    await Promise.resolve();
    await Promise.resolve();
    const ownerAfterRekey = [
      ...((t.getRestorationHistory().at(-1) as { __positionIds?: number[] })
        ?.__positionIds ?? []),
    ];

    undoable(() => store.$.rows.removeOne(8));
    await Promise.resolve();
    await Promise.resolve();

    undoable(() => store.$.rows.addOne({ id: 8, name: 'replacement' }));
    await Promise.resolve();
    await Promise.resolve();
    const ownerAfterReuse = [
      ...((t.getRestorationHistory().at(-1) as { __positionIds?: number[] })
        ?.__positionIds ?? []),
    ];
    const subjectAfterReuse = [
      ...((t.getRestorationHistory().at(-1) as { restorationSubjectIds?: number[] })
        ?.restorationSubjectIds ?? []),
    ];

    t.undo();
    await Promise.resolve();
    await Promise.resolve();

    restoreReplayObserver();
    unsubscribe();

    expect(ownerAfterFirstAdd).toHaveLength(1);
    expect(ownerAfterSecondAdd).toEqual(ownerAfterFirstAdd);
    expect(ownerAfterRekey).toEqual(ownerAfterFirstAdd);
    expect(ownerAfterReuse).toEqual(ownerAfterFirstAdd);
    expect(subjectAfterFirstAdd).toHaveLength(1);
    expect(subjectAfterSecondAdd).toHaveLength(1);
    expect(subjectAfterSecondAdd).not.toEqual(subjectAfterFirstAdd);
    expect(subjectAfterReuse).toHaveLength(1);
    expect(subjectAfterReuse).not.toEqual(subjectAfterSecondAdd);
    expect(liveOwnerTokens).toContainEqual(ownerAfterFirstAdd);
    expect(replayOwnerTokens).toContainEqual(ownerAfterFirstAdd);
    expect(liveSubjectTokens).toContainEqual(subjectAfterFirstAdd);
    expect(liveSubjectTokens).toContainEqual(subjectAfterSecondAdd);
    expect(liveSubjectTokens).toContainEqual(subjectAfterReuse);
  });

  it('does not collapse same-path remove-plus-readd across a subject boundary in one flush', async () => {
    const { resetPathNotifier } = await import('../../lib/path-notifier');
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'first' }));
    await Promise.resolve();
    await Promise.resolve();

    const beforeBoundaryEntry = t.getRestorationHistory().at(-1) as {
      __positionIds?: number[];
      restorationSubjectIds?: number[];
    };

    undoable(() => store.$.rows.removeOne(7));
    undoable(() => store.$.rows.addOne({ id: 7, name: 'replacement' }));
    await Promise.resolve();
    await Promise.resolve();

    const boundaryEntry = t.getRestorationHistory().at(-1) as {
      __positionIds?: number[];
      restorationSubjectIds?: number[];
    };

    expect(boundaryEntry.__positionIds).toEqual(
      beforeBoundaryEntry.__positionIds
    );
    expect(boundaryEntry.restorationSubjectIds).toHaveLength(2);
    expect(boundaryEntry.restorationSubjectIds?.[0]).toBe(
      beforeBoundaryEntry.restorationSubjectIds?.[0]
    );
    expect(boundaryEntry.restorationSubjectIds?.[1]).not.toBe(
      beforeBoundaryEntry.restorationSubjectIds?.[0]
    );
  });

  it('carries one stable subject token across live, retained, and replay observation for a rekeyed row', async () => {
    const { getPathNotifier, resetPathNotifier } = await import(
      '../../lib/path-notifier'
    );
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const notifier = getPathNotifier();
    const t = (store as any).__restoration;
    const liveSubjectTokens: number[][] = [];

    const unsubscribe = notifier.subscribe(
      'rows',
      (_next, _prev, _path, _ownerPath, source, subjectIds) => {
        if (source === 'restoration') {
          return;
        }
        if (subjectIds && subjectIds.length > 0) {
          liveSubjectTokens.push(subjectIds);
        }
      }
    );
    // ⚠️ THE REPLAY-OBSERVATION HALF OF THIS CARRIER WAS RETIRED IN 15.0 —
    // REPLAY-SUBJECT-ATTRIBUTION-0, option (a). An `interceptLeafSignals`
    // observer stood here reading `meta.subjectIds` and pushing into
    //
    // What it asserted was narrow: "a private test observer can re-read the
    // exact causal effect subject through public WriteMetadata". That field had
    // eight writers and no production reader, and `interceptLeafSignals` is
    // unexported and not root app API — so the assertion existed to observe a
    // channel that existed for the assertion.
    //
    //     A TEST CAN PROVE THAT TWO FACTS ARE DISTINCT WITHOUT EARNING A PUBLIC
    //     OBSERVATION CHANNEL FOR EITHER FACT.
    //
    // NO REPLACEMENT OBSERVER was added. The alternatives were both bad: the
    // exposed `CanonicalTurn.__effects[]` carry no numeric subjectId (measured),
    // and re-reading `restorationSubjectIds` would be circular — this test
    // already derives its EXPECTED tokens from exactly that field.
    //
    // THE SEMANTIC CLAIMS BELOW ARE UNTOUCHED, and they are the reason the test
    // exists: that lifecycle preserves a logical subject where it must, and that
    // a reused key gets a distinct one. Those are also defended behaviourally —
    // reinstating a wrong subject id turns 432 tests red.

    undoable(() => store.$.rows.addOne({ id: -1, name: 'temp' }));
    await Promise.resolve();
    await Promise.resolve();
    const addedToken = [
      ...((t.getRestorationHistory().at(-1) as { restorationSubjectIds?: number[] })
        ?.restorationSubjectIds ?? []),
    ];

    undoable(() => store.$.rows.changeId(-1, 42));
    await Promise.resolve();
    await Promise.resolve();
    const rekeyedToken = [
      ...((t.getRestorationHistory().at(-1) as { restorationSubjectIds?: number[] })
        ?.restorationSubjectIds ?? []),
    ];

    undoable(() => store.$.rows.byIdOrFail(42).name.set('server'));
    await Promise.resolve();
    await Promise.resolve();
    const retainedToken = [
      ...((t.getRestorationHistory().at(-1) as { restorationSubjectIds?: number[] })
        ?.restorationSubjectIds ?? []),
    ];

    undoable(() => store.$.rows.addOne({ id: -1, name: 'replacement' }));
    await Promise.resolve();
    await Promise.resolve();
    const reusedPathToken = [
      ...((t.getRestorationHistory().at(-1) as { restorationSubjectIds?: number[] })
        ?.restorationSubjectIds ?? []),
    ];

    t.undo();
    await Promise.resolve();
    await Promise.resolve();
    t.undo();
    await Promise.resolve();
    await Promise.resolve();

    unsubscribe();

    expect(addedToken).toHaveLength(1);
    expect(rekeyedToken).toEqual(addedToken);
    expect(retainedToken).toEqual(addedToken);
    expect(reusedPathToken).toHaveLength(1);
    expect(reusedPathToken).not.toEqual(addedToken);
    expect(liveSubjectTokens).toContainEqual(addedToken);
    expect(liveSubjectTokens).toContainEqual(rekeyedToken);
    expect(liveSubjectTokens).toContainEqual(retainedToken);
    expect(liveSubjectTokens).toContainEqual(reusedPathToken);
  });

  it('undoes and redoes a rekey while preserving SubjectId continuity', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'A' }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    const beforeSubject = store.$.rows.byIdOrFail(7).name
      .__subjectIds?.[0] as number;

    undoable(() => store.$.rows.changeId(7, 42));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
      __effects?: Array<{
        kind: string;
        subject?: number;
        beforeKey?: number;
        afterKey?: number;
      }>;
    };
    const positionId = turn.__positionIds?.[0] as number;
    const rekeyEffect = turn.__effects?.[0] as {
      subject: number;
      beforeKey: number;
      afterKey: number;
    };

    expect(turn.__effects).toEqual([
      expect.objectContaining({
        kind: 'rekey',
        subject: beforeSubject,
        beforeKey: 7,
        afterKey: 42,
      }),
    ]);
    expect(store.$.rows.byIdOrFail(42).name.__subjectIds?.[0]).toBe(
      beforeSubject
    );

    expect(t.undoPosition(positionId)).toEqual([turn.id]);
    expect(store.$.rows.ids()).toEqual([7]);
    expect(store.$.rows.byIdOrFail(7).name.__subjectIds?.[0]).toBe(
      beforeSubject
    );

    expect(t.redoPosition(positionId)).toEqual([turn.id]);
    expect(store.$.rows.ids()).toEqual([42]);
    expect(store.$.rows.byIdOrFail(42).name.__subjectIds?.[0]).toBe(
      rekeyEffect.subject
    );
  });

  it('fails atomically when undoing a mixed rekey turn would steal an occupied key', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'A' }));
    undoable(() => store.$.drivers.addOne({ id: 1, status: 'idle' }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.rows.changeId(7, 42));
    undoable(() => store.$.drivers.byIdOrFail(1).status.set('assigned'));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const [rowsPositionId, driverPositionId] = turn.__positionIds ?? [];

    const poisonedTurn = t.getTurnRef(turn.id) as {
      __effects?: Array<Record<string, unknown>>;
    };
    const rekeyEffect = poisonedTurn.__effects?.find(
      (effect) => effect.kind === 'rekey'
    );
    if (!rekeyEffect) {
      throw new Error('Expected rekey effect');
    }
    rekeyEffect.beforeKey = 42;

    expect(() => t.undoPosition(rowsPositionId as number)).toThrow(
      'Unsupported scoped undo effect at structural-drift'
    );
    expect(store.$.rows.ids()).toEqual([42]);
    expect(store.$.drivers.byIdOrFail(1).status()).toBe('assigned');
    expect(t.getAppliedTurnIdsForPosition(rowsPositionId as number)).toEqual([
      turn.id,
    ]);
    expect(t.getAppliedTurnIdsForPosition(driverPositionId as number)).toEqual([
      turn.id,
    ]);
    expect(t.getFrontier(rowsPositionId as number)).toBe(1);
    expect(t.getFrontier(driverPositionId as number)).toBe(1);
  });

  it('fails atomically when redoing a mixed rekey turn would steal an occupied key', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'A' }));
    undoable(() => store.$.drivers.addOne({ id: 1, status: 'idle' }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.rows.changeId(7, 42));
    undoable(() => store.$.drivers.byIdOrFail(1).status.set('assigned'));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };
    const [rowsPositionId, driverPositionId] = turn.__positionIds ?? [];

    expect(t.undoPosition(rowsPositionId as number)).toEqual([turn.id]);
    expect(store.$.rows.ids()).toEqual([7]);
    expect(store.$.drivers.byIdOrFail(1).status()).toBe('idle');

    const poisonedTurn = t.getTurnRef(turn.id) as {
      __effects?: Array<Record<string, unknown>>;
    };
    const rekeyEffect = poisonedTurn.__effects?.find(
      (effect) => effect.kind === 'rekey'
    );
    if (!rekeyEffect) {
      throw new Error('Expected rekey effect');
    }
    rekeyEffect.afterKey = 7;

    expect(() => t.redoPosition(rowsPositionId as number)).toThrow(
      'Unsupported scoped undo effect at structural-drift'
    );
    expect(store.$.rows.ids()).toEqual([7]);
    expect(store.$.drivers.byIdOrFail(1).status()).toBe('idle');
    expect(t.getAppliedTurnIdsForPosition(rowsPositionId as number)).toEqual(
      []
    );
    expect(t.getAppliedTurnIdsForPosition(driverPositionId as number)).toEqual(
      []
    );
    expect(t.getFrontier(rowsPositionId as number)).toBe(0);
    expect(t.getFrontier(driverPositionId as number)).toBe(0);
  });

  it('keeps removed and reused subjects distinct across live, retained, and replay observation', async () => {
    const { getPathNotifier, resetPathNotifier } = await import(
      '../../lib/path-notifier'
    );
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const notifier = getPathNotifier();
    const t = (store as any).__restoration;
    const liveSubjectTokens: number[][] = [];

    const unsubscribe = notifier.subscribe(
      'rows',
      (_next, _prev, _path, _ownerPath, source, subjectIds) => {
        if (source === 'restoration') {
          return;
        }
        if (subjectIds && subjectIds.length > 0) {
          liveSubjectTokens.push(subjectIds);
        }
      }
    );
    // ⚠️ THE REPLAY-OBSERVATION HALF OF THIS CARRIER WAS RETIRED IN 15.0 —
    // REPLAY-SUBJECT-ATTRIBUTION-0, option (a). An `interceptLeafSignals`
    // observer stood here reading `meta.subjectIds` and pushing into
    //
    // What it asserted was narrow: "a private test observer can re-read the
    // exact causal effect subject through public WriteMetadata". That field had
    // eight writers and no production reader, and `interceptLeafSignals` is
    // unexported and not root app API — so the assertion existed to observe a
    // channel that existed for the assertion.
    //
    //     A TEST CAN PROVE THAT TWO FACTS ARE DISTINCT WITHOUT EARNING A PUBLIC
    //     OBSERVATION CHANNEL FOR EITHER FACT.
    //
    // NO REPLACEMENT OBSERVER was added. The alternatives were both bad: the
    // exposed `CanonicalTurn.__effects[]` carry no numeric subjectId (measured),
    // and re-reading `restorationSubjectIds` would be circular — this test
    // already derives its EXPECTED tokens from exactly that field.
    //
    // THE SEMANTIC CLAIMS BELOW ARE UNTOUCHED, and they are the reason the test
    // exists: that lifecycle preserves a logical subject where it must, and that
    // a reused key gets a distinct one. Those are also defended behaviourally —
    // reinstating a wrong subject id turns 432 tests red.

    undoable(() => store.$.rows.addOne({ id: 7, name: 'original' }));
    await Promise.resolve();
    await Promise.resolve();
    const originalToken = [
      ...((t.getRestorationHistory().at(-1) as { restorationSubjectIds?: number[] })
        ?.restorationSubjectIds ?? []),
    ];

    undoable(() => store.$.rows.removeOne(7));
    await Promise.resolve();
    await Promise.resolve();
    const removedToken = [
      ...((t.getRestorationHistory().at(-1) as { restorationSubjectIds?: number[] })
        ?.restorationSubjectIds ?? []),
    ];

    undoable(() => store.$.rows.addOne({ id: 7, name: 'replacement' }));
    await Promise.resolve();
    await Promise.resolve();
    const replacementToken = [
      ...((t.getRestorationHistory().at(-1) as { restorationSubjectIds?: number[] })
        ?.restorationSubjectIds ?? []),
    ];

    t.undo();
    await Promise.resolve();
    await Promise.resolve();
    t.undo();
    await Promise.resolve();
    await Promise.resolve();

    unsubscribe();

    expect(originalToken).toHaveLength(1);
    expect(removedToken).toEqual(originalToken);
    expect(replacementToken).toHaveLength(1);
    expect(replacementToken).not.toEqual(originalToken);
    expect(liveSubjectTokens).toContainEqual(originalToken);
    expect(liveSubjectTokens).toContainEqual(removedToken);
    expect(liveSubjectTokens).toContainEqual(replacementToken);
  });

  // DELETED WITH STATUS-DEL — "records history for status promise-vocabulary
  // aliases". A LEGACY CONTRACT TEST: its subject was status's start()/fail()
  // aliases, which S1 measured as a documented naming accommodation for AI
  // agents rather than a function.

  it('routes public undo through turn frontiers for a single scalar write', async () => {
    const store = signalTree(
      { count: 0 },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.count.set(1));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as { __positionIds?: number[] };
    const positionId = turn.__positionIds?.[0] as number;

    expect(t.getFrontier(positionId)).toBe(1);

    store.undo();

    expect(store.$.count()).toBe(0);
    expect(t.getFrontier(positionId)).toBe(0);
  });

  it('routes public undo through turn frontiers for a single entity-field write', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'A' }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.rows.byIdOrFail(7).name.set('B'));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as { __positionIds?: number[] };
    const positionId = turn.__positionIds?.[0] as number;

    expect(t.getFrontier(positionId)).toBe(1);

    store.undo();

    expect(store.$.rows.byIdOrFail(7).name()).toBe('A');
    expect(t.getFrontier(positionId)).toBe(0);
  });

  it('routes collection add, remove, and rekey turns through the realization port', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;
    const realizationPort = getTreeRealizationPort(store.$);
    if (!realizationPort) {
      throw new Error('Expected tree-owned realization port');
    }
    const applySpy = vi.spyOn(realizationPort, 'applyAtomically');

    undoable(() => store.$.rows.addOne({ id: 7, name: 'A' }));
    await Promise.resolve();
    await Promise.resolve();

    const addTurn = t.getTurns().at(-1) as { __positionIds?: number[] };
    const addPositionId = addTurn.__positionIds?.[0] as number;
    expect(t.getFrontier(addPositionId)).toBe(1);
    store.undo();
    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(store.$.rows.ids()).toEqual([]);
    expect(t.getFrontier(addPositionId)).toBe(0);

    undoable(() => store.$.rows.addOne({ id: 7, name: 'A' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    undoable(() => store.$.rows.removeOne(7));
    await Promise.resolve();
    await Promise.resolve();

    const removeTurn = t.getTurns().at(-1) as { __positionIds?: number[] };
    const removePositionId = removeTurn.__positionIds?.[0] as number;
    expect(t.getFrontier(removePositionId)).toBe(1);
    store.undo();
    expect(applySpy).toHaveBeenCalledTimes(2);
    expect(store.$.rows.ids()).toEqual([7]);
    expect(store.$.rows.byIdOrFail(7).name()).toBe('A');
    expect(t.getFrontier(removePositionId)).toBe(0);

    t.resetRestorationHistory();

    undoable(() => store.$.rows.changeId(7, 42));
    await Promise.resolve();
    await Promise.resolve();

    const rekeyTurn = t.getTurns().at(-1) as { __positionIds?: number[] };
    const rekeyPositionId = rekeyTurn.__positionIds?.[0] as number;
    expect(t.getFrontier(rekeyPositionId)).toBe(1);
    store.undo();
    expect(applySpy).toHaveBeenCalledTimes(3);
    expect(store.$.rows.ids()).toEqual([7]);
    expect(t.getFrontier(rekeyPositionId)).toBe(0);
  });

  it('gives top-level scalar turns distinct participant positions under a shared root authority', async () => {
    const store = signalTree(
      { count: 0, title: 'A' },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;
    const rootPositionId = (store.$ as unknown as ScopedAuthorityNode)
      .__positionIds?.[0] as number;

    undoable(() => store.$.count.set(1));
    await Promise.resolve();
    await Promise.resolve();

    const firstTurn = t.getTurns().at(-1) as { __positionIds?: number[] };

    undoable(() => store.$.title.set('B'));
    await Promise.resolve();
    await Promise.resolve();

    const secondTurn = t.getTurns().at(-1) as { __positionIds?: number[] };
    const firstPositionId = firstTurn.__positionIds?.[0] as number;
    const secondPositionId = secondTurn.__positionIds?.[0] as number;

    expect(firstPositionId).not.toBe(secondPositionId);
    expect(t.containsPosition(rootPositionId, firstPositionId)).toBe(true);
    expect(t.containsPosition(rootPositionId, secondPositionId)).toBe(true);
    expect(t.getAppliedTurnIdsForPosition(rootPositionId)).toEqual([]);
    expect(t.getAppliedTurnIdsForPosition(firstPositionId)).toEqual([
      firstTurn.id,
    ]);
    expect(t.getAppliedTurnIdsForPosition(secondPositionId)).toEqual([
      secondTurn.id,
    ]);
    expect(t.getFrontier(rootPositionId)).toBe(0);
    expect(t.getFrontier(firstPositionId)).toBe(1);
    expect(t.getFrontier(secondPositionId)).toBe(1);

    store.undo();
    expect(store.$.count()).toBe(1);
    expect(store.$.title()).toBe('A');
    expect(t.getFrontier(rootPositionId)).toBe(0);
    expect(t.getFrontier(firstPositionId)).toBe(1);
    expect(t.getFrontier(secondPositionId)).toBe(0);

    store.undo();
    expect(store.$.count()).toBe(0);
    expect(t.getFrontier(rootPositionId)).toBe(0);
    expect(t.getFrontier(firstPositionId)).toBe(0);
    expect(t.getFrontier(secondPositionId)).toBe(0);
  });

  it('recomputes derived state without adding a second causal effect or frontier movement', async () => {
    const store = signalTree(
      {
        profile: {
          firstName: 'Jonathan',
          lastName: 'Borgia',
        },
      },
      {
        capabilities: ['causal-runtime'],
        enhancers: [restoration()],
        derived: ($) => ({
          profile: {
            fullName: () =>
              `${$.profile.firstName()} ${$.profile.lastName()}`,
          },
        }),
      }
    );
    const t = (store as any).__restoration;
    const fullName = store.$.profile.fullName as {
      (): string;
      __positionIds?: number[];
      __ownerPath?: string;
    };

    expect(fullName()).toBe('Jonathan Borgia');
    expect(fullName.__positionIds).toBeUndefined();
    expect(fullName.__ownerPath).toBeUndefined();

    t.resetRestorationHistory();
    const baselineRestorationCount = t.getRestorationHistory().length;
    const baselineTurnCount = t.getTurns().length;

    undoable(() => store.$.profile.firstName.set('Jon'));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as {
      id: number;
      __ownerPaths?: string[];
      __positionIds?: number[];
      __effects?: Array<{
        kind: string;
        path: string;
        before: unknown;
        after: unknown;
      }>;
    };
    const positionId = turn.__positionIds?.[0] as number;

    expect(store.$.profile.firstName()).toBe('Jon');
    expect(fullName()).toBe('Jon Borgia');
    expect(t.getRestorationHistory()).toHaveLength(baselineRestorationCount + 1);
    expect(t.getTurns()).toHaveLength(baselineTurnCount + 1);
    expect(turn.__ownerPaths).toEqual(['profile.firstName']);
    expect(turn.__positionIds).toHaveLength(1);
    expect(turn.__effects).toHaveLength(1);
    expect(turn.__effects?.[0]).toMatchObject({
      kind: 'set',
      path: 'profile.firstName',
      before: 'Jonathan',
      after: 'Jon',
    });
    expect(t.getFrontier(positionId)).toBe(1);
  });

  it('undoes the source write while derived state recomputes without its own restoration history entry', async () => {
    const store = signalTree(
      {
        profile: {
          firstName: 'Jonathan',
          lastName: 'Borgia',
        },
      },
      {
        capabilities: ['causal-runtime'],
        enhancers: [restoration()],
        derived: ($) => ({
          profile: {
            fullName: () =>
              `${$.profile.firstName()} ${$.profile.lastName()}`,
          },
        }),
      }
    );
    const t = (store as any).__restoration;

    t.resetRestorationHistory();
    const baselineRestorationCount = t.getRestorationHistory().length;
    const baselineTurnCount = t.getTurns().length;

    undoable(() => store.$.profile.firstName.set('Jon'));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as { __positionIds?: number[] };
    const positionId = turn.__positionIds?.[0] as number;

    expect(store.$.profile.fullName()).toBe('Jon Borgia');
    expect(t.getRestorationHistory()).toHaveLength(baselineRestorationCount + 1);
    expect(t.getTurns()).toHaveLength(baselineTurnCount + 1);
    expect(t.getFrontier(positionId)).toBe(1);

    store.undo();

    expect(store.$.profile.firstName()).toBe('Jonathan');
    expect(store.$.profile.fullName()).toBe('Jonathan Borgia');
    expect(t.getRestorationHistory()).toHaveLength(baselineRestorationCount + 1);
    expect(t.getTurns()).toHaveLength(baselineTurnCount + 1);
    expect(t.getFrontier(positionId)).toBe(0);
    expect(store.canUndo()).toBe(false);
  });

  it('indexes one root callable partial update under descendant owner positions and keeps undo/redo atomic', async () => {
    const store = signalTree(
      { count: 1, title: 'A' },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    t.resetRestorationHistory();

    // Designated: this test undoes and redoes the root-callable update, so it
    // has to be an admitted turn.
    undoable(() => store.$({ count: 2, title: 'B' }));
    await Promise.resolve();
    await Promise.resolve();

    const indexedTurns = t
      .getTurns()
      .filter(
        (turn: { __positionIds?: number[] }) =>
          (turn.__positionIds?.length ?? 0) > 0
      );
    const turn = indexedTurns.at(-1) as {
      id: number;
      __positionIds?: number[];
      __effects?: Array<{
        kind: string;
        path: string;
        before: unknown;
        after: unknown;
        position: number;
      }>;
    };
    const positions = [
      ...new Set(turn.__effects?.map((effect) => effect.position) ?? []),
    ].sort((left, right) => left - right);

    expect(indexedTurns).toHaveLength(1);
    expect(
      turn.__positionIds?.slice().sort((left, right) => left - right)
    ).toEqual(positions);
    expect(turn.__effects).toHaveLength(2);
    expect(turn.__effects?.map((effect) => effect.path).sort()).toEqual([
      'count',
      'title',
    ]);
    expect(turn.__effects?.every((effect) => effect.kind === 'set')).toBe(true);
    expect(positions).toHaveLength(2);
    expect(turn.__effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'count', before: 1, after: 2 }),
        expect.objectContaining({ path: 'title', before: 'A', after: 'B' }),
      ])
    );
    expect(
      positions.every((positionId) => t.getFrontier(positionId) === 1)
    ).toBe(true);

    store.undo();

    expect(store.$.count()).toBe(1);
    expect(store.$.title()).toBe('A');
    expect(
      positions.every((positionId) => t.getFrontier(positionId) === 0)
    ).toBe(true);

    store.redo();

    expect(store.$.count()).toBe(2);
    expect(store.$.title()).toBe('B');
    expect(
      positions.every((positionId) => t.getFrontier(positionId) === 1)
    ).toBe(true);
  });

  it('refuses descendant authority for a multi-position turn and lets the containing branch undo atomically', async () => {
    const store = signalTree(
      {
        profile: { firstName: 'John', lastName: 'Smith' },
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration as InternalRestorationManager;
    const profile = store.$.profile as unknown as ScopedAuthorityNode & {
      firstName: ScopedAuthorityNode & { (): string; set(value: string): void };
      lastName: ScopedAuthorityNode & { (): string; set(value: string): void };
    };

    store
      .transaction(() => {
        undoable(() => profile.firstName.set('Jane'));
        undoable(() => profile.lastName.set('Jones'));
      })
      .confirm();

    const profilePositionId = profile.__positionIds?.[0] as number;
    const firstNamePositionId = profile.firstName.__positionIds?.[0] as number;
    const lastNamePositionId = profile.lastName.__positionIds?.[0] as number;

    expect(t.canUndoAt(firstNamePositionId)).toBe(false);
    expect(t.canUndoAt(lastNamePositionId)).toBe(false);
    expect(t.canUndoAt(profilePositionId)).toBe(true);
    expect(store.canUndo()).toBe(true);

    expect(t.undoAt(firstNamePositionId)).toBe(false);
    expect(profile.firstName()).toBe('Jane');
    expect(profile.lastName()).toBe('Jones');
    expect(t.getFrontier(firstNamePositionId)).toBe(1);
    expect(t.getFrontier(lastNamePositionId)).toBe(1);
    expect(t.canRedoAt(firstNamePositionId)).toBe(false);
    expect(t.canRedoAt(profilePositionId)).toBe(false);

    expect(t.undoAt(profilePositionId)).toBe(true);
    expect(profile.firstName()).toBe('John');
    expect(profile.lastName()).toBe('Smith');
    expect(t.getFrontier(firstNamePositionId)).toBe(0);
    expect(t.getFrontier(lastNamePositionId)).toBe(0);

    expect(t.redoAt(profilePositionId)).toBe(true);
    expect(profile.firstName()).toBe('Jane');
    expect(profile.lastName()).toBe('Jones');
  });

  it('allows single-position turns to undo at leaf, branch, and root authority', async () => {
    const store = signalTree(
      {
        profile: { firstName: 'John', lastName: 'Smith' },
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration as InternalRestorationManager;
    const profile = store.$.profile as unknown as ScopedAuthorityNode & {
      firstName: ScopedAuthorityNode & { (): string; set(value: string): void };
    };
    const profilePositionId = profile.__positionIds?.[0] as number;
    const firstNamePositionId = profile.firstName.__positionIds?.[0] as number;

    undoable(() => profile.firstName.set('Jane'));
    await Promise.resolve();
    await Promise.resolve();

    expect(t.canUndoAt(firstNamePositionId)).toBe(true);
    expect(t.canUndoAt(profilePositionId)).toBe(true);
    expect(store.canUndo()).toBe(true);

    expect(t.undoAt(firstNamePositionId)).toBe(true);
    expect(profile.firstName()).toBe('John');

    expect(t.redoAt(firstNamePositionId)).toBe(true);
    expect(profile.firstName()).toBe('Jane');

    expect(t.undoAt(profilePositionId)).toBe(true);
    expect(profile.firstName()).toBe('John');

    store.redo();
    expect(profile.firstName()).toBe('Jane');
  });

  it('refuses cross-domain turns below the lowest common ancestor and leaves state neutral on refusal', async () => {
    const store = signalTree(
      {
        profile: { firstName: 'John', lastName: 'Smith' },
        settings: { theme: 'light' },
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration as InternalRestorationManager;
    const profile = store.$.profile as unknown as ScopedAuthorityNode & {
      firstName: ScopedAuthorityNode & { (): string; set(value: string): void };
    };
    const settings = store.$.settings as unknown as ScopedAuthorityNode & {
      theme: ScopedAuthorityNode & { (): string; set(value: string): void };
    };

    store
      .transaction(() => {
        undoable(() => profile.firstName.set('Jane'));
        undoable(() => settings.theme.set('dark'));
      })
      .confirm();

    const profilePositionId = profile.__positionIds?.[0] as number;
    const settingsPositionId = settings.__positionIds?.[0] as number;
    const firstNamePositionId = profile.firstName.__positionIds?.[0] as number;
    const themePositionId = settings.theme.__positionIds?.[0] as number;

    expect(t.containsPosition(firstNamePositionId, firstNamePositionId)).toBe(
      true
    );
    expect(t.containsPosition(firstNamePositionId, themePositionId)).toBe(
      false
    );
    expect(t.canUndoAt(profilePositionId)).toBe(false);
    expect(t.canUndoAt(settingsPositionId)).toBe(false);

    expect(t.undoAt(profilePositionId)).toBe(false);
    expect(profile.firstName()).toBe('Jane');
    expect(settings.theme()).toBe('dark');
    expect(t.getFrontier(firstNamePositionId)).toBe(1);
    expect(t.getFrontier(themePositionId)).toBe(1);

    store.undo();
    expect(profile.firstName()).toBe('John');
    expect(settings.theme()).toBe('light');
  });

  it('refuses a contained restoration turn when a later cross-boundary turn has advanced the frontier', async () => {
    const store = signalTree(
      {
        profile: { firstName: 'John', lastName: 'Smith' },
        settings: { theme: 'light' },
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration as InternalRestorationManager;
    const profile = store.$.profile as unknown as ScopedAuthorityNode & {
      firstName: ScopedAuthorityNode & { (): string; set(value: string): void };
      lastName: ScopedAuthorityNode & { (): string; set(value: string): void };
    };
    const settings = store.$.settings as unknown as ScopedAuthorityNode & {
      theme: ScopedAuthorityNode & { (): string; set(value: string): void };
    };

    store
      .transaction(() => {
        undoable(() => profile.firstName.set('Ada'));
        undoable(() => profile.lastName.set('Lovelace'));
      })
      .confirm();

    store
      .transaction(() => {
        undoable(() => profile.firstName.set('Grace'));
        undoable(() => settings.theme.set('dark'));
      })
      .confirm();

    const profilePositionId = profile.__positionIds?.[0] as number;
    const firstNamePositionId = profile.firstName.__positionIds?.[0] as number;
    const lastNamePositionId = profile.lastName.__positionIds?.[0] as number;
    const themePositionId = settings.theme.__positionIds?.[0] as number;
    const beforeRedoFirstName = t.canRedoAt(firstNamePositionId);
    const beforeRedoLastName = t.canRedoAt(lastNamePositionId);
    const beforeRedoTheme = t.canRedoAt(themePositionId);

    expect(t.canUndoAt(profilePositionId)).toBe(false);
    expect(t.undoAt(profilePositionId)).toBe(false);

    expect(profile.firstName()).toBe('Grace');
    expect(profile.lastName()).toBe('Lovelace');
    expect(settings.theme()).toBe('dark');
    expect(t.getFrontier(firstNamePositionId)).toBe(2);
    expect(t.getFrontier(lastNamePositionId)).toBe(1);
    expect(t.getFrontier(themePositionId)).toBe(1);
    expect(t.canRedoAt(firstNamePositionId)).toBe(beforeRedoFirstName);
    expect(t.canRedoAt(lastNamePositionId)).toBe(beforeRedoLastName);
    expect(t.canRedoAt(themePositionId)).toBe(beforeRedoTheme);
  });

  it('routes public redo through turn frontiers for a single scalar write', async () => {
    const store = signalTree(
      { count: 0 },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.count.set(1));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as { __positionIds?: number[] };
    const positionId = turn.__positionIds?.[0] as number;

    store.undo();
    expect(t.getFrontier(positionId)).toBe(0);

    store.redo();

    expect(store.$.count()).toBe(1);
    expect(t.getFrontier(positionId)).toBe(1);
  });

  it('routes public redo through turn frontiers for a single entity-field write', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'A' }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.rows.byIdOrFail(7).name.set('B'));
    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as { __positionIds?: number[] };
    const positionId = turn.__positionIds?.[0] as number;

    store.undo();
    expect(t.getFrontier(positionId)).toBe(0);

    store.redo();

    expect(store.$.rows.byIdOrFail(7).name()).toBe('B');
    expect(t.getFrontier(positionId)).toBe(1);
  });

  it('routes public redo through turn frontiers for collection add while preserving SubjectId', async () => {
    const addStore = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const addRestoration = (addStore as any).__restoration;

    undoable(() => addStore.$.rows.addOne({ id: 7, name: 'A' }));
    await Promise.resolve();
    await Promise.resolve();

    const addedToken = addStore.$.rows.byIdOrFail(7).name
      .__subjectIds?.[0] as number;
    const addTurn = addRestoration.getTurns().at(-1) as {
      __positionIds?: number[];
    };
    const addPositionId = addTurn.__positionIds?.[0] as number;
    addStore.undo();
    addStore.redo();
    expect(addStore.$.rows.ids()).toEqual([7]);
    expect(addStore.$.rows.byIdOrFail(7).name.__subjectIds?.[0]).toBe(
      addedToken
    );
    expect(addRestoration.getFrontier(addPositionId)).toBe(1);
  });

  it('routes public redo through turn frontiers for collection remove while preserving SubjectId on undo', async () => {
    const removeStore = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const removeRestoration = (removeStore as any).__restoration;

    undoable(() => removeStore.$.rows.addOne({ id: 7, name: 'A' }));
    await Promise.resolve();
    await Promise.resolve();
    const originalRemoveToken = removeStore.$.rows.byIdOrFail(7).name
      .__subjectIds?.[0] as number;
    removeRestoration.resetRestorationHistory();

    undoable(() => removeStore.$.rows.removeOne(7));
    await Promise.resolve();
    await Promise.resolve();

    const removeTurn = removeRestoration.getTurns().at(-1) as {
      __positionIds?: number[];
    };
    const removePositionId = removeTurn.__positionIds?.[0] as number;
    removeStore.undo();
    expect(removeStore.$.rows.byIdOrFail(7).name.__subjectIds?.[0]).toBe(
      originalRemoveToken
    );
    removeStore.redo();
    expect(removeStore.$.rows.ids()).toEqual([]);
    expect(removeRestoration.getFrontier(removePositionId)).toBe(1);
  });

  it('routes public redo through turn frontiers for collection rekey while preserving SubjectId', async () => {
    const rekeyStore = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const rekeyRestoration = (rekeyStore as any).__restoration;

    undoable(() => rekeyStore.$.rows.addOne({ id: 7, name: 'A' }));
    await Promise.resolve();
    await Promise.resolve();
    rekeyRestoration.resetRestorationHistory();

    const beforeRekeyToken = rekeyStore.$.rows.byIdOrFail(7).name
      .__subjectIds?.[0] as number;
    undoable(() => rekeyStore.$.rows.changeId(7, 42));
    await Promise.resolve();
    await Promise.resolve();

    const rekeyTurn = rekeyRestoration.getTurns().at(-1) as {
      __positionIds?: number[];
    };
    const rekeyPositionId = rekeyTurn.__positionIds?.[0] as number;
    rekeyStore.undo();
    rekeyStore.redo();
    expect(rekeyStore.$.rows.ids()).toEqual([42]);
    expect(rekeyStore.$.rows.byIdOrFail(42).name.__subjectIds?.[0]).toBe(
      beforeRekeyToken
    );
    expect(rekeyRestoration.getFrontier(rekeyPositionId)).toBe(1);
  });

  it('attaches one stable realization port per tree instance', () => {
    const store = signalTree(
      { count: 0 },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );

    const rootPort = getTreeRealizationPort(store as unknown as object);
    const statePort = getTreeRealizationPort(store.$);

    expect(rootPort).toBeDefined();
    expect(rootPort).toBe(statePort);
    expect(getTreeRealizationPort(store.$)).toBe(statePort);
  });

  it('keeps realization ports independent across tree instances', () => {
    const left = signalTree(
      { count: 0 },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const right = signalTree(
      { count: 0 },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );

    const leftPort = getTreeRealizationPort(left.$);
    const rightPort = getTreeRealizationPort(right.$);

    expect(leftPort).toBeDefined();
    expect(rightPort).toBeDefined();
    expect(leftPort).not.toBe(rightPort);
  });

  it('realizes a supported scalar plus rekey turn entirely through the tree-owned port', async () => {
    const store = signalTree(
      {
        count: 0,
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'A' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    store
      .transaction(() => {
        undoable(() => store.$.count.set(1));
        undoable(() => store.$.rows.changeId(7, 42));
      })
      .confirm();

    await Promise.resolve();
    await Promise.resolve();

    const realizationPort = getTreeRealizationPort(store.$);
    if (!realizationPort) {
      throw new Error('Expected tree-owned realization port');
    }
    const applySpy = vi.spyOn(realizationPort, 'applyAtomically');

    store.undo();

    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(store.$.count()).toBe(0);
    expect(store.$.rows.ids()).toEqual([7]);
  });

  it('realizes a mixed root scalar plus subject scalar turn entirely through the tree-owned port', async () => {
    const store = signalTree(
      {
        count: 0,
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'A' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    store
      .transaction(() => {
        undoable(() => store.$.count.set(1));
        undoable(() => store.$.rows.byIdOrFail(7).name.set('B'));
      })
      .confirm();

    await Promise.resolve();
    await Promise.resolve();

    const realizationPort = getTreeRealizationPort(store.$);
    if (!realizationPort) {
      throw new Error('Expected tree-owned realization port');
    }
    const applySpy = vi.spyOn(realizationPort, 'applyAtomically');

    store.undo();

    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(store.$.count()).toBe(0);
    expect(store.$.rows.byIdOrFail(7).name()).toBe('A');

    store.redo();

    expect(applySpy).toHaveBeenCalledTimes(2);
    expect(store.$.count()).toBe(1);
    expect(store.$.rows.byIdOrFail(7).name()).toBe('B');
  });

  it('resolves subject scalar replay against the current key after rekey', async () => {
    const { getPathNotifier, resetPathNotifier } = await import(
      '../../lib/path-notifier'
    );
    resetPathNotifier();

    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );

    undoable(() => store.$.rows.addOne({ id: 7, name: 'Alice' }));
    await Promise.resolve();
    await Promise.resolve();

    const heldRow = store.$.rows.byIdOrFail(7);
    const heldName = heldRow.name as typeof heldRow.name & {
      __positionIds?: number[];
      __subjectIds?: number[];
    };
    const positionId = heldName.__positionIds?.[0] as number | undefined;
    const subjectId = heldName.__subjectIds?.[0] as number | undefined;
    if (positionId === undefined || subjectId === undefined) {
      throw new Error('Expected subject-owned leaf metadata');
    }

    undoable(() => heldName.set('Alicia'));
    await Promise.resolve();
    await Promise.resolve();

    undoable(() => store.$.rows.changeId(7, 42));
    await Promise.resolve();
    await Promise.resolve();

    const realizationPort = getTreeRealizationPort(store.$);
    if (!realizationPort) {
      throw new Error('Expected tree-owned realization port');
    }

    realizationPort.applyAtomically([
      {
        owner: positionId,
        before: 'Alicia',
        after: 'Alice',
        subjectId,
        path: 'rows.7.name',
        ownerPath: 'rows.7',
      },
    ]);

    expect(store.$.rows.byId(7)).toBeUndefined();
    expect(store.$.rows.byIdOrFail(42).name()).toBe('Alice');
  });

  it('does not resolve a subject scalar descriptor onto a foreign subject that later reuses the key', async () => {
    const store = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );

    undoable(() => store.$.rows.addOne({ id: 7, name: 'Alice' }));
    await Promise.resolve();
    await Promise.resolve();

    const heldRow = store.$.rows.byIdOrFail(7);
    const heldName = heldRow.name as typeof heldRow.name & {
      __positionIds?: number[];
      __subjectIds?: number[];
    };
    const positionId = heldName.__positionIds?.[0] as number | undefined;
    const subjectId = heldName.__subjectIds?.[0] as number | undefined;
    if (positionId === undefined || subjectId === undefined) {
      throw new Error('Expected subject-owned leaf metadata');
    }

    undoable(() => heldName.set('Alicia'));
    await Promise.resolve();
    await Promise.resolve();

    undoable(() => store.$.rows.removeOne(7));
    undoable(() => store.$.rows.addOne({ id: 7, name: 'Bob' }));
    await Promise.resolve();
    await Promise.resolve();

    const foreignSubjectId = store.$.rows.byIdOrFail(7).name
      .__subjectIds?.[0] as number;
    expect(foreignSubjectId).not.toBe(subjectId);

    const realizationPort = getTreeRealizationPort(store.$);
    if (!realizationPort) {
      throw new Error('Expected tree-owned realization port');
    }

    const refusal = realizationPort.validateEffects([
      {
        owner: positionId,
        before: 'Alicia',
        after: 'Alice',
        subjectId,
        path: 'rows.7.name',
        ownerPath: 'rows.7',
      },
    ]);

    expect(refusal?.kind).toBe('structural-drift');
    expect(store.$.rows.byIdOrFail(7).name()).toBe('Bob');
  });

  it('routes a mixed supported scalar plus remove turn entirely through the realization port', async () => {
    const store = signalTree(
      {
        count: 0,
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'A' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    store
      .transaction(() => {
        undoable(() => store.$.count.set(1));
        undoable(() => store.$.rows.removeOne(7));
      })
      .confirm();

    await Promise.resolve();
    await Promise.resolve();

    const turn = t.getTurns().at(-1) as {
      __effects?: Array<
        | {
            kind: 'set';
            position: number;
            before: number;
            after: number;
            path: string;
            ownerPath: string;
          }
        | {
            kind: 'remove';
            position: number;
            subject: number;
            key: number;
            value: { id: number; name: string };
            path: string;
            ownerPath: string;
            beforeSubject?: number;
            afterSubject?: number;
          }
      >;
    };
    const turnEffects = turn.__effects;
    if (!turnEffects || turnEffects.length !== 2) {
      throw new Error(
        'Expected one scalar and one remove effect in the captured turn'
      );
    }

    const realizationPort = getTreeRealizationPort(store.$);
    if (!realizationPort) {
      throw new Error('Expected tree-owned realization port');
    }
    const setEffect = turnEffects.find(
      (
        effect
      ): effect is Extract<(typeof turnEffects)[number], { kind: 'set' }> =>
        effect.kind === 'set'
    );
    const removeEffect = turnEffects.find(
      (
        effect
      ): effect is Extract<(typeof turnEffects)[number], { kind: 'remove' }> =>
        effect.kind === 'remove'
    );
    if (!setEffect || !removeEffect) {
      throw new Error('Expected mixed scalar and remove effects');
    }

    expect(
      realizationPort.validateEffects([
        {
          owner: setEffect.position,
          before: setEffect.after,
          after: setEffect.before,
          path: setEffect.path,
          ownerPath: setEffect.ownerPath,
        },
        {
          owner: removeEffect.position,
          before: undefined,
          after: removeEffect.key,
          subjectId: removeEffect.subject,
          path: removeEffect.path,
          ownerPath: removeEffect.ownerPath,
          structural: 'add',
          structuralContext: {
            kind: 'remove',
            subject: removeEffect.subject,
            key: removeEffect.key,
            value: removeEffect.value,
            beforeSubject: removeEffect.beforeSubject,
            afterSubject: removeEffect.afterSubject,
          },
        },
      ])
    ).toBeUndefined();

    const validateSpy = vi.spyOn(realizationPort, 'validateEffects');
    const applySpy = vi.spyOn(realizationPort, 'applyAtomically');

    store.undo();

    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(store.$.count()).toBe(0);
    expect(store.$.rows.ids()).toEqual([7]);
    expect(store.$.rows.byIdOrFail(7).name()).toBe('A');
  });

  it('does not fall back to legacy realization when a port-capable structural turn semantically refuses', async () => {
    const store = signalTree(
      {
        count: 0,
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration(), transactions()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.rows.addOne({ id: 7, name: 'A' }));
    await Promise.resolve();
    await Promise.resolve();
    t.resetRestorationHistory();

    store
      .transaction(() => {
        undoable(() => store.$.count.set(1));
        undoable(() => store.$.rows.removeOne(7));
      })
      .confirm();

    await Promise.resolve();
    await Promise.resolve();

    const realizationPort = getTreeRealizationPort(store.$);
    if (!realizationPort) {
      throw new Error('Expected tree-owned realization port');
    }

    const validateSpy = vi
      .spyOn(realizationPort, 'validateEffects')
      .mockReturnValue({ kind: 'structural-drift' });
    const applySpy = vi.spyOn(realizationPort, 'applyAtomically');

    expect(() => store.undo()).toThrow(
      'Unsupported scoped undo effect at structural-drift'
    );

    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(applySpy).not.toHaveBeenCalled();
    expect(store.$.count()).toBe(1);
    expect(store.$.rows.ids()).toEqual([]);
    expect(store.canUndo()).toBe(true);
  });

  it('routes public redo sequentially through turn history using turn/frontier authority', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        trucks: entityMap<{ id: number; driverId: number | null }, number>({
          selectId: (row) => row.id,
        }),
        orders: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const t = (store as any).__restoration;

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    undoable(() => store.$.trucks.addOne({ id: 12, driverId: null }));
    undoable(() => store.$.orders.addOne({ id: 99, status: 'new' }));
    await Promise.resolve();
    await Promise.resolve();

    t.resetRestorationHistory();

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    undoable(() => store.$.trucks.byIdOrFail(12).driverId.set(7));
    await Promise.resolve();
    await Promise.resolve();
    const firstTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('loading'));
    undoable(() => store.$.orders.byIdOrFail(99).status.set('queued'));
    await Promise.resolve();
    await Promise.resolve();
    const secondTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };

    store.undo();
    store.undo();

    const orderPositionId = (secondTurn.__positionIds ?? []).find(
      (positionId: number) =>
        positionId !== (firstTurn.__positionIds?.[0] as number)
    ) as number;
    expect(t.getFrontier(orderPositionId)).toBe(0);

    store.redo();

    expect(store.$.drivers.byIdOrFail(7).status()).toBe('assigned');
    expect(store.$.trucks.byIdOrFail(12).driverId()).toBe(7);
    expect(store.$.orders.byIdOrFail(99).status()).toBe('new');
    expect(t.getAppliedTurnIdsForPosition(orderPositionId)).toEqual([]);

    store.redo();

    expect(store.$.drivers.byIdOrFail(7).status()).toBe('loading');
    expect(store.$.trucks.byIdOrFail(12).driverId()).toBe(7);
    expect(store.$.orders.byIdOrFail(99).status()).toBe('queued');
    expect(t.getTurnStatus(firstTurn.id)).toBe('applied');
    expect(t.getTurnStatus(secondTurn.id)).toBe('applied');
    expect(t.getAppliedTurnIdsForPosition(orderPositionId)).toEqual([
      secondTurn.id,
    ]);
  });

  it('allows public canUndo and canRedo to both be true when an earlier turn is unapplied and a later turn remains applied', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        orders: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    undoable(() => store.$.orders.addOne({ id: 99, status: 'new' }));
    await Promise.resolve();
    await Promise.resolve();

    const t = (store as any).__restoration;
    t.resetRestorationHistory();

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    await Promise.resolve();
    await Promise.resolve();
    const firstTurn = t.getTurns().at(-1) as { __positionIds?: number[] };

    undoable(() => store.$.orders.byIdOrFail(99).status.set('queued'));
    await Promise.resolve();
    await Promise.resolve();
    const secondTurn = t.getTurns().at(-1) as {
      __positionIds?: number[];
      id: number;
    };

    const firstPositionId = firstTurn.__positionIds?.[0] as number;

    t.undoPosition(firstPositionId);

    expect(store.$.drivers.byIdOrFail(7).status()).toBe('idle');
    expect(store.$.orders.byIdOrFail(99).status()).toBe('queued');
    expect(t.getTurnStatus(secondTurn.id)).toBe('applied');
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(true);
  });

  it('keeps confirmed frontiers causal while jumpTo answers a temporal snapshot question', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        trucks: entityMap<{ id: number; driverId: number | null }, number>({
          selectId: (row) => row.id,
        }),
        orders: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    undoable(() => store.$.trucks.addOne({ id: 12, driverId: null }));
    undoable(() => store.$.orders.addOne({ id: 99, status: 'new' }));
    await Promise.resolve();
    await Promise.resolve();

    const t = (store as any).__restoration;
    t.resetRestorationHistory();

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    undoable(() => store.$.trucks.byIdOrFail(12).driverId.set(7));
    await Promise.resolve();
    await Promise.resolve();
    const firstTurn = t.getTurns().at(-1) as {
      id: number;
      historyIndex: number;
      __positionIds?: number[];
    };

    undoable(() => store.$.orders.byIdOrFail(99).status.set('queued'));
    await Promise.resolve();
    await Promise.resolve();
    const secondTurn = t.getTurns().at(-1) as { id: number };

    const truckPositionId = (firstTurn.__positionIds ?? []).find(
      (positionId: number) =>
        positionId !== (firstTurn.__positionIds?.[0] as number)
    ) as number;

    expect(t.undoPosition(truckPositionId)).toEqual([firstTurn.id]);

    expect(store.$.drivers.byIdOrFail(7).status()).toBe('idle');
    expect(store.$.trucks.byIdOrFail(12).driverId()).toBeNull();
    expect(store.$.orders.byIdOrFail(99).status()).toBe('queued');
    expect(t.getTurnStatus(firstTurn.id)).toBe('unapplied');
    expect(t.getTurnStatus(secondTurn.id)).toBe('applied');
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(true);

    store.jumpTo(firstTurn.historyIndex);

    expect(store.getCurrentIndex()).toBe(firstTurn.historyIndex);
    expect(store.$.drivers.byIdOrFail(7).status()).toBe('assigned');
    expect(store.$.trucks.byIdOrFail(12).driverId()).toBe(7);
    expect(store.$.orders.byIdOrFail(99).status()).toBe('new');
    expect(t.getTurnStatus(firstTurn.id)).toBe('unapplied');
    expect(t.getTurnStatus(secondTurn.id)).toBe('applied');
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(true);
  });

  it('preserves confirmed frontiers and turn status across repeated temporal jumpTo excursions', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        orders: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    undoable(() => store.$.orders.addOne({ id: 99, status: 'new' }));
    await Promise.resolve();
    await Promise.resolve();

    const t = (store as any).__restoration;
    t.resetRestorationHistory();

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    await Promise.resolve();
    await Promise.resolve();
    const firstTurn = t.getTurns().at(-1) as {
      id: number;
      historyIndex: number;
      __positionIds?: number[];
    };

    undoable(() => store.$.orders.byIdOrFail(99).status.set('queued'));
    await Promise.resolve();
    await Promise.resolve();
    const secondTurn = t.getTurns().at(-1) as {
      id: number;
      historyIndex: number;
      __positionIds?: number[];
    };

    const driverPositionId = firstTurn.__positionIds?.[0] as number;

    t.undoPosition(driverPositionId);

    const baselineFrontier = t.getFrontier(driverPositionId);
    const baselineFirstStatus = t.getTurnStatus(firstTurn.id);
    const baselineSecondStatus = t.getTurnStatus(secondTurn.id);
    const baselineCanUndo = store.canUndo();
    const baselineCanRedo = store.canRedo();

    expect(baselineFrontier).toBe(0);
    expect(baselineFirstStatus).toBe('unapplied');
    expect(baselineSecondStatus).toBe('applied');
    expect(baselineCanUndo).toBe(true);
    expect(baselineCanRedo).toBe(true);

    store.jumpTo(firstTurn.historyIndex);
    expect(store.$.drivers.byIdOrFail(7).status()).toBe('assigned');
    expect(store.$.orders.byIdOrFail(99).status()).toBe('new');
    expect(t.getFrontier(driverPositionId)).toBe(baselineFrontier);
    expect(t.getTurnStatus(firstTurn.id)).toBe(baselineFirstStatus);
    expect(t.getTurnStatus(secondTurn.id)).toBe(baselineSecondStatus);
    expect(store.canUndo()).toBe(baselineCanUndo);
    expect(store.canRedo()).toBe(baselineCanRedo);

    store.jumpTo(secondTurn.historyIndex);
    expect(store.$.drivers.byIdOrFail(7).status()).toBe('assigned');
    expect(store.$.orders.byIdOrFail(99).status()).toBe('queued');
    expect(t.getFrontier(driverPositionId)).toBe(baselineFrontier);
    expect(t.getTurnStatus(firstTurn.id)).toBe(baselineFirstStatus);
    expect(t.getTurnStatus(secondTurn.id)).toBe(baselineSecondStatus);
    expect(store.canUndo()).toBe(baselineCanUndo);
    expect(store.canRedo()).toBe(baselineCanRedo);

    store.jumpTo(firstTurn.historyIndex);
    expect(store.$.drivers.byIdOrFail(7).status()).toBe('assigned');
    expect(store.$.orders.byIdOrFail(99).status()).toBe('new');
    expect(t.getFrontier(driverPositionId)).toBe(baselineFrontier);
    expect(t.getTurnStatus(firstTurn.id)).toBe(baselineFirstStatus);
    expect(t.getTurnStatus(secondTurn.id)).toBe(baselineSecondStatus);
    expect(store.canUndo()).toBe(baselineCanUndo);
    expect(store.canRedo()).toBe(baselineCanRedo);

    store.redo();

    expect(store.$.drivers.byIdOrFail(7).status()).toBe('assigned');
    expect(store.$.orders.byIdOrFail(99).status()).toBe('queued');
    expect(t.getFrontier(driverPositionId)).toBe(1);
    expect(t.getTurnStatus(firstTurn.id)).toBe('applied');
    expect(t.getTurnStatus(secondTurn.id)).toBe('applied');
  });

  it('clears public redo availability when a new confirmed write truncates the abandoned future in a mixed frontier state', async () => {
    const store = signalTree(
      {
        drivers: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
        orders: entityMap<{ id: number; status: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );

    undoable(() => store.$.drivers.addOne({ id: 7, status: 'idle' }));
    undoable(() => store.$.orders.addOne({ id: 99, status: 'new' }));
    await Promise.resolve();
    await Promise.resolve();

    const t = (store as any).__restoration;
    t.resetRestorationHistory();

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('assigned'));
    await Promise.resolve();
    await Promise.resolve();
    const firstTurn = t.getTurns().at(-1) as {
      id: number;
      __positionIds?: number[];
    };

    undoable(() => store.$.orders.byIdOrFail(99).status.set('queued'));
    await Promise.resolve();
    await Promise.resolve();
    const secondTurn = t.getTurns().at(-1) as { id: number };

    const firstPositionId = firstTurn.__positionIds?.[0] as number;

    t.undoPosition(firstPositionId);
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(true);

    undoable(() => store.$.drivers.byIdOrFail(7).status.set('loading'));
    await Promise.resolve();
    await Promise.resolve();

    const remainingTurnIds = t
      .getTurns()
      .map((turn: { id: number }) => turn.id);

    expect(store.$.drivers.byIdOrFail(7).status()).toBe('loading');
    expect(store.$.orders.byIdOrFail(99).status()).toBe('queued');
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(false);
    expect(remainingTurnIds).not.toContain(firstTurn.id);
    expect(remainingTurnIds).toContain(secondTurn.id);
  });

  it('does not record unrelated writes from another tree that shares top-level keys', async () => {
    const first = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );
    const second = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );

    const firstBaseline = first.getRestorationHistory().length;
    const secondBaseline = second.getRestorationHistory().length;

    undoable(() => first.$.rows.addOne({ id: 1, name: 'A' }));
    await Promise.resolve();
    await Promise.resolve();

    expect(first.getRestorationHistory().length).toBeGreaterThan(firstBaseline);
    expect(second.getRestorationHistory().length).toBe(secondBaseline);
    expect(second.canUndo()).toBe(false);
  });
});
