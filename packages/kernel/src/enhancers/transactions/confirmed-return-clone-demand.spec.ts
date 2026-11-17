import { expect, it, vi } from 'vitest';

import { confirmedTurnReader } from '../../internals';
import { entityMap } from '../../lib/markers/entity-map';
import { getPathNotifier } from '../../lib/path-notifier';
import { signalTree } from '../../lib/signal-tree';
import { peekInternalTransactionRuntime, transactions } from './transactions';

// Observe actual effect-copy callbacks, with a positive retained/build control.
// Stack filtering is diagnostic-only; no timing claims use this fixture.
function countRecordCopies(work: () => void) {
  const counts = { returnedOrdinary: 0, built: 0, returnedPending: 0 };
  const originalMap = Array.prototype.map;
  const spy = vi
    .spyOn(Array.prototype, 'map')
    .mockImplementation(function (this: unknown[], callback, thisArg) {
      if (callback.name === 'cloneTurnEffect') {
        const stack = new Error().stack ?? '';
        if (
          stack.includes('cloneTurnRecord') &&
          stack.includes('recordConfirmed (')
        )
          counts.returnedOrdinary += this.length;
        if (stack.includes('buildTurn (')) counts.built += this.length;
        if (
          stack.includes('cloneTurnRecord') &&
          stack.includes('createPending (')
        )
          counts.returnedPending += this.length;
      }
      return originalMap.call(this, callback, thisArg);
    });
  try {
    work();
    return counts;
  } finally {
    spy.mockRestore();
  }
}

it.each([0, 1, 0.5])(
  'does not clone the discarded ordinary return (retain=%s)',
  (retain) => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; n: number }, string>() },
      { enhancers: [transactions({ history: { retain } })] }
    );
    const input = Array.from({ length: 32 }, (_, n) => ({ id: `r${n}`, n }));
    try {
      const counts = countRecordCopies(() => {
        tree.$.rows.setAll(input);
        getPathNotifier().flushSync();
      });
      expect(tree.$.rows.all()).toEqual(input);
      // No-obligation history builds nothing; requested history still builds a record.
      expect(counts.built).toBe(retain === 0 ? 0 : 32);
      expect(counts.returnedOrdinary).toBe(0);
      const history = confirmedTurnReader(tree)?.readConfirmedTurns();
      expect(history?.turns).toHaveLength(retain === 0 ? 0 : 1);
      expect(history?.retention.truncated).toBe(retain === 0);
      if (retain > 0) expect(history?.turns[0].effects).toHaveLength(32);
    } finally {
      tree.destroy();
      getPathNotifier().flushSync();
    }
  }
);

it('still clones a useful pending return and keeps the retained reader snapshot independent', () => {
  const tree = signalTree(
    { x: 0, y: 0 },
    { enhancers: [transactions({ history: { retain: 2 } })] }
  );
  try {
    tree.$.x(1);
    getPathNotifier().flushSync();
    const reader = confirmedTurnReader(tree);
    const before = reader?.readConfirmedTurns();
    let pending: ReturnType<typeof tree.transact> | undefined;
    const counts = countRecordCopies(() => {
      pending = tree.transact(() => tree.$.y(2));
    });
    expect(counts.returnedPending).toBeGreaterThan(0);
    expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(1);
    expect(before?.turns).toHaveLength(1);
    pending!.rollback();
    getPathNotifier().flushSync();
    expect(tree.$()).toEqual({ x: 1, y: 0 });
    expect(before).toEqual(reader?.readConfirmedTurns());
    expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(0);
  } finally {
    tree.destroy();
    getPathNotifier().flushSync();
  }
});
