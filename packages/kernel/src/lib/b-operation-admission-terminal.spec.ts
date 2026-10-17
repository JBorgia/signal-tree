import { expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
import { selectNativeOwnershipTransactions } from './internals/native-ownership-public-selection';
import { getNativeOwnershipPublicExperiment } from '../enhancers/transactions/native-ownership-public-experiment';

it('replaces dependency-only confirmed order when committed exact removes its last pending membership dependency', () => {
  const row = (id: string) => ({ id, n: 0 });
  const tree = signalTree(
    { rows: entityMap<{ id: string; n: number }, string>() },
    { enhancers: [selectNativeOwnershipTransactions(transactions())] }
  );
  try {
    tree.$.rows.setAll(['A', 'B', 'C'].map(row));
    const held = tree.$.rows.byIdOrFail('C');
    const rekey = tree.transact(() => tree.$.rows.changeId('C', 'C2'));
    const ordering = tree.transact(() =>
      tree.$.rows.setAll(['C2', 'A', 'B'].map(row))
    );
    ordering.confirm();
    expect(tree.$.rows.ids()).toEqual(['C2', 'A', 'B']);
    expect(tree.$.rows.byIdOrFail('C2')).toBe(held);
    tree.$.rows.setAll(['B', 'A'].map(row));
    expect(tree.$.rows.ids()).toEqual(['B', 'A']);
    expect(held()).toBeUndefined();
    rekey.rollback();
    expect(tree.$.rows.ids()).toEqual(['B', 'A']);
    expect(held()).toBeUndefined();
    expect(getNativeOwnershipPublicExperiment(tree)?.stats()).toEqual({
      pending: 0,
      ledgers: 0,
    });
  } finally {
    tree.destroy();
  }
});
