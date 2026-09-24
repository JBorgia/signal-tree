import { describe, expect, it } from 'vitest';

import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

/**
 * A SETTLE CALL CAN THROW AFTER IT HAS ALREADY SUCCEEDED.
 *
 * The runtime installs the compensation, retires the turn, and only THEN
 * rethrows an observer-delivery failure — deliberately, so that a delivery
 * fault cannot make a completed reversal look retryable. Folding `inspect()`
 * onto the universal handle put a wrapper in front of that, and the wrapper
 * has to preserve the distinction or it silently destroys it.
 *
 *     settlement was TERMINAL   cache the settlement snapshot, rethrow
 *     settlement was REFUSED    leave inspection LIVE, rethrow
 *
 * Measured before the guard existed: compensation succeeded (x=0, y=0), the
 * turn retired, `rollback()` threw, and `inspect()` afterwards reported
 * `{ changes: [] }`. The snapshot assignment sat after the call, so the throw
 * skipped it and the retired turn read as nothing.
 *
 * ⚠️ An unconditional `finally` assignment is the WRONG repair. A genuine
 * refusal leaves the turn pending, and its inspection must keep tracking live
 * state rather than freezing at a pre-refusal snapshot. Turn presence is the
 * honest discriminator.
 *
 * ## What these cases DO and DO NOT cover
 *
 * Mutation-tested, and the result is uneven — recorded rather than smoothed
 * over:
 *
 *     unconditional `finally` instead of the guard   CAUGHT (1 red)
 *     guard removed, assign only on success          SURVIVES
 *
 * The surviving mutant is the terminal-after-throw branch, and it survives
 * because THAT BRANCH IS NOT REACHABLE FROM THE PUBLIC API. Every synchronous
 * user callback in the settle path is gate-shaped, and everything post-install
 * — `link()` endpoints, framework effects — is delivered asynchronously and
 * cannot throw back into the settle call. Both were tried: a throwing `link`
 * `set` leaves `confirm()` returning normally.
 *
 * It IS real at the source level. Reproduced by injecting a throw after
 * `installed = true` in the compensation apply: compensation succeeded
 * (x=0, y=0), the turn retired, `rollback()` threw, and `inspect()` afterwards
 * reported `{ changes: [] }`. Independently reproduced by review against
 * d394047c. The same shape is recorded for the 15.x line in
 * `docs/audits/2026-09-24-observer-delivery/`.
 *
 * So: the guard is justified by injection, the refusal branch is covered here,
 * and the terminal branch is honestly uncovered. A framework adapter that
 * delivers observers synchronously inside the invalidation group would make it
 * reachable — that is the test to add, and it does not belong in the kernel.
 */

const make = () =>
  signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

const pendingCount = (tree: unknown): number =>
  (tree as { __transactions: { getPendingTurnCount(): number } }).__transactions
    .getPendingTurnCount();

describe('settlement terminality decides whether inspection freezes', () => {
  it('REFUSED rollback keeps inspection LIVE and the turn pending', async () => {
    const tree = make();
    // A later authoritative write on the same location makes the plan refuse.
    const pending = tree.transact(() => {
      tree.$.x(1);
      tree.$.y(1);
    });
    await flush();

    const before = pending.inspect();
    expect(before.changes.length).toBe(2);

    // Force a refusal by settling the NEWER overlapping turn first.
    const newer = tree.transact(() => tree.$.y(2));
    await flush();

    let threw = false;
    try {
      pending.rollback();
    } catch {
      threw = true;
    }
    await flush();

    expect(threw).toBe(true);
    expect(pendingCount(tree)).toBe(2);

    // THE DISCRIMINATOR. Counting changes cannot tell frozen from live — both
    // report 2. Move the world instead: settle the newer turn so `x` is
    // overtaken, and require the refused handle to REPORT that.
    //
    // A frozen snapshot still says 'current' for every change, because it was
    // taken before the refusal. Live inspection says 'superseded' for the
    // location newer truth replaced. Measured: an unconditional `finally`
    // assignment passes a count assertion and fails this one.
    newer.confirm();
    await flush();
    tree.$.x(99);
    await flush();

    const after = pending.inspect();
    expect(after.changes.find((c) => c.path === 'x')?.status).toBe(
      'superseded'
    );

    tree.destroy();
  });

  it('CONTROL: an ordinary successful rollback freezes the settlement snapshot', async () => {
    const tree = make();
    const pending = tree.transact(() => tree.$.x(1));
    await flush();

    expect(pending.inspect().changes.length).toBe(1);
    pending.rollback();
    await flush();

    // Retired, so inspection reports the settlement snapshot rather than the
    // empty read a gone turn would otherwise produce.
    expect(pendingCount(tree)).toBe(0);
    expect(pending.inspect().changes.length).toBe(1);

    tree.destroy();
  });

  it('CONTROL: confirm() freezes the snapshot the same way', async () => {
    const tree = make();
    const pending = tree.transact(() => tree.$.x(1));
    await flush();

    pending.confirm();
    await flush();

    expect(pendingCount(tree)).toBe(0);
    expect(pending.inspect().changes.length).toBe(1);

    tree.destroy();
  });

  it('CONTROL: settlement does not depend on inspection succeeding', async () => {
    // The inverse hazard, kept beside the others because a fix for one can
    // reintroduce the other: making confirm() read the inspection unguarded
    // wedges any tree whose chronology capture has failed.
    const tree = make();
    const pending = tree.transact(() => tree.$.x(1));
    await flush();

    expect(() => pending.confirm()).not.toThrow();
    expect(pendingCount(tree)).toBe(0);

    tree.destroy();
  });
});
