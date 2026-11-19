import { entityMap } from '../index';
import { signalTree } from './signal-tree';
import type { AcquiredSubjectHandle } from './physical/structural-store';

/**
 * Guards for the per-entity signal layer (body-granular entityMap) and the
 * memory-safety fixes from code review: absent ids must stay reactive without
 * permanently materializing a signal, and removed ids must release theirs.
 */
interface Row {
  id: number;
  v: number;
}

function makeRows() {
  const tree = signalTree({ rows: entityMap<Row, number>() });
  return tree.$.rows as unknown as {
    addOne: (r: Row) => void;
    addMany: (r: Row[]) => void;
    updateOne: (id: number, patch: Partial<Row>) => void;
    removeOne: (id: number) => void;
    byId: (id: number) => { v: () => number | undefined } | undefined;
    all: (() => Row[]) & { subscribe(listener: () => void): () => void };
  };
}

type InternalHandleRows = ReturnType<typeof makeRows> & {
  __acquireEntityHandleForTesting: (
    id: number
  ) => AcquiredSubjectHandle | undefined;
  __resolveEntityHandleForTesting: (handle: AcquiredSubjectHandle) => unknown;
};

function acquireExistingHandle(rows: InternalHandleRows, id: number) {
  const handle = rows.__acquireEntityHandleForTesting(id);
  if (handle === undefined) {
    throw new Error(`Expected active entity at ${id}`);
  }
  return handle;
}

describe('entityMap granular reactivity', () => {
  it('publishes a field and collection projection as one coherent state', () => {
    const tree = signalTree({ rows: entityMap<Row, number>() });
    tree.$.rows.addOne({ id: 1, v: 1 });
    tree.$.rows.all();
    const field = tree.$.rows.byIdOrFail(1).v;
    const seen: Array<{ field: number; projected: number }> = [];
    const unsubscribe = field.subscribe(() => {
      seen.push({ field: field(), projected: tree.$.rows.all()[0].v });
    });

    tree.$.rows.updateOne(1, { v: 2 });

    expect(seen).toEqual([{ field: 2, projected: 2 }]);
    unsubscribe();
  });

  it('removal releases the entity: held reference reads undefined, byId absent', () => {
    const rows = makeRows();
    rows.addOne({ id: 1, v: 5 });
    const node = rows.byId(1);
    expect(node?.v()).toBe(5);
    rows.removeOne(1);
    expect(node?.v()).toBeUndefined(); // held ref sees it gone
    expect(rows.byId(1)).toBeUndefined();
  });

  it('re-add after removal works through a fresh byId', () => {
    const rows = makeRows();
    rows.addOne({ id: 1, v: 5 });
    rows.removeOne(1);
    rows.addOne({ id: 1, v: 7 });
    expect(rows.byId(1)?.v()).toBe(7);
  });
});

/**
 * Elements visited while `run` executes, counted where an O(size) rebuild or
 * copy goes: Map and Set iteration, `Array.from`, `Object.keys`, `values` and
 * `entries`, and the Array methods that build, search or walk arrays. Counted
 * work, not wall-clock time, so machine load cannot fail it (v16 integration
 * slice 8d). An indexed loop that builds nothing is not counted.
 */
