export interface IntrinsicMutation<T> {
  readonly intent: 'replace' | 'derive';
  readonly before: T;
  readonly after: T;
  readonly changed: boolean;
}

type IntrinsicMutationObserver<T> = (mutation: IntrinsicMutation<T>) => void;

const SOURCES = new WeakMap<object, { observer?: IntrinsicMutationObserver<unknown> }>();

export function registerIntrinsicMutationSource(node: object): void {
  SOURCES.set(node, {});
}

export function observeIntrinsicMutations<T>(
  node: object,
  observer: IntrinsicMutationObserver<T>
): (() => void) | undefined {
  const source = SOURCES.get(node);
  if (!source) return undefined;
  const installed = observer as IntrinsicMutationObserver<unknown>;
  source.observer = installed;
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (source.observer === installed) source.observer = undefined;
  };
}

export function getIntrinsicMutationObserver<T>(
  node: object
): IntrinsicMutationObserver<T> | undefined {
  return SOURCES.get(node)?.observer as IntrinsicMutationObserver<T> | undefined;
}
