import type { ReadableCell, WritableCell } from './cell-runtime';
import { isNodeAccessor, snapshotNodeKey } from './node-shape';
import { markOwnerInvalidatedFrom } from './owner-invalidation-port';
import {
  getLocationRuntime,
  NEUTRAL_LOCATION_RUNTIME,
  type LocationRuntime,
} from './location-runtime';

declare const ngDevMode: boolean | undefined;

interface MaterializedSnapshot<T> {
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

function membershipRevisionFor(
  key: object,
  locations: LocationRuntime
): WritableCell<number> {
  let revision = MEMBERSHIP_REVISION.get(key);
  if (!revision) {
    revision = locations.createCell(0);
    MEMBERSHIP_REVISION.set(key, revision);
  }
  return revision;
}

export function publishMembershipChange(node: object): void {
  const key = snapshotNodeKey(node);
  const locations = getLocationRuntime(node) ?? NEUTRAL_LOCATION_RUNTIME;
  membershipRevisionFor(key, locations).update((value) => value + 1);
  markOwnerInvalidatedFrom(node);
}

export function materializeSnapshotNode<T>(
  node: object,
  build: () => T
): T {
  const key = snapshotNodeKey(node);
  if (VOLATILE_SNAPSHOTS.has(key)) return build();
  const locations = getLocationRuntime(node) ?? NEUTRAL_LOCATION_RUNTIME;
  let snapshot = MATERIALIZED.get(key) as MaterializedSnapshot<T> | undefined;

  if (!snapshot) {
    const membershipRevision = membershipRevisionFor(key, locations);
    const read = () => {
      membershipRevision();
      const built = build();
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        if (built !== null && typeof built === 'object') Object.freeze(built);
      }
      return built;
    };
    snapshot = { observe: locations.createDerived(read) };
    MATERIALIZED.set(key, snapshot as MaterializedSnapshot<unknown>);
  }

  return snapshot.observe();
}
