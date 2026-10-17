import { describe, expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { selectNativeOwnershipTransactions } from './internals/native-ownership-public-selection';
import { getNativeOwnershipPublicExperiment } from '../enhancers/transactions/native-ownership-public-experiment';
import { peekInternalTransactionRuntime } from '../enhancers/transactions/transactions';
import { getPathNotifier } from './path-notifier';
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
const make = (selected: boolean) => {
  const t = signalTree(
    { x: 0, y: 0 },
    {
      enhancers: [
        selected
          ? selectNativeOwnershipTransactions(transactions())
          : transactions(),
      ],
    }
  );
  if (selected) {
    expect(getNativeOwnershipPublicExperiment(t)?.authority).toBe(
      'native-pending'
    );
    expect(peekInternalTransactionRuntime(t)).toBeUndefined();
  }
  return t;
};
// Preserved baseline-matching counterexample. Link disposal is explicit; tree-only
// cancellation currently leaves a waiter held. See link-reactive-settlement.spec.ts:534.
describe.each([false, true])(
  'tree-only Link destruction counterexample (B=%s)',
  (selected) => {
    it('destruction cancels a held send and releases settled waiters', async () => {
      const t = make(selected),
        sent: number[] = [];
      const connection = link(t.$.x, {
        set: (v) => {
          sent.push(v);
        },
      });
      try {
        const p = t.transact(() => t.$.x(7));
        let done = false;
        const waiting = connection.settled().then(() => {
          done = true;
        });
        await flush();
        expect(done).toBe(false);
        t.destroy();
        await flush();
        expect(done).toBe(true);
        await waiting;
        expect(sent).toEqual([]);
        expect(() => p.confirm()).toThrow();
      } finally {
        connection.dispose();
        t.destroy();
      }
    });
  }
);
