import { describe, expect, it } from 'vitest';

import { flushAllStoredSignals, stored } from './stored';
import { signalTree } from '../signal-tree';
import { transactions } from '../../enhancers/transactions/transactions';

/**
 * A2-4.2 — THE MARKER'S DRAIN vs THE COMMIT BOUNDARY.
 *
 * A2-4.1 measured the enhancer's drain and found it settlement-unsafe:
 * `__flushAutoSave` calls `save()` directly and writes speculative state
 * mid-transaction. This file asks the identical question of the OTHER drain
 * that already exists, one level down, and it is the drain TruckTrax actually
 * calls from Capacitor's pause hook.
 *
 * The two are not symmetric by construction, which is why this cannot be
 * inferred from A2-4.1:
 *
 * ```text
 * __flushAutoSave     serializes the TREE AS IT STANDS -> whatever is in it,
 *                     committed or not
 * flushAllStoredSignals  drains `pendingStoredWrites`, and a value only ENTERS
 *                     that set from `saveCommitted`, which is only reached from
 *                     inside a durable consequence's `run` — i.e. after
 *                     settlement has already permitted it
 * ```
 *
 * If that holds, the drain is settlement-safe *because of what it drains*
 * rather than because it checks anything, and the minimum A2-C surface gets
 * considerably smaller. Asserted from a code read it would be worth nothing;
 * measured, it decides the freeze.
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const fakeStorage = () => {
  const map = new Map<string, string>();
  const writes: unknown[] = [];
  const adapter = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
      try {
        writes.push(JSON.parse(v).data);
      } catch {
        writes.push(v);
      }
    },
    removeItem: (k: string) => void map.delete(k),
    key: () => null,
    length: 0,
  } as unknown as Storage;
  return { map, adapter, writes };
};

const makeTree = (adapter: Storage, key: string) =>
  signalTree(
    // A debounce is required: the drain only has content while a write is
    // pending, and `debounceMs: 0` writes in the caller's stack instead.
    { theme: stored(key, 'light', { storage: adapter, debounceMs: 5000 }) },
    { enhancers: [transactions()] }
  ) as unknown as {
    $: { theme: { (): string; set(v: string): void } };
    transaction: (fn: () => void) => { confirm(): void; rollback(): void };
  };

describe('A2-4.2: flushAllStoredSignals() vs an open transaction', () => {
  it('CONTROL — the drain does persist an ordinary pending write', async () => {
    const s = fakeStorage();
    const tree = makeTree(s.adapter, 'a2-4-2-control');
    tree.$.theme();
    await flush();

    tree.$.theme.set('dark');
    await flush();
    expect(s.writes).toEqual([]); // debounced, not yet written

    flushAllStoredSignals();

    // Without this arm, "the drain wrote nothing speculative" is satisfied by
    // a drain that writes nothing at all.
    expect(s.writes).toEqual(['dark']);
  });

  it('the drain cannot reach a speculative write, because it never held one', async () => {
    const s = fakeStorage();
    const tree = makeTree(s.adapter, 'a2-4-2-open');
    tree.$.theme();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.theme.set('doomed');
    });
    await flush();

    // The host backgrounds mid-transaction and calls the documented drain.
    flushAllStoredSignals();
    await flush();

    // ⚠️ The contrast with A2-4.1. Nothing durable, and not because the drain
    // consulted settlement: the value never entered `pendingStoredWrites` at
    // all, because it is only added from `saveCommitted`, downstream of the
    // consequence the transaction is still holding. There is no ordering in
    // which the drain can be asked the wrong question.
    expect(s.writes).toEqual([]);

    pending.rollback();
    await flush();
    flushAllStoredSignals();

    // ⚠️ NOT what I expected, and the measured answer is better than the
    // predicted one. The rollback's COMPENSATION is itself a write through the
    // marker, so it arms its own durable consequence and the drain persists the
    // RESTORED value. Storage converges on committed truth rather than merely
    // avoiding the speculative one.
    //
    // The invariant is what matters, and it is stated over every write ever
    // made, not over the final one:
    expect(s.writes).not.toContain('doomed');
    expect(s.writes).toEqual(['light']);
    expect(tree.$.theme()).toBe('light');
  });

  it('CONTROL — confirm then drain DOES make the value durable', async () => {
    const s = fakeStorage();
    const tree = makeTree(s.adapter, 'a2-4-2-confirm');
    tree.$.theme();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.theme.set('kept');
    });
    await flush();
    flushAllStoredSignals();
    expect(s.writes).toEqual([]);

    pending.confirm();
    await flush();
    flushAllStoredSignals();

    // Settlement releases the consequence, which arms the debounce, which the
    // drain can then reach. Without this the previous test is satisfied by a
    // drain that is simply broken.
    expect(s.writes).toEqual(['kept']);
  });
});

/**
 * ## A2-4.2 RESULT
 *
 * ```text
 * __flushAutoSave         writes speculative state           ✗  (A2-4.1)
 * flushAllStoredSignals   structurally cannot                ✓
 * ```
 *
 * The marker's drain is settlement-safe by CONSTRUCTION rather than by checking
 * anything, because the only path into the set it drains runs downstream of the
 * commit-consequence authority. That is a stronger property than a check: there
 * is no ordering in which it can be asked the wrong question.
 *
 * It is currently exported from `stored.ts` but NOT from the package barrel.
 */
