import { computed, isSignal, signal, untracked } from '@angular/core';
import {
  type TreeRealization,
} from '@signal-tree/kernel/adapter';

import { ANGULAR_SCALAR_LEAF_REALIZATION } from './scalar-leaf-realization';

/**
 * Immutable Angular mechanisms captured by this package's bound tree factory.
 * Selection occurs at construction; tree-owned lazy allocation retains only
 * the capabilities it needs for that tree's lifetime.
 */
export const ANGULAR_TREE_REALIZATION: TreeRealization = Object.freeze({
  materialization: {
    isReactiveNode: (node: unknown) => isSignal(node),
  },
  suppressTracking: <T,>(fn: () => T): T => untracked(fn),
  scalarLeaf: ANGULAR_SCALAR_LEAF_REALIZATION,
  derived: {
    createDerived: <T,>(compute: () => T) => computed(compute),
  },
  cell: {
    createCell: <T,>(initial: T, equal?: (a: T, b: T) => boolean) =>
      signal(initial, equal ? { equal } : undefined),
  },
});
