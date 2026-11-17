import { expect, it, vi } from 'vitest';

import { confirmedTurnReader } from '../../internals';
import { getPathNotifier } from '../../lib/path-notifier';
import { signalTree } from '../../lib/signal-tree';
import { peekInternalTransactionRuntime, transactions } from './transactions';

function countLedgerWalks(work: () => void) {
  const counts = {
    insertionVisits: 0,
    releaseFilterVisits: 0,
    stampKeyEnumerations: 0,
  };
  const findIndex = Array.prototype.findIndex;
  const filter = Array.prototype.filter;
  const keys = Map.prototype.keys;
  const findSpy = vi
    .spyOn(Array.prototype, 'findIndex')
    .mockImplementation(function (this: unknown[], predicate, thisArg) {
      const counted = (new Error().stack ?? '').includes('insertConfirmed (');
      return findIndex.call(this, (value, index, array) => {
        if (counted) counts.insertionVisits++;
        return predicate.call(thisArg, value, index, array);
      });
    });
  const filterSpy = vi
    .spyOn(Array.prototype, 'filter')
    .mockImplementation(function (this: unknown[], predicate, thisArg) {
      const counted = (new Error().stack ?? '').includes(
        'releaseConfirmedBeyondObligation ('
      );
      return filter.call(this, (value, index, array) => {
        if (counted) counts.releaseFilterVisits++;
        return predicate.call(thisArg, value, index, array);
      });
    });
  const keysSpy = vi
    .spyOn(Map.prototype, 'keys')
    .mockImplementation(function (this: Map<unknown, unknown>) {
      if ((new Error().stack ?? '').includes('forgetStampsOutside ('))
        counts.stampKeyEnumerations++;
      return keys.call(this);
    });
  try {
    work();
    return counts;
  } finally {
    keysSpy.mockRestore();
    filterSpy.mockRestore();
    findSpy.mockRestore();
  }
}

it.each([0, 3, 0.5])(
  'appends ordinary IDs without rescanning the retained ledger (retain=%s)',
  (retain) => {
    const tree = signalTree(
      { x: 0, y: 0 },
      { enhancers: [transactions({ history: { retain } })] }
    );
    try {
      const pending = tree.transact(() => tree.$.x(1));
      const counts = countLedgerWalks(() => {
        for (let value = 1; value <= 32; value++) {
          tree.$.y(value);
          getPathNotifier().flushSync();
        }
      });
      expect(tree.$()).toEqual({ x: 1, y: 32 });
      expect(
        peekInternalTransactionRuntime(tree)?.getConfirmedTurnIds()
      ).toEqual(Array.from({ length: 32 }, (_, i) => i + 2));
      expect(peekInternalTransactionRuntime(tree)?.getPendingTurnIds()).toEqual(
        [1]
      );
      expect(counts).toEqual({
        insertionVisits: 0,
        releaseFilterVisits: 0,
        stampKeyEnumerations: 0,
      });
      pending.rollback();
      getPathNotifier().flushSync();
      expect(tree.$()).toEqual({ x: 0, y: 32 });
      expect(
        peekInternalTransactionRuntime(tree)?.getConfirmedTurnIds()
      ).toEqual(
        retain === 0.5
          ? Array.from({ length: 32 }, (_, i) => i + 2)
          : retain
          ? [31, 32, 33]
          : []
      );
      expect(
        confirmedTurnReader(tree)?.readConfirmedTurns().retention.truncated
      ).toBe(retain !== 0.5);
    } finally {
      tree.destroy();
      getPathNotifier().flushSync();
    }
  }
);

it('still uses ordered insertion when an older pending ID settles in the middle', () => {
  const tree = signalTree(
    { x: 0, y: 0, z: 0 },
    { enhancers: [transactions()] }
  );
  try {
    const first = tree.transact(() => tree.$.x(1));
    tree.$.y(1);
    getPathNotifier().flushSync();
    const second = tree.transact(() => tree.$.z(1));
    tree.$.y(2);
    getPathNotifier().flushSync();
    const counts = countLedgerWalks(() => second.confirm());
    // Positive detector control: the arbitrary insertion path is still real.
    expect(counts.insertionVisits).toBeGreaterThan(0);
    expect(peekInternalTransactionRuntime(tree)?.getConfirmedTurnIds()).toEqual(
      [2, 3, 4]
    );
    first.confirm();
    getPathNotifier().flushSync();
    expect(peekInternalTransactionRuntime(tree)?.getConfirmedTurnIds()).toEqual(
      []
    );
    expect(tree.$()).toEqual({ x: 1, y: 2, z: 1 });
  } finally {
    tree.destroy();
    getPathNotifier().flushSync();
  }
});

it('deletes exactly the evicted chronological stamps and preserves issued reader snapshots', () => {
  const tree = signalTree(
    { x: 0, y: 0 },
    { enhancers: [transactions({ history: { retain: 2 } })] }
  );
  let stamps: Map<unknown, unknown> | undefined;
  const set = Map.prototype.set;
  const spy = vi
    .spyOn(Map.prototype, 'set')
    .mockImplementation(function (
      this: Map<unknown, unknown>,
      key: unknown,
      value: unknown
    ) {
      const target = set.call(this, key, value);
      if (
        typeof key === 'number' &&
        typeof value === 'number' &&
        (new Error().stack ?? '').includes('insertConfirmed (')
      )
        stamps = target;
      return target;
    });
  try {
    const pending = tree.transact(() => tree.$.x(1));
    for (let value = 1; value <= 4; value++) {
      tree.$.y(value);
      getPathNotifier().flushSync();
    }
    expect(stamps).toBeDefined();
    expect([...(stamps?.entries() ?? [])]).toEqual([
      [2, 1],
      [3, 2],
      [4, 3],
      [5, 4],
    ]);
    const reader = confirmedTurnReader(tree);
    const issued = reader?.readConfirmedTurns();
    pending.confirm();
    getPathNotifier().flushSync();
    expect([...(stamps?.entries() ?? [])]).toEqual([
      [4, 3],
      [5, 4],
    ]);
    expect(issued?.turns.map((turn) => turn.id)).toEqual([2, 3, 4, 5]);
    expect(reader?.readConfirmedTurns().turns.map((turn) => turn.id)).toEqual([
      4, 5,
    ]);
    tree.$.y(5);
    getPathNotifier().flushSync();
    expect([...(stamps?.keys() ?? [])]).toEqual([5, 6]);
    expect(issued?.turns.map((turn) => turn.id)).toEqual([2, 3, 4, 5]);
  } finally {
    spy.mockRestore();
    tree.destroy();
    getPathNotifier().flushSync();
  }
});