function countIteratedElements(run: () => void): number {
  let visited = 0;
  const restore: Array<() => void> = [];
  const patch = (
    target: object,
    key: PropertyKey,
    wrap: (original: (...args: unknown[]) => unknown) => unknown
  ): void => {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (!descriptor) throw new Error(`nothing to count at ${String(key)}`);
    restore.push(() => Object.defineProperty(target, key, descriptor));
    Object.defineProperty(target, key, {
      ...descriptor,
      value: wrap(descriptor.value),
    });
  };
  const counting = (iterator: Iterator<unknown>): IterableIterator<unknown> => ({
    next() {
      const step = iterator.next();
      if (!step.done) visited++;
      return step;
    },
    [Symbol.iterator]() {
      return this;
    },
  });
  for (const proto of [Map.prototype, Set.prototype, Array.prototype])
    for (const key of ['keys', 'values', 'entries', Symbol.iterator])
      patch(proto, key, (original) =>
        function (this: unknown, ...args: unknown[]) {
          return counting(original.apply(this, args) as Iterator<unknown>);
        }
      );
  for (const proto of [Map.prototype, Set.prototype])
    patch(proto, 'forEach', (original) =>
      function (this: { size: number }, ...args: unknown[]) {
        visited += this.size;
        return original.apply(this, args);
      }
    );
  // Whole-array walks, counted at their full length: a search that stops
  // early still scales with the array it searches.
  for (const key of [
    'map',
    'filter',
    'forEach',
    'slice',
    'concat',
    'reduce',
    'indexOf',
    'lastIndexOf',
    'includes',
    'find',
    'findIndex',
    'some',
    'every',
    'splice',
    'sort',
    'join',
  ])
    patch(Array.prototype, key, (original) =>
      function (this: unknown[], ...args: unknown[]) {
        visited += this.length;
        return original.apply(this, args);
      }
    );
  for (const key of ['keys', 'values', 'entries'])
    patch(Object, key, (original) =>
      function (this: unknown, ...args: unknown[]) {
        const result = original.apply(this, args) as unknown[];
        visited += result.length;
        return result;
      }
    );
  patch(Array.prototype, 'push', (original) =>
    function (this: unknown[], ...args: unknown[]) {
      visited += args.length;
      return original.apply(this, args);
    }
  );
  patch(Array, 'from', (original) =>
    function (this: unknown, ...args: unknown[]) {
      const result = original.apply(this, args) as unknown[];
      visited += result.length;
      return result;
    }
  );
  let counted: number;
  try {
    visited = 0;
    run();
    counted = visited;
  } finally {
    for (let i = restore.length - 1; i >= 0; i--) restore[i]();
  }
  return counted;
}

describe('entityMap — collection queries are lazily derived (13.5.0)', () => {
  it('a single-entity update does not rebuild the collection', () => {
    // updateSignals() used to run on EVERY mutation and do three full copies of
    // the collection: Array.from(values), Array.from(keys), new Map(storage).
    // That made updateOne O(size) — 2.8ms on a 50k collection — which defeats
    // the point of Map-backed storage whose write is O(1).
    //
    // Counted, not timed (v16 integration slice 8d): a 0.05 ms per-update
    // bound pinned the same complexity but failed under machine load. The
    // same 200 updates must visit exactly as many elements at 20,000 rows as
    // at 2,000; any rebuild or copy of the collection scales with its size.
    const updates = (size: number): number => {
      const tree = signalTree({
        rows: entityMap<{ id: number; v: number }, number>({
          selectId: (r) => r.id,
        }),
      });
      try {
        tree.$.rows.setAll(
          Array.from({ length: size }, (_, i) => ({ id: i, v: 0 }))
        );
        const visited = countIteratedElements(() => {
          for (let i = 0; i < 200; i++) tree.$.rows.updateOne(i, { v: 1 });
        });
        expect(tree.$.rows.byId(5)?.().v).toBe(1);
        return visited;
      } finally {
        tree.destroy();
      }
    };
    const small = updates(2000);
    expect(updates(20000)).toBe(small);
    expect(small).toBeLessThan(2000);
    // Control: the counter sees a copy, so equality is not vacuous. Two
    // entries iterated and two copied, then three mapped.
    const map = new Map([
      [1, 1],
      [2, 2],
    ]);
    const list = [1, 2, 3];
    expect(
      countIteratedElements(() => {
        Array.from(map.values());
        list.map((n) => n);
      })
    ).toBe(2 + 2 + 3);
  });

  it('repeated collection reads between writes are cached', () => {
    const tree = signalTree({
      rows: entityMap<{ id: number }, number>({ selectId: (r) => r.id }),
    });
    tree.$.rows.setAll(Array.from({ length: 20000 }, (_, i) => ({ id: i })));

    // Identity, not wall-clock time (v16 integration slice 8c): a 5 ms bound
    // on 500 reads failed under machine load. A cached read returns the very
    // array it returned before; any rebuild — the O(size) work this guards
    // against — returns a new one. Exact, and independent of the machine.
    const first = tree.$.rows.all();
    for (let i = 0; i < 500; i++) expect(tree.$.rows.all()).toBe(first);
    // Control: a write invalidates the cache, so identity is not vacuous.
    tree.$.rows.addOne({ id: 20000 });
    const next = tree.$.rows.all();
    expect(next).not.toBe(first);
    expect(next).toHaveLength(20001);
    expect(tree.$.rows.all()).toBe(next);
  });

  it('map() stays a snapshot, not a live view', () => {
    const tree = signalTree({
      rows: entityMap<{ id: number; v: string }, number>({
        selectId: (r) => r.id,
      }),
    });
    tree.$.rows.setAll([{ id: 1, v: 'a' }]);

    const held = tree.$.rows.asMap();
    tree.$.rows.updateOne(1, { v: 'z' });

    expect(held.get(1)?.v).toBe('a');
    expect(tree.$.rows.asMap().get(1)?.v).toBe('z');
  });
});

