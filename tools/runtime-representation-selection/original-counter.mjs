function countIteratedElements(run) {
  let visited = 0;
  const restore = [];
  const patch = (target, key, wrap) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (!descriptor) throw new Error(`nothing to count at ${String(key)}`);
    restore.push(() => Object.defineProperty(target, key, descriptor));
    Object.defineProperty(target, key, {
      ...descriptor,
      value: wrap(descriptor.value)
    });
  };
  const counting = (iterator) => ({
    next() {
      const step = iterator.next();
      if (!step.done) visited++;
      return step;
    },
    [Symbol.iterator]() {
      return this;
    }
  });
  for (const proto of [Map.prototype, Set.prototype, Array.prototype])
    for (const key of ["keys", "values", "entries", Symbol.iterator])
      patch(
        proto,
        key,
        (original) => function(...args) {
          return counting(original.apply(this, args));
        }
      );
  for (const proto of [Map.prototype, Set.prototype])
    patch(
      proto,
      "forEach",
      (original) => function(...args) {
        visited += this.size;
        return original.apply(this, args);
      }
    );
  for (const key of [
    "map",
    "filter",
    "forEach",
    "slice",
    "concat",
    "reduce",
    "indexOf",
    "lastIndexOf",
    "includes",
    "find",
    "findIndex",
    "some",
    "every",
    "splice",
    "sort",
    "join"
  ])
    patch(
      Array.prototype,
      key,
      (original) => function(...args) {
        visited += this.length;
        return original.apply(this, args);
      }
    );
  for (const key of ["keys", "values", "entries"])
    patch(
      Object,
      key,
      (original) => function(...args) {
        const result = original.apply(this, args);
        visited += result.length;
        return result;
      }
    );
  patch(
    Array.prototype,
    "push",
    (original) => function(...args) {
      visited += args.length;
      return original.apply(this, args);
    }
  );
  patch(
    Array,
    "from",
    (original) => function(...args) {
      const result = original.apply(this, args);
      visited += result.length;
      return result;
    }
  );
  let counted;
  try {
    visited = 0;
    run();
    counted = visited;
  } finally {
    for (let i = restore.length - 1; i >= 0; i--) restore[i]();
  }
  return counted;
}
export {
  countIteratedElements
};
