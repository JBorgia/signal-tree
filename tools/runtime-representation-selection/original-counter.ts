export function countIteratedElements(run: () => void): number {
  let visited = 0;
  const restore: Array<() => void> = [];
  const patch = (
    target: object,
    key: PropertyKey,
    wrap: (original: (...args: unknown[]) => unknown) => unknown
  ): void => {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (!descriptor) throw new Error(`nothing to count at ${String(key)}`);
    restore.push(() => Object.defineProperty(target, key, descriptor));
    Object.defineProperty(target, key, {
      ...descriptor,
      value: wrap(descriptor.value),
    });
  };
  const counting = (iterator: Iterator<unknown>): IterableIterator<unknown> => ({
    next() {
      const step = iterator.next();
      if (!step.done) visited++;
      return step;
    },
    [Symbol.iterator]() {
      return this;
    },
  });
  for (const proto of [Map.prototype, Set.prototype, Array.prototype])
    for (const key of ['keys', 'values', 'entries', Symbol.iterator])
      patch(proto, key, (original) =>
        function (this: unknown, ...args: unknown[]) {
          return counting(original.apply(this, args) as Iterator<unknown>);
        }
      );
  for (const proto of [Map.prototype, Set.prototype])
    patch(proto, 'forEach', (original) =>
      function (this: { size: number }, ...args: unknown[]) {
        visited += this.size;
        return original.apply(this, args);
      }
    );
  // Whole-array walks, counted at their full length: a search that stops
  // early still scales with the array it searches.
  for (const key of [
    'map',
    'filter',
    'forEach',
    'slice',
    'concat',
    'reduce',
    'indexOf',
    'lastIndexOf',
    'includes',
    'find',
    'findIndex',
    'some',
    'every',
    'splice',
    'sort',
    'join',
  ])
    patch(Array.prototype, key, (original) =>
      function (this: unknown[], ...args: unknown[]) {
        visited += this.length;
        return original.apply(this, args);
      }
    );
  for (const key of ['keys', 'values', 'entries'])
    patch(Object, key, (original) =>
      function (this: unknown, ...args: unknown[]) {
        const result = original.apply(this, args) as unknown[];
        visited += result.length;
        return result;
      }
    );
  patch(Array.prototype, 'push', (original) =>
    function (this: unknown[], ...args: unknown[]) {
      visited += args.length;
      return original.apply(this, args);
    }
  );
  patch(Array, 'from', (original) =>
    function (this: unknown, ...args: unknown[]) {
      const result = original.apply(this, args) as unknown[];
      visited += result.length;
      return result;
    }
  );
  let counted: number;
  try {
    visited = 0;
    run();
    counted = visited;
  } finally {
    for (let i = restore.length - 1; i >= 0; i--) restore[i]();
  }
  return counted;
}
