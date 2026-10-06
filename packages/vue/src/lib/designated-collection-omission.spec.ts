import { describe, expect, it } from 'vitest';
import { computed } from 'vue';

import {
  entityMap,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';

/**
 * Reversing a designated omission of an entity collection through the
 * Vue adapter (v16 integration slice 8d (b); kernel carrier
 * `packages/kernel/src/enhancers/restoration/designated-collection-omission.spec.ts`).
 * Undo, redo, jumpTo and rollback restore the collection fully, read through
 * a Vue `computed`. A collection whose retained rows changed after it was omitted is
 * refused, and nothing changes.
 */

type Row = { id: string; n: number };
type State = {
  g: { rows: ReturnType<typeof entityMap<Row, string>>; k: number };
  count: number;
};
type Rows = {
  addOne(row: Row): void;
  updateOne(id: string, changes: Partial<Row>): void;
};

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const ORDERS = [
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const;
const WITH = '{"g":{"rows":{"all":[{"id":"a","n":0}]},"k":0},"count":5}';
const WITHOUT = '{"g":{"k":0},"count":5}';

describe.each(ORDERS)('designated collection omission — Vue (%s)', (_, enhancers) => {
  const build = () => {
    const initial: State = {
      g: { rows: entityMap<Row, string>(), k: 0 },
      count: 0,
    };
    const tree = signalTree(initial, { enhancers: enhancers() });
    const rows = tree.$.g.rows as unknown as Rows;
    rows.addOne({ id: 'a', n: 0 });
    const g = tree.$.g as unknown as (value: unknown) => void;
    return { tree, rows, g };
  };

  it('undo, redo and jumpTo restore the collection', async () => {
    const { tree, g } = build();
    try {
      const view = computed(() => JSON.stringify(tree.$()));
      undoable(() => (tree.$.count.value = 5));
      await flush();
      undoable(() => g({ k: 0 }));
      await flush();
      expect(view.value).toBe(WITHOUT);
      tree.undo();
      await flush();
      expect(view.value).toBe(WITH);
      tree.redo();
      await flush();
      expect(view.value).toBe(WITHOUT);
      tree.jumpTo(tree.getCurrentIndex() - 1);
      await flush();
      expect(view.value).toBe(WITH);
    } finally {
      tree.destroy();
    }
  });

  it('rollback restores the collection', async () => {
    const { tree, g } = build();
    try {
      const view = computed(() => JSON.stringify(tree.$()));
      tree.$.count.value = 5;
      const pending = tree.transact(() => g({ k: 0 }));
      await flush();
      expect(view.value).toBe(WITHOUT);
      pending.rollback();
      await flush();
      expect(view.value).toBe(WITH);
    } finally {
      tree.destroy();
    }
  });

  it('a row-naming write to the omitted collection refuses; undo still restores it', async () => {
    const { tree, rows, g } = build();
    try {
      const view = computed(() => JSON.stringify(tree.$()));
      tree.$.count.value = 5;
      // Its own turn: the omission's turn must not also hold the row's add.
      await flush();
      undoable(() => g({ k: 0 }));
      await flush();
      // It reads absent and empty (v16 8e): no row to update.
      expect(() => rows.updateOne('a', { n: 7 })).toThrow(
        /^Entity with id a not found$/
      );
      expect(view.value).toBe(WITHOUT);
      tree.undo();
      await flush();
      expect(view.value).toBe(WITH);
    } finally {
      tree.destroy();
    }
  });
});
