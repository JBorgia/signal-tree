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
import { createSignalTreeFactory } from './signal-tree';

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
  addMany(rows: Row[]): string[];
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
