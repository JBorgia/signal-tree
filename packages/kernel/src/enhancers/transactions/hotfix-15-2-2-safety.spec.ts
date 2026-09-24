import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

/**
 * SAFETY CONTRACT — H1..H9. SATISFIED IN 15.3.0.
 *
 * Ported from R6-LIVENESS-0 and R8-OVERLAP-0, which were measured against the
 * v16 tree and then reproduced against the PUBLISHED 15.0.0, 15.1.2, 15.1.4 and
 * 15.2.1 tarballs — see `docs/research/v15-safety-audit/`.
 *
 * The contract is SAFETY, not capability:
 *
 *     if a rollback can be proven safe   it completes fully
 *     if it cannot                       NOTHING changes, the transaction
 *                                        stays pending, a refusal is thrown
 *
 * Deliberately NOT in scope: surgical multi-owner settlement, contribution
 * layers, drafts/MVCC. An overlapping rollback that cannot be proven safe is
 * allowed to refuse. That is less permissive than 15.2.1 appeared to be, and
 * is the correct direction: unsafe becomes safely rejected. The permissive
 * version is the 16.0 ownership model, not a patch to this line.
 *
 * ## History of this file, because it changes how to read a failure here
 *
 * Written first as deliberately RED evidence against 15.2.1, then marked
 * `it.fails` so the release tag could be verified without the contract's own
 * point being read as a broken build. Five cases carried that marker: H1, H3,
 * H4, H5 and H6. They are now ORDINARY `it` — the containment work landed and
 * they pass.
 *
 * Which is exactly what the marker was for. `it.fails` turns RED when a case
 * starts passing, so the change could not be absorbed silently; a `skip` would
 * have hidden it. H2, H7, H8 and H9 held throughout.
 *
 * H4, H5 and H6 each accept TWO outcomes — a correct reversal or an atomic
 * refusal — because the contract is about which outcomes are permissible, not
 * about which one this implementation picks. Today all three take the REFUSAL
 * branch. Do not simplify them to the branch currently taken: the other branch
 * is what 16.0 is expected to satisfy, and this file should not have to be
 * rewritten to notice that.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const settle = (op: () => void): 'ok' | string => {
  try {
    op();
    return 'ok';
  } catch (e) {
    return (
      ((e as { cause?: { kind?: string } })?.cause?.kind as string) ?? 'throw'
    );
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
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }), x: 0 },
    { enhancers: [transactions()] }
  );

const scalarTree = () =>
  signalTree({ x: 0, y: 0, z: 0 }, { enhancers: [transactions()] });

const xyz = (t: ReturnType<typeof scalarTree>) => ({
  x: t.$.x(),
  y: t.$.y(),
  z: t.$.z(),
});

/** R6: pending remove whose subject a later write re-created. */
const r6Scenario = async () => {
  const tree = rowTree();
  tree.$.rows.addOne({ id: 'A', name: 'Original' });
  await flush();

  const pending = tree.transact(() => {
    tree.$.x(1);
    tree.$.rows.removeOne('A');
  });
  await flush();

  tree.$.rows.addOne({ id: 'A', name: 'FromServer' });
  await flush();

  return { tree, pending };
};

/** R8: two overlapping pending transactions, P2 newer on `y`. */
const r8Scenario = async () => {
  const tree = scalarTree();
  const p1 = tree.transact(() => {
    tree.$.x(1);
    tree.$.y(1);
  });
  await flush();
  const p2 = tree.transact(() => {
    tree.$.y(2);
    tree.$.z(2);
  });
  await flush();
  return { tree, p1, p2 };
};

describe('H1 — a failed rollback KEEPS settlement authority', () => {
  it('the pending turn survives a refusal', async () => {
    const { tree, pending } = await r6Scenario();

    expect(pendingCount(tree)).toBe(1);
    // Ordinary writes are confirmed turns of their own, so the invariant is
    // that the FAILED ROLLBACK confirms nothing -- a delta, not an absolute.
    const confirmedBefore = confirmedCount(tree);

    const outcome = settle(() => pending.rollback());

    expect(outcome).not.toBe('ok');
    // 15.2.1 retires the turn here. It must not.
    expect(pendingCount(tree)).toBe(1);
    expect(confirmedCount(tree)).toBe(confirmedBefore);
  });
});

