import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

/**
 * REKEY-OCCUPANCY-0 — convert T06b from an accidental verdict to a rule.
 *
 * MEASURED before this change (identity-through-seams-0):
 *
 *     rekey A->B, later add A at the vacated key, reject
 *       -> effect-validation-failed; ids=["B","A"]; x=1
 *
 * The VERDICT is right — compensating the rekey means renaming B back to A,
 * and A is occupied by a different subject, so refusing is correct. The
 * MECHANISM is not: it refuses because the compensating re-add physically
 * fails on a taken key, not because any rule recognised the dependency.
 *
 * Deciding by accident has a cost, and it is the R6 symptom. The physical
 * failure happens AFTER the turn has surrendered authority, so `x` is left at
 * its proposed value owned by nothing — a value that is visible, not pending,
 * and not confirmed. That violates L1 and L8.
 *
 * What "fixed" means here is subtle and worth stating, because the VISIBLE
 * STATE IS THE SAME EITHER WAY. A plan-level refusal compensates nothing, so
 * `x` still reads 1. The difference is ownership: after this change the turn
 * is still PENDING and `x = 1` is legitimately its speculative contribution,
 * rather than orphaned. The test for the fix is therefore authority and
 * retryability, not the value of `x`.
 *
 * Written before the implementation. Expected RED.
 */

type Row = { id: string; name: string };

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

type Store = {
  $: {
    x: (v?: number) => number;
    rows: {
      addOne(r: Row): void;
      removeOne(id: string): void;
      changeId(from: string, to: string): void;
      ids(): string[];
      byId(id: string): (() => Row | undefined) | undefined;
    };
  };
  transact: (fn: () => void) => { confirm(): void; rollback(): void };
  __transactions: { getPendingTurnCount(): number };
};

const settle = (op: () => void) => {
  try {
    op();
    return 'settled';
  } catch (e) {
    return (
      ((e as { cause?: { kind?: string } })?.cause?.kind as string) ?? 'threw'
    );
  }
};

const arrive = async () => {
  const store = signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }), x: 0 },
    { enhancers: [transactions()] }
  ) as unknown as Store;
  store.$.rows.addOne({ id: 'A', name: 'original' });
  await flush();

  const pending = store.transact(() => {
    store.$.x(1);
    store.$.rows.changeId('A', 'B');
  });
  await flush();

  // Newer truth occupies the key the rekey vacated.
  store.$.rows.addOne({ id: 'A', name: 'newcomer' });
  await flush();

  return { store, pending };
};

describe('REKEY-OCCUPANCY-0 / 1 — refuse by rule, not by physical failure', () => {
  it('reports a dependency refusal rather than effect-validation-failed', async () => {
    const { store, pending } = await arrive();

    const outcome = settle(() => pending.rollback());

    // The occupied destination is a DEPENDENCY on newer truth, and should be
    // recognised as one before anything is attempted.
    expect(outcome).toBe('later-confirmed-dependency');
  });

  it('retains settlement authority, so nothing is orphaned', async () => {
    const { store, pending } = await arrive();

    settle(() => pending.rollback());

    // L1/L8: x = 1 is still visible, but it must be OWNED. Before this change
    // the turn was retired and x belonged to nothing.
    expect(store.__transactions.getPendingTurnCount()).toBe(1);
    expect(store.$.x()).toBe(1);
  });

  it('changes no state at all', async () => {
    const { store, pending } = await arrive();
    const before = {
      ids: store.$.rows.ids(),
      a: store.$.rows.byId('A')?.()?.name,
      b: store.$.rows.byId('B')?.()?.name,
      x: store.$.x(),
    };

    settle(() => pending.rollback());

    expect({
      ids: store.$.rows.ids(),
      a: store.$.rows.byId('A')?.()?.name,
      b: store.$.rows.byId('B')?.()?.name,
      x: store.$.x(),
    }).toEqual(before);
  });
});

describe('REKEY-OCCUPANCY-0 / 2 — the refusal is recoverable', () => {
  it('clearing the occupying subject lets the same turn settle', async () => {
    const { store, pending } = await arrive();

    expect(settle(() => pending.rollback())).toBe('later-confirmed-dependency');

    // Remove the newcomer; the destination key is free again.
    store.$.rows.removeOne('A');
    await flush();

    expect(settle(() => pending.rollback())).toBe('settled');
    expect(store.$.x()).toBe(0);
    expect(store.$.rows.ids()).toEqual(['A']);
    expect(store.$.rows.byId('A')?.()?.name).toBe('original');
    expect(store.__transactions.getPendingTurnCount()).toBe(0);
  });
});

describe('REKEY-OCCUPANCY-0 / 3 — CONTROLS: the other arms are unchanged', () => {
  it('T06a rekey + later field write still reverses independently', async () => {
    const store = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }), x: 0 },
      { enhancers: [transactions()] }
    ) as unknown as Store;
    store.$.rows.addOne({ id: 'A', name: 'original' });
    await flush();
    const pending = store.transact(() => {
      store.$.x(1);
      store.$.rows.changeId('A', 'B');
    });
    await flush();
    store.$.rows.byId('B');
    (
      store.$.rows as unknown as {
        updateOne(id: string, patch: Partial<Row>): void;
      }
    ).updateOne('B', { name: 'later' });
    await flush();

    expect(settle(() => pending.rollback())).toBe('settled');
    expect(store.$.rows.ids()).toEqual(['A']);
    expect(store.$.rows.byId('A')?.()?.name).toBe('later');
  });

  it('T07 rekey + later remove is still superseded and reverses cleanly', async () => {
    const store = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }), x: 0 },
      { enhancers: [transactions()] }
    ) as unknown as Store;
    store.$.rows.addOne({ id: 'A', name: 'original' });
    await flush();
    const pending = store.transact(() => {
      store.$.x(1);
      store.$.rows.changeId('A', 'B');
    });
    await flush();
    store.$.rows.removeOne('B');
    await flush();

    expect(settle(() => pending.rollback())).toBe('settled');
    expect(store.$.rows.ids()).toEqual([]);
    expect(store.$.x()).toBe(0);
  });

  it('a rekey with a FREE destination still reverses', async () => {
    const store = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }), x: 0 },
      { enhancers: [transactions()] }
    ) as unknown as Store;
    store.$.rows.addOne({ id: 'A', name: 'original' });
    await flush();
    const pending = store.transact(() => {
      store.$.x(1);
      store.$.rows.changeId('A', 'B');
    });
    await flush();

    expect(settle(() => pending.rollback())).toBe('settled');
    expect(store.$.rows.ids()).toEqual(['A']);
    expect(store.$.x()).toBe(0);
  });
});
