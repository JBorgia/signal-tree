import { afterEach, describe, expect, it } from 'vitest';

import { createReactiveTestRealization } from '../reactive-test-realization';
import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';
import { getEntityProjectionSeed } from './internals/entity-projection-seed';
import {
  beginStructuralWrite,
  endStructuralWrite,
  structuralWrites,
} from './internals/member-membership';
import { createSignalTreeFactory } from './signal-tree';
import type { InterceptHandlers, TapHandlers } from './types';

/**
 * v16 integration slice 8e (2): an entity collection under an omitted member.
 *
 * Owner decision (2026-10-07): the same rules as plain values.
 * - Reads: a collection under an omitted member reads as an absent, empty
 *   collection (`all()` is [], `byId()` undefined, `count()` 0, ...), and held
 *   consumers follow the omission and a re-add.
 * - Writes: a row-adding write re-adds the path, carrying only the written
 *   rows; retained rows never resurface. A write that names a row refuses,
 *   as on an empty collection.
 * - Reversal: undo, redo, jumpTo and rollback make it absent again.
 *
 * Laws: "DORMANT STORAGE MUST NOT SUPPLY THE REACTIVATED VALUE"
 * (`whole-value-membership.spec.ts` 18); "a write must not vanish silently"
 * (`nested-absence-independent.spec.ts`). Before 8e the collection's own
 * methods read and wrote its retained rows (README, 8d: "Not yet for entity
 * collections").
 */

const trees: Array<{ destroy(): void }> = [];
afterEach(() => {
  for (const tree of trees.splice(0)) tree.destroy();
});
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const realization = createReactiveTestRealization();
const reactiveTree = createSignalTreeFactory(realization);
const computed = realization.locations.createDerived;

type Row = { id: string; n: number };
type Cell<T> = () => T;
type Node = {
  (): Row | undefined;
  (value: Row | ((row: Row) => Row)): void;
  n: { (): number | undefined; (value: number): void };
};
type Rows = {
  all: Cell<Row[]>;
  count: Cell<number>;
  ids: Cell<string[]>;
  asMap: Cell<ReadonlyMap<string, Row>>;
  empty: Cell<boolean>;
  activeEntity: Cell<Row | undefined>;
  has(id: string): Cell<boolean>;
  where(predicate: (row: Row) => boolean): Cell<Row[]>;
  find(predicate: (row: Row) => boolean): Cell<Row | undefined>;
  byId(id: string): Node | undefined;
  byIdOrFail(id: string): Node;
  setActiveId(id: string | undefined): void;
  addOne(row: Row): string;
  prependOne(row: Row): string;
  addMany(
    rows: Row[],
    opts?: { mode?: 'strict' | 'skip' | 'overwrite' }
  ): string[];
  prependMany(rows: Row[]): string[];
  upsertOne(row: Row): string;
  upsertMany(rows: Row[]): string[];
  setAll(rows: Row[]): void;
  clear(): void;
  updateOne(id: string, changes: Partial<Row>): void;
  replaceOne(id: string, row: Row): void;
  updateMany(ids: string[], changes: Partial<Row>): void;
  updateWhere(predicate: (row: Row) => boolean, changes: Partial<Row>): number;
  removeOne(id: string): void;
  removeMany(ids: string[]): void;
  removeWhere(predicate: (row: Row) => boolean): number;
  changeId(from: string, to: string): void;
  tap(handlers: TapHandlers<Row, string>): () => void;
  intercept(handlers: InterceptHandlers<Row, string>): () => void;
};
type Tree = {
  $: ((value?: unknown) => unknown) & {
    count: (value?: number) => number;
    a: ((value?: unknown) => unknown) & {
      rows: Rows;
      s: (v?: number) => number;
    };
  };
  undo(): void;
  redo(): void;
  jumpTo(index: number): void;
  getCurrentIndex(): number;
  transact(run: () => void): { rollback(): void };
  destroy(): void;
};

const A = { id: 'a', n: 0 };
const B = { id: 'b', n: 1 };
const Z = { id: 'z', n: 9 };
const build = (enhancers: unknown[] = [], reactive = false): Tree => {
  const make = reactive ? reactiveTree : signalTree;
  // Positions give the collection the transition source `stored` reads.
  const tree = make(
    { a: { rows: entityMap<Row, string>(), s: 0 }, count: 0 },
    {
      enhancers: enhancers as never,
      capabilities: ['causal-runtime', 'position-topology'] as never,
    }
  ) as unknown as Tree;
  trees.push(tree);
  tree.$.a.rows.setAll([A, B]);
  return tree;
};
/** Omit `a`, and the collection with it, by an ordinary whole value. */
const omit = (tree: Tree) => tree.$({ count: tree.$.count() });
/** What the collection physically holds, whatever its presence. */
const stored = (rows: Rows) =>
  (
    rows as unknown as {
      __prepareTransitionTarget: {
        readSource(): { subjects: readonly { value: unknown }[] };
      };
    }
  ).__prepareTransitionTarget
    .readSource()
    .subjects.map(({ value }) => value);
const byN = (row: Row) => row.n >= 0;

const reads = (rows: Rows) => ({
  all: rows.all(),
  count: rows.count(),
  ids: rows.ids(),
  asMap: [...rows.asMap()],
  empty: rows.empty(),
  has: rows.has('a')(),
  where: rows.where(byN)(),
  find: rows.find(byN)(),
  byId: rows.byId('a'),
  activeEntity: rows.activeEntity(),
});
const ABSENT = {
  all: [],
  count: 0,
  ids: [],
  asMap: [],
  empty: true,
  has: false,
  where: [],
  find: undefined,
  byId: undefined,
  activeEntity: undefined,
};

