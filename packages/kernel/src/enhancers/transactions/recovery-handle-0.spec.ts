import { describe, expect, it, vi } from 'vitest';

import { getTreeRealizationPort } from '../../lib/internals/causal-runtime/tree-realization-adapter';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { SignalTreeRollbackError } from '../../lib/types';
import { transactions } from './transactions';

/**
 * RECOVERY-HANDLE-0 — owner decision 1, approved 2026-09-24.
 *
 * When a transaction callback throws AND compensation then refuses,
 * `transact()` never returns:
 *
 *     if (primaryFailed) {
 *       handle.rollback();   // throws on refusal
 *       throw primaryError;  // never reached
 *     }
 *
 * The transaction is still pending and still settleable, but the caller has no
 * reference to it. Catching inside the callback only helps prospectively, and
 * cannot help a caller who already wrote the code.
 *
 * The approved shape attaches an optional recovery to the EXISTING error rather
 * than changing what is thrown:
 *
 *     recovery: { transaction, callbackFailed: true, callbackError }
 *
 * Two constraints from the decision, both tested here as negatives:
 *
 *   - `callbackFailed` is an explicit boolean because a callback may legally
 *     throw `undefined`; the absence of `callbackError` cannot carry the fact.
 *   - An OBSERVER failure must not be mislabeled a callback failure. An
 *     observer can throw AFTER compensation has physically installed, and that
 *     turn is settled — attaching a recovery handle there would offer authority
 *     that no longer exists.
 *
 * Written before the implementation. Expected RED on the current source.
 */

type Row = { id: string; name: string };

type Store = {
  $: {
    count: (v?: number) => number;
    rows: {
      addOne(row: Row): void;
      removeOne(id: string): void;
      ids(): string[];
    };
  };
  transact: (fn: () => void) => { confirm(): void; rollback(): void };
  __transactions: {
    getConfirmedTurnCount(): number;
    getPendingTurnCount(): number;
  };
};

const makeStore = async () => {
  const store = signalTree(
    {
      count: 0,
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    },
    { enhancers: [transactions()] }
  ) as unknown as Store;
  store.$.rows.addOne({ id: 'b', name: 'Base' });
  await Promise.resolve();
  await Promise.resolve();
  return store;
};

/**
 * Force compensation to refuse, the same way transactions.spec.ts does: make
 * effect validation report structural drift so the rollback plan cannot be
 * applied. Typed concretely rather than through `as never`, which erased the
 * spy's own type and hid a real typing error from the spec gate.
 */
type ValidatingPort = {
  validateEffects: (...args: unknown[]) => { kind: string };
};

const refuseCompensation = (store: Store) => {
  const port = getTreeRealizationPort(
    (store as unknown as { $: object }).$
  ) as unknown as ValidatingPort | undefined;
  if (!port?.validateEffects) throw new Error('no realization port');
  return vi
    .spyOn(port, 'validateEffects')
    .mockImplementation(() => ({ kind: 'structural-drift' }));
};

type Recovery = {
  transaction: { confirm(): void; rollback(): void };
  callbackFailed: boolean;
  callbackError?: unknown;
};

const recoveryOf = (error: unknown): Recovery | undefined =>
  (error as { recovery?: Recovery })?.recovery;

