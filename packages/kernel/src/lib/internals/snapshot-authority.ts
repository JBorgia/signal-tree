import type { ReadableCell, WritableCell } from './cell-runtime';
import { NEUTRAL_DERIVED_RUNTIME } from './derived-runtime';
import { isNodeAccessor, snapshotNodeKey } from './node-shape';
import { markOwnerInvalidatedFrom } from './owner-invalidation-port';
import {
  getTreeRealization,
  NEUTRAL_TREE_REALIZATION,
  type TreeLazyRealization,
} from './tree-realization';

declare const ngDevMode: boolean | undefined;

interface MaterializedSnapshot<T> {
  dirty: boolean;
  value?: T;
  observe: ReadableCell<T>;
}

const MATERIALIZED = new WeakMap<object, MaterializedSnapshot<unknown>>();
const SNAPSHOT_PARENT = new WeakMap<object, WeakRef<object>>();
const TREE_STORES = new WeakSet<object>();
const VOLATILE_SNAPSHOTS = new WeakSet<object>();
const MEMBERSHIP_REVISION = new WeakMap<object, WritableCell<number>>();
export function markTreeStore(store: object): void {
  TREE_STORES.add(store);
}

export function isSnapshotNode(node: object): boolean {
  return TREE_STORES.has(node) || isNodeAccessor(node);
}

export function bindSnapshotParent(node: object, parent: object): void {
  SNAPSHOT_PARENT.set(
    snapshotNodeKey(node),
    new WeakRef(snapshotNodeKey(parent))
  );
}

export function markSnapshotVolatile(node: object): void {
  let current: object | undefined = snapshotNodeKey(node);
  while (current) {
    VOLATILE_SNAPSHOTS.add(current);
    current = SNAPSHOT_PARENT.get(current)?.deref();
  }
}

export function markSnapshotDirty(node: object): void {
  let current: object | undefined = snapshotNodeKey(node);
  while (current) {
    const snapshot = MATERIALIZED.get(current);
    if (snapshot) {
      if (snapshot.dirty) return;
      snapshot.dirty = true;
    }
    current = SNAPSHOT_PARENT.get(current)?.deref();
  }
}

function membershipRevisionFor(
  key: object,
  realization: TreeLazyRealization
): WritableCell<number> {
  let revision = MEMBERSHIP_REVISION.get(key);
  if (!revision) {
    revision = realization.cell.createCell(0);
    MEMBERSHIP_REVISION.set(key, revision);
  }
  return revision;
}

export function publishMembershipChange(node: object): void {
  markSnapshotDirty(node);
  MEMBERSHIP_REVISION.get(snapshotNodeKey(node))?.update((value) => value + 1);
  markOwnerInvalidatedFrom(node);
}

export function materializeSnapshotNode<T>(
  node: object,
  build: () => T
): T {
  const key = snapshotNodeKey(node);
  if (VOLATILE_SNAPSHOTS.has(key)) return build();
  const realization = getTreeRealization(node) ?? NEUTRAL_TREE_REALIZATION;
  let snapshot = MATERIALIZED.get(key) as MaterializedSnapshot<T> | undefined;

  if (!snapshot) {
    const tracksDependencies = realization.derived !== NEUTRAL_DERIVED_RUNTIME;
    const membershipRevision = tracksDependencies
      ? membershipRevisionFor(key, realization)
      : undefined;
    const next: MaterializedSnapshot<T> = {
      dirty: true,
      observe: undefined as unknown as ReadableCell<T>,
    };
    const read = () => {
      membershipRevision?.();
      if ('value' in next && !next.dirty) return next.value as T;

      const built = build();
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        if (built !== null && typeof built === 'object') Object.freeze(built);
      }
      next.value = built;
      next.dirty = false;
      return built;
    };
    next.observe = tracksDependencies
      ? realization.derived.createDerived(read)
      : read;
    snapshot = next;
    MATERIALIZED.set(key, snapshot as MaterializedSnapshot<unknown>);
  }

  return snapshot.observe();
}