describe('reads: an absent, empty collection', () => {
  for (const [shape, hide] of [
    ['under an omitted member', omit],
    ['omitted itself', (tree: Tree) => tree.$.a({ s: 0 })],
  ] as const)
    it(`held and detached handles read it absent (${shape})`, () => {
      const tree = build();
      const held = tree.$.a.rows;
      held.setActiveId('a');
      const row = held.byId('a') as Node;
      hide(tree);
      for (const rows of [held, tree.$.a.rows]) {
        expect(reads(rows)).toEqual(ABSENT);
        expect(() => rows.byIdOrFail('a')).toThrow(
          /^Entity with id a not found$/
        );
      }
      expect(row()).toBeUndefined();
      expect(row.n()).toBeUndefined();
      // Retained, never supplied.
      expect(stored(held)).toEqual([A, B]);
    });

  it("link's projection seed is empty while the collection is absent", () => {
    const tree = build();
    const rows = tree.$.a.rows;
    expect(getEntityProjectionSeed(rows)?.map(({ row }) => row)).toEqual([
      A,
      B,
    ]);
    omit(tree);
    expect(getEntityProjectionSeed(rows)).toEqual([]);
  });

  it('held consumers follow the omission and a re-add', () => {
    const tree = build([], true);
    const rows = tree.$.a.rows;
    const row = rows.byId('a') as Node;
    const view = computed(() => [
      rows.all(),
      rows.count(),
      rows.has('a')(),
      row(),
      row.n(),
    ]);
    expect(view()).toEqual([[A, B], 2, true, A, 0]);
    omit(tree);
    expect(view()).toEqual([[], 0, false, undefined, undefined]);
    // A whole value re-adds `a` and supplies the collection's rows.
    tree.$({ a: { rows: [A], s: 0 }, count: 0 });
    expect(view()).toEqual([[A], 1, true, A, 0]);
  });

  it('every collection one whole value hides or re-adds wakes its consumers', () => {
    // Both wake-ups are deferred inside the same structural write.
    const tree = reactiveTree({
      a: {
        rows: entityMap<Row, string>(),
        more: entityMap<Row, string>(),
        s: 0,
      },
      count: 0,
    }) as unknown as Tree & { $: { a: { more: Rows } } };
    trees.push(tree);
    const { rows, more } = tree.$.a;
    rows.setAll([A]);
    more.setAll([B]);
    const view = computed(() => [rows.all(), more.all()]);
    expect(view()).toEqual([[A], [B]]);
    omit(tree);
    expect(view()).toEqual([[], []]);
    tree.$({ a: { rows: [B], more: [A], s: 0 }, count: 0 });
    expect(view()).toEqual([[B], [A]]);
  });
});

describe('writes: row-adding writes re-add the path with only their rows', () => {
  const writes: Array<[string, (rows: Rows) => void, Row[]]> = [
    ['addOne', (rows) => rows.addOne(Z), [Z]],
    ['prependOne', (rows) => rows.prependOne(Z), [Z]],
    ['addMany', (rows) => rows.addMany([Z, A]), [Z, A]],
    ['prependMany', (rows) => rows.prependMany([Z]), [Z]],
    [
      'upsertOne (a retained id)',
      (rows) => rows.upsertOne({ id: 'a', n: 5 }),
      [{ id: 'a', n: 5 }],
    ],
    ['upsertMany', (rows) => rows.upsertMany([Z]), [Z]],
    ['setAll', (rows) => rows.setAll([Z]), [Z]],
    ['clear', (rows) => rows.clear(), []],
  ];
  for (const [name, write, after] of writes)
    it(name, () => {
      const tree = build();
      const rows = tree.$.a.rows;
      omit(tree);
      write(rows);
      expect(tree.$()).toEqual({ a: { rows: { all: after } }, count: 0 });
      expect(rows.all()).toEqual(after);
      // The retained rows are gone, not hidden.
      expect(stored(rows)).toEqual(after);
      expect(tree.$.a.s()).toBeUndefined();
    });

  it('a held consumer sees the re-adding write', () => {
    const tree = build([], true);
    const rows = tree.$.a.rows;
    const whole = computed(() => JSON.stringify(tree.$()));
    const all = computed(() => rows.all());
    omit(tree);
    expect([whole(), all()]).toEqual(['{"count":0}', []]);
    rows.addOne(Z);
    expect([whole(), all()]).toEqual([
      '{"a":{"rows":{"all":[{"id":"z","n":9}]}},"count":0}',
      [Z],
    ]);
  });
});

describe('writes that name a row refuse, as on an empty collection', () => {
  const refusals: Array<[string, (rows: Rows) => unknown]> = [
    ['updateOne', (rows) => rows.updateOne('a', { n: 5 })],
    ['replaceOne', (rows) => rows.replaceOne('a', { id: 'a', n: 5 })],
    ['updateMany', (rows) => rows.updateMany(['a'], { n: 5 })],
    ['removeOne', (rows) => rows.removeOne('a')],
    ['removeMany', (rows) => rows.removeMany(['a'])],
    ['changeId', (rows) => rows.changeId('a', 'q')],
  ];
  for (const [name, write] of refusals)
    it(`${name} refuses and changes nothing`, () => {
      const tree = build();
      const rows = tree.$.a.rows;
      omit(tree);
      expect(() => write(rows)).toThrow(/^Entity with id a not found$/);
      expect(tree.$()).toEqual({ count: 0 });
      expect(stored(rows)).toEqual([A, B]);
    });

  it('updateWhere and removeWhere match nothing', () => {
    const tree = build();
    const rows = tree.$.a.rows;
    omit(tree);
    expect(rows.updateWhere(byN, { n: 5 })).toBe(0);
    expect(rows.removeWhere(byN)).toBe(0);
    expect(tree.$()).toEqual({ count: 0 });
    expect(stored(rows)).toEqual([A, B]);
  });

  it('a held row and its field refuse', () => {
    const tree = build();
    const row = tree.$.a.rows.byId('a') as Node;
    omit(tree);
    expect(() => row({ id: 'a', n: 5 })).toThrow(/not found/);
    expect(() => row.n(5)).toThrow(/not found/);
    expect(tree.$()).toEqual({ count: 0 });
    expect(stored(tree.$.a.rows)).toEqual([A, B]);
  });
});

