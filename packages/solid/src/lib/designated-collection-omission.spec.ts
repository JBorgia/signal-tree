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
 * Reversing a designated omission of an entity collection through the
 * Solid adapter (v16 integration slice 8d (b); kernel carrier
 * `packages/kernel/src/enhancers/restoration/designated-collection-omission.spec.ts`).
 * Undo, redo, jumpTo and rollback restore the collection fully, read through
 * a Solid memo. A collection whose retained rows changed after it was omitted is
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

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const ORDERS = [
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const;
const WITH = '{"g":{"rows":{"all":[{"id":"a","n":0}]},"k":0},"count":5}';
const WITHOUT = '{"g":{"k":0},"count":5}';

describe.each(ORDERS)('designated collection omission — Solid (%s)', (_, enhancers) => {
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

  it('undo, redo and jumpTo restore the collection', () =>
    inRoot(async () => {
      const { tree, g } = build();
      try {
        const view = createMemo(() => JSON.stringify(tree.$()));
        undoable(() => tree.$.count.set(5));
        await flush();
        undoable(() => g({ k: 0 }));
        await flush();
        expect(view()).toBe(WITHOUT);
        tree.undo();
        await flush();
        expect(view()).toBe(WITH);
        tree.redo();
        await flush();
        expect(view()).toBe(WITHOUT);
        tree.jumpTo(tree.getCurrentIndex() - 1);
        await flush();
        expect(view()).toBe(WITH);
      } finally {
        tree.destroy();
      }
    }));

  it('rollback restores the collection', () =>
    inRoot(async () => {
      const { tree, g } = build();
      try {
        const view = createMemo(() => JSON.stringify(tree.$()));
        tree.$.count.set(5);
        const pending = tree.transact(() => g({ k: 0 }));
        await flush();
        expect(view()).toBe(WITHOUT);
        pending.rollback();
        await flush();
        expect(view()).toBe(WITH);
      } finally {
        tree.destroy();
      }
    }));

  it('a collection changed after its omission is refused, nothing changes', () =>
    inRoot(async () => {
      const { tree, rows, g } = build();
      try {
        const view = createMemo(() => JSON.stringify(tree.$()));
        tree.$.count.set(5);
        // Its own turn: the omission's turn must not also hold the row's add.
        await flush();
        undoable(() => g({ k: 0 }));
        await flush();
        rows.updateOne('a', { n: 7 });
        await flush();
        expect(() => tree.undo()).toThrow(/'g\.rows'.*changed after that/);
        await flush();
        expect(view()).toBe(WITHOUT);
      } finally {
        tree.destroy();
      }
    }));
});
