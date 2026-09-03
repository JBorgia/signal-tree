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

export interface BenchmarkSource {
  readonly label: string;
  readonly url: string;
  readonly path?: string;
}

export interface BenchmarkPackageReference {
  readonly name: string;
  readonly versionKey: string;
}

export interface BenchmarkArmComparison {
  readonly featureSource: string;
  readonly kind: string;
  readonly packages: readonly BenchmarkPackageReference[];
  readonly sources: readonly BenchmarkSource[];
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
    readonly sources: readonly BenchmarkSource[];
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
  readonly relatedSourceUrl: string;
  readonly relatedSourcePath: string;
}

const SIGNALTREE_REPOSITORY_URL = 'https://github.com/JBorgia/signal-tree';

export const V15_BENCHMARK_SOURCE_URLS = {
  engine: SIGNALTREE_REPOSITORY_URL,
  workloads: SIGNALTREE_REPOSITORY_URL,
} as const;

export const V15_BENCHMARK_SOURCE_PATHS = {
  engine: 'apps/demo/src/app/pages/benchmarks/v15-benchmark.engine.ts',
  workloads: 'apps/demo/src/app/pages/benchmarks/v15-benchmark.workloads.ts',
} as const;

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
  | 'akita'
  | 'redux-toolkit';

type HistoryLibraryId = 'signaltree-angular' | 'signaltree-kernel' | 'akita';

const DIRECT_STATE_NOT_INCLUDED =
  'No component rendering, subscriptions, effects, persistence, DevTools, bundle loading, retained memory, or feature-completeness weighting is timed.';
const HISTORY_NOT_INCLUDED =
  'No redo, branching history, persistence, serialization, UI rendering, or attempt to make the different history contracts semantically equivalent is timed.';

const SOURCES = {
  signaltreeEntityMap: {
    label: 'SignalTree entityMap source',
    url: SIGNALTREE_REPOSITORY_URL,
    path: 'packages/kernel/src/lib/markers/entity-map.ts',
  },
  signaltreeRestoration: {
    label: 'SignalTree restoration source',
    url: SIGNALTREE_REPOSITORY_URL,
    path: 'packages/kernel/src/enhancers/restoration/restoration.ts',
  },
  ngrxEntities: {
    label: 'NgRx Signal Store entity management',
    url: 'https://ngrx.io/guide/signals/signal-store/entity-management',
  },
  akitaEntities: {
    label: 'Akita EntityStore documentation',
    url: 'https://opensource.salesforce.com/akita/docs/entities/entity-store/',
  },
  akitaHistory: {
    label: 'Akita StateHistoryPlugin documentation',
    url: 'https://opensource.salesforce.com/akita/docs/plugins/state-history/',
  },
  reduxEntities: {
    label: 'Redux Toolkit createEntityAdapter documentation',
    url: 'https://redux-toolkit.js.org/api/createEntityAdapter',
  },
  zustandStore: {
    label: 'Zustand official store API',
    url: 'https://github.com/pmndrs/zustand#readme',
  },
  mobxObservable: {
    label: 'MobX observable-state documentation',
    url: 'https://mobx.js.org/observable-state.html',
  },
  valtioMap: {
    label: 'Valtio proxyMap documentation',
    url: 'https://valtio.dev/docs/api/utils/proxyMap',
  },
} satisfies Record<string, BenchmarkSource>;

