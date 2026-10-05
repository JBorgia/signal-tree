import type { CarrierKind } from '../types';
import { isToolingTreeDestroyed, type ToolingTree } from './tooling-tree';
import { StudioTreeDestroyedError } from './confirmed-turn-view';
import {
  copyMembershipChanges,
  activateEntityMembership,
  getEntityMembershipInventory,
  hasEntityMembershipSource,
  type EntityMembership,
  type EntityMembershipChange,
  type EntityMembershipInventory,
} from './entity-membership-inventory';
import { getOwnedOwnerPath, getOwnedPositionIds } from './owned-metadata';
import { isNodeAccessor } from './node-shape';
import { getPositionRegistry, type TreeId } from './position-registry';
import { visitTree } from './visit-tree';

export type {
  EntityMembership,
  EntityMembershipChange,
} from './entity-membership-inventory';

export interface EntityMembershipLocation {
  readonly collectionPosition: number;
  /** Actual property segments from the source walk; never split a path label. */
  readonly location: readonly {
    readonly kind: 'property';
    readonly key: string;
  }[];
  /** Diagnostic label only. */
  readonly path: string;
}
export interface EntityMembershipCollection extends EntityMembershipLocation {
  /** Structural iteration order; independent of a row-value sort comparer. */
  readonly members: readonly EntityMembership[];
}
export interface EntityMembershipSnapshot {
  readonly treeId: TreeId;
  readonly sequence: number;
  readonly collections: readonly EntityMembershipCollection[];
}
export interface EntityMembershipEvent {
  readonly treeId: TreeId;
  readonly sequence: number;
  /** All changes in this event belong to one successful structural unit. */
  readonly changes: readonly EntityMembershipChange[];
  readonly collection: EntityMembershipLocation;
}
export interface EntityMembershipReader {
  snapshot(): EntityMembershipSnapshot;
  subscribe(listener: (event: EntityMembershipEvent) => void): () => void;
}

type Listener = { receive: (event: EntityMembershipEvent) => void };
type Collection = EntityMembershipLocation & {
  inventory: EntityMembershipInventory;
  stop: () => void;
};
type State = {
  closed: boolean;
  sequence: number;
  dispatching: boolean;
  holds: number;
  collections: Map<EntityMembershipInventory, Collection>;
  listeners: Set<Listener>;
  queue: { event: EntityMembershipEvent; audience: Listener[] }[];
};
const states = new WeakMap<object, State>();
const inventoryOwners = new WeakMap<EntityMembershipInventory, object>();

function detachLocation(
  collection: EntityMembershipLocation
): EntityMembershipLocation {
  return {
    collectionPosition: collection.collectionPosition,
    location: collection.location.map((segment) => ({ ...segment })),
    path: collection.path,
  };
}
function deliver(state: State, item: State['queue'][number]): void {
  for (const listener of item.audience) {
    if (state.closed) break;
    if (!state.listeners.has(listener)) continue;
    try {
      listener.receive({
        ...item.event,
        collection: detachLocation(item.event.collection),
        changes: copyMembershipChanges(item.event.changes),
      });
    } catch {
      /* Read-only observation cannot interrupt application operations. */
    }
  }
}
function publish(state: State, event: EntityMembershipEvent): void {
  if (state.closed || !state.listeners.size) return;
  state.queue.push({ event, audience: [...state.listeners] });
  drain(state);
}
function drain(state: State): void {
  if (state.dispatching || state.holds > 0) return;
  state.dispatching = true;
  try {
    while (!state.closed) {
      const next = state.queue.shift();
      if (!next) break;
      deliver(state, next);
    }
  } finally {
    state.dispatching = false;
  }
}
const noop = (): void => undefined;

/**
 * @internal Realization holds delivery for the whole of one reversal. Each
 * collection's delta is still sequenced and queued when it commits, so order is
 * commit order; listeners run only once every collection is installed, and a
 * listener's own reentrant write therefore queues after the reversal's deltas.
 */
export function holdEntityMembershipDelivery(root: object): () => void {
  const registry = getPositionRegistry(root);
  const state = registry && states.get(registry);
  // Inside delivery the running loop already drains in order.
  if (!state || state.dispatching) return noop;
  state.holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.holds--;
    drain(state);
  };
}

