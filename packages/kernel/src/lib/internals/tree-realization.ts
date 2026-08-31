import {
  NEUTRAL_CELL_RUNTIME,
  type CellRuntime,
} from './cell-runtime';
import {
  NEUTRAL_DERIVED_RUNTIME,
  type DerivedRuntime,
} from './derived-runtime';
import {
  NEUTRAL_MATERIALIZATION_REALIZATION,
  type MaterializationRealization,
} from './materialization-realization';
import {
  NEUTRAL_SCALAR_LEAF_REALIZATION,
  type ScalarLeafRealization,
} from './scalar-leaf-realization';
import {
  NEUTRAL_TRACKING_SUPPRESSION,
  type TrackingSuppression,
} from './tracking-suppression';
import { isTraversableNode } from './node-shape';

export interface TreeRealization {
  readonly cell: CellRuntime;
  readonly derived: DerivedRuntime;
  readonly materialization: MaterializationRealization;
  readonly scalarLeaf: ScalarLeafRealization;
  readonly suppressTracking: TrackingSuppression;
}

export const NEUTRAL_TREE_REALIZATION: TreeRealization = Object.freeze({
  cell: NEUTRAL_CELL_RUNTIME,
  derived: NEUTRAL_DERIVED_RUNTIME,
  materialization: NEUTRAL_MATERIALIZATION_REALIZATION,
  scalarLeaf: NEUTRAL_SCALAR_LEAF_REALIZATION,
  suppressTracking: NEUTRAL_TRACKING_SUPPRESSION,
});

export function snapshotTreeRealization(
  realization: TreeRealization
): TreeRealization {
  return Object.freeze({
    cell: realization.cell,
    derived: realization.derived,
    materialization: realization.materialization,
    scalarLeaf: realization.scalarLeaf,
    suppressTracking: realization.suppressTracking,
  });
}

export type TreeLazyRealization = Pick<
  TreeRealization,
  'cell' | 'derived' | 'materialization' | 'scalarLeaf'
>;

const TREE_REALIZATIONS = new WeakMap<object, TreeLazyRealization>();

export function bindTreeRealization(
  node: object,
  realization: TreeLazyRealization
): void {
  TREE_REALIZATIONS.set(node, realization);
}

export function getTreeRealization(
  node: unknown
): TreeLazyRealization | undefined {
  return isTraversableNode(node)
    ? TREE_REALIZATIONS.get(node as object)
    : undefined;
}

