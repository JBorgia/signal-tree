export interface IntrinsicMutation<T> {
  readonly intent: 'replace' | 'derive';
  readonly before: T;
  readonly after: T;
  readonly changed: boolean;
}

type IntrinsicMutationObserver<T> = (mutation: IntrinsicMutation<T>) => void;

const SOURCES = new WeakMap<
  object,
  Set<IntrinsicMutationObserver<unknown>>
>();

export function registerIntrinsicMutationSource(node: object): void {
  SOURCES.set(node, new Set());
}

export function observeIntrinsicMutations<T>(
  node: object,
  observer: IntrinsicMutationObserver<T>
): (() => void) | undefined {
  const source = SOURCES.get(node);
  if (!source) return undefined;
  const installed = observer as IntrinsicMutationObserver<unknown>;
  source.add(installed);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    source.delete(installed);
  };
}

export function getIntrinsicMutationObserver<T>(
  node: object
): IntrinsicMutationObserver<T> | undefined {
  const observers = SOURCES.get(node);
  if (!observers || observers.size === 0) return undefined;
  return ((mutation: IntrinsicMutation<T>) => {
    for (const observer of [...observers]) {
      try {
        observer(mutation as IntrinsicMutation<unknown>);
      } catch {
        // One observer cannot starve another after truth has committed.
      }
    }
  }) as IntrinsicMutationObserver<T>;
}
