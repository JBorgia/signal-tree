/**
 * @signaltree/core/lazy — NOT A PUBLISHED SUBPATH. Read this before using it.
 *
 * `18fe5781` removed `./lazy` from `packages/core/package.json` exports and from
 * the rollup entry list, and `check-rc-public-dispositions.mjs` records `lazy`
 * as "UNPLACED threshold-driven subpath; no RC authority recorded". So this file
 * is built by nothing and importable by no consumer: `import { lazy } from
 * '@signaltree/core/lazy'` fails.
 *
 * It survives ONLY as the entry point `lazy-markers.spec.ts` and
 * `lazy-threshold.spec.ts` import, which is why deleting it in the 15.0 dead-
 * export sweep broke them and the deletion was reverted.
 *
 * ⚠️ THE CONSEQUENCE IS USER-FACING AND UNRESOLVED. `TreeConfig.lazy` and
 * `useLazySignals` are still public options, their JSDoc still tells readers to
 * import from `@signaltree/core/lazy`, and ST1032 tells them so at runtime —
 * all pointing at a subpath that does not ship. `useLazySignals: true` is
 * therefore permanently inert. Either the subpath is republished or the options
 * and the diagnostic go; that is a release decision, not a cleanup, and it is
 * logged rather than taken here.
 *
 * Opt-in lazy signal creation. Import `lazy()` and pass it as `signalTree(state,
 * { lazy: lazy() })` to materialize signals on-demand for large trees. Keeping
 * it here (not in the core entry) means the lazy Proxy machinery +
 * `SignalMemoryManager` (~2.6KB) tree-shake out of every bundle that doesn't
 * opt in.
 */
import { createLazySignalTree } from './lib/lazy/lazy-tree';
import { SignalMemoryManager } from './lib/memory/memory-manager';
import type { LazyFeature, TreeNode } from './lib/types';

export { SignalMemoryManager } from './lib/memory/memory-manager';
export type { LazyFeature } from './lib/types';

/**
 * Create the opt-in lazy feature for `signalTree`. With it injected, large
 * trees (or `useLazySignals: true`) create signals lazily through a Proxy
 * backed by a memory manager; without it, trees are always eager.
 *
 * @example
 * ```ts
 * import { signalTree } from '@signaltree/core';
 * import { lazy } from '@signaltree/core/lazy';
 *
 * const tree = signalTree(largeState, { lazy: lazy() });
 * ```
 */
export function lazy(): LazyFeature {
  return {
    __signalTreeLazy: true,
    build<T extends object>(
      obj: T,
      equalityFn: (a: unknown, b: unknown) => boolean
    ): { tree: TreeNode<T>; dispose: () => void } {
      const manager = new SignalMemoryManager();
      const tree = createLazySignalTree(
        obj,
        equalityFn,
        '',
        manager
      ) as TreeNode<T>;
      return { tree, dispose: () => manager.dispose() };
    },
  };
}
