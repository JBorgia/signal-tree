import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTreeRealizationPort } from './internals/causal-runtime/tree-realization-adapter';
import {
  clearTreeErrorListenersForTesting,
  onTreeError,
  type TreeErrorEvent,
} from './internals/error-reporter';
import { MUTATION_CAPTURE_RUNTIME } from './internals/mutation-capture-runtime';
import { hasOpenCommitScope } from './internals/commit-consequence';
import { entityMap } from './markers/entity-map';
import { getPositionRegistry } from './internals/position-registry';
import { observeWrites } from './internals/write-observation';
import { link } from './link';
import { getPathNotifier, PathNotifier } from './path-notifier';
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
// ST2034 is always written in development; these run the production policy.
const inProduction = async (fn: () => Promise<void> | void): Promise<void> => {
  const scope = globalThis as { ngDevMode?: unknown };
  const previous = scope.ngDevMode;
  scope.ngDevMode = false;
  try {
    await fn();
  } finally {
    scope.ngDevMode = previous;
  }
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

describe('a contained observer error is reported, never silent', () => {
  let report: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    report = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    clearTreeErrorListenersForTesting();
    report.mockRestore();
  });

  it('reaches onTreeError with the tree and path, and in production writes nothing to the console', async () => {
    await inProduction(async () => {
      const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
      const events: TreeErrorEvent[] = [];
      const offErrors = onTreeError((event) => void events.push(event));
      const failure = new Error('observer');
      const off = observeWrites(() => {
        throw failure;
      });
      try {
        tree.$.x(1);
        await flush();
        expect(events).toEqual([
          {
            error: failure,
            operation: 'notify:subscriber',
            treeId: getPositionRegistry(tree.$)!.id,
            path: 'x',
          },
        ]);
        expect(report).not.toHaveBeenCalled();
      } finally {
        off();
        offErrors();
        tree.destroy();
      }
    });
  });

  it('in development writes ST2034 even when a listener took the report', async () => {
    // A listener that returns normally may still have ignored the event.
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const forwarded: TreeErrorEvent[] = [];
    const offErrors = onTreeError((event) => {
      if (event.operation === 'link:set') forwarded.push(event);
    });
    const failure = new Error('observer');
    const off = observeWrites(() => {
      throw failure;
    });
    try {
      tree.$.x(1);
      await flush();
      expect(forwarded).toEqual([]);
      expect(report).toHaveBeenCalledWith(
        expect.stringContaining('[ST2034]'),
        failure
      );
    } finally {
      off();
      offErrors();
      tree.destroy();
    }
  });

  it('falls back to console.error as ST2034 when no onTreeError listener exists', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const failure = new Error('observer');
    const off = observeWrites(() => {
      throw failure;
    });
    try {
      tree.$.x(1);
      await flush();
      expect(report).toHaveBeenCalledWith(
        expect.stringContaining('[ST2034]'),
        failure
      );
    } finally {
      off();
      tree.destroy();
    }
  });

  it('falls back to the console for a write no tree can be attributed to', () => {
    const events: TreeErrorEvent[] = [];
    const offErrors = onTreeError((event) => void events.push(event));
    const notifier = new PathNotifier();
    const failure = new Error('observer');
    notifier.subscribe('**', () => {
      throw failure;
    });
    try {
      notifier.notify('loose', 1, 0);
      expect(() => notifier.flushSync()).not.toThrow();
      expect(events).toEqual([]);
      expect(report).toHaveBeenCalledWith(
        expect.stringContaining('[ST2034]'),
        failure
      );
    } finally {
      offErrors();
      notifier.clear();
    }
  });

  it('reports a throwing lifecycle listener through onTreeError', async () => {
    await inProduction(async () => {
      const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
      const events: TreeErrorEvent[] = [];
      const offErrors = onTreeError((event) => void events.push(event));
      const failure = new Error('listener');
      const off = peekInternalTransactionRuntime(tree)!.onPendingCreated(() => {
        throw failure;
      });
      try {
        tree.transact(() => tree.$.x(1)).confirm();
        await flush();
        expect(events).toEqual([
          {
            error: failure,
            operation: 'transaction:listener',
            treeId: getPositionRegistry(tree.$)!.id,
          },
        ]);
        expect(report).not.toHaveBeenCalled();
      } finally {
        off();
        offErrors();
        tree.destroy();
      }
    });
  });

  it('routes entity-row and rollback-compensation errors to onTreeError too', async () => {
    await inProduction(async () => {
      // These writes name their tree only in meta.ownerId.
      type Row = { id: string; v: number };
      const tree = signalTree(
        { rows: entityMap<Row, string>({ selectId: (r) => r.id }), x: 0 },
        { enhancers: [transactions()] }
      );
      const events: TreeErrorEvent[] = [];
      const offErrors = onTreeError((event) => void events.push(event));
      const off = observeWrites(() => {
        throw new Error('observer');
      });
      try {
        tree.$.rows.addOne({ id: 'A', v: 0 });
        tree.$.rows.updateOne('A', { v: 1 });
        await flush();
        tree.transact(() => tree.$.x(9)).rollback();
        await flush();
        expect(events.length).toBeGreaterThan(0);
        expect(
          events.every((e) => e.treeId === getPositionRegistry(tree.$)!.id)
        ).toBe(true);
        expect(events.map((e) => e.path)).toEqual(
          expect.arrayContaining(['rows.A', 'x'])
        );
        expect(report).not.toHaveBeenCalled();
      } finally {
        off();
        offErrors();
        tree.destroy();
      }
    });
  });

  it('a listener that writes on every report cannot loop with an always-throwing observer', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const errors = signalTree({ count: 0 }, { enhancers: [transactions()] });
    let calls = 0;
    const offErrors = onTreeError(() => {
      calls++;
      if (calls > 50) return; // a runaway would pass this; the guard must stop it first
      errors.$.count(errors.$.count() + 1);
    });
    const off = observeWrites(() => {
      throw new Error('always');
    });
    try {
      const pending = tree.transact(() => tree.$.x(1));
      pending.confirm();
      await flush();
      // One report per observed write of the tree; the listener's own write
      // is reported to the console only.
      expect(calls).toBeLessThanOrEqual(3);
      expect(report).toHaveBeenCalledWith(
        expect.stringContaining('[ST2034]'),
        expect.anything()
      );
    } finally {
      off();
      offErrors();
      errors.destroy();
      tree.destroy();
    }
  });

  it('still logs the original error when every onTreeError listener throws', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const offErrors = onTreeError(() => {
      throw new Error('listener bug');
    });
    const failure = new Error('observer');
    const off = observeWrites(() => {
      throw failure;
    });
    try {
      tree.$.x(1);
      await flush();
      expect(report).toHaveBeenCalledWith(
        expect.stringContaining('[ST2034]'),
        failure
      );
    } finally {
      off();
      offErrors();
      tree.destroy();
    }
  });

  it('a throwing console cannot abort the flush', async () => {
    report.mockImplementation(() => {
      throw new Error('fail-on-console');
    });
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const notifier = getPathNotifier();
    const offThrowing = notifier.subscribe('**', () => {
      throw new Error('observer');
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
      expect(() => notifier.flushSync()).not.toThrow();
      expect(later).toEqual(['x', 'y']);
      expect(flushed).toBeGreaterThan(0);
    } finally {
      offThrowing();
      offLater();
      offFlush();
      tree.destroy();
    }
  });
});