/**
 * Supported tooling reader. No row values, event journal, or mutation
 * authority. `undefined` when the tree has no entity collection. Observing a
 * collection installs only its own membership producer, on first observation.
 *
 * A full read refuses while a structural unit is installing ("still being
 * installed"): construction, `snapshot()` and `subscribe()` throw rather than
 * expose a partial inventory. Each `snapshot()`/`subscribe()` re-discovers
 * collections with one walk of the tree, so collections created later are
 * enrolled; events themselves carry deltas only.
 */
export function entityMembershipReader<
  T,
  C extends CarrierKind = CarrierKind,
  TAccum = unknown
>(tree: ToolingTree<T, C, TAccum>): EntityMembershipReader | undefined {
  if (isToolingTreeDestroyed(tree)) throw new StudioTreeDestroyedError();
  const registry = getPositionRegistry(tree.$);
  if (!registry) return undefined;
  let state = states.get(registry);
  if (!state) {
    state = {
      closed: false,
      sequence: 0,
      dispatching: false,
      holds: 0,
      collections: new Map(),
      listeners: new Set(),
      queue: [],
    };
    states.set(registry, state);
    const owned = state;
    tree.registerCleanup(() => {
      owned.closed = true;
      owned.queue.length = 0;
      owned.listeners.clear();
      for (const collection of owned.collections.values()) {
        collection.stop();
        collection.inventory.close();
      }
      owned.collections.clear();
    });
  }
  const owned = state;
  const assertLive = () => {
    if (owned.closed || isToolingTreeDestroyed(tree))
      throw new StudioTreeDestroyedError();
  };
  const discover = () => {
    const locations = new WeakMap<
      object,
      EntityMembershipCollection['location']
    >();
    visitTree(
      tree.$,
      (node, path, key, parent) => {
        const object = node as object;
        const isCollection =
          getEntityMembershipInventory(object) !== undefined ||
          hasEntityMembershipSource(object);
        if (
          node !== tree.$ &&
          !isCollection &&
          getOwnedOwnerPath(node) === undefined
        )
          return false;
        const location =
          key === null
            ? []
            : [
                ...(locations.get(parent as object) ?? []),
                { kind: 'property' as const, key },
              ];
        locations.set(object, location);
        if (!isCollection)
          return typeof node === 'function' && !isNodeAccessor(node)
            ? false
            : undefined;
        // A reused marker or foreign owned node cannot enroll another tree's
        // supplier, and therefore cannot close it during this tree's cleanup.
        if (getPositionRegistry(object) !== registry) return false;
        // First observation installs this collection's membership producer.
        const inventory = activateEntityMembership(object);
        if (!inventory) return false;
        const owner = inventoryOwners.get(inventory);
        if (owner && owner !== registry) return false;
        if (owned.collections.has(inventory)) return false;
        // v16 position ownership: a collection allocates (and registers the
        // address of) its own position when its owned positions are first
        // read. No separate activation hook is needed or installed.
        const positions = getOwnedPositionIds(object);
        if (positions?.length !== 1)
          throw new Error(
            'Entity membership collection has no unique owned position.'
          );
        const address = { collectionPosition: positions[0], location, path };
        const stop = inventory.subscribe((publication) => {
          if (owned.closed) return;
          const sequence = ++owned.sequence;
          if (!owned.listeners.size) return;
          publish(owned, {
            treeId: registry.id,
            sequence,
            collection: detachLocation(address),
            changes: copyMembershipChanges(publication.changes),
          });
        });
        inventoryOwners.set(inventory, registry);
        owned.collections.set(inventory, { ...address, inventory, stop });
        return false;
      },
      { maxDepth: Infinity, includeNonEnumerable: true }
    );
  };
  discover();
  if (!owned.collections.size) return undefined;
  return {
    snapshot() {
      assertLive();
      discover();
      return {
        treeId: registry.id,
        sequence: owned.sequence,
        collections: [...owned.collections.values()].map((collection) => ({
          ...detachLocation(collection),
          members: collection.inventory.snapshot(),
        })),
      };
    },
    subscribe(receive) {
      assertLive();
      discover();
      const listener = { receive };
      owned.listeners.add(listener);
      return () => {
        owned.listeners.delete(listener);
      };
    },
  };
}
