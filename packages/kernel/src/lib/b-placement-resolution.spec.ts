import { describe, expect, it, vi } from 'vitest';
import {
  entityMap,
  signalTree,
  transactions,
  SignalTreeRollbackError,
} from '../index';
import { selectNativeOwnershipTransactions } from './internals/native-ownership-public-selection';
import { getNativeOwnershipPublicExperiment } from '../enhancers/transactions/native-ownership-public-experiment';
const row = (id: string) => ({ id });
const make = (...ids: string[]) => {
  const tree = signalTree(
    { marker: 0, rows: entityMap<{ id: string }, string>() },
    {
      enhancers: [selectNativeOwnershipTransactions(transactions())],
    }
  );
  tree.$.rows.setAll(ids.map(row));
  return tree;
};
const pending = (tree: ReturnType<typeof make>) =>
  getNativeOwnershipPublicExperiment(tree)!.stats().pending;

describe('B sparse successor/predecessor resolution', () => {
  it('restores an original tail after its surviving predecessor before a later append', () => {
    const tree = make('A', 'B');
    try {
      const held = tree.$.rows.byIdOrFail('B');
      const owner = tree.transact(() => tree.$.rows.removeOne('B'));
      tree.$.rows.addOne(row('Z'));
      owner.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B', 'Z']);
      expect(tree.$.rows.byIdOrFail('B')).toBe(held);
      expect(pending(tree)).toBe(0);
    } finally {
      tree.destroy();
    }
  });
  it('does not turn a missing original sole predecessor into tail authority or retarget its replacement', () => {
    const tree = make('A', 'B');
    try {
      const oldA = tree.$.rows.byIdOrFail('A');
      const held = tree.$.rows.byIdOrFail('B');
      const owner = tree.transact(() => {
        tree.$.marker(1);
        tree.$.rows.removeOne('B');
      });
      tree.$.rows.removeOne('A');
      tree.$.rows.addOne(row('A'));
      const replacement = tree.$.rows.byIdOrFail('A');
      expect(replacement).not.toBe(oldA);
      for (let i = 0; i < 2; i++) {
        expect(() => owner.rollback()).toThrow(SignalTreeRollbackError);
        expect(tree.$.rows.ids()).toEqual(['A']);
        expect(tree.$.marker()).toBe(1);
        expect(held()).toBeUndefined();
        expect(oldA()).toBeUndefined();
        expect(tree.$.rows.byIdOrFail('A')).toBe(replacement);
        expect(pending(tree)).toBe(1);
      }
      owner.confirm();
      expect(pending(tree)).toBe(0);
    } finally {
      tree.destroy();
    }
  });
  it('orders a same-target restored predecessor before its dependent tail', () => {
    const tree = make('A', 'B');
    try {
      const a = tree.$.rows.byIdOrFail('A');
      const b = tree.$.rows.byIdOrFail('B');
      const owner = tree.transact(() => {
        tree.$.rows.removeOne('B');
        tree.$.rows.removeOne('A');
      });
      tree.$.rows.addOne(row('Z'));
      owner.rollback();
      expect(tree.$.rows.ids()).toEqual(['Z', 'A', 'B']);
      expect(tree.$.rows.byIdOrFail('A')).toBe(a);
      expect(tree.$.rows.byIdOrFail('B')).toBe(b);
      expect(pending(tree)).toBe(0);
    } finally {
      tree.destroy();
    }
  });
  it('propagates an internal successor read failure atomically instead of using its predecessor, then retries', () => {
    const tree = make('A', 'B', 'C');
    const native = tree.$.rows as unknown as {
      __acquireEntityHandleForTesting(key: string): { subjectId: number };
      __readOwnershipSubject(subject: number): unknown;
    };
    let restore = () => {
      // No injected reader exists until setup completes.
    };
    try {
      const c = native.__acquireEntityHandleForTesting('C').subjectId;
      const held = tree.$.rows.byIdOrFail('B');
      const owner = tree.transact(() => {
        tree.$.marker(1);
        tree.$.rows.removeOne('B');
      });
      const fault = new Error('successor read fault');
      const read = native.__readOwnershipSubject.bind(native);
      const spy = vi
        .spyOn(native, '__readOwnershipSubject')
        .mockImplementation((subject) => {
          if (subject === c) throw fault;
          return read(subject);
        });
      restore = () => spy.mockRestore();
      let refused: unknown;
      try {
        owner.rollback();
      } catch (error) {
        refused = error;
      }
      expect(refused).toBeInstanceOf(SignalTreeRollbackError);
      expect(refused).toHaveProperty('cause', fault);
      expect(tree.$.rows.ids()).toEqual(['A', 'C']);
      expect(tree.$.marker()).toBe(1);
      expect(held()).toBeUndefined();
      expect(pending(tree)).toBe(1);
      restore();
      owner.rollback();
      expect(tree.$.rows.ids()).toEqual(['A', 'B', 'C']);
      expect(tree.$.rows.byIdOrFail('B')).toBe(held);
      expect(tree.$.marker()).toBe(0);
      expect(pending(tree)).toBe(0);
    } finally {
      restore();
      tree.destroy();
    }
  });
});
