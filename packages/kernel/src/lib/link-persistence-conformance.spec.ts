import { afterEach, describe, expect, it } from 'vitest';

import {
  clearTreeErrorListenersForTesting,
  onTreeError,
  type TreeErrorEvent,
} from './internals/error-reporter';
import { link, type Link } from './link';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * LINK PERSISTENCE CONFORMANCE.
 *
 * Durable state in SignalTree is not a primitive. It is a RELATIONSHIP between
 * an owned tree location and an application-owned storage endpoint, expressed
 * with `link()`. This file is the permanent contract for that relationship.
 *
 * The division of ownership it encodes:
 *
 *   LINK          the relationship and its settlement boundary. Link decides
 *                 WHEN a value crosses and guarantees `settled()` means the
 *                 durable write actually landed.
 *   ENDPOINT      the backend, the codec, migration, and write-rate policy.
 *                 Link never parses, versions or debounces anything.
 *   APPLICATION   storage administration — deciding that a key should cease to
 *                 exist, and calling `remove` on its own adapter.
 *
 * Two consequences are easy to get backwards and are asserted directly:
 *
 *   • `settled()` is a DURABILITY boundary, not a scheduling one. It resolves
 *     when the endpoint's `set` promise resolves, so a slow backend keeps it
 *     pending (§6).
 *   • Destructive administration is SETTLE-before-remove, not dispose-before.
 *     Disposal ends the relationship; settling is what makes removal stable,
 *     and the link stays live afterwards (§9, §10).
 *
 * §10 is load-bearing: a suite that stops at "the durable value is gone" cannot
 * tell a correct clear from a clear that silently killed the relationship.
 */

// ── A backend, with observable write history. ───────────────────────────────
function backend() {
  const store = new Map<string, string>();
  const writes: string[] = [];
  let failNextSet: Error | undefined;
  let failNextGet: Error | undefined;
  return {
    store,
    writes,
    failSetOnce: (e: Error) => void (failNextSet = e),
    failGetOnce: (e: Error) => void (failNextGet = e),
    read(key: string): string | null {
      if (failNextGet) {
        const e = failNextGet;
        failNextGet = undefined;
        throw e;
      }
      return store.get(key) ?? null;
    },
    write(key: string, raw: string) {
      if (failNextSet) {
        const e = failNextSet;
        failNextSet = undefined;
        throw e;
      }
      store.set(key, raw);
      writes.push(raw);
    },
    remove: (key: string) => void store.delete(key),
  };
}

type Settings = { theme: string; density: number };
const INITIAL: Settings = { theme: 'light', density: 1 };

/**
 * The endpoint owns the codec and the write-rate policy. Its `set` resolves
 * only once the durable write has landed — that is what makes `settled()`
 * mean durability.
 */
function endpointFor(
  be: ReturnType<typeof backend>,
  key: string,
  opts: { delayMs?: number } = {}
) {
  return {
    get: (): Settings => {
      const raw = be.read(key);
      if (raw === null) throw new Error(`no durable value at ${key}`);
      // The endpoint owns the durable REPRESENTATION, including its envelope.
      const parsed = JSON.parse(raw) as { v: number; data: Settings };
      return parsed.data;
    },
    set: (value: Settings): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        const commit = () => {
          try {
            be.write(key, JSON.stringify({ v: 1, data: value }));
            resolve();
          } catch (e) {
            reject(e);
          }
        };
        if (opts.delayMs) setTimeout(commit, opts.delayMs);
        else commit();
      }),
  };
}

/** Let the causal runtime's post-commit consequences arm before settling. */
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

const makeTree = () =>
  signalTree({ settings: { ...INITIAL } }, { enhancers: [transactions()] });

/**
 * Every link is disposed at teardown. A Link holds a flush subscription and a
 * source subscription for as long as it lives, so leaving that to GC would make
 * one test's relationship observable inside the next one.
 */
const live: Link[] = [];
const track = (l: Link): Link => (live.push(l), l);

