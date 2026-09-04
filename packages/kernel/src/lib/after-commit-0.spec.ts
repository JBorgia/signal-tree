import { describe, expect, it } from 'vitest';

import { getActiveWriteContext } from './write-context';
import { restoration } from '../enhancers/restoration/restoration';
import { scheduleDurableConsequence } from './internals/commit-consequence';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * AFTER-COMMIT-0 — the one-shot consequence contract.
 *
 * ```text
 * NULL       a one-shot consequence needs NO SignalTree location argument; one
 *            registration binds to the AMBIENT authored operation
 * RESULT     ⚠️ FALSIFIED — and by a rule this codebase already states and
 *            enforces. X IS EARNED.
 * SURVIVES   one registration = exactly one effect; it escapes only if the
 *            operation survives; its asynchronous completion is outside
 *            SignalTree's authority
 * ```
 *
 * The first falsifier was deliberately the signature itself: the semantic object
 * is the CURRENT AUTHORED OPERATION, not a location, so if ambient context
 * sufficed then `x` would be an implementation claimant wearing a public
 * parameter.
 *
 * ## ⚠️ Why the no-argument form loses
 *
 * `openCommitScope(transactionOwnerToken, transactionId, tree)` keys the scope
 * on `resolveScopeKey(TREE)` — the tree's registry. The ambient
 * `transactionOwner` is only the token used to identify the operation, and it
 * resolves to ITSELF, so a consequence claiming it finds no open scope and runs
 * immediately. Measured: the confirmed and rolled-back cases both ran during
 * the callback.
 *
 * That is not an accident of implementation. `scopeOwns` says so directly:
 *
 *     "The write context is ambient: any code running inside a transaction
 *      callback sees that transaction's owner and id, INCLUDING A WRITE TO A
 *      COMPLETELY DIFFERENT TREE. Presence of a transaction is not evidence
 *      that the write is speculative under it, so ownership must be POSITIVELY
 *      ESTABLISHED."
 *
 * A no-argument `afterCommit()` can only infer, and inference is exactly what
 * that rule refuses. The anchor is therefore not a leaked claimant — it is the
 * caller positively establishing which tree's settlement gates the effect.
 *
 * ## Measured before writing the harness
 *
 * ```text
 * outside a transaction     getActiveWriteContext() === null
 * inside one, before any write   { transactionId, transactionOwner }
 * nested transactions       REFUSED — "Nested transaction is not supported"
 * ```
 *
 * The second line is what makes the no-argument form possible: the ambient
 * operation is identified before the first write, so registration order within
 * the callback does not matter. The third retires the nested-ownership case as
 * unreachable rather than unproven.
 */

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

/**
 * THE SURVIVING CANDIDATE. `anchor` is any owned SignalTree location — it says
 * WHOSE settlement gates the effect, and nothing about its value is read.
 *
 * `key` is a FRESH TOKEN per call. That single line is the whole
 * event-vs-state distinction: `scheduleDurableConsequence` coalesces by key,
 * which is right for a state observation and semantic corruption for an
 * authored event. See the duplicate-registration case.
 */
function afterCommit(anchor: unknown, effect: () => void): void {
  scheduleDurableConsequence({ claimant: anchor as object, key: {}, run: effect });
}

/** The falsified candidate, kept so its failure stays measurable. */
function afterCommitAmbient(effect: () => void): void {
  const owner = getActiveWriteContext()?.transactionOwner;
  if (owner === undefined) {
    queueMicrotask(effect);
    return;
  }
  scheduleDurableConsequence({ claimant: owner, key: {}, run: effect });
}

const makeTree = () =>
  signalTree({ n: 0 }, { enhancers: [restoration(), transactions()] });

describe('AFTER-COMMIT-0 case 1: outside a transaction', () => {
  it('runs exactly once, and is DEFERRED rather than synchronous', async () => {
    const tree = makeTree();
    await flush();
    const ran: string[] = [];

    tree.$.n(1);
    afterCommit(tree, () => ran.push('effect'));

    // ⚠️ MEASURED, AND IT IS NOT WHAT I EXPECTED. With no open scope there is
    // nothing to defer to, so the consequence runs SYNCHRONOUSLY — before
    // `afterCommit` returns, re-entrant inside the caller's own operation.
    //
    // That is a CONTRACT QUESTION the public API has to answer explicitly, not
    // an implementation detail:
    //
    //   as-is      `afterCommit(tree, chargeCard)` outside a transaction charges
    //              DURING the function that asked for it
    //   deferred   one `queueMicrotask` at the no-scope branch would make the
    //              timing uniform with the transactional path
    //
    // Recorded as measured. The choice belongs to the surface freeze, and the
    // uniform-timing argument looks stronger than the zero-latency one.
    expect(ran).toEqual(['effect']);

    await flush();
    expect(ran).toEqual(['effect']); // and exactly once
  });
});

describe('AFTER-COMMIT-0 cases 2 & 3: transaction outcome', () => {
  it('confirmed — held while pending, then exactly once', async () => {
    const tree = makeTree();
    await flush();
    const ran: number[] = [];

    const p = tree.transaction(() => {
      tree.$.n(2);
      afterCommit(tree, () => ran.push(tree.$.n()));
    });
    await flush();
    expect(ran).toEqual([]);

    p.confirm();
    await flush();
    expect(ran).toEqual([2]);
  });

  it('rolled back — discarded, not run-and-compensated', async () => {
    const tree = makeTree();
    await flush();
    const ran: number[] = [];

    const p = tree.transaction(() => {
      tree.$.n(9);
      afterCommit(tree, () => ran.push(tree.$.n()));
    });
    await flush();
    p.rollback();
    await flush();

    expect(ran).toEqual([]);
    expect(tree.$.n()).toBe(0);
  });
});

