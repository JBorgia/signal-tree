import type { ReadableCell } from './lib/internals/cell-runtime';
import {
  createLocationRuntime,
  type LocationRuntime,
} from './lib/internals/location-runtime';
import type { ObservationAdapter } from './lib/internals/observation-adapter';

interface DependencyConsumer {
  level: number;
  invalidate(): void;
}

interface DependencySource {
  readonly consumers: Set<DependencyConsumer>;
  level: number;
}

let activeConsumer: DependencyConsumer | undefined;
let invalidationGroupDepth = 0;
const pendingConsumers = new Set<DependencyConsumer>();

const observe = (source: DependencySource): void => {
  if (activeConsumer) {
    source.consumers.add(activeConsumer);
    activeConsumer.level = Math.max(activeConsumer.level, source.level + 1);
  }
};

const invalidate = (source: DependencySource): void => {
  for (const consumer of [...source.consumers]) {
    if (invalidationGroupDepth > 0) pendingConsumers.add(consumer);
    else consumer.invalidate();
  }
};

const runInvalidationGroup = (run: () => void): void => {
  const outermost = invalidationGroupDepth === 0;
  let completed = false;
  invalidationGroupDepth++;
  try {
    run();
    completed = true;
  } finally {
    invalidationGroupDepth--;
    if (outermost && !completed) {
      pendingConsumers.clear();
    } else if (outermost) {
      invalidationGroupDepth = 1;
      try {
        while (pendingConsumers.size > 0) {
          const consumers = [...pendingConsumers];
          const producers = consumers.filter(
            (consumer) => consumer.level < Number.MAX_SAFE_INTEGER
          );
          const wave = (producers.length > 0 ? producers : consumers).sort(
            (left, right) => left.level - right.level
          );
          for (const consumer of wave) pendingConsumers.delete(consumer);
          for (const consumer of wave) consumer.invalidate();
        }
      } finally {
        pendingConsumers.clear();
        invalidationGroupDepth = 0;
      }
    }
  }
};

export type ReactiveTestRealization = ObservationAdapter & {
  readonly locations: LocationRuntime;
};

export const createReactiveTestRealization = (): ReactiveTestRealization => {
  const observation: ObservationAdapter = {
    createToken: () => {
      const source: DependencySource = { consumers: new Set(), level: 0 };
      return {
        observe: () => observe(source),
        invalidate: () => invalidate(source),
      };
    },
    runInvalidationGroup,
  };
  return {
    ...observation,
    locations: createLocationRuntime(observation),
  };
};

export const observeReactiveTestValue = <T>(
  read: () => T,
  onValue: (value: T) => void
): ReadableCell<T> => {
  let value: T;
  const consumer: DependencyConsumer = {
    level: Number.MAX_SAFE_INTEGER,
    invalidate: () => {
      const previous = activeConsumer;
      activeConsumer = consumer;
      try {
        value = read();
        onValue(value);
      } finally {
        activeConsumer = previous;
      }
    },
  };
  consumer.invalidate();
  return () => value;
};
