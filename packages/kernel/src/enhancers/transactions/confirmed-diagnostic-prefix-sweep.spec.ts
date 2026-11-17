import { expect, it, vi } from 'vitest';
import { confirmedTurnReader } from '../../internals';
import { getPathNotifier } from '../../lib/path-notifier';
import { signalTree } from '../../lib/signal-tree';
import { peekInternalTransactionRuntime, transactions } from './transactions';

// Instrument real retained record IDs and pending-key enumeration calls, never elapsed time.
// Descriptors are restored even when a meaningful assertion fails.
function countReleaseWork(
  records: readonly { readonly id: number }[],
  work: () => void
) {
  let idReads = 0,
    pendingKeyCalls = 0;
  const descriptors = records.map((record) =>
    Object.getOwnPropertyDescriptor(record, 'id')
  );
  for (const [index, record] of records.entries()) {
    const descriptor = descriptors[index];
    if (!descriptor || !descriptor.configurable || !('value' in descriptor))
      throw Error('Expected actual plain ledger record');
  }
  // Install getters separately: a descriptor cannot contain both value and get.
  for (const [index, record] of records.entries()) {
    const descriptor = descriptors[index]!;
    Object.defineProperty(record, 'id', {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() {
        if (
          (new Error().stack ?? '').includes('releaseConfirmedBeyondObligation')
        )
          idReads++;
        return descriptor.value;
      },
    });
  }
  const keys = Map.prototype.keys;
  const spy = vi
    .spyOn(Map.prototype, 'keys')
    .mockImplementation(function (this: Map<unknown, unknown>) {
      if (
        (new Error().stack ?? '').includes('releaseConfirmedBeyondObligation')
      )
        pendingKeyCalls++;
      return keys.call(this);
    });
  try {
    work();
    return { idReads, pendingKeyCalls };
  } finally {
    spy.mockRestore();
    for (const [index, record] of records.entries())
      Object.defineProperty(record, 'id', descriptors[index]!);
  }
}

it('reads only the evicted prefix of a full256-record diagnostic window', () => {
  const tree = signalTree(
    { x: 0 },
    { enhancers: [transactions({ history: { retain: 256 } })] }
  );
  try {
    for (let value = 1; value <= 256; value++) {
      tree.$.x(value);
      getPathNotifier().flushSync();
    }
    const runtime = peekInternalTransactionRuntime(tree);
    if (!runtime) throw Error('Missing actual transaction runtime');
    const original = [...runtime.getConfirmedTurnRecords()];
    expect(original.map((record) => record.id)).toEqual(
      Array.from({ length: 256 }, (_, i) => i + 1)
    );
    const stamps = original.map((record) => record.__appliedAt),
      issued = confirmedTurnReader(tree)?.readConfirmedTurns();
    const counts = countReleaseWork(original, () => {
      tree.$.x(257);
      getPathNotifier().flushSync();
    });
    expect(counts).toEqual({ idReads: 1, pendingKeyCalls: 1 });
    const retained = runtime.getConfirmedTurnRecords();
    expect(retained.map((record) => record.id)).toEqual(
      Array.from({ length: 256 }, (_, i) => i + 2)
    );
    retained.slice(0, 255).forEach((record, i) => {
      expect(record).toBe(original[i + 1]);
      expect(record.__appliedAt).toBe(stamps[i + 1]);
    });
    expect(retained[255].__appliedAt).toBeGreaterThan(stamps[255] ?? 0);
    expect(issued?.turns.map((turn) => turn.id)).toEqual(
      Array.from({ length: 256 }, (_, i) => i + 1)
    );
    expect(confirmedTurnReader(tree)?.readConfirmedTurns().retention).toEqual({
      truncated: true,
      firstAvailableTurnId: 2,
    });
    expect(tree.$.x()).toBe(257);
  } finally {
    tree.destroy();
    getPathNotifier().flushSync();
  }
});

it.each([0.5, 256])(
  'skips all release walks while diagnostics retain the complete ledger (%s)',
  (retain) => {
    const tree = signalTree(
      { x: 0, y: 0 },
      { enhancers: [transactions({ history: { retain } })] }
    );
    try {
      for (let value = 1; value <= 32; value++) {
        tree.$.y(value);
        getPathNotifier().flushSync();
      }
      const pending = tree.transaction(() => tree.$.x(1)),
        runtime = peekInternalTransactionRuntime(tree);
      if (!runtime) throw Error('Missing actual transaction runtime');
      const original = [...runtime.getConfirmedTurnRecords()];
      expect(runtime.getPendingTurnIds()).toEqual([33]);
      expect(original.map((record) => record.id)).toEqual(
        Array.from({ length: 32 }, (_, i) => i + 1)
      );
      expect(
        countReleaseWork(original, () => runtime.setHistoryRetention(retain))
      ).toEqual({ idReads: 0, pendingKeyCalls: 0 });
      expect(runtime.getConfirmedTurnIds()).toEqual(
        Array.from({ length: 32 }, (_, i) => i + 1)
      );
      expect(
        confirmedTurnReader(tree)?.readConfirmedTurns().retention.truncated
      ).toBe(false);
      // Positive work control: lowering retention really evicts30 records and
      // must inspect those actual IDs and the existing pending reservation.
      expect(
        countReleaseWork(original, () => runtime.setHistoryRetention(2))
      ).toEqual({ idReads: 30, pendingKeyCalls: 1 });
      expect(runtime.getConfirmedTurnIds()).toEqual([31, 32]);
      pending.rollback();
      getPathNotifier().flushSync();
      expect(runtime.getPendingTurnIds()).toEqual([]);
      expect(runtime.getConfirmedTurnIds()).toEqual([31, 32]);
      expect(tree.$()).toEqual({ x: 0, y: 32 });
    } finally {
      tree.destroy();
      getPathNotifier().flushSync();
    }
  }
);
