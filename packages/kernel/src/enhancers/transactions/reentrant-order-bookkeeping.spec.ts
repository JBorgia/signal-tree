import { describe, expect, it } from 'vitest';

import { observeWrites } from '../../internals';
import { batching } from '../batching/batching';
import { getTransactionLifecycleChannel } from '../../lib/internals/causal-runtime/transaction-lifecycle';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { peekInternalTransactionRuntime, transactions } from './transactions';

const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

describe('reentrant transaction ordering bookkeeping', () => {
  it('an earlier rollback sees a later capture before its handle materializes', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const earlier = tree.transaction(() => tree.$.x(1));
    await flush();
    let attempted = false;
    let refusal: unknown;
    const off = observeWrites((frame) => {
      if (attempted || frame.path !== 'x' || frame.after !== 2) return;
      attempted = true;
      try {
        earlier.rollback();
      } catch (error) {
        refusal = error;
      }
    });
    try {
      const later = tree.transaction(() => tree.$.x(2));
      expect(attempted).toBe(true);
      expect(tree.$.x()).toBe(2);
      expect(String(refusal)).toMatch(/later-pending-dependency/);
      expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(
        2
      );
      later.rollback();
      expect(tree.$.x()).toBe(1);
      earlier.rollback();
      expect(tree.$.x()).toBe(0);
      expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(
        0
      );
    } finally {
      off();
      tree.destroy();
    }
  });

  it('retains an observed later pending turn and releases both after reverse-order rollback', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    let later: ReturnType<typeof tree.transaction> | undefined;
    let armed = true;
    const off = observeWrites((frame) => {
      if (!armed || frame.path !== 'x' || frame.after !== 1) return;
      armed = false;
      later = tree.transaction(() => tree.$.x(2));
    });
    try {
      const earlier = tree.transaction(() => tree.$.x(1));
      await flush();
      expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(
        2
      );
      expect(() => earlier.rollback()).toThrow(/later-pending-dependency/);
      expect(tree.$.x()).toBe(2);
      later?.rollback();
      expect(tree.$.x()).toBe(1);
      earlier.rollback();
      expect(tree.$.x()).toBe(0);
      expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(
        0
      );
      expect(
        peekInternalTransactionRuntime(tree)?.getConfirmedTurnCount()
      ).toBe(0);
    } finally {
      off();
      tree.destroy();
    }
  });

  it('does not retain empty or failed transaction reservations', () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const runtime = peekInternalTransactionRuntime(tree);
    try {
      for (let i = 0; i < 20; i++) {
        tree.transaction(() => undefined).confirm();
        tree.transaction(() => undefined).rollback();
        expect(() =>
          tree.transaction(() => {
            throw new Error('empty failure');
          })
        ).toThrow('empty failure');
        expect(() =>
          tree.transaction(() => {
            tree.$.x(1);
            throw new Error('written failure');
          })
        ).toThrow('written failure');
        expect(tree.$.x()).toBe(0);
        expect(runtime?.getPendingTurnCount()).toBe(0);
        expect(runtime?.getConfirmedTurnCount()).toBe(0);
      }
      const pending = tree.transaction(() => tree.$.x(1));
      expect(runtime?.getPendingTurnCount()).toBe(1);
      pending.confirm();
      expect(runtime?.getPendingTurnCount()).toBe(0);
      expect(runtime?.getConfirmedTurnCount()).toBe(0);
    } finally {
      tree.destroy();
    }
  });
});

it.each([true, false])(
  'an earlier entity rollback sees an open entity capture (overlap=%s)',
  async (overlap) => {
    const tree = signalTree(
      {
        rows: entityMap<{ id: string; n: number; m: number }, string>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [transactions()] }
    );
    try {
      tree.$.rows.addOne({ id: 'a.b', n: 0, m: 0 });
      await flush();
      const earlier = tree.transaction(() =>
        tree.$.rows.updateOne('a.b', { n: 1 })
      );
      let refusal: unknown;
      let after: unknown;
      const later = tree.transaction(() => {
        tree.$.rows.updateOne('a.b', overlap ? { n: 2 } : { m: 2 });
        try {
          earlier.rollback();
        } catch (error) {
          refusal = error;
        }
        after = tree.$.rows.byIdOrFail('a.b')();
      });
      expect(after).toEqual({
        id: 'a.b',
        n: overlap ? 2 : 0,
        m: overlap ? 0 : 2,
      });
      if (overlap) expect(String(refusal)).toMatch(/later-pending-dependency/);
      else expect(refusal).toBeUndefined();
      later.rollback();
      if (overlap) earlier.rollback();
      expect(tree.$.rows.byIdOrFail('a.b')()).toEqual({
        id: 'a.b',
        n: 0,
        m: 0,
      });
    } finally {
      tree.destroy();
    }
  }
);

it.each([false, true])(
  'opened-listener writes precede the original callback contribution (batching=%s)',
  (batched) => {
    const tree = signalTree(
      { x: 0 },
      { enhancers: batched ? [batching(), transactions()] : [transactions()] }
    );
    let armed = true;
    let predecessor: ReturnType<typeof tree.transaction> | undefined;
    const off = getTransactionLifecycleChannel(tree).subscribe((event) => {
      if (event.kind !== 'opened' || !armed) return;
      armed = false;
      predecessor = tree.transaction(() => tree.$.x(2));
    });
    try {
      const later = tree.transaction(() => tree.$.x(1));
      expect(tree.$.x()).toBe(1);
      expect(() => predecessor?.rollback()).toThrow(/later-pending-dependency/);
      expect(tree.$.x()).toBe(1);
      later.rollback();
      expect(tree.$.x()).toBe(2);
      predecessor?.rollback();
      expect(tree.$.x()).toBe(0);
      expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(
        0
      );
    } finally {
      off();
      tree.destroy();
    }
  }
);

it.each([false, true])(
  'opened-listener ordinary writes form the callback baseline (batching=%s)',
  (batched) => {
    const tree = signalTree(
      { x: 0 },
      { enhancers: batched ? [batching(), transactions()] : [transactions()] }
    );
    let armed = true;
    const off = getTransactionLifecycleChannel(tree).subscribe((event) => {
      if (event.kind !== 'opened' || !armed) return;
      armed = false;
      tree.$.x(2);
    });
    try {
      const pending = tree.transaction(() => tree.$.x(1));
      expect(tree.$.x()).toBe(1);
      pending.rollback();
      expect(tree.$.x()).toBe(2);
    } finally {
      off();
      tree.destroy();
    }
  }
);
