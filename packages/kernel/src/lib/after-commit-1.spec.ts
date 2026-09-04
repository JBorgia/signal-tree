import { describe, expect, it } from 'vitest';

import {
  deferOperationConsequence,
  scheduleDurableConsequence,
} from './internals/commit-consequence';
import { getActiveWriteContext } from './write-context';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * AFTER-COMMIT-1 — OPERATION IDENTITY vs CLAIMANT IDENTITY.
 *
 * ⚠️ AFTER-COMMIT-0 concluded "X IS EARNED". That was one step too far, and this
 * file exists to check it. What AFTER-COMMIT-0 actually falsified was
 *
 *     scheduleDurableConsequence({ claimant: transactionOwner, ... })
 *
 * i.e. `transactionOwner` is not a valid TREE CLAIMANT — which was already
 * known. It did NOT falsify `afterCommit(effect)` as a semantic API.
 *
 * The `scopeOwns` rule it leaned on says:
 *
 *     "presence of a transaction is not evidence that THE WRITE is speculative
 *      under it, so ownership must be positively established"
 *
 * That governs MUTATION ATTRIBUTION — a write to tree B inside a transaction on
 * tree A must not become speculative under A. An explicit consequence
 * registration is a different act: nothing is inferred from a mutation, because
 * the application named this operation by running inside it and saying so.
 *
 * ```text
 * NULL  an explicit `afterCommit(effect)` can attach directly to the ambient
 *       rollback-capable OPERATION, identified by (transactionOwner,
 *       transactionId), without naming a SignalTree location
 * ```
 *
 * The candidate uses `deferOperationConsequence`, which looks the scope up by
 * that exact pair and skips the attribution guard — deliberately narrow: it can
 * only reach an ALREADY OPEN scope, and never runs anything itself.
 *
 * ## RESULT — the NULL SURVIVES. `afterCommit(effect)` needs no anchor.
 *
 * ```text
 * route the candidate through the CLAIMANT form        6 of 10 fail
 * key on callback identity instead of a fresh token    1 of 10 fails
 * drop the microtask deferral outside a transaction    1 of 10 fails
 * ```
 */

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

/** THE CANDIDATE — no location argument. */
function afterCommit(effect: () => void): void {
  const ctx = getActiveWriteContext();
  const owner = ctx?.transactionOwner;
  const id = ctx?.transactionId;
  if (
    owner !== undefined &&
    typeof id === 'number' &&
    // A FRESH key per call — one registration is one consequence.
    deferOperationConsequence(owner, id, {}, effect)
  ) {
    return;
  }
  // ⚠️ UNIFORM NON-REENTRANCY, a deliberate contract choice rather than
  // inherited substrate behaviour. AFTER-COMMIT-0 measured the claimant form
  // running SYNCHRONOUSLY outside a transaction; an API named `afterCommit`
  // must not sometimes mean "before this function returns". One microtask buys
  // timing uniform with the transactional path.
  queueMicrotask(effect);
}

/** The falsified AFTER-COMMIT-0 form, kept so case 7 stays honest. */
function afterCommitViaClaimant(anchor: unknown, effect: () => void): void {
  scheduleDurableConsequence({
    claimant: anchor as object,
    key: {},
    run: effect,
  });
}

const makeTree = () =>
  signalTree({ n: 0 }, { enhancers: [restoration(), transactions()] });

