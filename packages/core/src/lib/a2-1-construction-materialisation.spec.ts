import { describe, expect, it } from 'vitest';

import { getPathNotifier } from './path-notifier';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { stored } from './markers/stored';

/**
 * A2-1 — CONSTRUCTION MATERIALISATION. The discriminator that runs first.
 *
 * The only reason a declaration-time marker could OWN something a compositional
 * adapter cannot reproduce:
 *
 * > a durable value present at construction must be the FIRST publicly
 * > observable value — no transient default, no causal write, no diagnostic turn,
 * > no restoration entry, no transaction evidence.
 *
 * If composition reaches that too, the marker loses its one semantic
 * justification and the decision falls to surface size. If it cannot, the marker
 * has earned its declaration-time placement for a real reason rather than for
 * having an implementation already.
 *
 * Three arms, same durable value, same assertions.
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const fakeStorage = (seed: Record<string, unknown> = {}) => {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(seed)) {
    map.set(k, JSON.stringify({ __v: 1, data: v }));
  }
  return {
    map,
    adapter: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => map.set(k, v),
      removeItem: (k: string) => map.delete(k),
      key: () => null,
      length: 0,
    } as unknown as Storage,
  };
};

const observe = () => {
  const seen: string[] = [];
  const off = getPathNotifier().subscribe('**', (_n, _p, path) => {
    seen.push(path);
  });
  return { seen, off };
};

describe('A2-1 arm A: the DECLARATION MARKER', () => {
  it('durable value is the first observable value, with no causal write', async () => {
    const { adapter } = fakeStorage({ 'a2-theme': 'dark' });

    const { seen, off } = observe();
    const tree = signalTree(
      { theme: stored('a2-theme', 'light', { storage: adapter, debounceMs: 0 }) },
      { enhancers: [restoration()] }
    );
    const firstObserved = tree.$.theme();
    await flush();
    off();

    // The default 'light' is never publicly observable, and materialisation
    // emits nothing causal — PER-B P1, restated here as the marker's baseline.
    expect(firstObserved).toBe('dark');
    expect(seen).toEqual([]);
    expect(tree.getRestorationHistory().length).toBe(1);
    expect(tree.canUndo()).toBe(false);
  });
});

describe('A2-1 arm B: COMPOSITION, adapter reads AFTER construction', () => {
  it('⚠️ the transient is observable and the catch-up write IS causal', async () => {
    const { adapter } = fakeStorage({ 'a2-theme-b': 'dark' });

    const { seen, off } = observe();
    // The shape a post-construction `persist(node, { key })` adapter is forced
    // into: the tree exists with its default before anything can read storage.
    const tree = signalTree(
      { theme: 'light' },
      { enhancers: [restoration()] }
    );
    const firstObserved = tree.$.theme();

    // …then the adapter hydrates.
    const raw = adapter.getItem('a2-theme-b');
    if (raw) tree.$.theme.set(JSON.parse(raw).data as string);
    await flush();
    off();

    // ⚠️ BOTH failures the marker avoids: a transient default WAS publicly
    // observable, and the catch-up produced a causal write.
    expect(firstObserved).toBe('light');
    expect(tree.$.theme()).toBe('dark');
    expect(seen).toEqual(['theme']);
  });
});

describe('A2-1 arm C: COMPOSITION, application reads BEFORE construction', () => {
  it('⚠️ reaches the marker result exactly — no transient, no causal write', async () => {
    const { adapter } = fakeStorage({ 'a2-theme-c': 'dark' });

    const { seen, off } = observe();
    // The third option, and the one that decides A2-1. Nothing stops an
    // application reading synchronous storage BEFORE it constructs the tree —
    // `localStorage` and Capacitor Preferences' sync API are both available at
    // that point. The durable value simply IS the initial value.
    const raw = adapter.getItem('a2-theme-c');
    const initial = raw ? (JSON.parse(raw).data as string) : 'light';

    const tree = signalTree({ theme: initial }, { enhancers: [restoration()] });
    const firstObserved = tree.$.theme();
    await flush();
    off();

    // Identical to arm A on every assertion that matters.
    expect(firstObserved).toBe('dark');
    expect(seen).toEqual([]);
    expect(tree.getRestorationHistory().length).toBe(1);
    expect(tree.canUndo()).toBe(false);
  });

  it('and it degrades correctly when storage is empty', async () => {
    const { adapter } = fakeStorage();
    const raw = adapter.getItem('absent');
    const initial = raw ? (JSON.parse(raw).data as string) : 'light';
    const tree = signalTree({ theme: initial });
    expect(tree.$.theme()).toBe('light');
  });
});

/**
 * ## A2-1 RESULT
 *
 * ```text
 * arm A  marker                        first value durable, zero causal writes
 * arm B  compose AFTER construction    transient observable + causal write  ✗
 * arm C  read BEFORE construction      first value durable, zero causal writes ✓
 * ```
 *
 * **The marker does NOT own construction materialisation.** Arm C reaches the
 * same result with no new API at all — because reading durable storage is
 * synchronous on every platform this footprint targets (localStorage, Capacitor
 * Preferences), so the durable value can simply BE the initial value.
 *
 * What the marker actually provides over arm C is the read boilerplate, once per
 * persisted leaf. That is a DX difference, not a capability difference — and A2's
 * preregistration says a capability difference is what earns declaration-time
 * placement.
 *
 * So A2-1 does not settle A2 by itself, but it removes the strongest argument for
 * arm A. The remaining discriminators (A2-2..A2-5) now decide on write-through,
 * settlement, drain ownership and lifetime — none of which arm C addresses at all,
 * because arm C is only an INITIALISATION technique and not a persistence
 * capability.
 */
