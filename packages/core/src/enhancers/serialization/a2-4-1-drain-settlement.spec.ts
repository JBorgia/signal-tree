import { describe, expect, it } from 'vitest';

import { persistence } from './serialization';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from '../transactions/transactions';

import type { StorageAdapter } from './storage-adapters';

/**
 * A2-4.1 — IS THE ONLY EXISTING DRAIN SETTLEMENT-SAFE?
 *
 * A2-4 settled that drain ownership is TREE-SCOPED, and its second test pinned
 * the rule a drain must obey: *the host cannot override settlement*. A2-3.1 then
 * found that the tree-scoped enhancer already ships — and that its only drain,
 * `__flushAutoSave`, calls `enhanced.save()` directly instead of routing through
 * `scheduleDurableConsequence`.
 *
 * That was a code READ. This file is the measurement, because a read is not
 * evidence until it has been shown capable of failing.
 *
 * The production moment is the worst possible one for getting this wrong:
 *
 * ```text
 * transaction open, outcome unknown
 *        ↓
 * Capacitor: app is backgrounding
 *        ↓
 * drain
 *        ↓
 * process may never run again — there is no rollback left to correct anything
 * ```
 */

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

/** Long enough for the 100ms polling fallback to ARM the debounce. */
const armDebounce = () => new Promise((r) => setTimeout(r, 160));

const makeTree = (adapter: StorageAdapter, key: string) =>
  signalTree(
    { a: 'a0' },
    {
      enhancers: [
        transactions(),
        persistence({
          key,
          storage: adapter,
          autoSave: true,
          autoLoad: false,
          // Long enough that the debounce is ARMED but has not fired, which is
          // the only state in which `__flushAutoSave` does anything at all.
          debounceMs: 5000,
        }),
      ],
    }
  ) as unknown as {
    $: { a: { (): string; set(v: string): void } };
    transaction: (fn: () => void) => { confirm(): void; rollback(): void };
    __flushAutoSave?: () => Promise<void>;
  };

describe('A2-4.1: the drain vs. the commit boundary', () => {
  it('CONTROL — the drain does persist an ordinary armed write', async () => {
    const rec = recordingStorage();
    const tree = makeTree(rec.adapter, 'a2-4-1-control');

    tree.$.a.set('a1');
    await armDebounce();
    expect(rec.payloads).toEqual([]); // armed, not fired

    await tree.__flushAutoSave?.();

    // Without this arm, "the drain wrote nothing speculative" would be
    // satisfied by a drain that writes nothing at all.
    expect(rec.payloads.length).toBeGreaterThan(0);
    expect(rec.payloads[rec.payloads.length - 1]).toMatchObject({ a: 'a1' });
  });

  it('⚠️ DEFECT — the drain writes SPECULATIVE state mid-transaction', async () => {
    const rec = recordingStorage();
    const tree = makeTree(rec.adapter, 'a2-4-1-open');

    const pending = tree.transaction(() => {
      tree.$.a.set('doomed');
    });
    await armDebounce();

    // autoSave's own commit boundary is holding correctly at this point.
    expect(rec.payloads).toEqual([]);

    // The host backgrounds. This is the drain the surface offers.
    await tree.__flushAutoSave?.();

    // ⚠️ It bypasses `scheduleDurableConsequence` entirely and serializes the
    // tree as it stands — speculative state, at the moment least able to
    // survive being wrong.
    expect(rec.payloads.length).toBeGreaterThan(0);
    expect(rec.payloads[rec.payloads.length - 1]).toMatchObject({ a: 'doomed' });

    pending.rollback();
    await new Promise((r) => setTimeout(r, 60));

    // And the tree recovers while storage does not: durable truth is now
    // permanently inconsistent with the tree, with no further write coming to
    // correct it, because the drain also tore down autoSave.
    expect(tree.$.a()).toBe('a0');
    expect(rec.payloads[rec.payloads.length - 1]).toMatchObject({ a: 'doomed' });
  });
});

/**
 * ## A2-4.1 RESULT
 *
 * ```text
 * autoSave timer   defers to settlement                    ✓
 * __flushAutoSave  bypasses it, writes speculative state   ✗
 * ```
 *
 * So the enhancer's commit boundary is not a property of the enhancer — it is a
 * property of ONE path through it, and the other path is the one production
 * would call. `__flushAutoSave` is also underscore-prefixed and typed optional,
 * i.e. not a public drain at all.
 *
 * A2's remaining work therefore includes a REAL drain: public, tree-scoped, and
 * routed through the same consequence authority the timer already uses, so that
 * a host event cannot outrank settlement.
 *
 * ⚠️ THIS FILE IS A TRIPWIRE. It asserts the CURRENT, DEFECTIVE behaviour so the
 * defect cannot be quietly carried into the release. Fixing the drain MUST break
 * the second test — invert it then, do not delete it.
 *
 * The fix is deferred to the A2-C surface freeze rather than applied here,
 * because it is not only a routing change: routing through
 * `scheduleDurableConsequence` makes the drain's completion asynchronous with
 * respect to settlement, so what the drain RETURNS and what a host may await
 * are part of the same decision.
 */
