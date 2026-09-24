import { afterEach, describe, expect, it } from 'vitest';

import { entityMap } from './markers/entity-map';
import { link } from '../index';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { withWriteContext } from './write-context';
type StorageAdapter = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
});

/**
 * P1–P9 shared authority/egress assertions migrated from the retired serializer.
 * JSON envelopes are owned by this test endpoint; public Link owns acquisition,
 * publication and disposal. No serializer implementation is retained here.
 */
type S = { a: string; b: string; c: string };
const INITIAL: S = { a: 'a0', b: 'b0', c: 'c0' };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  for (let i = 0; i < 8; i++) await Promise.resolve();
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

function makeTree(adapter: StorageAdapter, key: string) {
  const tree = signalTree({ ...INITIAL }, { enhancers: [transactions()] });
  const connection = link(tree.$, {
    get: () => (JSON.parse(adapter.getItem(key) ?? '{}') as { data: S }).data,
    set: (value) => adapter.setItem(key, JSON.stringify({ data: value })),
  });
  cleanup.push(() => {
    connection.dispose();
    tree.destroy();
  });
  return { tree, connection };
}

// ============================================================================
// P1 — AUTHORED
// ============================================================================
describe('P1 — an authored write reaches the durable endpoint complete', () => {
  it('persists the whole-tree value including the authored change', async () => {
    const { adapter, writes } = recordingAdapter();
    const { tree, connection } = makeTree(adapter, 'p1');
    await flush();
    writes.length = 0;

    tree.$.a('AUTHORED');
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
    const { tree, connection } = makeTree(adapter, 'p2a');
    await flush();

    withWriteContext(INSPECTION, () => tree.$.b('SCRUBBED'));
    expect(tree.$.b()).toBe('SCRUBBED');
  });

  it('the durable endpoint does NOT advance', async () => {
    const { adapter, writes } = recordingAdapter();
    const { tree, connection } = makeTree(adapter, 'p2b');
    await flush();
    writes.length = 0;

    withWriteContext(INSPECTION, () => tree.$.b('SCRUBBED'));
    await flush();

    const durable = lastDurable<S>(writes);
    if (durable !== null) expect(durable.b).not.toBe('SCRUBBED');
  });

  it('waiting for settlement does not publish an inspection scrub', async () => {
    // The retired explicit save route has no public Link equivalent. settled()
    // waits for admitted work; this assertion does not claim a forced save.
    const { adapter, writes } = recordingAdapter();
    const { tree, connection } = makeTree(adapter, 'p2c');
    await flush();

    tree.$.a('AUTHORED');
    await connection.settled();
    writes.length = 0;

    withWriteContext(INSPECTION, () => tree.$.b('SCRUBBED'));
    await connection.settled();
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
    const { tree, connection } = makeTree(adapter, 'p3');
    await flush();
    writes.length = 0;

    tree.$.a('A1'); // authored
    await flush();
    withWriteContext(INSPECTION, () => tree.$.b('B1')); // inspection
    await flush();
    tree.$.c('C1'); // authored, unrelated
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
    const { tree, connection } = makeTree(adapter, 'p4');
    await connection.retrieve();
    await flush();

    expect(tree.$.a()).toBe('FROM_DISK');
  });

  it('eligible authority adopts it — a write back to the pre-load value is durable', async () => {
    const { adapter, store, writes } = recordingAdapter();
    store.set(
      'p4b',
      JSON.stringify({ data: { a: 'FROM_DISK', b: 'b0', c: 'c0' } })
    );
    const { tree, connection } = makeTree(adapter, 'p4b');
    await connection.retrieve();
    await flush();
    writes.length = 0;

    tree.$.a('a0'); // authored, back to the pre-load value
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
    const { tree, connection } = makeTree(adapter, 'p5');
    await flush();

    // eligible baseline = a0; observable state becomes INSPECTED via inspection
    withWriteContext(INSPECTION, () => tree.$.a('INSPECTED'));
    await flush();
    expect(tree.$.a()).toBe('INSPECTED');

    // external truth arrives and it happens to equal what inspection displays
    store.set(
      'p5',
      JSON.stringify({ data: { a: 'INSPECTED', b: 'b0', c: 'c0' } })
    );
    const before = tree.$.a();
    await connection.retrieve();
    await flush();

    // OBSERVABLE STATE MAY NOT CHANGE...
    expect(tree.$.a()).toBe(before);

    // ...BUT ELIGIBLE AUTHORITY MUST HAVE MOVED. Writing back to the baseline
    // is therefore a real change and must reach the endpoint.
    writes.length = 0;
    tree.$.a('a0');
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
    const { tree, connection } = makeTree(adapter, 'p5b');
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
        transact(fn: () => void): { confirm(): void; rollback(): void };
      }
    ).transact(() => {
      tree.$.a('SPECULATIVE');
    });
    await connection.retrieve();
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
  it('retrieve() does not provoke a redundant outbound send', async () => {
    const { adapter, store, writes } = recordingAdapter();
    store.set(
      'p6',
      JSON.stringify({ data: { a: 'FROM_DISK', b: 'b0', c: 'c0' } })
    );
    const { tree, connection } = makeTree(adapter, 'p6');
    await flush();
    writes.length = 0;

    await connection.retrieve();
    await flush();

    expect(writes.length).toBe(0);
  });
});

// ============================================================================
// P7 — ENTITY WHOLE TREE
// ============================================================================
describe('P7 — a collection Link publishes the eligible rows', () => {
  type Row = { id: string; n: number };
  // Application-owned JSON envelope; the Link source is the collection.
  // Root sources containing construction EntityMap markers are not accepted
  // by the current public Link types, so this is not root-source coverage.
  type E = { rows: { all: Row[] } };

  const makeEntityTree = (adapter: StorageAdapter, key: string) => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    const connection = link(tree.$.rows, {
      set: (rows) =>
        adapter.setItem(key, JSON.stringify({ data: { rows: { all: rows } } })),
    });
    cleanup.push(() => {
      connection.dispose();
      tree.destroy();
    });
    return tree;
  };

  it('addOne / updateOne / removeOne each produce the eligible complete collection value', async () => {
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
    const { tree: treeA } = makeTree(a.adapter, 'p8a');
    const { tree: treeB } = makeTree(b.adapter, 'p8b');
    await flush();
    a.writes.length = 0;
    b.writes.length = 0;

    treeB.$.a('ONLY_B');
    await flush();

    expect(b.writes.length).toBeGreaterThan(0);
    expect(a.writes.length).toBe(0);
  });
});

// ============================================================================
// P9 — DISPOSE / LIFECYCLE
// ============================================================================
describe('P9 — a disposed Link produces no durable consequence', () => {
  it('writes after disposal mutate state but reach no endpoint', async () => {
    const { adapter, writes } = recordingAdapter();
    const { tree, connection } = makeTree(adapter, 'p9');
    await flush();

    connection.dispose();
    await flush();
    writes.length = 0;

    tree.$.a('AFTER_DISPOSE');
    await flush();

    expect(tree.$.a()).toBe('AFTER_DISPOSE');
    expect(writes.length).toBe(0);
  });
});