describe('failures after the callback returns (16.x)', () => {
  let report: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    report = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => report.mockRestore());

  it('a subscribed derived that throws as the group closes rolls back and keeps Link alive', async () => {
    const tree = signalTree(
      { x: 0, y: 0 },
      {
        enhancers: [transactions()],
        derived: ($) => ({
          inv: () => {
            if ($.x() === 1) throw new Error('derived');
            return $.x();
          },
        }),
      }
    ) as unknown as {
      $: {
        x: { (): number; (v: number): void };
        y: { (): number; (v: number): void };
        inv: { subscribe(fn: () => void): () => void };
      };
      transact(fn: () => void): { confirm(): void };
      destroy(): void;
    };
    const offInv = tree.$.inv.subscribe(() => undefined);
    const sent: number[] = [];
    const relation = link(tree.$.y as never, {
      set: (v: number) => void sent.push(v),
    });
    await flush();
    sent.length = 0;
    try {
      expect(() => tree.transact(() => tree.$.x(1))).toThrow('derived');
      await flush();
      expect(tree.$.x()).toBe(0);
      expect(hasOpenCommitScope(tree as object)).toBe(false);
      tree.$.y(7);
      await flush();
      expect(await settledWithin(relation)).toBe(true);
      expect(sent).toContain(7);
    } finally {
      offInv();
      relation.dispose();
      tree.destroy();
    }
  });

  it('a refused rollback after the group fails to close reports callbackFailed false', async () => {
    const tree = signalTree(
      { x: 0 },
      {
        enhancers: [transactions()],
        derived: ($) => ({
          inv: () => {
            if ($.x() === 1) throw new Error('derived');
            return $.x();
          },
        }),
      }
    ) as unknown as {
      $: {
        x: { (): number; (v: number): void };
        inv: { subscribe(fn: () => void): () => void };
      };
      transact(fn: () => void): { confirm(): void };
      destroy(): void;
    };
    const offInv = tree.$.inv.subscribe(() => undefined);
    const port = getTreeRealizationPort(tree.$ as object) as {
      validateEffects: (...args: unknown[]) => unknown;
    };
    const original = port.validateEffects;
    port.validateEffects = () => ({ kind: 'structural-drift' });
    let thrown: unknown;
    try {
      tree.transact(() => tree.$.x(1));
    } catch (error) {
      thrown = error;
    } finally {
      port.validateEffects = original;
    }
    try {
      const recovery = (
        thrown as {
          recovery?: {
            transaction: { confirm(): void };
            callbackFailed: boolean;
          };
        }
      )?.recovery;
      expect(recovery).toBeDefined();
      expect(recovery?.callbackFailed).toBe(false);
      recovery?.transaction.confirm();
      await flush();
      expect(hasOpenCommitScope(tree as object)).toBe(false);
    } finally {
      offInv();
      tree.destroy();
    }
  });

  it('a callback that throws undefined still fails the transaction', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    let threw = false;
    let handle: unknown;
    try {
      handle = tree.transact(() => {
        tree.$.x(1);
        throw undefined;
      });
    } catch {
      threw = true;
    }
    await flush();
    expect(threw).toBe(true);
    expect(handle).toBeUndefined();
    expect(tree.$.x()).toBe(0);
    expect(hasOpenCommitScope(tree as object)).toBe(false);
    tree.destroy();
  });

  it('a refused rollback after a capture-release failure hands back recovery that does not blame the callback', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const relation = link(tree.$.x, { set: (v) => void sent.push(v) });
    await flush();
    sent.length = 0;
    const host = tree as unknown as Record<symbol, unknown>;
    const previous = host[MUTATION_CAPTURE_RUNTIME];
    host[MUTATION_CAPTURE_RUNTIME] = {
      isCaptureActive: () => false,
      activateCapture: () => () => {
        throw new Error('capture release failed');
      },
    };
    const port = getTreeRealizationPort(tree.$ as object) as {
      validateEffects: (...args: unknown[]) => unknown;
    };
    const original = port.validateEffects;
    port.validateEffects = () => ({ kind: 'structural-drift' });
    let thrown: unknown;
    try {
      tree.transact(() => tree.$.x(1));
    } catch (error) {
      thrown = error;
    } finally {
      port.validateEffects = original;
      host[MUTATION_CAPTURE_RUNTIME] = previous;
    }
    try {
      const recovery = (
        thrown as {
          recovery?: {
            transaction: { confirm(): void };
            callbackFailed: boolean;
            callbackError?: unknown;
          };
        }
      )?.recovery;
      expect(recovery).toBeDefined();
      expect(recovery?.callbackFailed).toBe(false);
      expect(recovery?.callbackError).toBeUndefined();
      expect(tree.$.x()).toBe(1);
      recovery?.transaction.confirm();
      await flush();
      expect(hasOpenCommitScope(tree as object)).toBe(false);
      expect(await settledWithin(relation)).toBe(true);
      expect(sent.at(-1)).toBe(1);
    } finally {
      relation.dispose();
      tree.destroy();
    }
  });

  it('a refused rollback after a capture-release failure still reports that failure', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const host = tree as unknown as Record<symbol, unknown>;
    const previous = host[MUTATION_CAPTURE_RUNTIME];
    const failure = new Error('capture release failed');
    host[MUTATION_CAPTURE_RUNTIME] = {
      isCaptureActive: () => false,
      activateCapture: () => () => {
        throw failure;
      },
    };
    const port = getTreeRealizationPort(tree.$ as object) as {
      validateEffects: (...args: unknown[]) => unknown;
    };
    const original = port.validateEffects;
    port.validateEffects = () => ({ kind: 'structural-drift' });
    let thrown: unknown;
    try {
      tree.transact(() => tree.$.x(1));
    } catch (error) {
      thrown = error;
    } finally {
      port.validateEffects = original;
      host[MUTATION_CAPTURE_RUNTIME] = previous;
    }
    try {
      expect(report).toHaveBeenCalledWith(
        expect.stringContaining('rollback was then refused'),
        failure
      );
      (
        thrown as { recovery?: { transaction: { confirm(): void } } }
      )?.recovery?.transaction.confirm();
    } finally {
      tree.destroy();
    }
  });

  it('a consumer that throws while the rollback is delivered does not mask the failure', async () => {
    let armed = false;
    const tree = signalTree(
      { x: 0 },
      {
        enhancers: [transactions()],
        derived: ($) => ({
          inv: () => {
            const x = $.x();
            if (armed && x === 0) throw new Error('delivery');
            return x;
          },
        }),
      }
    ) as unknown as {
      $: {
        x: { (): number; (v: number): void };
        inv: { subscribe(fn: () => void): () => void };
      };
      transact(fn: () => void): { confirm(): void };
      destroy(): void;
    };
    const offInv = tree.$.inv.subscribe(() => undefined);
    const host = tree as unknown as Record<symbol, unknown>;
    const previous = host[MUTATION_CAPTURE_RUNTIME];
    const failure = new Error('capture release failed');
    host[MUTATION_CAPTURE_RUNTIME] = {
      isCaptureActive: () => false,
      activateCapture: () => () => {
        throw failure;
      },
    };
    let thrown: unknown;
    try {
      tree.transact(() => {
        tree.$.x(1);
        armed = true;
      });
    } catch (error) {
      thrown = error;
    } finally {
      host[MUTATION_CAPTURE_RUNTIME] = previous;
      armed = false;
    }
    try {
      expect(thrown).toBe(failure);
      expect(tree.$.x()).toBe(0);
      expect(hasOpenCommitScope(tree as object)).toBe(false);
    } finally {
      offInv();
      tree.destroy();
    }
  });

  it('a throwing console inside a cleanup report cannot replace the refusal', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const host = tree as unknown as Record<symbol, unknown>;
    const previous = host[MUTATION_CAPTURE_RUNTIME];
    host[MUTATION_CAPTURE_RUNTIME] = {
      isCaptureActive: () => false,
      activateCapture: () => () => {
        throw new Error('capture release failed');
      },
    };
    const port = getTreeRealizationPort(tree.$ as object) as {
      validateEffects: (...args: unknown[]) => unknown;
    };
    const original = port.validateEffects;
    port.validateEffects = () => ({ kind: 'structural-drift' });
    report.mockImplementation(() => {
      throw new Error('fail-on-console');
    });
    let thrown: unknown;
    try {
      tree.transact(() => tree.$.x(1));
    } catch (error) {
      thrown = error;
    } finally {
      port.validateEffects = original;
      host[MUTATION_CAPTURE_RUNTIME] = previous;
    }
    try {
      expect((thrown as Error | undefined)?.message).not.toBe(
        'fail-on-console'
      );
      const recovery = (
        thrown as { recovery?: { transaction: { confirm(): void } } }
      )?.recovery;
      expect(recovery).toBeDefined();
      recovery?.transaction.confirm();
      expect(hasOpenCommitScope(tree as object)).toBe(false);
    } finally {
      tree.destroy();
    }
  });
});
