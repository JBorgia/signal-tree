import type { PositionId } from '../types';
import { isTraversableNode } from './node-shape';

const POSITION_REGISTRY_SYMBOL = Symbol.for('SignalTree:PositionRegistry');

declare const treeIdBrand: unique symbol;

/**
 * An opaque, RUNTIME-LOCAL correlation identifier for one live SignalTree.
 *
 * ```text
 * same live tree                     -> same TreeId
 * different simultaneously-live trees -> different TreeId
 * ```
 *
 * That is the WHOLE contract. Explicitly NOT guaranteed: ordinal meaning,
 * persistence, serialization identity, recreation, cross-process stability,
 * state addressing, or restoration identity. The underlying representation is
 * not part of the contract either — consumers may compare for equality and use
 * it as a `Map` key, and nothing more.
 *
 * ⚠️ The brand prevents an arbitrary number being ACCEPTED AS a `TreeId`:
 *
 * ```ts
 * const id: TreeId = 42;   // rejected
 * ```
 *
 * ⚠️ It does NOT stop numeric arithmetic. `number & Brand` is a SUBTYPE of
 * `number`, so `treeId + 1` still compiles. Recorded so the docs never promise
 * something the type cannot enforce — and the alternative, an object-shaped
 * opaque handle, would reintroduce exactly the type/runtime mismatch we are
 * removing from the error event.
 */
export type TreeId = number & {
  readonly [treeIdBrand]: 'TreeId';
};

export interface PositionRegistry {
  /**
   * Process-unique identity for this registry's NAMESPACE.
   *
   * `positionId` means "position N in THIS registry" — it is allocated from 1
   * per registry, so two trees both call their first leaf 2. Every consumer of
   * position ids is tree-scoped and correct with that; the PROCESS-GLOBAL path
   * notifier was not, and coalesced two trees' writes into one
   * (NOTIFIER-SCOPE-0).
   *
   * The namespace is NAMED rather than eliminated. Making position ids globally
   * unique would have repaired the notifier by redefining what the identifier
   * means for the other 24 consumers, and would still leave a location unable
   * to say which tree owns it — which A2-3 independently needs.
   */
  readonly id: TreeId;
  allocate(parent?: PositionId): PositionId;
  /**
   * ADDRESS-REPAIR-1 — canonical collection authority.
   *
   * Records that `position` IS a collection, and what its canonical address is.
   * Called once at entityMap materialization, where both facts are already
   * known, so nothing later has to infer either one from a path's shape.
   *
   * ⚠️ This is deliberately NOT a general node-role taxonomy. The only role the
   * measurements earned is "this position is a collection, and here is its
   * address" — REALIZATION-ADDRESS-0 showed that single fact classifies every
   * observed case correctly at every depth.
   */
  registerCollectionPath(position: PositionId, path: string): void;
  /**
   * The canonical collection address for `position`, or `undefined` if that
   * position is not a collection.
   *
   * ⚠️ `undefined` is a MEANINGFUL answer, not a lookup miss to route around:
   * an ordinary scalar leaf is not a collection, and REALIZATION-ADDRESS-0's
   * control proves a nested leaf (`data.count`) must be rejected here even
   * though its path has a dot.
   */
  collectionPathFor(position: PositionId): string | undefined;
  parentOf(position: PositionId): PositionId | undefined;
  contains(authority: PositionId, participant: PositionId): boolean;
}

let nextRegistryId = 1;

class TreePositionRegistry implements PositionRegistry {
  /**
   * ⚠️ THE ONE PLACE a counter value becomes a tree-namespace identity.
   *
   * Branding HERE rather than at each consumer means `registry.id` and
   * `ownerRegistry.id` are already `TreeId` everywhere downstream — no producer
   * has to independently assert that some number is a tree identity.
   */
  readonly id: TreeId = nextRegistryId++ as TreeId;
  private nextPositionId = 1;
  private parents = new Map<PositionId, PositionId | undefined>();
  private collectionPaths = new Map<PositionId, string>();

  registerCollectionPath(position: PositionId, path: string): void {
    this.collectionPaths.set(position, path);
  }

  collectionPathFor(position: PositionId): string | undefined {
    return this.collectionPaths.get(position);
  }

  allocate(parent?: PositionId): PositionId {
    const positionId = this.nextPositionId++ as PositionId;
    this.parents.set(positionId, parent);
    return positionId;
  }

  parentOf(position: PositionId): PositionId | undefined {
    return this.parents.get(position);
  }

  contains(authority: PositionId, participant: PositionId): boolean {
    if (authority === participant) {
      return true;
    }

    const seen = new Set<PositionId>();
    let current: PositionId | undefined = participant;
    while (current !== undefined && !seen.has(current)) {
      seen.add(current);
      const parent = this.parentOf(current);
      if (parent === authority) {
        return true;
      }
      current = parent;
    }

    return false;
  }
}

export function createPositionRegistry(): PositionRegistry {
  return new TreePositionRegistry();
}

export function definePositionRegistry(
  node: object,
  registry: PositionRegistry
): void {
  Object.defineProperty(node, POSITION_REGISTRY_SYMBOL, {
    value: registry,
    enumerable: false,
    configurable: true,
  });
}

export function getPositionRegistry(
  node: unknown
): PositionRegistry | undefined {
  if (!isTraversableNode(node)) {
    return undefined;
  }

  return (node as Record<symbol, PositionRegistry | undefined>)[
    POSITION_REGISTRY_SYMBOL
  ];
}
