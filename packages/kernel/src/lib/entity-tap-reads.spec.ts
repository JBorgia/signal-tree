import { afterEach, describe, expect, it } from 'vitest';

import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';

/**
 * v16 slice 8f: a tap reads the collection as it is when it runs.
 *
 * Ported from v16 integrate/v16-slice8f (df784a38); `transact` is v15's
 * `transaction`.
 *
 * A tap runs inside its write. Inside a grouped write — a transaction, an
 * undo, a redo, a jump, a rollback — the cached projections (`all()`,
 * `count()`, `where()`, ...) hear of the write only when the group ends, so a
 * tap read through them saw the collection as it was before the group:
 * `removeOne('a')`'s tap read `all()` as ['a', 'b'] inside `transact` (on
 * present collections too, and on v15 12187613 alike). While a tap runs, a
 * projection is now read fresh. Each tap here checks its reads against each
 * other and against the change it reports.
 */

type Row = { id: string; n: number };
type Cell<T> = () => T;
type Rows = {
  all: Cell<Row[]>;
  count: Cell<number>;
  ids: Cell<string[]>;
  empty: Cell<boolean>;
  has(id: string): Cell<boolean>;
  where(predicate: (row: Row) => boolean): Cell<Row[]>;
  find(predicate: (row: Row) => boolean): Cell<Row | undefined>;
  byId(id: string): (() => Row | undefined) | undefined;
  addOne(row: Row): string;
  removeOne(id: string): void;
  changeId(from: string, to: string): void;
  tap(handlers: {
    onAdd?: (row: Row, id: string) => void;
    onRemove?: (id: string, row: Row) => void;
  }): () => void;
};
type Tree = {
  $: ((value?: unknown) => unknown) & {
    a: { rows: Rows; s: (value?: number) => number };
    count: (value?: number) => number;
  };
  undo(): void;
  redo(): void;
  jumpTo(index: number): void;
  getCurrentIndex(): number;
  transaction(run: () => void): { rollback(): void };
  destroy(): void;
};

const trees: Tree[] = [];
afterEach(() => {
  for (const tree of trees.splice(0)) tree.destroy();
});
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const A = { id: 'a', n: 0 };
const B = { id: 'b', n: 1 };
const Z = { id: 'z', n: 9 };
const every = (row: Row) => row.n >= 0;

const build = (): Tree => {
  const tree = signalTree(
    { a: { rows: entityMap<Row, string>(), s: 0 }, count: 0 },
    { enhancers: [transactions(), restoration()] as never }
  ) as unknown as Tree;
  trees.push(tree);
  tree.$.a.rows.addOne(A);
  tree.$.a.rows.addOne(B);
  return tree;
};

/** Read every projection once, so each is cached before the write. */
const warm = (rows: Rows) => {
  rows.all();
  rows.count();
  rows.ids();
  rows.empty();
  rows.where(every)();
  rows.find(every)();
};

/** Taps that check what they read; returns the disagreements found. */
const watch = (rows: Rows) => {
  const found: string[] = [];
  let taps = 0;
  const check = (event: string, id: string, expectPresent?: boolean) => {
    taps++;
    const all = rows.all();
    const inAll = all.some((row) => row.id === id);
    const reads = {
      count: rows.count() === all.length,
      ids:
        JSON.stringify(rows.ids()) === JSON.stringify(all.map((row) => row.id)),
      empty: rows.empty() === (all.length === 0),
      has: rows.has(id)() === inAll,
      byId: (rows.byId(id) !== undefined) === inAll,
      where: rows.where(every)().length === all.length,
      find: (rows.find(every)() !== undefined) === all.length > 0,
      change: expectPresent === undefined || inAll === expectPresent,
    };
    for (const [name, ok] of Object.entries(reads))
      if (!ok) found.push(`${event} ${id}: ${name}`);
  };
  return {
    found,
    taps: () => taps,
    start: (present: boolean) =>
      rows.tap({
        onAdd: (_row, id) => check('add', id, present ? true : undefined),
        onRemove: (id) => check('remove', id, false),
      }),
  };
};

