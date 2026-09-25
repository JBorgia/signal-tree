import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTreeRealizationPort } from './internals/causal-runtime/tree-realization-adapter';
import { MUTATION_CAPTURE_RUNTIME } from './internals/mutation-capture-runtime';
import { observeWrites } from './internals/write-observation';
import { link } from './link';
import { getPathNotifier } from './path-notifier';
import { signalTree } from './signal-tree';
import {
  peekInternalTransactionRuntime,
  transactions,
} from '../enhancers/transactions/transactions';

/**
 * TX-OBSERVER-STRAND-0. Reproduced on the installed 15.3.0 package.
 *
 * A write observer that threw while `transact()` flushed its writes made
 * `transact()` throw AFTER the writes were applied: no handle came back,
 * the capture bucket was stranded, and the commit scope never settled, so
 * every later Link consequence was held forever. The notifier also cleared
 * its queue before delivery, so the rest of the batch and every flush
 * callback were lost with it.
 *
 * Policy pinned here:
 * - An observer cannot fail a write or a transaction. Its error is reported
 *   and delivery continues to the other subscribers, the rest of the batch,
 *   and the flush callbacks.
 * - Once the callback returns, `transact()` either returns a handle or
 *   throws with its writes rolled back. If that rollback is refused, the error
 *   carries a recovery handle instead (RECOVERY-HANDLE-0). No path leaves live
 *   writes with no authority over them.
 */
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const settledWithin = (l: { settled(): Promise<void> }, ms = 200) =>
  Promise.race([
    l.settled().then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), ms)),
  ]);