const PACKAGES = {
  signaltreeAngular: [
    { name: '@signal-tree/angular', versionKey: 'signaltree' },
  ],
  signaltreeKernel: [{ name: '@signal-tree/kernel', versionKey: 'signaltree' }],
  ngrxSignals: [{ name: '@ngrx/signals', versionKey: 'ngrx-signals' }],
  akita: [{ name: '@datorama/akita', versionKey: 'akita' }],
  reduxToolkit: [{ name: '@reduxjs/toolkit', versionKey: 'redux-toolkit' }],
} satisfies Record<string, readonly BenchmarkPackageReference[]>;

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
      sources: [SOURCES.zustandStore],
    },
    {
      label: 'MobX',
      reason:
        'MobX supplies reactive primitives, not a first-party entity-store contract; the observable Map schema and action policy would be harness choices.',
      sources: [SOURCES.mobxObservable],
    },
    {
      label: 'Valtio',
      reason:
        'Valtio supplies proxy primitives, not a first-party entity abstraction; choosing proxyMap() and its update recipe would be harness work.',
      sources: [SOURCES.valtioMap],
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
      sources: [SOURCES.ngrxEntities],
    },
    {
      label: 'Redux Toolkit',
      reason:
        'The measured first-party package supplies keyed entities but not an integrated history capability.',
      sources: [SOURCES.reduxEntities],
    },
    {
      label: 'Zustand, MobX, and Valtio',
      reason:
        'These packages would require both a harness-chosen entity recipe and a harness- or third-party history implementation.',
      sources: [
        SOURCES.zustandStore,
        SOURCES.mobxObservable,
        SOURCES.valtioMap,
      ],
    },
  ],
};

