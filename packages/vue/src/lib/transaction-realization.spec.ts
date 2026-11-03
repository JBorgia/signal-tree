import { nextTick, watchEffect } from 'vue';
import { describe } from 'vitest';

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
} from '../../../kernel/src/transaction-realization-contract';
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
      rows: entityMap<ConformanceRow, string>({
        selectId: (r) => r.id,
      }).computed('names', (rows) => rows.map((row) => row.name)),
    },
    { enhancers: [transactions()] }
  );

const observe = <T>(
  read: () => T,
  flush: 'pre' | 'sync' = 'pre'
): Observation<T> => {
  const seen: T[] = [];
  let latest!: T;
  const stop = watchEffect(
    () => {
      const value = read();
      latest = value;
      seen.push(value);
    },
    { flush }
  );
  return { seen, current: () => latest, dispose: stop };
};

const projectionFrame = (
  $: Tree['$'],
  phase: string,
  enabled: boolean
): EntityProjectionFrame => {
  const scalar = $.scalar.value;
  if (!enabled) return { phase, scalar, projections: null };
  const node = $.rows.byId('A');
  const encode = (row: ConformanceRow | undefined) =>
    row ? `${row.id}:${row.name}` : null;
  return {
    phase,
    scalar,
    projections: {
      all: $.rows.all.value.map((row) => `${row.id}:${row.name}`),
      ids: [...$.rows.ids.value],
      count: $.rows.count.value,
      empty: $.rows.empty.value,
      map: [...$.rows.asMap.value].map(([key, row]) => `${key}:${row.name}`),
      hasA: $.rows.has('A').value,
      where: $.rows.where(matchesA).value.map((row) => `${row.id}:${row.name}`),
      find: encode($.rows.find(matchesA).value),
      slice: [...$.rows.names.value],
      activeId: $.rows.activeId.value ?? null,
      activeEntity: encode($.rows.activeEntity.value),
      row: node?.()?.name ?? null,
      field: node?.name.value ?? null,
    },
  };
};
const matchesA = (row: ConformanceRow) => row.id === 'A';

describe('@signal-tree/vue — pending realization conformance', () => {
  transactionRealizationContract<Tree>({
    framework: 'vue',

    createStore() {
      const tree = build();
      return { tree, dispose: () => tree.destroy() };
    },

    transact: (tree, fn) => tree.transact(fn),

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

    observeValues: (tree, phase) => [
      observe<ValuePublicationFrame>(() => ({
        phase: phase(),
        scalar: tree.$.scalar.value,
        row: tree.$.rows.byId('A')?.()?.name,
        all: tree.$.rows.all.value.find((row) => row.id === 'A')?.name,
      })),
      observe<ValuePublicationFrame>(
        () => ({
          phase: phase(),
          scalar: tree.$.scalar.value,
          row: tree.$.rows.byId('A')?.()?.name,
          all: tree.$.rows.all.value.find((row) => row.id === 'A')?.name,
        }),
        'sync'
      ),
    ],

    selectRow: (tree, id) => tree.$.rows.setActiveId(id),
    rekeyRow: (tree, from, to) => tree.$.rows.changeId(from, to),
    observeProjections: (tree, phase, enabled) => [
      observe(() => projectionFrame(tree.$, phase(), enabled())),
      observe(() => projectionFrame(tree.$, phase(), enabled()), 'sync'),
    ],

    flush: async () => {
      await nextTick();
      await Promise.resolve();
      await nextTick();
    },
  });
});