const historyOrders = {
  'restoration alone': () => [restoration()],
  'transactions first': () => [transactions(), restoration()],
  'restoration first': () => [restoration(), transactions()],
};
const rollbackOrders = {
  'transactions alone': () => [transactions()],
  'transactions first': () => [transactions(), restoration()],
  'restoration first': () => [restoration(), transactions()],
};

/** Hide the collection by omitting it from `a`, which stays present. */
const omitItself = (tree: Tree) => tree.$.a({ s: tree.$.a.s() });

describe('reversal of a re-adding collection write makes it absent again', () => {
  for (const [order, enhancers] of Object.entries(historyOrders))
    it(`undo, redo and jumpTo (${order})`, async () => {
      const tree = build(enhancers(), true);
      const rows = tree.$.a.rows;
      const view = computed(() => [rows.all(), JSON.stringify(tree.$())]);
      await flush();
      undoable(() => tree.$.count(1));
      await flush();
      omit(tree);
      await flush();
      undoable(() => rows.addOne(Z));
      await flush();
      const present = [
        [Z],
        '{"a":{"rows":{"all":[{"id":"z","n":9}]}},"count":1}',
      ];
      const absent = [[], '{"count":1}'];
      expect(view()).toEqual(present);
      tree.undo();
      expect(view()).toEqual(absent);
      // Physically as before the write: retained rows, hidden.
      expect(stored(rows)).toEqual([A, B]);
      tree.redo();
      expect(view()).toEqual(present);
      const index = tree.getCurrentIndex();
      tree.jumpTo(index - 1);
      expect(view()).toEqual(absent);
      tree.jumpTo(index);
      expect(view()).toEqual(present);
    });

  for (const [order, enhancers] of Object.entries(rollbackOrders))
    it(`rollback (${order})`, async () => {
      const tree = build(enhancers(), true);
      const rows = tree.$.a.rows;
      const view = computed(() => [rows.all(), JSON.stringify(tree.$())]);
      await flush();
      omit(tree);
      await flush();
      const pending = tree.transact(() => rows.addOne(Z));
      await flush();
      expect(view()).toEqual([
        [Z],
        '{"a":{"rows":{"all":[{"id":"z","n":9}]}},"count":0}',
      ]);
      pending.rollback();
      await flush();
      expect(view()).toEqual([[], '{"count":0}']);
      expect(stored(rows)).toEqual([A, B]);
    });
});

describe('reversal of a re-adding write to a collection omitted itself (v16 8e review)', () => {
  // `a` stays present; only the collection was omitted. The write re-adds
  // the collection alone, and reversing it must omit it again.
  const present = [[Z], { a: { rows: { all: [Z] }, s: 0 }, count: 1 }];
  const absent = [[], { a: { s: 0 }, count: 1 }];
  for (const [order, enhancers] of Object.entries(historyOrders))
    it(`undo, redo and jumpTo (${order})`, async () => {
      const tree = build(enhancers(), true);
      const rows = tree.$.a.rows;
      const view = computed(() => [rows.all(), tree.$()]);
      await flush();
      undoable(() => tree.$.count(1));
      await flush();
      omitItself(tree);
      await flush();
      undoable(() => rows.addOne(Z));
      await flush();
      expect(view()).toEqual(present);
      tree.undo();
      expect(view()).toEqual(absent);
      expect(stored(rows)).toEqual([A, B]);
      tree.redo();
      expect(view()).toEqual(present);
      const index = tree.getCurrentIndex();
      tree.jumpTo(index - 1);
      expect(view()).toEqual(absent);
      tree.jumpTo(index);
      expect(view()).toEqual(present);
    });

  for (const [order, enhancers] of Object.entries(rollbackOrders))
    it(`rollback (${order})`, async () => {
      const tree = build(enhancers(), true);
      const rows = tree.$.a.rows;
      const view = computed(() => [rows.all(), tree.$()]);
      tree.$.count(1);
      await flush();
      omitItself(tree);
      await flush();
      const pending = tree.transact(() => rows.addOne(Z));
      await flush();
      expect(view()).toEqual(present);
      pending.rollback();
      await flush();
      expect(view()).toEqual(absent);
      expect(stored(rows)).toEqual([A, B]);
    });
});

describe('redo and jumpTo forward of a re-adding write that reuses a retained id (v16 8e review)', () => {
  // The write removes the retained rows first, so it adds a new subject for
  // an id the collection held. Replaying it forward finds the collection
  // while it is still hidden.
  const writes: Record<string, [(rows: Rows) => unknown, Row[]]> = {
    upsertOne: [
      (rows) => rows.upsertOne({ id: 'a', n: 5 }),
      [{ id: 'a', n: 5 }],
    ],
    addMany: [
      (rows) => rows.addMany([Z, { id: 'a', n: 5 }]),
      [Z, { id: 'a', n: 5 }],
    ],
  };
  for (const [name, [write, added]] of Object.entries(writes))
    for (const [order, enhancers] of Object.entries(historyOrders))
      it(`${name} (${order})`, async () => {
        const tree = build(enhancers(), true);
        const rows = tree.$.a.rows;
        const view = computed(() => [rows.all(), tree.$()]);
        await flush();
        undoable(() => tree.$.count(1));
        await flush();
        omit(tree);
        await flush();
        undoable(() => write(rows));
        await flush();
        const present = [added, { a: { rows: { all: added } }, count: 1 }];
        const absent = [[], { count: 1 }];
        expect(view()).toEqual(present);
        tree.undo();
        expect(view()).toEqual(absent);
        expect(stored(rows)).toEqual([A, B]);
        tree.redo();
        expect(view()).toEqual(present);
        const index = tree.getCurrentIndex();
        tree.jumpTo(index - 1);
        expect(view()).toEqual(absent);
        tree.jumpTo(index);
        expect(view()).toEqual(present);
      });
});

