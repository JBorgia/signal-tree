import { markTreeCell } from './cell-identity';
import type {
  Location,
  ReadonlyLocation,
} from './cell-runtime';
import type {
  ObservationAdapter,
  ObservationToken,
} from './observation-adapter';
import { NEUTRAL_OBSERVATION_ADAPTER } from './observation-adapter';
import {
  PRODUCTION_SUBSTRATE_STATS_ENABLED,
  recordProductionSubstrateStat,
} from './production-substrate-stats';

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

export function getLocationRuntime(
  node: object
): LocationRuntime | undefined {
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
    const node: DependencyNode = {
      consumers: new Set(),
      level: 0,
      version: 0,
      refresh: () => undefined,
    };
    const token = () =>
      (observationToken ??= realization.createToken());
    const location = markTreeCell((() => {
      trackDependency(node, token);
      return read();
    }) as Location<T>);

    const binding: WritableLocationBinding<T> = {
      location,
      notify: () => {
        node.version += 1;
        notifyDependents(node);
        notifyObservers(observationToken, listeners);
      },
    };

    location.peek = read;
    location.subscribe = (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    location.set = (next) => {
      if (write(next, 'replace')) publish([binding]);
    };
    location.update = (update) => {
      if (write(update(read()), 'derive')) publish([binding]);
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
    const token = () =>
      (observationToken ??= realization.createToken());
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
        if (listeners.size > 0 || (hasReactiveObservation && observationToken)) {
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
