import {
  EntityState as AkitaEntityState,
  EntityStore,
  QueryEntity,
  StateHistoryPlugin,
} from '@datorama/akita';
import {
  configureStore,
  createEntityAdapter,
  createSlice,
} from '@reduxjs/toolkit';
import { createStore, withProps } from '@ngneat/elf';
import {
  getAllEntities,
  getEntity,
  setEntities,
  updateEntities,
  withEntities,
} from '@ngneat/elf-entities';
import { stateHistory } from '@ngneat/elf-state-history';
import { patchState, signalState } from '@ngrx/signals';
import { setAllEntities, updateEntity } from '@ngrx/signals/entities';
import {
  entityMap as angularEntityMap,
  restoration as angularRestoration,
  signalTree as angularSignalTree,
  undoable as angularUndoable,
} from '@signal-tree/angular';
import {
  entityMap as kernelEntityMap,
  restoration as kernelRestoration,
  signalTree as kernelSignalTree,
  undoable as kernelUndoable,
} from '@signal-tree/kernel';

import { BenchmarkArm, BenchmarkWorkload } from './v15-benchmark.engine';

interface BenchmarkRow {
  readonly id: number;
  readonly name: string;
  readonly value: number;
  readonly active: boolean;
}

type EntityId = string | number;
type AkitaRowsState = AkitaEntityState<BenchmarkRow, number>;

interface CollectionImplementation {
  readonly setAll: (rows: readonly BenchmarkRow[]) => void;
  readonly updateOne: (id: number, value: number) => void;
  readonly readAll: () => readonly BenchmarkRow[];
  readonly readOne: (id: number) => BenchmarkRow | undefined;
  readonly dispose: () => void;
}

interface RestorationImplementation {
  readonly updateOne: (id: number, value: number) => void;
  readonly readOne: (id: number) => BenchmarkRow | undefined;
  readonly undo: () => void;
  readonly dispose: () => void;
}

export interface V15BenchmarkConfig {
  readonly collectionSize: number;
  readonly collectionUpdates: number;
  readonly restorationSize: number;
  readonly restorationWrites: number;
}

export interface V15BenchmarkHooks {
  readonly onSignalTreeDestroyed?: (destroyed: boolean) => void;
}

export interface BenchmarkCalculationNotes {
  readonly timedCalculation: string;
  readonly outsideTimer: string;
  readonly correctnessCheck: string;
  readonly notCompared: string;
}

export interface BenchmarkArmComparison {
  readonly featureSource: string;
  readonly kind: string;
  readonly addedForComparison: string;
  readonly whyItWasAdded: string;
  readonly notIncluded: string;
}

export interface V15BenchmarkArm extends BenchmarkArm {
  readonly description: string;
  readonly comparison: BenchmarkArmComparison;
}

export interface BenchmarkCapabilityContract {
  readonly title: string;
  readonly requirements: readonly string[];
  readonly exclusions: readonly {
    readonly label: string;
    readonly reason: string;
  }[];
}

export interface V15BenchmarkSuite {
  readonly workload: BenchmarkWorkload;
  readonly arms: readonly V15BenchmarkArm[];
  readonly capability: BenchmarkCapabilityContract;
  readonly applicationExample: string;
  readonly financialImpact: string;
  readonly costLabel: string;
  readonly costContext: string;
  readonly calculation: BenchmarkCalculationNotes;
  readonly relatedCommand: string;
}

export const DEFAULT_V15_BENCHMARK_CONFIG: V15BenchmarkConfig = {
  collectionSize: 2_000,
  collectionUpdates: 100,
  restorationSize: 500,
  restorationWrites: 20,
};

const UPDATE_BASE = 1_000_000;
const RESTORATION_BASE = 900_000;

type BenchmarkLibraryId =
  | 'signaltree-angular'
  | 'signaltree-kernel'
  | 'ngrx-signals'
  | 'elf'
  | 'akita'
  | 'redux-toolkit';

type HistoryLibraryId =
  | 'signaltree-angular'
  | 'signaltree-kernel'
  | 'elf'
  | 'akita';

const DIRECT_STATE_NOT_INCLUDED =
  'No component rendering, subscriptions, effects, persistence, DevTools, bundle loading, retained memory, or feature-completeness weighting is timed.';
