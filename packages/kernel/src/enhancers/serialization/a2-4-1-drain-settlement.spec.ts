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

  it('the drain writes NOTHING speculative mid-transaction', async () => {
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

    // ⚠️ INVERTED BY PERSISTENCE-AS-LINK-SWAP-0, exactly as this file's own
    // instruction required. The drain no longer bypasses the consequence
    // authority, because it no longer reaches the tree at all: Link hands a
    // value to the endpoint only from inside its durable-consequence `run`, so
    // a write still held behind an open transaction was never handed over and
    // there is nothing for the drain to flush.
    expect(rec.payloads).toEqual([]);

    pending.rollback();
    await new Promise((r) => setTimeout(r, 60));

    // Tree and storage agree. The rolled-back value was never made durable, so
    // there is no inconsistency for a later write to correct.
    expect(tree.$.a()).toBe('a0');
    expect(rec.payloads.every((p) => p.a !== 'doomed')).toBe(true);
  });
});

/**
 * ## A2-4.1 RESULT — CLOSED BY PERSISTENCE-AS-LINK-SWAP-0
 *
 * ```text
 * autoSave timer   defers to settlement   ✓
 * __flushAutoSave  defers to settlement   ✓   (was ✗)
 * ```
 *
 * The tripwire fired and was inverted rather than deleted, as instructed.
 *
 * ⚠️ THE FIX WAS NOT A ROUTING CHANGE, WHICH IS WHY THE OLD FRAMING COULD NOT
 * FIND IT. This file predicted that routing the drain through
 * `scheduleDurableConsequence` would make its completion asynchronous with
 * respect to settlement, turning "what does the drain return" into part of the
 * same decision. That prediction was correct, and the first attempt at the swap
 * walked straight into it: a drain that awaited settlement HUNG while a
 * transaction was open — a hang at the exact moment a host is trying to leave,
 * which is a worse failure than the one being fixed.
 *
 * The resolution is that the commit boundary stopped being the drain's problem.
 * Link hands a value to the endpoint only from inside its own durable
 * consequence, so by the time anything is drainable it has ALREADY cleared
 * settlement. The drain neither bypasses the authority nor waits on it; it
 * flushes what is settled and returns.
 *
 *     AN UNRESOLVED OPTIMISTIC MUTATION HAS NO COMMITTED TRUTH TO PERSIST.
 *
 * The observation that the boundary was "a property of ONE path through the
 * enhancer" also stands, and is now moot for the same reason: there is one
 * relationship, so there is one boundary. `__flushAutoSave` remains
 * underscore-prefixed and optional — a public drain is still unearned, and is
 * a smaller question now that both paths agree.
 */
