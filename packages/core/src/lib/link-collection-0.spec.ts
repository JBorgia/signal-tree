import { describe, expect, it } from 'vitest';

import { deepEqual } from './utils';
import { entityMap } from './types';
import { external } from './external';
import { getPathNotifier } from './path-notifier';
import { getPositionRegistry } from './internals/position-registry';
import { restoration } from '../enhancers/restoration/restoration';
import { scheduleDurableConsequence } from './internals/commit-consequence';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { undoable } from './undoable';

/**
 * LINK-COLLECTION-0 — the VALUE CONTRACT, which ownership does not settle.
 *
 * OWNER-LOCATION-0 gave every addressable position its registry, so a collection
 * can now name its tree. ⚠️ That does NOT make it a link target: the probe also
 * measured that a collection is not an ordinary callable writable location.
 *
 * ```text
 * tree.$.data.rows      NOT callable
 * snapshot              rows.all()
 * whole replacement     rows.setAll(...)
 * ```
 *
 * ```text
 * NULL  an independently addressable entityMap can participate in link using a
 *       natural WHOLE-COLLECTION state contract, with no new public abstraction
 * ```
 *
 * Candidate, to falsify rather than assume:
 *
 * ```text
 * read collection   rows.all()
 * acquire from Y    external(() => rows.setAll(value))
 * value type        Row[]
 * ```
 *
 * If any of this needs marker-specific PUBLIC semantics, the answer is to say
 * so, not to force direct collection support.
 */

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

type Row = { id: string; n: number };

interface LinkEndpoint<T> {
  get?(): T | Promise<T>;
  set?(value: T): void | Promise<void>;
  subscribe?(next: (value: T) => void): () => void;
}

/**
 * A collection-aware read/write pair, resolved from the NODE rather than
 * configured by the caller. This is the whole question: whether the shape can be
 * inferred, or whether it leaks into the public surface.
 */
const accessorsFor = <T>(x: unknown) => {
  const coll = x as {
    all?: () => T;
    setAll?: (v: T) => void;
    set?: (v: T) => void;
  };
  if (typeof coll.all === 'function' && typeof coll.setAll === 'function') {
    return { read: () => coll.all!() as T, write: (v: T) => coll.setAll!(v) };
  }
  if (typeof coll.set === 'function') {
    return { read: () => (x as () => T)(), write: (v: T) => coll.set!(v) };
  }
  return { read: () => (x as () => T)(), write: (v: T) => (x as (v: T) => void)(v) };
};

const link = <T>(x: unknown, endpoint: LinkEndpoint<T>) => {
  const registry = getPositionRegistry(x);
  if (!registry) throw new Error('link: X must be an owned SignalTree location.');
  const { read, write } = accessorsFor<T>(x);
  const ownerPath = (x as { __ownerPath?: string }).__ownerPath ?? '';
  const notifier = getPathNotifier();

  let knownY: { value: T } | undefined;
  let disposed = false;
  let dirty = false;
  let chain: Promise<unknown> = Promise.resolve();
  let inboundSeq = 0;

  const acquire = (value: T, seq: number) => {
    if (disposed || seq < inboundSeq) return;
    inboundSeq = seq;
    knownY = { value };
    external(() => write(value));
  };

  const offSub = notifier.subscribe(
    '**',
    (v, prev, path, _o, _origin, _s, _pos, meta) => {
      if (disposed || !endpoint.set) return;
      const m = (meta ?? {}) as Record<string, unknown>;
      if (m['ownerId'] !== registry.id) return;
      if (
        ownerPath !== '' &&
        path !== ownerPath &&
        !path.startsWith(`${ownerPath}.`)
      ) {
        return;
      }
      if (v === undefined && prev === undefined) return;
      dirty = true;
    }
  );

  const offFlush = notifier.onFlush?.(() => {
    if (disposed || !dirty) return;
    dirty = false;
    scheduleDurableConsequence({
      claimant: x as object,
      key: link,
      run: () => {
        if (disposed) return;
        chain = chain
          .then(async () => {
            for (;;) {
              if (disposed) return;
              const now = read();
              if (knownY !== undefined && deepEqual(now, knownY.value)) return;
              await endpoint.set?.(now);
              knownY = { value: now };
            }
          })
          .catch(() => void 0);
      },
    });
  });

  const offSource = endpoint.subscribe
    ? endpoint.subscribe((v) => acquire(v, ++inboundSeq))
    : undefined;

  return {
    async retrieve() {
      if (!endpoint.get) throw new Error('link: endpoint supplies no get().');
      const seq = ++inboundSeq;
      acquire((await endpoint.get()) as T, seq);
    },
    async settled() {
      await chain;
    },
    dispose() {
      disposed = true;
      offSub();
      offFlush?.();
      offSource?.();
    },
  };
};

