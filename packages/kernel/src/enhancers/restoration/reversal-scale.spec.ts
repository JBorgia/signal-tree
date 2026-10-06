import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * Reversal at scale (reversal-engine review, item 9). The target order was
 * derived with an array scan per inserted row (a fresh Set, `includes` and
 * `indexOf` each time): redo of a 40k-row addMany took 40 s, undo of a
 * removeMany of every other row in 100k rows took 90 s. The order is now
 * replayed on a linked list (`insertion-order.ts`), linear in rows. Same style
 * as entity-large-batches.spec.ts: a generous timeout, not a wall-clock
 * assertion. Measured runs are recorded in the evidence folder.
 */
type Row = { id: number; n: number };
const ROWS = 100_000;
const rows = (count: number, offset = 0): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: i + offset, n: i }));
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('reversal at scale', () => {
  it('undo, redo and undo of a 100k-row addMany', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>() },
      { enhancers: [restoration()] }
    );
    try {
      tree.$.rows.setAll(rows(10));
      await flush();
      undoable(() => tree.$.rows.addMany(rows(ROWS, 10)));
      await flush();
      tree.undo();
      expect(tree.$.rows.count()).toBe(10);
      tree.redo();
      expect(tree.$.rows.count()).toBe(ROWS + 10);
      const ids = tree.$.rows.ids();
      expect(ids[10]).toBe(10);
      expect(ids[ROWS + 9]).toBe(ROWS + 9);
      tree.undo();
      expect(tree.$.rows.ids()).toStrictEqual(rows(10).map((row) => row.id));
    } finally {
      tree.destroy();
    }
  }, 120_000);

  it('undo and redo of a removeMany of every other row in 100k rows', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>() },
      { enhancers: [restoration()] }
    );
    try {
      tree.$.rows.setAll(rows(ROWS));
      await flush();
      const odd = rows(ROWS)
        .filter((row) => row.id % 2 === 1)
        .map((row) => row.id);
      undoable(() => tree.$.rows.removeMany(odd));
      await flush();
      expect(tree.$.rows.count()).toBe(ROWS / 2);
      tree.undo();
      const ids = tree.$.rows.ids();
      expect(ids.length).toBe(ROWS);
      expect(ids.every((id, index) => id === index)).toBe(true);
      tree.redo();
      expect(tree.$.rows.count()).toBe(ROWS / 2);
    } finally {
      tree.destroy();
    }
  }, 120_000);

  it('rollback of a removeMany of every other row in 100k rows', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>() },
      { enhancers: [transactions()] }
    );
    try {
      tree.$.rows.setAll(rows(ROWS));
      await flush();
      const odd = rows(ROWS)
        .filter((row) => row.id % 2 === 1)
        .map((row) => row.id);
      const pending = tree.transaction(() => tree.$.rows.removeMany(odd));
      await flush();
      pending.rollback();
      await flush();
      const ids = tree.$.rows.ids();
      expect(ids.length).toBe(ROWS);
      expect(ids.every((id, index) => id === index)).toBe(true);
    } finally {
      tree.destroy();
    }
  }, 120_000);
});