describe('reads during a whole value agree with each other (v16 8e review)', () => {
  // A tap runs inside the whole value's row writes. Whatever the collection's
  // presence at that moment, its row reads and its projections must give one
  // answer.
  it('a tap during a whole value that re-adds the collection', () => {
    const tree = build();
    const rows = tree.$.a.rows;
    const disagreements: string[] = [];
    const check = (id: string) => {
      const has = rows.has(id)();
      const byId = rows.byId(id) !== undefined;
      const inAll = rows.all().some((row) => row.id === id);
      if (has !== byId || has !== inAll || rows.all().length !== rows.count())
        disagreements.push(`${id}: has ${has}, byId ${byId}, all ${inAll}`);
    };
    const each = (id: string) => ['a', 'b', id].forEach(check);
    rows.tap({
      onAdd: (_row, id) => each(id),
      onUpdate: (id) => each(id),
      onRemove: (id) => each(id),
    });
    omit(tree);
    tree.$({ a: { rows: [B, Z], s: 0 }, count: 0 });
    expect(disagreements).toEqual([]);
    expect(rows.all()).toEqual([B, Z]);
  });

  it("another tree's absent collection reads absent while a reversal is applied", async () => {
    // A reversal reads its own tree's hidden rows physically; nothing else.
    const tree = build([restoration()]);
    const other = build();
    omit(other);
    const seen: unknown[] = [];
    const look = () => seen.push(other.$.a.rows.byId('a'));
    tree.$.a.rows.tap({ onAdd: look, onRemove: look });
    await flush();
    undoable(() => {
      tree.$.count(1);
      tree.$.a.rows.addOne(Z);
    });
    await flush();
    // Not only a tap (which reads absent-aware anyway, 8f): a location's
    // listener runs inside the reversal's physical-rows window too.
    const listen = (
      tree.$.count as unknown as {
        subscribe(listener: () => void): () => void;
      }
    ).subscribe(look);
    seen.length = 0;
    tree.undo();
    listen();
    expect(seen.length).toBeGreaterThan(1);
    expect(seen.every((row) => row === undefined)).toBe(true);
  });
});

describe('a row-adding write with invalid input changes nothing (v16 8e review)', () => {
  // The write would throw on an empty collection. It must throw before the
  // retained rows are removed, and record nothing.
  const invalid = undefined as unknown as Row;
  const writes: Array<[string, (rows: Rows) => unknown]> = [
    ['addOne', (rows) => rows.addOne(invalid)],
    ['prependOne', (rows) => rows.prependOne(invalid)],
    ['upsertOne', (rows) => rows.upsertOne(invalid)],
    ['addMany', (rows) => rows.addMany([Z, invalid])],
    ['prependMany', (rows) => rows.prependMany([Z, invalid])],
    ['upsertMany', (rows) => rows.upsertMany([Z, invalid])],
    ['setAll', (rows) => rows.setAll([Z, invalid])],
  ];
  for (const [name, write] of writes)
    it(name, async () => {
      const tree = build([restoration()]);
      const rows = tree.$.a.rows;
      await flush();
      omit(tree);
      await flush();
      const index = tree.getCurrentIndex();
      expect(() => write(rows)).toThrow();
      await flush();
      expect(tree.$()).toEqual({ count: 0 });
      expect(reads(rows)).toEqual(ABSENT);
      expect(stored(rows)).toEqual([A, B]);
      expect(tree.getCurrentIndex()).toBe(index);
    });
});

