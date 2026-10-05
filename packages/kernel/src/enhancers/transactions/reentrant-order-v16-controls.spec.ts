import { describe, expect, it, vi } from 'vitest';

import { observeWrites } from '../../internals';
import { entityMap } from '../../lib/markers/entity-map';
import { getPathNotifier } from '../../lib/path-notifier';
import { signalTree } from '../../lib/signal-tree';
import { peekInternalTransactionRuntime, transactions } from './transactions';

/**
 * v16 controls for slice 4 of the v15 → v16 integration (reserved turn order
 * and open entity capture). The carried v15 fixtures check ordering and
 * refusal; these check that the reordering composes with v16-only contracts:
 * the recovery handle on a refused automatic compensation (contract 2), and
 * the PLAN's slice-4 falsifier — an observer settles another transaction
 * during capture, unrelated rows stay reversible, a conflicting row keeps its
 * refusal authority, and compensation still notifies.
 */

type Recovery = {
  transaction: { confirm(): void; rollback(): void; inspect(): unknown };
  callbackFailed: boolean;
  callbackError: unknown;
};

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('reserved transaction order under v16 recovery', () => {
  it('a later replacing write supersedes the failed contribution: terminal, no recovery', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const failure = new Error('callback failed');
    let armed = true;
    const off = observeWrites((frame) => {
      if (!armed || frame.path !== 'x' || frame.after !== 1) return;
      armed = false;
      tree.$.x(2);
    });
    try {
      let thrown: unknown;
      try {
        tree.transact(() => {
          tree.$.x(1);
          throw failure;
        });
      } catch (error) {
        thrown = error;
      }
      await flush();
      // L3/L4: removing the contribution leaves the later write in place.
      // Before the order reservation the write sorted EARLIER and was erased.
      expect(tree.$.x()).toBe(2);
      expect(thrown).toBe(failure);
      expect((thrown as { recovery?: Recovery }).recovery).toBeUndefined();
      expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(
        0
      );
    } finally {
      off();
      tree.destroy();
    }
  });

  it('a later dependent row write refuses the automatic compensation and keeps a usable recovery handle', async () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; value: number }, string>() },
      { enhancers: [transactions()] }
    );
    tree.$.rows.addOne({ id: 'a', value: 0 });
    await flush();
    const failure = new Error('callback failed');
    let armed = true;
    const off = observeWrites((frame) => {
      if (!armed || !frame.path.startsWith('rows')) return;
      armed = false;
      tree.$.rows.updateOne('a', { value: 2 });
    });
    try {
      let thrown: unknown;
      try {
        tree.transact(() => {
          tree.$.rows.updateOne('a', { value: 1 });
          throw failure;
        });
      } catch (error) {
        thrown = error;
      }
      await flush();
      expect(tree.$.rows.byIdOrFail('a').value()).toBe(2);
      expect(String(thrown)).toMatch(/later-confirmed-dependency/);
      const recovery = (thrown as { recovery?: Recovery }).recovery;
      expect(recovery).toBeDefined();
      expect(recovery?.callbackFailed).toBe(true);
      expect(recovery?.callbackError).toBe(failure);
      // L2: authority was conserved, not recorded as committed.
      expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(
        1
      );
      recovery?.transaction.confirm();
      expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(
        0
      );
      expect(tree.$.rows.byIdOrFail('a').value()).toBe(2);
    } finally {
      off();
      tree.destroy();
    }
  });

  it('a reservation does not outlive a callback that wrote nothing', () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const runtime = peekInternalTransactionRuntime(tree);
    try {
      let inside = -1;
      tree
        .transact(() => {
          inside = runtime?.getPendingTurnCount() ?? -1;
        })
        .confirm();
      // The reservation is visible while the callback runs, and gone after.
      expect(inside).toBe(1);
      expect(runtime?.getPendingTurnCount()).toBe(0);
    } finally {
      tree.destroy();
    }
  });
});

describe('a post-callback failure before materialization', () => {
  it('does not strand the reservation as a permanent minimum pending id', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const runtime = peekInternalTransactionRuntime(tree);
    const notifier = getPathNotifier();
    const flushSync = notifier.flushSync.bind(notifier);
    let armed = false;
    const failure = new Error('flush failed');
    const spy = vi.spyOn(notifier, 'flushSync').mockImplementation(() => {
      if (armed) {
        armed = false;
        throw failure;
      }
      flushSync();
    });
    try {
      expect(() =>
        tree.transact(() => {
          tree.$.x(1);
          armed = true;
        })
      ).toThrow(failure);
      spy.mockRestore();
      expect(runtime?.getPendingTurnCount()).toBe(0);
      // A stranded minimum pending id would keep this confirmed record (and
      // every later one) as a correctness obligation forever.
      tree.$.x(2);
      await flush();
      expect(runtime?.getConfirmedTurnCount()).toBe(0);
    } finally {
      spy.mockRestore();
      tree.destroy();
    }
  });
});

describe('an observer settles another transaction during capture', () => {
  type Row = { id: string; n: number; m: number };
  const make = () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
      { enhancers: [transactions()] }
    );
    tree.$.rows.setAll([
      { id: 'a', n: 0, m: 0 },
      { id: 'b', n: 0, m: 0 },
    ]);
    return tree;
  };

  it('keeps the unrelated row reversible and notifies its compensation', async () => {
    const tree = make();
    await flush();
    let armed = true;
    const off = observeWrites((frame) => {
      if (!armed || frame.path !== 'rows.a') return;
      armed = false;
      tree.transact(() => tree.$.rows.updateOne('b', { n: 7 })).confirm();
    });
    const delivered = vi.fn();
    try {
      const pending = tree.transact(() => tree.$.rows.updateOne('a', { n: 1 }));
      expect(armed).toBe(false);
      await flush();
      const unsubscribe = getPathNotifier().subscribe('rows.a', delivered);
      try {
        pending.rollback();
        await flush();
      } finally {
        unsubscribe();
      }
      expect(tree.$.rows.all()).toEqual([
        { id: 'a', n: 0, m: 0 },
        { id: 'b', n: 7, m: 0 },
      ]);
      expect(delivered).toHaveBeenCalled();
    } finally {
      off();
      tree.destroy();
    }
  });

  it('keeps refusal authority on the conflicting field', async () => {
    const tree = make();
    await flush();
    let armed = true;
    const off = observeWrites((frame) => {
      if (!armed || frame.path !== 'rows.a') return;
      armed = false;
      tree.transact(() => tree.$.rows.updateOne('a', { n: 7 })).confirm();
    });
    try {
      const pending = tree.transact(() =>
        tree.$.rows.updateOne('a', { n: 1, m: 1 })
      );
      await flush();
      expect(() => pending.rollback()).toThrow(/later-confirmed-dependency/);
      expect(tree.$.rows.byIdOrFail('a')()).toEqual({ id: 'a', n: 7, m: 1 });
      expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(
        1
      );
      pending.confirm();
      expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(
        0
      );
    } finally {
      off();
      tree.destroy();
    }
  });
});
