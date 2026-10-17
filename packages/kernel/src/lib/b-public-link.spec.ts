import { describe, expect, it } from 'vitest';
import {
  entityMap,
  link,
  signalTree,
  transactions,
  SignalTreeRollbackError,
} from '../index';
import { selectNativeOwnershipTransactions } from './internals/native-ownership-public-selection';
import { getNativeOwnershipPublicExperiment } from '../enhancers/transactions/native-ownership-public-experiment';
import { peekInternalTransactionRuntime } from '../enhancers/transactions/transactions';
import { getPathNotifier } from './path-notifier';
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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
describe.each([false, true])(
  'Link public transaction contract (B=%s)',
  (selected) => {
    it('holds all pending scopes then sends one confirmed current value', async () => {
      const t = make(selected),
        sent: unknown[] = [];
      const connection = link(t.$, {
        set: (v) => {
          sent.push(v);
        },
      });
      try {
        const p = t.transact(() => t.$.x(1));
        const q = t.transact(() => t.$.y(2));
        await flush();
        expect(sent).toEqual([]);
        p.confirm();
        await flush();
        expect(sent).toEqual([]);
        q.confirm();
        await flush();
        await connection.settled();
        expect(sent).toEqual([{ x: 1, y: 2 }]);
      } finally {
        connection.dispose();
        t.destroy();
      }
    });
    it('never sends rejected state and remains useful afterward', async () => {
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
        expect(sent).toEqual([]);
        expect(done).toBe(false);
        p.rollback();
        await flush();
        await waiting;
        expect(sent).not.toContain(7);
        t.$.x(3);
        await flush();
        await connection.settled();
        expect(sent.at(-1)).toBe(3);
      } finally {
        connection.dispose();
        t.destroy();
      }
    });
    it('preserves inbound newer truth when an older contribution is rejected', async () => {
      const t = make(selected),
        sent: number[] = [];
      let receive: ((value: number) => void) | undefined;
      const connection = link(t.$.x, {
        subscribe: (next) => {
          receive = next;
          return () => {
            receive = undefined;
          };
        },
        set: (value) => {
          sent.push(value);
        },
      });
      try {
        const pending = t.transact(() => t.$.x(7));
        await flush();
        expect(sent).toEqual([]);
        if (!receive) throw new Error('Inbound subscription was not installed');
        receive(9);
        expect(t.$.x()).toBe(9);
        if (selected) {
          pending.rollback();
        } else {
          // The incumbent safely refuses this newer external dependency.
          expect(() => pending.rollback()).toThrow(SignalTreeRollbackError);
          expect(pending.inspect()).toBeDefined();
          expect(() => pending.rollback()).toThrow(SignalTreeRollbackError);
          expect(t.$.x()).toBe(9);
          pending.confirm();
        }
        await flush();
        await connection.settled();
        expect(t.$.x()).toBe(9);
        expect(sent).not.toContain(7);
        t.$.x(10);
        await flush();
        await connection.settled();
        expect(sent.at(-1)).toBe(10);
      } finally {
        connection.dispose();
        t.destroy();
      }
    });
    it('endpoint callback may author a new transaction without leaking its speculation', async () => {
      const t = make(selected),
        sent: number[] = [];
      let reentered = false;
      const connection = link(t.$.x, {
        set: (v) => {
          sent.push(v);
          if (v === 1) {
            const p = t.transact(() => t.$.x(2));
            p.rollback();
            const q = t.transact(() => t.$.x(3));
            q.confirm();
            reentered = true;
          }
        },
      });
      try {
        t.transact(() => t.$.x(1)).confirm();
        await flush();
        await connection.settled();
        expect(reentered).toBe(true);
        expect(sent).toEqual([1, 3]);
        expect(t.$.x()).toBe(3);
      } finally {
        connection.dispose();
        t.destroy();
      }
    });
    it.each(['confirm', 'rollback'] as const)(
      'rechecks send permission after an in-flight acknowledgement (%s)',
      async (outcome) => {
        const t = make(selected),
          sent: number[] = [];
        const ack = deferred();
        const connection = link(t.$.x, {
          set: (v) => {
            sent.push(v);
            return sent.length === 1 ? ack.promise : undefined;
          },
        });
        try {
          t.$.x(1);
          await flush();
          const p = t.transact(() => t.$.x(2));
          let done = false;
          const waiting = connection.settled().then(() => {
            done = true;
          });
          ack.resolve();
          await flush();
          expect(sent).toEqual([1]);
          expect(done).toBe(false);
          p[outcome]();
          await flush();
          await waiting;
          expect(sent).toEqual(outcome === 'confirm' ? [1, 2] : [1]);
        } finally {
          ack.resolve();
          connection.dispose();
          t.destroy();
        }
      }
    );
    it('explicit Link disposal before tree destruction releases held waiters', async () => {
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
        connection.dispose();
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
    it('sends coherent entity ordering only after confirmation', async () => {
      const t = signalTree(
        { rows: entityMap<{ id: string; n: number }, string>() },
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
      t.$.rows.addMany([
        { id: 'A', n: 1 },
        { id: 'B', n: 2 },
      ]);
      await flush();
      const sent: unknown[] = [];
      const connection = link(t.$.rows, {
        set: (v) => {
          sent.push(v);
        },
      });
      try {
        const p = t.transact(() => {
          t.$.rows.prependOne({ id: 'C', n: 3 });
          t.$.rows.updateOne('A', { n: 4 });
        });
        await flush();
        expect(sent).toEqual([]);
        p.confirm();
        await flush();
        await connection.settled();
        expect(sent).toEqual([
          [
            { id: 'C', n: 3 },
            { id: 'A', n: 4 },
            { id: 'B', n: 2 },
          ],
        ]);
      } finally {
        connection.dispose();
        t.destroy();
      }
    });
  }
);
describe('B Link refusal and recovery', () => {
  it('failed rejection retains send authority until retry succeeds', async () => {
    const t = make(true),
      sent: number[] = [];
    const connection = link(t.$.x, {
      set: (v) => {
        sent.push(v);
      },
    });
    try {
      const p = t.transact(() => t.$.x(7));
      const controls = getNativeOwnershipPublicExperiment(t);
      if (!controls) throw new Error('B controls were not installed');
      controls.failPreparation(new Error('settlement'));
      expect(() => p.rollback()).toThrow(SignalTreeRollbackError);
      await flush();
      expect(sent).toEqual([]);
      expect(controls.stats().pending).toBe(1);
      p.rollback();
      await flush();
      await connection.settled();
      expect(sent).not.toContain(7);
      t.$.x(4);
      await flush();
      await connection.settled();
      expect(sent.at(-1)).toBe(4);
    } finally {
      connection.dispose();
      t.destroy();
    }
  });
  it('failed abort exposes usable recovery without outbound speculation', async () => {
    const t = make(true),
      sent: number[] = [];
    const connection = link(t.$.x, {
      set: (v) => {
        sent.push(v);
      },
    });
    try {
      let caught: unknown;
      const callback = Object.freeze({ reason: 'callback' });
      try {
        t.transact(() => {
          t.$.x(7);
          const controls = getNativeOwnershipPublicExperiment(t);
          if (!controls) throw new Error('B controls were not installed');
          controls.failPreparation(new Error('abort'));
          throw callback;
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(SignalTreeRollbackError);
      if (!(caught instanceof SignalTreeRollbackError) || !caught.recovery) {
        throw new Error('Failed abort did not expose recovery');
      }
      const recovery = caught.recovery;
      expect(recovery.callbackError).toBe(callback);
      await flush();
      expect(sent).toEqual([]);
      recovery.transaction.confirm();
      await flush();
      await connection.settled();
      expect(sent).toEqual([7]);
    } finally {
      connection.dispose();
      t.destroy();
    }
  });
});
