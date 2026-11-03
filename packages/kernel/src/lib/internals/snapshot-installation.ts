import type { ReadableCell } from './cell-runtime';
import { snapshotNodeKey } from './node-shape';

// Existing snapshot authority state, isolated from realization initialization.
export interface MaterializedSnapshot<T> {
  observe: ReadableCell<T>;
  generation: number;
  cache?: { generation: number; value: T; pendingObservation: boolean };
  attempt?: { built: boolean };
}

export const MATERIALIZED = new WeakMap<object, MaterializedSnapshot<unknown>>();
export const SNAPSHOT_PARENT = new WeakMap<object, WeakRef<object>>();

export function bindSnapshotParent(node: object, parent: object): void {
  SNAPSHOT_PARENT.set(
    snapshotNodeKey(node),
    new WeakRef(snapshotNodeKey(parent))
  );
}

// Source readers do not publish native mirrors. Keys and ancestry remain weak.
const INSTALLED_READERS = new WeakMap<object, () => unknown>();
export function bindSnapshotInstalledReader(node: object, read: () => unknown): void {
  INSTALLED_READERS.set(node, read);
}
export function readSnapshotTerminal<T>(node: ReadableCell<T>, parent: object): T {
  bindSnapshotParent(node as object, parent);
  const observed = node();
  const installed = INSTALLED_READERS.get(node as object);
  return installed ? installed() as T : observed;
}
export function markSnapshotInstalled(node: object): void {
  let current: object | undefined = snapshotNodeKey(node);
  while (current) {
    const snapshot = MATERIALIZED.get(current);
    if (snapshot) snapshot.generation++;
    current = SNAPSHOT_PARENT.get(current)?.deref();
  }
}

