import { expect, it } from 'vitest';

import { entityMap, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';

type Row = { id: string; n: number };
const rows = (ids: readonly string[]): Row[] => ids.map((id, n) => ({ id, n }));

// This diagnostic observes native Set construction at the existing private
// helper. A positive reordered-survivor control below guards the stack filter.
// It is excluded from performance measurements and restored synchronously.
function countSurvivorSets<T>(work: () => T) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Set');
  if (!descriptor) throw new Error('Missing Set descriptor');
  const inputs: number[] = [];
  const observed = new Proxy(Set, {
    construct(target, argumentsList, newTarget) {
      if (new Error().stack?.includes('survivingOrderChanged')) {
        const input: unknown = argumentsList[0];
        if (!Array.isArray(input))
          throw new Error('Unexpected survivor Set input');
        inputs.push(input.length);
      }
      return Reflect.construct(target, argumentsList, newTarget);
    },
  });
  Object.defineProperty(globalThis, 'Set', { ...descriptor, value: observed });
  try {
    return { value: work(), inputs };
  } finally {
    Object.defineProperty(globalThis, 'Set', descriptor);
  }
}

for (const [before, after] of [
  [[], ['a', 'b', 'c']],
  [['a'], ['c', 'a', 'b']],
  [['a', 'b', 'c'], []],
  [['a', 'b', 'c'], ['b']],
] as const) {
  it(`does not construct survivor sets for ${before.length} -> ${after.length} rows`, () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>() },
      { enhancers: [transactions()] }
    );
    try {
      tree.$.rows.setAll(rows(before));
      getPathNotifier().flushSync();
      const measured = countSurvivorSets(() =>
        tree.transact(() => {
          tree.$.rows.setAll(rows(after));
        })
      );
      expect(tree.$.rows.ids()).toEqual([...after]);
      expect(tree.$.rows.all()).toEqual(rows(after));
      expect(measured.inputs).toEqual([]);
      getPathNotifier().flushSync();
      measured.value.rollback();
      getPathNotifier().flushSync();
      expect(tree.$.rows.ids()).toEqual([...before]);
      expect(tree.$.rows.all()).toEqual(rows(before));
    } finally {
      tree.destroy();
      getPathNotifier().flushSync();
    }
  });
}

it('still detects reordered survivors and restores their original order on rollback', () => {
  const tree = signalTree(
    { rows: entityMap<Row, string>() },
    { enhancers: [transactions()] }
  );
  const notifier = getPathNotifier();
  const before = rows(['a', 'b', 'c']);
  try {
    tree.$.rows.setAll(before);
    notifier.flushSync();
    const heldA = tree.$.rows.byIdOrFail('a');
    const measured = countSurvivorSets(() =>
      tree.transact(() => {
        tree.$.rows.setAll(rows(['c', 'd', 'a']));
      })
    );
    // The work detector must actually observe the retained generic branch.
    expect(measured.inputs.length).toBeGreaterThanOrEqual(2);
    expect(measured.inputs.every((length) => length === 3)).toBe(true);
    expect(tree.$.rows.ids()).toEqual(['c', 'd', 'a']);
    notifier.flushSync();
    measured.value.rollback();
    notifier.flushSync();
    expect(tree.$.rows.all()).toEqual(before);
    expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c']);
    expect(tree.$.rows.byIdOrFail('a')).toBe(heldA);
  } finally {
    tree.destroy();
    notifier.flushSync();
  }
});