describe('a re-adding write is intercepted before anything changes (v16 8f)', () => {
  // 8e removed the retained rows first and intercepted after, so a blocked
  // write left the collection absent and empty and its removal in history;
  // undoing that re-added the path with the old rows (8e's documented edge,
  // flipped here by the owner's decision). The write is now validated and
  // intercepted as on an empty collection before the rows are removed: a
  // block changes nothing, and history holds nothing for it.
  const blockedWrites: Array<[string, (rows: Rows) => unknown]> = [
    ['addOne', (rows) => rows.addOne(Z)],
    ['prependOne', (rows) => rows.prependOne(Z)],
    ['upsertOne', (rows) => rows.upsertOne(Z)],
    ['addMany', (rows) => rows.addMany([{ id: 'y', n: 2 }, Z])],
    ['prependMany', (rows) => rows.prependMany([{ id: 'y', n: 2 }, Z])],
    ['upsertMany', (rows) => rows.upsertMany([{ id: 'y', n: 2 }, Z])],
    ['setAll', (rows) => rows.setAll([{ id: 'y', n: 2 }, Z])],
  ];
  for (const [name, write] of blockedWrites)
    it(`${name}: a blocked write changes nothing`, async () => {
      const tree = build([restoration()]);
      const rows = tree.$.a.rows;
      await flush();
      undoable(() => omit(tree));
      await flush();
      const index = tree.getCurrentIndex();
      rows.intercept({
        onAdd: (row, ctx) => {
          if (row.id === 'z') ctx.block('no z');
        },
      });
      expect(() => undoable(() => write(rows))).toThrow(
        /^Cannot add entity: no z$/
      );
      await flush();
      expect(tree.$()).toEqual({ count: 0 });
      expect(reads(rows)).toEqual(ABSENT);
      expect(stored(rows)).toEqual([A, B]);
      expect(tree.getCurrentIndex()).toBe(index);
      tree.undo();
      expect(tree.$()).toEqual({
        a: { rows: { all: [A, B] }, s: 0 },
        count: 0,
      });
    });

  it('a later copy of upsertMany blocked by onUpdate changes nothing', async () => {
    const tree = build([restoration()]);
    const rows = tree.$.a.rows;
    await flush();
    undoable(() => omit(tree));
    await flush();
    rows.intercept({
      onUpdate: (_id, _changes, ctx) => ctx.block('no update'),
    });
    expect(() => rows.upsertMany([Z, { id: 'z', n: 10 }])).toThrow(
      /^Cannot update entity: no update$/
    );
    await flush();
    expect(tree.$()).toEqual({ count: 0 });
    expect(stored(rows)).toEqual([A, B]);
  });

  it('interceptors run as on an empty collection, once per applied copy', () => {
    // The same calls, on a present empty collection and on an absent one.
    const run = (hide: boolean) => {
      const tree = build();
      const rows = tree.$.a.rows;
      if (hide) omit(tree);
      else rows.clear();
      const calls: string[] = [];
      rows.intercept({
        onAdd: (row, ctx) => {
          calls.push(`add ${row.id}:${row.n}`);
          ctx.transform({ ...row, n: row.n + 100 });
        },
        onUpdate: (id, changes, ctx) => {
          calls.push(`update ${String(id)}:${changes.n}`);
          ctx.transform({ ...changes, n: (changes.n ?? 0) + 1000 });
        },
      });
      rows.addMany(
        [
          { id: 'x', n: 1 },
          { id: 'x', n: 2 },
        ],
        {
          mode: 'overwrite',
        }
      );
      rows.clear();
      if (hide) omit(tree);
      rows.upsertMany([
        { id: 'y', n: 3 },
        { id: 'y', n: 4 },
      ]);
      if (hide) omit(tree);
      else rows.clear();
      rows.setAll([
        { id: 'w', n: 5 },
        { id: 'w', n: 6 },
      ]);
      return { calls, all: rows.all(), ids: rows.ids() };
    };
    const present = run(false);
    expect(run(true)).toEqual(present);
    expect(present.calls).toEqual([
      'add x:1',
      'add x:2',
      'add y:3',
      'update y:4',
      'add w:5',
      'add w:6',
    ]);
  });
});

describe('the retained rows a re-adding write removes are not row changes (v16 8e review)', () => {
  it('taps do not see them, and no interceptor can block them', () => {
    const tree = build();
    const rows = tree.$.a.rows;
    const seen: string[] = [];
    rows.tap({
      onAdd: (_row, id) => seen.push(`add ${id}`),
      onRemove: (id) => seen.push(`remove ${id}`),
    });
    rows.intercept({
      onRemove: (_id, _row, ctx) => ctx.block('no removals'),
    });
    omit(tree);
    rows.addOne(Z);
    expect(seen).toEqual(['add z']);
    expect(tree.$()).toEqual({ a: { rows: { all: [Z] } }, count: 0 });
  });
});

describe('closing a structural write (v16 8e review)', () => {
  // Whether the write threw reaches what runs at the outermost close (a
  // collection's deferred wake), so a consumer's error there cannot replace
  // the write's own (`entity-signal`).
  it('tells the outermost close whether the write threw', () => {
    const seen: unknown[] = [];
    const queue = () => {
      structuralWrites.end = (failed) => {
        structuralWrites.end = undefined;
        seen.push(failed);
      };
    };
    try {
      beginStructuralWrite();
      beginStructuralWrite();
      queue();
      endStructuralWrite(true);
      expect(seen).toEqual([]);
      endStructuralWrite(true);
      expect(seen).toEqual([true]);
      beginStructuralWrite();
      queue();
      endStructuralWrite();
      expect(seen).toEqual([true, undefined]);
      expect(structuralWrites.depth).toBe(0);
      expect(structuralWrites.readded).toBeUndefined();
    } finally {
      structuralWrites.end = undefined;
    }
  });
});

describe('a write to another tree from inside a whole value is ordinary (v16 8e review)', () => {
  // The whole value decides membership in its own tree only. A tap of it
  // that writes another tree's absent locations re-adds their paths there,
  // collection and leaf alike, instead of writing retained storage.
  it("re-adds the other tree's paths", () => {
    const tree = build();
    const other = build();
    omit(other);
    let wrote = false;
    tree.$.a.rows.tap({
      onAdd: () => {
        if (wrote) return;
        wrote = true;
        other.$.a.rows.addOne(Z);
        other.$.a.s(5);
      },
    });
    tree.$({ a: { rows: [B, Z], s: 0 }, count: 0 });
    expect(wrote).toBe(true);
    expect(other.$()).toEqual({ a: { rows: { all: [Z] }, s: 5 }, count: 0 });
    expect(stored(other.$.a.rows)).toEqual([Z]);
  });
});

