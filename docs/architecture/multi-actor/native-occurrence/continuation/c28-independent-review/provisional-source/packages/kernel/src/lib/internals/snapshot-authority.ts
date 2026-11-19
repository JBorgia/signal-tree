import { MATERIALIZED, SNAPSHOT_PARENT, type MaterializedSnapshot } from './snapshot-installation';
export { bindSnapshotParent, markSnapshotInstalled, readSnapshotTerminal } from './snapshot-installation';
import type { Location, ReadableCell } from './cell-runtime';
import { isNodeAccessor, snapshotNodeKey } from './node-shape';
import { markOwnerInvalidatedFrom } from './owner-invalidation-port';
import {
  deriveLocation,
  getLocationRuntime,
  NEUTRAL_LOCATION_RUNTIME,
  type LocationRuntime,
} from './location-runtime';

declare const ngDevMode: boolean | undefined;

const TREE_STORES = new WeakSet<object>();
const VOLATILE_SNAPSHOTS = new WeakSet<object>();
const MEMBERSHIP_REVISION = new WeakMap<object, Location<number>>();
export function markTreeStore(store: object): void {
  TREE_STORES.add(store);
}

export function isSnapshotNode(node: object): boolean {
  return TREE_STORES.has(node) || isNodeAccessor(node);
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
): Location<number> {
  let revision = MEMBERSHIP_REVISION.get(key);
  if (!revision) {
    revision = locations.createCell(0);
    MEMBERSHIP_REVISION.set(key, revision);
  }
  return revision;
}

/**
 * @internal Depend on `node`'s membership revision without building its
 * snapshot. An absent branch reads as undefined from nothing else, so a held
 * consumer of it needs this edge to see the branch re-added (v16 8d).
 */
export function observeMembership(node: object): void {
  membershipRevisionFor(
    snapshotNodeKey(node),
    getLocationRuntime(node) ?? NEUTRAL_LOCATION_RUNTIME
  )();
}

export function publishMembershipChange(node: object): void {
  const key = snapshotNodeKey(node);
  const locations = getLocationRuntime(node) ?? NEUTRAL_LOCATION_RUNTIME;
  deriveLocation(membershipRevisionFor(key, locations), (value) => value + 1);
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
    // Register before the first evaluation, including a cold reentrant build.
    let observe: ReadableCell<T> | undefined;
    const record: MaterializedSnapshot<T> = {
      generation: 0,
      get observe() { return observe ??= locations.createDerived(read); },
    };
    const read = () => {
      if (record.attempt) record.attempt.built = true;
      const generation = record.generation;
      const previousCache = record.cache;
      membershipRevision();
      const built = build();
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        if (built !== null && typeof built === 'object') Object.freeze(built);
      }
      // Never cache an output spanning an installation, nor retry its callback.
      if (generation !== record.generation) return built;
      if (record.cache?.generation === generation &&
          (record.cache.pendingObservation || record.cache !== previousCache)) {
        record.cache.pendingObservation = false;
        return record.cache.value;
      }
      // An ordinary runtime invalidation can come from a foreign/custom source
      // without an install hook. Only an early current-read winner is reusable.
      record.cache = { generation, value: built, pendingObservation: false };
      return built;
    };
    MATERIALIZED.set(key, record as MaterializedSnapshot<unknown>);
    snapshot = record;
  }

  const previous = snapshot.attempt;
  const receipt = { built: false };
  snapshot.attempt = receipt;
  try {
    const observed = snapshot.observe();
    if (receipt.built) return observed;
    if (snapshot.cache?.generation === snapshot.generation) return snapshot.cache.value;
    // Observe was cached by the runtime: read installed truth without publishing.
    // Use the same tracked builder; a later real observe pass still collects all
    // dependencies and may allocate a temporary output before reusing this one.
    const generation = snapshot.generation;
    const built = build();
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      if (built !== null && typeof built === 'object') Object.freeze(built);
    }
    if (generation !== snapshot.generation) return built;
    if (snapshot.cache?.generation === generation) return snapshot.cache.value;
    snapshot.cache = { generation, value: built, pendingObservation: true };
    return built;
  } finally {
    snapshot.attempt = previous;
  }
}
