import { createEffect, createRoot } from 'solid-js';
import { describe } from 'vitest';

import {
  proposalRealizationContract,
  type ConformanceRow,
  type MixedFrame,
  type Observation,
} from '../../../kernel/src/proposal-realization-contract';
import { entityMap, signalTree, transactions } from '../index';

/**
 * PROPOSAL-0 Phase B — Solid realization.
 *
 * Only physical hooks live here. Every assertion is the shared contract's, so
 * Solid having one existing spec file and Angular having 29 stops being the
 * measure of whether Proposal is supported.
 *
 * Solid leaves are real Solid accessors: read by calling, write with `.set()`
 * (README, and its types reject the callable-write form). That grammar
 * difference is exactly why the contract delegates writes.
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

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Track a reactive read inside its own root so disposal is real. */
const observe = <T>(read: () => T): Observation<T> => {
  const seen: T[] = [];
  let latest!: T;
  const dispose = createRoot((disposeRoot) => {
    createEffect(() => {
      const value = read();
      latest = value;
      seen.push(value);
    });
    return disposeRoot;
  });
  return {
    seen,
    current: () => latest,
    dispose,
  };
};

describe('@signal-tree/solid — proposal realization conformance', () => {
  proposalRealizationContract<Tree>({
    framework: 'solid',

    createStore() {
      let tree!: Tree;
      const disposeRoot = createRoot((dispose) => {
        tree = build();
        return dispose;
      });
      return {
        tree,
        dispose() {
          disposeRoot();
          tree.destroy();
        },
      };
    },

    propose: (tree, fn) => tree.propose(fn),

    writeScalar: (tree, value) => tree.$.scalar.set(value),
    readScalar: (tree) => tree.$.scalar(),
    addRow: (tree, row) => tree.$.rows.addOne(row),
    removeRow: (tree, id) => tree.$.rows.removeOne(id),
    rowIds: (tree) => tree.$.rows.ids(),
    realizeRowName: (tree, id, name) => tree.$.rows.updateOne(id, { name }),

    observeScalar: (tree) => observe(() => tree.$.scalar()),
    holdEntity: (tree, id) => {
      // Hold the entity reference ONCE, the way a component would, and keep
      // reading through it. Re-resolving by id each tick would hide exactly the
      // retargeting bug case 5 exists to catch.
      const held = tree.$.rows.byId(id);
      return observe(() => held?.());
    },
    observeMixed: (tree) =>
      observe<MixedFrame>(() => ({
        scalar: tree.$.scalar(),
        ids: [...tree.$.rows.ids()],
      })),

    flush: nextTick,
  });
});