describe("a write from inside its own tree's whole value or reversal (v16 8f)", () => {
  // A tap runs inside the whole value's (or the reversal's) own row writes.
  // A write it makes to an absent location of the same tree is an ordinary
  // write: it re-adds its path, and the structural write never omits it again
  // (8e wrote retained storage instead, invisibly).
  type Two = Omit<Tree, '$'> & {
    $: ((value?: unknown) => unknown) & {
      a: { rows: Rows; s: (value?: number) => number };
      b: { rows: Rows; s: (value?: number) => number };
    };
  };
  const two = (enhancers: unknown[] = []): Two => {
    const tree = signalTree(
      {
        a: { rows: entityMap<Row, string>(), s: 0 },
        b: { rows: entityMap<Row, string>(), s: 0 },
        count: 0,
      },
      {
        enhancers: enhancers as never,
        capabilities: ['causal-runtime', 'position-topology'] as never,
      }
    ) as unknown as Two;
    trees.push(tree);
    tree.$.a.rows.setAll([A]);
    tree.$.b.rows.setAll([B]);
    return tree;
  };
  const writeB = (tree: Two) => {
    let wrote = false;
    tree.$.a.rows.tap({
      onAdd: () => {
        if (wrote) return;
        wrote = true;
        tree.$.b.rows.addOne(Z);
        tree.$.b.s(5);
      },
    });
    return () => wrote;
  };

  it('a whole value that leaves an earlier omission alone', () => {
    const tree = two();
    tree.$({ a: { rows: [A], s: 0 }, count: 0 });
    expect(tree.$()).toEqual({ a: { rows: { all: [A] }, s: 0 }, count: 0 });
    const wrote = writeB(tree);
    tree.$({ a: { rows: [A, Z], s: 0 }, count: 0 });
    expect(wrote()).toBe(true);
    expect(tree.$()).toEqual({
      a: { rows: { all: [A, Z] }, s: 0 },
      b: { rows: { all: [Z] }, s: 5 },
      count: 0,
    });
    expect(stored(tree.$.b.rows)).toEqual([Z]);
  });

  it('a present member the same whole value then omits goes with it', () => {
    // Not an absent location: the tap writes a member that is still present,
    // and the whole value applies its omission after its row writes, so the
    // member is omitted with what was written to it (documented order).
    const tree = two();
    const wrote = writeB(tree);
    tree.$({ a: { rows: [A, Z], s: 0 }, count: 0 });
    expect(wrote()).toBe(true);
    expect(tree.$()).toEqual({ a: { rows: { all: [A, Z] }, s: 0 }, count: 0 });
    expect(stored(tree.$.b.rows)).toEqual([B, Z]);
    expect(tree.$.b.s()).toBeUndefined();
  });

  it('a reversal', async () => {
    const tree = two([restoration()]);
    await flush();
    undoable(() => tree.$.a.rows.addOne(Z));
    await flush();
    tree.$({ a: { rows: [A, Z], s: 0 }, count: 0 });
    await flush();
    let wrote = false;
    tree.$.a.rows.tap({
      onRemove: () => {
        if (wrote) return;
        wrote = true;
        tree.$.b.s(5);
      },
    });
    tree.undo();
    expect(wrote).toBe(true);
    expect(tree.$()).toEqual({
      a: { rows: { all: [A] }, s: 0 },
      b: { s: 5 },
      count: 0,
    });
  });
});

describe('taps during a reversal read rows absent-aware (v16 8f)', () => {
  // A reversal reads and writes a hidden collection's rows physically, and
  // its row writes fire the collection's taps. 8e let a tap's byId() see
  // those rows while has() read the collection absent. A tap now reads rows
  // as any consumer does. (Its cached projections, all() and count(), can
  // still hold the values from before the reversal's invalidation group, as
  // for any tap inside a grouped write: see the 8f record.)
  const watch = (rows: Rows) => {
    const disagreements: string[] = [];
    let taps = 0;
    const check = () => {
      taps++;
      for (const id of ['a', 'b', 'z']) {
        const byId = rows.byId(id) !== undefined;
        const has = rows.has(id)();
        if (byId !== has) disagreements.push(`${id}: byId ${byId}, has ${has}`);
      }
    };
    rows.tap({ onAdd: check, onRemove: check, onUpdate: check });
    return { disagreements, taps: () => taps };
  };
  for (const [order, enhancers] of Object.entries(historyOrders))
    it(`undo of a re-adding write (${order})`, async () => {
      const tree = build(enhancers());
      const rows = tree.$.a.rows;
      await flush();
      omit(tree);
      await flush();
      undoable(() => rows.addOne(Z));
      await flush();
      const seen = watch(rows);
      tree.undo();
      expect(seen.taps()).toBeGreaterThan(0);
      expect(seen.disagreements).toEqual([]);
      expect(tree.$()).toEqual({ count: 0 });
    });
  for (const [order, enhancers] of Object.entries(rollbackOrders))
    it(`rollback of a re-adding write (${order})`, async () => {
      const tree = build(enhancers());
      const rows = tree.$.a.rows;
      await flush();
      omit(tree);
      await flush();
      const pending = tree.transact(() => rows.addOne(Z));
      await flush();
      const seen = watch(rows);
      pending.rollback();
      await flush();
      expect(seen.disagreements).toEqual([]);
      expect(tree.$()).toEqual({ count: 0 });
    });
});

