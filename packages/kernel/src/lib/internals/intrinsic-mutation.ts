export interface IntrinsicMutation<T> {
  readonly intent: 'replace' | 'derive';
  readonly before: T;
  readonly after: T;
  readonly changed: boolean;
}

type IntrinsicMutationObserver<T> = (mutation: IntrinsicMutation<T>) => void;

/**
 * A mutation source, held BY THE THING THAT MUTATES rather than looked up.
 *
 * Every write used to ask a module-level `WeakMap` whether this leaf had an
 * observer, and on a tree with no inspection, capture or Studio attached the
 * answer is always no — a WeakMap probe plus a `Set.size` test per mutation
 * against a set that stays empty for the life of the process.
 *
 * A first fix short-circuited on a process-wide installed-observer count. It
 * measured well but it is the wrong ownership boundary: one observer installed
 * anywhere puts the probe back on every unrelated tree in the process. Pay for
 * use belongs at the smallest practical boundary, so the state lives here, on
 * the source, and the mutating closure keeps a direct reference to it.
 *
 * The hot path is now one field read and one branch:
 *
 * ```ts
 * const observer = source.observer;   // undefined unless THIS leaf is observed
 * if (observer) { ... }
 * ```
 *
 * `observer` is composed on install/release, never per mutation. That also
 * removes a closure allocation and an array spread that the previous version
 * performed on EVERY mutation of an observed leaf.
 */
export interface IntrinsicMutationSource<T> {
  /** `undefined` exactly when nothing observes THIS source. */
  observer: IntrinsicMutationObserver<T> | undefined;
}

interface SourceRecord {
  readonly observers: Set<IntrinsicMutationObserver<unknown>>;
  observer: IntrinsicMutationObserver<unknown> | undefined;
}

/**
 * Only `observeIntrinsicMutations` uses this, and only to find a source from a
 * node it was handed. Nothing on a mutation path reads it.
 */
const SOURCES = new WeakMap<object, SourceRecord>();

/**
 * One observer must not be able to starve another after truth has committed,
 * so a throwing observer is contained — including when it is the only one.
 */
function compose(record: SourceRecord): void {
  const { observers } = record;
  if (observers.size === 0) {
    record.observer = undefined;
    return;
  }
  if (observers.size === 1) {
    const only = observers.values().next()
      .value as IntrinsicMutationObserver<unknown>;
    record.observer = (mutation) => {
      try {
        only(mutation);
      } catch {
        // contained
      }
    };
    return;
  }
  // Snapshot so installing or releasing during a fan-out cannot disturb it.
  const snapshot = [...observers];
  record.observer = (mutation) => {
    for (const observer of snapshot) {
      try {
        observer(mutation);
      } catch {
        // contained
      }
    }
  };
}

/**
 * Registers `node` as observable and returns the handle the mutating closure
 * should keep. Callers must hold the returned source — re-deriving it per write
 * is the cost this exists to remove.
 */
export function registerIntrinsicMutationSource<T = unknown>(
  node: object
): IntrinsicMutationSource<T> {
  const record: SourceRecord = { observers: new Set(), observer: undefined };
  SOURCES.set(node, record);
  return record as IntrinsicMutationSource<T>;
}

export function observeIntrinsicMutations<T>(
  node: object,
  observer: IntrinsicMutationObserver<T>
): (() => void) | undefined {
  const record = SOURCES.get(node);
  if (!record) return undefined;
  const installed = observer as IntrinsicMutationObserver<unknown>;
  record.observers.add(installed);
  compose(record);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    record.observers.delete(installed);
    compose(record);
  };
}

/**
 * Resolve an observer from a node rather than from a held source. This is the
 * cold path — it still costs the WeakMap probe, so it must not appear on a
 * mutation path. Kept for callers that only have the node.
 */
export function getIntrinsicMutationObserver<T>(
  node: object
): IntrinsicMutationObserver<T> | undefined {
  return SOURCES.get(node)?.observer as
    | IntrinsicMutationObserver<T>
    | undefined;
}
