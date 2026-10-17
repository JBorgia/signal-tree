import { describe, expect, it } from 'vitest';
import {
  signalTree,
  entityMap,
  transactions,
  SignalTreeRollbackError,
} from '../index';
import { selectNativeOwnershipTransactions } from './internals/native-ownership-public-selection';
import { getNativeOwnershipPublicExperiment } from '../enhancers/transactions/native-ownership-public-experiment';
const row = (id: string) => ({ id, n: 0 });
const make = (...ids: string[]) => {
  const tree = signalTree(
    { rows: entityMap<{ id: string; n: number }, string>(), marker: 0 },
    { enhancers: [selectNativeOwnershipTransactions(transactions())] }
  );
  tree.$.rows.setAll(ids.map(row));
  return tree;
};
const controls = (tree: ReturnType<typeof make>) => {
  const value = getNativeOwnershipPublicExperiment(tree);
  if (!value) throw new Error('B authority unavailable');
  return value;
};
describe('operation admission partial-order discriminators', () => {
  it('front placement does not author the observed relative order of unselected subjects', () => {
    const tree = make('A', 'B', 'C');
    try {
      const pending = tree.transact(() =>
        tree.$.rows.setAll(['C', 'A', 'B'].map(row))
      );
      tree.$.rows.prependMany([row('B')], { mode: 'overwrite' });
      expect(tree.$.rows.ids()).toEqual(['B', 'C', 'A']);
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['B', 'A', 'C']);
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });
  it('later append does not commit earlier speculative relative order', () => {
    const tree = make('A', 'B', 'C');
    try {
      const pending = tree.transact(() =>
        tree.$.rows.setAll(['C', 'A', 'B'].map(row))
      );
      tree.$.rows.addOne(row('D'));
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B', 'C', 'D']);
      expect(tree.$.rows.all()).toEqual(['A', 'B', 'C', 'D'].map(row));
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });
  it('same-author append composes with its earlier exact-order dependency', () => {
    const tree = make('A', 'B');
    try {
      const creator = tree.transact(() => {
        tree.$.marker(1);
        tree.$.rows.addOne(row('C'));
      });
      const dependent = tree.transact(() => {
        tree.$.rows.setAll(['C', 'A', 'B'].map(row));
        tree.$.rows.addOne(row('D'));
      });
      expect(() => creator.rollback()).toThrow(SignalTreeRollbackError);
      expect(tree.$.rows.ids()).toEqual(['C', 'A', 'B', 'D']);
      expect(tree.$.marker()).toBe(1);
      expect(controls(tree).stats().pending).toBe(2);
      dependent.rollback();
      creator.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B']);
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });
  it('reversible removal does not erase a latent pending-order dependency', () => {
    const tree = make('A', 'B');
    try {
      const creator = tree.transact(() => {
        tree.$.marker(1);
        tree.$.rows.addOne(row('C'));
      });
      const held = tree.$.rows.byIdOrFail('C');
      const ordering = tree.transact(() =>
        tree.$.rows.setAll(['C', 'A', 'B'].map(row))
      );
      const removal = tree.transact(() => tree.$.rows.removeOne('C'));
      expect(() => creator.rollback()).toThrow(SignalTreeRollbackError);
      expect(tree.$.rows.ids()).toEqual(['A', 'B']);
      expect(tree.$.marker()).toBe(1);
      expect(controls(tree).stats().pending).toBe(3);
      removal.rollback();
      expect(tree.$.rows.ids()).toEqual(['C', 'A', 'B']);
      expect(tree.$.rows.byIdOrFail('C')).toBe(held);
      ordering.rollback();
      creator.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B']);
      expect(held()).toBeUndefined();
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });
});
