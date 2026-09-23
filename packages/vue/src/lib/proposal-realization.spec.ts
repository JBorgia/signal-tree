import { nextTick, watchEffect } from 'vue';
import { describe } from 'vitest';

import {
  proposalRealizationContract,
  type ConformanceRow,
  type MixedFrame,
  type Observation,
} from '../../../kernel/src/proposal-realization-contract';
import { entityMap, signalTree, transactions } from '../index';

/**
 * PROPOSAL-0 Phase B — Vue realization.
 *
 * Only physical hooks live here; every assertion is the shared contract's.
 * Vue leaves are real Vue refs: read and write through `.value`, observe with
 * `watchEffect`, flush with `nextTick`.
 */

type Tree = ReturnType<typeof build>;

const build = () =>
  signalTree(
    {
      scalar: 0,
      rows: entityMap<ConformanceRow, string>({ selectId: (r) => r.id }),
    },
    { enhancers: [transactions()] }
  );

const observe = <T>(read: () => T): Observation<T> => {
  const seen: T[] = [];
  let latest!: T;
  const stop = watchEffect(() => {
    const value = read();
    latest = value;
    seen.push(value);
  });
  return { seen, current: () => latest, dispose: stop };
};

describe('@signal-tree/vue — proposal realization conformance', () => {
  proposalRealizationContract<Tree>({
    framework: 'vue',

    createStore() {
      const tree = build();
      return { tree, dispose: () => tree.destroy() };
    },

    propose: (tree, fn) => tree.propose(fn),

    writeScalar: (tree, value) => {
      tree.$.scalar.value = value;
    },
    readScalar: (tree) => tree.$.scalar.value,
    addRow: (tree, row) => tree.$.rows.addOne(row),
    removeRow: (tree, id) => tree.$.rows.removeOne(id),
    rowIds: (tree) => [...tree.$.rows.ids.value],
    realizeRowName: (tree, id, name) => tree.$.rows.updateOne(id, { name }),

    observeScalar: (tree) => observe(() => tree.$.scalar.value),
    holdEntity: (tree, id) => {
      // Resolve ONCE, as a component would with a row prop.
      const held = tree.$.rows.byId(id);
      return observe(() => held?.());
    },
    observeMixed: (tree) =>
      observe<MixedFrame>(() => ({
        scalar: tree.$.scalar.value,
        ids: [...tree.$.rows.ids.value],
      })),

    flush: async () => {
      await nextTick();
      await Promise.resolve();
      await nextTick();
    },
  });
});
