import { afterEach, describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { withWriteContext } from '../../lib/write-context';
import { transactions } from './transactions';

/** Safety conformance after the September 23 rollback repair.
 * The original measured-corruption fixture is preserved verbatim under
 * docs/research/review-correctness-0/fixtures/7ade0e3e/.
 * Refusal must preserve authority; this is not a claim of surgical reversal.
 */
const owned: Array<{ destroy(): void }> = [];
afterEach(() => {
  for (const tree of owned.splice(0)) tree.destroy();
});

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

/** A server/outside write: participation 'realized', not authored locally. */
const realization = (fn: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, fn);

/** `false` when the reject was accepted, otherwise the refusal kind. */
const tryRollback = (pending: { rollback(): void }): false | unknown => {
  try {
    pending.rollback();
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

const rowTree = () => {
  const tree = signalTree(
    {
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
      x: 0,
    },
    // Declares diagnostic history because it COUNTS confirmed turns. Without
    // it, the L15 default evicts a promoted turn inside the same synchronous
    // confirmPending call, the delta is always 0, and the mutation this case
    // exists to catch (promote instead of reject) passes. Verified: the
    // accept()-for-reject() mutant survived at 7/7 before this line.
    { enhancers: [transactions({ history: { retain: 1000 } })] }
  );
  owned.push(tree);
  return tree;
};

/** The R6 scenario, up to and including the refused rejection. */
const arriveAtRefusal = async () => {
  const tree = rowTree();
  tree.$.rows.addOne({ id: 'A', name: 'Original' });
  await flush();

  const pending = tree.transact(() => {
    tree.$.x(1);
    tree.$.rows.removeOne('A');
  });
  await flush();

  const pendingWhileOutstanding = pendingCount(tree);

  // Newer truth re-creates the same business key as a DIFFERENT subject.
  realization(() => tree.$.rows.addOne({ id: 'A', name: 'FromServer' }));
  await flush();

  const refusal = tryRollback(pending);

  return { tree, pending, pendingWhileOutstanding, refusal };
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

describe('R6-LIVENESS-0 / 2 — SETTLEMENT axis: is the pending still open?', () => {
  it('refusal retains the pending turn and inspection', async () => {
    const { tree, pending, pendingWhileOutstanding } = await arriveAtRefusal();

    const pendingAfterRefusal = pendingCount(tree);
    const inspection = pending.inspect();

    expect(pendingWhileOutstanding).toBe(1);
    expect(pendingAfterRefusal).toBe(1);
    expect(inspection).toBeDefined();
  });

  it('refusal creates no confirmed turn', async () => {
    const tree = rowTree();
    tree.$.rows.addOne({ id: 'A', name: 'Original' });
    await flush();
    const confirmedBefore = confirmedCount(tree);

    const pending = tree.transact(() => {
      tree.$.x(1);
      tree.$.rows.removeOne('A');
    });
    await flush();
    realization(() => tree.$.rows.addOne({ id: 'A', name: 'FromServer' }));
    await flush();
    tryRollback(pending);

    // The decisive question: is x=1 now merely orphaned live state, or did
    // the kernel promote the rejected turn into the confirmed ledger?
    expect(confirmedCount(tree) - confirmedBefore).toBe(0);
    // Backstop, matching every other confirmedCount-invariance site: a promoted
    // turn also leaves the pending set, so this fails even if the confirmed
    // counter is ever bounded out from under the assertion again.
    expect(pendingCount(tree)).toBe(1);
  });
});

describe('R6-LIVENESS-0 / 3 — is reject retryable while the conflict stands?', () => {
  it('unchanged conflict refuses again without changing truth', async () => {
    const { tree, pending } = await arriveAtRefusal();

    const second = tryRollback(pending);

    expect(second).toBe('effect-validation-failed');
    expect(pendingCount(tree)).toBe(1);
    expect(tree.$.x()).toBe(1);
    expect(tree.$.rows.byId('A')?.()?.name).toBe('FromServer');
  });
});

describe('R6-LIVENESS-0 / 4 — RECOVERY: clear the conflict, then reject', () => {
  it('removing the conflict permits complete rejection', async () => {
    const { tree, pending } = await arriveAtRefusal();

    realization(() => tree.$.rows.removeOne('A'));
    await flush();

    const retry = tryRollback(pending);

    expect(retry).toBe(false);
    expect(tree.$.x()).toBe(0);
    expect(tree.$.rows.byIdOrFail('A').name()).toBe('Original');
    expect(pendingCount(tree)).toBe(0);
  });
});

describe('R6-LIVENESS-0 / 5 — is accept still legal after a refused reject?', () => {
  it('accept remains legal after refusal', async () => {
    const { tree, pending } = await arriveAtRefusal();

    expect(() => pending.confirm()).not.toThrow();
    expect(pendingCount(tree)).toBe(0);
    expect(tree.$.x()).toBe(1);
  });
});

/**
 * WAS a facade/kernel control. Arms /2 and /3 opened the turn through
 * `propose()` and this one through `transact()`, to isolate whether the
 * behaviour came from the review facade or from the kernel beneath it.
 *
 * There is now ONE verb: the review projection was folded into `transact()`
 * and `propose()` was removed before 16.0 shipped, so there is no second path
 * left to control for. Kept because it still exercises something the split
 * arms do not — the first refusal and the retry in a SINGLE sequence, against
 * one handle — and retitled so it does not claim an isolation it no longer
 * performs.
 */
describe('R6-LIVENESS-0 / 6 — first refusal and retry in one sequence', () => {
  it('the same handle refuses identically twice and stays pending', async () => {
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

    const first = tryRollback({ rollback: () => pending.rollback() });
    const pendingAfter = pendingCount(tree);
    const second = tryRollback({ rollback: () => pending.rollback() });

    // Matches arms /2 and /3, measured against one handle end to end.
    expect(first).toBe('effect-validation-failed');
    expect(pendingAfter).toBe(1);
    expect(second).toBe('effect-validation-failed');
    expect(tree.$.x()).toBe(1);
  });
});
