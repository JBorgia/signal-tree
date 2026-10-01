import { describe, expect, it } from 'vitest';

import { confirmedTurnReader } from '../../internals';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

/**
 * The confirmed ledger's exact contents, not only its size.
 *
 * `releaseConfirmedBeyondObligation` trims the ledger from the front, which is
 * only equivalent to the filter it replaced while `insertConfirmed` keeps the
 * ledger sorted by id and the survivors are a suffix. These cases pin the ids,
 * their order and the retention metadata for every shape that reaches it:
 * ordinary records under a pending turn, a confirmed pending turn inserted at
 * the front and in the middle, and `retain` layered over the obligation.
 */

type Handle = { confirm(): void; rollback(): void };
type Store = {
  $: {
    x: (v?: number) => number;
    y: (v?: number) => number;
    z: (v?: number) => number;
  };
  transaction: (fn: () => void) => Handle;
  __transactions: {
    getConfirmedTurnIds(): number[];
    getPendingTurnIds(): number[];
  };
};

const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

const make = (retain?: number): Store =>
  signalTree(
    { x: 0, y: 0, z: 0 },
    {
      enhancers: [
        (retain === undefined
          ? transactions()
          : transactions({ history: { retain } })) as never,
      ],
    }
  ) as unknown as Store;

const ledger = (store: Store) => ({
  confirmed: store.__transactions.getConfirmedTurnIds(),
  pending: store.__transactions.getPendingTurnIds(),
  retention: confirmedTurnReader(store as never)?.readConfirmedTurns()
    .retention,
});

const writeY = async (store: Store, values: number[]) => {
  for (const value of values) {
    store.$.y(value);
    await flush();
  }
};

describe('confirmed ledger order under a pending obligation', () => {
  it('keeps every ordinary record newer than the pending turn, in id order', async () => {
    const store = make();
    const older = store.transaction(() => store.$.x(1));
    await flush();
    await writeY(store, [1, 2, 3]);
    expect(ledger(store)).toEqual({
      confirmed: [2, 3, 4],
      pending: [1],
      retention: { truncated: false, firstAvailableTurnId: 2 },
    });

    const newer = store.transaction(() => store.$.z(1));
    await flush();
    newer.confirm();
    await flush();
    expect(ledger(store).confirmed).toEqual([2, 3, 4, 5]);

    // Nothing later touched x, so the rollback applies and discharges the
    // obligation: every record goes, and the reader says so.
    older.rollback();
    await flush();
    expect(ledger(store)).toEqual({
      confirmed: [],
      pending: [],
      retention: { truncated: true, firstAvailableTurnId: undefined },
    });
  });

  it('inserts a confirmed pending turn in the middle and keeps the order', async () => {
    const store = make();
    const first = store.transaction(() => store.$.x(1));
    await flush();
    await writeY(store, [1]);
    const second = store.transaction(() => store.$.z(1));
    await flush();
    await writeY(store, [2]);
    second.confirm();
    await flush();
    expect(ledger(store)).toEqual({
      confirmed: [2, 3, 4],
      pending: [1],
      retention: { truncated: false, firstAvailableTurnId: 2 },
    });
    first.confirm();
    await flush();
    expect(ledger(store)).toEqual({
      confirmed: [],
      pending: [],
      retention: { truncated: true, firstAvailableTurnId: undefined },
    });
  });
});

describe('confirmed ledger order with retained evidence', () => {
  it('retains the obligation even past `retain`, then trims to the newest', async () => {
    const store = make(2);
    const older = store.transaction(() => store.$.x(1));
    await flush();
    await writeY(store, [1, 2, 3, 4]);
    expect(ledger(store).confirmed).toEqual([2, 3, 4, 5]);
    expect(ledger(store).retention?.truncated).toBe(false);

    // The pending turn confirms at the FRONT (id 1 < 2), the obligation ends,
    // and only the two newest records survive.
    older.confirm();
    await flush();
    expect(ledger(store)).toEqual({
      confirmed: [4, 5],
      pending: [],
      retention: { truncated: true, firstAvailableTurnId: 4 },
    });
  });

  it('a retain covering everything keeps the out-of-order insert sorted', async () => {
    const store = make(10);
    const first = store.transaction(() => store.$.x(1));
    const second = store.transaction(() => store.$.z(1));
    await flush();
    await writeY(store, [1]);
    second.confirm();
    first.confirm();
    await flush();
    expect(ledger(store)).toEqual({
      confirmed: [1, 2, 3],
      pending: [],
      retention: { truncated: false, firstAvailableTurnId: 1 },
    });
  });

  // Pins the pre-existing `slice(-retain)` count truncation rather than a
  // policy: the trim must reproduce it exactly, including `slice(-0)`.
  it.each([
    [0.5, [1, 2, 3, 4], false],
    [2.5, [3, 4], true],
  ])('a fractional retain %s keeps %j', async (retain, kept, truncated) => {
    const store = make(retain);
    await writeY(store, [1, 2, 3, 4]);
    expect(ledger(store).confirmed).toEqual(kept);
    expect(ledger(store).retention?.truncated).toBe(truncated);
  });
});