const HISTORY_NOT_INCLUDED =
  'No redo, branching history, persistence, serialization, UI rendering, or attempt to make the different history contracts semantically equivalent is timed.';

const KEYED_ENTITY_CAPABILITY: BenchmarkCapabilityContract = {
  title: 'First-party keyed entity state',
  requirements: [
    'The measured library or an official first-party package supplies the keyed entity abstraction.',
    'The public API can populate the collection, update one entity by ID, read that ID, and enumerate the collection.',
    'The benchmark adapter may translate calls, but it may not invent the entity model or update algorithm.',
  ],
  exclusions: [
    {
      label: 'Zustand',
      reason:
        'Zustand supplies a store primitive, not a first-party entity abstraction; choosing a Map schema and copy strategy would benchmark the harness design.',
    },
    {
      label: 'MobX',
      reason:
        'MobX supplies reactive primitives, not a first-party entity-store contract; the observable Map schema and action policy would be harness choices.',
    },
    {
      label: 'Valtio',
      reason:
        'Valtio supplies proxy primitives, not a first-party entity abstraction; choosing proxyMap() and its update recipe would be harness work.',
    },
  ],
};

const FIRST_PARTY_HISTORY_CAPABILITY: BenchmarkCapabilityContract = {
  title: 'First-party linear undo over keyed state',
  requirements: [
    'The measured library or an official first-party package supplies history integrated with the measured store.',
    'Each authored update becomes one undo step, and repeated undo exposes every expected intermediate value.',
    'No benchmark-owned snapshot stack or third-party recipe may supply a missing history capability.',
  ],
  exclusions: [
    {
      label: 'NgRx Signals',
      reason:
        'The measured first-party packages supply keyed entities but not the history capability required by this chart.',
    },
    {
      label: 'Redux Toolkit',
      reason:
        'The measured first-party package supplies keyed entities but not an integrated history capability.',
    },
    {
      label: 'Zustand, MobX, and Valtio',
      reason:
        'These packages would require both a harness-chosen entity recipe and a harness- or third-party history implementation.',
    },
  ],
};

const KEYED_COMPARISON_NOTES = {
  'signaltree-angular': {
    kind: 'Library keyed API',
    featureSource: 'Native SignalTree Angular keyed state',
    addedForComparison:
      'Only a thin adapter maps the shared set-all, update-by-ID, and read contract to entityMap().',
    whyItWasAdded:
      'The adapter supplies the same input and checksum boundary without adding state behavior.',
    notIncluded:
      'Angular component rendering and dependency injection are not exercised. ' +
      DIRECT_STATE_NOT_INCLUDED,
  },
  'signaltree-kernel': {
    kind: 'Library keyed API',
    featureSource: 'Native framework-neutral SignalTree keyed state',
    addedForComparison:
      'Only a thin adapter maps the shared set-all, update-by-ID, and read contract to entityMap().',
    whyItWasAdded:
      'It isolates the Kernel realization from Angular while preserving the same checked task.',
    notIncluded: DIRECT_STATE_NOT_INCLUDED,
  },
  'ngrx-signals': {
    kind: 'First-party entity API',
    featureSource: 'First-party NgRx Signals entity utilities',
    addedForComparison:
      'A thin adapter maps the task to signalState(), setAllEntities(), and updateEntity().',
    whyItWasAdded:
      'The adapter invokes the documented keyed-state mechanism and adds no history or caching.',
    notIncluded: DIRECT_STATE_NOT_INCLUDED,
  },
  elf: {
    kind: 'First-party entity add-on',
    featureSource: 'First-party Elf entities package',
    addedForComparison:
      'The benchmark includes @ngneat/elf-entities and a thin adapter around its public entity operations.',
    whyItWasAdded:
      'Elf exposes keyed collection behavior through its first-party entities package.',
    notIncluded: DIRECT_STATE_NOT_INCLUDED,
  },
  akita: {
    kind: 'Library keyed API',
    featureSource: 'Native Akita EntityStore and QueryEntity',
    addedForComparison:
      'Only a thin adapter maps the task to EntityStore writes and QueryEntity reads.',
    whyItWasAdded:
      'The adapter gives Akita the same records and correctness boundary without adding state behavior.',
    notIncluded: DIRECT_STATE_NOT_INCLUDED,
  },
  'redux-toolkit': {
    kind: 'First-party entity API',
    featureSource: 'First-party Redux Toolkit entity adapter',
    addedForComparison:
      'The harness configures a Redux store and createEntityAdapter(); development-only immutable and serializable checks are disabled.',
    whyItWasAdded:
      'A live Redux store is required for a state-library comparison. Disabling diagnostic checks keeps the timed work focused on production state operations.',
    notIncluded:
      'Custom middleware, React rendering, subscriptions, and selector memoization beyond selectById() are not timed. ' +
      DIRECT_STATE_NOT_INCLUDED,
  },
} satisfies Record<BenchmarkLibraryId, BenchmarkArmComparison>;

