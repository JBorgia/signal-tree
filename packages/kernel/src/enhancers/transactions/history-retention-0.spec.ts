import { describe, expect, it } from 'vitest';

import { confirmedTurnReader } from '../../internals';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

/**
 * HISTORY-RETENTION-0 — owner decision 2, approved 2026-09-24. Law L15.
 *
 * "Correctness retention follows live responsibility. Terminal transaction
 * state may not remain in the active correctness machinery for diagnostic
 * purposes. Historical evidence is a separate, explicitly bounded facility."
 *
 * The bound is not arbitrary and is not a cap. It falls out of the only
 * correctness consumer of the confirmed ledger. `getPendingRollbackPlan`
 * builds `authoredLater` as `confirmedTurns.filter(t => t.id > pendingId)`,
 * and turn ids are monotonic, so a confirmed turn C can only ever matter to a
 * pending turn OLDER than itself:
 *
 *     keep C   while some pending P exists with P.id < C.id
 *     drop C   once C.id < min(pendingIds), or nothing is pending
 *
 * `hasConfirmedTurnAfter` has no call sites in the workspace, so it imposes no
 * obligation. Everything the reader exposes beyond the rule above is
 * diagnostics.
 *
 * The decision also records that the reader-visible policy cannot change
 * SILENTLY. So the default is stated here as a test, and opt-in diagnostic
 * history is a separate, explicitly bounded facility.
 *
 * Written before implementation. Expected RED except where noted.
 */

type Store = {
  $: { x: (v?: number) => number; y: (v?: number) => number };
  transact: (fn: () => void) => { confirm(): void; rollback(): void };
  __transactions: {
    getConfirmedTurnCount(): number;
    getPendingTurnCount(): number;
  };
};

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const make = (config?: unknown) =>
  signalTree(
    { x: 0, y: 0 },
    {
      enhancers: [
        (config === undefined
          ? transactions()
          : (transactions as (c: unknown) => ReturnType<typeof transactions>)(
              config
            )) as never,
      ],
    }
  ) as unknown as Store;

describe('HISTORY-RETENTION-0 / 1 — correctness is preserved (must not regress)', () => {
  it('an older pending rollback still respects a newer CONFIRMED write', async () => {
    const store = make();

    // Older pending turn.
    const older = store.transact(() => store.$.x(1));
    await flush();

    // A newer turn confirms a write to the SAME location.
    const newer = store.transact(() => store.$.x(2));
    await flush();
    newer.confirm();
    await flush();

    // Rolling back the older turn must not clobber the confirmed newer truth.
    // This is exactly what `authoredLater` exists for, so any retention change
    // that breaks it is wrong regardless of how much memory it saves.
    try {
      older.rollback();
    } catch {
      // A refusal is acceptable here; destroying x=2 is not.
    }
    expect(store.$.x()).toBe(2);
  });
});

describe('HISTORY-RETENTION-0 / 2 — correctness records follow live obligation', () => {
  it('releases confirmed records once nothing pending can need them', async () => {
    const store = make({ history: { retain: 0 } });

    for (let i = 0; i < 5; i++) {
      const t = store.transact(() => store.$.y(i));
      await flush();
      t.confirm();
      await flush();
    }

    expect(store.__transactions.getPendingTurnCount()).toBe(0);
    // Nothing is pending, so no confirmed record can appear in any future
    // authoredLater set. Retaining them is diagnostics, not correctness.
    expect(store.__transactions.getConfirmedTurnCount()).toBe(0);
  });

  it('KEEPS a confirmed record while an OLDER pending turn still exists', async () => {
    const store = make({ history: { retain: 0 } });

    const older = store.transact(() => store.$.x(1));
    await flush();
    const newer = store.transact(() => store.$.y(2));
    await flush();
    newer.confirm();
    await flush();

    // `older` can still roll back and must still see the newer confirmed turn.
    expect(store.__transactions.getConfirmedTurnCount()).toBe(1);

    try {
      older.rollback();
    } catch {
      /* refusal is acceptable */
    }
    await flush();
    // Now nothing is pending: the obligation is discharged.
    expect(store.__transactions.getPendingTurnCount()).toBe(0);
    expect(store.__transactions.getConfirmedTurnCount()).toBe(0);
  });
});

describe('HISTORY-RETENTION-0 / 3 — churn stays bounded', () => {
  it('2,000 settled transactions do not accumulate correctness records', async () => {
    const store = make({ history: { retain: 0 } });

    for (let i = 0; i < 2000; i++) {
      const t = store.transact(() => store.$.y(i));
      t.confirm();
    }
    await flush();

    expect(store.__transactions.getPendingTurnCount()).toBe(0);
    expect(store.__transactions.getConfirmedTurnCount()).toBe(0);
  });
});

