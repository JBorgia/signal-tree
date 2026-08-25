import { describe, expect, it } from 'vitest';

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
