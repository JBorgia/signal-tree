import { describe, expect, it } from 'vitest';
import {
  entityMap,
  signalTree,
  transactions,
  SignalTreeRollbackError,
} from '../index';
import { selectNativeOwnershipTransactions } from './internals/native-ownership-public-selection';
import { getNativeOwnershipPublicExperiment } from '../enhancers/transactions/native-ownership-public-experiment';
const make = () => {
  const tree = signalTree(
    {
      rows: entityMap<{ id: string; n: number; extra?: number }, string>(),
      marker: 0,
    },
    { enhancers: [selectNativeOwnershipTransactions(transactions())] }
  );
  expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe(
    'native-pending'
  );
  return tree;
};
const rows = (...ids: string[]) => ids.map((id, n) => ({ id, n }));
describe('B authored topology repair controls', () => {
  it('rejects a pending rekey while preserving a later field write and held lifetime', () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'A', n: 1 });
      const held = tree.$.rows.byIdOrFail('A');
      const pending = tree.transact(() => {
        tree.$.marker(1);
        tree.$.rows.changeId('A', 'A2');
      });
      tree.$.rows.updateOne('A2', { n: 9 });
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['A']);
      expect(tree.$.rows.byIdOrFail('A')).toBe(held);
      expect(held()).toEqual({ id: 'A', n: 9 });
      expect(tree.$.marker()).toBe(0);
    } finally {
      tree.destroy();
    }
  });
  it('retains an actually authored later rekey when the earlier rekey is rejected', () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'A', n: 1 });
      const held = tree.$.rows.byIdOrFail('A');
      const pending = tree.transact(() => {
        tree.$.marker(1);
        tree.$.rows.changeId('A', 'A2');
      });
      tree.$.rows.changeId('A2', 'A3');
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['A3']);
      expect(tree.$.rows.byIdOrFail('A3')).toBe(held);
      // changeId authors the storage key; it does not rewrite the row payload.
      expect(held()).toEqual({ id: 'A', n: 1 });
      expect(tree.$.marker()).toBe(0);
    } finally {
      tree.destroy();
    }
  });
  it.each([{ n: 9 }, { extra: 9 }])(
    'refuses removing a pending-created lifetime with later field truth %j',
    (update) => {
      const tree = make();
      try {
        const pending = tree.transact(() => {
          tree.$.marker(1);
          tree.$.rows.addOne({ id: 'A', n: 1 });
        });
        const held = tree.$.rows.byIdOrFail('A');
        tree.$.rows.updateOne('A', update);
        expect(() => pending.rollback()).toThrow(SignalTreeRollbackError);
        expect(tree.$.rows.ids()).toEqual(['A']);
        expect(tree.$.rows.byIdOrFail('A')).toBe(held);
        expect(held()).toEqual({ id: 'A', n: 1, ...update });
        expect(tree.$.marker()).toBe(1);
        expect(getNativeOwnershipPublicExperiment(tree)?.stats().pending).toBe(
          1
        );
        pending.confirm();
        expect(held()).toEqual({ id: 'A', n: 1, ...update });
        expect(getNativeOwnershipPublicExperiment(tree)?.stats()).toEqual({
          pending: 0,
          ledgers: 0,
        });
      } finally {
        tree.destroy();
      }
    }
  );
  it('resolves several removed appended anchors while restoring several adjacent rows', () => {
    const tree = make();
    try {
      tree.$.rows.setAll(rows('z', 'a', 'b', 'c'));
      const b = tree.$.rows.byIdOrFail('b');
      const c = tree.$.rows.byIdOrFail('c');
      const pending = tree.transact(() => {
        tree.$.rows.addMany(rows('x', 'y', 'w'));
        tree.$.rows.removeMany(['b', 'c']);
      });
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['z', 'a', 'b', 'c']);
      expect(tree.$.rows.all()).toEqual(rows('z', 'a', 'b', 'c'));
      expect(tree.$.rows.byIdOrFail('b')).toBe(b);
      expect(tree.$.rows.byIdOrFail('c')).toBe(c);
      expect(getNativeOwnershipPublicExperiment(tree)?.stats()).toEqual({
        pending: 0,
        ledgers: 0,
      });
    } finally {
      tree.destroy();
    }
  });
  it('refuses an occupied rekey destination atomically and retries after it is freed', () => {
    const tree = make();
    try {
      tree.$.rows.addOne({ id: 'A', n: 1 });
      const held = tree.$.rows.byIdOrFail('A');
      const pending = tree.transact(() => {
        tree.$.marker(1);
        tree.$.rows.changeId('A', 'A2');
      });
      tree.$.rows.updateOne('A2', { n: 9 });
      tree.$.rows.addOne({ id: 'A', n: 100 });
      const replacement = tree.$.rows.byIdOrFail('A');
      expect(() => pending.rollback()).toThrow(SignalTreeRollbackError);
      expect(tree.$.marker()).toBe(1);
      expect(tree.$.rows.ids()).toEqual(['A2', 'A']);
      expect(tree.$.rows.byIdOrFail('A')).toBe(replacement);
      expect(replacement()).toEqual({ id: 'A', n: 100 });
      expect(held()).toEqual({ id: 'A', n: 9 });
      expect(getNativeOwnershipPublicExperiment(tree)?.stats().pending).toBe(1);
      tree.$.rows.removeOne('A');
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['A']);
      expect(tree.$.rows.byIdOrFail('A')).toBe(held);
      expect(held()).toEqual({ id: 'A', n: 9 });
      expect(tree.$.marker()).toBe(0);
    } finally {
      tree.destroy();
    }
  });
  it('failed preparation leaves mixed rekey and order settlement unchanged before retry', () => {
    const tree = make();
    try {
      tree.$.rows.setAll(rows('a', 'b', 'c'));
      const pending = tree.transact(() => {
        tree.$.marker(1);
        tree.$.rows.changeId('a', 'a2');
        tree.$.rows.addMany(rows('x', 'y'));
        tree.$.rows.removeOne('c');
      });
      tree.$.rows.updateOne('a2', { n: 9 });
      const before = tree.$.rows.all();
      const controls = getNativeOwnershipPublicExperiment(tree);
      if (!controls) throw new Error('B authority unavailable');
      controls.failPreparation(new Error('topology preparation fault'));
      expect(() => pending.rollback()).toThrow(SignalTreeRollbackError);
      expect(tree.$.rows.all()).toEqual(before);
      expect(tree.$.rows.ids()).toEqual(['a2', 'b', 'x', 'y']);
      expect(tree.$.marker()).toBe(1);
      expect(controls.stats().pending).toBe(1);
      pending.rollback();
      expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c']);
      expect(tree.$.rows.byIdOrFail('a')()).toEqual({ id: 'a', n: 9 });
      expect(tree.$.marker()).toBe(0);
      expect(controls.stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });
  it('publishes the complete restored order before a callback authors a newer field write', () => {
    const tree = make();
    let off: (() => void) | undefined;
    try {
      tree.$.rows.setAll(rows('a', 'b', 'c'));
      const pending = tree.transact(() => {
        tree.$.marker(1);
        tree.$.rows.addMany(rows('x', 'y'));
        tree.$.rows.removeOne('c');
      });
      const seen: unknown[] = [];
      off = tree.$.rows.tap({
        onAdd: (_row, id) => {
          if (id !== 'c') return;
          seen.push({
            ids: [...tree.$.rows.ids()],
            marker: tree.$.marker(),
            pending: getNativeOwnershipPublicExperiment(tree)?.stats().pending,
          });
          tree.$.rows.updateOne('c', { n: 9 });
        },
      });
      pending.rollback();
      expect(seen).toEqual([{ ids: ['a', 'b', 'c'], marker: 0, pending: 0 }]);
      expect(tree.$.rows.byIdOrFail('c')().n).toBe(9);
      pending.rollback();
      expect(tree.$.rows.byIdOrFail('c')().n).toBe(9);
    } finally {
      off?.();
      tree.destroy();
    }
  });
});
