import { describe, expect, it, vi } from 'vitest';
import { transactions } from '../enhancers/transactions/transactions';
import { observationStateForTesting } from './internals/observation-substrate';
import { link } from './link';
import { getPathNotifier } from './path-notifier';
import { signalTree } from './signal-tree';

const drain = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

// A bounded observation of completion; disposal in finally also releases red-run
// waiters. No timeout race or unresolved timer survives a failed assertion.
const completion = (promise: Promise<void>) => {
  const done = vi.fn();
  void promise.then(done);
  return done;
};

describe('link audit regressions', () => {
  it.each([false, true])(
    'keeps relationship keys independent (same source: %s)',
    async (sameSource) => {
      const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
      const xs = vi.fn();
      const ys = vi.fn();
      const a = link(tree.$.x, { set: xs });
      const b = link(sameSource ? tree.$.x : tree.$.y, { set: ys });
      const pending = tree.transact(() => {
        tree.$.x(1);
        tree.$.y(2);
      });
      try {
        await drain();
        expect(xs).not.toHaveBeenCalled();
        expect(ys).not.toHaveBeenCalled();
        pending.confirm();
        await drain();
        expect(xs.mock.calls).toEqual([[1]]);
        expect(ys.mock.calls).toEqual([[sameSource ? 1 : 2]]);
        const done = completion(
          Promise.all([a.settled(), b.settled()]).then(() => undefined)
        );
        await drain();
        expect(done).toHaveBeenCalledOnce();
      } finally {
        a.dispose();
        b.dispose();
        tree.destroy();
      }
    }
  );

  it.each(['confirm', 'rollback'] as const)(
    'releases coalesced held waiters after %s',
    async (outcome) => {
      const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
      const send = vi.fn();
      const connection = link(tree.$.x, { get: () => 0, set: send });
      await connection.retrieve();
      const pending = tree.transact(() => tree.$.y(1));
      try {
        tree.$.x(1);
        await drain();
        const done = completion(connection.settled());
        tree.$.x(2);
        await drain();
        expect(send).not.toHaveBeenCalled();
        expect(done).not.toHaveBeenCalled();
        pending[outcome]();
        await drain();
        expect(send.mock.calls).toEqual([[2]]);
        expect(done).toHaveBeenCalledOnce();
      } finally {
        connection.dispose();
        tree.destroy();
      }
    }
  );

  it('cleans failed subscribe construction and disables escaped inbound callbacks', async () => {
    const tree = signalTree({ x: 0 });
    const send = vi.fn();
    let inbound: ((value: number) => void) | undefined;
    const failure = new Error('subscribe failed');
    try {
      expect(() =>
        link(tree.$.x, {
          set: send,
          subscribe: (next) => {
            inbound = next;
            throw failure;
          },
        })
      ).toThrow(failure);
      expect(observationStateForTesting(tree.$.x).claims).toBe(0);
      inbound?.(9);
      expect(tree.$.x()).toBe(0);
      tree.$.x(1);
      await drain();
      expect(send).not.toHaveBeenCalled();
    } finally {
      tree.destroy();
    }
  });

  it('disposes once and preserves another relationship observation claim', async () => {
    const tree = signalTree({ x: 0 });
    const unsubscribe = vi.fn();
    const send = vi.fn();
    const a = link(tree.$.x, { subscribe: () => unsubscribe });
    const b = link(tree.$.x, { set: send });
    try {
      a.dispose();
      a.dispose();
      expect(unsubscribe).toHaveBeenCalledOnce();
      expect(observationStateForTesting(tree.$.x).claims).toBe(1);
      tree.$.x(3);
      await drain();
      expect(send.mock.calls).toEqual([[3]]);
    } finally {
      a.dispose();
      b.dispose();
      tree.destroy();
    }
  });
  it('keeps coalesced publication held until every scope on the tree settles', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const send = vi.fn();
    const connection = link(tree.$.x, { set: send });
    const first = tree.transact(() => tree.$.x(1));
    const second = tree.transact(() => tree.$.y(1));
    try {
      await drain();
      tree.$.x(2);
      await drain();
      const done = completion(connection.settled());
      first.confirm();
      await drain();
      expect(send).not.toHaveBeenCalled();
      expect(done).not.toHaveBeenCalled();
      second.confirm();
      await drain();
      expect(send.mock.calls).toEqual([[2]]);
      expect(done).toHaveBeenCalledOnce();
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('disposal releases a coalesced waiter without publishing its held value', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const send = vi.fn();
    const connection = link(tree.$.x, { set: send });
    const pending = tree.transact(() => tree.$.y(1));
    try {
      tree.$.x(1);
      await drain();
      const done = completion(connection.settled());
      tree.$.x(2);
      await drain();
      connection.dispose();
      await drain();
      expect(done).toHaveBeenCalledOnce();
      pending.confirm();
      await drain();
      expect(send).not.toHaveBeenCalled();
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});