describe('AFTER-COMMIT-1: the consequence belongs to the OPERATION', () => {
  it('⚠️ case 1 — a transaction with NO WRITES AT ALL still holds it', async () => {
    const tree = makeTree();
    await flush();
    const ran: string[] = [];

    const p = tree.transaction(() => {
      afterCommit(() => ran.push('confirmed'));
    });
    await flush();
    expect(ran).toEqual([]);

    p.confirm();
    await flush();

    // THE DECISIVE CASE. There is no mutation to attribute and no location to
    // anchor to — only an operation. If the consequence still tracks
    // confirm/rollback, it belongs to the operation rather than to any write.
    expect(ran).toEqual(['confirmed']);
  });

  it('case 1b — the same, rolled back, is discarded', async () => {
    const tree = makeTree();
    await flush();
    const ran: string[] = [];

    const p = tree.transaction(() => {
      afterCommit(() => ran.push('escaped'));
    });
    await flush();
    p.rollback();
    await flush();

    expect(ran).toEqual([]);
  });

  it('case 2 — with a write, confirm holds then releases exactly once', async () => {
    const tree = makeTree();
    await flush();
    const ran: number[] = [];

    const p = tree.transaction(() => {
      tree.$.n(2);
      afterCommit(() => ran.push(tree.$.n()));
    });
    await flush();
    expect(ran).toEqual([]);
    p.confirm();
    await flush();

    expect(ran).toEqual([2]);
  });

  it('case 2b — with a write, rollback discards', async () => {
    const tree = makeTree();
    await flush();
    const ran: number[] = [];

    const p = tree.transaction(() => {
      tree.$.n(9);
      afterCommit(() => ran.push(tree.$.n()));
    });
    await flush();
    p.rollback();
    await flush();

    expect(ran).toEqual([]);
    expect(tree.$.n()).toBe(0);
  });

  it('⚠️ case 3 — a transaction on A that writes tree B: the effect is still A-s', async () => {
    const a = makeTree();
    const b = makeTree();
    await flush();
    const ran: string[] = [];

    const p = a.transaction(() => {
      // A write to a DIFFERENT tree. `scopeOwns` exists to stop this write
      // becoming speculative under A — and it does, which is right.
      b.$.n(7);
      // The registration, however, is explicit and happens inside A.
      afterCommit(() => ran.push('effect'));
    });
    await flush();
    expect(ran).toEqual([]);

    p.rollback();
    await flush();

    // The direct counterexample to misapplying `scopeOwns`: the effect follows
    // the OPERATION IT WAS REGISTERED IN, not the tree that happened to be
    // written. B's write was never speculative, so it survives.
    expect(ran).toEqual([]);
    expect(b.$.n()).toBe(7);
    expect(a.$.n()).toBe(0);
  });

  it('case 4 — two interleaved transactions resolve independently', async () => {
    const a = makeTree();
    const b = makeTree();
    await flush();
    const ran: string[] = [];

    const pb = b.transaction(() => {
      b.$.n(5);
      afterCommit(() => ran.push('B'));
    });
    const pa = a.transaction(() => {
      a.$.n(7);
      afterCommit(() => ran.push('A'));
    });
    await flush();

    pb.rollback();
    pa.confirm();
    await flush();

    expect(ran).toEqual(['A']);
  });

  it('case 5 — the same callback registered twice runs twice', async () => {
    const tree = makeTree();
    await flush();
    let charges = 0;
    const charge = () => void charges++;

    const p = tree.transaction(() => {
      tree.$.n(1);
      afterCommit(charge);
      afterCommit(charge);
    });
    await flush();
    p.confirm();
    await flush();

    expect(charges).toBe(2);
  });

  it('case 5b — and effects start in registration order', async () => {
    const tree = makeTree();
    await flush();
    const order: string[] = [];

    const p = tree.transaction(() => {
      afterCommit(() => order.push('A'));
      afterCommit(() => order.push('B'));
      afterCommit(() => order.push('C'));
    });
    await flush();
    p.confirm();
    await flush();

    expect(order).toEqual(['A', 'B', 'C']);
  });

  it('⚠️ case 6 — outside a transaction it DEFERS rather than running re-entrantly', async () => {
    const tree = makeTree();
    await flush();
    const ran: string[] = [];

    tree.$.n(1);
    afterCommit(() => ran.push('effect'));

    // The contract choice AFTER-COMMIT-0 recorded as open, now made: uniform
    // non-reentrancy. The claimant form ran HERE.
    expect(ran).toEqual([]);

    await flush();
    expect(ran).toEqual(['effect']);
  });
});

describe('AFTER-COMMIT-1 case 7: the claimant route still fails', () => {
  it('⚠️ routing through claimant ownership reproduces AFTER-COMMIT-0 exactly', async () => {
    const tree = makeTree();
    await flush();
    const ran: string[] = [];

    const p = tree.transaction(() => {
      tree.$.n(2);
      // `transactionOwner` as a tree claimant — the falsified form.
      afterCommitViaClaimant(getActiveWriteContext()?.transactionOwner, () =>
        ran.push('leaked')
      );
    });
    await flush();

    // It ran DURING the callback, before any settlement, because
    // `transactionOwner` resolves to itself and matches no open scope. That is
    // what AFTER-COMMIT-0 measured — and it says nothing about whether AMBIENT
    // OPERATION IDENTITY is sufficient, which is what the cases above answer.
    expect(ran).toEqual(['leaked']);

    p.rollback();
    await flush();
    expect(tree.$.n()).toBe(0);
  });
});
