import { effect, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';

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
 * PROPOSAL-0 Phase B — Angular realization.
 *
 * Only physical hooks live here; every assertion is the shared contract's.
 * Angular leaves are Angular signals: read by calling, write with `.set()`,
 * observe with `effect()` in an injection context, flush with `TestBed.tick()`
 * plus microtasks.
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

const microtasks = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

const observe = <T>(read: () => T): Observation<T> => {
  const seen: T[] = [];
  let latest!: T;
  let stop = () => undefined as void;
  const injector = TestBed.inject(Injector);
  runInInjectionContext(injector, () => {
    const ref = effect(() => {
      const value = read();
      latest = value;
      seen.push(value);
    });
    stop = () => ref.destroy();
  });
  TestBed.tick();
  return { seen, current: () => latest, dispose: () => stop() };
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

describe('@signal-tree/angular — pending realization conformance', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  transactionRealizationContract<Tree>({
    framework: 'angular',

    createStore() {
      const tree = build();
      return { tree, dispose: () => tree.destroy() };
    },

    transact: (tree, fn) => tree.transact(fn),

    writeScalar: (tree, value) => tree.$.scalar.set(value),
    readScalar: (tree) => tree.$.scalar(),
    addRow: (tree, row) => tree.$.rows.addOne(row),
    removeRow: (tree, id) => tree.$.rows.removeOne(id),
    rowIds: (tree) => [...tree.$.rows.ids()],
    realizeRowName: (tree, id, name) => tree.$.rows.updateOne(id, { name }),

    observeScalar: (tree) => observe(() => tree.$.scalar()),
    holdEntity: (tree, id) => {
      // Resolve ONCE, as a component would with a row input.
      const held = tree.$.rows.byId(id);
      return observe(() => held?.());
    },
    observeMixed: (tree) =>
      observe<MixedFrame>(() => ({
        scalar: tree.$.scalar(),
        ids: [...tree.$.rows.ids()],
      })),

    observeValues: (tree, phase) => [
      observe<ValuePublicationFrame>(() => ({
        phase: phase(),
        scalar: tree.$.scalar(),
        row: tree.$.rows.byId('A')?.()?.name,
        all: tree.$.rows.all().find((row) => row.id === 'A')?.name,
      })),
    ],

    selectRow: (tree, id) => tree.$.rows.setActiveId(id),
    rekeyRow: (tree, from, to) => tree.$.rows.changeId(from, to),
    observeProjections: (tree, phase, enabled) => [
      observe(() => projectionFrame(tree.$, phase(), enabled())),
    ],

    flush: async () => {
      TestBed.tick();
      await microtasks();
      TestBed.tick();
      await microtasks();
    },
  });
});
