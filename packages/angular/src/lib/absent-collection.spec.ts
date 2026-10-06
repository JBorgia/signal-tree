import { computed } from '@angular/core';

import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';

/**
 * An entity collection under an omitted member through the Angular adapter (v16
 * integration slice 8e (2); kernel carrier
 * `packages/kernel/src/lib/absent-collection.spec.ts`). Read through a native `computed`:
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

describe.each(ORDERS)('absent collection — Angular (%s)', (_, enhancers) => {
  const build = () => {
    const initial: State = {
      a: { rows: entityMap<Row, string>(), s: 0 },
      count: 0,
    };
    const tree = signalTree(initial, { enhancers: enhancers() });
    const rows = tree.$.a.rows as unknown as Rows;
    rows.addOne(A);
    const row = rows.byId('a') as () => Row | undefined;
    const view = computed(() => [
      JSON.stringify(tree.$()),
      rows.all(),
      rows.count(),
      row(),
    ]);
    return { tree, rows, view };
  };
  const omit = (tree: { $: (value: unknown) => void }) => tree.$({ count: 0 });
  it('reads it absent and empty, held reads too', async () => {
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
  });
  it('a row-adding write re-adds the path with only its row; undo omits it again', async () => {
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
  });
  it('a root holding only collections: omission, a re-adding write, undo (v16 8e review)', async () => {
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
      const view = computed(() => [
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
  });
  it('rollback of a re-adding write makes it absent again', async () => {
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
  });
});
