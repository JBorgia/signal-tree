import { describe, expect, it, vi } from 'vitest';
import { undoable } from '../../lib/undoable';

import { signalTree } from '../../lib/signal-tree';
import { link } from '../../index';
import { restoration } from './restoration';

/**
 * Surviving restoration regressions from the historical TODO 6a–6d audit.
 * External acquisition is not undoable user work, and invalid history limits
 * report a diagnostic rather than silently disabling undo. Each history claim
 * calls undo() and inspects state; a counter alone is insufficient evidence.
 * The old audit tracker cases retired with their unexported implementation.
 */

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('6c — undo() after external Link retrieval (REPAIRED by opt-in eligibility)', () => {
  // ✅ FIXED, and not by fixing it. `retrieve()` is not an operation a user
  // authored, so it is never designated and never becomes an undo step — there
  // is nothing for a first undo to discard.
  //
  // Designating the restore to keep the old assertion passing would have
  // REINTRODUCED the defect, which is why this waited for the flip instead of
  // being migrated with the earlier batches.
  //
  // Docs updated with this change:
  //   docs/guides/restoration-in-production.md
  //   TODO.md 6c
  it('a restored payload is NOT an undo step, so undo cannot discard it', async () => {
    const make = () => signalTree({ n: 0 }, { enhancers: [restoration({})] });

    const source = make();
    undoable(() => source.$.n(7));
    await flush();
    const payload = source.$();

    const target = make();
    await flush();
    const connection = link(target.$, { get: () => payload });
    try {
      await connection.retrieve();
      await flush();

      expect(target.$.n()).toBe(7);

      // The defect was `canUndo()` being true here, with the first undo throwing
      // the restore away.
      expect(target.canUndo()).toBe(false);

      target.undo();
      expect(target.$.n()).toBe(7);
    } finally {
      connection.dispose();
      target.destroy();
      source.destroy();
    }
  });
});

describe('6d — maxHistorySize validation (FIXED in 14.1.1)', () => {
  // Ordinary regression tests: this defect IS fixed.
  const usableSteps = async (cfg?: number) => {
    const tree = signalTree(
      { n: 0 },
      {
        enhancers: [
          restoration(cfg === undefined ? {} : { maxHistorySize: cfg }),
        ],
      }
    );
    await flush();
    for (let i = 1; i <= 10; i++) {
      undoable(() => tree.$.n(i));
      await flush();
    }
    let spent = 0;
    while (tree.canUndo() && spent < 40) {
      tree.undo();
      spent++;
    }
    tree.destroy();
    return spent;
  };

  it('maxHistorySize N retains N undoable turns', async () => {
    expect(await usableSteps(1)).toBe(1);
    expect(await usableSteps(2)).toBe(2);
    expect(await usableSteps(5)).toBe(5);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'maxHistorySize %p no longer silently disables undo',
    async (bad) => {
      const spy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const steps = await usableSteps(bad as number);
      spy.mockRestore();

      // Falls back to the default of 50, so all 10 writes stay undoable.
      expect(steps).toBe(10);
    }
  );

  it('reports ST2032 rather than failing silently', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await usableSteps(-1);
    const said = spy.mock.calls.flat().join(' ');
    spy.mockRestore();

    expect(said).toContain('ST2032');
  });
});