describe('AFTER-COMMIT-0 case 4: per-registration identity', () => {
  it('⚠️ the SAME function registered twice runs TWICE', async () => {
    const tree = makeTree();
    await flush();
    let charges = 0;
    const charge = () => void charges++;

    const p = tree.transaction(() => {
      tree.$.n(1);
      afterCommit(tree, charge);
      afterCommit(tree, charge);
    });
    await flush();
    p.confirm();
    await flush();

    // ⚠️ THE LOAD-BEARING CASE. Two calls are two AUTHORED CONSEQUENCES. The
    // scheduler underneath coalesces by key — useful for a state observation,
    // semantic corruption for an event — so the public contract must not
    // inherit it. Keying on callback identity would silently collapse a double
    // charge into one.
    expect(charges).toBe(2);
  });

  it('and so does the same function outside a transaction', async () => {
    const tree = makeTree();
    await flush();
    let charges = 0;
    const charge = () => void charges++;

    tree.$.n(1);
    afterCommit(tree, charge);
    afterCommit(tree, charge);
    await flush();

    expect(charges).toBe(2);
  });
});

describe('AFTER-COMMIT-0 case 5: registration order', () => {
  it('effects START in registration order', async () => {
    const tree = makeTree();
    await flush();
    const order: string[] = [];

    const p = tree.transaction(() => {
      tree.$.n(1);
      afterCommit(tree, () => order.push('A'));
      afterCommit(tree, () => order.push('B'));
      afterCommit(tree, () => order.push('C'));
    });
    await flush();
    p.confirm();
    await flush();

    // START order only. Completion order of asynchronous work is the caller's,
    // per case 8.
    expect(order).toEqual(['A', 'B', 'C']);
  });
});

describe('AFTER-COMMIT-0 case 6: nesting', () => {
  it('⚠️ nested transactions are REFUSED by the runtime', () => {
    const tree = makeTree();

    // So "does an inner confirm let the effect escape an outer rollback?" is
    // unreachable rather than unproven. The no-argument form does not have to
    // answer it, and if nesting is ever added this test is where the question
    // returns.
    expect(() =>
      tree.transaction(() => {
        tree.transaction(() => {
          tree.$.n(1);
        });
      })
    ).toThrow(/[Nn]ested transaction/);
  });
});

describe('AFTER-COMMIT-0 case 7: two trees, interleaved operations', () => {
  it('each registration binds to ITS OWN ambient operation', async () => {
    const a = makeTree();
    const b = makeTree();
    await flush();
    const ran: string[] = [];

    const pb = b.transaction(() => {
      b.$.n(5);
      afterCommit(b, () => ran.push('B'));
    });
    const pa = a.transaction(() => {
      a.$.n(7);
      afterCommit(a, () => ran.push('A'));
    });
    await flush();
    expect(ran).toEqual([]);

    // ⚠️ THE DISCRIMINATOR FOR THE SIGNATURE. B is rolled back and A confirmed.
    // If ambient attribution were insufficient, either both would escape or
    // neither would — and an explicit owner argument would be earned.
    pb.rollback();
    pa.confirm();
    await flush();

    expect(ran).toEqual(['A']);
    expect(a.$.n()).toBe(7);
    expect(b.$.n()).toBe(0);
  });
});

describe('AFTER-COMMIT-0 case 8: async completion is the caller\'s', () => {
  it('a never-resolving effect does not block the next one', async () => {
    const tree = makeTree();
    await flush();
    const started: string[] = [];

    const p = tree.transaction(() => {
      tree.$.n(1);
      afterCommit(tree, () => {
        started.push('first');
        // Deliberately never resolves. SignalTree owns PERMISSION TO START, not
        // completion of remote work.
        return new Promise<void>(() => void 0) as unknown as void;
      });
      afterCommit(tree, () => started.push('second'));
    });
    await flush();
    p.confirm();
    await flush();

    // If the returned promise were awaited, `second` would never start and
    // `afterCommit` would have quietly become `link.settled()` — a category
    // error, since a link owns an outbound queue and a one-shot consequence
    // does not.
    expect(started).toEqual(['first', 'second']);
  });

  it('⚠️ a SYNCHRONOUS throw ESCAPES settlement — a scheduler defect', async () => {
    const tree = makeTree();
    await flush();
    const started: string[] = [];

    const p = tree.transaction(() => {
      tree.$.n(1);
      afterCommit(tree, () => {
        started.push('first');
        throw new Error('effect exploded');
      });
      afterCommit(tree, () => started.push('second'));
    });
    await flush();

    let escaped: unknown;
    try {
      p.confirm();
    } catch (e) {
      escaped = (e as Error).message;
    }
    await flush();

    // ⚠️ MEASURED, in two halves, and only one of them surprised me.
    //
    //   SIBLING ISOLATION HOLDS. `second` still starts — one failing
    //   consequence does not prevent the others, which is the property that
    //   actually matters and which I had assumed was broken.
    //
    //   THE THROW ESCAPES `confirm()`. A consequence's failure becomes the
    //   failure of the transaction API that released it, so a caller who never
    //   registered a consequence can be thrown at by someone else's.
    //
    // The second half is a CONTRACT QUESTION for settlement, not for
    // `afterCommit`, and deliberately not answered here: surfacing loudly is
    // defensible, and so is isolating it. What is NOT defensible is inventing a
    // public error channel to catch it — ERROR-SURFACE-0 found the existing
    // central reporter has two reporters, both in retiring APIs, and a taxonomy
    // that is unpublishable as-is.
    //
    // Pinned as current behaviour so any change to it is deliberate.
    expect(escaped).toBe('effect exploded');
    expect(started).toEqual(['first', 'second']);
  });
});
