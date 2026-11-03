import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

// Reproduced on npm 15.3.1: addMany recorded each added row's predecessor from
// the PRE-add key list at the wrong offset, so redo reinserted rows out of
// order: [k1..k5] + addMany([x, y]) -> undo -> redo gave [k1,k2,k3,k4,x,k5,y].
type Row = { id: string };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const keys = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `k${i + 1}` }));

describe.each([
  ['restoration', () => [restoration()]],
  ['transactions, restoration', () => [transactions(), restoration()]],
] as const)('addMany redo order (%s)', (_name, enhancers) => {
  it.each([
    [0, ['x']],
    [0, ['x', 'y']],
    [1, ['x', 'y']],
    [5, ['x', 'y']],
    [5, ['x', 'y', 'z']],
    [3, ['a', 'b', 'c', 'd', 'e']],
  ] as const)('%i existing rows + addMany(%j)', async (existing, added) => {
    const tree = signalTree(
      { rows: entityMap<Row, string>() },
      { enhancers: enhancers() }
    );
    try {
      tree.$.rows.setAll(keys(existing));
      await flush();
      undoable(() => tree.$.rows.addMany(added.map((id) => ({ id }))));
      await flush();
      const after = [...tree.$.rows.ids()];
      tree.undo();
      expect(tree.$.rows.ids()).toEqual(after.slice(0, existing));
      tree.redo();
      expect(tree.$.rows.ids()).toEqual(after);
    } finally {
      tree.destroy();
    }
  });
});