const collTree = () =>
  signalTree(
    { data: { rows: entityMap<Row, string>({ selectId: (r) => r.id }) } },
    { enhancers: [restoration(), transactions()] }
  );

describe('LINK-COLLECTION-0: is Row[] the collection\'s value?', () => {
  it('the read is rows.all() and the acquire is rows.setAll()', async () => {
    const tree = collTree();
    await flush();
    const sent: Row[][] = [];
    const l = link<Row[]>(tree.$.data.rows, {
      get: () => [
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
      ],
      set: (v) => void sent.push(v),
    });

    await l.retrieve();
    await flush();
    await l.settled();

    // Acquisition applied through `setAll`, and no echo back to Y.
    expect(tree.$.data.rows.all()).toHaveLength(2);
    expect(sent).toEqual([]);

    tree.$.data.rows.addOne({ id: 'c', n: 3 });
    await flush();
    await l.settled();
    l.dispose();

    // Outbound is the WHOLE collection, as an array of rows.
    expect(sent).toHaveLength(1);
    expect(sent[0].map((r) => r.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('acquisition is EXTERNAL — it earns no restoration history', async () => {
    const tree = collTree();
    await flush();
    const before = tree.getRestorationHistory().length;
    const l = link<Row[]>(tree.$.data.rows, {
      get: () => [{ id: 'a', n: 1 }],
    });

    await l.retrieve();
    await flush();
    l.dispose();

    expect(tree.$.data.rows.all()).toHaveLength(1);
    expect(tree.getRestorationHistory().length - before).toBe(0);
    expect(tree.canUndo()).toBe(false);
  });

  it('⚠️ addMany is ONE outbound snapshot, not N', async () => {
    const tree = collTree();
    await flush();
    const sent: Row[][] = [];
    const l = link<Row[]>(tree.$.data.rows, { set: (v) => void sent.push(v) });

    tree.$.data.rows.addMany([
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
      { id: 'c', n: 3 },
    ]);
    await flush();
    await l.settled();
    l.dispose();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(3);
  });

  it('a rollback never leaks a speculative collection', async () => {
    // ⚠️ A TOP-LEVEL collection, deliberately. A NESTED one cannot roll back at
    // all — see the separate defect pinned at the end of this file — and using
    // one here would make this test fail for a reason that has nothing to do
    // with link.
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [restoration(), transactions()] }
    ) as unknown as ReturnType<typeof collTree>;
    await flush();
    const sent: Row[][] = [];
    const l = link<Row[]>((tree.$ as unknown as { rows: typeof tree.$.data.rows }).rows, { set: (v) => void sent.push(v) });

    const p = tree.transaction(() => {
      (tree.$ as unknown as { rows: typeof tree.$.data.rows }).rows.addOne({ id: 'doomed', n: 9 });
    });
    await flush();
    expect(sent).toEqual([]);

    p.rollback();
    await flush();
    await l.settled();
    l.dispose();

    for (const snapshot of sent) {
      expect(snapshot.map((r) => r.id)).not.toContain('doomed');
    }
    expect((tree.$ as unknown as { rows: typeof tree.$.data.rows }).rows.all()).toHaveLength(0);
  });

  it('restoration reconciles to the final restored collection', async () => {
    const tree = collTree();
    await flush();
    const sent: Row[][] = [];
    const l = link<Row[]>(tree.$.data.rows, { set: (v) => void sent.push(v) });

    undoable(() => tree.$.data.rows.addOne({ id: 'a', n: 1 }));
    await flush();
    await l.settled();
    undoable(() => tree.$.data.rows.addOne({ id: 'b', n: 2 }));
    await flush();
    await l.settled();
    expect(sent[sent.length - 1]).toHaveLength(2);

    tree.undo();
    await flush();
    await l.settled();
    l.dispose();

    // The undo is a settled turn like any other, so Y converges on the restored
    // collection rather than being left at the pre-undo snapshot.
    expect(tree.$.data.rows.all()).toHaveLength(1);
    expect(sent[sent.length - 1]).toHaveLength(1);
  });

  it('a pushed whole snapshot is applied coherently', async () => {
    const tree = collTree();
    await flush();
    let emit: ((v: Row[]) => void) | undefined;
    const sent: Row[][] = [];
    const l = link<Row[]>(tree.$.data.rows, {
      set: (v) => void sent.push(v),
      subscribe: (next) => {
        emit = next;
        return () => void (emit = undefined);
      },
    });

    emit?.([
      { id: 'x', n: 1 },
      { id: 'y', n: 2 },
    ]);
    await flush();
    await l.settled();

    expect(tree.$.data.rows.ids().sort()).toEqual(['x', 'y']);
    // Whole-snapshot ingress must not echo back out.
    expect(sent).toEqual([]);

    emit?.([{ id: 'z', n: 3 }]);
    await flush();
    await l.settled();
    l.dispose();

    // A later snapshot REPLACES rather than merges — `setAll` semantics.
    expect(tree.$.data.rows.ids()).toEqual(['z']);
    expect(sent).toEqual([]);
  });

  it('two trees with the same collection path stay isolated', async () => {
    const a = collTree();
    const b = collTree();
    await flush();
    const sentA: Row[][] = [];
    const l = link<Row[]>(a.$.data.rows, { set: (v) => void sentA.push(v) });

    b.$.data.rows.addOne({ id: 'b-only', n: 1 });
    await flush();
    await l.settled();
    expect(sentA).toEqual([]);

    a.$.data.rows.addOne({ id: 'a-only', n: 1 });
    await flush();
    await l.settled();
    l.dispose();

    expect(sentA).toHaveLength(1);
    expect(sentA[0].map((r) => r.id)).toEqual(['a-only']);
  });

  it('dispose stops the relationship', async () => {
    const tree = collTree();
    await flush();
    const sent: Row[][] = [];
    const l = link<Row[]>(tree.$.data.rows, { set: (v) => void sent.push(v) });

    tree.$.data.rows.addOne({ id: 'before', n: 1 });
    await flush();
    await l.settled();
    l.dispose();

    tree.$.data.rows.addOne({ id: 'after', n: 2 });
    await flush();

    expect(sent).toHaveLength(1);
  });
});

/**
 * ⚠️ A DEFECT FOUND HERE, AND IT IS NOT LINK'S.
 *
 * ```text
 * { rows: entityMap }              transaction rollback of an addOne  WORKS
 * { data: { rows: entityMap } }    the SAME rollback REFUSES, and the
 *                                  speculative row SURVIVES in the tree
 * ```
 *
 * Verified pre-existing: the same result with the OWNER-LOCATION-0 ownership
 * change stashed. So a nested collection's structural compensation cannot
 * reconcile, `SignalTreeRollbackError` is thrown, and the tree is left holding
 * state a transaction explicitly withdrew.
 *
 * That is a transactions/compensation defect of the same severity class as
 * NOTIFIER-SCOPE-0's, and it is carried as its own item rather than worked
 * around silently — the arm above uses a top-level collection so that link's
 * question stays link's question.
 */
describe('NESTED-COLLECTION-ROLLBACK-0', () => {
  it('CONTROL — a TOP-LEVEL collection rolls back correctly', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();

    const p = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'doomed', n: 9 });
    });
    await flush();
    p.rollback();
    await flush();

    expect(tree.$.rows.ids()).toEqual([]);
  });

  it('a NESTED collection rolls back — closed by ADDRESS-REPAIR-1', async () => {
    const tree = collTree();
    await flush();

    const p = tree.transaction(() => {
      tree.$.data.rows.addOne({ id: 'doomed', n: 9 });
    });
    await flush();

    // Measured: throws `SignalTreeRollbackError`, and `rows` still contains
    // 'doomed' afterwards. Fixing it must flip this to a plain `it`.
    p.rollback();
    await flush();
    expect(tree.$.data.rows.ids()).toEqual([]);
  });
});
