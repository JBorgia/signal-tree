import { appendAll } from './utilities/append-all';
import {
  getEntityMembershipSource,
  MEMBERSHIP_FACTS,
  MEMBERSHIP_OPEN,
  MEMBERSHIP_OPEN_ORDER,
  type EntityMembershipInstruction,
  type EntityMembershipStore,
} from './entity-membership-source';

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
  /** For a refused unit that changed no membership; publishes nothing new. */
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
        if (listeners.size)
          appendAll(changes, copyMembershipChanges(unitChanges));
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

/** True when `node` is an entity collection that membership can observe. */
export function hasEntityMembershipSource(node: object): boolean {
  return getEntityMembershipSource(node) !== undefined;
}

type MembershipOrder = { keys: (string | number)[]; subjects: number[] };
const readOrder = (store: EntityMembershipStore): MembershipOrder => {
  const order: MembershipOrder = { keys: [], subjects: [] };
  store.snapshotActiveOrder(order.keys, order.subjects);
  return order;
};

/**
 * True when the lifetimes present at both endpoints appear in a different
 * relative order. Lifetimes present at only one endpoint are ignored.
 */
function survivingOrderChanged(
  before: readonly number[],
  after: readonly number[]
): boolean {
  const inAfter = new Set(after);
  const inBefore = new Set(before);
  const survivingBefore = before.filter((subject) => inAfter.has(subject));
  const survivingAfter = after.filter((subject) => inBefore.has(subject));
  return survivingBefore.some(
    (subject, index) => subject !== survivingAfter[index]
  );
}

/**
 * The membership delta between two complete orders of one collection, for a
 * bulk unit (setAll, clear, upsertMany, a reversal target, moveToFront):
 * removals, then additions with their neighbours in the final order, then
 * rekeys, then a reorder when surviving lifetimes moved relative to each other.
 */
function diffOrders(
  before: MembershipOrder,
  after: MembershipOrder
): EntityMembershipChange[] {
  const changes: EntityMembershipChange[] = [];
  const beforeKeys = new Map<number, string | number>();
  before.subjects.forEach((subject, index) =>
    beforeKeys.set(subject, before.keys[index])
  );
  const afterKeys = new Map<number, string | number>();
  after.subjects.forEach((subject, index) =>
    afterKeys.set(subject, after.keys[index])
  );
  before.subjects.forEach((subject, index) => {
    if (!afterKeys.has(subject))
      changes.push({
        kind: 'remove',
        lifetimeId: subject,
        key: before.keys[index],
      });
  });
  after.subjects.forEach((subject, index) => {
    if (!beforeKeys.has(subject))
      changes.push({
        kind: 'add',
        lifetimeId: subject,
        key: after.keys[index],
        beforeLifetimeId: index > 0 ? after.subjects[index - 1] : undefined,
        afterLifetimeId: after.subjects[index + 1],
      });
  });
  after.subjects.forEach((subject, index) => {
    const previous = beforeKeys.get(subject);
    if (previous !== undefined && previous !== after.keys[index])
      changes.push({
        kind: 'rekey',
        lifetimeId: subject,
        beforeKey: previous,
        afterKey: after.keys[index],
      });
  });
  if (survivingOrderChanged(before.subjects, after.subjects))
    changes.push({
      kind: 'reorder',
      before: before.subjects,
      after: after.subjects,
    });
  return changes;
}

/** Point deltas of one committed mutation frame; never scans the collection. */
function frameChanges(
  store: EntityMembershipStore,
  instructions: readonly EntityMembershipInstruction[]
): EntityMembershipChange[] {
  const changes: EntityMembershipChange[] = [];
  for (const instruction of instructions) {
    const { kind, subjectId: lifetimeId, key } = instruction;
    if (kind === 'create-fresh-subject' || kind === 'restore-subject') {
      const neighbors = store.neighborSubjectsForKey(key as string | number);
      changes.push({
        kind: 'add',
        lifetimeId,
        key: key as string | number,
        beforeLifetimeId: neighbors.beforeSubject,
        afterLifetimeId: neighbors.afterSubject,
      });
    } else if (kind === 'tombstone-subject') {
      changes.push({ kind: 'remove', lifetimeId, key: key as string | number });
    } else if (
      kind === 'transfer-key' &&
      instruction.fromKey !== instruction.toKey
    ) {
      changes.push({
        kind: 'rekey',
        lifetimeId,
        beforeKey: instruction.fromKey as string | number,
        afterKey: instruction.toKey as string | number,
      });
    }
  }
  return changes;
}

/**
 * Installs the membership producer on first observation; idempotent. The
 * collection's tap turns its structural facts into inventory units, and
 * derives deltas only while a reader listens.
 */
export function activateEntityMembership(
  node: object
): EntityMembershipInventory | undefined {
  const existing = getEntityMembershipInventory(node);
  if (existing) return existing;
  const source = getEntityMembershipSource(node);
  if (!source) return undefined;
  const inventory = createEntityMembershipInventory(() => {
    const order = readOrder(store);
    return order.subjects.map((lifetimeId, index) => ({
      lifetimeId,
      key: order.keys[index],
    }));
  });
  const units: { unit: EntityMembershipUnit; before?: MembershipOrder }[] = [];
  // The tap runs only from later structural operations, never during attach.
  const store: EntityMembershipStore = source((phase, instructions) => {
    const truth = store;
    if (phase === MEMBERSHIP_FACTS) {
      if (inventory.observed() && instructions)
        inventory.begin().commit(frameChanges(truth, instructions));
    } else if (phase === MEMBERSHIP_OPEN || phase === MEMBERSHIP_OPEN_ORDER) {
      units.push({
        unit: inventory.begin(),
        before:
          phase === MEMBERSHIP_OPEN_ORDER && inventory.observed()
            ? readOrder(truth)
            : undefined,
      });
    } else {
      // Close: announce what physically changed, also after a throw.
      const open = units.pop();
      open?.unit.commit(
        open.before ? diffOrders(open.before, readOrder(truth)) : []
      );
    }
  });
  defineEntityMembershipInventory(node, inventory);
  return inventory;
}
