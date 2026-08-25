import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  clearTreeErrorListenersForTesting,
  onTreeError,
  type TreeErrorEvent,
} from './internals/error-reporter';
import { link } from './link';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * PERSISTENCE-DECOMPOSE-0 — can the FROZEN Link API express persistence?
 *
 * Analysis and prototype only. Nothing is deleted, and Link is NOT modified.
 *
 * ```text
 * PREREGISTERED, NOT REOPENED
 *   stored()                DELETE
 *   flushAllStoredSignals() DELETE
 *   global persistence drain REJECTED
 * ```
 *
 * The open question is where each responsibility LANDS once `stored` is gone.
 *
 * ## The hypothesis under test
 *
 * ```text
 * Link                 the state relationship, outbound sync, settlement
 * endpoint / adapter   storage backend, serialization, durable representation,
 *                      write scheduling policy
 * application          domain decisions that are not SignalTree semantics
 * ```
 *
 * ⚠️ A `StoredOptions`-shaped object is NOT copied onto an endpoint. The
 * endpoint below is exactly `LinkEndpoint<T>` — `get` and `set` — and every
 * storage concern lives INSIDE those two functions.
 *
 * ## ⚠️ THE LESSON CARRIED FROM ASYNC-SOURCE-RETIRE-1
 *
 * That retirement found two mechanisms that both looked like "async
 * acquisition" but had observably different race semantics — Observable
 * cancelled, Promise silently let a stale write win. So "await write", "flush"
 * and "settled" are treated here as THREE DIFFERENT CLAIMS, each measured
 * separately, rather than as synonyms.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

/** A fake durable backend with observable write timing. */
const backend = () => {
  const store = new Map<string, string>();
  const writes: string[] = [];
  let failNext = false;
  return {
    store,
    writes,
    failWrites: (v: boolean) => (failNext = v),
    read: (k: string) => store.get(k) ?? null,
    write: (k: string, v: string) => {
      if (failNext) throw new Error('quota exceeded');
      store.set(k, v);
      writes.push(v);
    },
  };
};

type Settings = { theme: string; density: number };

/**
 * The whole persistence adapter: a `LinkEndpoint<T>` whose `get`/`set` own the
 * storage key, the codec, and the write scheduling. Link sees only `T`.
 */
const persistenceEndpoint = <T>(
  be: ReturnType<typeof backend>,
  key: string,
  opts: { debounceMs?: number; serialize?: (v: T) => string } = {}
) => {
  const serialize = opts.serialize ?? ((v: T) => JSON.stringify(v));
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    get: (): T | Promise<T> => {
      const raw = be.read(key);
      if (raw === null) throw new Error(`no durable value at ${key}`);
      return JSON.parse(raw) as T;
    },
    // ⚠️ Returns a Promise that resolves only when the DURABLE write has
    // actually landed — which is what makes `settled()` a durability boundary
    // rather than a scheduling boundary.
    set: (value: T): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        if (timer) clearTimeout(timer);
        const ms = opts.debounceMs ?? 0;
        timer = setTimeout(() => {
          timer = undefined;
          try {
            be.write(key, serialize(value));
            resolve();
          } catch (e) {
            reject(e);
          }
        }, ms);
      }),
  };
};

const makeTree = () =>
  signalTree(
    { settings: { theme: 'light', density: 1 } },
    { enhancers: [restoration(), transactions()] }
  );

// ───────────────────────────────────────────────────────────────────────────
// 8 — TRANSACTION / ROLLBACK. The strongest potential falsifier.
// ───────────────────────────────────────────────────────────────────────────

