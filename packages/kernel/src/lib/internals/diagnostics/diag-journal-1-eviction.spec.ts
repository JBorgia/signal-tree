import { describe, expect, it } from 'vitest';

import { createDiagnosticJournal } from './diagnostic-journal';
import { restoration } from '../../../enhancers/restoration/restoration';
import { signalTree } from '../../signal-tree';

/**
 * DIAG-JOURNAL-1 · F6 — the bound is real, and eviction releases what the
 * journal was holding.
 *
 * This case deliberately puts an OBJECT into the observed state, because a
 * journal designed to retain no values at all would make the strongest retention
 * falsifier vacuous. Two things have to be true together:
 *
 * ```text
 * while the record is retained   the journal may hold the ordinary value
 * once the record is evicted     it must hold it no longer
 * ```
 *
 * ## Three arms, because two would not discriminate
 *
 * The first version of this file used `undoable()` writes and failed — the
 * payload survived eviction. That was the TEST, not the product: a designated
 * write is retained by restoration history, which legitimately holds the value
 * and has nothing to do with the journal. Two arms could not tell "the journal
 * still holds it" from "something else does".
 *
 * ```text
 * A  no journal            payload must DIE      -> nothing else retains it
 * B  journal, retained     payload must LIVE     -> the journal really holds it
 * C  journal, evicted      payload must DIE      -> the bound is real
 * ```
 *
 * Requires `--expose-gc`. A WeakRef that is merely *eligible* proves nothing, so
 * without the flag this FAILS rather than skipping: a skipped retention test
 * reads as evidence in a green run and is not.
 *
 *     NODE_OPTIONS=--expose-gc npx vitest run …/diag-journal-1-eviction.spec.ts
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const collect = () => {
  const gc = (globalThis as { gc?: () => void }).gc;
  for (let i = 0; i < 6; i++) gc?.();
};

/** Real pressure, so the target is genuinely collected rather than merely eligible. */
const pressure = async () => {
  for (let round = 0; round < 4; round++) {
    collect();
    await new Promise((r) => setTimeout(r, 20));
  }
  let ballast: unknown[] = [];
  for (let i = 0; i < 200_000; i++) ballast.push({ i });
  ballast = [];
  collect();
  await new Promise((r) => setTimeout(r, 20));
  collect();
};

/**
 * Write an object into the tree with a PLAIN (undesignated) write, drop every
 * reference to it outside the journal, and report whether it survives.
 *
 * Undesignated deliberately: under opt-in eligibility an undesignated write is
 * never admitted to restoration history, so restoration is not a competing
 * retainer and the only candidate left is the journal.
 */
const arm = async (options: {
  journal: boolean;
  fillersAfter: number;
}): Promise<{ alive: boolean; retainedTurns: number }> => {
  // `restoration()` is present only because the path notifier — the journal's
  // observation seam — is not wired on a bare tree: arm B first measured ZERO
  // retained turns, which was the journal seeing nothing rather than the journal
  // releasing something. Under opt-in eligibility an UNDESIGNATED write is never
  // admitted to restoration history, so restoration is still not a competing
  // retainer here; arm A is what proves that.
  const tree = signalTree(
    { payload: null as { marker: string } | null },
    { enhancers: [restoration()] }
  );
  await flush();

  const journal = options.journal
    ? createDiagnosticJournal(tree as unknown as object, { maxTurns: 2 })
    : undefined;

  let payload: { marker: string } | null = { marker: 'evict-me' };
  const ref = new WeakRef(payload);
  tree.$.payload(payload);
  await flush();

  // Every reference outside the journal is gone, the tree's own included.
  payload = null;
  tree.$.payload(null);
  await flush();

  for (let i = 0; i < options.fillersAfter; i++) {
    tree.$.payload({ marker: `filler-${i}` });
    await flush();
  }
  tree.$.payload(null);
  await flush();

  const retainedTurns = journal?.turns().length ?? 0;
  await pressure();
  const alive = ref.deref() !== undefined;
  journal?.dispose();
  return { alive, retainedTurns };
};

describe('DIAG-JOURNAL-1 F6: bounded eviction releases journal-held payloads', () => {
  it('requires --expose-gc', () => {
    expect(typeof (globalThis as { gc?: unknown }).gc).toBe('function');
  });

  it('arm A — with NO journal the payload dies, so nothing else retains it', async () => {
    const { alive } = await arm({ journal: false, fillersAfter: 0 });
    expect(alive).toBe(false);
  });

  it('arm B — while the record is retained, the journal holds the value', async () => {
    const { alive, retainedTurns } = await arm({
      journal: true,
      fillersAfter: 0,
    });

    // The positive half of the contract: diagnostic values ARE retained while
    // their record is. Without this the eviction result below would be
    // satisfied by a journal that never held anything.
    expect(alive).toBe(true);
    expect(retainedTurns).toBeGreaterThan(0);
  });

  it('arm C — once the record is evicted, the journal releases it', async () => {
    const { alive, retainedTurns } = await arm({
      journal: true,
      fillersAfter: 4,
    });

    // The bound is real, and it is the journal's own bound doing the work:
    // same tree, same writes, same pressure as arm B — only the eviction
    // differs.
    expect(retainedTurns).toBe(2);
    expect(alive).toBe(false);
  });
});
