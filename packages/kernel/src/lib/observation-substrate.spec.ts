import { afterEach, describe, expect, it } from 'vitest';
import type { WritableSignal } from '@angular/core';

import { getPathNotifier, resetPathNotifier } from './path-notifier';
import { link, type Link } from './link';
import { observationStateForTesting } from './internals/observation-substrate';
import { signalTree } from './signal-tree';
import { withWriteContext } from './write-context';

/**
 * THE OBSERVATION SUBSTRATE — lifecycle, sharing and fidelity.
 *
 * `link-bare-contract.spec.ts` states what a consumer sees. This states how the
 * machinery beneath it behaves, because several of these properties are
 * invisible from the public surface and would rot silently.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const state = (n: unknown) => observationStateForTesting(n);

const live: Link[] = [];
const track = (l: Link): Link => (live.push(l), l);
afterEach(() => {
  for (const l of live.splice(0)) l.dispose();
});

describe('activation lifecycle', () => {
  it('dormant -> armed -> dormant -> armed, on ONE retained callable', async () => {
    resetPathNotifier();
    const pubs: string[] = [];
    const off = getPathNotifier().subscribe('**', (_v, _p, p) => void pubs.push(p));

    const tree = signalTree({ x: 0 });
    await flush();
    const leaf = tree.$.x as unknown as WritableSignal<number>;
    const heldSet = leaf.set.bind(leaf);

    expect(state(leaf).claims).toBe(0);
    heldSet(1);
    await flush();
    expect(pubs).toEqual([]); // dormant: writes, publishes nothing
    expect(tree.$.x()).toBe(1);

    const a: number[] = [];
    const la = link(tree.$.x, { set: (v: number) => void a.push(v) });
    expect(state(leaf).claims).toBe(1);
    const firstPosition = state(leaf).positionId;
    expect(firstPosition).toBeDefined();

    heldSet(2);
    await flush();
    await la.settled();
    expect(a).toEqual([2]);

    la.dispose();
    expect(state(leaf).claims).toBe(0);

    pubs.length = 0;
    heldSet(3);
    await flush();
    expect(pubs).toEqual([]); // dormant again
    expect(tree.$.x()).toBe(3);

    const c: number[] = [];
    const lc = track(link(tree.$.x, { set: (v: number) => void c.push(v) }));
    // POS-A: one identity for the source's lifetime, across arm/disarm/rearm.
    expect(state(leaf).positionId).toBe(firstPosition);
    heldSet(4);
    await flush();
    await lc.settled();
    expect(c).toEqual([4]);
    off();
  });

  it('repeated construct/dispose accumulates nothing', async () => {
    const tree = signalTree({ x: 0 });
    await flush();
    const identities = new Set<number | undefined>();
    for (let i = 0; i < 25; i++) {
      const l = link(tree.$.x, { set: () => undefined });
      identities.add(state(tree.$.x).positionId);
      l.dispose();
    }
    expect(state(tree.$.x).claims).toBe(0);
    expect(identities.size).toBe(1);
  });
});

describe('claims compose by physical leaf', () => {
  it('a parent and a child link share one installation and one publication', async () => {
    resetPathNotifier();
    const pubs: string[] = [];
    const off = getPathNotifier().subscribe('**', (_v, _p, p) => void pubs.push(p));

    const tree = signalTree({ settings: { theme: 'light', units: 'metric' } });
    await flush();
    const theme = tree.$.settings.theme as unknown as WritableSignal<string>;
    const units = tree.$.settings.units as unknown as WritableSignal<string>;
    const heldTheme = theme.set.bind(theme);
    const heldUnits = units.set.bind(units);

    const a: unknown[] = [];
    const b: string[] = [];
    const la = link(tree.$.settings, { set: (v: unknown) => void a.push(v) });
    const lb = link(tree.$.settings.theme, { set: (v: string) => void b.push(v) });

    expect(state(theme).claims).toBe(2);
    expect(state(units).claims).toBe(1);
    const themePosition = state(theme).positionId;

    pubs.length = 0;
    heldTheme('dark');
    await flush();
    await la.settled();
    await lb.settled();
    expect(pubs.length).toBe(1); // ONE publication
    expect(a[a.length - 1]).toEqual({ theme: 'dark', units: 'metric' });
    expect(b).toEqual(['dark']);

    // A sibling write reaches the parent only. Scope lives ABOVE the shared
    // physical observation, not inside it.
    pubs.length = 0;
    b.length = 0;
    heldUnits('imperial');
    await flush();
    await la.settled();
    await lb.settled();
    expect(pubs.length).toBe(1);
    expect(a[a.length - 1]).toEqual({ theme: 'dark', units: 'imperial' });
    expect(b).toEqual([]);

    // Releasing the parent frees only what nobody else claims.
    la.dispose();
    expect(state(theme).claims).toBe(1);
    expect(state(units).claims).toBe(0);
    expect(state(theme).positionId).toBe(themePosition);

    pubs.length = 0;
    heldUnits('metric');
    await flush();
    expect(units()).toBe('metric'); // still writes
    expect(pubs).toEqual([]); // no longer observed

    lb.dispose();
    expect(state(theme).claims).toBe(0);
    off();
  });

  it('disposing the CHILD first leaves the parent observing', async () => {
    const tree = signalTree({ settings: { theme: 'light', units: 'metric' } });
    await flush();
    const a: unknown[] = [];
    const la = track(link(tree.$.settings, { set: (v: unknown) => void a.push(v) }));
    const lb = link(tree.$.settings.theme, { set: () => undefined });
    expect(state(tree.$.settings.theme).claims).toBe(2);

    lb.dispose();
    expect(state(tree.$.settings.theme).claims).toBe(1);

    tree.$.settings.theme.set('dark');
    await flush();
    await la.settled();
    expect(a[a.length - 1]).toEqual({ theme: 'dark', units: 'metric' });
  });
});

describe('construction and cleanup', () => {
  it('a refused link leaves no claim, and does not disturb a live one', () => {
    const tree = signalTree({ x: 0 });
    const survivor = track(link(tree.$.x, { set: () => undefined }));
    expect(state(tree.$.x).claims).toBe(1);

    // An endpoint with no direction is refused — and the refusal happens before
    // observation is acquired, so it cannot strand a claim.
    expect(() => link(tree.$.x, {} as never)).toThrow();
    expect(state(tree.$.x).claims).toBe(1);
    expect(survivor).toBeDefined();
  });

  it('dispose is idempotent and cannot steal another claim', () => {
    const tree = signalTree({ x: 0 });
    const la = link(tree.$.x, { set: () => undefined });
    const lb = track(link(tree.$.x, { set: () => undefined }));
    expect(state(tree.$.x).claims).toBe(2);

    la.dispose();
    la.dispose();
    la.dispose();
    expect(state(tree.$.x).claims).toBe(1);
    expect(lb).toBeDefined();
  });

  it('disposing during an unresolved send releases and silences the source', async () => {
    const tree = signalTree({ x: 0 });
    await flush();
    const leaf = tree.$.x as unknown as WritableSignal<number>;
    const sends: number[] = [];
    let release!: () => void;
    let opened!: () => void;
    const inFlight = new Promise<void>((r) => (opened = r));
    const l = link(tree.$.x, {
      set: (v: number): Promise<void> => {
        sends.push(v);
        if (sends.length === 1) {
          opened();
          return new Promise<void>((r) => (release = r));
        }
        return Promise.resolve();
      },
    });

    leaf.set(1);
    await flush();
    await inFlight;
    l.dispose();
    release();
    await flush();

    expect(state(leaf).claims).toBe(0);
    leaf.set(2);
    await flush();
    expect(sends).toEqual([1]);
    expect(tree.$.x()).toBe(2);
  });
});

describe('metadata fidelity', () => {
  const INSPECTION = {
    intent: 'system',
    origin: 'devtools',
    participation: 'inspection',
  } as const;
  const REALIZED = { intent: 'system', origin: 'external', participation: 'realized' } as const;

  async function observe(run: (leaf: WritableSignal<number>) => void) {
    resetPathNotifier();
    const rows: Array<Record<string, unknown>> = [];
    const off = getPathNotifier().subscribe(
      '**',
      (v, prev, path, ownerPath, origin, _s, _p, meta) => {
        const m = (meta ?? {}) as Record<string, unknown>;
        rows.push({
          path, ownerPath, before: prev, after: v,
          intent: m['mutationIntent'],
          participation: m['participation'] ?? null,
          origin: origin ?? m['origin'] ?? null,
        });
      }
    );
    const tree = signalTree({ x: 0 });
    await flush();
    const l = track(link(tree.$.x, { set: () => undefined }));
    rows.length = 0;
    run(tree.$.x as unknown as WritableSignal<number>);
    await flush();
    await l.settled();
    off();
    return rows[rows.length - 1];
  }

  it('set reports replace; update reports derive', async () => {
    // ⚠️ The distinction is CARRIED faithfully, and deriving it from the
    // operation costs nothing. Note however that no CURRENT consumer can
    // observe it here: `transactions` and `restoration` are the only readers of
    // `mutationIntent`, both declare `causal-runtime`, and that implies
    // `mutation-capture` — whose own interception replaces this substrate
    // entirely. So this asserts carriage, not a live behavioural dependency.
    expect((await observe((l) => l.set(1)))['intent']).toBe('replace');
    expect((await observe((l) => l.update((v) => v + 1)))['intent']).toBe('derive');
  });

  it('path, ownerPath and before/after are reported', async () => {
    const row = await observe((l) => l.set(42));
    expect(row).toMatchObject({ path: 'x', ownerPath: 'x', before: 0, after: 42 });
  });

  it('participation is transported, with authored represented by ABSENCE', async () => {
    expect((await observe((l) => l.set(1)))['participation']).toBeNull();
    expect(
      (await observe((l) => withWriteContext(INSPECTION, () => l.set(1))))['participation']
    ).toBe('inspection');
    expect(
      (await observe((l) => withWriteContext(REALIZED, () => l.set(1))))['participation']
    ).toBe('realized');
  });

  it('devtools ORIGIN without inspection participation stays non-inspection', async () => {
    // Guards the rejected "devtools origin means inspection" predicate.
    const row = await observe((l) =>
      withWriteContext({ intent: 'system', origin: 'devtools' }, () => l.set(1))
    );
    expect(row['origin']).toBe('devtools');
    expect(row['participation']).toBeNull();
  });
});