describe('HISTORY-RETENTION-0 / 4 — diagnostics are opt-in and bounded', () => {
  it('retains at most the requested number of records', async () => {
    const store = make({ history: { retain: 5 } });

    for (let i = 0; i < 50; i++) {
      const t = store.transact(() => store.$.y(i));
      t.confirm();
    }
    await flush();

    const count = store.__transactions.getConfirmedTurnCount();
    expect(count).toBeLessThanOrEqual(5);
    expect(count).toBeGreaterThan(0);
  });

  it('retain: 0 is explicit and keeps nothing', async () => {
    const store = make({ history: { retain: 0 } });
    const t = store.transact(() => store.$.y(1));
    t.confirm();
    await flush();
    expect(store.__transactions.getConfirmedTurnCount()).toBe(0);
  });
});

describe('HISTORY-RETENTION-0 / 6 — the DEFAULT is correctness-only', () => {
  it('supersedes the earlier gated default, which asserted a promise nothing backed', async () => {
    const store = make();
    const t = store.transact(() => store.$.y(1));
    t.confirm();
    await flush();

    // This case previously asserted the OPPOSITE — that an unconfigured tree
    // still retained confirmed history. That default was kept because flipping
    // it broke 19 tests, which was the wrong reason: those tests encode a
    // contract, and the contract was the thing under review.
    //
    // The old default asserted a COMPLETE history (`truncated: false`) that no
    // retention policy backed; it was true only because nothing evicted.
    // Correctness-only is now the default and diagnostics are requested
    // explicitly. Owner decision, 2026-09-24.
    expect(store.__transactions.getConfirmedTurnCount()).toBe(0);
  });
});

describe('HISTORY-RETENTION-0 / 5 — R06: diagnostics must not change correctness', () => {
  it('settlement outcomes are identical with and without history enabled', async () => {
    const run = async (config?: unknown) => {
      const store = make(config);
      const older = store.transact(() => store.$.x(1));
      await flush();
      const newer = store.transact(() => store.$.x(2));
      await flush();
      newer.confirm();
      await flush();
      let refused = false;
      try {
        older.rollback();
      } catch {
        refused = true;
      }
      await flush();
      return { x: store.$.x(), refused };
    };

    const withoutHistory = await run();
    const withHistory = await run({ history: { retain: 100 } });

    // If turning diagnostics on or off changes a settlement outcome, then
    // correctness and evidence are entangled and L15 is broken regardless of
    // what the byte counts say.
    expect(withHistory).toEqual(withoutHistory);
  });
});

const readRetention = (store: Store) =>
  confirmedTurnReader(store as never)?.readConfirmedTurns().retention;

const readTurnCount = (store: Store) =>
  confirmedTurnReader(store as never)?.readConfirmedTurns().turns.length;

describe('HISTORY-RETENTION-0 / 8 — correctness-only is the DEFAULT', () => {
  it('a tree with no retention contract keeps no diagnostic history', async () => {
    const store = make();
    for (let i = 0; i < 5; i++) {
      store.$.y(i);
      await flush();
    }
    expect(store.__transactions.getPendingTurnCount()).toBe(0);
    expect(store.__transactions.getConfirmedTurnCount()).toBe(0);
  });

  it('the reader says TRUNCATED rather than reporting an empty history', async () => {
    const store = make();
    store.$.y(1);
    await flush();

    // The distinction that makes this honest: "nothing retained because there
    // is no contract" must be distinguishable from "nothing happened".
    // Reporting truncated:false with zero turns would assert a complete
    // history that was never kept.
    expect(readTurnCount(store)).toBe(0);
    expect(readRetention(store)?.truncated).toBe(true);
  });

  it('an untouched tree is NOT truncated — nothing was evicted', async () => {
    const store = make();
    expect(readTurnCount(store)).toBe(0);
    expect(readRetention(store)?.truncated).toBe(false);
  });
});

describe('HISTORY-RETENTION-0 / 9 — a contract makes the reader complete again', () => {
  it('retain covering all work reports NOT truncated', async () => {
    const store = make({ history: { retain: 100 } });
    // Start at 1: y is already 0, so writing 0 is a no-op and builds no turn.
    for (let i = 1; i <= 3; i++) {
      store.$.y(i);
      await flush();
    }
    expect(readTurnCount(store)).toBe(3);
    expect(readRetention(store)?.truncated).toBe(false);
    expect(readRetention(store)?.firstAvailableTurnId).toBe(1);
  });

  it('retain SMALLER than the work reports truncated, with the surviving first id', async () => {
    const store = make({ history: { retain: 2 } });
    for (let i = 1; i <= 6; i++) {
      store.$.y(i);
      await flush();
    }
    const retention = readRetention(store);
    expect(readTurnCount(store)).toBeLessThanOrEqual(2);
    expect(retention?.truncated).toBe(true);
    // Reported from what actually survived, never inferred from id gaps.
    expect(retention?.firstAvailableTurnId).toBeGreaterThan(1);
  });
});
