import { describe, expect, it } from 'vitest';

import { timeTravel } from '../../enhancers/time-travel/time-travel';
import { withWriteContext } from '../write-context';
import { transactions } from '../../enhancers/transactions/transactions';
import { entityMap } from './entity-map';
import { signalTree } from '../signal-tree';

/**
 * A1-0 — can remote keyed acquisition compose with an ORDINARY `entityMap`?
 *
 * No `loader()`. Acquisition happens beside the tree, exactly as an Angular
 * `resource()` + `effect` would drive it, and the tree receives committed truth
 * through its public API. The pre-registered questions are in
 * `v15-production-surface-audit.md`, A1-0; this file answers the parts that are
 * decidable from core alone.
 *
 * Deliberately excluded: staleTime, swr, lazy, tags. Importing the historical
 * cache vocabulary would let the spike conclude that composition "needs
 * machinery" when the machinery came from the API under test.
 *
 * These assert what core DOES, including where it is surprising. They are
 * evidence, not a specification.
 */

type User = { id: string; name: string; v: number };

const tick = () => Promise.resolve();
const flush = async () => {
  await tick();
  await tick();
};

/**
 * The experiment-local adapter. NOT a candidate API — its only job is to make
 * what core is missing visible. A real Angular version would read
 * `resource.value()` inside an `effect`; the shape of the write is identical.
 */
const applyServerTruth = (
  rows: { setAll(next: User[]): void },
  next: User[]
) => {
  rows.setAll(next);
};

const subjectOf = (rows: unknown, id: string): number | undefined =>
  (
    rows as {
      __acquireEntityHandleForTesting?: (
        key: string
      ) => { subjectId: number } | undefined;
    }
  ).__acquireEntityHandleForTesting?.(id)?.subjectId;

const usersState = () => ({
  users: entityMap<User, string>({ selectId: (u) => u.id }),
});

// Three concrete builders rather than one `enhancers: unknown[]` helper. The
// generic version needed `as never`, which erased the enhancers' type additions
// and cost `getHistory()` and `transaction()` — `spec-types` caught it. A cast
// that hides the very API under test makes the assertions vacuous.
const makePlainTree = () => signalTree(usersState());
const makeTimeTravelTree = () =>
  signalTree(usersState(), { enhancers: [timeTravel({ maxHistorySize: 20 })] });
const makeTransactionTree = () =>
  signalTree(usersState(), { enhancers: [transactions()] });

