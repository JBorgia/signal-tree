import { describe, expect, it } from 'vitest';

import { persistence } from '../enhancers/serialization/serialization';
import { restoration } from '../enhancers/restoration/restoration';
import { scheduleDurableConsequence } from './internals/commit-consequence';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

import type { StorageAdapter } from '../enhancers/serialization/storage-adapters';

/**
 * A2-3.1 — A DISCARDED VALUE MUST NEVER BECOME DURABLE, promoted out of A2-3
 * into its own permanent proof.
 *
 * ⚠️ THE ASSERTION IS "THROUGHOUT", NOT "FINALLY". A final-state test happily
 * accepts `light -> dark -> light`, which is exactly the crash-window defect
 * A2-3 found: durable truth transiently holding a value the transaction
 * explicitly rejected. Every payload that ever reached storage is inspected.
 *
 * ## This file corrects A2-3's own conclusion
 *
 * A2-3 recorded the hazard as "deferral alone is insufficient; a persister
 * needs the settlement OUTCOME, so it must CANCEL like `stored()` does".
 * Reading `settleCommitScope` and then measuring the shipping surface shows
 * that diagnosis was wrong in an instructive way.
 *
 * ```text
 * scope.consequences   registered while owner + transactionId are AMBIENT.
 *                      commit -> run.  discard -> CLEARED WITHOUT RUNNING.
 * heldByKey            registered with no ambient transaction while the tree
 *                      has an open scope. Runs on settle REGARDLESS of outcome.
 * ```
 *
 * Any DEBOUNCED persister lands in `heldByKey` — necessarily, because a timer
 * fires after the transaction callback has returned and there is no ambient
 * context left to read. So it cannot be cancelled by outcome, and A2-3's
 * prescription is unavailable to the very shape that needs it.
 *
 * The real discriminator is not the authority and not cancellation. It is
 * **WHEN THE PERSISTED VALUE IS READ**:
 *
 * ```text
 * ARM-TIME capture   closes over the value observed at write time.
 *                    A discarded value is already in hand when the
 *                    consequence runs -> it persists it.        ✗
 * RUN-TIME capture   reads the tree inside `run`, after settlement has
 *                    restored it. Outcome-independent BY CONSTRUCTION,
 *                    with no cancellation at all.               ✓
 * ```
 *
 * `stored()` is rollback-safe by cancelling (it captures early, in the
 * mutation's own stack). `persistence()` is rollback-safe by reading late.
 * Both satisfy the invariant; neither mechanism is the invariant.
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

/** Long enough for the 100ms polling fallback plus the autoSave debounce. */
const settleTimers = () => new Promise((r) => setTimeout(r, 260));

const recordingStorage = () => {
  const map = new Map<string, string>();
  const payloads: Array<Record<string, unknown>> = [];
  const adapter: StorageAdapter = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
      try {
        payloads.push(JSON.parse(v).data as Record<string, unknown>);
      } catch {
        payloads.push({ __unparsed: v });
      }
    },
    removeItem: (k) => void map.delete(k),
  };
  return { adapter, payloads };
};

const persistedTree = (adapter: StorageAdapter, key: string) =>
  signalTree(
    { theme: 'light' },
    {
      enhancers: [
        restoration(),
        transactions(),
        persistence({
          key,
          storage: adapter,
          autoSave: true,
          autoLoad: false,
          debounceMs: 10,
        }),
      ],
    }
  ) as unknown as {
    $: { theme: { (): string; set(v: string): void } };
    transaction: (fn: () => void) => { confirm(): void; rollback(): void };
  };

