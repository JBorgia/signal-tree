import { describe, expect, it, vi } from 'vitest';

import { confirmedTurnReader, observeWrites } from '../../internals';
import {
  transactionLifecycleReader,
  type TransactionLifecycleObservation,
} from '../../lib/internals/transaction-lifecycle-view';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restoration } from '../restoration/restoration';
import { peekInternalTransactionRuntime, transactions } from './transactions';

const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

describe('ordinary confirmed record materialization', () => {
  it.each([0, 1, 0.5])(
    'clones effects only for the drain and live retention (retain=%s)',
    async (retain) => {
      const rows = Array.from({ length: 32 }, (_, id) => ({ id, value: id }));
      const tree = signalTree(
        {
          rows: entityMap<{ id: number; value: number }, number>({
            selectId: (row) => row.id,
          }),
        },
        { enhancers: [transactions({ history: { retain } })] }
      );
      await flush();
      let clonedEffects = 0;
      const originalMap = Array.prototype.map;
      // Count only this named effect-copy mechanism, not elapsed time or all
      // allocations. The retained controls prove that the hook is exercised.
      try {
        const spy = vi
          .spyOn(Array.prototype, 'map')
          .mockImplementation(function (this: unknown[], callback, thisArg) {
            if (callback.name === 'cloneTurnEffect')
              clonedEffects += this.length;
            return originalMap.call(this, callback, thisArg);
          });
        try {
          tree.$.rows.setAll(rows);
          await flush();
        } finally {
          spy.mockRestore();
        }
        expect(tree.$.rows.all()).toEqual(rows);
        // Draining still clones every add effect. With no obligation, the
        // authority must not make another copy merely to discard its record.
        expect(clonedEffects).toBe(rows.length * (retain === 0 ? 1 : 2));
        const snapshot = confirmedTurnReader(tree)?.readConfirmedTurns();
        expect(snapshot?.turns).toHaveLength(retain === 0 ? 0 : 1);
        expect(snapshot?.retention.truncated).toBe(retain === 0);
        if (retain > 0) {
          expect(snapshot?.turns[0].effects).toHaveLength(rows.length);
        }
      } finally {
        tree.destroy();
      }
    }
  );

  it('preserves reader observations, empty writes and subsequent turn IDs', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const reader = confirmedTurnReader(tree);
    const runtime = peekInternalTransactionRuntime(tree);
    const observations: Array<{
      value: unknown;
      truncated: boolean | undefined;
    }> = [];
    const off = observeWrites((frame) => {
      if (frame.path === 'x') {
        observations.push({
          value: frame.after,
          truncated: reader?.readConfirmedTurns().retention.truncated,
        });
      }
    });
    try {
      expect(reader?.readConfirmedTurns().retention.truncated).toBe(false);
      tree.$.x(0);
      await flush();
      expect(reader?.readConfirmedTurns().retention.truncated).toBe(false);
      tree.$.x(1);
      await flush();
      tree.$.x(2);
      await flush();
      expect(observations).toEqual([
        { value: 1, truncated: false },
        { value: 2, truncated: true },
      ]);
      expect(reader?.readConfirmedTurns().turns).toEqual([]);
      expect(reader?.readConfirmedTurns().retention).toEqual({
        truncated: true,
        firstAvailableTurnId: undefined,
      });
      const pending = tree.transaction(() => tree.$.y(1));
      expect(runtime?.getPendingTurnIds()).toEqual([3]);
      tree.$.x(3);
      await flush();
      expect(runtime?.getConfirmedTurnIds()).toEqual([4]);
      pending.rollback();
      expect(tree.$.y()).toBe(0);
      expect(tree.$.x()).toBe(3);
      expect(runtime?.getConfirmedTurnIds()).toEqual([]);
    } finally {
      off();
      tree.destroy();
    }
  });

  it.each(['confirm', 'rollback'] as const)(
    'keeps lifecycle IDs and emission snapshots separate from ledger IDs (%s)',
    async (settle) => {
      const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
      const reader = transactionLifecycleReader(tree);
      if (!reader) throw new Error('Expected installed lifecycle reader');
      const initial = reader.snapshot();
      const events: TransactionLifecycleObservation[] = [];
      const off = reader.subscribe((event) => events.push(event));
      try {
        tree.$.x(1);
        await flush();
        tree.$.x(2);
        await flush();
        expect(events).toEqual([]);
        expect(reader.snapshot()).toEqual(initial);
        const pending = tree.transaction(() => tree.$.y(1));
        expect(
          peekInternalTransactionRuntime(tree)?.getPendingTurnIds()
        ).toEqual([3]);
        expect(reader.snapshot()).toEqual({
          ...initial,
          sequence: 2,
          pending: [
            { transactionId: 1, phase: 'staged', consequencesReleased: false },
          ],
        });
        pending[settle]();
        expect(events).toEqual([
          ...(['opened', 'staged'] as const).map((kind, index) => ({
            kind,
            transactionId: 1,
            treeId: initial.treeId,
            sequence: index + 1,
            snapshot: {
              ...initial,
              sequence: index + 1,
              pending: [
                { transactionId: 1, phase: kind, consequencesReleased: false },
              ],
            },
          })),
          {
            kind: settle === 'confirm' ? 'confirmed' : 'rolled-back',
            transactionId: 1,
            treeId: initial.treeId,
            sequence: 3,
            snapshot: { ...initial, sequence: 3, pending: [] },
          },
        ]);
        expect(reader.snapshot()).toEqual({
          ...initial,
          sequence: 3,
          pending: [],
        });
        expect(
          confirmedTurnReader(tree)?.readConfirmedTurns().retention
        ).toEqual({
          truncated: true,
          firstAvailableTurnId: undefined,
        });
        expect(tree.$()).toEqual({ x: 2, y: settle === 'confirm' ? 1 : 0 });
      } finally {
        off();
        tree.destroy();
      }
    }
  );

  it.each([false, true])(
    'preserves same-turn promotion (restoration first=%s)',
    async (first) => {
      const tree = signalTree(
        { a: 0, b: 0 },
        {
          enhancers: first
            ? [restoration(), transactions()]
            : [transactions(), restoration()],
        }
      );
      try {
        tree.$.a(1);
        undoable(() => tree.$.b(2));
        await flush();
        expect(tree.getRestorationHistory()).toHaveLength(1);
        tree.undo();
        expect(tree.$()).toEqual({ a: 0, b: 0 });
        tree.redo();
        expect(tree.$()).toEqual({ a: 1, b: 2 });
      } finally {
        tree.destroy();
      }
    }
  );
});
