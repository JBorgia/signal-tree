import { useCallback, useSyncExternalStore } from 'react';
import { observeOwnerInvalidation } from '@signal-tree/kernel/adapter';

interface SignalTreeReactOwner<TRoot extends object> {
  readonly $: TRoot;
  readonly destroyed: () => boolean;
}

type SignalTreeSelector<TRoot extends object, TSelected> = (
  root: TRoot
) => TSelected;

/**
 * Observe one owner-relative projection of canonical SignalTree truth.
 *
 * The selector must return an Object.is-stable value while its selected truth
 * is unchanged. Whole-root observation is explicit: `useSignalTree(tree, ($) =>
 * $())`.
 */
export function useSignalTree<TRoot extends object, TSelected>(
  owner: SignalTreeReactOwner<TRoot>,
  selector: SignalTreeSelector<TRoot, TSelected>
): TSelected {
  const subscribe = useCallback(
    (notify: () => void) => observeOwnerInvalidation(owner, notify),
    [owner]
  );
  const getSnapshot = useCallback(() => selector(owner.$), [owner, selector]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
