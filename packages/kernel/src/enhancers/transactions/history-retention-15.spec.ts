import { describe, expect, it } from 'vitest';

import { confirmedTurnReader } from '../../internals';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

/**
 * L15 retention, ported to the 15.x line.
 *
 * This port is deliberately a DOUBLE CHECK on the v16 change, not a copy: if
 * the v16 implementation depended on anything v16-specific, re-deriving it on
 * an untouched 15.2.1 base is where that shows.
 *
 * The rule is the same and is derived, not chosen. `getPendingRollbackPlan` is
 * the only correctness consumer of the confirmed ledger and selects
 * `turn.id > pendingId`; ids are monotonic, so a confirmed turn can only ever
 * matter to a pending turn OLDER than itself.
 *
 * 15.x spells the entry point `transaction()`, not `transact()`.
 */

type Store = {
  $: { x: (v?: number) => number; y: (v?: number) => number };
  transaction: (fn: () => void) => { confirm(): void; rollback(): void };
  __transactions: {
    getConfirmedTurnCount(): number;
    getPendingTurnCount(): number;
  };
};

const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
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

const retentionOf = (store: Store) =>
  confirmedTurnReader(store as never)?.readConfirmedTurns().retention;

describe('L15/15.x — correctness is preserved (must not regress)', () => {
  it('an older pending rollback still respects a newer CONFIRMED write', async () => {
    const store = make();
    const older = store.transaction(() => store.$.x(1));
    await flush();
    const newer = store.transaction(() => store.$.x(2));
    await flush();
    newer.confirm();
    await flush();

    try {
      older.rollback();
    } catch {
      /* refusal acceptable; destroying x=2 is not */
    }
    expect(store.$.x()).toBe(2);
  });
});

describe('L15/15.x — correctness retention follows live obligation', () => {
  it('releases confirmed records once nothing pending can need them', async () => {
    const store = make();
    for (let i = 1; i <= 5; i++) {
      const t = store.transaction(() => store.$.y(i));
      await flush();
      t.confirm();
      await flush();
    }
    expect(store.__transactions.getPendingTurnCount()).toBe(0);
    expect(store.__transactions.getConfirmedTurnCount()).toBe(0);
  });

  it('KEEPS a confirmed record while an OLDER pending turn still exists', async () => {
    const store = make();
    const older = store.transaction(() => store.$.x(1));
    await flush();
    const newer = store.transaction(() => store.$.y(2));
    await flush();
    newer.confirm();
    await flush();

    expect(store.__transactions.getConfirmedTurnCount()).toBe(1);
    try {
      older.rollback();
    } catch {
      /* refusal acceptable */
    }
    await flush();
    expect(store.__transactions.getConfirmedTurnCount()).toBe(0);
  });

  it('ORDINARY writes are bounded too, not only transactional churn', async () => {
    const store = make();
    for (let i = 1; i <= 50; i++) {
      store.$.y(i);
      await flush();
    }
    expect(store.__transactions.getConfirmedTurnCount()).toBe(0);
  });
});

describe('L15/15.x — diagnostics are opt-in and bounded', () => {
  it('retains at most the requested number', async () => {
    const store = make({ history: { retain: 5 } });
    for (let i = 1; i <= 50; i++) {
      store.$.y(i);
      await flush();
    }
    const count = store.__transactions.getConfirmedTurnCount();
    expect(count).toBeLessThanOrEqual(5);
    expect(count).toBeGreaterThan(0);
  });
});

describe('L15/15.x — the reader tells the truth about what it kept', () => {
  it('no contract reports TRUNCATED rather than an empty history', async () => {
    const store = make();
    store.$.y(1);
    await flush();
    expect(retentionOf(store)?.truncated).toBe(true);
  });

  it('an untouched tree is NOT truncated', async () => {
    const store = make();
    expect(retentionOf(store)?.truncated).toBe(false);
  });

  it('a contract covering all work is NOT truncated', async () => {
    const store = make({ history: { retain: 100 } });
    for (let i = 1; i <= 3; i++) {
      store.$.y(i);
      await flush();
    }
    expect(retentionOf(store)?.truncated).toBe(false);
    expect(retentionOf(store)?.firstAvailableTurnId).toBe(1);
  });
});

describe('L15/15.x — R06: diagnostics must not change correctness', () => {
  it('settlement outcomes are identical with history on and off', async () => {
    const run = async (config?: unknown) => {
      const store = make(config);
      const older = store.transaction(() => store.$.x(1));
      await flush();
      const newer = store.transaction(() => store.$.x(2));
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
    expect(await run({ history: { retain: 100 } })).toEqual(await run());
  });
});
