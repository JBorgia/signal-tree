import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { persistence } from './serialization';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from '../transactions/transactions';
import { withWriteContext } from '../../lib/write-context';
import type { StorageAdapter } from './storage-adapters';

/**
 * PERSISTENCE-AS-LINK-SWAP-0 — the discriminating matrix.
 *
 * THE HYPOTHESIS UNDER LOAD:
 *
 *   Persistence does not need its own relationship authority model.
 *   Persistence = Link + application/durability policy.
 *
 * This file is the discriminator for that swap, and it is written against the
 * INCUMBENT first so the baseline is measured rather than assumed. The same
 * rows are re-run after the substitution; a row that already fails here is
 * incumbent behaviour to be CLASSIFIED (SWAP-D), not a regression the swap
 * introduced.
 *
 * ⚠️ THE PREREGISTERED PREDICTION. `persistence()` detects change by WHOLE-TREE
 * REFERENCE IDENTITY (`tree()` !== previousState) and gates the write on a
 * whole-tree string compare. That is structurally the SAME mechanism as
 * LINK-ROOT-SOURCE-0's M3 mutation — "replace the eligible projection with a
 * current whole-tree re-read" — which passed six rows and killed the inspection
 * row ALONE. So P2/P3 are predicted to FAIL here, for a reason already proved
 * one level down: CORRECT COMPLETE SHAPE IS NOT CORRECT EXTERNALLY-AUTHORIZED
 * TRUTH.
 *
 * Timing: autoSave debounces through setTimeout and, outside an Angular
 * injection context, falls back to a 100ms poll. Three earlier probes in this
 * audit were fooled by awaiting microtasks only. Waits below clear the poll.
 */

type S = { a: string; b: string; c: string };
const INITIAL: S = { a: 'a0', b: 'b0', c: 'c0' };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 350));
};

const INSPECTION = {
  intent: 'system',
  origin: 'devtools',
  participation: 'inspection',
} as const;

/** Records every payload the durable endpoint is actually asked to hold. */
function recordingAdapter() {
  const writes: string[] = [];
  const store = new Map<string, string>();
  const adapter: StorageAdapter = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      writes.push(v);
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
  return { adapter, writes, store };
}

/** The durable state of the LAST payload written, or null if never written. */
function lastDurable<T>(writes: string[]): T | null {
  if (writes.length === 0) return null;
  return (JSON.parse(writes[writes.length - 1]) as { data: T }).data;
}

type Persisted<T extends object> = ReturnType<typeof signalTree<T>> & {
  save(): Promise<void>;
  load(): Promise<void>;
  __flushAutoSave?: () => Promise<void>;
};

function makeTree(adapter: StorageAdapter, key: string) {
  return signalTree(
    { ...INITIAL },
    {
      enhancers: [
        transactions(),
        persistence({ key, storage: adapter, debounceMs: 0, autoLoad: false }),
      ],
    }
  ) as unknown as Persisted<S>;
}

// ============================================================================
// P1 — AUTHORED
// ============================================================================
describe('P1 — an authored write reaches the durable endpoint complete', () => {
  it('persists the whole-tree value including the authored change', async () => {
    const { adapter, writes } = recordingAdapter();
    const tree = makeTree(adapter, 'p1');
    await flush();
    writes.length = 0;

    tree.$.a.set('AUTHORED');
    await flush();

    const durable = lastDurable<S>(writes);
    expect(durable).not.toBeNull();
    expect(durable?.a).toBe('AUTHORED');
    // Complete, not just the changed field.
    expect(durable?.b).toBe('b0');
    expect(durable?.c).toBe('c0');
  });
});

// ============================================================================
// P2 — INSPECTION
// ============================================================================
describe('P2 — an inspection write changes state but not durable truth', () => {
  it('local state advances', async () => {
    const { adapter } = recordingAdapter();
    const tree = makeTree(adapter, 'p2a');
    await flush();

    withWriteContext(INSPECTION, () => tree.$.b.set('SCRUBBED'));
    expect(tree.$.b()).toBe('SCRUBBED');
  });

  it('the durable endpoint does NOT advance', async () => {
    const { adapter, writes } = recordingAdapter();
    const tree = makeTree(adapter, 'p2b');
    await flush();
    writes.length = 0;

    withWriteContext(INSPECTION, () => tree.$.b.set('SCRUBBED'));
    await flush();

    const durable = lastDurable<S>(writes);
    if (durable !== null) expect(durable.b).not.toBe('SCRUBBED');
  });

  it('an EXPLICIT save() does not make an inspection scrub durable', async () => {
    // ⚠️ THE MANUAL PATH IS A SEPARATE ROUTE TO THE SAME DEFECT, and it is the
    // one an autoSave-only matrix misses entirely: a developer scrubs a value
    // in devtools, the application calls `save()`, and the scrub is durable.
    // `save()` therefore publishes the ELIGIBLE value, never `tree()`.
    const { adapter, writes } = recordingAdapter();
    const tree = makeTree(adapter, 'p2c');
    await flush();

    tree.$.a.set('AUTHORED');
    await tree.save();
    writes.length = 0;

    withWriteContext(INSPECTION, () => tree.$.b.set('SCRUBBED'));
    await tree.save();
    await flush();

    expect(tree.$.b()).toBe('SCRUBBED');
    expect(writes.some((w) => w.includes('SCRUBBED'))).toBe(false);
  });
});

