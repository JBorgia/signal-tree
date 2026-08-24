import { describe, expect, it } from 'vitest';

import { getPathNotifier } from '../path-notifier';
import { restoration } from '../../enhancers/restoration/restoration';
import { signalTree } from '../signal-tree';
import { stored } from './stored';
import { transactions } from '../../enhancers/transactions/transactions';
import { undoable } from '../undoable';

/**
 * PER-B · P1 / P2 / P5 / P4 — what persistence currently CLAIMS causally.
 *
 * Measured before anything is changed. The acceptance bar:
 *
 * > Persistence may observe and reproduce state. It must never manufacture
 * > authorship, restoration rights, transaction settlement or causal authority
 * > merely because data crossed durable storage.
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

const persisted = (map: Map<string, string>, key: string) => {
  const raw = map.get(key);
  return raw === undefined ? '<<absent>>' : JSON.parse(raw).data;
};

const versioned = <T>(value: T) => JSON.stringify({ __v: 1, data: value });

type Observed = { origin: unknown; participation: unknown; path: string };

const observe = () => {
  const seen: Observed[] = [];
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

describe('PER-B P1: autoload before any user work', () => {
  it('what does the initial durable value claim causally?', async () => {
    const { map, adapter } = fakeStorage();
    map.set('p1-theme', versioned('dark'));

    const { seen, off } = observe();
    const tree = signalTree(
      { theme: stored('p1-theme', 'light', { storage: adapter, debounceMs: 0 }) },
      { enhancers: [restoration()] }
    );
    // Force marker materialisation, which is when the stored value is read.
    const value = tree.$.theme();
    await flush();
    off();

    // ⚠️ THE HARDEST QUESTION DISSOLVES. Autoload emits NO causal write at all —
    // the durable value IS the tree's initial value, arriving on the
    // materialisation path. So "is hydration external truth or authored work?"
    // has a third answer: it is neither, because there is no causal event to
    // classify. Nothing to protect, nothing to admit, nothing to undo.
    expect(value).toBe('dark');
    expect(seen.length).toBe(0);
    expect(tree.getRestorationHistory().length).toBe(1); // baseline only
    expect(tree.canUndo()).toBe(false);
  });
});

describe('PER-B P2: explicit reload()', () => {
  it('does rereading durable truth classify as external?', async () => {
    const { map, adapter } = fakeStorage();
    map.set('p2-theme', versioned('dark'));
    const tree = signalTree(
      { theme: stored('p2-theme', 'light', { storage: adapter, debounceMs: 0 }) },
      { enhancers: [restoration()] }
    );
    expect(tree.$.theme()).toBe('dark');
    await flush();

    // Another context changed durable truth underneath us.
    map.set('p2-theme', versioned('solarized'));

    const { seen, off } = observe();
    const result = tree.$.theme.reload?.();
    await flush();
    off();

    // The operation ASKED; it did not choose the value. So the write is
    // classified exactly as any other externally authoritative application, with
    // the values that already exist — deliberately NOT a new `origin: 'storage'`.
    //
    // Measured before the fix: `{ origin: null, participation: null }` — AUTHORED.
    // Two defects followed from that one misclassification (P3, P4 below).
    expect(result).toBe('ok');
    expect(tree.$.theme()).toBe('solarized');
    expect(seen.map((f) => ({ origin: f.origin, participation: f.participation })))
      .toEqual([{ origin: 'external', participation: 'realized' }]);
  });

  it('P3 probe — can an undo reach across a reload?', async () => {
    const { map, adapter } = fakeStorage();
    map.set('p3-theme', versioned('one'));
    const tree = signalTree(
      { theme: stored('p3-theme', 'x', { storage: adapter, debounceMs: 0 }) },
      { enhancers: [restoration()] }
    );
    expect(tree.$.theme()).toBe('one');
    await flush();

    undoable(() => tree.$.theme.set('authored'));
    await flush();

    map.set('p3-theme', versioned('durable-now'));
    tree.$.theme.reload?.();
    await flush();

    let refusal: unknown = 'no-refusal';
    try {
      tree.undo();
    } catch (error) {
      refusal = (error as { message?: string })?.message?.slice(0, 6);
    }
    await flush();

    // ⚠️ DEFECT, FIXED. Measured before P2's reclassification: the undo SUCCEEDED
    // and reverted `theme` to 'one' — silently discarding the durable value the
    // reload had just read, because P0-C only protects realizations and the
    // reload was authored.
    //
    // Now refused whole: durable truth defends itself against an undo of OLDER
    // local work, and the cursor does not move. Same protection a server refresh
    // gets, which is the point — a durable boundary is not a different KIND of
    // authority from a network one.
    expect(refusal).toBe('ST1034');
    expect(tree.$.theme()).toBe('durable-now');
  });
});

describe('PER-B P5: save during a pending transaction', () => {
  it('can speculative state reach durable storage before settlement?', async () => {
    const { map, adapter } = fakeStorage();
    map.set('p5-theme', versioned('committed'));
    const tree = signalTree(
      { theme: stored('p5-theme', 'x', { storage: adapter, debounceMs: 0 }) },
      { enhancers: [restoration(), transactions()] }
    );
    expect(tree.$.theme()).toBe('committed');
    await flush();

    const pending = tree.transaction(() => {
      tree.$.theme.set('speculative');
    });
    await flush();

    const duringPending = persisted(map, 'p5-theme');
    pending.rollback();
    await flush();

    // NOT A DEFECT — the commit-scope authority already holds. Speculative state
    // never reached storage, and after the rollback live and durable agree.
    // `internals/commit-consequence.ts`'s rule ("durable storage never gets
    // ahead of the tree's settled commit state") is doing real work here rather
    // than merely claiming to.
    expect(duringPending).toBe('committed');
    expect(persisted(map, 'p5-theme')).toBe('committed');
    expect(tree.$.theme()).toBe('committed');
  });

  it('P7 probe — and after a CONFIRM?', async () => {
    const { map, adapter } = fakeStorage();
    map.set('p7-theme', versioned('committed'));
    const tree = signalTree(
      { theme: stored('p7-theme', 'x', { storage: adapter, debounceMs: 0 }) },
      { enhancers: [restoration(), transactions()] }
    );
    expect(tree.$.theme()).toBe('committed');
    await flush();

    const pending = tree.transaction(() => tree.$.theme.set('settled'));
    await flush();
    const duringPending = persisted(map, 'p7-theme');
    pending.confirm();
    await flush();
    tree.$.theme.flush?.();

    // Persistence observes the transaction only AFTER settlement.
    expect(duringPending).toBe('committed');
    expect(persisted(map, 'p7-theme')).toBe('settled');
  });
});

describe('PER-B P4: reload inside a pending transaction', () => {
  it('contribution, dependency evidence, or refused?', async () => {
    const { map, adapter } = fakeStorage();
    map.set('p4-theme', versioned('committed'));
    const tree = signalTree(
      {
        theme: stored('p4-theme', 'x', { storage: adapter, debounceMs: 0 }),
        n: 0,
      },
      { enhancers: [restoration(), transactions()] }
    );
    expect(tree.$.theme()).toBe('committed');
    await flush();

    map.set('p4-theme', versioned('durable-changed'));

    let thrown: unknown = 'no-throw';
    const pending = tree.transaction(() => {
      tree.$.n.set(1);
      try {
        tree.$.theme.reload?.();
      } catch (error) {
        thrown = (error as { message?: string })?.message?.slice(0, 40);
      }
    });
    await flush();

    let refusal: unknown = 'no-refusal';
    try {
      pending.rollback();
    } catch (error) {
      refusal = (error as { cause?: { kind?: unknown } })?.cause?.kind;
    }
    await flush();

    // ⚠️ DEFECT, FIXED. Measured before P2's reclassification: the reload's write
    // was captured into the transaction's CONTRIBUTION, so the rollback reverted
    // it and left `theme` at 'committed' while durable storage held
    // 'durable-changed' — the tree silently disagreeing with storage.
    //
    // Now: the reload is a realization, so it contributes nothing, the rollback
    // reverses only the authored `n`, and the tree and storage agree. It is not
    // refused either, because the ingress touched nothing speculative — TX-LEDGER
    // C3's bounded admission, doing exactly what A1 case 5 measured for HTTP.
    expect(thrown).toBe('no-throw');
    expect(refusal).toBe('no-refusal');
    expect(tree.$.n()).toBe(0);
    expect(tree.$.theme()).toBe('durable-changed');
    expect(persisted(map, 'p4-theme')).toBe('durable-changed');
  });
});
