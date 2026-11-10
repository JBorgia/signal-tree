import { markSnapshotInstalled } from './snapshot-installation';
import {openSelected,closeSelected,failSelected,consumeSelected,selectedProceed,type SelectedInvocation,type SelectedOutcome} from './selected-write-operation';
import type { ClaimedFieldEndpoint } from './native-field-selection';
import { withEntityBoundPublicationInput } from './entity-publication';
import { markTreeCell } from './cell-identity';
import { isLeafDefinition, leafDefinitionValue } from '../leaf';
import type {
  Location,
  ReadonlyLocation,
  ReadableCell,
  WritableCell,
} from './cell-runtime';
import type {
  ObservationAdapter,
  ObservationToken,
} from './observation-adapter';
import {
  NEUTRAL_OBSERVATION_ADAPTER,
  type EpochHandle,
} from './observation-adapter';
import {
  PRODUCTION_SUBSTRATE_STATS_ENABLED,
  recordProductionSubstrateStat,
} from './production-substrate-stats';
import { type TerminalRecordPlan, type PreparedPublicationUnit, combineTerminalRecords, registerIntrinsicMutationSource } from './intrinsic-mutation';
import { reportContainedObserverError } from './error-reporter';

interface DependencyConsumer {
  readonly dependencies: Map<DependencyNode, DependencyEdge>;
  readonly cleanupEdges: DependencyEdge[];
  level: number;
  invalidate(): void;
  settle(): void;
}

interface DependencyEdge {
  readonly reference: WeakRef<DependencyConsumer>;
  readonly consumers: Set<WeakRef<DependencyConsumer>>;
  version: number;
}

interface DependencyNode {
  readonly consumers: Set<WeakRef<DependencyConsumer>>;
  level: number;
  version: number;
  refresh(): void;
}

export interface LocationPublisher {
  notify(): void;
}

export interface WritableLocationBinding<T> extends LocationPublisher {
  needsAuthorityAdmission?():boolean;
  readonly location: Location<T>;
  replace(value: T): void;
  replaceSelected?(invocation: SelectedInvocation): void;
  derive(update: (current: T) => T): void;
}

const WRITABLE_LOCATION_BINDINGS = new WeakMap<
  object,
  WritableLocationBinding<unknown>
>();

const writableLocationBinding = <T>(
  location: Location<T>
): WritableLocationBinding<T> => {
  const binding = WRITABLE_LOCATION_BINDINGS.get(location as object) as
    | WritableLocationBinding<T>
    | undefined;
  if (!binding) throw new Error('Expected a writable SignalTree location');
  return binding;
};

export function isWritableLocation(value: unknown): value is Location<unknown> {
  return WRITABLE_LOCATION_BINDINGS.has(value as object);
}

/**
 * @internal The publisher a writable location's own writes already publish
 * through. Exposed so a membership transition can wake a location's observers
 * without writing it; it creates no reactive state.
 */
export function writableLocationPublisher(
  value: unknown
): LocationPublisher | undefined {
  return WRITABLE_LOCATION_BINDINGS.get(value as object);
}

export function replaceLocation<T>(location: Location<T>, value: T): void {
  writableLocationBinding(location).replace(value);
}

/** Private inverse dispatch; follows the same installed interceptor chain. */
export function replaceSelectedLocation<T>(location: Location<T>, value: T, selection: ClaimedFieldEndpoint): void {
  const binding = writableLocationBinding(location);
  if (!binding.replaceSelected) throw new Error('Selected replacement has no private projection continuation');
  const outcome:SelectedOutcome={failed:false};
  const invocation=openSelected(value,selection,outcome);
  try{binding.replaceSelected(invocation);if(outcome.failed)throw outcome.error;if(invocation.phase==='open')throw new Error('Selected continuation did not prepare');}finally{closeSelected(invocation);outcome.error=undefined;}
}

export function deriveLocation<T>(
  location: Location<T>,
  update: (current: T) => T
): void {
  writableLocationBinding(location).derive(update);
}

export function registerWritableLocationBinding<T>(
  binding: WritableLocationBinding<T>
): void {
  WRITABLE_LOCATION_BINDINGS.set(
    binding.location as object,
    binding as WritableLocationBinding<unknown>
  );
}

export type LocationWriteOperation<T> =
  | { readonly intent: 'replace'; readonly value: T }
  | { readonly intent: 'derive'; readonly update: (current: T) => T };

