import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { withWriteContext } from '../../lib/write-context';
import { transactions } from './transactions';

/**
 * R6-LIVENESS-0 — preregistered in docs/research/review-correctness-0/README.md.
 *
 * Closes the SETTLEMENT axis for a REFUSED rejection. It exists because a
 * previous reading of case 15 (`proposal-rejection-0.spec.ts:463`) called the
 * outcome "stranded", and nothing had measured that.
 *
 * What case 15 established: after the refusal throws, `x` is still 1 and the
 * server's row survives. What it did NOT establish is the proposal's lifecycle
 * afterwards. `reject()` assigns `settled` only once `pending.rollback()`
 * RETURNS (`transactions.ts:2384-2390`), so a throw leaves `settled` undefined
 * and `inspect()` falling back to a live read. The turn may therefore still be
 * OPEN and recoverable rather than half-settled.
 *
 * Three materially different outcomes, only the last of which is "stranded":
 *
 *   REFUSED_RECOVERABLE   refused, still pending, conflict resolvable,
 *                         retry succeeds
 *   REFUSED_POISONED      still nominally pending, can never settle correctly
 *   PARTIALLY_SETTLED     considered rejected/closed while a speculative
 *                         contribution remains live
 *
 * This is a CHARACTERIZATION pass. Assertions record measured behaviour; they
 * are not aspirations. R6 must not be "fixed" before it is characterized — it
 * may indicate the optimistic-live proposal model is wrong rather than buggy.
 *
 * ══ RE-CHARACTERIZED 2026-09-24 — THE DEFECT IS FIXED ON THIS LINE. ══
 *
 * The original measurement (2026-09-23, against 15.2.1 and the then-current v16
 * tree) found PARTIALLY_SETTLED: the refusal retired the turn, the retry
 * reported success while reversing nothing, and clearing the conflict never
 * made the reversal available again. Those numbers are preserved per case in
 * the `WAS` comments below, and independently in
 * `docs/research/v15-safety-audit/README.md`, which measured them against
 * PUBLISHED npm tarballs rather than source.
 *
 * The containment fix — rollback decides before it settles — landed here with
 * the 15.3.0 merge, so every one of those assertions became a FALSE statement
 * about this code. A characterization file whose own rule is "assertions record
 * measured behaviour" cannot keep asserting behaviour that no longer exists, so
 * they are re-measured rather than deleted or skipped: the file stays a live
 * tripwire, and the original finding stays legible beside each new value.
 *
 * The CONTRACT that came out of this characterization is H1..H9 in
 * `hotfix-15-2-2-safety.spec.ts`. This file remains the axis-by-axis
 * measurement that produced it; that file is what 16.0 must satisfy.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

/** A server/outside write: participation 'realized', not authored locally. */
const realization = (fn: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, fn);

/** `false` when the reject was accepted, otherwise the refusal kind. */
const tryReject = (proposal: { reject(): void }): false | unknown => {
  try {
    proposal.reject();
    return false;
  } catch (error) {
    return (error as { cause?: { kind?: unknown } })?.cause?.kind ?? 'error';
  }
};

const pendingCount = (tree: unknown): number =>
  (
    tree as { __transactions: { getPendingTurnCount(): number } }
  ).__transactions.getPendingTurnCount();

const confirmedCount = (tree: unknown): number =>
  (
    tree as { __transactions: { getConfirmedTurnCount(): number } }
  ).__transactions.getConfirmedTurnCount();

const rowTree = () =>
  signalTree(
    {
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
      x: 0,
    },
    { enhancers: [transactions()] }
  );

/** The R6 scenario, up to and including the refused rejection. */
const arriveAtRefusal = async () => {
  const tree = rowTree();
  tree.$.rows.addOne({ id: 'A', name: 'Original' });
  await flush();

  const proposal = tree.propose(() => {
    tree.$.x(1);
    tree.$.rows.removeOne('A');
  });
  await flush();

  const pendingWhileOutstanding = pendingCount(tree);

  // Newer truth re-creates the same business key as a DIFFERENT subject.
  realization(() => tree.$.rows.addOne({ id: 'A', name: 'FromServer' }));
  await flush();

  const refusal = tryReject(proposal);

  return { tree, proposal, pendingWhileOutstanding, refusal };
};

describe('R6-LIVENESS-0 / 1 — the refusal itself (pins case 15)', () => {
  it('refuses through effect-validation, preserves S2, leaves x proposed', async () => {
    const { tree, refusal } = await arriveAtRefusal();

    expect(refusal).toBe('effect-validation-failed');
    // Newer truth survives — this was never in doubt.
    expect(tree.$.rows.byId('A')?.()?.name).toBe('FromServer');
    // The turn's unrelated scalar is still at its proposed value.
    expect(tree.$.x()).toBe(1);
  });
});

