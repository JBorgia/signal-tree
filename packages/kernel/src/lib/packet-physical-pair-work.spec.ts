import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
// Intentionally import the real root: direct implementation imports omit the
// native publication factory and miss the production pairing work.
import { entityMap, signalTree, transactions } from '../index';

it.each([32, 256, 1024])(
  'root-import clear rollback pairs physical edits without repeated scans (%i rows)',
  (count) => {
    const tree = signalTree(
      { rows: entityMap<{ id: number; n: number }, number>() },
      { enhancers: [transactions()] }
    );
    const input = Array.from({ length: count }, (_, id) => ({
      id,
      n: id + 10,
    }));
    const original = Array.prototype.find;
    let total = 0,
      pairing = 0;
    const calls: { site: string; length: number; visits: number }[] = [];
    try {
      tree.$.rows.setAll(input);
      expect(tree.$.rows.all()).toEqual(input);
      const pending = tree.transact(() => tree.$.rows.setAll([]));
      expect(tree.$.rows.ids()).toEqual([]);
      expect(tree.$.rows.count()).toBe(0);
      Array.prototype.find = function <T>(
        this: T[],
        predicate: (v: T, i: number, a: T[]) => unknown,
        thisArg?: unknown
      ): T | undefined {
        const site = new Error().stack?.split('\n')[2] ?? 'unknown';
        const pair = site.includes('/experimental-publication/entity.ts:');
        const call = { site, length: this.length, visits: 0 };
        calls.push(call);
        return original.call(this, (value: T, index: number, array: T[]) => {
          total++;
          call.visits++;
          if (pair) pairing++;
          return predicate.call(thisArg, value, index, array);
        });
      } as typeof original;
      try {
        pending.rollback();
      } finally {
        Array.prototype.find = original;
      }
      const ids = tree.$.rows.ids();
      const after = tree.$.rows.all();
      const output = process.env.ST_PACKET_PAIR_OUTPUT;
      if (output) {
        mkdirSync(output, { recursive: true });
        writeFileSync(
          join(output, `work-${count}.json`),
          JSON.stringify({ count, total, pairing, calls, ids, after }, null, 2)
        );
      }
      expect(Array.prototype.find).toBe(original);
      expect(ids).toEqual(input.map((row) => row.id));
      expect(after).toEqual(input);
      expect(tree.$.rows.count()).toBe(count);
      expect(tree.$.rows.byId(0)?.()?.n).toBe(10);
      expect(tree.$.rows.byId(count - 1)?.()?.n).toBe(count + 9);
      tree.$.rows.updateOne(count - 1, { n: -7 });
      expect(tree.$.rows.byId(count - 1)?.()?.n).toBe(-7);
      expect(tree.$.rows.ids()).toEqual(ids);
      // Local algorithm discriminator, not a changed release/work budget.
      // Preserve the separate direct-import clear 2N count oracle unchanged.
      expect(pairing, 'physical pairing predicate visits').toBeLessThanOrEqual(
        count
      );
    } finally {
      Array.prototype.find = original;
      tree.destroy();
    }
  }
);
