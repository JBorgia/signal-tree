import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restorationReader } from '../../lib/internals/restoration-reader';
import { transactionLifecycleReader } from '../../lib/internals/transaction-lifecycle-view';
import {
  peekInternalTransactionRuntime,
  transactions,
} from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * v16 controls for the restoration reader (v15 → v16 integration, slice 6).
 *
 * On v16 a refused rollback keeps the transaction pending (contract 2), so its
 * staged restoration entry stays pending as well: the reader must not show it
 * as retained until real settlement, and must then record only the relation
 * the owner recorded.
 */
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe.each([
  ['transactions, restoration', () => [transactions(), restoration()]],
  ['restoration, transactions', () => [restoration(), transactions()]],
] as const)(
  'restoration reader under v16 refusal (%s)',
  (_order, enhancers) => {
    it('a refused rollback keeps its entry pending and unreported; confirmation retains it with its transaction', async () => {
      const tree = signalTree({ x: 0 }, { enhancers: enhancers() });
      try {
        const reader = restorationReader(tree)!;
        const lifecycle = transactionLifecycleReader(tree)!;
        const older = tree.transact(() => undoable(() => tree.$.x(1)));
        const olderId = lifecycle.snapshot().pending[0].transactionId;
        const later = tree.transact(() => undoable(() => tree.$.x(2)));
        expect(() => older.rollback()).toThrow(/later-confirmed-dependency/);
        // Authority is still pending; no entry is retained for either turn.
        expect(lifecycle.snapshot().pending).toHaveLength(2);
        expect(reader.snapshot().entries).toEqual([]);
        const events: unknown[] = [];
        reader.subscribe((event) => events.push(event));
        // Nothing is retained yet, so there is nothing to undo.
        tree.undo();
        expect(events.at(-1)).toMatchObject({
          kind: 'operation',
          operation: 'undo',
          outcome: 'noop',
          affectedEntryIds: [],
        });
        older.confirm();
        later.confirm();
        await flush();
        const entries = reader.snapshot().entries;
        expect(entries.map((entry) => entry.transactionIds)).toEqual([
          [olderId],
          [olderId + 1],
        ]);
        expect(entries.every((entry) => entry.status === 'applied')).toBe(true);
        expect(
          peekInternalTransactionRuntime(tree)!.getPendingTurnCount()
        ).toBe(0);
        expect(events.map((event) => (event as { kind: string }).kind)).toEqual(
          expect.arrayContaining(['history-changed'])
        );
      } finally {
        tree.destroy();
      }
    });

    it('an undo refused over a pending overlap is reported as refused, not failed', async () => {
      const tree = signalTree({ x: 0 }, { enhancers: enhancers() });
      try {
        undoable(() => tree.$.x(1));
        await flush();
        const reader = restorationReader(tree)!;
        const events: { kind: string; outcome?: string }[] = [];
        reader.subscribe((event) =>
          events.push({
            kind: event.kind,
            ...(event.kind === 'operation' ? { outcome: event.outcome } : {}),
          })
        );
        const pending = tree.transact(() => tree.$.x(5));
        expect(() => tree.undo()).toThrow(/ST1034/);
        expect(events.at(-1)).toEqual({
          kind: 'operation',
          outcome: 'refused',
        });
        expect(tree.$.x()).toBe(5);
        pending.rollback();
        tree.undo();
        expect(events.at(-1)).toEqual({
          kind: 'operation',
          outcome: 'applied',
        });
        expect(tree.$.x()).toBe(0);
      } finally {
        tree.destroy();
      }
    });
  }
);