// ============================================================================
// P3 — INSPECTION HITCHHIKE  (load-bearing)
// ============================================================================
describe('P3 — an inspection value never rides out on a later authored write', () => {
  it('durable value is A + C, and never B', async () => {
    const { adapter, writes } = recordingAdapter();
    const tree = makeTree(adapter, 'p3');
    await flush();
    writes.length = 0;

    tree.$.a.set('A1'); // authored
    await flush();
    withWriteContext(INSPECTION, () => tree.$.b.set('B1')); // inspection
    await flush();
    tree.$.c.set('C1'); // authored, unrelated
    await flush();

    const durable = lastDurable<S>(writes);
    expect(durable?.a).toBe('A1');
    expect(durable?.c).toBe('C1');
    // THE LOAD-BEARING ASSERTION. The authored C write must publish authored
    // truth, not "whatever the tree currently holds".
    expect(durable?.b).toBe('b0');
    expect(writes.some((w) => w.includes('B1'))).toBe(false);
  });
});

// ============================================================================
// P4 — REALIZED EXTERNAL TRUTH
// ============================================================================
describe('P4 — durable truth loaded from storage is realized, not inspection', () => {
  it('local state adopts the external value', async () => {
    const { adapter, store } = recordingAdapter();
    store.set(
      'p4',
      JSON.stringify({ data: { a: 'FROM_DISK', b: 'b0', c: 'c0' } })
    );
    const tree = makeTree(adapter, 'p4');
    await tree.load();
    await flush();

    expect(tree.$.a()).toBe('FROM_DISK');
  });

  it('eligible authority adopts it — a write back to the pre-load value is durable', async () => {
    const { adapter, store, writes } = recordingAdapter();
    store.set(
      'p4b',
      JSON.stringify({ data: { a: 'FROM_DISK', b: 'b0', c: 'c0' } })
    );
    const tree = makeTree(adapter, 'p4b');
    await tree.load();
    await flush();
    writes.length = 0;

    tree.$.a.set('a0'); // authored, back to the pre-load value
    await flush();

    expect(lastDurable<S>(writes)?.a).toBe('a0');
  });
});

// ============================================================================
// P5 — I4: AUTHORITY TRANSITION WITHOUT STATE TRANSITION
// ============================================================================
describe('P5 — external acquisition moves eligible authority with no local mutation', () => {
  it('acquiring the inspection-displayed value makes it eligible, without a state change', async () => {
    const { adapter, store, writes } = recordingAdapter();
    const tree = makeTree(adapter, 'p5');
    await flush();

    // eligible baseline = a0; observable state becomes INSPECTED via inspection
    withWriteContext(INSPECTION, () => tree.$.a.set('INSPECTED'));
    await flush();
    expect(tree.$.a()).toBe('INSPECTED');

    // external truth arrives and it happens to equal what inspection displays
    store.set(
      'p5',
      JSON.stringify({ data: { a: 'INSPECTED', b: 'b0', c: 'c0' } })
    );
    const before = tree.$.a();
    await tree.load();
    await flush();

    // OBSERVABLE STATE MAY NOT CHANGE...
    expect(tree.$.a()).toBe(before);

    // ...BUT ELIGIBLE AUTHORITY MUST HAVE MOVED. Writing back to the baseline
    // is therefore a real change and must reach the endpoint.
    writes.length = 0;
    tree.$.a.set('a0');
    await flush();
    expect(lastDurable<S>(writes)?.a).toBe('a0');
  });

  it('CHARACTERIZATION (non-discriminating) — a rollback cannot revoke acquired truth', async () => {
    // ⚠️ THIS ROW EXISTS BECAUSE THE ROW ABOVE WAS NOT ENOUGH. A mutation that
    // applied the payload WITHOUT telling the relationship — load() writing
    // through the codec directly — passed every other row in this file. It
    // passed for the wrong reason: the payload landed as an ORDINARY AUTHORED
    // WRITE, which advances eligible authority just as well, so no assertion
    // about what becomes durable could tell the two apart.
    //
    // What separates them is REVOCABILITY. Authored work is transactional and
    // can be rolled back; external truth belongs to another authority and
    // cannot. This is the PER-B P4 rule, one level up.
    //
    // ⚠️ AND IT DOES NOT DISCRIMINATE EITHER — recorded as such rather than
    // counted as evidence. `load()` is async, so the payload lands AFTER the
    // transaction callback has returned and the rollback has no claim on it
    // whatever its classification. Every mutation tried leaves this row green.
    // The inbound half is pinned by P6 instead, which fails the moment the
    // relationship is not told. This row is kept because the invariant is real
    // and worth stating, NOT because it proves anything.
    const { adapter, store } = recordingAdapter();
    const tree = makeTree(adapter, 'p5b');
    await flush();
    // ⚠️ THE EXTERNAL VALUE MUST LAND ON THE LEAF THE TRANSACTION TOUCHED.
    // A first version of this row wrote the payload into an UNRELATED leaf, so
    // rollback had no claim on it and the assertion held no matter how the
    // write was classified. It passed identically with and without the
    // mutation, which is the definition of a vacuous row.
    store.set(
      'p5b',
      JSON.stringify({ data: { a: 'EXTERNAL', b: 'b0', c: 'c0' } })
    );

    const pending = (
      tree as unknown as {
        transaction(fn: () => void): { confirm(): void; rollback(): void };
      }
    ).transaction(() => {
      tree.$.a.set('SPECULATIVE');
    });
    await tree.load();
    pending.rollback();
    await flush();

    // The externally acquired value survives the rollback of the speculative
    // authored write that preceded it on the SAME leaf.
    expect(tree.$.a()).toBe('EXTERNAL');
  });
});

