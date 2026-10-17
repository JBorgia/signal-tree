import { describe, expect, it } from 'vitest';
import {
  entityMap,
  signalTree,
  transactions,
  SignalTreeRollbackError,
} from '../index';
import { selectNativeOwnershipTransactions } from './internals/native-ownership-public-selection';
import { getNativeOwnershipPublicExperiment } from '../enhancers/transactions/native-ownership-public-experiment';
import { peekInternalTransactionRuntime } from '../enhancers/transactions/transactions';

const row = (id: string) => ({ id });
const scenarios = [
  { name: 'moved', initial: ['A', 'B', 'C'], expected: ['B', 'C', 'A'] },
  {
    name: 'moved-farther',
    initial: ['A', 'B', 'C', 'D'],
    expected: ['D', 'B', 'C', 'A'],
  },
  { name: 'removed', initial: ['A', 'B', 'C'], expected: ['A', 'B'] },
  { name: 'replaced', initial: ['A', 'B', 'C'], expected: ['C', 'A', 'B'] },
  { name: 'rekeyed', initial: ['A', 'B', 'C'], expected: ['A', 'B', 'C2'] },
  { name: 'same-target', initial: ['A', 'B', 'C'], expected: ['A', 'B', 'C'] },
  { name: 'temporary', initial: ['A', 'B'], expected: ['A', 'B'] },
  {
    name: 'several-temporary',
    initial: ['A', 'B', 'C'],
    expected: ['A', 'B', 'C'],
  },
  { name: 'originally-neighborless', initial: ['B'], expected: ['Z', 'B'] },
] as const;

for (const arm of ['incumbent', 'B'] as const) {
  const make = () =>
    signalTree(
      { scalar: 0, rows: entityMap<{ id: string }, string>() },
      {
        enhancers: [
          arm === 'B'
            ? selectNativeOwnershipTransactions(transactions())
            : transactions(),
        ],
      }
    );
  const pendingCount = (tree: ReturnType<typeof make>) =>
    arm === 'B'
      ? getNativeOwnershipPublicExperiment(tree)!.stats().pending
      : peekInternalTransactionRuntime(tree)!.getPendingTurnCount();
  describe(`approved successor-placement boundaries: ${arm}`, () => {
    for (const scenario of scenarios)
      it(scenario.name, () => {
        const tree = make();
        try {
          if (arm === 'B')
            expect(getNativeOwnershipPublicExperiment(tree)?.authority).toBe(
              'native-pending'
            );
          else expect(getNativeOwnershipPublicExperiment(tree)).toBeUndefined();
          tree.$.rows.setAll(scenario.initial.map(row));
          const heldB = tree.$.rows.byIdOrFail('B');
          const heldC = tree.$.rows.byId('C');
          const pending = tree.transact(() => {
            tree.$.scalar(1);
            if (scenario.name === 'temporary') tree.$.rows.addOne(row('X'));
            if (scenario.name === 'several-temporary')
              tree.$.rows.addMany(['X', 'Y'].map(row));
            tree.$.rows.removeOne('B');
            if (
              scenario.name === 'same-target' ||
              scenario.name === 'several-temporary'
            )
              tree.$.rows.removeOne('C');
          });
          expect(pendingCount(tree)).toBe(1);
          expect(heldB()).toBeUndefined();
          switch (scenario.name) {
            case 'moved':
              tree.$.rows.prependMany([row('C')], { mode: 'overwrite' });
              break;
            case 'moved-farther':
              tree.$.rows.setAll(['D', 'C', 'A'].map(row));
              break;
            case 'removed':
              tree.$.rows.removeOne('C');
              break;
            case 'replaced':
              tree.$.rows.removeOne('C');
              tree.$.rows.prependMany([row('C')]);
              break;
            case 'rekeyed':
              tree.$.rows.changeId('C', 'C2');
              break;
            case 'originally-neighborless':
              tree.$.rows.addOne(row('Z'));
              break;
          }
          const replacement =
            scenario.name === 'replaced'
              ? tree.$.rows.byIdOrFail('C')
              : undefined;
          if (replacement) expect(replacement).not.toBe(heldC);
          pending.rollback();
          expect(tree.$.rows.ids()).toEqual(scenario.expected);
          expect(tree.$.rows.all().map((value) => value.id)).toEqual(
            scenario.expected.map((id) => (id === 'C2' ? 'C' : id))
          );
          expect(tree.$.rows.byIdOrFail('B')).toBe(heldB);
          expect(heldB()).toEqual(row('B'));
          expect(tree.$.scalar()).toBe(0);
          expect(pendingCount(tree)).toBe(0);
          if (
            heldC &&
            (scenario.name === 'removed' || scenario.name === 'replaced')
          )
            expect(heldC()).toBeUndefined();
          if (replacement)
            expect(tree.$.rows.byIdOrFail('C')).toBe(replacement);
          if (scenario.name === 'rekeyed')
            expect(tree.$.rows.byIdOrFail('C2')).toBe(heldC);
          if (
            scenario.name === 'same-target' ||
            scenario.name === 'several-temporary'
          )
            expect(tree.$.rows.byIdOrFail('C')).toBe(heldC);
          if (scenario.name === 'moved') {
            tree.$.rows.prependMany([row('A')], { mode: 'overwrite' });
            expect(tree.$.rows.ids()).toEqual(['A', 'B', 'C']);
          } else tree.$.rows.addOne(row('later'));
          const afterIndependentWrite = tree.$();
          pending.rollback();
          expect(tree.$()).toEqual(afterIndependentWrite);
          expect(pendingCount(tree)).toBe(0);
        } finally {
          tree.destroy();
        }
      });
    it('lost original anchors refuse atomically despite a fresh same-key successor', () => {
      const tree = make();
      try {
        tree.$.rows.setAll(['A', 'B', 'C'].map(row));
        const heldB = tree.$.rows.byIdOrFail('B');
        const oldC = tree.$.rows.byIdOrFail('C');
        const pending = tree.transact(() => {
          tree.$.scalar(1);
          tree.$.rows.removeOne('B');
        });
        tree.$.rows.removeMany(['A', 'C']);
        tree.$.rows.addOne(row('C'));
        const freshC = tree.$.rows.byIdOrFail('C');
        expect(freshC).not.toBe(oldC);
        const before = tree.$();
        for (let attempt = 0; attempt < 2; attempt++) {
          expect(() => pending.rollback()).toThrow(SignalTreeRollbackError);
          expect(tree.$()).toEqual(before);
          expect(tree.$.rows.ids()).toEqual(['C']);
          expect(tree.$.scalar()).toBe(1);
          expect(heldB()).toBeUndefined();
          expect(oldC()).toBeUndefined();
          expect(tree.$.rows.byIdOrFail('C')).toBe(freshC);
          expect(pendingCount(tree)).toBe(1);
        }
        pending.confirm();
        expect(pendingCount(tree)).toBe(0);
        expect(tree.$()).toEqual(before);
      } finally {
        tree.destroy();
      }
    });
  });
}
