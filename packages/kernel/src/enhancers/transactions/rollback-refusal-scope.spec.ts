import { describe, expect, it } from 'vitest';

import { hasOpenCommitScope } from '../../lib/internals/commit-consequence';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

/**
 * A REFUSED ROLLBACK KEEPS THE TURN **AND** KEEPS THE DURABLE HOLD.
 *
 * Two properties that sound like one, pull in opposite directions, and were
 * answered DIFFERENTLY on the two release lines. This file pins the answer this
 * line chose, because the other one is defensible enough to be re-argued by
 * accident during a merge — which is exactly what happened.
 *
 *     the TURN  stays pending  -> the caller can retry or confirm
 *     the SCOPE stays OPEN     -> durable consequences keep WAITING
 *
 * ## Why holding is right, and why the other answer is tempting
 *
 * A refusal means the transaction is UNRESOLVED. Its writes are live in the
 * tree but not settled, and a later retry may still reverse them. Publishing
 * them to storage now would persist values that can still be taken back — the
 * tree/storage divergence the commit-scope boundary exists to prevent.
 *
 * The 15.x line settles the scope as 'commit' on a refusal instead, reasoning
 * that the authored writes are "still live and therefore committed truth". That
 * is the weaker argument: live is not settled. It was adopted there to stop the
 * "application refetch fallback" pattern — catch the refusal, reconcile by
 * hand, never confirm — from wedging persistence for the life of the tree.
 *
 * This line answers that concern without publishing speculative state: the hold
 * is released by an actual settlement (`confirm()`, or a retry that succeeds),
 * and failing that by `destroy()`. See the terminal-ownership cases in
 * `transaction-safety.spec.ts` and the Link cases in
 * `link-commit-ordering.spec.ts`.
 *
 * ⚠️ Assert BOTH halves together. A test that checks only the turn passes while
 * the hold is wrong, and vice versa — which is how a merge dropped one of them
 * with the suite green.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const pendingCount = (tree: unknown): number =>
  (tree as { __transactions: { getPendingTurnCount(): number } }).__transactions
    .getPendingTurnCount();

/** A pending remove whose subject a later authoritative write re-created. */
const refusedRollback = async () => {
  const tree = signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }), x: 0 },
    { enhancers: [transactions()] }
  );
  tree.$.rows.addOne({ id: 'A', name: 'Original' });
  await flush();

  const pending = tree.transact(() => {
    tree.$.x(1);
    tree.$.rows.removeOne('A');
  });
  await flush();

  tree.$.rows.addOne({ id: 'A', name: 'FromServer' });
  await flush();

  let kind = 'ok';
  try {
    pending.rollback();
  } catch (error) {
    kind = String(
      (error as { cause?: { kind?: string } })?.cause?.kind ?? 'threw'
    );
  }
  await flush();
  return { tree, pending, kind };
};

describe('a refused rollback keeps the turn AND the durable hold', () => {
  it('both at once — still pending, still holding', async () => {
    const { tree, kind } = await refusedRollback();

    expect(kind).not.toBe('ok');
    // The turn half: the caller has not lost the ability to settle.
    expect(pendingCount(tree)).toBe(1);
    // The scope half: nothing speculative reaches storage while it can still
    // be taken back.
    expect(hasOpenCommitScope(tree as object)).toBe(true);

    tree.destroy();
  });

  it('an explicit confirm() resolves both', async () => {
    const { tree, pending } = await refusedRollback();

    expect(() => pending.confirm()).not.toThrow();
    await flush();

    expect(pendingCount(tree)).toBe(0);
    expect(hasOpenCommitScope(tree as object)).toBe(false);

    tree.destroy();
  });

  /**
   * THE OTHER REFUSAL DOOR, and it needs its own fixture.
   *
   * There are two: the PLAN-level conflict, refused before anything is
   * attempted, and the compensation that fails to install. The scenario above
   * reaches the second. Measured while mutation-testing this file: flipping the
   * PLAN door to the 15.x answer left every case above GREEN, because none of
   * them went through it. A refusal test that covers one door and claims to
   * cover refusals is the vacuous shape this suite keeps finding.
   *
   * A later field write to a subject a pending turn added makes the plan itself
   * refuse — same idiom as `link-commit-ordering.spec.ts`.
   */
  it('the PLAN-CONFLICT door holds too, and is a separate path', async () => {
    const tree = signalTree(
      {
        note: 'n0',
        rows: entityMap<Row, string>({ selectId: (r) => r.id }),
      },
      { enhancers: [transactions()] }
    );

    const pending = tree.transact(() => {
      tree.$.rows.addOne({ id: 'r1', name: 'Ada' });
    });
    tree.$.rows.byIdOrFail('r1').name('Alicia');
    await flush();

    let refused = false;
    try {
      pending.rollback();
    } catch {
      refused = true;
    }
    await flush();

    expect(refused).toBe(true);
    expect(pendingCount(tree)).toBe(1);
    expect(hasOpenCommitScope(tree as object)).toBe(true);

    tree.destroy();
  });

  it('CONTROL: a SUCCESSFUL rollback releases the hold immediately', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const pending = tree.transact(() => tree.$.x(1));
    await flush();

    pending.rollback();
    await flush();

    expect(tree.$.x()).toBe(0);
    expect(pendingCount(tree)).toBe(0);
    // Released, and by a real settlement rather than by giving up on one.
    expect(hasOpenCommitScope(tree as object)).toBe(false);

    tree.destroy();
  });
});
