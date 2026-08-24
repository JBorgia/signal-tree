import { describe, expect, it } from 'vitest';

import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { undoable } from './undoable';

/**
 * NOTIFIER-SCOPE-0 — BOUNDED IMPACT AUDIT, owed before RC.
 *
 * The defect, found by A2-4's control arm: the path notifier coalesces pending
 * entries by PATH STRING within a flush, with no tree qualification, and every
 * consumer subscribes with the wildcard `'**'` on a PROCESS-GLOBAL notifier.
 *
 * The audit classifies each wildcard consumer by what a masked or foreign event
 * costs it:
 *
 * ```text
 * OBSERVATION ONLY  a wrong event changes what is reported
 * SIDE EFFECT       a wrong event causes work to happen
 * AUTHORITY         a wrong event changes what the library considers true
 * ```
 *
 * ```text
 * devtools-impl.ts:1830     OBSERVATION ONLY — and it already guards with
 *                           `isPathOwnedByTree(path)`
 * diagnostic-journal.ts:117 OBSERVATION ONLY — S8 established it owns
 *                           behaviour, not authority
 * restoration.ts:2878       AUTHORITY — captures into restoration history and
 *                           maintains `externalTruthByPath`, the P0-C
 *                           protection map, keyed by BARE PATH STRING
 * transactions.ts:1154      AUTHORITY — captures the compensation record a
 *                           rollback replays
 * ```
 *
 * Two AUTHORITY consumers means the severity question cannot be answered by
 * reading the notifier. These tests ask what actually reaches them.
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('NOTIFIER-SCOPE-0: what does a second tree do to restoration history?', () => {
  it('CONTROL — a tree records its own designated write', async () => {
    const a = signalTree({ solo: 'a0' }, { enhancers: [restoration()] });
    await flush();

    undoable(() => a.$.solo.set('a1'));
    await flush();

    expect(a.canUndo()).toBe(true);
    a.undo();
    expect(a.$.solo()).toBe('a0');
  });

  it('⚠️ THE QUESTION — does tree B capture tree A write at the SAME path?', async () => {
    const a = signalTree({ shared: 'a0' }, { enhancers: [restoration()] });
    const b = signalTree({ shared: 'b0' }, { enhancers: [restoration()] });
    await flush();

    undoable(() => a.$.shared.set('a1'));
    await flush();

    const bBefore = b.$.shared();
    const bCanUndo = b.canUndo();

    // If the wildcard subscription is unqualified, tree B's restoration has
    // just recorded a write that never happened to tree B — and an undo on B
    // would then apply tree A's value to tree B's state.
    if (bCanUndo) {
      b.undo();
      await flush();
    }

    expect(a.$.shared()).toBe('a1');
    expect(bBefore).toBe('b0');
    // The assertion that matters: B's own state must be unchanged by anything
    // that happened to A, whatever B's history did or did not record.
    expect(b.$.shared()).toBe('b0');
  });

  /**
   * ⚠️ WAS KNOWN RED, now fixed by registry-qualified ownership. Measured before:
   * `b.undo()` sets tree B to **'a0'**, tree A's baseline. Not a lost undo — a
   * FOREIGN value applied to B's state as if B had authored it.
   *
   */
  it('⚠️ THE ORIGINAL DEFECT — same path, both trees written in ONE flush', async () => {
    const a = signalTree({ dup: 'a0' }, { enhancers: [restoration()] });
    const b = signalTree({ dup: 'b0' }, { enhancers: [restoration()] });
    await flush();

    // Both writes land in the SAME notifier flush, which is the condition that
    // makes path-string coalescing observable.
    undoable(() => a.$.dup.set('a1'));
    undoable(() => b.$.dup.set('b1'));
    await flush();

    const aUndo = a.canUndo();
    const bUndo = b.canUndo();

    // Neither tree may lose its own undo to the other's write.
    expect(aUndo).toBe(true);
    expect(bUndo).toBe(true);

    a.undo();
    b.undo();
    await flush();

    expect(a.$.dup()).toBe('a0');
    expect(b.$.dup()).toBe('b0');
  });
});

describe('NOTIFIER-SCOPE-0: what does it do to transaction compensation?', () => {
  it('CONTROL — a lone tree rolls back its own write', async () => {
    const a = signalTree(
      { only: 'a0' },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();

    const p = a.transaction(() => a.$.only.set('a1'));
    await flush();
    p.rollback();
    await flush();

    expect(a.$.only()).toBe('a0');
  });

  /**
   * ⚠️ WAS KNOWN RED, and the more serious of the two. Measured before: `pa.rollback()`
   * leaves tree A at **'a1'** — the rollback SILENTLY DOES NOTHING, because
   * tree B's same-path write coalesced over A's capture inside the flush. A
   * transaction reporting success while its compensation was dropped is the
   * worst failure mode this release has found.
   *
   */
  it('⚠️ two trees, same path, one rolls back and the other must not move', async () => {
    const a = signalTree(
      { tx: 'a0' },
      { enhancers: [restoration(), transactions()] }
    );
    const b = signalTree(
      { tx: 'b0' },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();

    const pa = a.transaction(() => a.$.tx.set('a1'));
    b.$.tx.set('b1'); // ordinary committed work on an unrelated tree
    await flush();

    pa.rollback();
    await flush();

    expect(a.$.tx()).toBe('a0');
    // A compensation that replayed a foreign capture would reach across here.
    expect(b.$.tx()).toBe('b1');
  });
});
