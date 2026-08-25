import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearTreeErrorListenersForTesting,
  onTreeError,
  reportTreeError,
  type TreeErrorEvent,
} from './internals/error-reporter';

/**
 * `onTreeError` — one place to observe every error the library catches.
 *
 * A capability audit against NGXS found `NgxsUnhandledErrorHandler` and nothing
 * equivalent anywhere else, ours included. Each marker caught its own errors and
 * turned them into local error state, which is correct and which also made them
 * invisible to anything wanting to see all of them: reporting to Sentry meant
 * wiring a per-marker `onError` at every call site, forever.
 *
 * The load-bearing property is that this is ADDITIVE. It must not be able to
 * change how any error is handled, and a listener that throws must not damage
 * the operation that reported to it — otherwise adding error *reporting* becomes
 * a source of errors, surfacing at whichever marker happened to report first.
 */
describe('onTreeError', () => {
  beforeEach(() => clearTreeErrorListenersForTesting());
  afterEach(() => clearTreeErrorListenersForTesting());

  it('delivers the event to a listener', () => {
    const seen: TreeErrorEvent[] = [];
    onTreeError((e) => seen.push(e));

    reportTreeError({ error: new Error('x'), treeId: 1 as never, operation: 'write', path: 'k' });

    expect(seen).toHaveLength(1);
    // ⚠️ `source` was DELETED by ERROR-SURFACE-2 — zero consumers ever
    // branched on it. Attribution is `treeId`, which is required.
    expect(seen[0].treeId).toBe(1);
    expect(seen[0].operation).toBe('write');
    expect(seen[0].path).toBe('k');
  });

  it('delivers to every listener', () => {
    let a = 0;
    let b = 0;
    onTreeError(() => a++);
    onTreeError(() => b++);

    reportTreeError({ error: 'e', treeId: 1 as never, operation: 'load' });

    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('unsubscribes', () => {
    let count = 0;
    const off = onTreeError(() => count++);
    reportTreeError({ error: 'e', treeId: 1 as never, operation: 'read' });
    off();
    reportTreeError({ error: 'e', treeId: 1 as never, operation: 'read' });

    expect(count).toBe(1);
  });

  it('with no listeners it is a no-op, not a throw', () => {
    expect(() =>
      reportTreeError({ error: 'e', treeId: 1 as never, operation: 'run' })
    ).not.toThrow();
  });

  describe('a listener that throws cannot damage anything', () => {
    it('reportTreeError still returns normally', () => {
      onTreeError(() => {
        throw new Error('listener blew up');
      });
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      expect(() =>
        reportTreeError({ error: 'original', treeId: 1 as never, operation: 'write' })
      ).not.toThrow();

      spy.mockRestore();
    });

    it('the OTHER listeners still receive the event', () => {
      // Order matters: a throwing listener registered first must not prevent
      // the reporting integration registered after it from seeing anything.
      const seen: TreeErrorEvent[] = [];
      onTreeError(() => {
        throw new Error('blew up');
      });
      onTreeError((e) => seen.push(e));
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      reportTreeError({ error: 'original', treeId: 1 as never, operation: 'write' });

      expect(seen).toHaveLength(1);
      spy.mockRestore();
    });

    it('reports the listener failure under ST2025, distinctly from the original', () => {
      onTreeError(() => {
        throw new Error('blew up');
      });
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      reportTreeError({ error: 'original', treeId: 1 as never, operation: 'write' });

      expect(spy.mock.calls.flat().join(' ')).toContain('ST2025');
      spy.mockRestore();
    });
  });
});

describe('the stored() marker reports through it', () => {
  beforeEach(() => clearTreeErrorListenersForTesting());
  afterEach(() => clearTreeErrorListenersForTesting());

  it('a failing write is observable globally, with no local onError wired', async () => {
    const { flushAllStoredSignals, stored } = await import('./markers/stored');
    const { signalTree } = await import('./signal-tree');
    const seen: TreeErrorEvent[] = [];
    onTreeError((e) => seen.push(e));

    const throwing: Storage = {
      length: 0,
      clear: () => undefined,
      key: () => null,
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    // ⚠️ CONSTRUCTED THROUGH A REAL TREE, not `createStoredSignal(marker)`.
    //
    // The direct call is a TEST-ONLY path — `createStoredSignal` lives in the
    // internal `lib/markers` barrel and `index.ts` never re-exports it — and it
    // supplies no materialization context, so the node has no owning registry.
    // Since ERROR-SURFACE-2 made `treeId` REQUIRED, a contextless node cannot
    // produce a truthful event and therefore reports nothing.
    //
    // Testing the direct call would have asserted the behaviour of a
    // construction no supported consumer can perform. The marker's actual
    // reporting is what this case is about, so it now goes through
    // `signalTree()`, where STORED-OWNER-INVARIANT-0 proved ownership is always
    // present.
    const tree = signalTree({
      value: stored('err-spec', 0, { storage: throwing, debounceMs: 0 }),
    });
    await new Promise((r) => queueMicrotask(r));
    (tree.$.value as unknown as { set(v: number): void }).set(1);
    // Forced rather than slept on: the write is debounced, and a test that
    // waits "long enough" is a flake waiting to happen.
    flushAllStoredSignals();
    await new Promise((r) => queueMicrotask(r));

    const warned = warn.mock.calls.length;
    warn.mockRestore();

    // Asserted FIRST: if the write never failed, nothing below means anything,
    // and a bare "expected false to be true" would send the reader looking in
    // entirely the wrong place. It did exactly that while this test was wrong.
    expect(warned, 'the storage write should have failed and warned').toBeGreaterThan(0);
    // ⚠️ WAS keyed on `source: 'stored'`. ERROR-SURFACE-2 deleted that field —
    // nothing branched on it and it duplicated `operation`. A stored failure is
    // now identified by its OPERATION and attributed by its `treeId`.
    const write = seen.find((e) => e.operation === 'write');
    expect(write, 'the stored write failure reported').toBeDefined();
    expect(write?.path).toBe('err-spec');
    expect(typeof write?.treeId).toBe('number');
  });
});
