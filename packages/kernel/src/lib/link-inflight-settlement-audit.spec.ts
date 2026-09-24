import { describe, expect, it, vi } from 'vitest';
import { signalTree, transactions } from '../index';
import { link } from './link';
import { getPathNotifier } from './path-notifier';
import { withWriteContext } from './write-context';

const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe('Link authorizes every endpoint invocation', () => {
  it('disposal releases settled while an endpoint promise remains unresolved', async () => {
    const tree = signalTree({ x: 0 });
    const send = vi.fn(() => new Promise<void>(() => undefined));
    const connection = link(tree.$.x, { set: send });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      tree.$.x(1);
      await flush();
      expect(send).toHaveBeenCalledOnce();
      const settling = connection.settled().then(() => 'disposed');
      connection.dispose();
      const result = await Promise.race([
        settling,
        new Promise<string>((resolve) => {
          timeout = setTimeout(() => resolve('timeout'), 100);
        }),
      ]);
      expect(result).toBe('disposed');
      expect(send).toHaveBeenCalledOnce();
    } finally {
      clearTimeout(timeout);
      connection.dispose();
      tree.destroy();
    }
  });

  it('finishes an acknowledged send with no newer value despite an unrelated scope', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const ack = deferred();
    const send = vi.fn(() => ack.promise);
    const connection = link(tree.$.x, { set: send });
    tree.$.x(1);
    await flush();
    const pending = tree.transact(() => tree.$.y(2));
    try {
      const done = vi.fn();
      const settling = connection.settled().then(done);
      ack.resolve();
      await flush();
      expect(done).toHaveBeenCalledOnce();
      await settling;
      expect(send.mock.calls).toEqual([[1]]);
    } finally {
      ack.resolve();
      connection.dispose();
      pending.confirm();
      tree.destroy();
    }
  });

  it.each(['confirm', 'rollback'] as const)(
    'holds the next reconciliation lap through %s',
    async (outcome) => {
      const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
      const ack = deferred();
      const sends: number[] = [];
      const connection = link(tree.$.x, {
        set: (value) => {
          sends.push(value);
          return sends.length === 1 ? ack.promise : undefined;
        },
      });
      tree.$.x(1);
      await flush();
      const pending = tree.transact(() => tree.$.x(2));
      let decided = false;
      try {
        const done = vi.fn();
        const settling = connection.settled().then(done);
        ack.resolve();
        await flush();
        expect(sends).toEqual([1]);
        expect(done).not.toHaveBeenCalled();
        pending[outcome]();
        decided = true;
        await flush();
        await settling;
        expect(sends).toEqual(outcome === 'confirm' ? [1, 2] : [1]);
        expect(done).toHaveBeenCalledOnce();
      } finally {
        ack.resolve();
        connection.dispose();
        if (!decided) pending.confirm();
        tree.destroy();
      }
    }
  );

  it('rechecks after a queued callback was admitted but before its first send', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const send = vi.fn();
    const connection = link(tree.$.x, { set: send });
    tree.$.x(1);
    getPathNotifier().flushSync();
    const pending = tree.transact(() => tree.$.x(2));
    try {
      await flush();
      expect(send).not.toHaveBeenCalled();
      pending.confirm();
      await flush();
      await connection.settled();
      expect(send.mock.calls).toEqual([[2]]);
    } finally {
      connection.dispose();
      pending.confirm();
      tree.destroy();
    }
  });

  it('disposal releases a per-lap hold and its settled waiter without sending', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const ack = deferred();
    const sends: number[] = [];
    const connection = link(tree.$.x, {
      set: (value) => {
        sends.push(value);
        return sends.length === 1 ? ack.promise : undefined;
      },
    });
    tree.$.x(1);
    await flush();
    const pending = tree.transact(() => tree.$.x(2));
    try {
      ack.resolve();
      await flush();
      expect(sends).toEqual([1]);
      const done = vi.fn();
      const settling = connection.settled().then(done);
      await flush();
      expect(done).not.toHaveBeenCalled();
      connection.dispose();
      connection.dispose();
      await flush();
      expect(done).toHaveBeenCalledOnce();
      await settling;
      pending.confirm();
      await flush();
      expect(sends).toEqual([1]);
    } finally {
      ack.resolve();
      connection.dispose();
      pending.confirm();
      tree.destroy();
    }
  });

  it('rechecks when another scope opens between release and continuation', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const ack = deferred();
    const sends: number[] = [];
    const connection = link(tree.$.x, {
      set: (value) => {
        sends.push(value);
        return sends.length === 1 ? ack.promise : undefined;
      },
    });
    tree.$.x(1);
    await flush();
    const first = tree.transact(() => tree.$.x(2));
    ack.resolve();
    await flush();
    first.confirm();
    const second = tree.transact(() => tree.$.x(3));
    let rolledBack = false;
    try {
      await flush();
      expect(sends).toEqual([1]);
      second.rollback();
      rolledBack = true;
      await flush();
      await connection.settled();
      expect(sends).toEqual([1, 2]);
    } finally {
      ack.resolve();
      connection.dispose();
      if (!rolledBack) second.confirm();
      tree.destroy();
    }
  });

  it('keeps the tree-wide hold for unrelated writes during an in-flight send', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const ack = deferred();
    const sends: number[] = [];
    const connection = link(tree.$.y, {
      set: (value) => {
        sends.push(value);
        return sends.length === 1 ? ack.promise : undefined;
      },
    });
    tree.$.y(1);
    await flush();
    const pending = tree.transact(() => tree.$.x(2));
    try {
      tree.$.y(3);
      ack.resolve();
      await flush();
      expect(sends).toEqual([1]);
      pending.confirm();
      await flush();
      await connection.settled();
      expect(sends).toEqual([1, 3]);
    } finally {
      ack.resolve();
      connection.dispose();
      pending.confirm();
      tree.destroy();
    }
  });

  it('keeps per-link held send keys independent and excludes inspection state', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const ack = deferred();
    const xs: number[] = [],
      ys: number[] = [];
    const a = link(tree.$.x, {
      set: (value) => {
        xs.push(value);
        return xs.length === 1 ? ack.promise : undefined;
      },
    });
    const b = link(tree.$.y, {
      set: (value) => {
        ys.push(value);
        return ys.length === 1 ? ack.promise : undefined;
      },
    });
    tree.$.x(1);
    tree.$.y(1);
    await flush();
    const pending = tree.transact(() => {
      tree.$.x(2);
      tree.$.y(3);
    });
    try {
      withWriteContext({ participation: 'inspection' }, () => tree.$.y(99));
      ack.resolve();
      await flush();
      expect(xs).toEqual([1]);
      expect(ys).toEqual([1]);
      pending.confirm();
      await flush();
      await Promise.all([a.settled(), b.settled()]);
      expect(xs).toEqual([1, 2]);
      expect(ys).toEqual([1, 3]);
    } finally {
      ack.resolve();
      a.dispose();
      b.dispose();
      pending.confirm();
      tree.destroy();
    }
  });
});
