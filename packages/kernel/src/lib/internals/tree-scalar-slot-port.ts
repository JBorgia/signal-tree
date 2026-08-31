import type { PositionId } from '../types';
import type { WritableCell } from './cell-runtime';
import { isTraversableNode } from './node-shape';
import type {
  ScalarSlotCommitResult,
} from './tree-scalar-slot-runtime';

/**
 * The NODE-ATTACHED SCALAR-SLOT PORT.
 *
 * SCALAR-SLOT-PORT-SPLIT-0. "Does this node carry a scalar-slot runtime, and
 * which one?" is a neutral fact about a node. It lived in the Angular runtime
 * file only because that file happened to define it, which made seven KERNEL
 * modules import the ADAPTER — the dependency this split inverts.
 *
 *     PACKAGE LOCATION FOLLOWS SEMANTIC OWNERSHIP.
 *
 * The TREE-FACING contract (leaves), distinct from the physical slot
 * substrate that keeps the name `TreeScalarSlotRuntime`.
 *
 * Leaves are typed `WritableCell`, not `WritableSignal`: an Angular signal
 * satisfies the neutral contract (measured), so the adapter's realization
 * still fits while the kernel names no framework type.
 */
export type SlotIndex = number;

export interface ScalarSlotMutationFrame {
  set(slotIndex: SlotIndex, value: unknown): void;
  update(slotIndex: SlotIndex, updater: (value: unknown) => unknown): void;
  discard(): void;
  commit(options?: {
    advanceRevision?: boolean;
    publish?: boolean;
  }): ScalarSlotCommitResult;
}

export interface TreeScalarLeafRuntime {
  createLeaf<T>(
    initialValue: T,
    equal: (current: T, next: T) => boolean,
    positionId?: PositionId,
    snapshotOwner?: object
  ): WritableCell<T>;
  beginFrame(): ScalarSlotMutationFrame;
  runInvalidationGroup(run: () => void): void;
  publishPrepared(result: ScalarSlotCommitResult): void;
  resolveScalarSlot(positionId: PositionId): SlotIndex | undefined;
  resolveScalarLeaf(positionId: PositionId): WritableCell<unknown> | undefined;
  revision(): number;
  slotCount(): number;
}

const TREE_SCALAR_SLOT_RUNTIME = Symbol.for('SignalTree:ScalarSlotRuntime');

export function defineTreeScalarSlotRuntime(
  node: object,
  runtime: TreeScalarLeafRuntime
): void {
  Object.defineProperty(node, TREE_SCALAR_SLOT_RUNTIME, {
    value: runtime,
    enumerable: false,
    configurable: true,
  });
}

export function getTreeScalarSlotRuntime(
  node: unknown
): TreeScalarLeafRuntime | undefined {
  if (!isTraversableNode(node)) {
    return undefined;
  }

  return (node as Record<symbol, TreeScalarLeafRuntime | undefined>)[
    TREE_SCALAR_SLOT_RUNTIME
  ];
}