const synchronizeNativeWriters = <T>(
  binding: WritableLocationBinding<T>
): void => {
  const cell = binding.location as unknown as {
    set?: (value: T) => void;
    update?: (update: (current: T) => T) => void;
  };
  if (typeof cell.set !== 'function' || typeof cell.update !== 'function') {
    return;
  }
  cell.set = binding.replace;
  cell.update = binding.derive;
};

export function interceptLocationWrites<T>(
  location: Location<T>,
  intercept: (operation: LocationWriteOperation<T>, proceed: () => void) => void
): () => void {
  const binding = writableLocationBinding(location);

  const previousReplace = binding.replace;
  const previousDerive = binding.derive;
  const previousSelected = binding.replaceSelected;
  const wrappedSelected = previousSelected ? (invocation: SelectedInvocation): void => {
    if(invocation.phase!=='open'||!invocation.request)throw new Error('Selected continuation is closed');
    try{intercept({intent:'replace',value:invocation.request.value as T},selectedProceed(invocation,previousSelected));}catch(error){failSelected(invocation,error);throw error;}
  } : undefined;
  const wrappedReplace = (value: T): void =>
    intercept({ intent: 'replace', value }, () => previousReplace(value));
  const wrappedDerive = (update: (current: T) => T): void =>
    intercept({ intent: 'derive', update }, () => previousDerive(update));
  binding.replace = wrappedReplace;
  binding.replaceSelected = wrappedSelected;
  binding.derive = wrappedDerive;
  synchronizeNativeWriters(binding);

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (binding.replace === wrappedReplace) binding.replace = previousReplace;
    if (binding.replaceSelected === wrappedSelected) binding.replaceSelected = previousSelected;
    if (binding.derive === wrappedDerive) binding.derive = previousDerive;
    synchronizeNativeWriters(binding);
  };
}

export function createWritableProjection<T>(
  source: ReadonlyLocation<T>,
  write: (value: T, intent: 'replace' | 'derive', selection?: ClaimedFieldEndpoint) => void
): Location<T> {
  const location = markTreeCell(function (value?: unknown) {
    if (arguments.length === 0) return source();
    if (typeof value === 'function') {
      binding.derive(value as (current: T) => T);
    } else if (isLeafDefinition(value)) {
      binding.replace(leafDefinitionValue(value) as T);
    } else {
      binding.replace(value as T);
    }
    return undefined;
  } as Location<T>);
  const mutationSource1 = registerIntrinsicMutationSource<T>(
    location as object
  );

  const replace = (value: T, selection?: ClaimedFieldEndpoint): void => {
      const observer = mutationSource1.observer;
      const before = observer ? source.peek() : undefined;
      write(value, 'replace', selection);
      const deliver = () => { if (observer) {
        const after = source.peek();
        observer({
          intent: 'replace',
          before: before as T,
          after,
          changed: !Object.is(before, after),
        });
      }};
      if(selection?.preparation)selection.preparation.defer(deliver);else deliver();
    };
  const binding: WritableLocationBinding<T> = {
    location,
    notify: () => undefined,
    replace: value => replace(value),
    replaceSelected: invocation => {const request=consumeSelected(invocation);replace(request.value as T,request.selection);},
    derive: (update) => {
      const before = source.peek();
      withEntityBoundPublicationInput(location as object,()=>write(update(before), 'derive'));
      const observer = mutationSource1.observer;
      if (observer) {
        const after = source.peek();
        observer({
          intent: 'derive',
          before,
          after,
          changed: !Object.is(before, after),
        });
      }
    },
  };
  WRITABLE_LOCATION_BINDINGS.set(
    location as object,
    binding as WritableLocationBinding<unknown>
  );
  location.peek = source.peek;
  location.subscribe = source.subscribe;
  location.asReadonly = () => location;
  return location;
}

let activeConsumer: DependencyConsumer | undefined;
let publicationDepth = 0;
const pendingConsumers = new Set<DependencyConsumer>();
// Holdings must not own dependency nodes. A derived node's refresh closure can
// reach its recipe and the consumer being finalized through a captured owner.
// These source Sets contain only WeakRefs, so they permit edge cleanup without
// making the finalizer itself a root for an abandoned derived graph.
const dependencyFinalizer = new FinalizationRegistry<DependencyEdge[]>((edges) => {
  for (const edge of edges) {
    edge.consumers.delete(edge.reference);
  }
});

