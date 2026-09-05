import { markTreeCell } from './cell-identity';
import { isLeafDefinition, leafDefinitionValue } from '../leaf';
import type { Location, ReadonlyLocation } from './cell-runtime';
import type {
  ObservationAdapter,
  ObservationToken,
} from './observation-adapter';
import { NEUTRAL_OBSERVATION_ADAPTER } from './observation-adapter';
import {
  PRODUCTION_SUBSTRATE_STATS_ENABLED,
  recordProductionSubstrateStat,
} from './production-substrate-stats';
import {
  getIntrinsicMutationObserver,
  registerIntrinsicMutationSource,
} from './intrinsic-mutation';

interface DependencyConsumer {
  readonly dependencies: Map<DependencyNode, DependencyEdge>;
  level: number;
  invalidate(): void;
  settle(): void;
}

interface DependencyEdge {
  readonly reference: WeakRef<DependencyConsumer>;
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
  readonly location: Location<T>;
  replace(value: T): void;
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

export function replaceLocation<T>(location: Location<T>, value: T): void {
  writableLocationBinding(location).replace(value);
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
  const wrappedReplace = (value: T): void =>
    intercept({ intent: 'replace', value }, () => previousReplace(value));
  const wrappedDerive = (update: (current: T) => T): void =>
    intercept({ intent: 'derive', update }, () => previousDerive(update));
  binding.replace = wrappedReplace;
  binding.derive = wrappedDerive;
  synchronizeNativeWriters(binding);

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (binding.replace === wrappedReplace) binding.replace = previousReplace;
    if (binding.derive === wrappedDerive) binding.derive = previousDerive;
    synchronizeNativeWriters(binding);
  };
}

export function createWritableProjection<T>(
  source: ReadonlyLocation<T>,
  write: (value: T, intent: 'replace' | 'derive') => void
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
  registerIntrinsicMutationSource(location as object);

  const binding: WritableLocationBinding<T> = {
    location,
    notify: () => undefined,
    replace: (value) => {
      const observer = getIntrinsicMutationObserver<T>(location as object);
      const before = observer ? source.peek() : undefined;
      write(value, 'replace');
      if (observer) {
        const after = source.peek();
        observer({
          intent: 'replace',
          before: before as T,
          after,
          changed: !Object.is(before, after),
        });
      }
    },
    derive: (update) => {
      const before = source.peek();
      write(update(before), 'derive');
      const observer = getIntrinsicMutationObserver<T>(location as object);
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
const dependencyFinalizer = new FinalizationRegistry<
  Map<DependencyNode, DependencyEdge>
>((dependencies) => {
  for (const [node, edge] of dependencies) {
    node.consumers.delete(edge.reference);
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
      edge = { reference, version: node.version };
      node.consumers.add(reference);
      activeConsumer.dependencies.set(node, edge);
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
  createWritable<T>(
    read: () => T,
    write: (value: T, intent: 'replace' | 'derive') => boolean
  ): WritableLocationBinding<T>;
  createWritableProjection?<T>(
    compute: () => T,
    write: (value: T, intent: 'replace' | 'derive') => void
  ): Location<T>;
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
    read: () => T,
    write: (value: T, intent: 'replace' | 'derive') => boolean
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
    registerIntrinsicMutationSource(location as object);
    const binding: WritableLocationBinding<T> = {
      location,
      notify: () => {
        node.version += 1;
        notifyDependents(node);
        notifyObservers(observationToken, listeners);
      },
      replace: (next) => {
        const observer = getIntrinsicMutationObserver<T>(location as object);
        const before = observer ? read() : undefined;
        const changed = write(next, 'replace');
        if (observer) {
          observer({
            intent: 'replace',
            before: before as T,
            after: changed ? next : (before as T),
            changed,
          });
        }
        if (changed) publish([binding]);
      },
      derive: (update) => {
        const before = read();
        const next = update(before);
        const changed = write(next, 'derive');
        const observer = getIntrinsicMutationObserver<T>(location as object);
        if (observer) {
          observer({
            intent: 'derive',
            before,
            after: changed ? next : before,
            changed,
          });
        }
        if (changed) publish([binding]);
      },
    };
    registerWritableLocationBinding(binding);

    location.peek = read;
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
    dependencyFinalizer.register(consumer, consumer.dependencies);
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

  return {
    createCell,
    createDerived,
    createWritable,
    publish,
    runInvalidationGroup,
  };
}

export const NEUTRAL_LOCATION_RUNTIME = createLocationRuntime(
  NEUTRAL_OBSERVATION_ADAPTER
);
