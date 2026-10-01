import type { ISignalTree } from '../types';
import { StudioTreeDestroyedError } from './confirmed-turn-view';
import {
  getEntityMembershipInventory,
  hasEntityMembershipSource,
} from './entity-membership-inventory';
import { isDormantMember } from './member-membership';
import { getOwnedOwnerPath, getOwnedPositionIds } from './owned-metadata';
import { isNodeAccessor } from './node-shape';
import { getPositionRegistry } from './position-registry';
import { visitTree } from './visit-tree';

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
   * Where each target lives NOW, from one walk of the live tree; `undefined`
   * when it is not currently reachable (a removed entity or entity field, an
   * omitted optional member or anything under it). This is a current
   * location, not the location at the time of the effect, and no path label
   * is ever parsed. Targets must come from this tree's evidence: positions are
   * tree-scoped, so filter observed writes by `ownerId` first. Values inside a
   * leaf (a record held by `leaf()`, an array, a Map) are not locations; such
   * effects locate to the leaf.
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

const copy = (
  segments: readonly StateLocationSegment[]
): StateLocationSegment[] => segments.map((segment) => ({ ...segment }));

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

/** Supported tooling reader. Reads the live tree; retains nothing. */
export function stateLocationReader<T>(
  tree: ISignalTree<T>
): StateLocationReader | undefined {
  if (tree.destroyed()) throw new StudioTreeDestroyedError();
  const registry = getPositionRegistry(tree.$);
  if (!registry) return undefined;
  const walk = () => {
    const located = new Map<
      number,
      {
        segments: readonly StateLocationSegment[];
        node: object;
        collection: boolean;
      }
    >();
    const locations = new WeakMap<object, readonly StateLocationSegment[]>();
    visitTree(
      tree.$,
      (node, _path, key, parent) => {
        const object = node as object;
        // An omitted optional member and everything under it are not in the
        // current state, so they have no current location.
        if (node !== tree.$ && isDormantMember(node)) return false;
        const collection =
          getEntityMembershipInventory(object) !== undefined ||
          hasEntityMembershipSource(object);
        if (
          node !== tree.$ &&
          !collection &&
          getOwnedOwnerPath(node) === undefined
        )
          return false;
        if (node !== tree.$ && getPositionRegistry(object) !== registry)
          return false;
        const segments: readonly StateLocationSegment[] =
          key === null
            ? []
            : [
                ...(locations.get(parent as object) ?? []),
                { kind: 'property', key },
              ];
        locations.set(object, segments);
        for (const position of getOwnedPositionIds(object) ?? []) {
          if (!located.has(position))
            located.set(position, { segments, node: object, collection });
        }
        // Rows are addressed through their collection, never by descending.
        if (collection) return false;
        return typeof node === 'function' && !isNodeAccessor(node)
          ? false
          : undefined;
      },
      { maxDepth: Infinity, includeNonEnumerable: true }
    );
    return located;
  };
  return {
    locate(targets) {
      if (tree.destroyed()) throw new StudioTreeDestroyedError();
      const located = walk();
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
        const entry = located.get(position);
        if (!entry) return undefined;
        if (lifetimeId === undefined) return copy(entry.segments);
        // Only a collection resolves a lifetime. Calling a same-named member of
        // any other node could invoke a leaf accessor, which writes.
        const find = entry.collection
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
        return [
          ...copy(entry.segments),
          { kind: 'entity', key },
          ...(fieldSegments ?? []).map(
            (field): StateLocationSegment => ({ kind: 'property', key: field })
          ),
        ];
      });
    },
  };
}