describe('a tap reads a present collection as it is (v16 8f)', () => {
  const cases: Record<string, (tree: Tree) => Promise<void> | void> = {
    'removeOne inside transact': (tree) => {
      tree.transaction(() => tree.$.a.rows.removeOne('a'));
    },
    'undo of a removal': async (tree) => {
      tree.undo();
    },
    'redo of a removal': async (tree) => {
      tree.undo();
      await flush();
      tree.redo();
    },
    'jumpTo before a removal': async (tree) => {
      tree.jumpTo(tree.getCurrentIndex() - 1);
    },
    'rollback of an add': async (tree) => {
      const pending = tree.transaction(() => tree.$.a.rows.addOne(Z));
      await flush();
      pending.rollback();
    },
  };
  // v15 has 66144140 ("taps fire symmetrically for the changes a replay
  // applies"), so a replay that restores a row taps it, and these cases run
  // as ordinary carriers (v16 marks two `it.fails` until its carry lands).
  for (const [name, run] of Object.entries(cases))
    it(name, async () => {
      const tree = build();
      const rows = tree.$.a.rows;
      await flush();
      undoable(() => tree.$.count(1));
      await flush();
      undoable(() => rows.removeOne('b'));
      await flush();
      warm(rows);
      const seen = watch(rows);
      seen.start(true);
      await run(tree);
      await flush();
      expect(seen.taps()).toBeGreaterThan(0);
      expect(seen.found).toEqual([]);
    });
});

describe('a tap reads an absent collection as it is (v16 8f)', () => {
  /** Omit `a`, then re-add it with Z through an undoable write. */
  const setUp = async (tree: Tree) => {
    await flush();
    undoable(() => tree.$.count(1));
    await flush();
    tree.$({ count: 1 });
    await flush();
    undoable(() => tree.$.a.rows.addOne(Z));
    await flush();
  };
  const cases: Record<string, (tree: Tree) => Promise<void> | void> = {
    undo: (tree) => tree.undo(),
    redo: async (tree) => {
      tree.undo();
      await flush();
      tree.redo();
    },
    jumpTo: (tree) => tree.jumpTo(tree.getCurrentIndex() - 1),
    'a re-adding write inside transact': async (tree) => {
      tree.undo();
      await flush();
      tree.transaction(() => tree.$.a.rows.addOne({ id: 'y', n: 2 }));
    },
  };
  for (const [name, run] of Object.entries(cases))
    it(name, async () => {
      const tree = build();
      const rows = tree.$.a.rows;
      await setUp(tree);
      warm(rows);
      const seen = watch(rows);
      seen.start(false);
      await run(tree);
      await flush();
      expect(seen.taps()).toBeGreaterThan(0);
      expect(seen.found).toEqual([]);
    });

  it('rollback of a re-adding write', async () => {
    const tree = build();
    const rows = tree.$.a.rows;
    await flush();
    tree.$({ count: 0 });
    await flush();
    const pending = tree.transaction(() => rows.addOne(Z));
    await flush();
    warm(rows);
    const seen = watch(rows);
    seen.start(false);
    pending.rollback();
    await flush();
    expect(seen.taps()).toBeGreaterThan(0);
    expect(seen.found).toEqual([]);
  });
});

describe('what a tap reads stays reactive (v16 8f)', () => {
  it('a derived first computed inside a tap follows later writes', async () => {
    const tree = build();
    const rows = tree.$.a.rows;
    let snapshot: unknown;
    let taken = false;
    rows.tap({
      onAdd: () => {
        if (taken) return;
        taken = true;
        snapshot = tree.$();
      },
    });
    tree.transaction(() => rows.addOne(Z));
    await flush();
    expect(snapshot).toEqual({
      a: { rows: { all: [A, B, Z] }, s: 0 },
      count: 0,
    });
    rows.removeOne('a');
    expect(tree.$()).toEqual({ a: { rows: { all: [B, Z] }, s: 0 }, count: 0 });
    expect(rows.all()).toEqual([B, Z]);
  });
});

describe('ids and held cells inside a tap (v16 8f review)', () => {
  it('ids() reads the keys, after changeId too', () => {
    const tree = build();
    const rows = tree.$.a.rows;
    rows.changeId('a', 'a2');
    rows.ids();
    let seen: string[] = [];
    rows.tap({
      onAdd: () => {
        seen = rows.ids();
      },
    });
    tree.transaction(() => rows.addOne({ id: 'q', n: 3 }));
    expect(seen).toEqual(['a2', 'b', 'q']);
    expect(rows.ids()).toEqual(['a2', 'b', 'q']);
  });

  it('a cell held from before the tap keeps its cache until the group ends', async () => {
    // Documented: a tap reads fresh through the collection (`rows.all()`), not
    // through a cell it obtained earlier (`const all = rows.all`). Making held
    // cells fresh would need the location runtime to settle groups early.
    const tree = build();
    const rows = tree.$.a.rows;
    const held = rows.all;
    held();
    let seen: unknown[] = [];
    rows.tap({
      onRemove: () => {
        seen = [held().map((row) => row.id), rows.all().map((row) => row.id)];
      },
    });
    tree.transaction(() => rows.removeOne('a'));
    await flush();
    expect(seen).toEqual([['a', 'b'], ['b']]);
    expect(held()).toEqual([B]);
  });
});