const flushConsumers = (): unknown[] => {
  const errors: unknown[] = [];
  while (pendingConsumers.size > 0) {
    const consumer = [...pendingConsumers].sort(
      (left, right) => left.level - right.level
    )[0];
    pendingConsumers.delete(consumer);
    try {
      consumer.settle();
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
};

/** Shared: an epoch has no `subscribe` surface, so it has no listeners. */
const NO_LISTENERS: ReadonlySet<() => void> = new Set<() => void>();

const notifyObservers = (
  token: ObservationToken | undefined,
  listeners: ReadonlySet<() => void>
): void => {
  let failure: unknown;
  let hasFailure = false;
  try {
    token?.invalidate();
  } catch (error) {
    failure = error;
    hasFailure = true;
  }
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // One observer cannot starve later observers of committed truth.
    }
  }
  if (hasFailure) throw failure;
};

const trackDependency = (
  node: DependencyNode,
  token: () => ObservationToken
): void => {
  if (activeConsumer) {
    let edge = activeConsumer.dependencies.get(node);
    if (!edge) {
      const reference = new WeakRef(activeConsumer);
      edge = { reference, consumers: node.consumers, version: node.version };
      node.consumers.add(reference);
      activeConsumer.dependencies.set(node, edge);
      activeConsumer.cleanupEdges.push(edge);
    } else {
      edge.version = node.version;
    }
    activeConsumer.level = Math.max(activeConsumer.level, node.level + 1);
    return;
  }
  if (PRODUCTION_SUBSTRATE_STATS_ENABLED) {
    recordProductionSubstrateStat('publicationDependencyReads');
  }
  token().observe();
};

const notifyDependents = (node: DependencyNode): void => {
  for (const reference of node.consumers) {
    const consumer = reference.deref();
    if (consumer) consumer.invalidate();
    else node.consumers.delete(reference);
  }
};

export interface LocationRuntime {
  createCell<T>(
    initial: T,
    equal?: (left: T, right: T) => boolean
  ): Location<T>;
  createDerived<T>(compute: () => T): ReadonlyLocation<T>;
  createCurrentReadonly<T>(read: () => T): ReadableCell<T>;
  createWritable<T>(
    /**
     * The location's read. `stored` asks for the stored value whatever the
     * location's presence: what a write's history records as its before
     * value, so a reversal restores storage as it was (v16 8e).
     */
    read: (stored?: boolean) => T,
    write: (value: T, intent: 'replace' | 'derive', prepare?: (physicalChanged?:boolean) => TerminalRecordPlan | undefined, prepareUnchanged?: (current: T,physicalChanged?:boolean) => TerminalRecordPlan | undefined) => boolean | {changed:boolean;physicalChanged:boolean}
  ): WritableLocationBinding<T>;
  createWritableProjection?<T>(
    compute: () => T,
    write: (value: T, intent: 'replace' | 'derive', selection?: ClaimedFieldEndpoint) => void
  ): Location<T>;
  /**
   * `SUBJECT-EPOCH-0`. A stable reactive anchor and nothing else: call it to
   * take a dependency, `update` it to invalidate everyone who did.
   *
   * It exists because a full `Location` is the wrong shape for the job. A
   * `Location` is durable authority — value, mutation observation, write
   * bindings, a registry entry — and an epoch carries no authority at all. The
   * value it holds is a counter nobody reads; the truth stays in
   * `EntityValueStore` and `StructuralStore`. Measured, that distinction is the
   * whole cost: a bare native cell in a `Map` is 562 B/entity against 1,248 B
   * for the `Location` stack around it, and wrapping the cell back up in an
   * object with methods costs another 192 B, which is why this returns the
   * cell itself rather than an `{ read, bump }` facade.
   */
  createEpoch?(): EpochHandle;
  /**
   * Advance an epoch created by THIS runtime. Separate from the handle so a
   * framework-owned handle is never written to by the kernel — see
   * `ObservationAdapter.createEpoch`.
   */
  advanceEpoch?(epoch: EpochHandle): void;
  publish(publishers: readonly LocationPublisher[]): void;
  runInvalidationGroup(run: () => void): void;
}

const NODE_LOCATION_RUNTIMES = new WeakMap<object, LocationRuntime>();