const KEYED_COMPARISON_NOTES = {
  'signaltree-angular': {
    kind: 'Library keyed API',
    packages: PACKAGES.signaltreeAngular,
    sources: [SOURCES.signaltreeEntityMap],
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
    packages: PACKAGES.signaltreeKernel,
    sources: [SOURCES.signaltreeEntityMap],
    featureSource: 'Native framework-neutral SignalTree keyed state',
    addedForComparison:
      'Only a thin adapter maps the shared set-all, update-by-ID, and read contract to entityMap().',
    whyItWasAdded:
      'It isolates the Kernel realization from Angular while preserving the same checked task.',
    notIncluded: DIRECT_STATE_NOT_INCLUDED,
  },
  'ngrx-signals': {
    kind: 'First-party entity API',
    packages: PACKAGES.ngrxSignals,
    sources: [SOURCES.ngrxEntities],
    featureSource: 'First-party NgRx Signals entity utilities',
    addedForComparison:
      'A thin adapter maps the task to signalState(), setAllEntities(), and updateEntity().',
    whyItWasAdded:
      'The adapter invokes the documented keyed-state mechanism and adds no history or caching.',
    notIncluded: DIRECT_STATE_NOT_INCLUDED,
  },
  akita: {
    kind: 'Library keyed API',
    packages: PACKAGES.akita,
    sources: [SOURCES.akitaEntities],
    featureSource: 'Native Akita EntityStore and QueryEntity',
    addedForComparison:
      'Only a thin adapter maps the task to EntityStore writes and QueryEntity reads.',
    whyItWasAdded:
      'The adapter gives Akita the same records and correctness boundary without adding state behavior.',
    notIncluded: DIRECT_STATE_NOT_INCLUDED,
  },
  'redux-toolkit': {
    kind: 'First-party entity API',
    packages: PACKAGES.reduxToolkit,
    sources: [SOURCES.reduxEntities],
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
    packages: PACKAGES.signaltreeAngular,
    sources: [SOURCES.signaltreeRestoration],
    featureSource: 'Built-in SignalTree restoration',
    addedForComparison:
      'Nothing beyond the task adapter. restoration() records designated undoable() causal turns.',
    whyItWasAdded:
      'No substitute history mechanism is needed because restoration is a SignalTree feature.',
    notIncluded: HISTORY_NOT_INCLUDED,
  },
  'signaltree-kernel': {
    kind: 'Built-in history',
    packages: PACKAGES.signaltreeKernel,
    sources: [SOURCES.signaltreeRestoration],
    featureSource: 'Built-in framework-neutral SignalTree restoration',
    addedForComparison:
      'Nothing beyond the task adapter. Kernel restoration records designated undoable() causal turns.',
    whyItWasAdded:
      'This measures the same SignalTree feature without an Angular realization.',
    notIncluded: HISTORY_NOT_INCLUDED,
  },
  akita: {
    kind: 'First-party history add-on',
    packages: PACKAGES.akita,
    sources: [SOURCES.akitaHistory],
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

const collectionChecksum = (rows: readonly BenchmarkRow[]): string => {
  const valueSum = rows.reduce((total, row) => total + row.value, 0);
  return `${rows.length}:${valueSum}`;
};

export const projectedValueById = (
  rows: readonly { readonly id: number; readonly value: number }[],
  id: number
): number => rows.find((row) => row.id === id)?.value ?? Number.NaN;

const expectedUpdateChecksum = (size: number, updates: number): string => {
  const observedSum = updates * UPDATE_BASE + (updates * (updates - 1)) / 2;
  return `${size}:${observedSum}:${UPDATE_BASE + updates - 1}`;
};

const expectedProjectionChecksum = (size: number, updates: number): string => {
  const observedValueSum =
    updates * UPDATE_BASE + (updates * (updates - 1)) / 2;
  const finalValue = UPDATE_BASE + updates - 1;
  const finalCollectionSum = (size * (size - 1)) / 2 + finalValue;
  return `${size * updates}:${observedValueSum}:${size}:${finalCollectionSum}`;
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

const createProjectionArm = (
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
    if (workload.id !== 'projection') {
      throw new Error(`${id} received unsupported workload ${workload.id}`);
    }

    const implementation = createImplementation(`${id}-${crypto.randomUUID()}`);
    implementation.setAll(seedRows(config.collectionSize));
    implementation.readAll();
    await Promise.resolve();
    let observedLength = 0;
    let observedValueSum = 0;

    return {
      measure: () => {
        const startedAt = performance.now();
        for (let index = 0; index < config.collectionUpdates; index += 1) {
          implementation.updateOne(0, UPDATE_BASE + index);
          const rows = implementation.readAll();
          observedLength += rows.length;
          observedValueSum += projectedValueById(rows, 0);
        }

        return {
          durationMs: performance.now() - startedAt,
          operations: workload.operations,
        };
      },
      checksum: () =>
        `${observedLength}:${observedValueSum}:${collectionChecksum(
          implementation.readAll()
        )}`,
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
  const projectionWorkload: BenchmarkWorkload = {
    id: 'projection',
    title: 'Update one record and re-read the collection',
    description: `Seed ${config.collectionSize.toLocaleString()} records before timing, then update one record and realize the complete collection ${config.collectionUpdates.toLocaleString()} times.`,
    operations: config.collectionUpdates,
    expectedChecksum: expectedProjectionChecksum(
      config.collectionSize,
      config.collectionUpdates
    ),
  };
  const restorationWorkload: BenchmarkWorkload = {
    id: 'restoration',
    title: 'Consequential authored work: record and undo',
    description: `Apply ${config.restorationWrites} separate changes to one record, retain each change, then undo all ${config.restorationWrites}.`,
    operations: config.restorationWrites,
    expectedChecksum: expectedRestorationChecksum(config.restorationWrites),
  };

  return [
    {
      workload: collection,
      capability: KEYED_ENTITY_CAPABILITY,
      applicationExample:
        'A price feed updates one order by ID and the screen immediately reads that same order.',
      financialImpact:
        'This is the repeated cost paid on price, status, and quantity changes after the state is already loaded.',
      costLabel: 'Primary recurring hot path',
      costContext:
        'Construction and population finish before this timer starts. This is the repeated point-access cost paid throughout a long-lived store; the public recurring comparison begins here.',
      calculation: {
        timedCalculation: `One sample is the elapsed time around ${config.collectionUpdates.toLocaleString()} repetitions of one public update-by-ID followed immediately by one public read of that ID. The chart ranks total task time.`,
        outsideTimer: `Container construction, population of ${config.collectionSize.toLocaleString()} records, one priming read, module loading, round settling, and discarded warmups stay outside the timer.`,
        correctnessCheck:
          'After timing, the harness checks row count, the sum of every observed update value, and the final value of the updated row.',
        notCompared:
          'No rendering, subscriber notification work, derived selectors, persistence, middleware side effects, retained memory, or feature weighting is added.',
      },
      relatedCommand: 'node tools/bench-vs-signalstore.mjs',
      relatedSourceUrl: SIGNALTREE_REPOSITORY_URL,
      relatedSourcePath: 'tools/bench-vs-signalstore.mjs',
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
      workload: projectionWorkload,
      capability: KEYED_ENTITY_CAPABILITY,
      applicationExample:
        'An order update invalidates a table, dropdown, or derived projection that immediately reads the complete collection again.',
      financialImpact:
        'Whole-state projection matters when a screen or derived model repeatedly needs one coherent complete value. Applications dominated by keyed point reads may have a different result, or no projection workload at all.',
      costLabel: 'Conditional recurring workload',
      costContext:
        'Each timed cycle performs one keyed update and one complete collection read. It is included because some applications repeatedly need that coherent value, not because every SignalTree application should perform whole-state work after every mutation.',
      calculation: {
        timedCalculation: `One sample is the elapsed time around ${config.collectionUpdates.toLocaleString()} repetitions of one public update-by-ID followed by one complete public collection read. The chart ranks total task time.`,
        outsideTimer: `Container construction, population of ${config.collectionSize.toLocaleString()} records, one priming complete read, module loading, round settling, and discarded warmups stay outside the timer.`,
        correctnessCheck:
          'After timing, the harness checks every observed collection length, every updated value read through the complete collection, and the final collection count and value sum.',
        notCompared:
          'No component rendering, derived business calculation, subscriber fan-out, retained memory, or assumed real-world execution frequency is added.',
      },
      relatedCommand: 'node tools/bench-workload-classes.mjs',
      relatedSourceUrl: SIGNALTREE_REPOSITORY_URL,
      relatedSourcePath: 'tools/bench-workload-classes.mjs',
      arms: [
        createProjectionArm(
          'signaltree-angular',
          'SignalTree Angular',
          '#527d14',
          'Angular realization: updateOne() followed by all()',
          config,
          () => createAngularSignalTreeCollection(hooks)
        ),
        createProjectionArm(
          'signaltree-kernel',
          'SignalTree Kernel',
          '#79a51e',
          'Neutral kernel: updateOne() followed by all()',
          config,
          () => createKernelSignalTreeCollection(hooks)
        ),
        createProjectionArm(
          'ngrx-signals',
          'NgRx Signals',
          '#325ea8',
          'updateEntity() followed by complete entity-map enumeration',
          config,
          createNgRxCollection
        ),
        createProjectionArm(
          'akita',
          'Akita',
          '#8554a3',
          'EntityStore.update() followed by QueryEntity.getAll()',
          config,
          createAkitaCollection
        ),
        createProjectionArm(
          'redux-toolkit',
          'Redux Toolkit',
          '#a13d62',
          'Redux updateOne() dispatch followed by selectAll()',
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
        'This task ranks only first-party history implementations. SignalTree applies retained causal reversal facts while preserving its identity and coherent-publication semantics; Akita uses its official history facility. Their broader contracts differ, so the chart measures the shared linear-undo capability floor rather than claiming complete semantic equivalence. Sub-millisecond browser gaps near the timer floor are diagnostic, not proof of irreducible semantic overhead; overlapping observed ranges mean no clear difference in that run.',
      calculation: {
        timedCalculation: `One sample measures ${config.restorationWrites} record-and-update steps plus ${config.restorationWrites} undo-and-read steps. Total time determines rank; record and undo phase medians are also shown.`,
        outsideTimer: `Creation and seeding of ${config.restorationSize.toLocaleString()} records, history initialization/reset, module loading, round settling, and discarded warmups stay outside the timer.`,
        correctnessCheck:
          'After timing, the harness checks the value after all writes, the exact value after every undo, and the final return to the seeded value.',
        notCompared:
          'The rows reach the same tested outcome but do not claim equivalent history semantics. Redo, branching, grouping, identity preservation, causal metadata, persistence, and UI rendering are not normalized.',
      },
      relatedCommand: 'node --expose-gc tools/bench-compare.mjs --n 10000',
      relatedSourceUrl: SIGNALTREE_REPOSITORY_URL,
      relatedSourcePath: 'tools/bench-compare.mjs',
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
