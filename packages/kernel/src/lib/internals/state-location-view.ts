import type { ISignalTree } from '../types';
import { StudioTreeDestroyedError } from './confirmed-turn-view';
import { getEntityMembershipInventory } from './entity-membership-inventory';
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
   * when it is not currently reachable (a removed entity, a dropped branch).
   * This is a current location, not the location at the time of the effect,
   * and no path label is ever parsed.
   */
  locate(
    targets: readonly StateLocationTarget[]
  ): readonly (readonly StateLocationSegment[] | undefined)[];
}

type CollectionNode = {
  __findKeyBySubjectId?: (subjectId: number) => string | number | undefined;
};

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
      { segments: readonly StateLocationSegment[]; node: object }
    >();
    const locations = new WeakMap<object, readonly StateLocationSegment[]>();
    visitTree(
      tree.$,
      (node, _path, key, parent) => {
        const object = node as object;
        const collection = getEntityMembershipInventory(object) !== undefined;
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
            located.set(position, { segments, node: object });
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
      return targets.map(({ position, lifetimeId, fieldSegments }) => {
        const entry = located.get(position);
        if (!entry) return undefined;
        if (lifetimeId === undefined) return [...entry.segments];
        const key = (entry.node as CollectionNode).__findKeyBySubjectId?.(
          lifetimeId
        );
        if (key === undefined) return undefined;
        return [
          ...entry.segments,
          { kind: 'entity', key },
          ...(fieldSegments ?? []).map(
            (field): StateLocationSegment => ({ kind: 'property', key: field })
          ),
        ];
      });
    },
  };
}
