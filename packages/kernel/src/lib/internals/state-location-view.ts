import type { CarrierKind } from '../types';
import { isToolingTreeDestroyed, type ToolingTree } from './tooling-tree';
import { StudioTreeDestroyedError } from './confirmed-turn-view';
import {
  getEntityMembershipInventory,
  hasEntityMembershipSource,
} from './entity-membership-inventory';
import { isDormantMember } from './member-membership';
import { isTraversableNode } from './node-shape';
import { getOwnedPositionIds } from './owned-metadata';
import { getPositionRegistry } from './position-registry';

/** One step of a current state location. Keys are the source's own keys. */
export type StateLocationSegment =
  | { readonly kind: 'property'; readonly key: string }
  | { readonly kind: 'entity'; readonly key: string | number };

/** What a confirmed effect or an observed write identifies. */
export interface StateLocationTarget {
  /** Tree-scoped position from the effect or write. */
  readonly position: number;
  /** Subject lifetime, when the position is an entity collection. */
  readonly lifetimeId?: number;
  /** Entity-relative property keys of an entity field effect. */
  readonly fieldSegments?: readonly string[];
}

export interface StateLocationReader {
  /**
   * Where each target lives NOW; `undefined` when it is not currently
   * reachable (a removed entity or entity field, an omitted optional member or
   * anything under it, an unknown position). This is a current location, not
   * the location at the time of the effect, and no path label is ever parsed.
   * Targets must come from this tree's evidence: positions are tree-scoped, so
   * filter observed writes by `ownerId` first. Values inside a leaf (a record
   * held by `leaf()`, an array, a Map) are not locations; such effects locate
   * to the leaf.
   */
  locate(
    targets: readonly StateLocationTarget[]
  ): readonly (readonly StateLocationSegment[] | undefined)[];
}

type CollectionNode = {
  __findKeyBySubjectId?: (subjectId: number) => string | number | undefined;
  __prepareTransitionTarget?: {
    readSource(): {
      readonly subjects: readonly { subject: number; value: unknown }[];
    };
  };
};

const isCollection = (node: object): boolean =>
  getEntityMembershipInventory(node) !== undefined ||
  hasEntityMembershipSource(node);

/** Own-property presence along `fields`; a removed field is not a location. */
function hasField(value: unknown, fields: readonly string[]): boolean {
  let cursor = value;
  for (const field of fields) {
    if (
      cursor === null ||
      typeof cursor !== 'object' ||
      !Object.prototype.hasOwnProperty.call(cursor, field)
    )
      return false;
    cursor = (cursor as Record<string, unknown>)[field];
  }
  return true;
}

/**
 * Supported tooling reader. Reads the live tree; retains nothing.
 *
 * Resolution uses v16's own position ownership: the registry's structured
 * address for the position (typed property keys recorded at allocation, never
 * a parsed label), then a walk of the CURRENT tree along it. Each step must be
 * a current member (own and enumerable); a dormant member or anything under it
 * has no current location. The node reached must still own the position.
 */
export function stateLocationReader<
  T,
  C extends CarrierKind = CarrierKind,
  TAccum = unknown
>(tree: ToolingTree<T, C, TAccum>): StateLocationReader | undefined {
  if (isToolingTreeDestroyed(tree)) throw new StudioTreeDestroyedError();
  const registry = getPositionRegistry(tree.$);
  if (!registry) return undefined;
  const root = tree.$ as unknown as object;
  /** The current node at a position, or undefined when it is not current. */
  const resolve = (
    position: number
  ): { node: object; address: readonly string[] } | undefined => {
    const address = registry.addressFor(position);
    if (!address) return undefined;
    let node: unknown = root;
    for (const key of address) {
      if (!isTraversableNode(node)) return undefined;
      // A collection's interior is addressed by lifetime, never by key walk.
      if (node !== root && isCollection(node as object)) return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(node, key);
      // Omission makes a member non-enumerable (dormant), not deleted.
      if (!descriptor || descriptor.enumerable !== true) return undefined;
      node = (node as Record<string, unknown>)[key];
      if (isDormantMember(node)) return undefined;
    }
    if (!isTraversableNode(node)) return undefined;
    if (node !== root && getPositionRegistry(node) !== registry)
      return undefined;
    if (!getOwnedPositionIds(node)?.includes(position)) return undefined;
    return { node: node as object, address };
  };
  return {
    locate(targets) {
      if (isToolingTreeDestroyed(tree)) throw new StudioTreeDestroyedError();
      const rows = new Map<object, Map<number, unknown>>();
      const rowValue = (node: object, lifetimeId: number): unknown => {
        let values = rows.get(node);
        if (!values) {
          values = new Map();
          for (const { subject, value } of (
            node as CollectionNode
          ).__prepareTransitionTarget?.readSource().subjects ?? [])
            values.set(subject, value);
          rows.set(node, values);
        }
        return values.get(lifetimeId);
      };
      return targets.map(({ position, lifetimeId, fieldSegments }) => {
        const entry = resolve(position);
        if (!entry) return undefined;
        const segments: StateLocationSegment[] = entry.address.map((key) => ({
          kind: 'property',
          key,
        }));
        if (lifetimeId === undefined) return segments;
        // Only a collection resolves a lifetime. Calling a same-named member of
        // any other node could invoke a leaf accessor, which writes.
        const find = isCollection(entry.node)
          ? (entry.node as CollectionNode).__findKeyBySubjectId
          : undefined;
        if (typeof find !== 'function') return undefined;
        const key = find.call(entry.node, lifetimeId);
        if (key === undefined) return undefined;
        if (
          fieldSegments?.length &&
          !hasField(rowValue(entry.node, lifetimeId), fieldSegments)
        )
          return undefined;
        segments.push({ kind: 'entity', key });
        for (const field of fieldSegments ?? [])
          segments.push({ kind: 'property', key: field });
        return segments;
      });
    },
  };
}