const RESTORATION_COMPARISON_NOTES = {
  'signaltree-angular': {
    kind: 'Built-in history',
    featureSource: 'Built-in SignalTree restoration',
    addedForComparison:
      'Nothing beyond the task adapter. restoration() records designated undoable() causal turns.',
    whyItWasAdded:
      'No substitute history mechanism is needed because restoration is a SignalTree feature.',
    notIncluded: HISTORY_NOT_INCLUDED,
  },
  'signaltree-kernel': {
    kind: 'Built-in history',
    featureSource: 'Built-in framework-neutral SignalTree restoration',
    addedForComparison:
      'Nothing beyond the task adapter. Kernel restoration records designated undoable() causal turns.',
    whyItWasAdded:
      'This measures the same SignalTree feature without an Angular realization.',
    notIncluded: HISTORY_NOT_INCLUDED,
  },
  elf: {
    kind: 'First-party history add-on',
    featureSource: 'First-party Elf history add-on',
    addedForComparison:
      'The benchmark installs @ngneat/elf-state-history on the real Elf entity store.',
    whyItWasAdded:
      'Elf publishes history as a separate first-party package rather than in its base store.',
    notIncluded: HISTORY_NOT_INCLUDED,
  },
  akita: {
    kind: 'First-party history add-on',
    featureSource: 'First-party Akita StateHistoryPlugin',
    addedForComparison:
      'The benchmark attaches StateHistoryPlugin to the real Akita QueryEntity.',
    whyItWasAdded:
      "This is Akita's first-party history facility for the measured store.",
    notIncluded: HISTORY_NOT_INCLUDED,
  },
} satisfies Record<HistoryLibraryId, BenchmarkArmComparison>;

const seedRows = (size: number): BenchmarkRow[] =>
  Array.from({ length: size }, (_, id) => ({
    id,
    name: `Record ${id}`,
    value: id,
    active: id % 2 === 0,
  }));

const initializationChecksum = (rows: readonly BenchmarkRow[]): string => {
  const valueSum = rows.reduce((total, row) => total + row.value, 0);
  return `${rows.length}:${valueSum}`;
};

const expectedInitializationChecksum = (size: number): string =>
  `${size}:${(size * (size - 1)) / 2}`;

const expectedUpdateChecksum = (size: number, updates: number): string => {
  const observedSum = updates * UPDATE_BASE + (updates * (updates - 1)) / 2;
  return `${size}:${observedSum}:${UPDATE_BASE + updates - 1}`;
};

const expectedRestorationChecksum = (writes: number): string => {
  const undoValues = Array.from({ length: writes }, (_, index) =>
    index === writes - 1 ? 0 : RESTORATION_BASE + writes - index - 2
  );
  return `${RESTORATION_BASE + writes - 1}:${undoValues.join(',')}:0`;
};

const validateConfig = (config: V15BenchmarkConfig): void => {
  for (const [name, value] of Object.entries(config)) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`${name} must be a positive integer`);
    }
  }
};