describe('a throwing observer cannot strand a transaction or silence Link', () => {
  let report: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    report = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => report.mockRestore());

  it('transact() still returns a handle and a later write reaches Link', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const relation = link(tree.$.y, { set: (v) => void sent.push(v) });
    await flush();
    sent.length = 0;
    let armed = true;
    const off = observeWrites(() => {
      if (armed) {
        armed = false;
        throw new Error('observer');
      }
    });
    try {
      const pending = tree.transact(() => tree.$.x(1));
      expect(pending).toBeDefined();
      expect(tree.$.x()).toBe(1);
      expect(report).toHaveBeenCalled();
      pending.confirm();
      await flush();
      tree.$.y(7);
      await flush();
      expect(await settledWithin(relation)).toBe(true);
      expect(sent).toContain(7);
    } finally {
      off();
      relation.dispose();
      tree.destroy();
    }
  });

  it('the handle it returns can still roll the writes back', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const relation = link(tree.$.x, { set: (v) => void sent.push(v) });
    await flush();
    sent.length = 0;
    const off = observeWrites(() => {
      throw new Error('observer');
    });
    try {
      const pending = tree.transact(() => tree.$.x(1));
      pending.rollback();
      await flush();
      expect(tree.$.x()).toBe(0);
      expect(await settledWithin(relation)).toBe(true);
      expect(sent).not.toContain(1);
    } finally {
      off();
      relation.dispose();
      tree.destroy();
    }
  });

  it('the rest of the batch and the flush callbacks are still delivered', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const notifier = getPathNotifier();
    const offThrowing = notifier.subscribe('**', () => {
      throw new Error('first subscriber');
    });
    const later: string[] = [];
    const offLater = notifier.subscribe('**', (_v, _p, path) => {
      if (path === 'x' || path === 'y') later.push(path);
    });
    let flushed = 0;
    const offFlush = notifier.onFlush(() => void flushed++);
    try {
      tree.$.x(1);
      tree.$.y(2);
      await flush();
      expect(later).toEqual(['x', 'y']);
      expect(flushed).toBeGreaterThan(0);
    } finally {
      offThrowing();
      offLater();
      offFlush();
      tree.destroy();
    }
  });

  it('an ordinary write with a throwing observer still reaches Link', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const off = observeWrites(() => {
      throw new Error('observer');
    });
    const sent: number[] = [];
    const relation = link(tree.$.x, { set: (v) => void sent.push(v) });
    try {
      await flush();
      sent.length = 0;
      tree.$.x(3);
      expect(() => getPathNotifier().flushSync()).not.toThrow();
      await flush();
      expect(await settledWithin(relation)).toBe(true);
      expect(sent).toContain(3);
    } finally {
      off();
      relation.dispose();
      tree.destroy();
    }
  });

  it('a throwing pending-created listener does not cost the handle', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const relation = link(tree.$.y, { set: (v) => void sent.push(v) });
    await flush();
    sent.length = 0;
    const runtime = peekInternalTransactionRuntime(tree)!;
    const off = runtime.onPendingCreated(() => {
      throw new Error('listener');
    });
    try {
      const pending = tree.transact(() => tree.$.x(1));
      expect(pending).toBeDefined();
      pending.confirm();
      await flush();
      tree.$.y(7);
      await flush();
      expect(await settledWithin(relation)).toBe(true);
      expect(sent).toContain(7);
    } finally {
      off();
      relation.dispose();
      tree.destroy();
    }
  });

  it('a post-callback failure throws with the writes rolled back, and Link keeps working', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const relation = link(tree.$.y, { set: (v) => void sent.push(v) });
    await flush();
    sent.length = 0;
    const failure = new Error('capture release failed');
    const host = tree as unknown as Record<symbol, unknown>;
    const previous = host[MUTATION_CAPTURE_RUNTIME];
    host[MUTATION_CAPTURE_RUNTIME] = {
      isCaptureActive: () => false,
      activateCapture: () => () => {
        throw failure;
      },
    };
    try {
      expect(() => tree.transact(() => tree.$.x(1))).toThrow(failure);
      host[MUTATION_CAPTURE_RUNTIME] = previous;
      await flush();
      // A transact() that threw applied nothing.
      expect(tree.$.x()).toBe(0);
      tree.$.y(7);
      await flush();
      expect(await settledWithin(relation)).toBe(true);
      expect(sent).toContain(7);
      // And the next transaction is not blocked behind a stranded one.
      tree.transact(() => tree.$.x(2)).confirm();
      await flush();
      expect(tree.$.x()).toBe(2);
    } finally {
      host[MUTATION_CAPTURE_RUNTIME] = previous;
      relation.dispose();
      tree.destroy();
    }
  });

  it('a callback error still wins when an observer also throws during its rollback', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const relation = link(tree.$.y, { set: (v) => void sent.push(v) });
    await flush();
    sent.length = 0;
    const off = observeWrites(() => {
      throw new Error('observer');
    });
    const callbackError = new Error('callback');
    try {
      expect(() =>
        tree.transact(() => {
          tree.$.x(1);
          throw callbackError;
        })
      ).toThrow(callbackError);
      await flush();
      expect(tree.$.x()).toBe(0);
      off();
      tree.$.y(7);
      await flush();
      expect(await settledWithin(relation)).toBe(true);
      expect(sent).toContain(7);
    } finally {
      off();
      relation.dispose();
      tree.destroy();
    }
  });

  it('a refused compensation on a throwing callback hands back recovery, and settling it releases Link', async () => {
    // Not an observer case. RECOVERY-HANDLE-0: a refusal leaves the turn
    // pending on purpose and attaches its handle to the error, so the caller
    // is never left without authority over live writes. Settling through it
    // must release the consequences held behind the open scope.
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const relation = link(tree.$.x, { set: (v) => void sent.push(v) });
    await flush();
    sent.length = 0;
    const port = getTreeRealizationPort(tree.$ as object) as {
      validateEffects: (...args: unknown[]) => unknown;
    };
    const original = port.validateEffects;
    port.validateEffects = () => ({ kind: 'structural-drift' });
    let thrown: unknown;
    try {
      try {
        tree.transact(() => {
          tree.$.x(1);
          throw new Error('callback');
        });
      } catch (error) {
        thrown = error;
      }
      port.validateEffects = original;
      const recovery = (
        thrown as { recovery?: { transaction: { confirm(): void } } }
      )?.recovery;
      expect(recovery).toBeDefined();
      expect(tree.$.x()).toBe(1);
      recovery?.transaction.confirm();
      await flush();
      expect(await settledWithin(relation)).toBe(true);
      expect(sent.at(-1)).toBe(1);
    } finally {
      port.validateEffects = original;
      relation.dispose();
      tree.destroy();
    }
  });
});
