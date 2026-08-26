import { afterEach, describe, expect, it } from 'vitest';

import { getPathNotifier } from '../../lib/path-notifier';
import { link, type Link } from '../../lib/link';
import { persistence } from './serialization';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from '../transactions/transactions';
import { withWriteContext } from '../../lib/write-context';
import type { StorageAdapter } from './storage-adapters';

/**
 * SERIALIZATION'S ROLE, DISPOSED — the final `INSPECTION-EGRESS-0` row.
 *
 * THE THREE-WAY SPLIT this file pins:
 *
 *   serialization   TRANSFORMS VALUES — encode out, acquire in
 *   Link            DECIDES AUTHORIZED EXTERNAL TRUTH
 *   persistence     APPLIES DURABILITY POLICY to that relationship
 *
 * ⚠️ AND THE FIRST THING TO SAY IS WHAT IS *NOT* A DEFECT. `serialize()`
 * encodes CURRENT OBSERVABLE STATE, so an inspection scrub CAN appear in its
 * output. That is intentional and SER-1 pins it, because the tempting "fix" —
 * making `serialize()` encode eligible authority because persistence does — is
 * wrong:
 *
 *     ENCODING DOES NOT CHOOSE AUTHORITY. THE CALLER DOES.
 *
 * A caller asking for bytes is asking about the state it can see. The invariant
 * is narrower than "inspection must never be visible": inspection may alter
 * observable and diagnostic state, and may not ACQUIRE EXTERNAL CAUSAL
 * AUTHORITY.
 *
 * ⚠️ REACHABILITY. `serialization()` is not exported from any package
 * entrypoint — `core` has exactly one (`.`) and it exports `persistence` alone.
 * So "standalone serialization" is reachable only as the `SerializationMethods`
 * half of a persisted tree, which is what these rows drive.
 */

type S = { a: string; b: string; c: string };
const INITIAL: S = { a: 'a0', b: 'b0', c: 'c0' };

const flush = async () => {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 350));
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

type Ser = {
  serialize(): string;
  deserialize(json: string): void;
  restore(snapshot: { data: S }): void;
  load(): Promise<void>;
};

const makeTree = (adapter: StorageAdapter, key: string) =>
  signalTree(
    { ...INITIAL },
    {
      enhancers: [
        transactions(),
        persistence({ key, storage: adapter, debounceMs: 0, autoLoad: false }),
      ],
    }
  ) as unknown as ReturnType<typeof signalTree<S>> & Ser;

const live: Link[] = [];
afterEach(() => {
  for (const l of live.splice(0)) l.dispose();
});

// ============================================================================
// SER-1 — ENCODE. serialize() is current state, and that is CORRECT.
// ============================================================================
describe('SER-1 — serialize() encodes observable state, inspection included', () => {
  it('an inspection scrub appears in serialize() output, and that is allowed', async () => {
    const { adapter } = recordingAdapter();
    const tree = makeTree(adapter, 'ser1');
    await flush();

    withWriteContext(INSPECTION, () => tree.$.b.set('SCRUBBED'));

    // ⚠️ DO NOT "FIX" THIS. A caller asked what the tree currently holds.
    expect(tree.serialize()).toContain('SCRUBBED');
  });

  it('...while the SAME scrub never becomes durable truth', async () => {
    const { adapter, writes } = recordingAdapter();
    const tree = makeTree(adapter, 'ser1b');
    await flush();
    writes.length = 0;

    withWriteContext(INSPECTION, () => tree.$.b.set('SCRUBBED'));
    await flush();
    tree.$.c.set('AUTHORED'); // an unrelated authored write, later
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
describe('SER-2 — serialization owns no egress', () => {
  it('calling serialize() never publishes to an attached relationship', async () => {
    const { adapter } = recordingAdapter();
    const tree = makeTree(adapter, 'ser2');
    await flush();

    const got: S[] = [];
    live.push(
      link(
        tree.$ as never,
        {
          set: (v: S) => void got.push({ ...v }),
        } as never
      )
    );

    tree.serialize();
    tree.serialize();
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

  it('load() — the Link acquisition path', async () => {
    const { adapter, store } = recordingAdapter();
    store.set('ser3a', JSON.stringify({ data: { a: 'X', b: 'b0', c: 'c0' } }));
    const tree = makeTree(adapter, 'ser3a');
    await flush();
    expect(await firstMeta(() => tree.load())).toEqual(REALIZED);
  });

  it('deserialize() — the direct public path', async () => {
    const { adapter } = recordingAdapter();
    const tree = makeTree(adapter, 'ser3b');
    await flush();
    const meta = await firstMeta(() =>
      tree.deserialize(JSON.stringify({ data: { a: 'X', b: 'b0', c: 'c0' } }))
    );
    expect(meta).toEqual(REALIZED);
  });

  it('restore() — the direct public path', async () => {
    const { adapter } = recordingAdapter();
    const tree = makeTree(adapter, 'ser3c');
    await flush();
    const meta = await firstMeta(() =>
      tree.restore({ data: { a: 'X', b: 'b0', c: 'c0' } })
    );
    expect(meta).toEqual(REALIZED);
  });
});

// ============================================================================
// SER-4 — ACQUIRE does not carry inspection outward.
// ============================================================================
describe('SER-4 — an inspection value does not hitchhike out through deserialize()', () => {
  it('authored A, inspection B, then an acquisition — B never reaches storage', async () => {
    const { adapter, writes } = recordingAdapter();
    const tree = makeTree(adapter, 'ser4');
    await flush();
    writes.length = 0;

    tree.$.a.set('A1');
    await flush();
    withWriteContext(INSPECTION, () => tree.$.b.set('SCRUB'));
    await flush();
    tree.deserialize(JSON.stringify({ data: { a: 'A1', b: 'b0', c: 'C1' } }));
    await flush();

    expect(lastDurable(writes)).toEqual({ a: 'A1', b: 'b0', c: 'C1' });
    expect(writes.some((w) => w.includes('SCRUB'))).toBe(false);
  });
});
