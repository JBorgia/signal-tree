import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

/**
 * Order-delta review, item 7: a transaction adding and then removing k rows
 * was superlinear (8k 0.36 s, 16k 1.4 s, 32k 4.5-6.4 s). The hot path was
 * restoration's pending-footprint dedupe, which scanned every earlier touch
 * of the transaction per committed change; it is indexed now (64k: 1.7 s).
 * A ratio guard: linear work grows 16x from 2k to 32k rows, quadratic 256x
 * (measured: 13-16x now, 60x and more before).
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

const measure = async (k: number): Promise<number> => {
  let best = Infinity;
  for (let rep = 0; rep < 3; rep++) {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
      { enhancers: [transactions(), restoration()] }
    );
    const rows = tree.$.rows;
    rows.setAll(Array.from({ length: 100 }, (_, i) => ({ id: `r${i}`, n: i })));
    await flush();
    const start = performance.now();
    const pending = tree.transaction(() => {
      rows.setAll([...rows.all()].reverse());
      for (let i = 0; i < k; i++) rows.addOne({ id: `t${i}`, n: 1 });
      for (let i = k - 1; i >= 0; i--) rows.removeOne(`t${i}`);
    });
    await flush();
    best = Math.min(best, performance.now() - start);
    pending.rollback();
    tree.destroy();
  }
  return best;
};

describe('Timing guard: a transaction of transient rows', () => {
  it('grows linearly in the rows it adds and removes', async () => {
    await measure(1000);
    const small = await measure(2000);
    const large = await measure(32000);
    expect(large / small).toBeLessThan(32);
  }, 120_000);
});