describe('a re-adding write, as on an empty collection (v16 8f review)', () => {
  // The same calls on a present empty collection (`clear()` first) and on an
  // absent one must end alike, interceptors and taps included.
  const twice = <T>(run: (tree: Tree, rows: Rows) => T): [T, T] => {
    const go = (hide: boolean) => {
      const tree = build();
      const rows = tree.$.a.rows;
      if (hide) omit(tree);
      else rows.clear();
      return run(tree, rows);
    };
    return [go(false), go(true)];
  };

  it("a tap's write to the same collection runs its interceptors", () => {
    const [present, absent] = twice((_tree, rows) => {
      rows.intercept({
        onAdd: (row, ctx) => {
          if (row.id === 'bad') ctx.block('no bad');
        },
      });
      let refused = '';
      rows.tap({
        onAdd: (_row, id) => {
          if (id !== 'z') return;
          try {
            rows.addOne({ id: 'bad', n: 0 });
          } catch (error) {
            refused = (error as Error).message;
          }
        },
      });
      rows.addOne(Z);
      return { refused, ids: rows.ids() };
    });
    expect(absent).toEqual(present);
    expect(present).toEqual({
      refused: 'Cannot add entity: no bad',
      ids: ['z'],
    });
  });

  it('a tap reads the collection present and can write the row it was told of', () => {
    const [present, absent] = twice((_tree, rows) => {
      const seen: unknown[] = [];
      rows.tap({
        onAdd: (_row, id) => {
          seen.push(rows.has(id)(), rows.byId(id) !== undefined, rows.ids());
          seen.push(rows.count());
          rows.updateOne(id, { n: 10 });
        },
      });
      rows.addOne(Z);
      return { seen, all: rows.all() };
    });
    expect(absent).toEqual(present);
    expect(present.seen).toEqual([true, true, ['z'], 1]);
    expect(present.all).toEqual([{ id: 'z', n: 10 }]);
  });

  it('a tap that throws leaves the written row as on a present collection', () => {
    const [present, absent] = twice((tree, rows) => {
      rows.tap({
        onAdd: () => {
          throw new Error('tap');
        },
      });
      let message = '';
      try {
        rows.addOne(Z);
      } catch (error) {
        message = (error as Error).message;
      }
      return {
        message,
        all: rows.all(),
        visible: (tree.$() as { a?: { rows?: unknown } }).a?.rows,
      };
    });
    expect(absent).toEqual(present);
    expect(present).toEqual({
      message: 'tap',
      all: [Z],
      visible: { all: [Z] },
    });
  });

  it('one object an interceptor returns for two ids is written for each', () => {
    const [present, absent] = twice((_tree, rows) => {
      const shared = { id: 'shared', n: 7 };
      rows.intercept({ onAdd: (_row, ctx) => ctx.transform(shared) });
      return {
        ids: rows.addMany([
          { id: 'x', n: 1 },
          { id: 'y', n: 2 },
        ]),
        keys: rows.ids(),
      };
    });
    expect(absent).toEqual(present);
    expect(present).toEqual({ ids: ['x', 'y'], keys: ['x', 'y'] });
  });

  it("an interceptor's own write to the collection is kept", () => {
    const [present, absent] = twice((_tree, rows) => {
      let wrote = false;
      rows.intercept({
        onAdd: (row) => {
          if (wrote || row.id !== 'z') return;
          wrote = true;
          rows.addOne({ id: 'side', n: 0 });
        },
      });
      rows.addOne(Z);
      return rows.ids();
    });
    expect(absent).toEqual(present);
    expect(present).toEqual(['side', 'z']);
  });

  const empties: Array<[string, (rows: Rows) => unknown]> = [
    ['addMany', (rows) => rows.addMany([])],
    ['prependMany', (rows) => rows.prependMany([])],
    ['upsertMany', (rows) => rows.upsertMany([])],
  ];
  for (const [name, write] of empties)
    it(`${name}([]) on an absent collection changes nothing`, async () => {
      const tree = build([restoration()]);
      const rows = tree.$.a.rows;
      await flush();
      omit(tree);
      await flush();
      const index = tree.getCurrentIndex();
      expect(write(rows)).toEqual([]);
      await flush();
      expect(tree.$()).toEqual({ count: 0 });
      expect(stored(rows)).toEqual([A, B]);
      expect(tree.getCurrentIndex()).toBe(index);
    });

  it('interceptor calls equal those on a present empty collection, for every write', () => {
    const calls = (hide: boolean) => {
      const tree = build();
      const rows = tree.$.a.rows;
      const log: string[] = [];
      rows.intercept({
        onAdd: (row) => {
          log.push(`add ${row.id}:${row.n}`);
        },
        onUpdate: (id, changes) => {
          log.push(`update ${String(id)}:${changes.n}`);
        },
      });
      const reset = () => {
        if (hide) omit(tree);
        else rows.clear();
      };
      const run = (label: string, write: () => unknown) => {
        reset();
        log.push(`-- ${label}`);
        try {
          write();
        } catch (error) {
          log.push(`threw ${(error as Error).message}`);
        }
        log.push(`ids ${rows.ids().join(',')}`);
      };
      run('addOne', () => rows.addOne(Z));
      run('prependOne', () => rows.prependOne(Z));
      run('upsertOne', () => rows.upsertOne(Z));
      run('prependMany', () => rows.prependMany([Z, { id: 'y', n: 2 }]));
      run('addMany strict dup', () => rows.addMany([Z, { id: 'z', n: 2 }]));
      run('addMany skip dup', () =>
        rows.addMany([Z, { id: 'z', n: 2 }], { mode: 'skip' })
      );
      run('addMany overwrite dup', () =>
        rows.addMany([Z, { id: 'z', n: 2 }], { mode: 'overwrite' })
      );
      run('upsertMany dup', () => rows.upsertMany([Z, { id: 'z', n: 3 }]));
      run('setAll dup', () => rows.setAll([Z, { id: 'z', n: 4 }]));
      return log;
    };
    expect(calls(true)).toEqual(calls(false));
  });
});

