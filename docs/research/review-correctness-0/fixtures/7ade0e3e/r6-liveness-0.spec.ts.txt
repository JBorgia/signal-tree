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
  it('MEASURED: the refusal RETIRES the pending turn', async () => {
    const { tree, proposal, pendingWhileOutstanding } = await arriveAtRefusal();

    const pendingAfterRefusal = pendingCount(tree);
    const inspection = proposal.inspect();

    expect(pendingWhileOutstanding).toBe(1);
    // MEASURED 2026-09-23, and the opposite of the preregistered prediction:
    // `reject()` threw, so the facade never assigned `settled` — yet the
    // kernel has already dropped the turn from the pending ledger. The facade
    // believes the proposal is outstanding; the kernel believes it is gone.
    expect(pendingAfterRefusal).toBe(0);
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
  it('MEASURED: the second reject reports SUCCESS and reverses nothing', async () => {
    const { tree, proposal } = await arriveAtRefusal();

    const second = tryReject(proposal);

    // MEASURED: not the same refusal. It returns cleanly.
    expect(second).toBe(false);
    // ...while the speculative value is still live.
    expect(tree.$.x()).toBe(1);
    expect(tree.$.rows.byId('A')?.()?.name).toBe('FromServer');
  });
});

describe('R6-LIVENESS-0 / 4 — RECOVERY: clear the conflict, then reject', () => {
  it('MEASURED: clearing the conflict does NOT make the rejection reversible', async () => {
    const { tree, proposal } = await arriveAtRefusal();

    realization(() => tree.$.rows.removeOne('A'));
    await flush();

    const retry = tryReject(proposal);

    // Reports success...
    expect(retry).toBe(false);
    // ...but x never returns to baseline. The reversal is permanently lost.
    expect(tree.$.x()).toBe(1);
    expect(pendingCount(tree)).toBe(0);
  });
});

describe('R6-LIVENESS-0 / 5 — is accept still legal after a refused reject?', () => {
  it('MEASURED: accept throws a bare error, with no diagnostic cause', async () => {
    const { tree, proposal } = await arriveAtRefusal();

    let message = '';
    try {
      proposal.accept();
    } catch (error) {
      message = (error as Error)?.message ?? '';
    }

    // No `cause.kind`: this is not one of the two designed refusal doors.
    expect(message).not.toBe('');
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

    // If these match arm /2 and /3, the behaviour is kernel-level and the
    // facade merely inherits it.
    expect(first).toBe('effect-validation-failed');
    expect(pendingAfter).toBe(0);
    expect(second).toBe(false);
    expect(tree.$.x()).toBe(1);
  });
});