describe('R6-LIVENESS-0 / 2 — SETTLEMENT axis: is the proposal still open?', () => {
  it('MEASURED: the refusal KEEPS the pending turn', async () => {
    const { tree, proposal, pendingWhileOutstanding } = await arriveAtRefusal();

    const pendingAfterRefusal = pendingCount(tree);
    const inspection = proposal.inspect();

    expect(pendingWhileOutstanding).toBe(1);
    // WAS 0 (measured 2026-09-23): `reject()` threw, the facade never assigned
    // `settled`, and the kernel had ALREADY dropped the turn — the facade
    // believed the proposal was outstanding while the kernel believed it was
    // gone. PARTIALLY_SETTLED, and the origin of law L2.
    //
    // NOW 1. Rollback decides before it settles, so a refusal retires nothing
    // and the facade's view and the kernel's view agree again.
    expect(pendingAfterRefusal).toBe(1);
    expect(inspection).toBeDefined();
  });

  it('MEASURED: did the refused turn become a CONFIRMED turn?', async () => {
    const tree = rowTree();
    tree.$.rows.addOne({ id: 'A', name: 'Original' });
    await flush();
    const confirmedBefore = confirmedCount(tree);

    const proposal = tree.propose(() => {
      tree.$.x(1);
      tree.$.rows.removeOne('A');
    });
    await flush();
    realization(() => tree.$.rows.addOne({ id: 'A', name: 'FromServer' }));
    await flush();
    tryReject(proposal);

    // The decisive question: is x=1 now merely orphaned live state, or did
    // the kernel promote the rejected turn into the confirmed ledger?
    expect(confirmedCount(tree) - confirmedBefore).toBe(0);
  });
});

describe('R6-LIVENESS-0 / 3 — is reject retryable while the conflict stands?', () => {
  it('MEASURED: the second reject refuses identically, not "ok"', async () => {
    const { tree, proposal } = await arriveAtRefusal();

    const second = tryReject(proposal);

    // WAS false — it returned cleanly, having reversed nothing, so code that
    // retries on failure believed it had recovered. That was the most dangerous
    // single measurement in this file.
    //
    // NOW the same refusal as the first attempt, because the turn still holds
    // its settlement authority and the conflict still stands.
    expect(second).toBe('effect-validation-failed');
    // The speculative value is still live, which is correct: nothing reversed.
    expect(tree.$.x()).toBe(1);
    expect(tree.$.rows.byId('A')?.()?.name).toBe('FromServer');
  });
});

describe('R6-LIVENESS-0 / 4 — RECOVERY: clear the conflict, then reject', () => {
  it('MEASURED: clearing the conflict DOES make the rejection reversible', async () => {
    const { tree, proposal } = await arriveAtRefusal();

    realization(() => tree.$.rows.removeOne('A'));
    await flush();

    const retry = tryReject(proposal);

    // WAS: reported success while `x` never returned to baseline — the
    // reversal was permanently lost, because the turn had been retired by the
    // FIRST refusal and there was nothing left to reverse.
    //
    // NOW the retry genuinely succeeds and `x` returns to 0. This is the case
    // that makes the refusal RECOVERABLE rather than poisoned, and it is the
    // whole point of keeping the turn pending.
    expect(retry).toBe(false);
    expect(tree.$.x()).toBe(0);
    expect(pendingCount(tree)).toBe(0);
  });
});

describe('R6-LIVENESS-0 / 5 — is accept still legal after a refused reject?', () => {
  it('MEASURED: accept is LEGAL after a refused reject', async () => {
    const { tree, proposal } = await arriveAtRefusal();

    let message = '';
    try {
      proposal.accept();
    } catch (error) {
      message = (error as Error)?.message ?? '';
    }

    // WAS a bare throw with no `cause.kind` — not one of the two designed
    // refusal doors — because the turn had already been retired and `accept()`
    // had nothing to settle.
    //
    // NOW it succeeds. A refused rollback leaves the transaction pending, so
    // confirming it is a legitimate way to resolve the refusal, and the value
    // it authored stays live as committed truth.
    expect(message).toBe('');
    expect(tree.$.x()).toBe(1);
  });
});

describe('R6-LIVENESS-0 / 6 — CONTROL: the same scenario through transact()', () => {
  it('isolates whether this is the propose() facade or the kernel', async () => {
    const tree = rowTree();
    tree.$.rows.addOne({ id: 'A', name: 'Original' });
    await flush();

    const pending = tree.transact(() => {
      tree.$.x(1);
      tree.$.rows.removeOne('A');
    });
    await flush();

    realization(() => tree.$.rows.addOne({ id: 'A', name: 'FromServer' }));
    await flush();

    const first = tryReject({ reject: () => pending.rollback() });
    const pendingAfter = pendingCount(tree);
    const second = tryReject({ reject: () => pending.rollback() });

    // These match arms /2 and /3, so the behaviour is KERNEL-level and the
    // facade merely inherits it — true of the defect then, and of the fix now.
    // WAS: pendingAfter 0, second false.
    expect(first).toBe('effect-validation-failed');
    expect(pendingAfter).toBe(1);
    expect(second).toBe('effect-validation-failed');
    expect(tree.$.x()).toBe(1);
  });
});
