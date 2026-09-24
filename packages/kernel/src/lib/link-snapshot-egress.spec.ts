import { afterEach, describe, expect, it } from 'vitest';

import { getPathNotifier } from './path-notifier';
import { link, type Link } from '../index';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { withWriteContext } from './write-context';
type StorageAdapter = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type S = { a: string; b: string; c: string };
const INITIAL: S = { a: 'a0', b: 'b0', c: 'c0' };

const flush = async () => {
  await Promise.resolve();
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

const INSPECTION = {
  intent: 'system',
  origin: 'devtools',
  participation: 'inspection',
} as const;

function recordingAdapter() {
  const writes: string[] = [];
  const store = new Map<string, string>();
  const adapter: StorageAdapter = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      writes.push(v);
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
  };
  return { adapter, writes, store };
}

const lastDurable = (writes: string[]): S | null =>
  writes.length
    ? (JSON.parse(writes[writes.length - 1]) as { data: S }).data
    : null;

const live: Link[] = [];
const trees: Array<{ destroy(): void }> = [];
const makeTree = (adapter: StorageAdapter, key: string) => {
  const tree = signalTree({ ...INITIAL }, { enhancers: [transactions()] });
  live.push(
    link(tree.$, {
      set: (value) => adapter.setItem(key, JSON.stringify({ data: value })),
    })
  );
  trees.push(tree);
  return tree;
};
afterEach(() => {
  for (const l of live.splice(0)) l.dispose();
  for (const t of trees.splice(0)) t.destroy();
});
const acquire = async (tree: ReturnType<typeof makeTree>, value: S) => {
  const inbound = link(tree.$, { get: () => value });
  live.push(inbound);
  await inbound.retrieve();
};

// ============================================================================
// SER-1 — ENCODE. JSON snapshot reads is current state, and that is CORRECT.
// ============================================================================
describe('SER-1 — snapshot reads include observable inspection state', () => {
  it('an inspection scrub appears in a JSON snapshot', async () => {
    const { adapter } = recordingAdapter();
    const tree = makeTree(adapter, 'ser1');
    await flush();

    withWriteContext(INSPECTION, () => tree.$.b('SCRUBBED'));

    // ⚠️ DO NOT "FIX" THIS. A caller asked what the tree currently holds.
    expect(JSON.stringify(tree.$())).toContain('SCRUBBED');
  });

  it('...while the SAME scrub never becomes durable truth', async () => {
    const { adapter, writes } = recordingAdapter();
    const tree = makeTree(adapter, 'ser1b');
    await flush();
    writes.length = 0;

    withWriteContext(INSPECTION, () => tree.$.b('SCRUBBED'));
    await flush();
    tree.$.c('AUTHORED'); // an unrelated authored write, later
    await flush();

    // The two halves of the invariant, side by side: visible to an encoder,
    // never authoritative for an endpoint.
    expect(lastDurable(writes)?.c).toBe('AUTHORED');
    expect(lastDurable(writes)?.b).toBe('b0');
  });
});

// ============================================================================
// SER-2 — ENCODE IS NOT EGRESS.
// ============================================================================
describe('SER-2 — snapshot reads own no egress', () => {
  it('reading a JSON snapshot never publishes to an attached relationship', async () => {
    const { adapter } = recordingAdapter();
    const tree = makeTree(adapter, 'ser2');
    await flush();

    const got: S[] = [];
    live.push(
      link(tree.$, {
        set: (v: S) => void got.push({ ...v }),
      })
    );

    JSON.stringify(tree.$());
    JSON.stringify(tree.$());
    await flush();

    // Encoding is a read. It produces a value FOR THE CALLER, and the caller
    // decides what to do with it — which is precisely why it is not egress.
    expect(got).toEqual([]);
  });
});

// ============================================================================
// SER-3 — ACQUIRE. One external-truth acquisition path, not four.
// ============================================================================
describe('SER-3 — every inbound method declares external truth identically', () => {
  const firstMeta = async (fn: () => void | Promise<void>) => {
    let seen: unknown;
    const off = getPathNotifier().subscribe(
      '**',
      (_v, _p, _path, _o, origin, _s, _pos, meta) => {
        const m = (meta ?? {}) as Record<string, unknown>;
        if (!seen) {
          seen = {
            origin: origin ?? m['origin'],
            participation: m['participation'],
          };
        }
      }
    );
    try {
      await fn();
      // ⚠️ AWAIT BEFORE UNSUBSCRIBING. Notifications are delivered
      // asynchronously; a synchronous subscribe/call/unsubscribe saw NOTHING
      // and would have been misread as "no write happened".
      await flush();
    } finally {
      off();
    }
    return seen;
  };

  const REALIZED = { origin: 'external', participation: 'realized' };

  it('retrieve() — the Link acquisition path', async () => {
    const { adapter, store } = recordingAdapter();
    store.set('ser3a', JSON.stringify({ data: { a: 'X', b: 'b0', c: 'c0' } }));
    const tree = makeTree(adapter, 'ser3a');
    await flush();
    expect(
      await firstMeta(() =>
        acquire(tree, JSON.parse(store.get('ser3a')!).data as S)
      )
    ).toEqual(REALIZED);
  });

  it('subscribe() acquisition declares realized external truth', async () => {
    const { adapter } = recordingAdapter();
    const tree = makeTree(adapter, 'ser3b');
    let emit: ((value: S) => void) | undefined;
    live.push(
      link(tree.$, {
        subscribe: (next) => {
          emit = next;
          return () => {
            emit = undefined;
          };
        },
      })
    );
    expect(emit).toBeTypeOf('function');
    expect(await firstMeta(() => emit!({ a: 'X', b: 'b0', c: 'c0' }))).toEqual(
      REALIZED
    );
  });
});

// ============================================================================
// SER-4 — ACQUIRE does not carry inspection outward.
// ============================================================================
describe('SER-4 — an inspection value does not hitchhike out through Link acquisition', () => {
  it('authored A, inspection B, then an acquisition — B never reaches storage', async () => {
    const { adapter, writes } = recordingAdapter();
    const tree = makeTree(adapter, 'ser4');
    await flush();
    writes.length = 0;

    tree.$.a('A1');
    await flush();
    withWriteContext(INSPECTION, () => tree.$.b('SCRUB'));
    await flush();
    await acquire(tree, { a: 'A1', b: 'b0', c: 'C1' });
    await flush();

    expect(lastDurable(writes)).toEqual({ a: 'A1', b: 'b0', c: 'C1' });
    expect(writes.some((w) => w.includes('SCRUB'))).toBe(false);
  });
});