// ============================================================================
// P6 — NO BAD ECHO
// ============================================================================
describe('P6 — incoming durable truth is not echoed straight back out', () => {
  it('load() does not provoke a redundant outbound save', async () => {
    const { adapter, store, writes } = recordingAdapter();
    store.set(
      'p6',
      JSON.stringify({ data: { a: 'FROM_DISK', b: 'b0', c: 'c0' } })
    );
    const tree = makeTree(adapter, 'p6');
    await flush();
    writes.length = 0;

    await tree.load();
    await flush();

    expect(writes.length).toBe(0);
  });
});

// ============================================================================
// P7 — ENTITY WHOLE TREE
// ============================================================================
describe('P7 — a collection inside the persisted root publishes canonically', () => {
  type Row = { id: string; n: number };
  // ⚠️ ENVELOPE IS CODEC, NOT AUTHORITY. A collection serializes as its marker
  // snapshot `{ all: Row[] }`, not a bare array. That is persistence's encoding
  // policy and is deliberately NOT what this row is testing — P7 asks whether
  // the ROWS the endpoint receives are canonical, whatever envelope carries
  // them. A swap that changed the envelope would be a breaking codec change and
  // would have to be argued on its own terms.
  type E = { rows: { all: Row[] } };

  const makeEntityTree = (adapter: StorageAdapter, key: string) =>
    signalTree(
      { rows: entityMap<Row>((r) => r.id) },
      {
        enhancers: [
          transactions(),
          persistence({
            key,
            storage: adapter,
            debounceMs: 0,
            autoLoad: false,
          }),
        ],
      }
    ) as unknown as Persisted<E> & {
      $: {
        rows: {
          addOne(r: Row): void;
          updateOne(id: string, p: Partial<Row>): void;
          removeOne(id: string): void;
        };
      };
    };

  it('addOne / updateOne / removeOne each produce the canonical durable whole-tree value', async () => {
    const { adapter, writes } = recordingAdapter();
    const tree = makeEntityTree(adapter, 'p7');
    await flush();
    writes.length = 0;

    tree.$.rows.addOne({ id: 'r1', n: 1 });
    await flush();
    expect(lastDurable<E>(writes)?.rows.all).toEqual([{ id: 'r1', n: 1 }]);

    tree.$.rows.addOne({ id: 'r2', n: 2 });
    await flush();
    expect(lastDurable<E>(writes)?.rows.all).toEqual([
      { id: 'r1', n: 1 },
      { id: 'r2', n: 2 },
    ]);

    tree.$.rows.updateOne('r1', { n: 11 });
    await flush();
    expect(lastDurable<E>(writes)?.rows.all).toEqual([
      { id: 'r1', n: 11 },
      { id: 'r2', n: 2 },
    ]);

    tree.$.rows.removeOne('r1');
    await flush();
    expect(lastDurable<E>(writes)?.rows.all).toEqual([{ id: 'r2', n: 2 }]);
  });
});

// ============================================================================
// P8 — OWNER ISOLATION
// ============================================================================
describe('P8 — one tree never persists because a same-shaped sibling changed', () => {
  it("tree A's endpoint does not advance from tree B's writes", async () => {
    const a = recordingAdapter();
    const b = recordingAdapter();
    const treeA = makeTree(a.adapter, 'p8a');
    const treeB = makeTree(b.adapter, 'p8b');
    await flush();
    a.writes.length = 0;
    b.writes.length = 0;

    treeB.$.a.set('ONLY_B');
    await flush();

    expect(b.writes.length).toBeGreaterThan(0);
    expect(a.writes.length).toBe(0);
  });
});

// ============================================================================
// P9 — DISPOSE / LIFECYCLE
// ============================================================================
describe('P9 — a disposed persistence relationship produces no durable consequence', () => {
  it('writes after destroy mutate state but reach no endpoint', async () => {
    const { adapter, writes } = recordingAdapter();
    const tree = makeTree(adapter, 'p9');
    await flush();

    (tree as unknown as { destroy(): void }).destroy();
    await flush();
    writes.length = 0;

    tree.$.a.set('AFTER_DISPOSE');
    await flush();

    expect(tree.$.a()).toBe('AFTER_DISPOSE');
    expect(writes.length).toBe(0);
  });
});
