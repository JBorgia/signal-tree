import { act, render } from '@testing-library/react';
import { describe } from 'vitest';

import { entityMap, signalTree, transactions } from '@signal-tree/kernel';
import {
  proposalRealizationContract,
  type ConformanceRow,
  type MixedFrame,
  type Observation,
} from '../../kernel/src/proposal-realization-contract';
import { useSignalTree } from './use-signal-tree';

/**
 * PROPOSAL-0 Phase B — React realization.
 *
 * Only physical hooks live here; every assertion is the shared contract's.
 *
 * React's carrier is `useSyncExternalStore` via `useSignalTree`, so an
 * observation is a RENDERED COMPONENT rather than a standalone subscription —
 * which is the point: the contract asks whether the value reaches what a
 * component actually holds, and for React that means reaching a render.
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

const settleKernel = async (): Promise<void> => {
  for (let index = 0; index < 4; index++) await Promise.resolve();
};

/**
 * React's carrier requires an `Object.is`-stable snapshot: `useSignalTree`
 * calls `selector(owner.$)` inside `useSyncExternalStore`, so a selector that
 * builds a fresh object each  re-renders forever. Both constraints — reading
 * through the PROVIDED `$` for dependency tracking, and returning a stable
 * value — are physical facts of this adapter, so the hooks absorb them rather
 * than leaking them into the shared contract.
 */
const observe = <T,>(
  tree: Tree,
  select: ($: Tree['$']) => T
): Observation<T> => {
  const seen: T[] = [];
  let latest!: T;

  function Probe() {
    const value = useSignalTree(tree, select as never) as T;
    latest = value;
    if (seen.length === 0 || !Object.is(seen[seen.length - 1] as T, value)) {
      seen.push(value);
    }
    return null;
  }

  const view = render(<Probe />);
  return {
    seen,
    current: () => latest,
    dispose: () => view.unmount(),
  };
};

/** Encode the mixed frame as a stable primitive, then decode for the contract. */
const encodeFrame = ($: Tree['$']): string =>
  `${$.scalar()}|${[...$.rows.ids()].join(',')}`;

const decodeFrame = (encoded: string): MixedFrame => {
  const [scalar, ids] = encoded.split('|');
  return {
    scalar: Number(scalar),
    ids: ids === '' ? [] : (ids ?? '').split(','),
  };
};

describe('@signal-tree/react — proposal realization conformance', () => {
  proposalRealizationContract<Tree>({
    framework: 'react',

    createStore() {
      const tree = build();
      return {
        tree,
        dispose: () => tree.destroy(),
      };
    },

    propose: (tree, fn) => tree.propose(fn),

    writeScalar: (tree, value) => tree.$.scalar(value),
    readScalar: (tree) => tree.$.scalar(),
    addRow: (tree, row) => tree.$.rows.addOne(row),
    removeRow: (tree, id) => tree.$.rows.removeOne(id),
    rowIds: (tree) => tree.$.rows.ids(),
    realizeRowName: (tree, id, name) => tree.$.rows.updateOne(id, { name }),

    observeScalar: (tree) => observe(tree, ($) => $.scalar()),
    holdEntity: (tree, id) => {
      // Resolve the entity reference ONCE, as a component would when a row
      // arrives as a prop. Re-resolving by id per render would hide the
      // retargeting bug case 5 exists to catch. The name is selected as a
      // primitive to keep the snapshot Object.is-stable.
      const held = tree.$.rows.byId(id);
      const names = observe(tree, () => held?.()?.name);
      return {
        get seen() {
          return names.seen.map((name) =>
            name === undefined ? undefined : { id, name }
          );
        },
        current: () => {
          const name = names.current();
          return name === undefined ? undefined : { id, name };
        },
        dispose: names.dispose,
      };
    },
    observeMixed: (tree) => {
      const encoded = observe(tree, encodeFrame);
      return {
        get seen() {
          return encoded.seen.map(decodeFrame);
        },
        current: () => decodeFrame(encoded.current()),
        dispose: encoded.dispose,
      };
    },

    async flush() {
      await act(async () => {
        await settleKernel();
      });
    },
  });
});
