import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTreeRealizationPort } from './internals/causal-runtime/tree-realization-adapter';
import {
  clearTreeErrorListenersForTesting,
  onTreeError,
  resetContainedReportBudgetForTesting,
  getContainedReportBudgetSizeForTesting,
  reportContainedObserverError,
  type TreeErrorEvent,
} from './internals/error-reporter';
import { MUTATION_CAPTURE_RUNTIME } from './internals/mutation-capture-runtime';
import {
  hasOpenCommitScope,
  scheduleDurableConsequence,
} from './internals/commit-consequence';
import { getTransactionLifecycleChannel } from './internals/causal-runtime/transaction-lifecycle';
import { entityMap } from './markers/entity-map';
import { restoration } from '../enhancers/restoration/restoration';
import { undoable } from './undoable';
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
 * A write observer that threw while `transaction()` flushed its writes made
 * `transaction()` throw AFTER the writes were applied: no handle came back,
 * the capture bucket was stranded, and the commit scope never settled, so
 * every later Link consequence was held forever. The notifier also cleared
 * its queue before delivery, so the rest of the batch and every flush
 * callback were lost with it.
 *
 * Policy pinned here:
 * - An observer cannot fail a write or a transaction. Its error is reported
 *   and delivery continues to the other subscribers, the rest of the batch,
 *   and the flush callbacks.
 * - Automatic abort either compensates or commits surviving writes on refusal.
 *   Its ledger, lifecycle and consequences describe the same outcome. This v15
 *   exception does not change refusal on an already-returned pending handle.
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

  it('transaction() still returns a handle and a later write reaches Link', async () => {
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
      const pending = tree.transaction(() => tree.$.x(1));
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
      const pending = tree.transaction(() => tree.$.x(1));
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
      const pending = tree.transaction(() => tree.$.x(1));
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
      expect(() => tree.transaction(() => tree.$.x(1))).toThrow(failure);
      host[MUTATION_CAPTURE_RUNTIME] = previous;
      await flush();
      // A transaction() that threw applied nothing.
      expect(tree.$.x()).toBe(0);
      tree.$.y(7);
      await flush();
      expect(await settledWithin(relation)).toBe(true);
      expect(sent).toContain(7);
      // And the next transaction is not blocked behind a stranded one.
      tree.transaction(() => tree.$.x(2)).confirm();
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
        tree.transaction(() => {
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

  it('a refused compensation on a throwing callback still settles, so Link reconciles to the live value', async () => {
    // Not an observer case: it pins that the shared abort path settles the
    // commit scope even when compensation refuses. (Commit vs discard is not
    // observable here: Link schedules from the flush, outside the callback's
    // write context, so its consequences are held tree-wide, not in the scope.)
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
    try {
      expect(() =>
        tree.transaction(() => {
          tree.$.x(1);
          throw new Error('callback');
        })
      ).toThrow();
      port.validateEffects = original;
      await flush();
      expect(tree.$.x()).toBe(1);
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
    resetContainedReportBudgetForTesting();
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
    await inProduction(async () => {
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
  });
  it('falls back to the console for a write no tree can be attributed to', async () => {
    await inProduction(async () => {
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
        tree.transaction(() => tree.$.x(1)).confirm();
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
        tree.transaction(() => tree.$.x(9)).rollback();
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
      if (calls > 500) return; // a runaway would pass this; the budget must stop it first
      errors.$.count(errors.$.count() + 1);
    });
    const off = observeWrites(() => {
      throw new Error('always');
    });
    try {
      const pending = tree.transaction(() => tree.$.x(1));
      pending.confirm();
      await flush();
      // The first report is the app tree's; the listener's writes then spend
      // the errors tree's budget, and the loop stops.
      expect(calls).toBeLessThanOrEqual(51);
      expect(report).toHaveBeenCalledWith(
        expect.stringContaining('further ones go to the console only')
      );
    } finally {
      off();
      offErrors();
      errors.destroy();
      tree.destroy();
    }
  });

  it('a listener that writes a microtask later cannot loop either', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const errors = signalTree({ count: 0 }, { enhancers: [transactions()] });
    let calls = 0;
    const offErrors = onTreeError(() => {
      calls++;
      if (calls > 500) return;
      void Promise.resolve().then(() => errors.$.count(errors.$.count() + 1));
    });
    const off = observeWrites(() => {
      throw new Error('always');
    });
    try {
      tree.$.x(1);
      for (let i = 0; i < 2000; i++) await Promise.resolve();
      expect(calls).toBeLessThanOrEqual(51);
    } finally {
      off();
      offErrors();
      errors.destroy();
      tree.destroy();
    }
  });

  it('still logs the original error when every onTreeError listener throws', async () => {
    await inProduction(async () => {
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
  });
  it('reports without a timer, so a host with no setTimeout cannot strand the transaction', async () => {
    const scope = globalThis as { setTimeout?: unknown };
    const saved = scope.setTimeout;
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const events: TreeErrorEvent[] = [];
    const offErrors = onTreeError((event) => void events.push(event));
    const off = observeWrites(() => {
      throw new Error('observer');
    });
    scope.setTimeout = undefined;
    let handle: { confirm(): void } | undefined;
    try {
      handle = tree.transaction(() => tree.$.x(1));
    } finally {
      scope.setTimeout = saved;
      off();
      offErrors();
    }
    try {
      expect(handle).toBeDefined();
      handle?.confirm();
      expect(events.length).toBeGreaterThan(0);
      expect(hasOpenCommitScope(tree as object)).toBe(false);
    } finally {
      tree.destroy();
    }
  });

  it("one noisy tree cannot use up another tree's report budget", async () => {
    const noisy = signalTree({ n: 0 }, { enhancers: [transactions()] });
    const quiet = signalTree({ q: 0 }, { enhancers: [transactions()] });
    const quietId = getPositionRegistry(quiet.$)!.id;
    const events: TreeErrorEvent[] = [];
    const offErrors = onTreeError((event) => void events.push(event));
    const off = observeWrites(() => {
      throw new Error('observer');
    });
    try {
      for (let i = 1; i <= 80; i++) {
        noisy.$.n(i);
        getPathNotifier().flushSync();
      }
      quiet.$.q(1);
      await flush();
      expect(events.some((e) => e.treeId === quietId)).toBe(true);
    } finally {
      off();
      offErrors();
      noisy.destroy();
      quiet.destroy();
    }
  });

  it('rate limits within a window but does not promise slow-loop termination', () => {
    const tree = signalTree({ x: 0 });
    let now = 0;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    const listener = vi.fn();
    const off = onTreeError(listener);
    try {
      for (let i = 0; i < 100; i++) {
        now += 25;
        reportContainedObserverError({
          treeId: getPositionRegistry(tree.$)?.id,
          operation: 'notify:subscriber',
          error: new Error('slow report'),
        });
      }
      expect(listener).toHaveBeenCalledTimes(100);
    } finally {
      off();
      clock.mockRestore();
      tree.destroy();
    }
  });

  it('destroy releases the tree reporting record after cleanup reports', async () => {
    const before = getContainedReportBudgetSizeForTesting();
    const tree = signalTree({ x: 0 });
    const treeId = getPositionRegistry(tree.$)?.id;
    expect(treeId).toBeDefined();
    const emit = () =>
      reportContainedObserverError({
        treeId,
        operation: 'notify:subscriber',
        error: new Error('observer'),
      });
    emit();
    expect(getContainedReportBudgetSizeForTesting()).toBe(before + 1);
    tree.registerCleanup(emit);
    tree.registerCleanup(() => queueMicrotask(emit));
    tree.destroy();
    expect(getContainedReportBudgetSizeForTesting()).toBe(before);
    await Promise.resolve();
    expect(getContainedReportBudgetSizeForTesting()).toBe(before);
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

describe('failures after the callback returns (15.x)', () => {
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
      transaction(fn: () => void): { confirm(): void };
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
      expect(() => tree.transaction(() => tree.$.x(1))).toThrow('derived');
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
    // The refused rollback reports the capture failure to a throwing console.
    report.mockImplementation(() => {
      throw new Error('fail-on-console');
    });
    let thrown: unknown;
    try {
      tree.transaction(() => tree.$.x(1));
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
      expect(thrown).toBeInstanceOf(Error);
      expect(hasOpenCommitScope(tree as object)).toBe(false);
    } finally {
      tree.destroy();
    }
  });

  it('an automatic rollback refuses rather than overwrite an observer transaction on the same location', async () => {
    // An observer at the group close opens a second transaction on x. When the
    // first then fails, reversing it would destroy the second one's write.
    let armed = true;
    const tree = signalTree(
      { x: 0 },
      {
        enhancers: [transactions()],
        derived: ($) => ({
          inv: () => {
            if ($.x() !== 0 && armed) {
              armed = false;
              throw new Error('derived');
            }
            return $.x();
          },
        }),
      }
    ) as unknown as {
      $: {
        x: {
          (): number;
          (v: number): void;
          subscribe(fn: () => void): () => void;
        };
        inv: { subscribe(fn: () => void): () => void };
      };
      transaction(fn: () => void): { confirm(): void; rollback(): void };
      destroy(): void;
    };
    let second: { confirm(): void } | undefined;
    const offX = tree.$.x.subscribe(() => {
      if (tree.$.x() === 1 && !second) {
        second = tree.transaction(() => tree.$.x(2));
      }
    });
    const offInv = tree.$.inv.subscribe(() => undefined);
    let thrown: unknown;
    try {
      try {
        tree.transaction(() => tree.$.x(1));
      } catch (error) {
        thrown = error;
      }
      expect(String(thrown)).toContain(
        'written again before the transaction returned'
      );
      expect(second).toBeDefined();
      second?.confirm();
      await flush();
      expect(tree.$.x()).toBe(2);
      expect(hasOpenCommitScope(tree as object)).toBe(false);
    } finally {
      offX();
      offInv();
      tree.destroy();
    }
  });

  it('an automatic rollback refuses rather than overwrite an observer plain write', async () => {
    const tree = signalTree({ a: 0, b: 0 }, { enhancers: [transactions()] });
    const host = tree as unknown as Record<symbol, unknown>;
    const previous = host[MUTATION_CAPTURE_RUNTIME];
    host[MUTATION_CAPTURE_RUNTIME] = {
      isCaptureActive: () => false,
      activateCapture: () => () => {
        throw new Error('capture release failed');
      },
    };
    // In the flush before the handle exists, an observer writes b after the
    // transaction did.
    const off = observeWrites((frame) => {
      if (frame.path === 'a' && tree.$.b() !== 10) tree.$.b(10);
    });
    let thrown: unknown;
    try {
      tree.transaction(() => {
        tree.$.a(1);
        tree.$.b(1);
      });
    } catch (error) {
      thrown = error;
    } finally {
      host[MUTATION_CAPTURE_RUNTIME] = previous;
      off();
    }
    try {
      expect(String(thrown)).toContain(
        'written again before the transaction returned'
      );
      expect(tree.$.b()).toBe(10);
      expect(hasOpenCommitScope(tree as object)).toBe(false);
    } finally {
      tree.destroy();
    }
  });

  it('control: an observer write elsewhere does not stop the automatic rollback', async () => {
    const tree = signalTree({ a: 0, c: 0 }, { enhancers: [transactions()] });
    const host = tree as unknown as Record<symbol, unknown>;
    const previous = host[MUTATION_CAPTURE_RUNTIME];
    const failure = new Error('capture release failed');
    host[MUTATION_CAPTURE_RUNTIME] = {
      isCaptureActive: () => false,
      activateCapture: () => () => {
        throw failure;
      },
    };
    const off = observeWrites((frame) => {
      if (frame.path === 'a' && tree.$.c() !== 10) tree.$.c(10);
    });
    try {
      expect(() => tree.transaction(() => tree.$.a(1))).toThrow(failure);
      expect(tree.$.a()).toBe(0);
      expect(tree.$.c()).toBe(10);
    } finally {
      host[MUTATION_CAPTURE_RUNTIME] = previous;
      off();
      tree.destroy();
    }
  });

  it('control: an observer write to another row does not stop the automatic rollback', async () => {
    type Row = { id: string; v: number };
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    tree.$.rows.addOne({ id: 'A', v: 0 });
    tree.$.rows.addOne({ id: 'B', v: 0 });
    await flush();
    const host = tree as unknown as Record<symbol, unknown>;
    const previous = host[MUTATION_CAPTURE_RUNTIME];
    const failure = new Error('capture release failed');
    host[MUTATION_CAPTURE_RUNTIME] = {
      isCaptureActive: () => false,
      activateCapture: () => () => {
        throw failure;
      },
    };
    const off = observeWrites((frame) => {
      if (frame.path === 'rows.A' && tree.$.rows.byIdOrFail('B')().v !== 9) {
        tree.$.rows.updateOne('B', { v: 9 });
      }
    });
    try {
      expect(() =>
        tree.transaction(() => tree.$.rows.updateOne('A', { v: 1 }))
      ).toThrow(failure);
      expect(tree.$.rows.byIdOrFail('A')().v).toBe(0);
      expect(tree.$.rows.byIdOrFail('B')().v).toBe(9);
    } finally {
      host[MUTATION_CAPTURE_RUNTIME] = previous;
      off();
      tree.destroy();
    }
  });

  it('a throwing callback refuses rollback over a later observer write', async () => {
    // Deliberate correction of the 15.3.0 compatibility characterization:
    // callback failure cannot authorize overwriting a later writer. The red
    // transaction-reentrant-order safety tests demonstrated that corruption.
    type Row = { id: string; v: number };
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    tree.$.rows.addOne({ id: 'A', v: 0 });
    await flush();
    const off = observeWrites((frame) => {
      if (frame.path === 'rows.A' && tree.$.rows.byIdOrFail('A')().v === 1) {
        tree.$.rows.updateOne('A', { v: 5 });
      }
    });
    const boom = new Error('boom');
    try {
      let failure: unknown;
      try {
        tree.transaction(() => {
          tree.$.rows.updateOne('A', { v: 1 });
          throw boom;
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toMatchObject({
        code: 'SIGNALTREE_ROLLBACK_FAILED',
        cause: { kind: 'effect-validation-failed', callbackError: boom },
      });
      await flush();
      expect(tree.$.rows.byIdOrFail('A')().v).toBe(5);
      expect(peekInternalTransactionRuntime(tree)?.getPendingTurnCount()).toBe(
        0
      );
      expect(hasOpenCommitScope(tree)).toBe(false);
    } finally {
      off();
      tree.destroy();
    }
  });

  it('characterizes v15 explicit refusal: handle survives but consequences release', () => {
    // Existing compatibility behavior, not the v16 pending-consequence target.
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const runtime = peekInternalTransactionRuntime(tree);
    if (!runtime) throw new Error('missing transaction runtime');
    runtime.setHistoryRetention(10);
    const port = getTreeRealizationPort(tree.$ as object);
    if (!port) throw new Error('missing realization port');
    const validate = port.validateEffects;
    let consequences = 0;
    const pending = tree.transaction(() => {
      tree.$.x(1);
      scheduleDurableConsequence({
        claimant: tree,
        key: 'explicit-refusal',
        run: () => {
          consequences++;
        },
      });
    });
    try {
      expect(consequences).toBe(0);
      port.validateEffects = () => ({ kind: 'structural-drift' });
      expect(() => pending.rollback()).toThrow('Transaction rollback refused');
      expect(tree.$.x()).toBe(1);
      expect(runtime.getConfirmedTurnCount()).toBe(0);
      expect(consequences).toBe(1);
      expect(hasOpenCommitScope(tree as object)).toBe(false);
      port.validateEffects = validate;
      pending.confirm();
      expect(runtime.getConfirmedTurnCount()).toBe(1);
      expect(consequences).toBe(1);
    } finally {
      port.validateEffects = validate;
      tree.destroy();
    }
  });

  it.each(['callback', 'release'] as const)(
    'automatic realization refusal has consistent settlement: %s',
    (phase) => {
      const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
      const runtime = peekInternalTransactionRuntime(tree);
      if (!runtime) throw new Error('missing transaction runtime');
      runtime.setHistoryRetention(10);
      const events: string[] = [];
      const off = getTransactionLifecycleChannel(tree as object).subscribe(
        (event) => void events.push(event.kind)
      );
      const port = getTreeRealizationPort(tree.$ as object);
      if (!port) throw new Error('missing realization port');
      const validate = port.validateEffects;
      const host = tree as unknown as Record<symbol, unknown>;
      const capture = host[MUTATION_CAPTURE_RUNTIME];
      const failure = new Error(phase);
      let consequences = 0;
      port.validateEffects = () => ({ kind: 'structural-drift' });
      if (phase === 'release') {
        host[MUTATION_CAPTURE_RUNTIME] = {
          isCaptureActive: () => false,
          activateCapture: () => () => {
            throw failure;
          },
        };
      }
      try {
        let caught: unknown;
        try {
          tree.transaction(() => {
            tree.$.x(1);
            scheduleDurableConsequence({
              claimant: tree,
              key: 'refusal-test',
              run: () => {
                consequences++;
              },
            });
            scheduleDurableConsequence({
              claimant: tree,
              key: 'secondary-failure',
              run: () => {
                throw new Error('consequence failed');
              },
            });
            if (phase === 'callback') throw failure;
          });
        } catch (error) {
          caught = error;
        }
        expect(caught).toMatchObject({
          cause: {
            kind: 'effect-validation-failed',
            callbackError: phase === 'callback' ? failure : undefined,
            cause: { kind: 'structural-drift' },
          },
        });
        expect(String(caught)).toContain('Transaction rollback refused');
        if (phase === 'release') {
          expect(report.mock.calls.some((args: unknown[]) =>
            args.includes(failure) && args.some((arg: unknown) =>
              String(arg).includes('a post-callback step whose rollback was then refused')
            )
          )).toBe(true);
        }
        expect(tree.$.x()).toBe(1);
        expect(consequences).toBe(1);
        expect(hasOpenCommitScope(tree as object)).toBe(false);
        expect({ confirmed: runtime.getConfirmedTurnCount(), events }).toEqual({
          confirmed: 1,
          events: ['opened', 'staged', 'confirmed'],
        });
      } finally {
        port.validateEffects = validate;
        host[MUTATION_CAPTURE_RUNTIME] = capture;
        off();
        tree.destroy();
      }
    }
  );

  it.each(['callback', 'release'] as const)(
    'automatic compensation success discards consequences: %s',
    (phase) => {
      const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
      const events: string[] = [];
      const off = getTransactionLifecycleChannel(tree as object).subscribe(
        (event) => void events.push(event.kind)
      );
      const host = tree as unknown as Record<symbol, unknown>;
      const capture = host[MUTATION_CAPTURE_RUNTIME];
      const failure = new Error(phase);
      let consequences = 0;
      if (phase === 'release')
        host[MUTATION_CAPTURE_RUNTIME] = {
          isCaptureActive: () => false,
          activateCapture: () => () => {
            throw failure;
          },
        };
      try {
        expect(() =>
          tree.transaction(() => {
            tree.$.x(1);
            scheduleDurableConsequence({
              claimant: tree,
              key: 'success-control',
              run: () => {
                consequences++;
              },
            });
            if (phase === 'callback') throw failure;
          })
        ).toThrow(failure);
        expect(tree.$.x()).toBe(0);
        expect(consequences).toBe(0);
        expect(hasOpenCommitScope(tree as object)).toBe(false);
        expect(events).toEqual(['opened', 'rolled-back']);
      } finally {
        host[MUTATION_CAPTURE_RUNTIME] = capture;
        off();
        tree.destroy();
      }
    }
  );

  it.each(['callback', 'release'] as const)(
    'automatic refusal preserves designated undo and redo: %s',
    async (phase) => {
      const tree = signalTree(
        { x: 0 },
        { enhancers: [transactions(), restoration()] }
      );
      const port = getTreeRealizationPort(tree.$ as object);
      if (!port) throw new Error('missing realization port');
      const validate = port.validateEffects;
      const host = tree as unknown as Record<symbol, unknown>;
      const capture = host[MUTATION_CAPTURE_RUNTIME];
      port.validateEffects = () => ({ kind: 'structural-drift' });
      if (phase === 'release')
        host[MUTATION_CAPTURE_RUNTIME] = {
          isCaptureActive: () => false,
          activateCapture: () => () => {
            throw new Error('release');
          },
        };
      let canUndoAtCommit: boolean | undefined;
      try {
        undoable(() => {
          expect(() =>
            tree.transaction(() => {
              tree.$.x(1);
              scheduleDurableConsequence({
                claimant: tree,
                key: 'history-at-commit',
                run: () => {
                  canUndoAtCommit = tree.canUndo();
                },
              });
              if (phase === 'callback') throw new Error('callback');
            })
          ).toThrow('Transaction rollback refused');
        });
        expect(canUndoAtCommit).toBe(true);
        port.validateEffects = validate;
        host[MUTATION_CAPTURE_RUNTIME] = capture;
        await flush();
        expect(tree.$.x()).toBe(1);
        tree.undo();
        expect(tree.$.x()).toBe(0);
        tree.redo();
        expect(tree.$.x()).toBe(1);
      } finally {
        port.validateEffects = validate;
        host[MUTATION_CAPTURE_RUNTIME] = capture;
        tree.destroy();
      }
    }
  );

  it('a refused automatic rollback is recorded as committed', async () => {
    const tree = signalTree({ x: 0, w: 0 }, { enhancers: [transactions()] });
    const events: string[] = [];
    const offLifecycle = getTransactionLifecycleChannel(
      tree as object
    ).subscribe((event) => void events.push(event.kind));
    const earlier = tree.transaction(() => tree.$.x(1));
    await flush();
    const host = tree as unknown as Record<symbol, unknown>;
    const previous = host[MUTATION_CAPTURE_RUNTIME];
    host[MUTATION_CAPTURE_RUNTIME] = {
      isCaptureActive: () => false,
      activateCapture: () => () => {
        throw new Error('capture release failed');
      },
    };
    const off = observeWrites((frame) => {
      if (frame.path === 'w' && tree.$.w() !== 10) tree.$.w(10);
    });
    try {
      events.length = 0;
      expect(() =>
        tree.transaction(() => {
          tree.$.x(2);
          tree.$.w(1);
        })
      ).toThrow('written again before the transaction returned');
      expect(events).toEqual(['opened', 'staged', 'confirmed']);
    } finally {
      host[MUTATION_CAPTURE_RUNTIME] = previous;
      off();
    }
    try {
      // The earlier transaction's rollback now knows about the committed x=2
      // and must not silently overwrite it.
      try {
        earlier.rollback();
      } catch {
        // refused: acceptable
      }
      expect(tree.$.x()).toBe(2);
    } finally {
      offLifecycle();
      tree.destroy();
    }
  });

  it('a callback that throws undefined still fails the transaction', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    let threw = false;
    let handle: unknown;
    try {
      handle = tree.transaction(() => {
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
    try {
      expect(() => tree.transaction(() => tree.$.x(1))).toThrow();
      expect(report).toHaveBeenCalledWith(
        expect.stringContaining('rollback was then refused'),
        failure
      );
    } finally {
      port.validateEffects = original;
      host[MUTATION_CAPTURE_RUNTIME] = previous;
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
      transaction(fn: () => void): { confirm(): void };
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
      tree.transaction(() => {
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

  it('a refused rollback after a capture-release failure does not blame the callback', async () => {
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
    let thrown: unknown;
    try {
      tree.transaction(() => tree.$.x(1));
    } catch (error) {
      thrown = error;
    } finally {
      port.validateEffects = original;
      host[MUTATION_CAPTURE_RUNTIME] = previous;
    }
    try {
      expect(thrown).toBeInstanceOf(Error);
      expect(
        (thrown as { cause?: { callbackError?: unknown } }).cause?.callbackError
      ).toBeUndefined();
      // 15.x has no recovery handle: a refused rollback leaves the writes live,
      // and the scope still settles.
      expect(tree.$.x()).toBe(1);
      expect(hasOpenCommitScope(tree as object)).toBe(false);
    } finally {
      tree.destroy();
    }
  });
});