const createInitializationArm = (
  id: BenchmarkLibraryId,
  label: string,
  color: string,
  description: string,
  config: V15BenchmarkConfig,
  createImplementation: (instanceId?: string) => CollectionImplementation
): V15BenchmarkArm => ({
  id,
  label,
  color,
  description,
  comparison: KEYED_COMPARISON_NOTES[id],
  createSample: (workload) => {
    if (workload.id !== 'initialization') {
      throw new Error(`${id} received unsupported workload ${workload.id}`);
    }

    const rows = seedRows(config.collectionSize);
    const instanceId = `${id}-${crypto.randomUUID()}`;
    let resultRows: readonly BenchmarkRow[] = [];
    let implementation: CollectionImplementation | undefined;

    return {
      measure: () => {
        const startedAt = performance.now();
        implementation = createImplementation(instanceId);
        implementation.setAll(rows);
        resultRows = implementation.readAll();

        return {
          durationMs: performance.now() - startedAt,
          operations: workload.operations,
        };
      },
      checksum: () => initializationChecksum(resultRows),
      dispose: () => implementation?.dispose(),
    };
  },
});

const createCollectionArm = (
  id: BenchmarkLibraryId,
  label: string,
  color: string,
  description: string,
  config: V15BenchmarkConfig,
  createImplementation: (instanceId?: string) => CollectionImplementation
): V15BenchmarkArm => ({
  id,
  label,
  color,
  description,
  comparison: KEYED_COMPARISON_NOTES[id],
  createSample: async (workload) => {
    if (workload.id !== 'collection') {
      throw new Error(`${id} received unsupported workload ${workload.id}`);
    }

    const implementation = createImplementation(`${id}-${crypto.randomUUID()}`);
    implementation.setAll(seedRows(config.collectionSize));
    implementation.readOne(0);
    await Promise.resolve();
    let observedSum = 0;
    let lastValue: number | undefined;

    return {
      measure: () => {
        const startedAt = performance.now();
        for (let index = 0; index < config.collectionUpdates; index += 1) {
          implementation.updateOne(0, UPDATE_BASE + index);
          lastValue = implementation.readOne(0)?.value;
          observedSum += lastValue ?? Number.NaN;
        }

        return {
          durationMs: performance.now() - startedAt,
          operations: workload.operations,
        };
      },
      checksum: () => {
        const checkedValue = lastValue ?? 'missing';
        return `${
          implementation.readAll().length
        }:${observedSum}:${checkedValue}`;
      },
      dispose: implementation.dispose,
    };
  },
});

const createRestorationArm = (
  id: HistoryLibraryId,
  label: string,
  color: string,
  description: string,
  config: V15BenchmarkConfig,
  createImplementation: (
    rows: readonly BenchmarkRow[]
  ) => RestorationImplementation | Promise<RestorationImplementation>
): V15BenchmarkArm => ({
  id,
  label,
  color,
  description,
  comparison: RESTORATION_COMPARISON_NOTES[id],
  createSample: async (workload) => {
    if (workload.id !== 'restoration') {
      throw new Error(`${id} received unsupported workload ${workload.id}`);
    }

    const implementation = await createImplementation(
      seedRows(config.restorationSize)
    );
    let afterWrites: BenchmarkRow | undefined;
    let afterUndos: BenchmarkRow | undefined;
    const undoValues: number[] = [];

    return {
      measure: async () => {
        const startedAt = performance.now();
        const recordStartedAt = startedAt;
        for (let index = 0; index < config.restorationWrites; index += 1) {
          implementation.updateOne(0, RESTORATION_BASE + index);
          await Promise.resolve();
        }

        afterWrites = implementation.readOne(0);
        const recordDurationMs = performance.now() - recordStartedAt;
        const undoStartedAt = performance.now();

        for (let index = 0; index < config.restorationWrites; index += 1) {
          implementation.undo();
          await Promise.resolve();
          undoValues.push(implementation.readOne(0)?.value ?? Number.NaN);
        }
        afterUndos = implementation.readOne(0);
        const undoDurationMs = performance.now() - undoStartedAt;

        return {
          durationMs: performance.now() - startedAt,
          operations: workload.operations,
          phases: {
            record: recordDurationMs,
            undo: undoDurationMs,
          },
        };
      },
      checksum: () => {
        const restoredValue = afterUndos?.value ?? 'missing';
        return `${afterWrites?.value ?? 'missing'}:${undoValues.join(
          ','
        )}:${restoredValue}`;
      },
      dispose: implementation.dispose,
    };
  },
});