describe('entityMap — tombstoned subjects stay distinct from later key reuse', () => {
  it('does not let a held node revive when the same key is reused by a new subject', () => {
    const tree = signalTree({
      rows: entityMap<{ id: number; v: string }, number>({
        selectId: (r) => r.id,
      }),
    });
    tree.$.rows.setAll([{ id: 1, v: 'a' }]);

    const held = tree.$.rows.byId(1);
    expect(held?.().v).toBe('a');

    tree.$.rows.removeOne(1);
    expect(held?.()).toBeUndefined(); // gone, correctly

    tree.$.rows.addOne({ id: 1, v: 'b' });
    expect(held?.()).toBeUndefined(); // tombstoned subject stays absent
    expect(tree.$.rows.byId(1)?.().v).toBe('b'); // fresh lookup sees the new subject
  });

  it('a held FIELD reference also stays absent across key reuse by a new subject', () => {
    const tree = signalTree({
      rows: entityMap<{ id: number; v: string }, number>({
        selectId: (r) => r.id,
      }),
    });
    tree.$.rows.setAll([{ id: 1, v: 'a' }]);

    const field = (tree.$.rows.byId(1) as unknown as { v: () => string }).v;
    expect(field()).toBe('a');

    tree.$.rows.removeOne(1);
    tree.$.rows.addOne({ id: 1, v: 'b' });

    expect(field()).toBeUndefined();
    expect(tree.$.rows.byId(1)?.v()).toBe('b');
  });

  it('resolves internal acquired handles by subject, not by reused key address', () => {
    const rows = makeRows() as InternalHandleRows;
    rows.addOne({ id: 1, v: 5 });
    const handle = acquireExistingHandle(rows, 1);

    rows.removeOne(1);
    rows.addOne({ id: 1, v: 7 });

    expect(rows.byId(1)?.v()).toBe(7);
    // `state: 'missing'` is ZERO-OWNER RETIREMENT, not drift. `makeRows()` builds
    // a bare tree — no enhancers, so no restoration authority — and the
    // retirement boundary therefore forgets the subject entirely: value backing,
    // entity signal, lifetime record and revision. There is no tombstone left to
    // report, so resolution reports the handle as unrecognised.
    //
    // The CLAIM of this row is untouched, and is the whole point: the handle
    // still resolves to SUBJECT 1 rather than following the reused key to the
    // fresh subject. Isolation never depended on the tombstone — see
    // `entity-lifetime-ledger-null.spec.ts`.
    expect(rows.__resolveEntityHandleForTesting(handle)).toEqual({
      state: 'missing',
      subjectId: 1,
      acquiredRevision: 0,
    });
  });

  it('keeps acquired handles isolated when setAll reuses a tombstoned key', () => {
    const rows = makeRows() as InternalHandleRows;
    rows.setAll([{ id: 1, v: 5 }]);
    const held = rows.byId(1);
    const handle = acquireExistingHandle(rows, 1);

    rows.removeOne(1);
    rows.setAll([{ id: 1, v: 9 }]);

    expect(rows.byId(1)?.v()).toBe(9);
    expect(held?.()).toBeUndefined();
    // Same zero-owner retirement as the row above — see the note there.
    expect(rows.__resolveEntityHandleForTesting(handle)).toEqual({
      state: 'missing',
      subjectId: 1,
      acquiredRevision: 0,
    });
  });
});