describe('A1-0: acquisition composed over an ordinary entityMap', () => {
  it('cases 1-2: initial load, then refresh with the same keys preserves subject identity', async () => {
    const tree = makePlainTree();
    applyServerTruth(tree.$.users, [
      { id: 'a', name: 'Ada', v: 1 },
      { id: 'b', name: 'Boo', v: 1 },
    ]);
    await flush();
    expect(tree.$.users.ids().sort()).toEqual(['a', 'b']);

    const aBefore = subjectOf(tree.$.users, 'a');
    const held = tree.$.users.byIdOrFail('a');

    // Same keys, new values — the ordinary server-refresh shape.
    applyServerTruth(tree.$.users, [
      { id: 'a', name: 'Ada2', v: 2 },
      { id: 'b', name: 'Boo2', v: 2 },
    ]);
    await flush();

    // STRUCTURAL IDENTITY: the surviving key keeps its lifetime, and a
    // reference held across the refresh still reads through it.
    expect(subjectOf(tree.$.users, 'a')).toBe(aBefore);
    expect(held()?.name).toBe('Ada2');
  });

  it('case 3: a refresh that drops and adds retires one and starts another', async () => {
    const tree = makePlainTree();
    applyServerTruth(tree.$.users, [
      { id: 'a', name: 'Ada', v: 1 },
      { id: 'b', name: 'Boo', v: 1 },
    ]);
    await flush();
    const aSubject = subjectOf(tree.$.users, 'a');
    const bSubject = subjectOf(tree.$.users, 'b');

    applyServerTruth(tree.$.users, [
      { id: 'b', name: 'Boo', v: 1 },
      { id: 'c', name: 'Cid', v: 1 },
    ]);
    await flush();

    expect(tree.$.users.ids().sort()).toEqual(['b', 'c']);
    expect(subjectOf(tree.$.users, 'b')).toBe(bSubject);
    expect(subjectOf(tree.$.users, 'c')).not.toBe(aSubject);
  });

  it('case 4: a key that comes back gets a NEW lifetime, never a resurrection', async () => {
    const tree = makePlainTree();
    applyServerTruth(tree.$.users, [{ id: 'a', name: 'Ada', v: 1 }]);
    await flush();
    const original = subjectOf(tree.$.users, 'a');
    const staleHandle = tree.$.users.byIdOrFail('a');

    applyServerTruth(tree.$.users, [{ id: 'z', name: 'Zed', v: 1 }]);
    await flush();
    expect(staleHandle()).toBeUndefined();

    applyServerTruth(tree.$.users, [{ id: 'a', name: 'Ada-again', v: 9 }]);
    await flush();

    expect(subjectOf(tree.$.users, 'a')).not.toBe(original);
    // And the reference held before the gap must NOT follow the new occupant.
    expect(staleHandle()).toBeUndefined();
  });

  it('case 7: a refresh with identical values does not churn identity', async () => {
    const tree = makePlainTree();
    const rows = [
      { id: 'a', name: 'Ada', v: 1 },
      { id: 'b', name: 'Boo', v: 1 },
    ];
    applyServerTruth(tree.$.users, rows);
    await flush();
    const before = [subjectOf(tree.$.users, 'a'), subjectOf(tree.$.users, 'b')];

    applyServerTruth(tree.$.users, rows.map((r) => ({ ...r })));
    await flush();

    expect([subjectOf(tree.$.users, 'a'), subjectOf(tree.$.users, 'b')]).toEqual(
      before
    );
  });

  it('CASE 8 — REPAIRED: an untagged refresh does NOT become an undoable turn', async () => {
    const tree = makeTimeTravelTree();
    applyServerTruth(tree.$.users, [{ id: 'a', name: 'Ada', v: 1 }]);
    await flush();
    const before = tree.getHistory().length;

    // A background poll. The user did nothing.
    applyServerTruth(tree.$.users, [{ id: 'a', name: 'Ada-from-server', v: 2 }]);
    await flush();

    // ✅ REPAIRED by opt-in eligibility. A1-0's finding was that acquisition is
    // INDISTINGUISHABLE from an authored mutation, so an untagged background
    // refresh entered the undo stack and a user's undo reverted the server's
    // truth to a stale client value.
    //
    // Under opt-in the refresh is simply not designated, so it never becomes a
    // turn — and the undo cannot reach it. Note what did NOT change: acquisition
    // is still indistinguishable from an authored write. It just no longer
    // MATTERS, because neither one is admitted without designation. CASE 8b's
    // realization seam remains the right tool for telling them apart when
    // something else needs to.
    expect(tree.getHistory().length).toBe(before);

    tree.undo();
    await flush();
    expect(tree.$.users.byId('a')?.()?.name).toBe('Ada-from-server');
  });

  it('CASE 8b — classifying it as a realization fixes that, and the seam already exists', async () => {
    const tree = makeTimeTravelTree();
    applyServerTruth(tree.$.users, [{ id: 'a', name: 'Ada', v: 1 }]);
    await flush();
    const before = tree.getHistory().length;

    // The candidate C2 seam. `withWriteContext` is enhancer-author plumbing and
    // is NOT in the shipped barrel — that is the whole finding. Core already
    // knows how to classify this write; applications cannot say it.
    withWriteContext({ intent: 'system', participation: 'realized' }, () => {
      applyServerTruth(tree.$.users, [{ id: 'a', name: 'Server', v: 2 }]);
    });
    await flush();

    expect(tree.getHistory().length).toBe(before);
    expect(tree.$.users.byId('a')?.()?.name).toBe('Server');
  });

  it('CASE 9 — an untagged refresh mid-transaction makes rollback IMPOSSIBLE', async () => {
    const tree = makeTransactionTree();
    applyServerTruth(tree.$.users, [{ id: 'a', name: 'Ada', v: 1 }]);
    await flush();

    const pending = tree.transaction(() => {
      tree.$.users.updateOne('a', { name: 'Optimistic' });
    });
    expect(tree.$.users.byId('a')?.()?.name).toBe('Optimistic');

    applyServerTruth(tree.$.users, [{ id: 'a', name: 'Server', v: 5 }]);
    await flush();

    // The transaction can no longer be resolved in either direction.
    expect(() => pending.rollback()).toThrow(
      /could not rollback the pending transaction/
    );
    expect(tree.$.users.byId('a')?.()?.name).toBe('Server');
  });

  it('CASE 9b — classified as a realization, rollback is now REFUSED (C3)', async () => {
    const tree = makeTransactionTree();
    applyServerTruth(tree.$.users, [{ id: 'a', name: 'Ada', v: 1 }]);
    await flush();

    const pending = tree.transaction(() => {
      tree.$.users.updateOne('a', { name: 'Optimistic' });
    });

    withWriteContext({ intent: 'system', participation: 'realized' }, () => {
      applyServerTruth(tree.$.users, [{ id: 'a', name: 'Server', v: 5 }]);
    });
    await flush();

    // ⚠️ POLICY CHANGED, deliberately, by TX-LEDGER C3.
    //
    // This case used to assert that rollback restores the pre-transaction
    // baseline and the concurrent server value is LOST — recorded at the time as
    // "a policy" and "a statable consequence of classification". C3 rejected
    // that policy on the same grounds RESTORE-P0 P0-C rejected its undo twin: a
    // reversal may not destroy a later causal consequence outside the reversing
    // authority.
    //
    // So the classification still does the work A1-0 credited it with — an
    // untagged refresh cannot be resolved at all — but the resolution is now
    // REFUSAL rather than silent discard. The caller is told, and the server
    // value stands.
    let refused = false;
    try {
      pending.rollback();
    } catch {
      refused = true;
    }
    await flush();

    expect(refused).toBe(true);
    expect(tree.$.users.byId('a')?.()?.name).toBe('Server');
  });

  it('case 10: destroying the tree does not require the acquirer to know', async () => {
    const tree = makeTimeTravelTree();
    applyServerTruth(tree.$.users, [{ id: 'a', name: 'Ada', v: 1 }]);
    await flush();

    tree.destroy();

    // A late response after teardown must not throw into the acquirer.
    expect(() =>
      applyServerTruth(tree.$.users, [{ id: 'a', name: 'Late', v: 2 }])
    ).not.toThrow();
  });
});