const createAngularSignalTreeCollection = (
  hooks: V15BenchmarkHooks
): CollectionImplementation => {
  const tree = angularSignalTree({
    rows: angularEntityMap<BenchmarkRow, number>({
      selectId: (row) => row.id,
    }),
  });

  return {
    setAll: (rows) => tree.$.rows.setAll([...rows]),
    updateOne: (id, value) => tree.$.rows.updateOne(id, { value }),
    readAll: () => tree.$.rows.all(),
    readOne: (id) => tree.$.rows.byId(id)?.(),
    dispose: () => {
      tree.destroy();
      hooks.onSignalTreeDestroyed?.(tree.destroyed());
    },
  };
};

const createKernelSignalTreeCollection = (
  hooks: V15BenchmarkHooks
): CollectionImplementation => {
  const tree = kernelSignalTree({
    rows: kernelEntityMap<BenchmarkRow, number>({
      selectId: (row) => row.id,
    }),
  });

  return {
    setAll: (rows) => tree.$.rows.setAll([...rows]),
    updateOne: (id, value) => tree.$.rows.updateOne(id, { value }),
    readAll: () => tree.$.rows.all(),
    readOne: (id) => tree.$.rows.byId(id)?.(),
    dispose: () => {
      tree.destroy();
      hooks.onSignalTreeDestroyed?.(tree.destroyed());
    },
  };
};

const createNgRxCollection = (): CollectionImplementation => {
  const store = signalState({
    entityMap: {} as Record<EntityId, BenchmarkRow>,
    ids: [] as EntityId[],
  });

  return {
    setAll: (rows) => patchState(store, setAllEntities([...rows])),
    updateOne: (id, value) =>
      patchState(store, updateEntity({ id, changes: { value } })),
    readAll: () => store.ids().map((id) => store.entityMap()[id]),
    readOne: (id) => store.entityMap()[id],
    dispose: () => undefined,
  };
};

const createElfCollection = (instanceId?: string): CollectionImplementation => {
  const store = createStore(
    { name: `v15-browser-collection-${instanceId ?? crypto.randomUUID()}` },
    withProps({}),
    withEntities<BenchmarkRow>()
  );

  return {
    setAll: (rows) => store.update(setEntities([...rows])),
    updateOne: (id, value) =>
      store.update(
        updateEntities(id, (row: BenchmarkRow) => ({ ...row, value }))
      ),
    readAll: () => store.query(getAllEntities()),
    readOne: (id) => store.query(getEntity(id)),
    dispose: () => store.destroy(),
  };
};

const createAkitaCollection = (
  instanceId?: string
): CollectionImplementation => {
  const store = new EntityStore<AkitaRowsState, BenchmarkRow, number>(
    undefined,
    {
      name: `v15-browser-akita-${instanceId ?? crypto.randomUUID()}`,
      idKey: 'id',
    }
  );
  const query = new QueryEntity<AkitaRowsState, BenchmarkRow, number>(store);

  return {
    setAll: (rows) => store.set([...rows]),
    updateOne: (id, value) => store.update(id, { value }),
    readAll: () => query.getAll(),
    readOne: (id) => query.getEntity(id),
    dispose: () => store.destroy(),
  };
};

const createReduxToolkitCollection = (
  instanceId?: string
): CollectionImplementation => {
  const adapter = createEntityAdapter<BenchmarkRow>({
    sortComparer: false,
  });
  const slice = createSlice({
    name: `v15BrowserReduxToolkit${(
      instanceId ?? crypto.randomUUID()
    ).replaceAll('-', '')}`,
    initialState: adapter.getInitialState(),
    reducers: {
      setAll: adapter.setAll,
      updateOne: adapter.updateOne,
      removeAll: adapter.removeAll,
    },
  });
  const store = configureStore({
    reducer: slice.reducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        immutableCheck: false,
        serializableCheck: false,
      }),
  });
  const selectors = adapter.getSelectors();

  return {
    setAll: (rows) => store.dispatch(slice.actions.setAll([...rows])),
    updateOne: (id, value) =>
      store.dispatch(slice.actions.updateOne({ id, changes: { value } })),
    readAll: () => selectors.selectAll(store.getState()),
    readOne: (id) => selectors.selectById(store.getState(), id),
    dispose: () => store.dispatch(slice.actions.removeAll()),
  };
};

