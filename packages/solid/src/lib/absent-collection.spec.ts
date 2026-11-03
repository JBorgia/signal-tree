import { createMemo, createRoot } from 'solid-js';
import { describe, expect, it } from 'vitest';

import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';

/**
 * An entity collection under an omitted member through the Solid adapter (v16
 * integration slice 8e (2); kernel carrier
 * `packages/kernel/src/lib/absent-collection.spec.ts`). Read through a Solid memo:
 * the collection is absent and empty under the omission, a row-adding write
 * re-adds the path with only its rows, a row-naming write refuses, and undo
 * and rollback make it absent again.
 */

type Row = { id: string; n: number };
type State = {
  a: { rows: ReturnType<typeof entityMap<Row, string>>; s: number };
  count: number;
};
type Rows = {
  all(): Row[];
  count(): number;
  byId(id: string): (() => Row | undefined) | undefined;
  addOne(row: Row): string;
  updateOne(id: string, changes: Partial<Row>): void;
  tap(handlers: { onAdd?: () => void; onRemove?: () => void }): () => void;
  removeOne(id: string): void;
};
const A = { id: 'a', n: 0 };
const Z = { id: 'z', n: 9 };
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const ORDERS = [
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const;

/** Run `body` inside a reactive root and dispose it afterwards. */
const inRoot = async (body: () => Promise<void>) => {
  let dispose = () => undefined as void;
  const done = createRoot((release) => {
    dispose = release;
    return body();
  });
  try {
    await done;
  } finally {
    dispose();
  }
};

describe.each(ORDERS)('absent collection — Solid (%s)', (_, enhancers) => {
  const build = () => {
    const initial: State = {
      a: { rows: entityMap<Row, string>(), s: 0 },
      count: 0,
    };
    const tree = signalTree(initial, { enhancers: enhancers() });
    const rows = tree.$.a.rows as unknown as Rows;
    rows.addOne(A);
    const row = rows.byId('a') as () => Row | undefined;
    const view = createMemo(() => [
      JSON.stringify(tree.$()),
      rows.all(),
      rows.count(),
      row(),
    ]);
    return { tree, rows, view };
  };
  const omit = (tree: { $: (value: unknown) => void }) => tree.$({ count: 0 });
  it('reads it absent and empty, held reads too', () =>
    inRoot(async () => {
      const { tree, rows, view } = build();
      try {
        expect(view()).toEqual([
          '{"a":{"rows":{"all":[{"id":"a","n":0}]},"s":0},"count":0}',
          [A],
          1,
          A,
        ]);
        omit(tree as never);
        await flush();
        expect(view()).toEqual(['{"count":0}', [], 0, undefined]);
        expect(rows.byId('a')).toBeUndefined();
        expect(() => rows.updateOne('a', { n: 1 })).toThrow(
          /^Entity with id a not found$/
        );
        expect(view()).toEqual(['{"count":0}', [], 0, undefined]);
      } finally {
        tree.destroy();
      }
    }));
  it('an omission nested in a whole value wakes held reads after it', () =>
    inRoot(async () => {
      const { tree, view } = build();
      try {
        // `rows` is omitted one level down, inside a nested structural write,
        // which reads rows physically.
        (tree.$ as unknown as (value: unknown) => void)({
          a: { s: 1 },
          count: 0,
        });
        await flush();
        expect(view()).toEqual(['{"a":{"s":1},"count":0}', [], 0, undefined]);
      } finally {
        tree.destroy();
      }
    }));
  it('a row-adding write re-adds the path with only its row; undo omits it again', () =>
    inRoot(async () => {
      const { tree, rows, view } = build();
      try {
        omit(tree as never);
        await flush();
        undoable(() => rows.addOne(Z));
        await flush();
        expect(view()).toEqual([
          '{"a":{"rows":{"all":[{"id":"z","n":9}]}},"count":0}',
          [Z],
          1,
          undefined,
        ]);
        tree.undo();
        await flush();
        expect(view()).toEqual(['{"count":0}', [], 0, undefined]);
        tree.redo();
        await flush();
        expect(view()).toEqual([
          '{"a":{"rows":{"all":[{"id":"z","n":9}]}},"count":0}',
          [Z],
          1,
          undefined,
        ]);
      } finally {
        tree.destroy();
      }
    }));
  it('a root holding only collections: omission, a re-adding write, undo (v16 8e review)', () =>
    inRoot(async () => {
      const tree = signalTree(
        { users: entityMap<Row, string>(), orders: entityMap<Row, string>() },
        { enhancers: enhancers() as never }
      ) as unknown as {
        $: ((value: unknown) => void) & { users: Rows };
        undo(): void;
        destroy(): void;
      };
      try {
        const users = tree.$.users;
        users.addOne(A);
        const view = createMemo(() => [
          JSON.stringify((tree.$ as unknown as () => unknown)()),
          users.all(),
          users.count(),
        ]);
        expect(view()).toEqual([
          '{"users":{"all":[{"id":"a","n":0}]},"orders":{"all":[]}}',
          [A],
          1,
        ]);
        tree.$({ orders: [] });
        await flush();
        expect(view()).toEqual(['{"orders":{"all":[]}}', [], 0]);
        undoable(() => users.addOne(Z));
        await flush();
        expect(view()).toEqual([
          '{"users":{"all":[{"id":"z","n":9}]},"orders":{"all":[]}}',
          [Z],
          1,
        ]);
        tree.undo();
        await flush();
        expect(view()).toEqual(['{"orders":{"all":[]}}', [], 0]);
      } finally {
        tree.destroy();
      }
    }));
  it('a tap inside a whole value re-adds an absent member of the same tree (v16 8f)', () =>
    inRoot(async () => {
      type Two = {
        $: ((value: unknown) => void) & {
          a: { rows: Rows };
          b: { rows: Rows; s: { set(value: number): void } };
        };
        destroy(): void;
      };
      const tree = signalTree(
        {
          a: { rows: entityMap<Row, string>(), s: 0 },
          b: { rows: entityMap<Row, string>(), s: 0 },
          count: 0,
        },
        { enhancers: enhancers() as never }
      ) as unknown as Two;
      try {
        tree.$.a.rows.addOne(A);
        tree.$({ a: { rows: [A], s: 0 }, count: 0 });
        await flush();
        const view = createMemo(() => [
          JSON.stringify((tree.$ as unknown as () => unknown)()),
          tree.$.b.rows.all(),
        ]);
        expect(view()).toEqual([
          '{"a":{"rows":{"all":[{"id":"a","n":0}]},"s":0},"count":0}',
          [],
        ]);
        let wrote = false;
        tree.$.a.rows.tap({
          onAdd: () => {
            if (wrote) return;
            wrote = true;
            tree.$.b.rows.addOne(Z);
            tree.$.b.s.set(5);
          },
        });
        // Inside the whole value's own row writes: an ordinary write.
        tree.$({ a: { rows: [A, Z], s: 0 }, count: 0 });
        await flush();
        expect(wrote).toBe(true);
        expect(view()).toEqual([
          '{"a":{"rows":{"all":[{"id":"a","n":0},{"id":"z","n":9}]},"s":0},"b":{"rows":{"all":[{"id":"z","n":9}]},"s":5},"count":0}',
          [Z],
        ]);
      } finally {
        tree.destroy();
      }
    }));
  it('a tap inside transact reads the collection as it is (v16 8f)', () => {
    const tree = signalTree(
      { a: { rows: entityMap<Row, string>(), s: 0 }, count: 0 },
      { enhancers: enhancers() as never }
    ) as unknown as {
      $: { a: { rows: Rows } };
      transact(run: () => void): unknown;
      destroy(): void;
    };
    try {
      const rows = tree.$.a.rows;
      rows.addOne(A);
      rows.addOne(Z);
      rows.all();
      rows.count();
      const seen: unknown[] = [];
      rows.tap({
        onRemove: () => {
          seen.push(
            rows.all().map((row) => row.id),
            rows.count()
          );
        },
      });
      tree.transact(() => rows.removeOne('a'));
      expect(seen).toEqual([['z'], 1]);
    } finally {
      tree.destroy();
    }
  });

  it('rollback of a re-adding write makes it absent again', () =>
    inRoot(async () => {
      const { tree, rows, view } = build();
      try {
        omit(tree as never);
        await flush();
        const pending = tree.transact(() => rows.addOne(Z));
        await flush();
        expect(view()).toEqual([
          '{"a":{"rows":{"all":[{"id":"z","n":9}]}},"count":0}',
          [Z],
          1,
          undefined,
        ]);
        pending.rollback();
        await flush();
        expect(view()).toEqual(['{"count":0}', [], 0, undefined]);
      } finally {
        tree.destroy();
      }
    }));
});
