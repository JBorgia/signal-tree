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
 * The terminal-after-throw branch is NOT covered by this file. It is covered,
 * with teeth, by `transaction-safety.spec.ts` — "synchronous notifier throw
 * after a mixed installation is not a validation refusal" — which drives the
 * REAL notification path by disabling notifier batching and throwing from a
 * subscriber. Removing the terminal guard turns that test red.
 *
 * ⚠️ AN EARLIER VERSION OF THIS COMMENT CLAIMED THAT BRANCH COULD NOT BE
 * COVERED IN THE KERNEL AT ALL, because no public API reaches it. That
 * conflated two questions. Public-API reachability is about what a CONSUMER
 * can trigger; kernel regression coverage may use internal seams, and
 * `setBatchingEnabled(false)` is one this suite already relies on. What was
 * actually tested was a `link()` endpoint, which is asynchronous — that says
 * nothing about every other notification path, and the conclusion drawn from
 * it was far too broad.
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

  // The 'settlement does not depend on inspection succeeding' control that
  // stood here was FAKE: it built an ordinary HEALTHY transaction and confirmed
  // it, never making inspection unavailable, so it could not prove the property
  // in its own title. That property has a real fixture — the hostile-chronology
  // case in `path-notifier-enqueue.spec.ts`, which genuinely disables
  // inspection and then settles — and is asserted there rather than restated
  // here without teeth.
});
