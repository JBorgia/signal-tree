import type {
  ReadableCell,
  WritableCell,
} from './lib/internals/cell-runtime';
import type { TreeRealization } from './lib/internals/tree-realization';

interface DependencyConsumer {
  level: number;
  invalidate(): void;
}

interface DependencySource {
  readonly consumers: Set<DependencyConsumer>;
  level: number;
}

let activeConsumer: DependencyConsumer | undefined;
const reactiveNodes = new WeakSet<object>();
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

const createWritable = <T>(
  initial: T,
  equal: (left: T, right: T) => boolean = Object.is
): WritableCell<T> => {
  let value = initial;
  const source: DependencySource = { consumers: new Set(), level: 0 };
  const cell = (() => {
    observe(source);
    return value;
  }) as WritableCell<T>;
  const write = (next: T): void => {
    if (equal(value, next)) return;
    value = next;
    invalidate(source);
  };
  cell.set = write;
  cell.update = (update) => write(update(value));
  cell.asReadonly = () => cell;
  reactiveNodes.add(cell);
  return cell;
};

const createDerived = <T>(compute: () => T): ReadableCell<T> => {
  let initialized = false;
  let value: T;
  const source: DependencySource = { consumers: new Set(), level: 1 };
  const recompute = (): void => {
    const previousConsumer = activeConsumer;
    activeConsumer = consumer;
    try {
      const next = compute();
      const changed = initialized && !Object.is(value, next);
      value = next;
      initialized = true;
      source.level = consumer.level;
      if (changed) invalidate(source);
    } finally {
      activeConsumer = previousConsumer;
    }
  };
  const consumer: DependencyConsumer = {
    level: 1,
    invalidate: recompute,
  };
  const derived = () => {
    observe(source);
    if (!initialized) recompute();
    return value;
  };
  reactiveNodes.add(derived);
  return derived;
};

export const createReactiveTestRealization = (): TreeRealization => ({
  cell: { createCell: createWritable },
  derived: { createDerived },
  materialization: {
    isReactiveNode: (node) =>
      typeof node === 'function' && reactiveNodes.has(node),
  },
  scalarLeaf: {
    createToken: () => {
      const source: DependencySource = { consumers: new Set(), level: 0 };
      return {
        observe: () => observe(source),
        invalidate: () => invalidate(source),
      };
    },
    createLeaf: <T,>(compute: () => T): WritableCell<T> => {
      const leaf = createDerived(compute) as WritableCell<T>;
      leaf.set = () => undefined;
      leaf.update = () => undefined;
      leaf.asReadonly = () => leaf;
      return leaf;
    },
    runInvalidationGroup,
  },
  suppressTracking: (run) => {
    const previous = activeConsumer;
    activeConsumer = undefined;
    try {
      return run();
    } finally {
      activeConsumer = previous;
    }
  },
});

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