const createAngularSignalTreeRestoration = async (
  rows: readonly BenchmarkRow[],
  hooks: V15BenchmarkHooks
): Promise<RestorationImplementation> => {
  const tree = angularSignalTree(
    {
      rows: angularEntityMap<BenchmarkRow, number>({
        selectId: (row) => row.id,
      }),
    },
    {
      enhancers: [angularRestoration({ maxHistorySize: rows.length + 100 })],
    }
  );
  tree.$.rows.setAll([...rows]);
  await Promise.resolve();
  tree.resetRestorationHistory();

  return {
    updateOne: (id, value) =>
      angularUndoable(() => tree.$.rows.updateOne(id, { value })),
    readOne: (id) => tree.$.rows.byId(id)?.(),
    undo: () => tree.undo(),
    dispose: () => {
      tree.destroy();
      hooks.onSignalTreeDestroyed?.(tree.destroyed());
    },
  };
};

const createKernelSignalTreeRestoration = async (
  rows: readonly BenchmarkRow[],
  hooks: V15BenchmarkHooks
): Promise<RestorationImplementation> => {
  const tree = kernelSignalTree(
    {
      rows: kernelEntityMap<BenchmarkRow, number>({
        selectId: (row) => row.id,
      }),
    },
    {
      enhancers: [kernelRestoration({ maxHistorySize: rows.length + 100 })],
    }
  );
  tree.$.rows.setAll([...rows]);
  await Promise.resolve();
  tree.resetRestorationHistory();

  return {
    updateOne: (id, value) =>
      kernelUndoable(() => tree.$.rows.updateOne(id, { value })),
    readOne: (id) => tree.$.rows.byId(id)?.(),
    undo: () => tree.undo(),
    dispose: () => {
      tree.destroy();
      hooks.onSignalTreeDestroyed?.(tree.destroyed());
    },
  };
};

const createElfRestoration = (
  rows: readonly BenchmarkRow[]
): RestorationImplementation => {
  const store = createStore(
    { name: `v15-browser-restoration-${crypto.randomUUID()}` },
    withProps({}),
    withEntities<BenchmarkRow>()
  );
  store.update(setEntities([...rows]));
  const history = stateHistory(store, { maxAge: rows.length + 100 });

  return {
    updateOne: (id, value) =>
      store.update(
        updateEntities(id, (row: BenchmarkRow) => ({ ...row, value }))
      ),
    readOne: (id) => store.query(getEntity(id)),
    undo: () => history.undo(),
    dispose: () => {
      history.destroy({ clearHistory: true });
      store.destroy();
    },
  };
};

const createAkitaRestoration = (
  rows: readonly BenchmarkRow[]
): RestorationImplementation => {
  const store = new EntityStore<AkitaRowsState, BenchmarkRow, number>(
    undefined,
    {
      name: `v15-browser-akita-history-${crypto.randomUUID()}`,
      idKey: 'id',
    }
  );
  store.set([...rows]);
  const query = new QueryEntity<AkitaRowsState, BenchmarkRow, number>(store);
  const history = new StateHistoryPlugin(query, {
    maxAge: rows.length + 100,
  });

  return {
    updateOne: (id, value) => store.update(id, { value }),
    readOne: (id) => query.getEntity(id),
    undo: () => history.undo(),
    dispose: () => {
      history.destroy(true);
      store.destroy();
    },
  };
};

