import { afterEach, describe, expect, it } from 'vitest';
import type { WritableSignal } from '@angular/core';

import { entityMap } from './types';
import { link, type Link } from './link';
import { signalTree } from './signal-tree';

/**
 * `link()` ON AN ORDINARY TREE.
 *
 * These state the PUBLIC contract and deliberately name no capability. A
 * consumer writes `signalTree({ x: 0 })` and later decides to link something;
 * nothing required them to predict that when the tree was built.
 *
 * Every case retains the writable callable BEFORE the relationship exists,
 * because that is the shape that broke every alternative design: a `set` or
 * `update` reference that escaped to application code keeps whatever write path
 * it captured, and `CallableWritableSignal` extends Angular's `WritableSignal`,
 * so holding one is ordinary use of a public object.
 *
 * ⚠️ HISTORY. Before the observation substrate, on a plain tree:
 *   - a scalar source THREW "X must be an owned SignalTree location", rejecting
 *     a location that genuinely was owned;
 *   - a branch source CONSTRUCTED, `settled()` RESOLVED, and the endpoint never
 *     received anything — a relationship that looked healthy and was inert.
 * Both were invisible because every Link suite composed `transactions()`.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

const live: Link[] = [];
const track = (l: Link): Link => (live.push(l), l);
afterEach(() => {
  for (const l of live.splice(0)) l.dispose();
});

describe('link() on a tree built with no enhancers and no capabilities', () => {
  it('BARE-LINK-SCALAR — a retained setter reaches the endpoint', async () => {
    const tree = signalTree({ x: 0 });
    await flush();
    const leaf = tree.$.x as unknown as WritableSignal<number>;
    const heldSet = leaf.set.bind(leaf); // escapes BEFORE the link exists

    const got: number[] = [];
    const l = track(link(tree.$.x, { set: (v: number) => void got.push(v) }));

    heldSet(1);
    await flush();
    await l.settled();
    expect(got).toEqual([1]);
  });

  it('BARE-LINK-SCALAR — a retained updater reaches the endpoint', async () => {
    const tree = signalTree({ x: 0 });
    await flush();
    const leaf = tree.$.x as unknown as WritableSignal<number>;
    const heldUpdate = leaf.update.bind(leaf);

    const got: number[] = [];
    const l = track(link(tree.$.x, { set: (v: number) => void got.push(v) }));

    heldUpdate((v) => v + 5);
    await flush();
    await l.settled();
    expect(got).toEqual([5]);
  });

  it('BARE-LINK-BRANCH — a retained descendant setter yields the COMPLETE branch', async () => {
    // No entity inside this branch: LINK-BRANCH-NESTED-ENTITY-0 is separately
    // open, and mixing it here would make this contract test unreadable.
    const tree = signalTree({ settings: { theme: 'light', units: 'metric' } });
    await flush();
    const theme = tree.$.settings.theme as unknown as WritableSignal<string>;
    const units = tree.$.settings.units as unknown as WritableSignal<string>;
    const heldTheme = theme.set.bind(theme);
    const heldUnits = units.update.bind(units);

    const got: unknown[] = [];
    const l = track(link(tree.$.settings, { set: (v: unknown) => void got.push(v) }));

    heldTheme('dark');
    await flush();
    heldUnits(() => 'imperial');
    await flush();
    await l.settled();

    expect(got[got.length - 1]).toEqual({ theme: 'dark', units: 'imperial' });
  });

  it('BARE-LINK-BRANCH — a sibling branch is unaffected', async () => {
    const tree = signalTree({ linked: { a: 1 }, unrelated: { b: 2 } });
    await flush();
    const got: unknown[] = [];
    const l = track(link(tree.$.linked, { set: (v: unknown) => void got.push(v) }));

    tree.$.unrelated.b.set(99);
    await flush();
    await l.settled();
    expect(got).toEqual([]);

    tree.$.linked.a.set(7);
    await flush();
    await l.settled();
    expect(got).toEqual([{ a: 7 }]);
  });

  it('BARE-LINK-ENTITY — the native collection carrier still works', async () => {
    // The positive control that predates the substrate: entity collections
    // carry their own structural observation and never needed ordinary
    // interception. ENTITY OBSERVATION REMAINS NATIVE.
    const tree = signalTree({
      rows: entityMap<{ id: number; n: string }, number>({ selectId: (e) => e.id }),
    });
    await flush();
    const got: unknown[] = [];
    const l = track(
      link(tree.$.rows, { set: (v: unknown) => void got.push(v) } as never)
    );

    tree.$.rows.addOne({ id: 1, n: 'a' });
    await flush();
    await l.settled();
    expect(got[got.length - 1]).toEqual([{ id: 1, n: 'a' }]);
  });

  it('an ordinary tree still behaves normally when nothing links it', async () => {
    // CONTROL: the interception point exists on every ordinary leaf. Dormant,
    // it must be invisible.
    const tree = signalTree({ x: 0, s: { n: 1 } });
    await flush();
    tree.$.x.set(5);
    tree.$.s.n.update((v) => v + 1);
    expect(tree.$.x()).toBe(5);
    expect(tree.$.s.n()).toBe(2);
    expect(tree()).toEqual({ x: 5, s: { n: 2 } });
  });
});
