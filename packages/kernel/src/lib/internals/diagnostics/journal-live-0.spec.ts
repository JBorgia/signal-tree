/**
 * JOURNAL-LIVE-0 — suitability falsifiers for adopting `createDiagnosticJournal`
 * as S2's capture engine (S2-SPEC §S2-1).
 *
 * ⚠️ Unwired, well-tested code. That combination already misled the S1
 * inventory once, so it gets a live importer only after these pass.
 *
 * ⚠️ PRECONDITION FOUND WHILE WRITING THIS. The journal materializes a turn on
 * a NOTIFIER FLUSH, and nothing drives one on a bare tree — `path-notifier`
 * names restoration as the flush source. A first harness using a bare tree
 * captured NOTHING, which made the cross-tree falsifier pass VACUOUSLY. A
 * falsifier that cannot fail is worse than no falsifier, so the composition is
 * pinned explicitly below.
 */
import { describe, expect, it } from 'vitest';

import { restoration } from '../../../enhancers/restoration/restoration';
import { transactions } from '../../../enhancers/transactions/transactions';
import { signalTree } from '../../signal-tree';
import { createDiagnosticJournal } from './diagnostic-journal';

type Doc = { title: string; count: number };

type Tree = {
  $: Record<string, (v?: unknown) => unknown>;
  transaction(fn: () => void): { confirm(): void };
};

/** The composition the journal's own passing specs use. */
const doc = (title = 'a') =>
  signalTree({ title, count: 0 } as Doc, {
    enhancers: [restoration(), transactions()],
  } as never) as never as Tree;

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const effectsOf = (j: { turns(): readonly { effects: readonly unknown[] }[] }) =>
  j.turns().flatMap((t) => t.effects) as readonly {
    path: string;
    before: unknown;
    after: unknown;
    origin?: string;
    participation?: string;
  }[];

describe('JOURNAL-LIVE-0', () => {
  it('0. PRECONDITION: capture requires a flush driver', async () => {
    const tree = doc('start');
    const journal = createDiagnosticJournal(tree);
    try {
      tree.$['title']('changed');
      await settle();
      // If this ever returns 0, every falsifier below is vacuous.
      expect(effectsOf(journal).length).toBeGreaterThan(0);
    } finally {
      journal.dispose();
    }
  });

  it('captures address and before/after for an authored write', async () => {
    const tree = doc('start');
    const journal = createDiagnosticJournal(tree);
    try {
      tree.$['title']('changed');
      await settle();

      const title = effectsOf(journal).find((e) => e.path === 'title');
      expect(title).toBeDefined();
      expect(title?.before).toBe('start');
      expect(title?.after).toBe('changed');
    } finally {
      journal.dispose();
    }
  });

  /**
   * FALSIFIER 1 — the one that matters most.
   *
   * NOTIFIER-SCOPE-0 was exactly this bug here: a process-global notifier
   * coalescing two trees' writes. `createDiagnosticJournal` TAKES a tree, which
   * is not the same as being scoped to one — and it subscribes `'**'` on the
   * global notifier.
   */
  /**
   * ⚠️ PINNED AS FAILING — this is a REAL DEFECT, not a test bug.
   *
   * `it.fails` asserts the current broken behaviour, so the suite stays green
   * while the bug is documented, and this test starts failing the moment the
   * journal is repaired — which is the prompt to flip it back to `it`.
   *
   * The repair is narrow and the kernel already has the mechanism:
   * `WriteMetadata.ownerId` exists for exactly this, and its own doc says the
   * notifier is process-global "so they can decline them". `restoration.ts` and
   * `transactions.ts` both filter on it. The journal does not.
   */
  it.fails('1. does not capture another tree\'s writes — KNOWN DEFECT', async () => {
    const a = doc('a');
    const b = doc('b');
    const journalA = createDiagnosticJournal(a);
    try {
      b.$['title']('written-by-B');
      await settle();

      expect(effectsOf(journalA).map((e) => e.after)).not.toContain('written-by-B');
    } finally {
      journalA.dispose();
    }
  });

  it('6. dispose() stops capture', async () => {
    const tree = doc();
    const journal = createDiagnosticJournal(tree);

    tree.$['title']('before-dispose');
    await settle();
    expect(effectsOf(journal).length).toBeGreaterThan(0);

    journal.dispose();
    tree.$['title']('after-dispose');
    await settle();

    expect(effectsOf(journal).map((e) => e.after)).not.toContain('after-dispose');
  });

  it('7. retention overflow evicts the oldest', async () => {
    const tree = doc();
    const journal = createDiagnosticJournal(tree, { maxTurns: 3 });
    try {
      for (let i = 1; i <= 10; i++) {
        tree.$['count'](i);
        await settle();
      }
      expect(journal.turns().length).toBeLessThanOrEqual(3);

      const values = effectsOf(journal).map((e) => e.after);
      expect(values).not.toContain(1);
      expect(values).toContain(10);
    } finally {
      journal.dispose();
    }
  });
});
