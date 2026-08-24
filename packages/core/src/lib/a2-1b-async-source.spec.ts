import { describe, expect, it } from 'vitest';

import { getPathNotifier } from './path-notifier';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { stored } from './markers/stored';

/**
 * A2-1B — the ASYNC-SOURCE control arm A2-1 was missing.
 *
 * A2-1 concluded that application pre-read reproduces marker materialisation, and
 * justified it with a claim that was FALSE: that Capacitor Preferences exposes a
 * synchronous read. It does not — `@capacitor/preferences@8.0.1` declares
 * `get(): Promise<GetResult>` and `set(): Promise<void>`.
 *
 * TruckTrax's footprint is still genuinely synchronous (all seven `stored()`
 * leaves pass no adapter, so they use `localStorage`), so A2-1's result stands
 * FOR THAT FOOTPRINT. This file measures the case A2-1 could not speak to, and
 * the outcomes were pre-registered:
 *
 *   A  the marker can prevent observability until an async read resolves
 *      -> the marker owns a real initialisation capability
 *   B  the marker also starts at its default and catches up later
 *      -> no construction advantage over composition
 *   C  the public contract intentionally covers only SYNCHRONOUS construction
 *      materialisation; async sources go through app bootstrap/preload
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('A2-1B: can any construction-time API materialise from an async source?', () => {
  it('the marker CANNOT accept one — its contract is synchronous by type', () => {
    // `stored({ storage })` takes the DOM `Storage` interface, whose
    // `getItem(key): string | null` is strictly synchronous. An async source is
    // not merely unsupported at runtime; it cannot be passed at all.
    const asyncSource = {
      getItem: (k: string) => Promise.resolve(`{"__v":1,"data":"dark"}`),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve(),
      key: () => null,
      length: 0,
    };

    // @ts-expect-error `stored`'s storage option is `Storage | null`; a Promise-returning getItem is not assignable
    const rejected = stored('a2-1b', 'light', { storage: asyncSource });
    expect(rejected).toBeDefined();
  });

  it('and no synchronous constructor can await a Promise — outcome C, demonstrated', async () => {
    // The structural fact, shown rather than asserted. `signalTree(...)` returns
    // a constructed tree synchronously. A durable value behind a Promise is not
    // available at that instant, so SOME observable value must exist before it
    // arrives, whatever API wraps the read.
    const durable = () => Promise.resolve('dark');

    const { seen, off } = (() => {
      const acc: string[] = [];
      const o = getPathNotifier().subscribe('**', (_n, _p, path) => {
        acc.push(path);
      });
      return { seen: acc, off: o };
    })();

    // `restoration()` is present because the path notifier is not wired on a bare
    // tree — a zero here would otherwise mean "nothing observed" rather than "no
    // event", which is precisely the trap the asyncSource probe fell into twice.
    const tree = signalTree({ theme: 'light' }, { enhancers: [restoration()] });
    const firstObserved = tree.$.theme(); // constructed; the read has not resolved

    tree.$.theme.set(await durable()); // the catch-up, whoever performs it
    await flush();
    off();

    expect(firstObserved).toBe('light'); // the transient is UNAVOIDABLE
    expect(tree.$.theme()).toBe('dark');
    expect(seen).toEqual(['theme']); // and the catch-up IS a causal write

    // So no construction-time API — marker, composition or capability — can make
    // an async durable value the first observable value. The transient and the
    // causal write are properties of the ASYNCHRONY, not of the API shape.
  });

  it('CONTROL — the same source read BEFORE construction has neither problem', async () => {
    const durable = () => Promise.resolve('dark');

    const preloaded = await durable(); // app bootstrap, before the tree exists

    const { seen, off } = (() => {
      const acc: string[] = [];
      const o = getPathNotifier().subscribe('**', (_n, _p, path) => {
        acc.push(path);
      });
      return { seen: acc, off: o };
    })();
    const tree = signalTree({ theme: preloaded }, { enhancers: [restoration()] });
    const firstObserved = tree.$.theme();
    await flush();
    off();

    // Async storage is fine — it just has to be awaited BEFORE construction, by
    // the application, which is the same answer A2-1 arm C gave for the sync
    // case. The difference is that here it is the ONLY answer.
    expect(firstObserved).toBe('dark');
    expect(seen).toEqual([]);
  });
});

/**
 * ## A2-1B RESULT — outcome C
 *
 * ```text
 * A  marker prevents observability until resolved   IMPOSSIBLE — a synchronous
 *                                                   constructor cannot await
 * B  marker starts at default and catches up        true of EVERY shape, so it
 *                                                   discriminates nothing
 * C  contract covers SYNC construction only         ✓ and async sources preload
 *                                                     in app bootstrap
 * ```
 *
 * The transient value and the catch-up causal write are properties of the
 * ASYNCHRONY, not of the API shape — so async materialisation cannot be a reason
 * to prefer any placement. It is a scope limit to state publicly.
 *
 * Two facts worth carrying into A2-4, because they are the same split one layer
 * down:
 *
 * ```text
 * stored({ storage })          Storage        — synchronous by type
 * persistence's StorageAdapter getItem/setItem: T | Promise<T> — async-tolerant
 * ```
 *
 * The repo ALREADY has two storage contracts with different synchrony
 * assumptions. Whatever owns the write side must say which it accepts, and must
 * not report durability as complete merely because async work was dispatched.
 */