describe('H2 — a failed rollback changes NO state', () => {
  it('every live value is exactly as it was before the attempt', async () => {
    const { tree, pending } = await r6Scenario();

    const before = { x: tree.$.x(), a: tree.$.rows.byId('A')?.()?.name };
    settle(() => pending.rollback());

    expect({ x: tree.$.x(), a: tree.$.rows.byId('A')?.()?.name }).toEqual(
      before
    );
  });
});

describe('H3 — a retried failed rollback does not falsely report success', () => {
  it('the second attempt refuses in the same way, not "ok"', async () => {
    const { tree, pending } = await r6Scenario();

    settle(() => pending.rollback());
    const second = settle(() => pending.rollback());

    // 15.2.1 returns 'ok' here while reversing nothing.
    expect(second).not.toBe('ok');
    expect(pendingCount(tree)).toBe(1);
  });
});

describe('H4 — older-overlap rollback reverses correctly OR refuses atomically', () => {
  it('never a third outcome', async () => {
    const { tree, p1, p2 } = await r8Scenario();
    const before = xyz(tree);

    const outcome = settle(() => p1.rollback());
    const after = xyz(tree);

    if (outcome === 'ok') {
      // Safe reversal: P1's x reversed, P2's y=2 and z=2 untouched.
      expect(after).toEqual({ x: 0, y: 2, z: 2 });
    } else {
      // Atomic refusal: nothing moved, both still pending.
      expect(after).toEqual(before);
      expect(pendingCount(tree)).toBe(2);
    }
    expect(p2).toBeDefined();
  });
});

describe('H5 — an accepted transaction never silently loses a field', () => {
  it("P2's own contributions all survive its confirm()", async () => {
    const { tree, p1, p2 } = await r8Scenario();

    settle(() => p1.rollback());
    const confirmOutcome = settle(() => p2.confirm());

    if (confirmOutcome === 'ok') {
      // P2 wrote y=2 and z=2. Both must be present after confirming P2.
      expect(xyz(tree).y).toBe(2);
      expect(xyz(tree).z).toBe(2);
    }
  });
});

describe('H6 — a rolled-back value is never resurrected', () => {
  it('settling P2 cannot restore a value P1 already gave up', async () => {
    const { tree, p1, p2 } = await r8Scenario();

    const firstOutcome = settle(() => p1.rollback());
    settle(() => p2.rollback());

    if (firstOutcome === 'ok') {
      // P1 genuinely reversed, so its y=1 must not come back when P2 settles.
      // This is the 15.2.1 failure: it ended at y=1.
      expect(xyz(tree).y).not.toBe(1);
    } else {
      // P1 refused atomically and is STILL PENDING, so y=1 is its live
      // contribution and is correct. Nothing was resurrected because nothing
      // was given up.
      expect(pendingCount(tree)).toBe(1);
      expect(xyz(tree).y).toBe(1);
    }
  });
});

describe('H7 — CONTROL: newer-first rollback still correct', () => {
  it('rolling back P2 restores P1s pending y=1, not the baseline', async () => {
    const { tree, p1, p2 } = await r8Scenario();

    const outcome = settle(() => p2.rollback());

    expect(outcome).toBe('ok');
    expect(xyz(tree)).toEqual({ x: 1, y: 1, z: 0 });
    expect(settle(() => p1.confirm())).toBe('ok');
    expect(xyz(tree)).toEqual({ x: 1, y: 1, z: 0 });
  });
});

describe('H8 — CONTROL: an ordinary single rollback still works', () => {
  it('no competing writer, clean reversal', async () => {
    const tree = scalarTree();
    const p = tree.transact(() => {
      tree.$.x(1);
      tree.$.y(1);
    });
    await flush();

    expect(settle(() => p.rollback())).toBe('ok');
    expect(xyz(tree)).toEqual({ x: 0, y: 0, z: 0 });
    expect(pendingCount(tree)).toBe(0);
  });
});

describe('H9 — CONTROL: unrelated later writes survive a rollback', () => {
  it('an unrelated write is not reverted and does not block', async () => {
    const tree = scalarTree();
    const p = tree.transact(() => {
      tree.$.x(1);
    });
    await flush();

    tree.$.z(42);
    await flush();

    expect(settle(() => p.rollback())).toBe('ok');
    expect(xyz(tree)).toEqual({ x: 0, y: 0, z: 42 });
  });
});
