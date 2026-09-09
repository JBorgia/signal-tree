import { type StudioTreeId } from '@signal-tree/studio-query';

/**
 * Runtime tree identity -> session tree identity.
 *
 *     THE KERNEL'S RUNTIME IDENTITY MUST NEVER BE SERIALIZED.
 *
 * ⚠️ The kernel's `TreeId` contract is equality and `Map`-key use, and nothing
 * more — explicitly not persistence, ordinal meaning, recreation, or
 * cross-process stability. A `.ststudio` bundle keyed on one would name a tree
 * that does not exist on reload, and the failure would look like data
 * corruption rather than a broken key.
 *
 * So the adapter owns a mapping, and only the session-side value ever leaves
 * this package.
 */
export interface TreeIdentityRegistry {
  /** Stable for the life of this registry, per distinct runtime identity. */
  assign(runtimeTreeId: unknown): StudioTreeId;
  /** The id already assigned, or `undefined`. Never allocates. */
  existing(runtimeTreeId: unknown): StudioTreeId | undefined;
  size(): number;
}

export function createTreeIdentityRegistry(): TreeIdentityRegistry {
  // A Map keyed by the opaque runtime value — which is exactly the one use its
  // contract permits.
  const assigned = new Map<unknown, StudioTreeId>();
  let next = 1;

  return {
    assign(runtimeTreeId) {
      const already = assigned.get(runtimeTreeId);
      if (already !== undefined) {
        return already;
      }
      const studioTreeId = `tree-${String(next++).padStart(4, '0')}`;
      assigned.set(runtimeTreeId, studioTreeId);
      return studioTreeId;
    },
    existing(runtimeTreeId) {
      return assigned.get(runtimeTreeId);
    },
    size() {
      return assigned.size;
    },
  };
}
