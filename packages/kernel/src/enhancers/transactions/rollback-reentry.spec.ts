import { describe, expect, it, vi } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restorationReader } from '../../lib/internals/restoration-reader';
import { transactionLifecycleReader } from '../../lib/internals/transaction-lifecycle-view';
import { restoration } from '../restoration/restoration';
import { peekInternalTransactionRuntime, transactions } from './transactions';

// A subscriber of rollback()'s compensation writes runs while the turn is still
// pending. Confirming there committed a transaction whose writes were being
// reversed: the reader emitted confirmed then rolled-back, restoration kept an
// applied entry for state that no longer existed, and redo re-applied the
// rolled-back write. Rolling back again there emitted rolled-back twice.
describe.each([
  ['transactions, restoration', () => [transactions(), restoration()]],
  ['restoration, transactions', () => [restoration(), transactions()]],
] as const)(
  'settling a transaction during its own compensation (%s)',
  (_order, enhancers) => {
    for (const reentry of ['confirm', 'rollback'] as const) {
      it(`refuses ${reentry}() from a compensation subscriber and keeps history coherent`, () => {
        const error = vi
          .spyOn(console, 'error')
          .mockImplementation(() => undefined);
        const tree = signalTree({ x: 0 }, { enhancers: enhancers() });
        const runtime = peekInternalTransactionRuntime(tree)!;
        const kinds: string[] = [];
        transactionLifecycleReader(tree)!.subscribe((event) =>
          kinds.push(event.kind)
        );
        let pending: ReturnType<typeof tree.transaction> | undefined;
        let reentryError: unknown;
        const stop = tree.$.x.subscribe(() => {
          if (!pending || tree.$.x() !== 0 || reentryError) return;
          try {
            pending[reentry]();
          } catch (failure) {
            reentryError = failure;
          }
        });
        try {
          pending = tree.transaction(() => undoable(() => tree.$.x(1)));
          pending.rollback();
          stop();
          expect(String(reentryError)).toMatch(
            /while its rollback is being applied/
          );
          expect(kinds).toEqual(['opened', 'staged', 'rolled-back']);
          expect(tree.$.x()).toBe(0);
          expect(runtime.getPendingTurnCount()).toBe(0);
          expect(transactionLifecycleReader(tree)!.snapshot().pending).toEqual(
            []
          );
          expect(restorationReader(tree)!.snapshot().entries).toEqual([]);
          tree.redo();
          expect(tree.$.x()).toBe(0);
          // The handle is terminal and still answers as a rolled-back one.
          expect(() => pending!.confirm()).toThrow(/rolled back/);
        } finally {
          stop();
          error.mockRestore();
          tree.destroy();
        }
      });
    }

    it('still permits confirm after a refused rollback', () => {
      const tree = signalTree({ x: 0 }, { enhancers: enhancers() });
      try {
        const older = tree.transaction(() => tree.$.x(1));
        const later = tree.transaction(() => tree.$.x(2));
        expect(() => older.rollback()).toThrow(/later-pending-dependency/);
        older.confirm();
        later.confirm();
        expect(tree.$.x()).toBe(2);
        expect(transactionLifecycleReader(tree)!.snapshot().pending).toEqual(
          []
        );
      } finally {
        tree.destroy();
      }
    });
  }
);