afterEach(() => {
  for (const l of live.splice(0)) l.dispose();
  clearTreeErrorListenersForTesting();
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Link persistence — acquiring durable state', () => {
  it('§1 RETRIEVE — a durable value becomes tree state', async () => {
    const be = backend();
    be.store.set('k', JSON.stringify({ v: 1, data: { theme: 'dark', density: 3 } }));

    const tree = makeTree();
    await flush();
    const l = track(link(tree.$.settings, endpointFor(be, 'k')));
    await l.retrieve();

    expect(tree.$.settings()).toEqual({ theme: 'dark', density: 3 });
  });

  it('§8 a FAILED retrieve rejects its caller and leaves state truthful', async () => {
    const be = backend();
    be.store.set('k', JSON.stringify({ v: 1, data: { theme: 'dark', density: 3 } }));
    const tree = makeTree();
    const l = track(link(tree.$.settings, endpointFor(be, 'k')));

    be.failGetOnce(new Error('backend down'));
    await expect(l.retrieve()).rejects.toThrow('backend down');
    // Not a half-applied value: the tree still holds what it authored.
    expect(tree.$.settings()).toEqual(INITIAL);

    // The relationship survives the failure — a later retrieve succeeds.
    await l.retrieve();
    expect(tree.$.settings()).toEqual({ theme: 'dark', density: 3 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Link persistence — publishing durable state', () => {
  it('§2 OUTBOUND — an authored write reaches the endpoint', async () => {
    const be = backend();
    const tree = makeTree();
    const l = track(link(tree.$.settings, endpointFor(be, 'k')));

    tree.$.settings.theme('dark');
    tree.$.settings.density(2);
    await flush();
    await l.settled();

    expect(JSON.parse(be.store.get('k') as string).data).toEqual({
      theme: 'dark',
      density: 2,
    });
  });

  it('§3 CODEC OWNERSHIP — Link exchanges T; the durable form is the endpoint’s', async () => {
    const be = backend();
    const tree = makeTree();
    const l = track(link(tree.$.settings, endpointFor(be, 'k')));

    tree.$.settings.theme('dark');
    tree.$.settings.density(2);
    await flush();
    await l.settled();

    // The durable representation carries an envelope Link never sees…
    const raw = JSON.parse(be.store.get('k') as string);
    expect(raw).toEqual({ v: 1, data: { theme: 'dark', density: 2 } });
    // …and the tree never sees the envelope.
    expect(tree.$.settings()).toEqual({ theme: 'dark', density: 2 });
  });

  it('§6 DURABILITY SETTLEMENT — settled() waits for the durable write', async () => {
    const be = backend();
    const tree = makeTree();
    const l = track(link(tree.$.settings, endpointFor(be, 'k', { delayMs: 30 })));

    tree.$.settings.theme('dark');
    tree.$.settings.density(2);
    await flush();

    let settledResolved = false;
    const s = l.settled().then(() => void (settledResolved = true));

    // CONTROL — the endpoint has NOT landed yet, and settled() reflects that.
    await new Promise((r) => setTimeout(r, 5));
    expect(be.store.has('k')).toBe(false);
    expect(settledResolved).toBe(false);

    await s;
    expect(settledResolved).toBe(true);
    expect(be.store.has('k')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Link persistence — transactional truth', () => {
  it('§4 ROLLBACK — no speculative value is ever durable', async () => {
    const be = backend();
    const tree = makeTree();
    const l = track(link(tree.$.settings, endpointFor(be, 'k')));

    const p = tree.transaction(() => {
      tree.$.settings.theme('SPECULATIVE');
      tree.$.settings.density(99);
    });
    await flush();
    p.rollback();
    await flush();
    await l.settled();

    // Asserted per WRITE, not on the final state: a suite that only checks the
    // end value cannot see a speculative value that was written and repaired.
    for (const raw of be.writes) {
      expect(raw).not.toContain('SPECULATIVE');
    }
    expect(tree.$.settings()).toEqual(INITIAL);
  });

  it('§5 COMMIT — the committed whole becomes durable, once', async () => {
    const be = backend();
    const tree = makeTree();
    const l = track(link(tree.$.settings, endpointFor(be, 'k')));

    const p = tree.transaction(() => {
      tree.$.settings.theme('dark');
      tree.$.settings.density(4);
    });
    await flush();
    p.confirm();
    await l.settled();

    // One write of the COMPLETE committed value — not one per field.
    expect(be.writes.length).toBe(1);
    expect(JSON.parse(be.writes[0]).data).toEqual({ theme: 'dark', density: 4 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Link persistence — failure and recovery', () => {
  it('§7d the reported path is the STATE location, not the endpoint key', async () => {
    // ⚠️ MIGRATED FROM `stored()` (ERROR-PATH-SEMANTICS-0). That row set held
    // the only assertions on what `path` MEANS, and every one of them was
    // written against the marker — so retiring `stored()` emptied the suite.
    // The surviving half is this: an error names WHERE IN THE TREE the failure
    // happened, never where the endpoint chose to put the bytes.
    const seen: TreeErrorEvent[] = [];
    onTreeError((e) => void seen.push(e));

    const be = backend();
    const tree = makeTree();
    track(link(tree.$.settings, endpointFor(be, 'a-storage-key-nobody-sees')));

    be.failSetOnce(new Error('disk full'));
    tree.$.settings.theme('dark');
    await flush();

    const failure = seen.find((e) => e.operation === 'link:set');
    expect(failure?.path).toBe('settings');
  });

  it('§7b two SAME-SHAPED trees failing on the same key are DISTINGUISHABLE', async () => {
    // ⚠️ MIGRATED FROM `stored()` (ERROR-SURFACE-2 C). The existing §7 row only
    // asserts `treeId` is DEFINED, which a constant would satisfy. The claim
    // ERROR-SURFACE-2 actually earned is that two trees of the same shape,
    // failing at the same PATH, are told apart — and `path` is the STATE
    // location, never the storage key, so path alone cannot do it.
    const seen: TreeErrorEvent[] = [];
    onTreeError((e) => void seen.push(e));

    const beA = backend();
    const beB = backend();
    const a = makeTree();
    const b = makeTree();
    track(link(a.$.settings, endpointFor(beA, 'same-key')));
    track(link(b.$.settings, endpointFor(beB, 'same-key')));

    beA.failSetOnce(new Error('disk full'));
    beB.failSetOnce(new Error('disk full'));
    a.$.settings.theme('dark');
    b.$.settings.theme('dark');
    await flush();

    const failures = seen.filter((e) => e.operation === 'link:set');
    expect(failures.length).toBe(2);
    expect(failures[0].path).toBe(failures[1].path); // same location...
    expect(failures[0].treeId).not.toBe(failures[1].treeId); // ...different tree
  });

  it('§7c repeated failures from ONE relationship keep the SAME treeId', async () => {
    // MIGRATED FROM `stored()` (ERROR-SURFACE-2 D). The mirror of §7b: identity
    // must be stable as well as distinct, or it is a counter rather than an id.
    const seen: TreeErrorEvent[] = [];
    onTreeError((e) => void seen.push(e));

    const be = backend();
    const tree = makeTree();
    track(link(tree.$.settings, endpointFor(be, 'stable')));

    for (const v of ['one', 'two', 'three']) {
      be.failSetOnce(new Error('disk full'));
      tree.$.settings.theme(v);
      await flush();
    }

    const ids = new Set(
      seen.filter((e) => e.operation === 'link:set').map((e) => e.treeId)
    );
    expect(seen.filter((e) => e.operation === 'link:set').length).toBeGreaterThan(1);
    expect(ids.size).toBe(1);
  });

  it('§7 a FAILED set reports, keeps the authored value, and stays live', async () => {
    const seen: TreeErrorEvent[] = [];
    onTreeError((e) => void seen.push(e));

    const be = backend();
    const tree = makeTree();
    const l = track(link(tree.$.settings, endpointFor(be, 'k')));

    be.failSetOnce(new Error('disk full'));
    tree.$.settings.theme('dark');
    tree.$.settings.density(2);
    await flush();
    await l.settled();

    // Reported, with the identity of the tree that owns the location.
    const failure = seen.find((e) => e.operation === 'link:set');
    expect(failure).toBeDefined();
    expect(failure?.treeId).toBeDefined();

    // The authored value is NOT rolled back: storage failed, the tree did not.
    expect(tree.$.settings()).toEqual({ theme: 'dark', density: 2 });
    expect(be.store.has('k')).toBe(false);

    // ⚠️ THE QUEUE SURVIVES. One rejection must not wedge the link forever —
    // that is a retry policy's failure mode arriving without a retry policy.
    tree.$.settings.theme('solar');
    tree.$.settings.density(5);
    await flush();
    await l.settled();
    expect(JSON.parse(be.store.get('k') as string).data).toEqual({
      theme: 'solar',
      density: 5,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Link persistence — administration', () => {
  it('§9/§10 CLEAR is settle-then-remove, and the relationship stays live', async () => {
    const be = backend();
    const tree = makeTree();
    const l = track(link(tree.$.settings, endpointFor(be, 'k')));

    tree.$.settings.theme('dark');
    tree.$.settings.density(2);
    await flush();
    await l.settled();
    expect(be.store.has('k')).toBe(true);

    // ⚠️ SETTLE-BEFORE-ADMINISTRATION, not dispose-before. Settling is what
    // makes the removal stable — it drains the write that would otherwise land
    // after `remove` and resurrect the key. Disposal was never the mechanism,
    // and using it here would end the relationship as a side effect.
    tree.$.settings.theme(INITIAL.theme);
    tree.$.settings.density(INITIAL.density);
    await flush();
    await l.settled();
    be.remove('k');
    expect(be.store.has('k')).toBe(false);

    // §10 SUCCESSOR OPERATION — the load-bearing half. A clear that silently
    // killed the link is indistinguishable from a correct one until the NEXT
    // authored write is asked to persist.
    tree.$.settings.theme('dark');
    tree.$.settings.density(7);
    await flush();
    await l.settled();
    expect(JSON.parse(be.store.get('k') as string).data).toEqual({
      theme: 'dark',
      density: 7,
    });
  });

  it('dispose() ENDS the relationship — later writes are not durable', async () => {
    const be = backend();
    const tree = makeTree();
    const l = track(link(tree.$.settings, endpointFor(be, 'k')));

    tree.$.settings.theme('dark');
    tree.$.settings.density(2);
    await flush();
    await l.settled();
    const durableAtDispose = be.writes.length;

    l.dispose();
    // CONTROL — teardown disposes again; dispose() must be idempotent.
    tree.$.settings.theme('after-dispose');
    tree.$.settings.density(9);
    await new Promise((r) => setTimeout(r, 20));

    expect(be.writes.length).toBe(durableAtDispose);
    expect(be.store.get('k')).not.toContain('after-dispose');
  });
});
