import { act, render } from '@testing-library/react';
import { describe } from 'vitest';

import { entityMap, signalTree, transactions } from '@signal-tree/kernel';
// The shared contract is kernel TEST SUPPORT, excluded from the kernel build
// and deliberately not on its public barrel — so it is reached by path, the
// same way ssr-transfer.spec.ts reaches serialization.
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  transactionRealizationContract,
  type ConformanceRow,
  type EntityProjectionFrame,
  type MixedFrame,
  type Observation,
  type ValuePublicationFrame,
} from '../../kernel/src/transaction-realization-contract';
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
      rows: entityMap<ConformanceRow, string>({
        selectId: (r) => r.id,
      }).computed('names', (rows) => rows.map((row) => row.name)),
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

const projectionFrame = (
  $: Tree['$'],
  phase: string,
  enabled: boolean
): EntityProjectionFrame => {
  const scalar = $.scalar();
  if (!enabled) return { phase, scalar, projections: null };
  const node = $.rows.byId('A');
  const encode = (row: ConformanceRow | undefined) =>
    row ? `${row.id}:${row.name}` : null;
  return {
    phase,
    scalar,
    projections: {
      all: $.rows.all().map((row) => `${row.id}:${row.name}`),
      ids: [...$.rows.ids()],
      count: $.rows.count(),
      empty: $.rows.empty(),
      map: [...$.rows.asMap()].map(([key, row]) => `${key}:${row.name}`),
      hasA: $.rows.has('A')(),
      where: $.rows
        .where(matchesA)()
        .map((row) => `${row.id}:${row.name}`),
      find: encode($.rows.find(matchesA)()),
      slice: [...$.rows.names()],
      activeId: $.rows.activeId() ?? null,
      activeEntity: encode($.rows.activeEntity()),
      row: node?.()?.name ?? null,
      field: node?.name() ?? null,
    },
  };
};
const matchesA = (row: ConformanceRow) => row.id === 'A';

describe('@signal-tree/react — pending realization conformance', () => {
  transactionRealizationContract<Tree>({
    framework: 'react',

    createStore() {
      const tree = build();
      return {
        tree,
        dispose: () => tree.destroy(),
      };
    },

    transact: (tree, fn) => tree.transact(fn),

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

    observeValues: (tree, phase) => {
      const seen: ValuePublicationFrame[] = [];
      let latest!: ValuePublicationFrame;
      // Stable primitive snapshot; record phase at actual render execution.
      const select = ($: Tree['$']) =>
        JSON.stringify([
          $.scalar(),
          $.rows.byId('A')?.()?.name,
          $.rows.all().find((row) => row.id === 'A')?.name,
        ]);
      function Probe() {
        const encoded = useSignalTree(tree, select as never) as string;
        const [scalar, row, all] = JSON.parse(encoded) as [
          number,
          string,
          string
        ];
        latest = { phase: phase(), scalar, row, all };
        seen.push(latest);
        return null;
      }
      const view = render(<Probe />);
      return [{ seen, current: () => latest, dispose: () => view.unmount() }];
    },

    selectRow: (tree, id) => tree.$.rows.setActiveId(id),
    rekeyRow: (tree, from, to) => tree.$.rows.changeId(from, to),
    observeProjections: (tree, phase, enabled) => {
      const seen: EntityProjectionFrame[] = [];
      let latest!: EntityProjectionFrame;
      // Phase belongs to execution; exclude it from stable external snapshots.
      const select = ($: Tree['$']) =>
        JSON.stringify(projectionFrame($, '', enabled()));
      function ProjectionProbe() {
        const encoded = useSignalTree(tree, select as never) as string;
        latest = {
          ...(JSON.parse(encoded) as EntityProjectionFrame),
          phase: phase(),
        };
        seen.push(latest);
        return null;
      }
      const view = render(<ProjectionProbe />);
      return [{ seen, current: () => latest, dispose: () => view.unmount() }];
    },

    async flush() {
      await act(async () => {
        await settleKernel();
      });
    },
  });
});
