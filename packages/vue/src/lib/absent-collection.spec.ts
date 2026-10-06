import { describe, expect, it } from 'vitest';
import { computed, watchEffect } from 'vue';

import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';

/**
 * An entity collection under an omitted member through the Vue adapter (v16
 * integration slice 8e (2); kernel carrier
 * `packages/kernel/src/lib/absent-collection.spec.ts`). Read through a Vue `computed`:
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

describe.each(ORDERS)('absent collection — Vue (%s)', (_, enhancers) => {
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
      expect(view.value).toEqual([
        '{"a":{"rows":{"all":[{"id":"a","n":0}]},"s":0},"count":0}',
        [A],
        1,
        A,
      ]);
      omit(tree as never);
      await flush();
      expect(view.value).toEqual(['{"count":0}', [], 0, undefined]);
      expect(rows.byId('a')).toBeUndefined();
      expect(() => rows.updateOne('a', { n: 1 })).toThrow(
        /^Entity with id a not found$/
      );
      expect(view.value).toEqual(['{"count":0}', [], 0, undefined]);
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
      expect(view.value).toEqual([
        '{"a":{"rows":{"all":[{"id":"z","n":9}]}},"count":0}',
        [Z],
        1,
        undefined,
      ]);
      tree.undo();
      await flush();
      expect(view.value).toEqual(['{"count":0}', [], 0, undefined]);
      tree.redo();
      await flush();
      expect(view.value).toEqual([
        '{"a":{"rows":{"all":[{"id":"z","n":9}]}},"count":0}',
        [Z],
        1,
        undefined,
      ]);
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
      expect(view.value).toEqual([
        '{"a":{"rows":{"all":[{"id":"z","n":9}]}},"count":0}',
        [Z],
        1,
        undefined,
      ]);
      pending.rollback();
      await flush();
      expect(view.value).toEqual(['{"count":0}', [], 0, undefined]);
    } finally {
      tree.destroy();
    }
  });
});

describe('absent collection — Vue sync effects (v16 8e)', () => {
  it('a rollback writing hidden rows runs no effect that could see them', async () => {
    const initial: State = {
      a: { rows: entityMap<Row, string>(), s: 0 },
      count: 0,
    };
    const tree = signalTree(initial, { enhancers: [transactions()] });
    try {
      const rows = tree.$.a.rows as unknown as Rows;
      rows.addOne(A);
      const row = rows.byId('a') as () => Row | undefined;
      const pending = tree.transact(() => rows.updateOne('a', { n: 5 }));
      await flush();
      (tree.$ as unknown as (value: unknown) => void)({ count: 0 });
      await flush();
      const seen: unknown[] = [];
      const stop = watchEffect(() => seen.push(row()), { flush: 'sync' });
      try {
        // Compensates the hidden row, reading it physically: nothing that
        // observes it may run while that is so.
        pending.rollback();
        await flush();
        expect(seen.every((value) => value === undefined)).toBe(true);
        expect(row()).toBeUndefined();
      } finally {
        stop();
      }
    } finally {
      tree.destroy();
    }
  });
});
