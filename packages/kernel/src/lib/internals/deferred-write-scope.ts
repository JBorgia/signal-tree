/** Deferred writes must execute before their semantic classification expires. */
type DeferredScope = Set<() => void>;
let activeScope: DeferredScope | undefined;
const noop = (): void => undefined;
const treeDrains = new WeakMap<object, () => void>();

/** @internal Queued predecessor writes must land before a new transaction opens. */
export function registerDeferredTreeWrites(
  owner: object,
  drain: () => void
): () => void {
  treeDrains.set(owner, drain);
  return () => {
    if (treeDrains.get(owner) === drain) treeDrains.delete(owner);
  };
}

/** @internal This drains only the owning tree, never unrelated trees' work. */
export function flushDeferredTreeWrites(owner: object): void {
  treeDrains.get(owner)?.();
}

/** @internal Identity only; queued writes may deduplicate within one scope. */
export function deferredWriteScopeIdentity(): object | undefined {
  return activeScope;
}

/** @internal Enrol a queued write in the innermost synchronous semantic scope. */
export function onWriteScopeClosing(flush: () => void): () => void {
  const scope = activeScope;
  if (!scope) return noop;
  scope.add(flush);
  return () => {
    scope.delete(flush);
  };
}

/** @internal Drain while the caller's context/capture authority is still active. */
export function withDeferredWriteScope<R>(run: () => R): R {
  const previous = activeScope;
  const scope: DeferredScope = new Set();
  activeScope = scope;
  let failed = false;
  let failure: unknown;
  let result!: R;
  try {
    try {
      result = run();
    } catch (error) {
      failed = true;
      failure = error;
    }
    // Remove before invoking: delivery may enqueue another scoped write.
    for (const flush of scope) {
      scope.delete(flush);
      try {
        flush();
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        } else {
          try {
            console.error(
              '[SignalTree] Secondary error draining deferred writes:',
              error
            );
          } catch {
            /* Preserve the original operation failure. */
          }
        }
      }
    }
  } finally {
    scope.clear();
    activeScope = previous;
  }
  if (failed) throw failure;
  return result;
}
