import { describe, expect, it } from 'vitest';

import { signalTree } from '../../lib/signal-tree';
import { timeTravel } from '../time-travel/time-travel';
import { transactions } from './transactions';

/**
 * TX-SURFACE-0 — the ownership boundary, enforced at the TYPE level.
 *
 * A runtime check that `transaction` is `undefined` proves the current build.
 * This file proves the CONTRACT, so the duplication cannot come back the way it
 * arrived: silently, through an interface extension nobody read.
 *
 * `TimeTravelMethods extends TransactionMethods` is what put a second
 * `transaction()` on the public surface. If someone re-adds that extension, the
 * `@ts-expect-error` below stops being an error and this file fails to compile —
 * which `check-spec-types` runs on.
 */

describe('TX-SURFACE-0 typing: transaction() belongs to transactions()', () => {
  it('timeTravel() alone does NOT type a transaction() method', () => {
    const tree = signalTree(
      { n: 0 },
      { enhancers: [timeTravel({ maxHistorySize: 10 })] }
    );

    // @ts-expect-error transaction() belongs to transactions(), not timeTravel()
    tree.transaction(() => {
      tree.$.n.set(1);
    });

    // Restoration is still timeTravel's, and still typed.
    expect(typeof tree.undo).toBe('function');
    expect(typeof tree.canUndo).toBe('function');
  });

  it('the composition types BOTH capabilities', async () => {
    const tree = signalTree(
      { n: 0 },
      { enhancers: [transactions(), timeTravel({ maxHistorySize: 10 })] }
    );

    // Both present, from their own owners, with no cast.
    const pending = tree.transaction(() => {
      tree.$.n.set(1);
    });
    pending.confirm();
    await Promise.resolve();
    await Promise.resolve();

    expect(tree.$.n()).toBe(1);
    tree.undo();
    await Promise.resolve();
    await Promise.resolve();
    expect(tree.$.n()).toBe(0);
  });
});
