import { describe, expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
import { selectNativeOwnershipTransactions } from './internals/native-ownership-public-selection';
import { getNativeOwnershipPublicExperiment } from '../enhancers/transactions/native-ownership-public-experiment';

const row = (id: string) => ({ id, n: 0 });
describe('operation admission independent composition controls', () => {
  it.each(['front-append', 'append-front'] as const)(
    'composes adjacent committed partial intents (%s) without adopting pending exact order',
    (sequence) => {
      const tree = signalTree(
        { rows: entityMap<{ id: string; n: number }, string>() },
        { enhancers: [selectNativeOwnershipTransactions(transactions())] }
      );
      try {
        const controls = getNativeOwnershipPublicExperiment(tree);
        if (!controls) throw new Error('B authority unavailable');
        expect(controls.authority).toBe('native-pending');
        tree.$.rows.setAll(['A', 'B', 'C'].map(row));
        const pending = tree.transact(() =>
          tree.$.rows.setAll(['C', 'A', 'B'].map(row))
        );
        const front = () =>
          tree.$.rows.prependMany([row('B')], { mode: 'overwrite' });
        const append = () => tree.$.rows.addOne(row('D'));
        if (sequence === 'front-append') {
          front();
          append();
        } else {
          append();
          front();
        }
        expect(tree.$.rows.ids()).toEqual(['B', 'C', 'A', 'D']);
        pending.rollback();
        expect(tree.$.rows.ids()).toEqual(['B', 'A', 'C', 'D']);
        expect(tree.$.rows.all()).toEqual(['B', 'A', 'C', 'D'].map(row));
        expect(controls.stats()).toEqual({ pending: 0, ledgers: 0 });
        // A new interval must use native order, without stale private intents.
        const next = tree.transact(() =>
          tree.$.rows.setAll(['D', 'C', 'A', 'B'].map(row))
        );
        next.rollback();
        expect(tree.$.rows.ids()).toEqual(['B', 'A', 'C', 'D']);
        expect(controls.stats()).toEqual({ pending: 0, ledgers: 0 });
      } finally {
        tree.destroy();
      }
    }
  );
  it('ordinary exact replacement retires a dependency-only confirmed order', () => {
    const tree = signalTree(
      { rows: entityMap<{ id: string; n: number }, string>() },
      { enhancers: [selectNativeOwnershipTransactions(transactions())] }
    );
    try {
      const controls = getNativeOwnershipPublicExperiment(tree);
      if (!controls) throw new Error('B authority unavailable');
      tree.$.rows.setAll(['A', 'B'].map(row));
      const creator = tree.transact(() => tree.$.rows.addOne(row('C')));
      const order = tree.transact(() =>
        tree.$.rows.setAll(['C', 'A', 'B'].map(row))
      );
      order.confirm();
      tree.$.rows.setAll(['B', 'A'].map(row));
      expect(tree.$.rows.ids()).toEqual(['B', 'A']);
      creator.rollback();
      expect(tree.$.rows.ids()).toEqual(['B', 'A']);
      expect(controls.stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });
});