describe('re-entrant whole values and reversals started from a tap (v16 8f review)', () => {
  it('a whole value a tap starts omits what it leaves out', () => {
    const tree = signalTree(
      {
        a: { rows: entityMap<Row, string>(), s: 0 },
        b: { s: 0 },
        count: 0,
      },
      { capabilities: ['causal-runtime', 'position-topology'] as never }
    ) as unknown as Tree & {
      $: { b: { s: (value?: number) => number } };
    };
    trees.push(tree);
    tree.$.a.rows.setAll([A]);
    tree.$({ a: { rows: [A], s: 0 }, count: 0 });
    let ran = false;
    tree.$.a.rows.tap({
      onAdd: () => {
        if (ran) return;
        ran = true;
        // Re-adds `b` inside the outer whole value, then a whole value of
        // its own leaves `b` out: the later whole value decides.
        tree.$.b.s(5);
        tree.$({ a: { rows: [A, Z], s: 0 }, count: 0 });
      },
    });
    tree.$({ a: { rows: [A, Z], s: 0 }, count: 0 });
    expect(ran).toBe(true);
    expect(tree.$()).toEqual({ a: { rows: { all: [A, Z] }, s: 0 }, count: 0 });
  });

  it('undo and redo started from a tap of another tree', async () => {
    // A reversal opens its tree's physical-rows window at the tap depth it
    // starts at, so its own reads stay physical inside the tap.
    const tree = build([restoration()]);
    const rows = tree.$.a.rows;
    await flush();
    omit(tree);
    await flush();
    undoable(() => rows.addOne(Z));
    await flush();
    const host = build();
    const outcomes: string[] = [];
    let step: (() => void) | undefined;
    host.$.a.rows.tap({
      onAdd: () => {
        const run = step;
        step = undefined;
        if (!run) return;
        try {
          run();
          outcomes.push(`ok ${rows.ids().join(',')}`);
        } catch (error) {
          outcomes.push(`threw ${(error as Error).message}`);
        }
      },
    });
    step = () => tree.undo();
    host.$.a.rows.addOne({ id: 'u', n: 0 });
    step = () => tree.redo();
    host.$.a.rows.addOne({ id: 'r', n: 0 });
    expect(outcomes).toEqual(['ok ', 'ok z']);
    expect(tree.$()).toEqual({ a: { rows: { all: [Z] } }, count: 0 });
  });
});

describe('a root holding only collections (v16 8e review)', () => {
  // No scalar leaf anywhere: the tree's root carries no slot of its own.
  type Pair = Omit<Tree, '$'> & {
    $: ((value?: unknown) => unknown) & { users: Rows; orders: Rows };
  };
  const pair = (enhancers: unknown[] = []): Pair => {
    const tree = reactiveTree(
      { users: entityMap<Row, string>(), orders: entityMap<Row, string>() },
      {
        enhancers: enhancers as never,
        capabilities: ['causal-runtime', 'position-topology'] as never,
      }
    ) as unknown as Pair;
    trees.push(tree);
    tree.$.users.setAll([A]);
    return tree;
  };
  const initial = { users: { all: [A] }, orders: { all: [] } };
  const hidden = { orders: { all: [B] } };
  const readded = { users: { all: [Z] }, orders: { all: [B] } };

  it('held consumers follow the omission and a re-adding write', () => {
    const tree = pair();
    const users = tree.$.users;
    const view = computed(() => [users.all(), users.count(), tree.$()]);
    expect(view()).toEqual([[A], 1, initial]);
    tree.$({ orders: [B] });
    expect(view()).toEqual([[], 0, hidden]);
    expect([users.all(), users.count(), users.byId('a')]).toEqual([
      [],
      0,
      undefined,
    ]);
    users.addOne(Z);
    expect(view()).toEqual([[Z], 1, readded]);
  });

  for (const [order, enhancers] of Object.entries(historyOrders))
    it(`undo and redo of the omission and of the re-adding write (${order})`, async () => {
      const tree = pair(enhancers());
      const users = tree.$.users;
      const view = computed(() => [users.all(), tree.$()]);
      await flush();
      undoable(() => tree.$({ orders: [B] }));
      await flush();
      undoable(() => users.addOne(Z));
      await flush();
      expect(view()).toEqual([[Z], readded]);
      tree.undo();
      expect(view()).toEqual([[], hidden]);
      tree.undo();
      expect(view()).toEqual([[A], initial]);
      tree.redo();
      expect(view()).toEqual([[], hidden]);
      tree.redo();
      expect(view()).toEqual([[Z], readded]);
    });

  for (const [order, enhancers] of Object.entries(rollbackOrders))
    it(`rollback of the re-adding write (${order})`, async () => {
      const tree = pair(enhancers());
      const users = tree.$.users;
      const view = computed(() => [users.all(), tree.$()]);
      await flush();
      tree.$({ orders: [B] });
      await flush();
      const pending = tree.transact(() => users.addOne(Z));
      await flush();
      expect(view()).toEqual([[Z], readded]);
      pending.rollback();
      await flush();
      expect(view()).toEqual([[], hidden]);
      expect(stored(users)).toEqual([A]);
    });
});

describe('an absent collection publishes nothing for its hidden rows', () => {
  for (const [order, enhancers] of Object.entries(rollbackOrders))
    it(`a rollback compensating hidden rows re-runs no consumer (${order})`, async () => {
      const tree = build(enhancers(), true);
      const rows = tree.$.a.rows;
      let runs = 0;
      const all = computed(() => {
        runs++;
        return rows.all();
      });
      const pending = tree.transact(() => rows.updateOne('a', { n: 5 }));
      await flush();
      omit(tree);
      await flush();
      expect(all()).toEqual([]);
      const before = runs;
      // Writes the hidden row back: what consumers read (nothing) is
      // unchanged, so they are not asked to read again.
      pending.rollback();
      await flush();
      expect(all()).toEqual([]);
      expect(runs).toBe(before);
      expect(stored(rows)).toEqual([A, B]);
    });
});
