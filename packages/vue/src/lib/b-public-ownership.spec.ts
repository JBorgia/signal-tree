// eslint-disable-next-line @nx/enforce-module-boundaries
import { getNativeOwnershipPublicExperiment } from '../../../kernel/src/enhancers/transactions/native-ownership-public-experiment';
import { describe, it, expect } from 'vitest';
import {
  signalTree,
  entityMap,
  SignalTreeRollbackError,
  transactions,
} from '../index';
// Internal experiment selection is test-only; application calls remain public.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { selectNativeOwnershipTransactions } from '../../../kernel/src/lib/internals/native-ownership-public-selection';
import { nextTick, watchEffect } from 'vue';

describe('B selected public transaction observers — vue', () => {
  it('publishes useful overlapping public settlement and retains frozen inspection', async () => {
    const tree = signalTree(
      { x: 0, y: 0 },
      { enhancers: [selectNativeOwnershipTransactions(transactions())] }
    );
    expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe(
      'native-pending'
    );
    const seen: string[] = [];
    const read = () => `${tree.$.x.value}|${tree.$.y.value}`;
    const write = (v: number) => {
      tree.$.x.value = v;
      tree.$.y.value = v;
    };
    const run = async (fn: () => void) => {
      fn();
      await nextTick();
    };
    const stop = watchEffect(() => seen.push(read()), { flush: 'sync' });
    try {
      let first!: ReturnType<typeof tree.transact>;
      let second!: ReturnType<typeof tree.transact>;
      await run(() => {
        first = tree.transact(() => write(1));
      });
      expect(read()).toBe('1|1');
      expect(seen[seen.length - 1]).toBe('1|1');
      expect(first.inspect().changes.some((c) => c.path === 'x')).toBe(true);
      await run(() => {
        second = tree.transact(() => write(2));
      });
      expect(read()).toBe('2|2');
      expect(seen[seen.length - 1]).toBe('2|2');
      const inspected = first.inspect();
      await run(() => first.rollback());
      expect(read()).toBe('2|2');
      expect(first.inspect()).toEqual(inspected);
      seen.length = 0;
      await run(() => second.rollback());
      expect(read()).toBe('0|0');
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((v) => v === '0|0')).toBe(true);
      await run(() => {
        first.rollback();
        second.rollback();
      });
      expect(() => first.confirm()).toThrow();
      expect(() => second.confirm()).toThrow();
      expect(read()).toBe('0|0');
      let accepted!: ReturnType<typeof tree.transact>;
      await run(() => {
        accepted = tree.transact(() => write(4));
      });
      await run(() => accepted.confirm());
      expect(read()).toBe('4|4');
      expect(seen[seen.length - 1]).toBe('4|4');
    } finally {
      stop();
      tree.destroy();
    }
  });
  it('successful public abort preserves callback identity and publishes restored state', async () => {
    const tree = signalTree(
      { x: 0, y: 0 },
      { enhancers: [selectNativeOwnershipTransactions(transactions())] }
    );
    expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe(
      'native-pending'
    );
    const seen: string[] = [];
    const read = () => `${tree.$.x.value}|${tree.$.y.value}`;
    const write = (v: number) => {
      tree.$.x.value = v;
      tree.$.y.value = v;
    };
    const run = async (fn: () => void) => {
      fn();
      await nextTick();
    };
    const stop = watchEffect(() => seen.push(read()), { flush: 'sync' });
    try {
      const thrown = Object.freeze({ recovery: 'occupied' });
      await run(() => {
        let caught: unknown;
        try {
          tree.transact(() => {
            write(3);
            throw thrown;
          });
        } catch (error) {
          caught = error;
        }
        expect(caught).toBe(thrown);
      });
      expect(read()).toBe('0|0');
      expect(seen[seen.length - 1]).toBe('0|0');
    } finally {
      stop();
      tree.destroy();
    }
  });
  it('failed public abort keeps usable recovery and delivers the eventual settlement', async () => {
    const tree = signalTree(
      { x: 0, y: 0 },
      { enhancers: [selectNativeOwnershipTransactions(transactions())] }
    );
    const controls = getNativeOwnershipPublicExperiment(tree)!;
    expect(controls.authority).toBe('native-pending');
    const seen: string[] = [];
    const read = () => `${tree.$.x.value}|${tree.$.y.value}`;
    const write = (v: number) => {
      tree.$.x.value = v;
      tree.$.y.value = v;
    };
    const run = async (fn: () => void) => {
      fn();
      await nextTick();
    };
    const stop = watchEffect(() => seen.push(read()), { flush: 'sync' });
    try {
      const original = Object.freeze({ recovery: 'occupied' });
      let failure: unknown;
      await run(() => {
        try {
          tree.transact(() => {
            write(5);
            controls.failPreparation('abort');
            throw original;
          });
        } catch (error) {
          failure = error;
        }
      });
      expect(failure).toBeInstanceOf(SignalTreeRollbackError);
      const recovery = (failure as SignalTreeRollbackError).recovery!;
      expect(recovery.callbackError).toBe(original);
      expect(recovery.callbackFailed).toBe(true);
      expect(recovery.transaction.inspect().changes.length).toBeGreaterThan(0);
      expect(read()).toBe('5|5');
      expect(seen[seen.length - 1]).toBe('5|5');
      controls.failPreparation('retry');
      expect(() => recovery.transaction.rollback()).toThrow(
        SignalTreeRollbackError
      );
      expect(read()).toBe('5|5');
      expect(controls.stats().pending).toBe(1);
      seen.length = 0;
      await run(() => recovery.transaction.rollback());
      expect(read()).toBe('0|0');
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((v) => v === '0|0')).toBe(true);
      expect(controls.stats().pending).toBe(0);
      recovery.transaction.rollback();
    } finally {
      stop();
      tree.destroy();
    }
  });
  it('observer-authored writes survive public settlement and repeated rollback', async () => {
    const tree = signalTree(
      { x: 0, y: 0 },
      { enhancers: [selectNativeOwnershipTransactions(transactions())] }
    );
    const controls = getNativeOwnershipPublicExperiment(tree)!;
    expect(controls.authority).toBe('native-pending');
    const seen: string[] = [];
    let onObservation: ((value: string) => void) | undefined;
    const record = (value: string) => {
      seen.push(value);
      onObservation?.(value);
    };
    const read = () => `${tree.$.x.value}|${tree.$.y.value}`;
    const write = (v: number) => {
      tree.$.x.value = v;
      tree.$.y.value = v;
    };
    const run = async (fn: () => void) => {
      fn();
      await nextTick();
    };
    const stop = watchEffect(() => record(read()), { flush: 'sync' });
    const consumerSeen: string[] = [];
    const stopConsumer = watchEffect(() => consumerSeen.push(read()), {
      flush: 'sync',
    });
    try {
      let pending!: ReturnType<typeof tree.transact>;
      await run(() => {
        pending = tree.transact(() => write(1));
      });
      let called = 0;
      let pendingDuringDelivery: number | undefined;
      onObservation = (value) => {
        if (value === '0|0' && called === 0) {
          called++;
          pendingDuringDelivery = controls.stats().pending;
          write(9);
        }
      };
      await run(() => pending.rollback());
      await run(() => {
        /* Deliberately inert test callback. */
      });
      expect(called).toBe(1);
      expect(pendingDuringDelivery).toBe(0);
      expect(read()).toBe('9|9'); // Vue watchEffect suppresses its own synchronous write rerun; a separate consumer must update.
      expect(seen[seen.length - 1]).toBe('0|0');
      expect(consumerSeen[consumerSeen.length - 1]).toBe('9|9');
      await run(() => pending.rollback());
      expect(read()).toBe('9|9');
    } finally {
      stopConsumer();
      stop();
      tree.destroy();
    }
  });
  it('publishes overlapping scalar and entity settlement through B as one installed state', async () => {
    const tree = signalTree(
      {
        x: 0,
        y: 0,
        rows: entityMap<{ id: string; n: number }, string>({
          selectId: (r) => r.id,
        }),
      },
      { enhancers: [selectNativeOwnershipTransactions(transactions())] }
    );
    expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe(
      'native-pending'
    );
    tree.$.rows.addOne({ id: 'A', n: 0 });
    const seen: string[] = [];
    const read = () =>
      `${tree.$.x.value}|${tree.$.rows.byId('A')?.n.value}|${
        tree.$.rows.all.value[0]?.n
      }`;
    const write = (v: number) => {
      tree.$.x.value = v;
      tree.$.y.value = v;
      tree.$.rows.updateOne('A', { n: v });
    };
    const run = async (fn: () => void) => {
      fn();
      await nextTick();
    };
    const stop = watchEffect(() => seen.push(read()), { flush: 'sync' });
    try {
      let first!: ReturnType<typeof tree.transact>;
      let second!: ReturnType<typeof tree.transact>;
      await run(() => {
        first = tree.transact(() => write(1));
      });
      await run(() => {
        second = tree.transact(() => write(2));
      });
      expect(read()).toBe('2|2|2');
      expect(seen[seen.length - 1]).toBe('2|2|2');
      await run(() => first.rollback());
      expect(read()).toBe('2|2|2');
      seen.length = 0;
      await run(() => second.rollback());
      expect(read()).toBe('0|0|0');
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((v) => v === '0|0|0')).toBe(true);
    } finally {
      stop();
      tree.destroy();
    }
  });
});
