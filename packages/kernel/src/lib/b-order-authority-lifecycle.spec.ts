import { describe, expect, it } from 'vitest';
import {
  entityMap,
  signalTree,
  transactions,
  SignalTreeRollbackError,
} from '../index';
import { selectNativeOwnershipTransactions } from './internals/native-ownership-public-selection';
import { getNativeOwnershipPublicExperiment } from '../enhancers/transactions/native-ownership-public-experiment';
import {
  admitNativeOrder,
  settleNativeOrder,
  projectNativeOrder,
  nativeOrderRequires,
} from './internals/native-order-admission-experiment';
const row = (id: string) => ({ id, n: 0 });
const make = () => {
  const tree = signalTree(
    { rows: entityMap<{ id: string; n: number }, string>() },
    { enhancers: [selectNativeOwnershipTransactions(transactions())] }
  );
  tree.$.rows.setAll(['A', 'B', 'C'].map(row));
  return tree;
};
const controls = (tree: ReturnType<typeof make>) => {
  const result = getNativeOwnershipPublicExperiment(tree);
  if (!result) throw new Error('B must be active');
  return result;
};
describe('B ordering authority lifecycle', () => {
  it.each(['rollback', 'confirm'] as const)(
    'newer confirmed pure order survives older %s',
    (terminal) => {
      const tree = make();
      try {
        const older = tree.transact(() =>
          tree.$.rows.setAll(['C', 'A', 'B'].map(row))
        );
        const newer = tree.transact(() =>
          tree.$.rows.setAll(['B', 'C', 'A'].map(row))
        );
        newer.confirm();
        expect(tree.$.rows.ids()).toEqual(['B', 'C', 'A']);
        older[terminal]();
        expect(tree.$.rows.ids()).toEqual(['B', 'C', 'A']);
        expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
      } finally {
        tree.destroy();
      }
    }
  );
  it('pending supersession remains reversible through failed settlement and retry', () => {
    const tree = make();
    try {
      const older = tree.transact(() =>
        tree.$.rows.setAll(['C', 'A', 'B'].map(row))
      );
      const newer = tree.transact(() =>
        tree.$.rows.setAll(['B', 'C', 'A'].map(row))
      );
      controls(tree).failPreparation(new Error('settlement preparation'));
      expect(() => newer.rollback()).toThrow(SignalTreeRollbackError);
      expect(tree.$.rows.ids()).toEqual(['B', 'C', 'A']);
      expect(controls(tree).stats().pending).toBe(2);
      newer.rollback();
      expect(tree.$.rows.ids()).toEqual(['C', 'A', 'B']);
      older.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B', 'C']);
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });
  it('committed replacement releases old dependency-only authority without restoring it on a new interval', () => {
    const tree = make();
    try {
      const rekey = tree.transact(() => tree.$.rows.changeId('C', 'C2'));
      const ordering = tree.transact(() =>
        tree.$.rows.setAll(['C2', 'A', 'B'].map(row))
      );
      ordering.confirm();
      tree.$.rows.setAll(['B', 'A'].map(row));
      const newer = tree.transact(() =>
        tree.$.rows.setAll(['A', 'B'].map(row))
      );
      newer.rollback();
      expect(tree.$.rows.ids()).toEqual(['B', 'A']);
      rekey.rollback();
      expect(tree.$.rows.ids()).toEqual(['B', 'A']);
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });
  it('failed replacement preparation leaves prior authority intact until useful retry', () => {
    const tree = make();
    try {
      const rekey = tree.transact(() => tree.$.rows.changeId('C', 'C2'));
      const ordering = tree.transact(() =>
        tree.$.rows.setAll(['C2', 'A', 'B'].map(row))
      );
      ordering.confirm();
      const fault = new Error('replacement preparation');
      controls(tree).failPreparation(fault);
      expect(() => tree.$.rows.setAll(['B', 'A'].map(row))).toThrow(fault);
      expect(tree.$.rows.ids()).toEqual(['C2', 'A', 'B']);
      expect(controls(tree).stats().pending).toBe(1);
      tree.$.rows.setAll(['B', 'A'].map(row));
      rekey.rollback();
      expect(tree.$.rows.ids()).toEqual(['B', 'A']);
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });
  it('newer confirmed exact retains its own pending-lifetime dependency', () => {
    const tree = make();
    try {
      const creator = tree.transact(() => tree.$.rows.addOne(row('D')));
      const older = tree.transact(() =>
        tree.$.rows.setAll(['D', 'A', 'B', 'C'].map(row))
      );
      const newer = tree.transact(() =>
        tree.$.rows.setAll(['B', 'D', 'C', 'A'].map(row))
      );
      newer.confirm();
      older.rollback();
      expect(() => creator.rollback()).toThrow(SignalTreeRollbackError);
      expect(tree.$.rows.ids()).toEqual(['B', 'D', 'C', 'A']);
      expect(controls(tree).stats().pending).toBe(1);
      creator.confirm();
      expect(tree.$.rows.ids()).toEqual(['B', 'D', 'C', 'A']);
      expect(controls(tree).stats()).toEqual({ pending: 0, ledgers: 0 });
    } finally {
      tree.destroy();
    }
  });
  it('confirmation retires obsolete exact authority and dependencies but pending hiding preserves them', () => {
    const older = admitNativeOrder(
      undefined,
      [1, 2, 3],
      { kind: 'exact', subjects: [3, 1, 2] },
      10,
      1
    );
    const newer = admitNativeOrder(
      older,
      [3, 1, 2],
      { kind: 'exact', subjects: [2, 1] },
      20,
      2
    );
    expect(nativeOrderRequires(newer, 3, 0)).toBe(true);
    expect(projectNativeOrder(settleNativeOrder(newer, 20, false))).toEqual([
      3, 1, 2,
    ]);
    const confirmed = settleNativeOrder(newer, 20, true);
    expect(nativeOrderRequires(confirmed, 3, 0)).toBe(false);
    expect(confirmed.contributions.some((fact) => fact.author === 10)).toBe(
      false
    );
    expect(projectNativeOrder(settleNativeOrder(confirmed, 10, false))).toEqual(
      [2, 1]
    );
  });
});
