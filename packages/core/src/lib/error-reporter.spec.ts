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