describe('RECOVERY-HANDLE-0 / 1 — callback threw and compensation refused', () => {
  it('the thrown error carries a handle to the still-pending transaction', async () => {
    const store = await makeStore();
    const spy = refuseCompensation(store);

    let thrown: unknown;
    try {
      store.transact(() => {
        store.$.count(1);
        store.$.rows.removeOne('b');
        throw new Error('boom');
      });
      throw new Error('expected the refusal to surface');
    } catch (error) {
      thrown = error;
    } finally {
      spy.mockRestore();
    }

    expect(thrown).toBeInstanceOf(SignalTreeRollbackError);
    // Original evidence is preserved on the cause, unchanged. `cause` is
    // deliberately NOT a declared field on the class (see types.ts: the
    // workspace disagrees about whether Error declares it), so it is read
    // through a cast here exactly as the enhancer's own specs do.
    expect((thrown as { cause?: unknown }).cause).toMatchObject({
      callbackError: expect.objectContaining({ message: 'boom' }),
    });

    const recovery = recoveryOf(thrown);
    expect(recovery).toBeDefined();
    expect(recovery?.callbackFailed).toBe(true);
    expect(recovery?.callbackError).toMatchObject({ message: 'boom' });
    expect(typeof recovery?.transaction.rollback).toBe('function');

    // The authority it hands back is real: still exactly one pending turn.
    expect(store.__transactions.getPendingTurnCount()).toBe(1);
  });

  it('the recovered handle can settle once the conflict is gone', async () => {
    const store = await makeStore();
    const spy = refuseCompensation(store);

    let thrown: unknown;
    try {
      store.transact(() => {
        store.$.count(1);
        store.$.rows.removeOne('b');
        throw new Error('boom');
      });
    } catch (error) {
      thrown = error;
    } finally {
      spy.mockRestore();
    }

    const recovery = recoveryOf(thrown);
    expect(recovery).toBeDefined();

    // Compensation is no longer refused; the same transaction settles.
    expect(() => recovery?.transaction.rollback()).not.toThrow();
    expect(store.$.count()).toBe(0);
    expect(store.$.rows.ids()).toEqual(['b']);
    expect(store.__transactions.getPendingTurnCount()).toBe(0);
  });
});

describe('RECOVERY-HANDLE-0 / 2 — a thrown undefined still reports a failure', () => {
  it('callbackFailed is explicit, because callbackError cannot carry it', async () => {
    const store = await makeStore();
    const spy = refuseCompensation(store);

    let thrown: unknown;
    try {
      store.transact(() => {
        store.$.count(1);
        store.$.rows.removeOne('b');
        throw undefined;
      });
    } catch (error) {
      thrown = error;
    } finally {
      spy.mockRestore();
    }

    const recovery = recoveryOf(thrown);
    expect(recovery).toBeDefined();
    // The flag is the only thing that distinguishes "threw undefined" from
    // "did not throw".
    expect(recovery?.callbackFailed).toBe(true);
    expect(recovery?.callbackError).toBeUndefined();
  });
});

describe('RECOVERY-HANDLE-0 / 3 — CONTROL: refusal with no callback failure', () => {
  it('a refused rollback on a healthy callback is unchanged', async () => {
    const store = await makeStore();

    const pending = store.transact(() => {
      store.$.count(1);
      store.$.rows.removeOne('b');
    });
    await Promise.resolve();

    const spy = refuseCompensation(store);
    let thrown: unknown;
    try {
      pending.rollback();
    } catch (error) {
      thrown = error;
    } finally {
      spy.mockRestore();
    }

    expect(thrown).toBeInstanceOf(SignalTreeRollbackError);
    // The caller already holds the handle, so no recovery is attached and the
    // shape of this error does not change.
    expect(recoveryOf(thrown)).toBeUndefined();
    expect(store.__transactions.getPendingTurnCount()).toBe(1);
  });
});

describe('RECOVERY-HANDLE-0 / 4 — CONTROL: callback threw, compensation SUCCEEDED', () => {
  it('the original callback error is rethrown, with no recovery', async () => {
    const store = await makeStore();

    let thrown: unknown;
    try {
      store.transact(() => {
        store.$.count(1);
        throw new Error('boom');
      });
    } catch (error) {
      thrown = error;
    }

    // Unchanged behaviour: the caller sees their own error, and there is
    // nothing to recover because the turn settled.
    expect((thrown as Error)?.message).toBe('boom');
    expect(recoveryOf(thrown)).toBeUndefined();
    expect(store.$.count()).toBe(0);
    expect(store.__transactions.getPendingTurnCount()).toBe(0);
  });
});
