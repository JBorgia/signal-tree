import { describe, expect, it } from 'vitest';

import { entityMap } from './entity-map';
import { external } from '../external';
import { getPathNotifier } from '../path-notifier';
import { getSubjectRestorationClaims } from '../internals/subject-restoration-claims';
import { restoration } from '../../enhancers/restoration/restoration';
import { signalTree } from '../signal-tree';
import { stored } from './stored';
import { undoable } from '../undoable';

/**
 * PER-B · P8-P12 — the boundaries, probed separately from the reload
 * classification so a defect here gets its own causal history.
 *
 * P8   async adapter restore — is classification applied at the SYNCHRONOUS
 *      tree write rather than around the await?
 * P9   can a reload scope classify a NEIGHBOURING authored write?
 * P10  structural / entity data — same semantics as scalars?
 * P11  destroy while a load or save is pending — no late write into dead
 *      ownership
 * P12  repeated reload of the same durable value — no fake authored turns or
 *      restoration rights merely because persistence ran
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const fakeStorage = () => {
  const map = new Map<string, string>();
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

const versioned = <T>(value: T) => JSON.stringify({ __v: 1, data: value });

const observe = () => {
  const seen: Array<{ path: string; origin: unknown; participation: unknown }> =
    [];
  const off = getPathNotifier().subscribe(
    '**',
    (_n, _p, path, _owner, origin, _s, _pos, meta) => {
      const m = (meta ?? {}) as Record<string, unknown>;
      seen.push({
        path,
        origin: origin ?? m['origin'] ?? null,
        participation: m['participation'] ?? null,
      });
    }
  );
  return { seen, off };
};

describe('PER-B P8: an ASYNC adapter restore', () => {
  it('classification lands on the synchronous write, not around the await', async () => {
    const tree = signalTree(
      { settings: { theme: 'light' } },
      { enhancers: [restoration()] }
    );
    await flush();

    // The shape an async adapter forces: acquire first, apply synchronously.
    // This is the pattern `external()` refuses to let you get wrong — an async
    // callback throws ST1035 rather than classifying nothing.
    const loadFromAsyncAdapter = async () => {
      await Promise.resolve();
      return 'solarized';
    };

    const { seen, off } = observe();
    const durable = await loadFromAsyncAdapter();
    external(() => tree.$.settings.theme.set(durable));
    await flush();
    off();

    expect(seen).toEqual([
      {
        path: 'settings.theme',
        origin: 'external',
        participation: 'realized',
      },
    ]);

    // And the trap the door closes: an async scope cannot silently classify
    // nothing, because the write would land after the ambient context was
    // restored.
    expect(() =>
      external(async () => {
        await Promise.resolve();
        tree.$.settings.theme.set('never');
      })
    ).toThrowError(/ST1035/);
    expect(tree.$.settings.theme()).toBe('solarized');
  });
});

describe('PER-B P9: a reload scope may not classify neighbouring authored work', () => {
  it('an authored write after the reload is still authored', async () => {
    const { map, adapter } = fakeStorage();
    map.set('p9-theme', versioned('durable'));
    const tree = signalTree(
      {
        theme: stored('p9-theme', 'x', { storage: adapter, debounceMs: 0 }),
        label: 'untouched',
      },
      { enhancers: [restoration()] }
    );
    expect(tree.$.theme()).toBe('durable');
    await flush();

    map.set('p9-theme', versioned('reloaded'));

    const { seen, off } = observe();
    // Deliberately adjacent, in the same tick: the reload's classification is
    // scoped to its own write and must not spread to the authored one beside it.
    tree.$.theme.reload?.();
    tree.$.label.set('authored');
    await flush();
    off();

    const byPath = Object.fromEntries(
      seen.map((f) => [f.path, { origin: f.origin, participation: f.participation }])
    );
    expect(byPath['theme']).toEqual({
      origin: 'external',
      participation: 'realized',
    });
    expect(byPath['label']).toEqual({ origin: null, participation: null });
  });
});

describe('PER-B P10: structural / entity data', () => {
  it('a reloaded collection gets the same semantics as a scalar', async () => {
    type Row = { id: string; name: string };
    const { map, adapter } = fakeStorage();
    map.set(
      'p10-rows',
      versioned([{ id: 'a', name: 'Alpha' }] as Row[])
    );
    const tree = signalTree(
      { rows: stored<Row[]>('p10-rows', [], { storage: adapter, debounceMs: 0 }) },
      { enhancers: [restoration()] }
    );
    expect(tree.$.rows().map((r) => r.id)).toEqual(['a']);
    await flush();

    undoable(() => tree.$.rows.set([{ id: 'a', name: 'Renamed' }]));
    await flush();

    map.set('p10-rows', versioned([{ id: 'b', name: 'Beta' }] as Row[]));
    const { seen, off } = observe();
    tree.$.rows.reload?.();
    await flush();
    off();

    expect(seen.map((f) => ({ origin: f.origin, participation: f.participation })))
      .toEqual([{ origin: 'external', participation: 'realized' }]);

    // ⚠️ NOT A PER-B DEFECT, and the control below is what proves it. The undo
    // over a whole-array leaf fails with "Unsupported scoped undo effect", not
    // with ST1034 — but a PLAIN array leaf with no `stored()` anywhere fails
    // identically, so this is a pre-existing scoped-undo limitation for
    // whole-array writes and persistence is not involved.
    //
    // The OUTCOME is still safe: durable truth survives. What is wrong is the
    // diagnosis a developer receives — a generic "unsupported" where the
    // classified refusal (ST1034) would have explained the situation. Carried as
    // its own item rather than fixed inside PER-B, because fixing it means
    // teaching scoped undo about array leaves.
    let refusal: unknown = 'no-refusal';
    try {
      tree.undo();
    } catch (error) {
      refusal = (error as { message?: string })?.message;
    }
    await flush();
    expect(refusal).toBe('Unsupported scoped undo effect at rows');
    expect(tree.$.rows().map((r) => r.id)).toEqual(['b']);
  });

  it('CONTROL — a plain array leaf fails identically with no stored() involved', async () => {
    type Row = { id: string; name: string };
    const tree = signalTree(
      { rows: [{ id: 'a', name: 'Alpha' }] as Row[] },
      { enhancers: [restoration()] }
    );
    await flush();
    undoable(() => tree.$.rows.set([{ id: 'a', name: 'Renamed' }]));
    await flush();

    let refusal: unknown = 'no-refusal';
    try {
      tree.undo();
    } catch (error) {
      refusal = (error as { message?: string })?.message;
    }
    await flush();

    // Identical message, no persistence anywhere. This is the line between
    // "PER-B found a defect" and "PER-B walked into one that was already there".
    expect(refusal).toBe('Unsupported scoped undo effect at rows');
  });

  it('an entityMap reload holds no restoration claim of its own', async () => {
    type Row = { id: string; name: string };
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [restoration()] }
    );
    await flush();

    undoable(() => tree.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    await flush();
    const subject = (
      tree.$.rows as unknown as {
        __acquireEntityHandleForTesting?: (
          id: string
        ) => { subjectId: number } | undefined;
      }
    ).__acquireEntityHandleForTesting?.('a')?.subjectId as number;

    const claims = getSubjectRestorationClaims(tree as unknown as object);
    const ownersBefore = [...(claims?.ownersOf(subject) ?? [])].sort();

    // An external application over the same collection must not mint a
    // persistence-flavoured claim owner.
    external(() => tree.$.rows.setAll([{ id: 'a', name: 'FromDurable' }]));
    await flush();

    const ownersAfter = [...(claims?.ownersOf(subject) ?? [])].sort();
    expect(ownersAfter).toEqual(ownersBefore);
    expect(ownersAfter.every((o) => !String(o).includes('storage'))).toBe(true);
  });
});

describe('PER-B P11: destroy while persistence work is pending', () => {
  it('a debounced save does not write into a destroyed tree', async () => {
    const { map, adapter } = fakeStorage();
    let writesAfterDestroy = 0;
    let destroyed = false;
    const trackingAdapter = {
      ...adapter,
      setItem: (k: string, v: string) => {
        if (destroyed) writesAfterDestroy++;
        adapter.setItem(k, v);
      },
    } as unknown as Storage;

    const tree = signalTree(
      { theme: stored('p11-theme', 'light', { storage: trackingAdapter, debounceMs: 50 }) },
      { enhancers: [restoration()] }
    );
    expect(tree.$.theme()).toBe('light');
    await flush();

    undoable(() => tree.$.theme.set('dark'));
    await flush();

    // Destroy with the debounce still outstanding.
    let treeWritesAfterDestroy = 0;
    const offTree = getPathNotifier().subscribe('**', () => {
      if (destroyed) treeWritesAfterDestroy++;
    });
    (tree as unknown as { destroy?: () => void }).destroy?.();
    destroyed = true;
    await new Promise((r) => setTimeout(r, 120));
    offTree();

    // MEASURED: one durable write DID land after destroy — and that is the
    // stated design rather than a defect. `stored.ts`'s own contract:
    //
    //   > Weakness must not be able to outrace durability.
    //
    // Membership of the pending set tracks PENDING-NESS, not signal lifetime, so
    // an armed write commits even if its tree is gone. Losing a user's last
    // setting because a per-route tree was torn down would be the worse
    // behaviour, and a mobile WebView kill is the common case rather than a
    // corner one.
    expect(writesAfterDestroy).toBe(1);
    expect(map.has('p11-theme')).toBe(true);

    // What would be a real defect is the other direction: a late write INTO the
    // tree, resurrecting state into ownership that no longer exists. Nothing
    // reached the tree after destroy.
    expect(treeWritesAfterDestroy).toBe(0);
  });
});

describe('PER-B P12: repeated reload of the same durable value', () => {
  it('persistence running twice manufactures nothing', async () => {
    const { map, adapter } = fakeStorage();
    map.set('p12-theme', versioned('same'));
    const tree = signalTree(
      { theme: stored('p12-theme', 'x', { storage: adapter, debounceMs: 0 }) },
      { enhancers: [restoration()] }
    );
    expect(tree.$.theme()).toBe('same');
    await flush();

    const historyBefore = tree.getRestorationHistory().length;
    const canUndoBefore = tree.canUndo();

    tree.$.theme.reload?.();
    await flush();
    tree.$.theme.reload?.();
    await flush();
    tree.$.theme.reload?.();
    await flush();

    // No authored turns, no restoration rights, no drift — persistence ran three
    // times and the causal record is untouched.
    expect(tree.getRestorationHistory().length).toBe(historyBefore);
    expect(tree.canUndo()).toBe(canUndoBefore);
    expect(tree.$.theme()).toBe('same');
  });
});