export const createV15BenchmarkSuites = (
  config: V15BenchmarkConfig = DEFAULT_V15_BENCHMARK_CONFIG,
  hooks: V15BenchmarkHooks = {}
): readonly V15BenchmarkSuite[] => {
  validateConfig(config);

  const initializationWorkload: BenchmarkWorkload = {
    id: 'initialization',
    title: 'Initialize and populate keyed state',
    description: `Create the state container, populate ${config.collectionSize.toLocaleString()} keyed records, then verify the complete collection.`,
    operations: 1,
    expectedChecksum: expectedInitializationChecksum(config.collectionSize),
  };
  const collection: BenchmarkWorkload = {
    id: 'collection',
    title: 'Update and read one keyed record',
    description: `Seed ${config.collectionSize.toLocaleString()} records before timing, then update one record ${config.collectionUpdates.toLocaleString()} times and read that same ID after every write.`,
    operations: config.collectionUpdates,
    expectedChecksum: expectedUpdateChecksum(
      config.collectionSize,
      config.collectionUpdates
    ),
  };
  const restorationWorkload: BenchmarkWorkload = {
    id: 'restoration',
    title: 'Record and undo authored changes',
    description: `Apply ${config.restorationWrites} separate changes to one record, retain each change, then undo all ${config.restorationWrites}.`,
    operations: 1,
    expectedChecksum: expectedRestorationChecksum(config.restorationWrites),
  };

  return [
    {
      workload: initializationWorkload,
      capability: KEYED_ENTITY_CAPABILITY,
      applicationExample:
        'A dispatcher opens an order board and the app creates and loads its keyed state.',
      financialImpact:
        'Initialization affects first-use wait time, but it should not be charged to every later order update.',
      costLabel: 'One-time cost',
      costContext:
        'SignalTree performs more construction work in this checked initialization task, including creating its keyed identity and reactive state substrate. That upfront cost may be worthwhile when later updates amortize it in a long-lived store. For short-lived or read-once data, the trade may not pay back.',
      calculation: {
        timedCalculation: `One sample is the elapsed time around container construction, set-all of ${config.collectionSize.toLocaleString()} records, and one complete read. It is reported as one task.`,
        outsideTimer:
          'Seed-row creation, unique store names, module loading, round settling, and discarded warmup rounds stay outside the timer.',
        correctnessCheck:
          'After timing, the harness checks both the complete row count and the sum of every row value.',
        notCompared:
          'This does not measure application startup, JavaScript download or parsing, first render, subscriptions, retained memory, or garbage collection.',
      },
      relatedCommand:
        'node --expose-gc tools/bench-public-collection-layers.mjs --samples 9',
      arms: [
        createInitializationArm(
          'signaltree-angular',
          'SignalTree Angular',
          '#527d14',
          'Angular realization: signalTree(), entityMap(), setAll(), and all()',
          config,
          () => createAngularSignalTreeCollection(hooks)
        ),
        createInitializationArm(
          'signaltree-kernel',
          'SignalTree Kernel',
          '#79a51e',
          'Framework-neutral @signal-tree/kernel realization',
          config,
          () => createKernelSignalTreeCollection(hooks)
        ),
        createInitializationArm(
          'ngrx-signals',
          'NgRx Signals',
          '#325ea8',
          'Initialization: signalState() with setAllEntities()',
          config,
          createNgRxCollection
        ),
        createInitializationArm(
          'elf',
          'Elf',
          '#8b5b17',
          'createStore(), withEntities(), and setEntities()',
          config,
          createElfCollection
        ),
        createInitializationArm(
          'akita',
          'Akita',
          '#8554a3',
          'EntityStore(), set(), and QueryEntity.getAll()',
          config,
          createAkitaCollection
        ),
        createInitializationArm(
          'redux-toolkit',
          'Redux Toolkit',
          '#a13d62',
          'Configured Redux store with createEntityAdapter()',
          config,
          createReduxToolkitCollection
        ),
      ],
    },
    {
      workload: collection,
      capability: KEYED_ENTITY_CAPABILITY,
      applicationExample:
        'A price feed updates one order by ID and the screen immediately reads that same order.',
      financialImpact:
        'This is the repeated cost paid on price, status, and quantity changes after the state is already loaded.',
      costLabel: 'Ongoing cost',
      costContext:
        'Construction and population finish before this timer starts. This is the cost paid again and again as an existing record changes, which is where SignalTree can amortize its more expensive setup.',
      calculation: {
        timedCalculation: `One sample is the elapsed time around ${config.collectionUpdates.toLocaleString()} repetitions of one public update-by-ID followed immediately by one public read of that ID. The chart ranks total task time.`,
        outsideTimer: `Container construction, population of ${config.collectionSize.toLocaleString()} records, one priming read, module loading, round settling, and discarded warmups stay outside the timer.`,
        correctnessCheck:
          'After timing, the harness checks row count, the sum of every observed update value, and the final value of the updated row.',
        notCompared:
          'No rendering, subscriber notification work, derived selectors, persistence, middleware side effects, retained memory, or feature weighting is added.',
      },
      relatedCommand: 'node tools/bench-vs-signalstore.mjs',
      arms: [
        createCollectionArm(
          'signaltree-angular',
          'SignalTree Angular',
          '#527d14',
          'Angular realization: updateOne() followed by byId()',
          config,
          () => createAngularSignalTreeCollection(hooks)
        ),
        createCollectionArm(
          'signaltree-kernel',
          'SignalTree Kernel',
          '#79a51e',
          'Neutral kernel: updateOne() followed by byId()',
          config,
          () => createKernelSignalTreeCollection(hooks)
        ),
        createCollectionArm(
          'ngrx-signals',
          'NgRx Signals',
          '#325ea8',
          'Keyed update: updateEntity() followed by entity-map access',
          config,
          createNgRxCollection
        ),
        createCollectionArm(
          'elf',
          'Elf',
          '#8b5b17',
          'updateEntities() followed by getEntity()',
          config,
          createElfCollection
        ),
        createCollectionArm(
          'akita',
          'Akita',
          '#8554a3',
          'EntityStore.update() followed by QueryEntity.getEntity()',
          config,
          createAkitaCollection
        ),
        createCollectionArm(
          'redux-toolkit',
          'Redux Toolkit',
          '#a13d62',
          'Redux dispatch updateOne() followed by selectById()',
          config,
          createReduxToolkitCollection
        ),
      ],
    },
    {
      workload: restorationWorkload,
      capability: FIRST_PARTY_HISTORY_CAPABILITY,
      applicationExample: `An invoice editor keeps ${config.restorationWrites} user changes so the clerk can undo them in order.`,
      financialImpact:
        'A broken undo can restore the wrong price or quantity. The checksum refuses to publish a timing unless every arm returns to the seeded value.',
      costLabel: 'Optional ongoing feature cost',
      costContext:
        'This task ranks only first-party history implementations. SignalTree applies retained causal reversal facts while preserving its identity and coherent-publication semantics; Elf and Akita use their official history facilities. Their broader contracts differ, so the chart measures the shared linear-undo capability floor rather than claiming complete semantic equivalence.',
      calculation: {
        timedCalculation: `One sample measures ${config.restorationWrites} record-and-update steps plus ${config.restorationWrites} undo-and-read steps. Total time determines rank; record and undo phase medians are also shown.`,
        outsideTimer: `Creation and seeding of ${config.restorationSize.toLocaleString()} records, history initialization/reset, module loading, round settling, and discarded warmups stay outside the timer.`,
        correctnessCheck:
          'After timing, the harness checks the value after all writes, the exact value after every undo, and the final return to the seeded value.',
        notCompared:
          'The rows reach the same tested outcome but do not claim equivalent history semantics. Redo, branching, grouping, identity preservation, causal metadata, persistence, and UI rendering are not normalized.',
      },
      relatedCommand: 'node --expose-gc tools/bench-compare.mjs --n 10000',
      arms: [
        createRestorationArm(
          'signaltree-angular',
          'SignalTree Angular',
          '#527d14',
          'Built-in restoration() with designated undoable() turns',
          config,
          (rows) => createAngularSignalTreeRestoration(rows, hooks)
        ),
        createRestorationArm(
          'signaltree-kernel',
          'SignalTree Kernel',
          '#79a51e',
          'Built-in framework-neutral kernel restoration',
          config,
          (rows) => createKernelSignalTreeRestoration(rows, hooks)
        ),
        createRestorationArm(
          'elf',
          'Elf',
          '#8b5b17',
          'The first-party @ngneat/elf-state-history package',
          config,
          createElfRestoration
        ),
        createRestorationArm(
          'akita',
          'Akita',
          '#8554a3',
          'The first-party Akita StateHistoryPlugin',
          config,
          createAkitaRestoration
        ),
      ],
    },
  ];
};
