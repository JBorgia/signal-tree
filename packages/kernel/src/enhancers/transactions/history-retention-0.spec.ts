import { describe, expect, it } from 'vitest';

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

describe('HISTORY-RETENTION-0 / 6 — the DEFAULT is deliberately unchanged', () => {
  it('without an explicit contract the reader still sees confirmed history', async () => {
    const store = make();
    const t = store.transact(() => store.$.y(1));
    t.confirm();
    await flush();

    // `confirmedTurnReader` is a shipped surface whose purpose is reading
    // confirmed history. Pruning by default empties it — measured as 19
    // failures across six files, 10 of them in confirmed-turn-reader.spec.ts.
    // The decision states the reader-visible policy may not change silently,
    // so the obligation bound applies only once a contract is requested.
    // What the default SHOULD be is an owner decision, not something to settle
    // by rewriting those 19 tests.
    expect(store.__transactions.getConfirmedTurnCount()).toBe(1);
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
