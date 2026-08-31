import { describe, expect, it, vi } from 'vitest';
import { undoable } from '../../lib/undoable';

import { createAuditTracker } from '../../lib/audit/audit';
import { history } from '../../lib/form-history/form-history';
import { signalTree } from '../../lib/signal-tree';
import { serialization } from '../serialization/serialization';
import { restoration } from './restoration';

/**
 * Characterization tests for the history defects documented as TODO 6a-6d.
 *
 * ## Why these exist
 *
 * These defects are DOCUMENTED on live surfaces but deliberately NOT fixed — 6a's
 * code fix is gated on the representation decision. Without tests, nothing catches a
 * silent change in behaviour, and the documentation quietly stops being true. That is
 * exactly how a defect report survived on four surfaces while being false: the claim
 * "collection mutations create no restoration history entry" came from asserting a counter in the
 * same tick as a `queueMicrotask` flush, and `undo()` was never called once.
 *
 * ## How to read a failure
 *
 * A failure here does NOT necessarily mean a regression. It may mean someone FIXED
 * the defect — which is good news, and means the docs citing it are now wrong. Each
 * test names the surfaces to update.
 *
 * These are not the same thing as `tools/verify-history-defects.mjs`, which is a
 * provenance generator for published figures and has deliberately inverted exit
 * codes. These are ordinary tests: they assert the behaviour the docs describe.
 *
 * ## The rule every assertion here follows
 *
 * Call `undo()` and inspect the resulting state. Reading `getRestorationHistory().length` or
 * `canUndo()` without a following `undo()` is not evidence.
 */

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('6b — createAuditTracker samples on a timer', () => {
  // The interval is the literal constant at lib/audit/audit.ts:156
  // (`setInterval(handleChange, 100)`) — cited rather than measured here.
  // If this fails, the tracker may have become event-driven. Update:
  //   docs/guides/restoration-in-production.md (the composition table row)
  //   TODO.md 6b
  it('two writes inside one sampling window collapse to one entry', async () => {
    const tree = signalTree({ n: 0 });
    const log: unknown[] = [];
    const stop = createAuditTracker(tree, log as never);
    await new Promise((r) => setTimeout(r, 120));
    const base = log.length;

    undoable(() => tree.$.n.set(1));
    tree.$.n.set(2); // same window
    await new Promise((r) => setTimeout(r, 250));
    stop();

    expect(log.length - base).toBe(1);
    // Outcome: the intermediate state is unrecoverable from the trail.
    expect(tree.$.n()).toBe(2);
  });

  it('write-then-revert inside one window is INVISIBLE to the trail', async () => {
    const tree = signalTree({ name: 'a' });
    const log: unknown[] = [];
    const stop = createAuditTracker(tree, log as never);
    await new Promise((r) => setTimeout(r, 120));
    const base = log.length;

    undoable(() => tree.$.name.set('TEMP'));
    tree.$.name.set('a'); // reverted in the same window
    await new Promise((r) => setTimeout(r, 250));
    stop();

    expect(log.length - base).toBe(0);
    expect(tree.$.name()).toBe('a');
  });
});

describe('6c — undo() after deserialize() (REPAIRED by opt-in eligibility)', () => {
  // ✅ FIXED, and not by fixing it. `deserialize()` is not an operation a user
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
    const make = () =>
      signalTree({ n: 0 }, { enhancers: [serialization(), restoration({})] });

    const source = make();
    undoable(() => source.$.n.set(7));
    await flush();
    const payload = source.serialize();

    const target = make();
    await flush();
    target.deserialize(payload);
    await flush();

    expect(target.$.n()).toBe(7);

    // The defect was `canUndo()` being true here, with the first undo throwing
    // the restore away.
    expect(target.canUndo()).toBe(false);

    target.undo();
    expect(target.$.n()).toBe(7);
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
      undoable(() => tree.$.n.set(i));
      await flush();
    }
    let spent = 0;
    while (tree.canUndo() && spent < 40) {
      tree.undo();
      spent++;
    }
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