describe('A2-3.1 on the SHIPPING tree-scoped surface', () => {
  it('no payload storage ever held contains the rolled-back value', async () => {
    const rec = recordingStorage();
    const tree = persistedTree(rec.adapter, 'a2-3-1-rollback');

    const pending = tree.transaction(() => {
      tree.$.theme.set('dark');
    });
    await settleTimers();
    expect(rec.payloads).toEqual([]); // deferred while unsettled

    pending.rollback();
    await settleTimers();

    // ⚠️ THE LOAD-BEARING LINE — every payload, not the last one.
    for (const payload of rec.payloads) {
      expect(payload['theme']).not.toBe('dark');
    }
    expect(tree.$.theme()).toBe('light');
  });

  it('CONTROL — confirm DOES make the value durable', async () => {
    const rec = recordingStorage();
    const tree = persistedTree(rec.adapter, 'a2-3-1-confirm');

    const pending = tree.transaction(() => {
      tree.$.theme.set('dark');
    });
    await settleTimers();
    expect(rec.payloads).toEqual([]);

    pending.confirm();
    await settleTimers();

    // Without this arm, "never contains dark" is satisfied by a capability
    // that never persists anything at all.
    expect(rec.payloads.length).toBeGreaterThan(0);
    expect(rec.payloads[rec.payloads.length - 1]).toMatchObject({
      theme: 'dark',
    });
  });
});

/**
 * The discriminator, isolated. Both arms use the SAME tree, the SAME single
 * consequence authority, and the SAME `heldByKey` bucket — a debounced
 * persister's registration, made after the transaction callback returned. The
 * ONLY difference is when the persisted value is read.
 *
 * No observation seam is involved, deliberately: the hazard is a property of
 * value capture, so wiring it to the path notifier (NOTIFIER-SCOPE-0) or to
 * `interceptLeafSignals` would only add a confound.
 */
describe('A2-3.1 discriminator: arm-time vs run-time value capture', () => {
  const armed = async (capture: 'arm' | 'run') => {
    const durable: unknown[] = [];
    const tree = signalTree(
      { theme: 'light' },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();

    const pending = tree.transaction(() => {
      tree.$.theme.set('dark');
    });
    await flush();

    // The debounce elapses HERE — mid-transaction, with no ambient context.
    const capturedAtArm = tree.$.theme();
    scheduleDurableConsequence({
      claimant: tree,
      key: 'theme',
      run: () =>
        durable.push(capture === 'arm' ? capturedAtArm : tree.$.theme()),
    });
    await flush();
    const duringPending = [...durable];

    pending.rollback();
    await flush();

    return { durable, duringPending, final: tree.$.theme() };
  };

  it('⚠️ ARM-TIME capture persists the discarded value — A2-3 restated correctly', async () => {
    const r = await armed('arm');

    // Deferral WORKED: nothing durable while the transaction was open.
    expect(r.duringPending).toEqual([]);
    // And it still failed, because the consequence is in the always-run bucket
    // and was already holding the speculative value.
    expect(r.durable).toEqual(['dark']);
    expect(r.final).toBe('light');
  });

  it('RUN-TIME capture is outcome-independent with NO cancellation', async () => {
    const r = await armed('run');

    expect(r.duringPending).toEqual([]);
    // Same authority, same bucket, same always-run path — correct payload,
    // because settlement restored the tree before `run` read it.
    expect(r.durable).toEqual(['light']);
    expect(r.final).toBe('light');
  });
});

/**
 * ## A2-3.1 RESULT
 *
 * ```text
 * INVARIANT   no durable payload may EVER contain a discarded value
 * NOT the invariant: "route through the consequence authority" (both arms do)
 * NOT the invariant: "cancel on discard"   (persistence() never cancels)
 * ```
 *
 * Two sufficient strategies, and a durability capability must pick one
 * explicitly rather than inherit safety from the authority:
 *
 * ```text
 * stored()       captures in the mutation's own stack -> MUST cancel
 * persistence()  reads the tree inside run()          -> nothing to cancel
 * ```
 *
 * A2-3's arm-B/arm-C result stands: a LEAF claimant resolves no scope and
 * defers nothing. What does not stand is its explanation of the arm-C residue.
 */
