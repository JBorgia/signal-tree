import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import {
  peekInternalTransactionRuntime,
  transactionAuthorityFaults,
  transactions,
  type TransactionTurnRecord,
} from './transactions';

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

// Match the standalone transaction-work diagnostic; count real effect metadata
// operations, with instrumentation installed only around the measured workload.
const measure = (work: () => void) => {
  const originalSet = WeakMap.prototype.set;
  const originalGet = WeakMap.prototype.get;
  const counts = { effectStampWrites: 0, effectMetadataReads: 0 };
  const isEffect = (key: unknown): boolean =>
    typeof key === 'object' &&
    key !== null &&
    'kind' in key &&
    key.kind === 'set' &&
    'path' in key &&
    typeof key.path === 'string' &&
    'before' in key &&
    'after' in key;
  WeakMap.prototype.set = function (key, value) {
    if (isEffect(key) && typeof value === 'number') counts.effectStampWrites++;
    return originalSet.call(this, key, value);
  };
  WeakMap.prototype.get = function (key) {
    if (isEffect(key)) counts.effectMetadataReads++;
    return originalGet.call(this, key);
  };
  try {
    work();
    return counts;
  } finally {
    WeakMap.prototype.set = originalSet;
    WeakMap.prototype.get = originalGet;
  }
};

const endpoints = (turn: TransactionTurnRecord) =>
  turn.__effects?.flatMap((effect) =>
    effect.kind === 'set' ? [[effect.path, effect.before, effect.after]] : []
  );
const corruptPayload = (turn: TransactionTurnRecord) => {
  for (const effect of turn.__effects ?? []) {
    if (effect.kind === 'set') {
      effect.before = -100;
      effect.after = -200;
    }
  }
  turn.__effects?.splice(0);
  turn.__positionIds?.splice(0);
  turn.restorationSubjectIds?.splice(0);
  turn.__baselineValues?.clear();
};

