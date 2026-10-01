/** Source-owned membership facts. Keys are addresses, never read from row values. */
export interface EntityMembership {
  readonly lifetimeId: number;
  readonly key: string | number;
}

/** One successful structural unit may contain several of these changes. */
export type EntityMembershipChange =
  | {
      readonly kind: 'add';
      readonly lifetimeId: number;
      readonly key: string | number;
      readonly beforeLifetimeId?: number;
      readonly afterLifetimeId?: number;
    }
  | {
      readonly kind: 'remove';
      readonly lifetimeId: number;
      readonly key: string | number;
    }
  | {
      readonly kind: 'rekey';
      readonly lifetimeId: number;
      readonly beforeKey: string | number;
      readonly afterKey: string | number;
    }
  | {
      readonly kind: 'reorder';
      readonly before: readonly number[];
      readonly after: readonly number[];
    };

export interface EntityMembershipUnit {
  /** Call after the entire structural unit commits, before reactive publication. */
  commit(changes: readonly EntityMembershipChange[]): void;
  /** Only for a refused/aborted unit that did not change membership. */
  cancel(): void;
}

export interface EntityMembershipPublication {
  readonly changes: readonly EntityMembershipChange[];
}

export interface EntityMembershipInventory {
  observed(): boolean;
  snapshot(): readonly EntityMembership[];
  begin(): EntityMembershipUnit;
  subscribe(
    listener: (publication: EntityMembershipPublication) => void
  ): () => void;
  close(): void;
}

export const copyMembers = (
  members: readonly EntityMembership[]
): EntityMembership[] => members.map((member) => ({ ...member }));
export const copyMembershipChanges = (
  changes: readonly EntityMembershipChange[]
): EntityMembershipChange[] =>
  changes.map((change) =>
    change.kind === 'reorder'
      ? { ...change, before: [...change.before], after: [...change.after] }
      : { ...change }
  );

/**
 * Private producer port. Only explicit deltas are retained during an open unit;
 * dormant units retain no event history and never read the inventory. Full reads
 * during installation refuse rather than exposing partial structural state.
 */
export function createEntityMembershipInventory(
  read: () => readonly EntityMembership[]
): EntityMembershipInventory {
  const listeners = new Set<
    (publication: EntityMembershipPublication) => void
  >();
  let depth = 0;
  let changes: EntityMembershipChange[] = [];
  let closed = false;
  return {
    observed: () => !closed && listeners.size > 0,
    snapshot() {
      if (closed) throw new Error('Entity membership inventory is closed.');
      if (depth)
        throw new Error('Entity membership unit is still being installed.');
      return copyMembers(read());
    },
    begin() {
      if (!closed) depth++;
      let finished = false;
      const finish = (unitChanges: readonly EntityMembershipChange[]) => {
        if (finished || closed) return;
        finished = true;
        if (listeners.size) changes.push(...copyMembershipChanges(unitChanges));
        if (--depth > 0) return;
        const committedChanges = changes;
        changes = [];
        if (!committedChanges.length || !listeners.size) return;
        const audience = [...listeners];
        for (const listener of audience) {
          if (closed) break;
          if (!listeners.has(listener)) continue;
          try {
            listener({ changes: copyMembershipChanges(committedChanges) });
          } catch {
            /* Tooling cannot fail a committed source mutation. */
          }
        }
      };
      return { commit: finish, cancel: () => finish([]) };
    },
    subscribe(listener) {
      if (closed) throw new Error('Entity membership inventory is closed.');
      // Do not attach to a half-installed dormant source.
      if (depth)
        throw new Error('Entity membership unit is still being installed.');
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      closed = true;
      listeners.clear();
      changes = [];
      depth = 0;
      read = () => [];
    },
  };
}

// Symbol storage survives the EntitySignal proxy without exposing a string API.
const INVENTORY = Symbol('SignalTree:EntityMembershipInventory');
export function defineEntityMembershipInventory(
  node: object,
  inventory: EntityMembershipInventory
): void {
  Object.defineProperty(node, INVENTORY, { value: inventory });
}
export function getEntityMembershipInventory(
  node: object
): EntityMembershipInventory | undefined {
  return (node as { [INVENTORY]?: EntityMembershipInventory })[INVENTORY];
}

// A collection carries only this source until membership is first observed.
// The producer (createEntityMembershipInventory) is reached from the reader,
// so applications that never read membership do not ship it.
const SOURCE = Symbol('SignalTree:EntityMembershipSource');
type EntityMembershipSource = {
  install(create: typeof createEntityMembershipInventory): EntityMembershipInventory;
};
export function defineEntityMembershipSource(
  node: object,
  source: EntityMembershipSource
): void {
  Object.defineProperty(node, SOURCE, { value: source });
}
export function hasEntityMembershipSource(node: object): boolean {
  return (node as { [SOURCE]?: EntityMembershipSource })[SOURCE] !== undefined;
}
/** Installs the producer on first observation; idempotent. */
export function activateEntityMembership(
  node: object
): EntityMembershipInventory | undefined {
  const existing = getEntityMembershipInventory(node);
  if (existing) return existing;
  return (node as { [SOURCE]?: EntityMembershipSource })[SOURCE]?.install(
    createEntityMembershipInventory
  );
}