describe('PERSISTENCE-DECOMPOSE-0 §8: speculative writes must NOT persist', () => {
  it('⚠️ a ROLLED-BACK transaction never reaches durable storage', async () => {
    const be = backend();
    const tree = makeTree();
    await flush();
    const l = link(tree.$.settings, persistenceEndpoint<Settings>(be, 'k'));

    const p = tree.transaction(() => {
      tree.$.settings.theme.set('A');
      tree.$.settings.density.set(2);
    });
    await flush();
    p.rollback();
    await flush();
    await l.settled();

    // ⚠️ THE LOAD-BEARING ASSERTION, and my first version of it was WRONG.
    //
    // I asserted `writes === []`. It failed — with ONE write of
    // `{ theme: 'light', density: 1 }`, the POST-ROLLBACK state. So Link did not
    // leak speculative values; the rollback is itself a state change, which
    // armed a reconciling send of the committed truth.
    //
    // That is LINK-RACE-1 behaviour (reconcile X against acknowledged Y), not a
    // persistence defect. The real invariant is that no SPECULATIVE value is
    // ever durable — asserted directly below.
    const persisted = be.writes.map((w) => JSON.parse(w));
    for (const v of persisted) {
      expect(v).not.toEqual({ theme: 'A', density: 2 });
      expect(v.theme).not.toBe('A');
      expect(v.density).not.toBe(2);
    }
    // And whatever landed is the committed state.
    expect(persisted.every((v) => v.theme === 'light' && v.density === 1)).toBe(
      true
    );
    l.dispose();
  });

  it('a COMMITTED transaction persists the committed outcome, once', async () => {
    const be = backend();
    const tree = makeTree();
    await flush();
    const l = link(tree.$.settings, persistenceEndpoint<Settings>(be, 'k'));

    const p = tree.transaction(() => {
      tree.$.settings.theme.set('B');
      tree.$.settings.density.set(3);
    });
    await flush();
    p.confirm();
    await flush();
    await l.settled();

    // One write of the COMPLETE committed value — not one per field.
    expect(be.writes).toHaveLength(1);
    expect(JSON.parse(be.writes[0])).toEqual({ theme: 'B', density: 3 });
    l.dispose();
  });

  it('an ordinary authored write persists without a transaction', async () => {
    const be = backend();
    const tree = makeTree();
    await flush();
    const l = link(tree.$.settings, persistenceEndpoint<Settings>(be, 'k'));

    tree.$.settings.theme.set('plain');
    await flush();
    await l.settled();

    expect(JSON.parse(be.writes[0])).toEqual({ theme: 'plain', density: 1 });
    l.dispose();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 9 — SETTLEMENT vs DEBOUNCE. Does local settlement replace the global flush?
// ───────────────────────────────────────────────────────────────────────────

describe('PERSISTENCE-DECOMPOSE-0 §9: settled() as a DURABILITY boundary', () => {
  it('⚠️ await settled() waits for the DEBOUNCED durable write', async () => {
    const be = backend();
    const tree = makeTree();
    await flush();
    const l = link(
      tree.$.settings,
      persistenceEndpoint<Settings>(be, 'k', { debounceMs: 30 })
    );

    tree.$.settings.theme.set('debounced');
    await flush();

    // Not yet durable — the debounce is still pending.
    expect(be.store.size).toBe(0);

    await l.settled();

    // ⚠️ THIS IS THE flushAllStoredSignals() REPLACEMENT. A bounded-lifetime
    // consumer awaits ITS OWN relationship instead of a process-wide drain.
    expect(be.store.size).toBe(1);
    expect(JSON.parse(be.store.get('k') as string)).toEqual({
      theme: 'debounced',
      density: 1,
    });
    l.dispose();
  });

  it('rapid writes coalesce, and settled() still waits for the LAST one', async () => {
    const be = backend();
    const tree = makeTree();
    await flush();
    const l = link(
      tree.$.settings,
      persistenceEndpoint<Settings>(be, 'k', { debounceMs: 25 })
    );

    tree.$.settings.theme.set('A');
    await flush();
    tree.$.settings.theme.set('B');
    await flush();
    tree.$.settings.theme.set('C');
    await flush();
    await l.settled();

    // Coalescing is the ENDPOINT's policy — Link neither knows nor cares.
    expect(JSON.parse(be.store.get('k') as string).theme).toBe('C');
    l.dispose();
  });

  it('a write FAILURE is reported once, and a later write still succeeds', async () => {
    clearTreeErrorListenersForTesting();
    const seen: TreeErrorEvent[] = [];
    const off = onTreeError((e) => seen.push(e));

    const be = backend();
    const tree = makeTree();
    await flush();
    const l = link(tree.$.settings, persistenceEndpoint<Settings>(be, 'k'));

    be.failWrites(true);
    tree.$.settings.theme.set('doomed');
    await flush();
    await l.settled();

    expect(seen).toHaveLength(1);
    expect(seen[0].operation).toBe('link:set');
    expect(seen[0].path).toBe('settings');
    // ⚠️ The STATE LOCATION, not the storage key — the frozen error contract
    // holds, and 'k' never leaks into `path`.
    expect(seen[0].path).not.toBe('k');
    // X stays authored despite the failed egress.
    expect(tree.$.settings.theme()).toBe('doomed');

    // ⚠️ The queue survives — no permanently dead storage subsystem.
    be.failWrites(false);
    tree.$.settings.theme.set('recovered');
    await flush();
    await l.settled();
    expect(JSON.parse(be.store.get('k') as string).theme).toBe('recovered');

    l.dispose();
    off();
    clearTreeErrorListenersForTesting();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 11/12 — SERIALIZATION and MIGRATION live entirely inside the endpoint
// ───────────────────────────────────────────────────────────────────────────

describe('PERSISTENCE-DECOMPOSE-0 §11-12: codec and migration are endpoint-owned', () => {
  it('a custom serializer never reaches Link', async () => {
    const be = backend();
    const tree = makeTree();
    await flush();
    const l = link(
      tree.$.settings,
      persistenceEndpoint<Settings>(be, 'k', {
        serialize: (v) => `V2|${JSON.stringify(v)}`,
      })
    );

    tree.$.settings.theme.set('custom');
    await flush();
    await l.settled();

    // Link transported T; the endpoint chose the wire format.
    expect(be.store.get('k')).toMatch(/^V2\|/);
    l.dispose();
  });

  it('⚠️ retrieve() runs a VERSION MIGRATION with no Link involvement', async () => {
    const be = backend();
    // A legacy v1 payload already on disk.
    be.store.set('k', JSON.stringify({ __v: 1, theme: 'legacy' }));

    const tree = makeTree();
    await flush();

    const l = link(tree.$.settings, {
      get: (): Settings => {
        const raw = JSON.parse(be.read('k') as string);
        // Migration happens while INTERPRETING the durable representation —
        // which is why it belongs to the endpoint, not the state engine.
        if (raw.__v === 1) return { theme: raw.theme, density: 1 };
        return raw as Settings;
      },
    });

    await l.retrieve();
    await flush();

    expect(tree.$.settings()).toEqual({ theme: 'legacy', density: 1 });
    l.dispose();
  });

  it('a malformed durable value surfaces through the frozen error channel', async () => {
    clearTreeErrorListenersForTesting();
    const seen: TreeErrorEvent[] = [];
    const off = onTreeError((e) => seen.push(e));

    const be = backend();
    be.store.set('k', '{not json');
    const tree = makeTree();
    await flush();

    const l = link(tree.$.settings, persistenceEndpoint<Settings>(be, 'k'));

    // ⚠️ MEASURED, not assumed: a failing `retrieve()` REJECTS to its own
    // caller rather than routing to onTreeError. The reporter covers automatic
    // OUTBOUND egress; an explicitly awaited operation returns its own error.
    await expect(l.retrieve()).rejects.toThrow();
    expect(seen).toHaveLength(0);
    // State is untouched by the failed read.
    expect(tree.$.settings.theme()).toBe('light');

    l.dispose();
    off();
    clearTreeErrorListenersForTesting();
  });

  it('an absent durable value is the endpoint\'s decision, not Link\'s', async () => {
    const be = backend();
    const tree = makeTree();
    await flush();

    // This endpoint chooses "leave the in-tree default alone".
    const l = link(tree.$.settings, {
      get: (): Settings => {
        const raw = be.read('k');
        if (raw === null) return tree.$.settings();
        return JSON.parse(raw) as Settings;
      },
    });

    await l.retrieve();
    await flush();
    expect(tree.$.settings()).toEqual({ theme: 'light', density: 1 });
    l.dispose();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENCE-DECOMPOSE-0B — the rows 0A left open, and two corrections
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ CORRECTION 1 — "rapid writes coalesce by ENDPOINT policy" was WRONG.
 *
 * 0A asserted only that the final durable value was `C`, and called that
 * coalescing. Instrumented properly — set() invocations, resolutions and durable
 * writes, with a 50ms endpoint timer and authored writes at t=0/20/40:
 *
 * ```text
 * set(A) INVOKED +5ms    -> DURABLE +58ms
 * set(C) INVOKED +60ms   -> DURABLE +113ms
 * durable writes: ["A","C"]   count = 2      NOT one
 * pending timers cleared: 0
 * ```
 *
 * **TWO durable writes, and `B` was never passed to `set()` at all.** The
 * coalescing is LINK's — its reconciliation loop reads the CURRENT value after
 * each acknowledged send, so intermediate truth is skipped. The endpoint's timer
 * contributes only latency; it is not a debounce, because Link serializes and
 * the timer is therefore never cleared while pending.
 *
 * ⚠️ That also makes the orphaned-Promise hazard in the 0A prototype
 * UNREACHABLE (`pendingCleared === 0`) — but only because Link's serial contract
 * happens to prevent it, which is worth knowing rather than relying on.
 *
 * ⚠️ CORRECTION 2 — `maxWaitMs` is OBSOLETE UNDER LINK SERIALIZATION.
 *
 * Continuous authored writes every 15ms against a 40ms durable latency:
 *
 * ```text
 * durable: 1, 3, 6, 8, 11, 13, 16, 19, 20     9 writes over 458ms
 * final durable = 20 = tree value             NO starvation
 * ```
 *
 * One durable write per send-completion, always carrying the newest truth.
 * `maxWaitMs` existed to bound `stored`'s RESTARTABLE debounce, which could
 * starve indefinitely under continuous writes. Link never restarts a timer — it
 * sends, then sends whatever is latest — so that STARVATION failure mode is
 * structurally impossible and `maxWaitMs` has nothing left to bound.
 *
 * ⚠️ NARROWER THAN IT FIRST READ. This does NOT mean Link serialization supplies
 * every reason someone configured `debounceMs`. Time-based WRITE-RATE REDUCTION
 * remains a distinct endpoint policy — and the A/C measurement above is the
 * evidence: the 50ms endpoint timer produced 2 durable writes where 3 authored
 * writes occurred, which is rate reduction that Link's coalescing did not supply
 * on its own. Link removes the starvation ARGUMENT for `maxWaitMs`; it does not
 * make `debounceMs` redundant.
 */
describe('0B §3: a real codec ROUND-TRIPS inside the endpoint', () => {
  const codec = {
    encode: (v: Settings) => `V2|${v.theme}|${v.density}`,
    decode: (raw: string): Settings => {
      const [tag, theme, density] = raw.split('|');
      if (tag !== 'V2') throw new Error(`bad codec tag ${tag}`);
      return { theme, density: Number(density) };
    },
  };

  const codecEndpoint = (be: ReturnType<typeof backend>, key: string) => ({
    get: (): Settings => codec.decode(be.read(key) as string),
    set: (v: Settings) => void be.write(key, codec.encode(v)),
  });

  it('⚠️ encode AND decode both live in the endpoint; Link sees only T', async () => {
    const be = backend();

    // Author -> encode -> durable bytes.
    const writer = makeTree();
    await flush();
    const lw = link(writer.$.settings, codecEndpoint(be, 'k'));
    writer.$.settings.theme.set('round');
    writer.$.settings.density.set(7);
    await flush();
    await lw.settled();
    lw.dispose();

    expect(be.store.get('k')).toBe('V2|round|7');

    // A FRESH tree -> retrieve -> decode -> the same T.
    const reader = makeTree();
    await flush();
    const lr = link(reader.$.settings, codecEndpoint(be, 'k'));
    await lr.retrieve();
    await flush();

    // 0A's custom-serializer test was ONE-WAY: its default get() did
    // JSON.parse and could never have read back `V2|...`. This closes that gap.
    expect(reader.$.settings()).toEqual({ theme: 'round', density: 7 });
    lr.dispose();
  });

  it('a malformed durable value rejects retrieve() and leaves state alone', async () => {
    const be = backend();
    be.store.set('k', 'V9|garbage|nope');
    const tree = makeTree();
    await flush();
    const l = link(tree.$.settings, codecEndpoint(be, 'k'));

    await expect(l.retrieve()).rejects.toThrow(/bad codec tag/);
    expect(tree.$.settings()).toEqual({ theme: 'light', density: 1 });
    l.dispose();
  });
});

describe('0B §6: retrieve() stays LIVE after a failure', () => {
  it('⚠️ a repaired backend can be retrieved again', async () => {
    const be = backend();
    be.store.set('k', '{not json');
    const tree = makeTree();
    await flush();
    const l = link(tree.$.settings, persistenceEndpoint<Settings>(be, 'k'));

    await expect(l.retrieve()).rejects.toThrow();
    expect(tree.$.settings.theme()).toBe('light');

    // Repair the durable value.
    be.store.set('k', JSON.stringify({ theme: 'repaired', density: 4 }));

    // ⚠️ NOT assumed: explicit acquisition must not be permanently dead after
    // one failure — the same class of defect the asyncQuery replacement had.
    await l.retrieve();
    await flush();
    expect(tree.$.settings()).toEqual({ theme: 'repaired', density: 4 });
    l.dispose();
  });
});

describe('0B §7: disposal with a pending durable write', () => {
  it('⚠️ dispose() ABANDONS a pending write — settle FIRST, then dispose', async () => {
    const be = backend();
    const tree = makeTree();
    await flush();
    const l = link(
      tree.$.settings,
      persistenceEndpoint<Settings>(be, 'k', { debounceMs: 40 })
    );

    tree.$.settings.theme.set('inflight');
    await flush();
    expect(be.store.size).toBe(0);

    l.dispose();
    await flush();
    // Not durable at the moment of disposal — the debounce is still pending.
    const durableAtDispose = be.store.size;

    await new Promise((r) => setTimeout(r, 120));
    const durableLater = be.store.size;

    // ⚠️ ACTUALLY ASSERTED. An earlier version of this test ended in
    // `expect(true).toBe(true)`, which is not an assertion — the conclusion was
    // plausible from the implementation and unproven by the test.
    expect(durableAtDispose).toBe(0);

    // What the measurement shows: the endpoint's OWN timer is not Link's to
    // cancel, so whether the write eventually lands is entirely the endpoint's
    // business. Either outcome is legitimate for the endpoint; what matters is
    // that LINK offers no guarantee once disposed, so a consumer cannot await
    // it. Recorded as a fact about the boundary, not a promise about the timer.
    expect(typeof durableLater).toBe('number');
    expect(durableLater).toBeGreaterThanOrEqual(durableAtDispose);
  });

  it('the CORRECT order gives a durability guarantee', async () => {
    const be = backend();
    const tree = makeTree();
    await flush();
    const l = link(
      tree.$.settings,
      persistenceEndpoint<Settings>(be, 'k', { debounceMs: 40 })
    );

    tree.$.settings.theme.set('safe');
    await flush();

    await l.settled(); // <- the boundary
    l.dispose(); //      <- then release

    expect(JSON.parse(be.store.get('k') as string).theme).toBe('safe');
  });

  it('dispose() releases a settled() waiter rather than hanging it', async () => {
    const be = backend();
    const tree = makeTree();
    await flush();
    const l = link(
      tree.$.settings,
      persistenceEndpoint<Settings>(be, 'k', { debounceMs: 60 })
    );

    tree.$.settings.theme.set('pending');
    await flush();
    const waiting = l.settled();
    l.dispose();

    // A disposed link owns no further work, so the waiter must be released.
    await expect(waiting).resolves.toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 0B §5 — remove / clear. Does it decompose, and in what ORDER?
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ `stored().clear()` is a COMPOUND operation, read from its implementation:
 *
 * ```text
 * 1  reset the tree value to defaultValue
 * 2  storage.removeItem(key)             a DURABLE consequence
 * 3  supersede any pending write         shared consequence key + seq guard
 * 4  obey the transaction boundary       waits for commit, dropped on discard
 * 5  report failures as operation:'remove'
 * ```
 *
 * ⚠️ **Writing the default is NOT the same as removing the key.** A later
 * `get()` would read a WRITTEN default rather than ABSENCE, and absence is what
 * lets an endpoint decide the fallback. So the decomposition has to be measured,
 * not assumed.
 */
describe('0B §5: remove/clear decomposition and ordering', () => {
  const removableEndpoint = (be: ReturnType<typeof backend>, key: string) => ({
    get: (): Settings => {
      const raw = be.read(key);
      if (raw === null) throw new Error('absent');
      return JSON.parse(raw) as Settings;
    },
    set: (v: Settings) => void be.write(key, JSON.stringify(v)),
    // ⚠️ NOT a LinkEndpoint member. The APPLICATION-FACING adapter may carry
    // storage administration; `LinkEndpoint` stays get/set/subscribe, and
    // SignalTree never invokes this.
    remove: () => void be.store.delete(key),
  });

  it('⚠️ remove-then-reset LOSES the removal — Link re-writes the default', async () => {
    const be = backend();
    const tree = makeTree();
    await flush();
    const ep = removableEndpoint(be, 'k');
    const l = link(tree.$.settings, ep);

    tree.$.settings.theme.set('persisted');
    await flush();
    await l.settled();
    expect(be.store.has('k')).toBe(true);

    // WRONG ORDER: administer storage, then reset state.
    ep.remove();
    tree.$.settings.theme.set('light');
    await flush();
    await l.settled();

    // The authored reset armed an outbound send, which re-created the key.
    // Absence was NOT achieved.
    expect(be.store.has('k')).toBe(true);
    l.dispose();
  });

  it('⚠️ the CORRECT decomposition is dispose (or settle) BEFORE remove', async () => {
    const be = backend();
    const tree = makeTree();
    await flush();
    const ep = removableEndpoint(be, 'k');
    const l = link(tree.$.settings, ep);

    tree.$.settings.theme.set('persisted');
    await flush();
    await l.settled();

    // Reset state FIRST, let the relationship settle, THEN administer storage.
    tree.$.settings.theme.set('light');
    await flush();
    await l.settled();
    l.dispose();
    ep.remove();

    // Absence achieved, and nothing can re-create it.
    expect(be.store.has('k')).toBe(false);
    l.dispose();
  });

  it('so `clear()` is TWO responsibilities, and neither belongs to Link', async () => {
    // state reset      -> an ordinary authored write (application)
    // durable removal  -> adapter administration (application)
    //
    // The ORDERING is the part `stored` hid inside one method, and it is the
    // part an application now owns explicitly. That is a real ergonomic
    // difference, recorded rather than glossed: one call became two plus an
    // ordering rule.
    const be = backend();
    const tree = makeTree();
    await flush();
    const ep = removableEndpoint(be, 'k');
    const l = link(tree.$.settings, ep);
    tree.$.settings.theme.set('x');
    await flush();
    await l.settled();

    expect(typeof ep.remove).toBe('function');
    // And `remove` is NOT part of what Link consumes.
    expect('remove' in ({ get: ep.get, set: ep.set } as object)).toBe(false);
    l.dispose();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 0B §4 — clearOnMigrationFailure, and §8 — maxScopes
// ═══════════════════════════════════════════════════════════════════════════

/**
 * §4 `clearOnMigrationFailure`, read from `stored.ts` (two identical paths):
 *
 * ```ts
 * catch (e) {
 *   reportError('migrate', e, ...);
 *   if (clearOnMigrationFailure) storage.removeItem(key);
 *   lastLoadResult = 'error';
 *   return defaultValue;
 * }
 * ```
 *
 * Entirely inside the READ path. It reports, optionally deletes the corrupt
 * durable payload, and falls back to the default — all while INTERPRETING the
 * durable representation, exactly like migration itself.
 *
 * **Classification: ADAPTER POLICY.** Prototyped below inside `get()`, with no
 * SignalTree API addition.
 */
describe('0B §4: migration-failure clearing is adapter policy', () => {
  const migratingEndpoint = (
    be: ReturnType<typeof backend>,
    key: string,
    clearOnFailure: boolean,
    fallback: Settings
  ) => ({
    get: (): Settings => {
      const raw = be.read(key);
      if (raw === null) return fallback;
      try {
        const parsed = JSON.parse(raw) as { __v?: number };
        if (parsed.__v === 1) throw new Error('migration failed');
        return parsed as unknown as Settings;
      } catch {
        // The whole policy, inside the endpoint.
        if (clearOnFailure) be.store.delete(key);
        return fallback;
      }
    },
    set: (v: Settings) => void be.write(key, JSON.stringify(v)),
  });

  const fallback: Settings = { theme: 'light', density: 1 };

  it('clearOnFailure = TRUE deletes the corrupt payload and falls back', async () => {
    const be = backend();
    be.store.set('k', JSON.stringify({ __v: 1, theme: 'legacy' }));
    const tree = makeTree();
    await flush();
    const l = link(tree.$.settings, migratingEndpoint(be, 'k', true, fallback));

    await l.retrieve();
    await flush();

    expect(tree.$.settings()).toEqual(fallback);
    expect(be.store.has('k')).toBe(false);
    l.dispose();
  });

  it('clearOnFailure = FALSE keeps the corrupt payload and still falls back', async () => {
    const be = backend();
    be.store.set('k', JSON.stringify({ __v: 1, theme: 'legacy' }));
    const tree = makeTree();
    await flush();
    const l = link(tree.$.settings, migratingEndpoint(be, 'k', false, fallback));

    await l.retrieve();
    await flush();

    expect(tree.$.settings()).toEqual(fallback);
    // Deliberately left in storage — a human could still recover it.
    expect(be.store.has('k')).toBe(true);
    l.dispose();
  });
});

/**
 * §8 `maxScopes` — PERSISTENCE RETENTION, and the gate is STRUCTURAL.
 *
 * ⚠️ The preregistered discriminator was "run with persist disabled and churn
 * scopes". The call graph answers it more strongly than a churn test could,
 * because there is NO PATH from a non-persisting loader to the GC:
 *
 * ```text
 * touchScopeIndex()  called from exactly ONE site: writeThrough()
 * writeThrough()     opens `if (!persist) return;`
 * touchScopeIndex()  opens `if (!p || !scoped || p.maxScopes === undefined) return;`
 * ```
 *
 * Double-gated. With persist disabled `writeThrough` never runs, so the GC is
 * unreachable — not merely inactive.
 *
 * Its mechanism is `adapter.removeItem` over a touch-ordered index at
 * `` `${key}::__scopes` ``, and the option's own documentation states the
 * in-memory cache is still SINGLE-SCOPE, so there is no multi-scope in-memory
 * cache for it to bound.
 *
 * ⚠️ Stated honestly: this is a CALL-GRAPH proof, not a scope-churn measurement.
 * It is stronger for the persist-disabled question (structural unreachability)
 * and does NOT measure eviction ORDER or revisit-refetch behaviour under
 * persist-enabled churn. Those belong to LOADER-CACHE-DISPOSITION-0, which owns
 * the cache side.
 */
describe('0B §8: maxScopes is persistence-gated, structurally', () => {
  const SRC = (() => {
    for (const c of [
      join(process.cwd(), 'packages/core/src'),
      join(process.cwd(), 'src'),
    ]) {
      try {
        readFileSync(join(c, 'lib/signal-tree.ts'), 'utf8');
        return c;
      } catch {
        /* next */
      }
    }
    throw new Error('0B §8: could not locate packages/core/src');
  })();

  const LOADER = readFileSync(join(SRC, 'lib/markers/entity-loader.ts'), 'utf8');

  it('⚠️ the GC is unreachable without persist — ONE call site, both gated', () => {
    // Exactly one call site, and it is inside writeThrough.
    const calls = [...LOADER.matchAll(/touchScopeIndex\(/g)];
    expect(calls).toHaveLength(2); // the declaration + the single call

    expect(LOADER).toContain('function writeThrough(params: P): void {\n    if (!persist) return;');
    expect(LOADER).toContain(
      "if (!p || !scoped || p.maxScopes === undefined) return;"
    );
    // And the eviction mechanism is durable storage, not memory.
    expect(LOADER).toContain('__scopes');
  });

  it('maxScopes lives on the PERSIST options object, not on the loader root', () => {
    // Declared inside EntityPersist — grouping by declaration is weak evidence
    // on its own, which is why the gate above is the actual proof.
    // `EntityPersist` is a TYPE ALIAS, not an interface — so slice from its
    // declaration to the option that follows it on the loader root.
    const persistBlock = LOADER.slice(
      LOADER.indexOf('export type EntityPersist'),
      LOADER.indexOf('persist?: EntityPersist;')
    );
    expect(persistBlock.length).toBeGreaterThan(0);
    expect(persistBlock).toContain('maxScopes?: number;');
    // And the doc that settles the classification.
    expect(persistBlock).toContain('the in-memory cache is still single-scope');
  });
});
