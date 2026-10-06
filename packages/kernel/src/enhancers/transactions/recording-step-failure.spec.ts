import { afterEach, describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { restoration } from '../restoration/restoration';
import { peekInternalTransactionRuntime, transactions } from './transactions';

/**
 * A failure in the pending-turn RECORDING step (after the callback returned,
 * while the transaction's capture becomes a pending turn) must be rolled back
 * automatically like any other post-callback failure.
 *
 * On npm 15.4.3 materializePendingTransaction deleted the capture BEFORE it
 * drained and recorded it. A throw after that left abortOpenTransaction with
 * nothing to compensate and nothing to record as committed: the write stayed
 * applied, no handle was returned, and because the write never reached the
 * dependency ledger an earlier pending transaction's rollback reversed straight
 * through it (x 2 -> 0, no refusal). Found by the v15 known-issues audit (p09).
 *
 * No public trigger exists, so this injects the fault (as
 * entity-large-batches.spec.ts instruments Array.prototype): the next sort
 * called from transactions()'s recording step throws.
 */
const realSort = Array.prototype.sort;
let fired = 0;
/**
 * `where` picks the side of createPending the fault lands on: the first sort
 * of the recording step (reading the capture), or a sort inside
 * drainCaptureBucket (after the pending turn exists).
 */
const armRecordingFault = (
  where: 'before-pending' | 'after-pending' = 'before-pending'
): void => {
  // eslint-disable-next-line no-extend-native
  Array.prototype.sort = function (
    this: unknown[],
    compare?: (left: unknown, right: unknown) => number
  ) {
    const frames = (new Error().stack ?? '').split('\n');
    const inRecordingStep = frames.some(
      (frame) =>
        frame.includes('materializePendingTransaction') &&
        frame.includes('transactions/transactions.ts')
    );
    const inDrain = frames.some(
      (frame) =>
        frame.includes('drainCaptureBucket') &&
        frame.includes('transactions/transactions.ts')
    );
    if (inRecordingStep && (where === 'before-pending' || inDrain)) {
      Array.prototype.sort = realSort;
      fired += 1;
      throw new Error('INJECTED recording-step fault');
    }
    return realSort.call(this, compare as never);
  } as typeof realSort;
};
afterEach(() => {
  Array.prototype.sort = realSort;
  fired = 0;
});

type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  x: 0,
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;

describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('recording-step failure (%s)', (_name, enhancers) => {
  const make = (): Tree =>
    signalTree(declaration(), {
      enhancers: enhancers() as never,
    }) as unknown as Tree;

  it('a lone transaction is rolled back automatically and the failure thrown', async () => {
    const tree = make();
    try {
      armRecordingFault();
      expect(() =>
        tree.transaction(() => {
          tree.$.x(1);
          tree.$.rows.addOne({ id: 'A', n: 1 });
        })
      ).toThrow('INJECTED recording-step fault');
      expect(fired).toBe(1);
      await flush();
      expect(tree.$.x()).toBe(0);
      expect(tree.$.rows.all()).toStrictEqual([]);
      expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(
        0
      );
    } finally {
      tree.destroy();
    }
  });

  it('an earlier pending rollback does not reverse through the failed write', async () => {
    const tree = make();
    try {
      const earlier = tree.transaction(() => tree.$.x(1));
      await flush();
      armRecordingFault();
      expect(() => tree.transaction(() => tree.$.x(2))).toThrow(
        'INJECTED recording-step fault'
      );
      expect(fired).toBe(1);
      await flush();
      // The failed transaction compensated itself back to the earlier value.
      expect(tree.$.x()).toBe(1);
      earlier.rollback();
      await flush();
      expect(tree.$.x()).toBe(0);
      expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(
        0
      );
    } finally {
      tree.destroy();
    }
  });

  it('a fault AFTER the pending turn exists is rolled back too', async () => {
    const tree = make();
    try {
      const earlier = tree.transaction(() => tree.$.x(1));
      await flush();
      armRecordingFault('after-pending');
      expect(() =>
        tree.transaction(() => {
          tree.$.x(2);
          tree.$.rows.addOne({ id: 'A', n: 1 });
        })
      ).toThrow('INJECTED recording-step fault');
      expect(fired).toBe(1);
      await flush();
      expect(tree.$.x()).toBe(1);
      expect(tree.$.rows.all()).toStrictEqual([]);
      expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(
        1
      );
      earlier.rollback();
      await flush();
      expect(tree.$.x()).toBe(0);
    } finally {
      tree.destroy();
    }
  });

  it('control: without a fault the transaction records and rolls back normally', async () => {
    const tree = make();
    try {
      const pending = tree.transaction(() => tree.$.x(1));
      await flush();
      expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(
        1
      );
      pending.rollback();
      await flush();
      expect(tree.$.x()).toBe(0);
    } finally {
      tree.destroy();
    }
  });
});