describe('pending record materialization', () => {
  it.each([1, 10, 100, 1000])(
    'bounds metadata work for %s confirmed turns',
    async (turns) => {
      const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
      try {
        await flush();
        const counts = measure(() => {
          for (let i = 1; i <= turns; i++) {
            tree
              .transaction(() => {
                tree.$.x(i);
                tree.$.y(i * 2);
              })
              .confirm();
          }
        });
        expect(tree.$()).toEqual({ x: turns, y: turns * 2 });
        const runtime = peekInternalTransactionRuntime(tree)!;
        expect(runtime.getPendingTurnIds()).toEqual([]);
        expect(runtime.getPendingPositionIds()).toEqual([]);
        expect(counts).toEqual({
          effectStampWrites: 10 * turns,
          effectMetadataReads: 8 * turns,
        });
      } finally {
        tree.destroy();
      }
    }
  );

  it('keeps positive listener copies isolated from retained authority records', async () => {
    const tree = signalTree(
      { x: 0, y: 0 },
      {
        enhancers: [transactions({ history: { retain: 1 } })],
      }
    );
    try {
      await flush();
      const runtime = peekInternalTransactionRuntime(tree)!;
      const delivered: {
        phase: string;
        endpoints: ReturnType<typeof endpoints>;
      }[] = [];
      const payloads: TransactionTurnRecord[] = [];
      const listen = (phase: string) => (turn: TransactionTurnRecord) => {
        delivered.push({ phase, endpoints: endpoints(turn) });
        payloads.push(turn);
        corruptPayload(turn);
      };
      runtime.onPendingCreated(listen('created'));
      runtime.onPendingConfirmed(listen('confirmed'));
      const counts = measure(() => {
        tree
          .transaction(() => {
            tree.$.x(1);
            tree.$.y(2);
          })
          .confirm();
      });
      const expected = [
        ['x', 0, 1],
        ['y', 0, 2],
      ];
      expect(delivered).toEqual([
        { phase: 'created', endpoints: expected },
        { phase: 'confirmed', endpoints: expected },
      ]);
      expect(payloads[0]).not.toBe(payloads[1]);
      expect(counts).toEqual({
        effectStampWrites: 14,
        effectMetadataReads: 12,
      });
      const records = runtime.getConfirmedTurnRecords();
      expect(records).toHaveLength(1);
      expect(endpoints(records[0])).toEqual(expected);
      expect(records[0].__positionIds).toHaveLength(2);
      expect(records[0].__baselineValues?.size).toBe(2);
      expect(tree.$()).toEqual({ x: 1, y: 2 });
    } finally {
      tree.destroy();
    }
  });

  it('keeps rollback baselines intact when a created listener mutates its payload', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    try {
      await flush();
      const runtime = peekInternalTransactionRuntime(tree)!;
      let created = 0;
      const discarded: ReturnType<typeof endpoints>[] = [];
      runtime.onPendingCreated((turn) => {
        created++;
        corruptPayload(turn);
      });
      runtime.onPendingDiscarded((turn) => {
        discarded.push(endpoints(turn));
        corruptPayload(turn);
      });
      const pending = tree.transaction(() => {
        tree.$.x(1);
        tree.$.y(2);
      });
      expect(tree.$()).toEqual({ x: 1, y: 2 });
      pending.rollback();
      expect(created).toBe(1);
      expect(discarded).toEqual([
        [
          ['x', 0, 1],
          ['y', 0, 2],
        ],
      ]);
      expect(tree.$()).toEqual({ x: 0, y: 0 });
      expect(runtime.getPendingPositionIds()).toEqual([]);
    } finally {
      tree.destroy();
    }
  });

  it.each(['clone', 'drain'] as const)(
    'recovers after a %s fault and accepts a later capture',
    async (step) => {
      const tree = signalTree(
        {
          x: 0,
          rows: entityMap<{ id: string; n: number }, string>({
            selectId: (row) => row.id,
          }),
        },
        { enhancers: [transactions()] }
      );
      const originalSort = Array.prototype.sort;
      let fired = 0;
      try {
        await flush();
        const earlier = tree.transaction(() => {
          tree.$.x(1);
        });
        if (step === 'clone') {
          transactionAuthorityFaults.at = (at) => {
            if (at !== 'clone') return;
            transactionAuthorityFaults.at = undefined;
            fired++;
            throw new Error('INJECTED copy retirement fault');
          };
        } else {
          Array.prototype.sort = function (
            this: unknown[],
            compare?: (a: unknown, b: unknown) => number
          ) {
            const stack = new Error().stack ?? '';
            if (
              stack.includes('drainCaptureBucket') &&
              stack.includes('materializePendingTransaction')
            ) {
              Array.prototype.sort = originalSort;
              fired++;
              throw new Error('INJECTED copy retirement fault');
            }
            return originalSort.call(this, compare);
          } as typeof originalSort;
        }
        expect(() =>
          tree.transaction(() => {
            tree.$.x(2);
            tree.$.rows.addOne({ id: 'A', n: 1 });
          })
        ).toThrow('INJECTED copy retirement fault');
        expect(fired).toBe(1);
        await flush();
        expect(tree.$.x()).toBe(1);
        expect(tree.$.rows.all()).toEqual([]);
        const runtime = peekInternalTransactionRuntime(tree)!;
        expect(runtime.getPendingTurnIds()).toHaveLength(1);
        const later = tree.transaction(() => {
          tree.$.rows.addOne({ id: 'A', n: 3 });
          tree.$.rows.addOne({ id: 'B', n: 4 });
          tree.$.rows.removeOne('A');
        });
        expect(tree.$.rows.all()).toEqual([{ id: 'B', n: 4 }]);
        later.rollback();
        earlier.rollback();
        expect(tree.$.x()).toBe(0);
        expect(tree.$.rows.all()).toEqual([]);
        expect(runtime.getPendingTurnIds()).toEqual([]);
        expect(runtime.getPendingPositionIds()).toEqual([]);
      } finally {
        Array.prototype.sort = originalSort;
        transactionAuthorityFaults.at = undefined;
        tree.destroy();
      }
    }
  );
});
