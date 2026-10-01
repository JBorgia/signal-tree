import { describe, expect, it } from 'vitest';

import { transactions } from '../enhancers/transactions/transactions';
import { onTreeError, type TreeErrorEvent } from './internals/error-reporter';
import { link } from './link';
import { entityMap } from './markers/entity-map';
import { getPathNotifier } from './path-notifier';
import { signalTree } from './signal-tree';

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('Link asynchronous settlement', () => {
  it('waits for a later queued send after an earlier send rejects', async () => {
    const tree = signalTree({ value: 0 });
    const first = deferred();
    const second = deferred();
    const sent: number[] = [];
    const errors: TreeErrorEvent[] = [];
    const offError = onTreeError((event) => errors.push(event));
    const connection = link(tree.$.value, {
      set: (value) => {
        sent.push(value);
        return (value === 1 ? first : second).promise;
      },
    });
    try {
      tree.$.value(1);
      let settled = false;
      const done = connection.settled().then(() => {
        settled = true;
      });
      await nextTask();
      tree.$.value(2);
      await nextTask();
      const failure = new Error('first send rejected');
      first.reject(failure);
      await nextTask();
      expect(sent).toEqual([1, 2]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        error: failure,
        operation: 'link:set',
        path: 'value',
      });
      expect(settled).toBe(false);
      second.resolve();
      await done;
      expect(tree.$.value()).toBe(2);
    } finally {
      first.resolve();
      second.resolve();
      connection.dispose();
      offError();
      tree.destroy();
    }
  });

  it.each(['resolve', 'reject'] as const)(
    'dispose releases all waiters while an external send can still %s',
    async (outcome) => {
      const tree = signalTree({ value: 0 });
      const send = deferred();
      const sent: number[] = [];
      const acknowledged: number[] = [];
      const errors: TreeErrorEvent[] = [];
      const offError = onTreeError((event) => errors.push(event));
      const connection = link(tree.$.value, {
        set: async (value) => {
          sent.push(value);
          await send.promise;
          acknowledged.push(value);
        },
      });
      try {
        tree.$.value(1);
        let settledCount = 0;
        const wait = () =>
          connection.settled().then(() => {
            settledCount++;
          });
        const before = [wait(), wait()];
        await nextTask();
        expect(sent).toEqual([1]);
        tree.$.value(2);
        await nextTask();
        connection.dispose();
        connection.dispose();
        const after = wait();
        await nextTask();
        expect(settledCount).toBe(3);
        expect(acknowledged).toEqual([]);
        expect(sent).toEqual([1]);
        const failure = new Error('external send failed after disposal');
        if (outcome === 'resolve') send.resolve();
        else send.reject(failure);
        await nextTask();
        await Promise.all([...before, after]);
        expect(sent).toEqual([1]);
        expect(acknowledged).toEqual(outcome === 'resolve' ? [1] : []);
        expect(errors.map((event) => event.error)).toEqual(
          outcome === 'reject' ? [failure] : []
        );
      } finally {
        send.resolve();
        connection.dispose();
        offError();
        tree.destroy();
      }
    }
  );

  it.each(['confirm', 'rollback'] as const)(
    'holds a newer value while the prior send finishes, until %s',
    async (outcome) => {
      const tree = signalTree({ value: 0 }, { enhancers: [transactions()] });
      const first = deferred();
      const second = deferred();
      const sent: number[] = [];
      const connection = link(tree.$.value, {
        set: (value) => {
          sent.push(value);
          return (value === 1 ? first : second).promise;
        },
      });
      try {
        tree.$.value(1);
        await nextTask();
        const pending = tree.transaction(() => tree.$.value(2));
        let settled = false;
        const done = connection.settled().then(() => {
          settled = true;
        });
        await nextTask();
        first.resolve();
        await nextTask();
        expect(sent).toEqual([1]);
        expect(settled).toBe(false);
        pending[outcome]();
        await nextTask();
        expect(sent).toEqual(outcome === 'confirm' ? [1, 2] : [1]);
        if (outcome === 'confirm') expect(settled).toBe(false);
        second.resolve();
        await done;
        expect(sent.at(-1)).toBe(tree.$.value());
      } finally {
        first.resolve();
        second.resolve();
        connection.dispose();
        tree.destroy();
      }
    }
  );

  it('rechecks the scope for an already queued send with no later source notification', async () => {
    const tree = signalTree(
      { value: 0, other: 0 },
      { enhancers: [transactions()] }
    );
    const sent: number[] = [];
    const connection = link(tree.$.value, {
      set: (value) => {
        sent.push(value);
      },
    });
    try {
      tree.$.value(1);
      getPathNotifier().flushSync(); // Queue the chain, before its microtask runs.
      const pending = tree.transaction(() => tree.$.other(1));
      let settled = false;
      const done = connection.settled().then(() => {
        settled = true;
      });
      await nextTask();
      expect(sent).toEqual([]);
      expect(settled).toBe(false);
      pending.confirm();
      await done;
      expect(sent).toEqual([1]);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('waits for all scopes when a prior send finishes, including an unrelated location', async () => {
    const tree = signalTree(
      { value: 0, other: 0 },
      { enhancers: [transactions()] }
    );
    const first = deferred();
    const sent: number[] = [];
    const connection = link(tree.$.value, {
      set: (value) => {
        sent.push(value);
        return value === 1 ? first.promise : undefined;
      },
    });
    try {
      tree.$.value(1);
      await nextTask();
      const p1 = tree.transaction(() => tree.$.value(2));
      const p2 = tree.transaction(() => tree.$.other(1));
      let settled = false;
      const done = connection.settled().then(() => {
        settled = true;
      });
      p1.confirm();
      first.resolve();
      await nextTask();
      expect(sent).toEqual([1]);
      expect(settled).toBe(false);
      p2.confirm();
      await done;
      expect(sent).toEqual([1, 2]);
    } finally {
      first.resolve();
      connection.dispose();
      tree.destroy();
    }
  });

  it('preserves v15 explicit refusal: consequences release while the handle remains pending', async () => {
    const tree = signalTree(
      {
        rows: entityMap<{ id: string; n: number }, string>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [transactions()] }
    );
    const first = deferred();
    const sent: number[][] = [];
    const connection = link(tree.$.rows, {
      set: (rows) => {
        sent.push(rows.map((row) => row.n));
        return sent.length === 1 ? first.promise : undefined;
      },
    });
    try {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      await nextTask();
      const pending = tree.transaction(() => tree.$.rows.removeOne('a'));
      tree.$.rows.addOne({ id: 'a', n: 99 });
      await nextTask();
      first.resolve();
      await nextTask();
      expect(sent).toEqual([[1]]);
      expect(() => pending.rollback()).toThrow(/rollback/i);
      await connection.settled();
      expect(sent).toEqual([[1], [99]]);
      // A second refusal proves that the returned handle was not retired.
      expect(() => pending.rollback()).toThrow(/rollback/i);
      pending.confirm();
    } finally {
      first.resolve();
      connection.dispose();
      tree.destroy();
    }
  });
});