export function bindLocationRuntime(
  node: object,
  runtime: LocationRuntime
): void {
  NODE_LOCATION_RUNTIMES.set(node, runtime);
}

export function getLocationRuntime(node: object): LocationRuntime | undefined {
  return NODE_LOCATION_RUNTIMES.get(node);
}

export function createLocationRuntime(
  realization: ObservationAdapter
): LocationRuntime {
  const hasReactiveObservation = realization !== NEUTRAL_OBSERVATION_ADAPTER;
  let invalidationGroupDepth = 0;
  const groupedPublishers = new Set<LocationPublisher>();

  const deliver = (publishers: readonly LocationPublisher[]): void => {
    const errors: unknown[] = [];
    realization.runInvalidationGroup(() => {
      publicationDepth += 1;
      try {
        for (const publisher of publishers) {
          try {
            publisher.notify();
          } catch (error) {
            errors.push(error);
          }
        }
        if (publicationDepth === 1) errors.push(...flushConsumers());
      } finally {
        publicationDepth -= 1;
        if (publicationDepth === 0) pendingConsumers.clear();
      }
    });
    if (errors.length > 0) throw errors[0];
  };

  const publish = (publishers: readonly LocationPublisher[]): void => {
    if (invalidationGroupDepth > 0) {
      for (const publisher of publishers) groupedPublishers.add(publisher);
      return;
    }
    deliver(publishers);
  };

  const runInvalidationGroup = (run: () => void): void => {
    let failure: unknown;
    let hasFailure = false;
    invalidationGroupDepth += 1;
    try {
      run();
    } catch (error) {
      failure = error;
      hasFailure = true;
    } finally {
      invalidationGroupDepth -= 1;
      if (invalidationGroupDepth === 0 && groupedPublishers.size > 0) {
        const publishers = [...groupedPublishers];
        groupedPublishers.clear();
        try {
          deliver(publishers);
        } catch (error) {
          if (!hasFailure) {
            failure = error;
            hasFailure = true;
          }
        }
      }
    }
    if (hasFailure) throw failure;
  };

  const createWritable = <T>(
    read: (stored?: boolean) => T,
    write: (value: T, intent: 'replace' | 'derive', prepare?: (physicalChanged?:boolean) => TerminalRecordPlan | undefined, prepareUnchanged?: (current: T,physicalChanged?:boolean) => TerminalRecordPlan | undefined) => boolean | {changed:boolean;physicalChanged:boolean}
  ): WritableLocationBinding<T> => {
    let observationToken: ObservationToken | undefined;
    const listeners = new Set<() => void>();
    const token = () => (observationToken ??= realization.createToken());
    const node: DependencyNode = {
      consumers: new Set(),
      level: 0,
      version: 0,
      refresh: () => undefined,
    };
    const location = markTreeCell(function (value?: unknown) {
      if (arguments.length === 0) {
        trackDependency(node, token);
        return read();
      }

      if (typeof value === 'function') {
        binding.derive(value as (current: T) => T);
      } else if (isLeafDefinition(value)) {
        binding.replace(leafDefinitionValue(value) as T);
      } else {
        binding.replace(value as T);
      }
      return undefined;
    } as Location<T>);
    const mutationSource2 = registerIntrinsicMutationSource<T>(
      location as object
    );
    const binding: WritableLocationBinding<T> = {
      location,
      notify: () => {
        node.version += 1;
        notifyDependents(node);
        notifyObservers(observationToken, listeners);
      },
      replace: (next) => {
        const observer = mutationSource2.observer;
        const publicationPrepare = mutationSource2.preparePublication;
        const publicationComplete = mutationSource2.completePublication;
        const before = observer || publicationPrepare ? read(true) : undefined;
        let unit: PreparedPublicationUnit | undefined;
        let terminal: TerminalRecordPlan | undefined;
        const preparePublication = (changed: boolean, retained: T = before as T,physicalChanged=changed) => {
          unit = publicationPrepare?.({intent:'replace',before:before as T,after:changed ? next : retained,changed,physicalChanged,preparedTerminal:terminal});
          return unit?.record;
        };
        let failed = false;
        try {
          const result = write(next, 'replace', physicalChanged => combineTerminalRecords(
            terminal = mutationSource2.prepareTerminal?.({intent:'replace',before:before as T,after:next,changed:true}),
            preparePublication(true,before as T,physicalChanged)
          ), publicationPrepare ? (current,physicalChanged) => preparePublication(false,current,physicalChanged) : undefined);
          const changed=typeof result==='boolean'?result:result.changed;
          const physicalChanged=typeof result==='boolean'?result:result.physicalChanged;
          if (typeof result === 'boolean' && physicalChanged) markSnapshotInstalled(location);
          if (observer) observer({intent:'replace',before:before as T,after:changed ? next : before as T,changed,coveredRecipients:unit?.coveredRecipients});
          if (physicalChanged) publish([binding]);
        } catch (error) { failed = true; throw error; }
        finally {
          if (unit && publicationComplete) {
            try { publicationComplete(unit.completion); }
            catch (error) {
              // eslint-disable-next-line no-unsafe-finally -- Completion failure propagates only after primary success; preserve primary throws, including undefined.
              if (!failed) throw error;
              reportContainedObserverError({error,operation:'notify:subscriber'});
            }
          }
        }
      },
      derive: (update) => {
        // Native updater input and ordinary recorded truth stay separate.
        const publicationInput = mutationSource2.capturePublicationInput?.();
        const current = read();
        const publicationPrepare = mutationSource2.preparePublication;
        const publicationComplete = mutationSource2.completePublication;
        const before = mutationSource2.observer || publicationPrepare ? read(true) : current;
        const next = update(current);
        let unit: PreparedPublicationUnit | undefined;
        let terminal: TerminalRecordPlan | undefined;
        const preparePublication = (changed: boolean, retained: T = before as T,physicalChanged=changed) => {
          unit = publicationPrepare?.({intent:'derive',before,after:changed ? next : retained,changed,physicalChanged,preparedTerminal:terminal}, publicationInput);
          return unit?.record;
        };
        let failed = false;
        try {
          const result = write(next, 'derive', physicalChanged => combineTerminalRecords(
            terminal = mutationSource2.prepareTerminal?.({intent:'derive',before,after:next,changed:true}),
            preparePublication(true,before as T,physicalChanged)
          ), publicationPrepare ? (current,physicalChanged) => preparePublication(false,current,physicalChanged) : undefined);
          const changed=typeof result==='boolean'?result:result.changed;
          const physicalChanged=typeof result==='boolean'?result:result.physicalChanged;
          if (typeof result === 'boolean' && physicalChanged) markSnapshotInstalled(location);
          mutationSource2.observer?.({intent:'derive',before,after:changed ? next : before,changed,coveredRecipients:unit?.coveredRecipients});
          if (physicalChanged) publish([binding]);
        } catch (error) { failed = true; throw error; }
        finally {
          if (unit && publicationComplete) {
            try { publicationComplete(unit.completion); }
            catch (error) {
              // eslint-disable-next-line no-unsafe-finally -- Completion failure propagates only after primary success; preserve primary throws, including undefined.
              if (!failed) throw error;
              reportContainedObserverError({error,operation:'notify:subscriber'});
            }
          }
        }
      },
    };
    registerWritableLocationBinding(binding);

    // Never the stored read: `peek` is public and takes no argument.
    location.peek = () => read();
    location.subscribe = (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    location.asReadonly = () => location;
    return binding;
  };

  const createCell = <T>(
    initial: T,
    equal: (left: T, right: T) => boolean = Object.is
  ): Location<T> => {
    let value = initial;
    const binding = createWritable(
      () => value,
      (next) => {
        if (equal(value, next)) return false;
        value = next;
        return true;
      }
    );
    return binding.location;
  };

  const createDerived = <T>(compute: () => T): ReadonlyLocation<T> => {
    let initialized = false;
    let dirty = true;
    let computationFailed = false;
    let value: T;
    let observationToken: ObservationToken | undefined;
    const listeners = new Set<() => void>();
    const node: DependencyNode = {
      consumers: new Set(),
      level: 0,
      version: 0,
      refresh: () => undefined,
    };
    const token = () => (observationToken ??= realization.createToken());
    const consumer: DependencyConsumer = {
      dependencies: new Map(),
      cleanupEdges: [],
      level: 1,
      invalidate: () => {
        if (dirty) {
          if (
            listeners.size > 0 ||
            (hasReactiveObservation && observationToken)
          ) {
            pendingConsumers.add(consumer);
          }
          return;
        }
        dirty = true;
        notifyDependents(node);
        if (
          listeners.size > 0 ||
          (hasReactiveObservation && observationToken)
        ) {
          pendingConsumers.add(consumer);
        }
      },
      settle: () => {
        if (!dirty) return;
        const previous = value;
        const wasInitialized = initialized;
        readCurrent();
        if (wasInitialized && !Object.is(previous, value)) {
          publisher.notify();
        }
      },
    };
    dependencyFinalizer.register(consumer, consumer.cleanupEdges);
    const publisher: LocationPublisher = {
      notify: () => {
        notifyObservers(observationToken, listeners);
      },
    };

    const readCurrent = (): T => {
      if (!dirty && initialized) return value;

      if (initialized && !computationFailed) {
        let changed = false;
        for (const [dependency, edge] of consumer.dependencies) {
          dependency.refresh();
          if (dependency.version !== edge.version) changed = true;
        }
        if (!changed) {
          dirty = false;
          return value;
        }
      }

      for (const [dependency, edge] of consumer.dependencies) {
        dependency.consumers.delete(edge.reference);
      }
      consumer.dependencies.clear();
      consumer.cleanupEdges.length = 0;
      consumer.level = 1;
      const previous = value;
      const wasInitialized = initialized;
      const previousConsumer = activeConsumer;
      activeConsumer = consumer;
      try {
        value = compute();
        node.level = consumer.level;
        initialized = true;
        dirty = false;
        computationFailed = false;
        if (wasInitialized && !Object.is(previous, value)) {
          node.version += 1;
        }
        return value;
      } catch (error) {
        computationFailed = true;
        throw error;
      } finally {
        activeConsumer = previousConsumer;
      }
    };

    node.refresh = () => {
      if (dirty) readCurrent();
    };

    const location = markTreeCell((() => {
      const current = readCurrent();
      trackDependency(node, token);
      return current;
    }) as ReadonlyLocation<T>);
    location.peek = readCurrent;
    location.subscribe = (listener) => {
      readCurrent();
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    return location;
  };

  /**
   * `SUBJECT-EPOCH-0`, neutral implementation.
   *
   * This started as a wrapper around `createCell`, and that was wrong for a
   * reason worth recording: REACT USES THIS RUNTIME. It has no framework-native
   * persistent signals by design, so backing an epoch with a full `Location`
   * cost React +304 B/entity while Angular and Vue were winning — paying for an
   * epoch on top of losing nothing.
   *
   * A dependency node, a version, and a publisher is the whole requirement. No
   * write binding, no binding registry entry, no mutation source, no
   * peek/subscribe surface. It still routes the advance through `publish` so an
   * invalidation group batches it exactly like every other publication.
   */
  const createEpoch = (): EpochHandle => {
    let observationToken: ObservationToken | undefined;
    let version = 0;
    const token = () => (observationToken ??= realization.createToken());
    const node: DependencyNode = {
      consumers: new Set(),
      level: 0,
      version: 0,
      refresh: () => undefined,
    };
    const publisher: LocationPublisher = {
      notify: () => {
        node.version += 1;
        notifyDependents(node);
        notifyObservers(observationToken, NO_LISTENERS);
      },
    };
    const epoch = (() => {
      trackDependency(node, token);
      return version;
    }) as WritableCell<number>;
    epoch.set = (next: number) => {
      if (next === version) return;
      version = next;
      publish([publisher]);
    };
    epoch.update = (fn: (current: number) => number) => epoch.set(fn(version));
    epoch.asReadonly = () => epoch;
    return epoch as unknown as EpochHandle;
  };

  const advanceEpoch = (handle: EpochHandle): void => {
    (handle as unknown as WritableCell<number>).update((v) => v + 1);
  };

  return {
    createCell,
    createDerived,
    createCurrentReadonly: <T>(read: () => T): ReadableCell<T> =>
      realization.createCurrentReadonlyCell
        ? realization.createCurrentReadonlyCell(read)
        : read,
    createWritable,
    createEpoch,
    advanceEpoch,
    publish,
    runInvalidationGroup,
  };
}

export const NEUTRAL_LOCATION_RUNTIME = createLocationRuntime(
  NEUTRAL_OBSERVATION_ADAPTER
);

export function needsLocationAuthorityAdmission(value:object):boolean {return WRITABLE_LOCATION_BINDINGS.get(value)?.needsAuthorityAdmission?.() ?? false;}
