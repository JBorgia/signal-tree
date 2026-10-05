import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { getMutationCaptureRuntime } from '../../lib/internals/mutation-capture-runtime';
import { getPathNotifier } from '../../lib/path-notifier';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * v16 controls for slice 4 of the v15 → v16 integration (restoration admission
 * of pending work before delivery). The carried v15 fixtures pass with more
 * than one mechanism; these separate them:
 *
 * - the enqueue witness, not a read of the queue at admission time: a write
 *   already dequeued for delivery to an EARLIER subscriber is still owned;
 * - committed entity capture, not the enqueue witness alone: with notifier
 *   batching off, the first row of a multi-row commit is delivered before the
 *   next row is enqueued;
 * - a history reset is not a settlement of pending ownership.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe.each([false, true])(
  'pending restoration admission (transactions first=%s)',
  (transactionsFirst) => {
    const enhancers = () =>
      transactionsFirst
        ? [transactions(), restoration()]
        : [restoration(), transactions()];

    it('refuses an undo re-entered from an earlier subscriber of the pending write', async () => {
      let reenter: (() => void) | undefined;
      // Subscribed before the tree exists, so it precedes both enhancers.
      const off = getPathNotifier().subscribe('x', (value) => {
        if (value === 2) reenter?.();
      });
      const tree = signalTree({ x: 0 }, { enhancers: enhancers() });
      try {
        undoable(() => tree.$.x(1));
        await flush();
        const index = tree.getCurrentIndex();
        const failures: unknown[] = [];
        reenter = () => {
          reenter = undefined;
          try {
            tree.undo();
          } catch (error) {
            failures.push(error);
          }
        };
        const pending = tree.transact(() => tree.$.x(2));
        expect(failures).toHaveLength(1);
        expect(String(failures[0])).toMatch(/ST1034/);
        expect(tree.$.x()).toBe(2);
        expect(tree.getCurrentIndex()).toBe(index);
        pending.rollback();
        tree.undo();
        expect(tree.$.x()).toBe(0);
      } finally {
        reenter = undefined;
        off();
        tree.destroy();
      }
    });

    it('owns every committed row before the first unbatched delivery re-enters', async () => {
      const notifier = getPathNotifier();
      const previousBatching = notifier.isBatchingEnabled();
      let reenter: (() => void) | undefined;
      const off = notifier.subscribe('rows.a', (value) => {
        if ((value as { n?: number } | undefined)?.n === 2) reenter?.();
      });
      const tree = signalTree(
        {
          rows: entityMap<{ id: string; n: number }, string>({
            selectId: (row) => row.id,
          }),
        },
        { enhancers: enhancers() }
      );
      try {
        tree.$.rows.setAll([
          { id: 'a', n: 0 },
          { id: 'b', n: 0 },
        ]);
        await flush();
        undoable(() => tree.$.rows.updateOne('b', { n: 1 }));
        await flush();
        notifier.setBatchingEnabled(false);
        let failure: unknown;
        reenter = () => {
          reenter = undefined;
          try {
            tree.undo();
          } catch (error) {
            failure = error;
          }
        };
        const pending = tree.transact(() =>
          tree.$.rows.updateMany(['a', 'b'], { n: 2 })
        );
        expect(String(failure)).toMatch(/ST1034/);
        expect(tree.$.rows.all()).toEqual([
          { id: 'a', n: 2 },
          { id: 'b', n: 2 },
        ]);
        pending.rollback();
        expect(tree.$.rows.all()).toEqual([
          { id: 'a', n: 0 },
          { id: 'b', n: 1 },
        ]);
      } finally {
        reenter = undefined;
        off();
        tree.destroy();
        notifier.setBatchingEnabled(previousBatching);
      }
    });

    it('keeps staged pending ownership across a history reset', async () => {
      const tree = signalTree({ x: 0 }, { enhancers: enhancers() });
      try {
        const pending = tree.transact(() => tree.$.x(1));
        tree.resetRestorationHistory();
        undoable(() => tree.$.x(2));
        await flush();
        expect(() => tree.undo()).toThrow(/ST1034/);
        expect(tree.$.x()).toBe(2);
        pending.confirm();
        tree.undo();
        expect(tree.$.x()).toBe(1);
      } finally {
        tree.destroy();
      }
    });

    it('keeps a still-open transaction speculative across a reset inside its callback', async () => {
      const tree = signalTree({ x: 0 }, { enhancers: enhancers() });
      try {
        const pending = tree.transact(() => {
          tree.resetRestorationHistory();
          undoable(() => tree.$.x(2));
        });
        await flush();
        // Still pending: not confirmed history.
        expect(tree.canUndo()).toBe(false);
        pending.rollback();
        await flush();
        expect(tree.$.x()).toBe(0);
        expect(tree.canUndo()).toBe(false);
      } finally {
        tree.destroy();
      }
    });

    it('installs pending observation only while a foreign transaction is open or pending', async () => {
      const tree = signalTree(
        {
          rows: entityMap<{ id: string; n: number }, string>({
            selectId: (row) => row.id,
          }),
        },
        { enhancers: enhancers() }
      );
      const runtime = getMutationCaptureRuntime(tree);
      try {
        tree.$.rows.addOne({ id: 'a', n: 0 });
        undoable(() => tree.$.rows.updateOne('a', { n: 1 }));
        await flush();
        expect(runtime?.hasCommittedEntityObservers?.()).toBe(false);
        const first = tree.transact(() => tree.$.rows.updateOne('a', { n: 2 }));
        const second = tree.transact(() =>
          tree.$.rows.addOne({ id: 'b', n: 0 })
        );
        first.confirm();
        // One owner still pending.
        expect(runtime?.hasCommittedEntityObservers?.()).toBe(true);
        second.rollback();
        expect(runtime?.hasCommittedEntityObservers?.()).toBe(false);
      } finally {
        tree.destroy();
      }
    });
  }
);
