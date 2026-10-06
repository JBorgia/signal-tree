import type { WriteMetadata } from '../mutation-types';
import { getActiveWriteContext } from '../write-context';
import { deepEqual, unwrapBranchForWriteCapture } from '../utils';
import { getOwnedOwnerPath, getOwnedPositionIds } from './owned-metadata';
import { hasPathObservers, pathObservation } from './path-observation-port';
import {
  getPositionRegistry,
  type PositionRegistry,
} from './position-registry';
import {
  republishMemberSubtree,
  setMemberPresence,
} from './member-membership';
import { publishMembershipChange } from './snapshot-authority';
import { getTreeScalarSlotRuntime } from './tree-scalar-slot-port';
import { withWriteContext } from '../write-context';
import { isNodeAccessor, isTraversableNode } from './node-shape';
import { isWritableLocation, replaceLocation } from './location-runtime';
import type { ScalarSlotCommitResult } from './tree-scalar-slot-runtime';
import type { CollectionTransitionTargetBinding } from './causal-runtime/target-transition';

type MemberValue =
  | { readonly present: false }
  | { readonly present: true; readonly value: unknown };

export interface PlainBranchMemberChange {
  readonly key: string;
  readonly positionIds?: readonly number[];
  readonly before: MemberValue;
  readonly after: MemberValue;
}

export interface PlainBranchMembershipChange {
  readonly kind: 'plain-branch-membership';
  /** The retained branch location, including when it has no allocated position. */
  readonly branch: object;
  readonly members: readonly PlainBranchMemberChange[];
}

// Internal notification payload, not a new public WriteMetadata field. A
// membership transition is not a scalar write or an EntityMap lifetime effect.
const MEMBERSHIP = Symbol('SignalTree:PlainBranchMembership');
type MembershipMetadata = WriteMetadata & {
  readonly [MEMBERSHIP]?: PlainBranchMembershipChange;
};

export function plainBranchMembershipChange(
  meta: WriteMetadata | undefined
): PlainBranchMembershipChange | undefined {
  return (meta as MembershipMetadata | undefined)?.[MEMBERSHIP];
}

/**
 * An entity collection held as a member of a plain branch. A whole value that
 * leaves out its key omits it like any member; its rows are its own state,
 * retained whole while it is omitted, so its membership is presence only
 * (v16 integration 8d (b)). Before 8d its membership change was observed but
 * never recorded, so undo, redo, jumpTo and rollback left it omitted.
 */
function isCollectionMember(node: unknown): boolean {
  if (!isTraversableNode(node)) return false;
  const binding = (
    node as { __prepareTransitionTarget?: CollectionTransitionTargetBinding }
  ).__prepareTransitionTarget;
  return (
    binding !== undefined &&
    binding.owner === getOwnedPositionIds(node)?.[0]
  );
}

/** A member whose membership history records and reversals restore. */
function isRecordedMember(node: unknown): boolean {
  return (
    isNodeAccessor(node) || isWritableLocation(node) || isCollectionMember(node)
  );
}

/** Capture only members whose presence the supplied whole value could change. */
export function capturePlainBranchMembership(
  branch: object,
  supplied: object
): (() => void) | undefined {
  if (!hasPathObservers()) return undefined;
  const registry = getPositionRegistry(branch);
  const path = getOwnedOwnerPath(branch);
  if (!registry || path === undefined) return undefined;

  const keys = new Set(Object.keys(supplied));
  const before = new Map<string, MemberValue>();
  for (const key of Object.getOwnPropertyNames(branch)) {
    const descriptor = Object.getOwnPropertyDescriptor(branch, key);
    if (!descriptor || !('value' in descriptor)) continue;
    const present = descriptor.enumerable === true;
    if (present === keys.has(key)) continue;
    // Callable implementation properties are not retained state locations.
    if (
      !present &&
      typeof descriptor.value !== 'function' &&
      !isCollectionMember(descriptor.value)
    )
      continue;
    before.set(
      key,
      present
        ? {
            present: true,
            value: unwrapBranchForWriteCapture(descriptor.value),
          }
        : { present: false }
    );
  }
  if (before.size === 0) return undefined;

  const meta = getActiveWriteContext();
  return () => {
    const members: PlainBranchMemberChange[] = [];
    for (const [key, previous] of before) {
      const descriptor = Object.getOwnPropertyDescriptor(branch, key);
      const present = descriptor?.enumerable === true;
      if (present === previous.present) continue;
      if (previous.present) rememberHiddenRows(descriptor?.value);
      members.push({
        key,
        positionIds: getOwnedPositionIds(descriptor?.value),
        before: previous,
        after: present
          ? {
              present: true,
              value: unwrapBranchForWriteCapture(descriptor?.value),
            }
          : { present: false },
      });
    }
    if (members.length === 0) return;

    const notification: MembershipMetadata = {
      ...meta,
      [MEMBERSHIP]: { kind: 'plain-branch-membership', branch, members },
    };
    // The value slots are deliberately unused: this is a tagged membership
    // event, never a value of undefined to assign. Its payload names the actual
    // branch and literal member keys; `path` is only diagnostic text. A bare
    // branch need not have a PositionId, and allocating one here would be too
    // late for a consumer that already indexed the observed locations.
    pathObservation().notify(
      path,
      undefined,
      undefined,
      path,
      undefined,
      getOwnedPositionIds(branch),
      notification,
      registry.id
    );
  };
}

/** Apply presence to a consumer's eligible value without rereading local state. */
export function applyPlainBranchMembership<T>(
  previous: T,
  segments: readonly string[],
  change: PlainBranchMembershipChange
): T {
  const apply = (value: unknown, depth: number): unknown => {
    // An absent eligible ancestor must not be resurrected by a descendant's
    // membership change (e.g. a branch removed by eligible work, then inspected).
    if (value === null || typeof value !== 'object') return value;
    const current = value as Record<string, unknown>;
    const result = { ...current };
    if (depth < segments.length) {
      const key = segments[depth];
      if (!Object.prototype.hasOwnProperty.call(current, key)) return value;
      Object.defineProperty(result, key, {
        value: apply(current[key], depth + 1),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    } else {
      for (const member of change.members) {
        if (!member.after.present) {
          delete result[member.key];
        } else {
          Object.defineProperty(result, member.key, {
            value: member.after.value,
            enumerable: true,
            configurable: true,
            writable: true,
          });
        }
      }
    }
    return result;
  };
  return apply(previous, 0) as T;
}

/** Presence is effect metadata. before/after always remain application values. */
export interface PlainBranchMemberPresence {
  readonly before: boolean;
  readonly after: boolean;
}

interface MemberAddress {
  readonly branch: object;
  readonly key: string;
  readonly node: object;
}

// Addresses are owned by the tree registry, not by values or public history.
// Presence still comes only from the member descriptor, never from this map.
const MEMBER_ADDRESSES = new WeakMap<
  PositionRegistry,
  Map<number, MemberAddress>
>();

export interface PlainBranchMembershipEffect {
  readonly kind: 'set';
  readonly position: number;
  readonly path: string;
  readonly ownerPath: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly plainBranchMembership: PlainBranchMemberPresence;
  readonly mutationIntent: 'replace';
}

interface MemberEffectValues {
  before: unknown;
  after: unknown;
  plainBranchMembership?: PlainBranchMemberPresence;
}

/** Internal capture lowering; a bare observed branch needs no causal effect. */
export function plainBranchMembershipEffects(
  meta: WriteMetadata | undefined
): readonly PlainBranchMembershipEffect[] | undefined {
  const change = plainBranchMembershipChange(meta);
  if (!change) return undefined;
  const registry = getPositionRegistry(change.branch);
  if (!registry) return [];
  let addresses = MEMBER_ADDRESSES.get(registry);
  if (!addresses) {
    addresses = new Map();
    MEMBER_ADDRESSES.set(registry, addresses);
  }
  return change.members.flatMap((member) => {
    const position = member.positionIds?.[0];
    if (position === undefined) return [];
    const node = Object.getOwnPropertyDescriptor(
      change.branch,
      member.key
    )?.value;
    const path = getOwnedOwnerPath(node);
    if (path === undefined || !isRecordedMember(node)) return [];
    addresses.set(position, { branch: change.branch, key: member.key, node });
    return [
      {
        kind: 'set' as const,
        position,
        path,
        ownerPath: path,
        before: member.before.present ? member.before.value : undefined,
        after: member.after.present ? member.after.value : undefined,
        plainBranchMembership: {
          before: member.before.present,
          after: member.after.present,
        },
        mutationIntent: 'replace' as const,
      },
    ];
  });
}

/** Compose a member's value and presence into one before/after effect. */
export function composePlainBranchMemberEffect(
  existing: MemberEffectValues,
  incoming: Readonly<MemberEffectValues>
): boolean {
  if (!existing.plainBranchMembership && !incoming.plainBranchMembership)
    return false;
  const before =
    existing.plainBranchMembership?.before ??
    incoming.plainBranchMembership?.before ??
    true;
  // Whole-value reactivation writes its supplied value before announcing
  // membership. Its preliminary scalar write does not establish initial presence.
  if (
    !existing.plainBranchMembership &&
    incoming.plainBranchMembership?.before === false
  ) {
    existing.before = incoming.before;
  }
  existing.after = incoming.after;
  existing.plainBranchMembership = {
    before,
    after: incoming.plainBranchMembership?.after ?? true,
  };
  return true;
}

export function plainBranchMemberEffectIsNoop(
  effect: Readonly<MemberEffectValues>
): boolean {
  const before = effect.plainBranchMembership?.before ?? true;
  const after = effect.plainBranchMembership?.after ?? true;
  return before === after && (!before || effect.before === effect.after);
}

function memberAddress(
  root: object,
  position: number
): MemberAddress | undefined {
  const registry = getPositionRegistry(root);
  if (!registry) return undefined;
  const address = MEMBER_ADDRESSES.get(registry)?.get(position);
  if (!address || getPositionRegistry(address.branch) !== registry)
    return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(
    address.branch,
    address.key
  );
  return descriptor?.value === address.node &&
    descriptor.configurable === true &&
    getOwnedPositionIds(address.node)?.[0] === position &&
    isRecordedMember(address.node)
    ? address
    : undefined;
}

/**
 * The rows each hidden collection held when it was last hidden (omitted, or
 * under a branch that was omitted), or last written by a reversal or a
 * rollback while hidden. History expects to find them when it makes the
 * collection current again.
 */
const OMITTED_ROWS = new WeakMap<object, unknown>();

/**
 * A collection's installed rows, `[subject, key, value]` in order, read from
 * its own physical truth. Not its snapshot: a reversal publishes members
 * before the collection's snapshot is refreshed, so a snapshot read there was
 * stale (measured: redo of a designated re-add refused against the rows the
 * undo had just replaced).
 */
type CollectionRows = ReadonlyArray<readonly [unknown, unknown, unknown]>;

function collectionRows(node: object): CollectionRows {
  const binding = (
    node as { __prepareTransitionTarget?: CollectionTransitionTargetBinding }
  ).__prepareTransitionTarget;
  return (
    binding
      ?.readSource()
      .subjects.map(({ subject, key, value }) => [subject, key, value] as const) ??
    []
  );
}

function rememberOmittedRows(node: object): void {
  OMITTED_ROWS.set(node, collectionRows(node));
}

/**
 * Each collection a member's presence change hides or shows: the member
 * itself, or every collection current within it (its subtree below present
 * members). A collection omitted inside it stays absent with it.
 */
function collectionsWithin(member: unknown, visit: (node: object) => void): void {
  if (isCollectionMember(member)) {
    visit(member as object);
    return;
  }
  if (!isNodeAccessor(member)) return;
  for (const key of Object.keys(member)) {
    const child = (member as Record<string, unknown>)[key];
    if (isCollectionMember(child) || isNodeAccessor(child))
      collectionsWithin(child, visit);
  }
}

/** Remember the rows of every collection a member's omission hides. */
function rememberHiddenRows(member: unknown): void {
  collectionsWithin(member, rememberOmittedRows);
}

/**
 * The rows a reversal writes itself are its own effects, not a change made
 * while the collection was omitted, so they are left out of the comparison;
 * so is the order when the reversal reorders the collection.
 */
function omittedRowsChanged(
  node: object,
  touched: ReadonlySet<unknown>,
  reordered: boolean
): boolean {
  const expected = OMITTED_ROWS.get(node) as CollectionRows | undefined;
  if (!expected) return false;
  const untouched = (rows: CollectionRows) => {
    const kept = rows.filter(([subject]) => !touched.has(subject));
    return reordered
      ? [...kept].sort(([a], [b]) => (String(a) < String(b) ? -1 : 1))
      : kept;
  };
  return !deepEqual(untouched(collectionRows(node)), untouched(expected));
}

/**
 * The path of a collection that re-adding the omitted member at `position`
 * would make current without restoring it: rows the reversal does not write
 * itself (`touched`, by collection position) changed after it was hidden, by
 * a write through a handle held on it. The member is the collection itself or
 * a branch holding it. Re-adding it would bring back rows the reversed
 * operation never had, which "DORMANT STORAGE MUST NOT SUPPLY THE REACTIVATED
 * VALUE" (`whole-value-membership.spec.ts` 18) forbids.
 */
export function changedOmittedCollection(
  root: object,
  position: number,
  touched: (collection: number) => ReadonlySet<unknown>,
  reordered: (collection: number) => boolean
): string | undefined {
  const address = memberAddress(root, position);
  if (
    !address ||
    Object.getOwnPropertyDescriptor(address.branch, address.key)?.enumerable
  )
    return undefined;
  let changed: string | undefined;
  collectionsWithin(address.node, (node) => {
    const owner = getOwnedPositionIds(node)?.[0] as number;
    if (
      changed === undefined &&
      omittedRowsChanged(node, touched(owner), reordered(owner))
    )
      changed = getOwnedOwnerPath(node) ?? String(owner);
  });
  return changed;
}

/**
 * @internal A rollback compensates a hidden collection's retained rows (8b,
 * 8c): what it leaves there is what history expects when it makes the
 * collection current again.
 */
export function refreshOmittedCollection(root: object, position: number): void {
  if (!hidingMembers(root, position)?.length) return;
  const address = getPositionRegistry(root)?.addressFor(position);
  let node: unknown = root;
  for (const key of address ?? []) {
    if (!isTraversableNode(node)) return;
    node = Object.getOwnPropertyDescriptor(node, key)?.value;
  }
  if (isCollectionMember(node)) rememberOmittedRows(node as object);
}

/** Validate the retained location, never a display-path reconstruction. */
export function canRealizePlainBranchMember(
  root: object,
  position: number
): boolean {
  return memberAddress(root, position) !== undefined;
}

/** Live presence for replay admission; absence is not a value of undefined. */
export function readPlainBranchMember(
  root: object,
  position: number
): MemberValue | undefined {
  const address = memberAddress(root, position);
  if (!address) return undefined;
  return Object.getOwnPropertyDescriptor(address.branch, address.key)
    ?.enumerable
    ? { present: true, value: unwrapBranchForWriteCapture(address.node) }
    : { present: false };
}

/** A member that hides a location, with the location's keys below it. */
export interface HidingMember {
  readonly position: number | undefined;
  readonly path: string | undefined;
  readonly node: object;
  readonly below: readonly string[];
}

/**
 * The omitted members that hide `position` from the current tree: the
 * location itself or a branch above it, outermost first. Empty when the
 * location is current. Walks the registry's structured address, never a
 * display path; `undefined` when that walk does not reach a node owning the
 * position. A retained slot is not evidence that its location is current.
 */
export function hidingMembers(
  root: object,
  position: number
): readonly HidingMember[] | undefined {
  const address = getPositionRegistry(root)?.addressFor(position);
  if (!address) return undefined;
  const hiding: HidingMember[] = [];
  let node: unknown = root;
  for (let i = 0; i < address.length; i++) {
    const descriptor = isTraversableNode(node)
      ? Object.getOwnPropertyDescriptor(node, address[i])
      : undefined;
    if (!descriptor || !('value' in descriptor)) return undefined;
    node = descriptor.value;
    if (!descriptor.enumerable)
      hiding.push({
        position: getOwnedPositionIds(node)?.[0],
        path: getOwnedOwnerPath(node),
        node: node as object,
        below: address.slice(i + 1),
      });
  }
  return getOwnedPositionIds(node)?.includes(position) ? hiding : undefined;
}

/**
 * The transition binding of the collection that owns `position`, reached
 * along its structured address whether or not an omitted member hides it.
 * The current-tree walk skips hidden members, so a reversal that re-adds a
 * member, or a rollback that compensates retained storage, looks here.
 */
export function collectionBindingAt(
  root: object,
  position: number
): CollectionTransitionTargetBinding | undefined {
  const address = getPositionRegistry(root)?.addressFor(position);
  if (!address) return undefined;
  let node: unknown = root;
  for (const key of address) {
    if (!isTraversableNode(node)) return undefined;
    node = Object.getOwnPropertyDescriptor(node, key)?.value;
  }
  const binding = (
    node as { __prepareTransitionTarget?: CollectionTransitionTargetBinding }
  )?.__prepareTransitionTarget;
  return binding?.owner === position ? binding : undefined;
}

/** Whether a member can be re-added through plain-branch membership. */
export function isReAddableMember(node: unknown): boolean {
  return isNodeAccessor(node) || isWritableLocation(node);
}

/** A location a re-added member must make current again. */
export interface HiddenMemberTarget {
  /** Keys from the re-added member down to the location. */
  readonly below: readonly string[];
  /** The value to install; absent when only the way must be current (a collection). */
  readonly value?: { readonly value: unknown };
}

/**
 * The whole value that re-adds a hidden member, built only from supplied
 * targets. Retained (dormant) storage never supplies a value: "DORMANT STORAGE
 * MUST NOT SUPPLY THE REACTIVATED VALUE" (`whole-value-membership.spec.ts`
 * 18; `activateOne` in `member-membership.ts`). So the members on the
 * targets' way are re-added and every other state location stays absent. An
 * entity collection or marker is not a membership-managed location: it stays
 * where it is and becomes current with its branch.
 */
export function composeHiddenMemberValue(
  member: object,
  targets: readonly HiddenMemberTarget[]
): unknown {
  let whole: { value: unknown } | undefined;
  const children = new Map<string, HiddenMemberTarget[]>();
  for (const target of targets) {
    if (target.below.length === 0) {
      // The member is the location itself; the last target wins.
      if (target.value) whole = target.value;
      continue;
    }
    const [key, ...below] = target.below;
    let list = children.get(key);
    if (!list) children.set(key, (list = []));
    list.push({ below, value: target.value });
  }
  if (whole) return whole.value;
  const value: Record<string, unknown> = {};
  for (const [key, list] of children) {
    const child = Object.getOwnPropertyDescriptor(member, key)?.value;
    if (isNodeAccessor(child) || isWritableLocation(child))
      value[key] = composeHiddenMemberValue(child as object, list);
  }
  return value;
}

/** Apply a recorded member to detached history using actual property keys. */
export function applyPlainBranchMemberSnapshot<T>(
  root: object,
  snapshot: T,
  position: number,
  present: boolean,
  value: unknown
): T {
  const address = memberAddress(root, position);
  if (!address) throw new Error('Plain branch history location is unavailable');
  const seen = new Set<object>();
  const find = (
    node: object,
    segments: readonly string[]
  ): readonly string[] | undefined => {
    if (node === address.branch) return segments;
    if (seen.has(node)) return undefined;
    seen.add(node);
    // Dormant branch accessors remain physically retained and addressable.
    for (const key of Object.getOwnPropertyNames(node)) {
      const child = Object.getOwnPropertyDescriptor(node, key)?.value;
      if (!isNodeAccessor(child)) continue;
      const found = find(child, [...segments, key]);
      if (found) return found;
    }
    return undefined;
  };
  const segments = find(root, []);
  if (!segments)
    throw new Error('Plain branch history location is unavailable');
  const state: MemberValue = present
    ? { present: true, value }
    : { present: false };
  return applyPlainBranchMembership(snapshot, segments, {
    kind: 'plain-branch-membership',
    branch: address.branch,
    members: [{ key: address.key, before: state, after: state }],
  });
}

/**
 * Stage a declarative membership target without calling authored write paths.
 * The transition coordinator owns the physical revision and must install ALL
 * participants before publishing any. A plan is synchronous and single use.
 */
export function preparePlainBranchMembers(
  root: object,
  targets: ReadonlyMap<
    number,
    { readonly present: boolean; readonly value: unknown }
  >
): { install(): void; publish(): void } {
  const registry = getPositionRegistry(root);
  const runtime = getTreeScalarSlotRuntime(root);
  if (!registry || !runtime)
    throw new Error('Plain branch target has no scalar runtime');
  const members = new Map<
    object,
    {
      address: MemberAddress;
      present: boolean;
      before: MemberValue;
    }
  >();
  const values = new Map<
    number,
    { node: object; position: number; before: unknown; after: unknown }
  >();
  const resolveSlot = (node: object): { position: number; slot: number } => {
    const position = getOwnedPositionIds(node)?.[0];
    const slot =
      position === undefined ? undefined : runtime.resolveScalarSlot(position);
    if (
      position === undefined ||
      slot === undefined ||
      runtime.resolveScalarLeaf(position) !== node
    )
      throw new Error('Plain branch target has no retained scalar slot');
    return { position, slot };
  };
  const stage = (
    address: MemberAddress,
    present: boolean,
    value: unknown
  ): void => {
    const { branch, key, node } = address;
    const descriptor = Object.getOwnPropertyDescriptor(branch, key);
    if (
      getPositionRegistry(branch) !== registry ||
      descriptor?.value !== node ||
      !descriptor.configurable
    )
      throw new Error('Plain branch target location is unavailable');
    const previous = members.get(node);
    members.set(node, {
      address,
      present,
      before:
        previous?.before ??
        (descriptor.enumerable
          ? { present: true, value: unwrapBranchForWriteCapture(node) }
          : { present: false }),
    });
    if (!present) return;
    // Presence only: the rows are the collection's own retained state, and
    // its own effects restore them. A reversal refuses a changed one before
    // it prepares anything (`changedOmittedCollection`).
    if (isCollectionMember(node)) return;
    if (isWritableLocation(node)) {
      const { position, slot } = resolveSlot(node);
      values.set(slot, {
        node,
        position,
        before: values.get(slot)?.before ?? unwrapBranchForWriteCapture(node),
        after: value,
      });
      return;
    }
    if (
      !isNodeAccessor(node) ||
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null)
    )
      throw new Error('Plain branch target requires a plain object');
    const supplied = new Set(Object.keys(value));
    // Only retained state locations are admitted; this does not mount arbitrary
    // Record descendants or call a user child named set/update as a method.
    for (const childKey of Object.getOwnPropertyNames(node)) {
      const child = Object.getOwnPropertyDescriptor(node, childKey)?.value;
      if (!isNodeAccessor(child) && !isWritableLocation(child)) {
        // An entity collection or marker is not membership-managed: it
        // becomes current with its branch and keeps its own state, which its
        // own effects restore. A snapshot value supplied for it (a branch's
        // before-image) is not an unavailable member. (v16 integration 8c.)
        if (isTraversableNode(child)) supplied.delete(childKey);
        continue;
      }
      const childPresent = supplied.delete(childKey);
      const next = childPresent
        ? Object.getOwnPropertyDescriptor(value, childKey)
        : undefined;
      if (next && !('value' in next))
        throw new Error('Plain branch target cannot read an accessor');
      stage(
        { branch: node, key: childKey, node: child },
        childPresent,
        next?.value
      );
    }
    if (supplied.size)
      throw new Error('Plain branch target contains an unavailable member');
  };
  for (const [position, target] of targets) {
    const address = memberAddress(root, position);
    if (!address)
      throw new Error('Plain branch member location is unavailable');
    stage(address, target.present, target.value);
  }
  const frame = runtime.beginFrame();
  for (const [slot, value] of values) frame.set(slot, value.after);
  let result: ScalarSlotCommitResult | undefined;
  let published = false;
  const changedSlots = new Set<number>();
  const changedBranches = new Set<object>();
  const changedBranchMembers: MemberAddress[] = [];
  let changes: PlainBranchMembershipChange[] = [];
  return {
    install(): void {
      if (result) return;
      // Revalidate every retained handle before the first physical write.
      for (const { address } of members.values()) {
        const descriptor = Object.getOwnPropertyDescriptor(
          address.branch,
          address.key
        );
        if (descriptor?.value !== address.node || !descriptor.configurable) {
          frame.discard();
          throw new Error(
            'Plain branch target location changed before installation'
          );
        }
      }
      result = frame.commit({ advanceRevision: false, publish: false });
      for (const slot of result.changedSlots) changedSlots.add(slot);
      for (const { address, present } of members.values()) {
        if (
          setMemberPresence(
            address.branch,
            address.key,
            present ? 'active' : 'dormant'
          )
        ) {
          changedBranches.add(address.branch);
          if (isWritableLocation(address.node))
            changedSlots.add(resolveSlot(address.node).slot);
          else changedBranchMembers.push(address);
        }
      }
      const byBranch = new Map<object, PlainBranchMemberChange[]>();
      for (const { address, present, before } of members.values()) {
        if (before.present === present) continue;
        let entries = byBranch.get(address.branch);
        if (!entries) byBranch.set(address.branch, (entries = []));
        entries.push({
          key: address.key,
          positionIds: getOwnedPositionIds(address.node),
          before,
          after: present
            ? {
                present: true,
                value: unwrapBranchForWriteCapture(address.node),
              }
            : { present: false },
        });
      }
      changes = [...byBranch].map(([branch, members]) => ({
        kind: 'plain-branch-membership',
        branch,
        members,
      }));
    },
    publish(): void {
      const installed = result;
      if (!installed)
        throw new Error('Plain branch target published before installation');
      if (published) return;
      published = true;
      const meta: WriteMetadata = {
        ...getActiveWriteContext(),
        intent: 'system',
        participation: 'realized',
      };
      withWriteContext(meta, () => {
        runtime.runInvalidationGroup(() => {
          for (const branch of changedBranches) publishMembershipChange(branch);
          // What a branch member's presence changes below it (v16 8d).
          for (const { branch, key, node } of changedBranchMembers) {
            republishMemberSubtree(branch, key);
            // Every participant is installed: these are the rows it keeps.
            if (!Object.getOwnPropertyDescriptor(branch, key)?.enumerable)
              rememberHiddenRows(node);
          }
          runtime.publishPrepared({
            revision: installed.revision,
            changedSlots: [...changedSlots],
          });
        });
        for (const [slot, value] of values) {
          if (!installed.changedSlots.includes(slot)) continue;
          const path = getOwnedOwnerPath(value.node);
          if (path === undefined) continue;
          pathObservation().notify(
            path,
            value.after,
            value.before,
            path,
            undefined,
            [value.position],
            meta,
            registry.id
          );
        }
        for (const change of changes) {
          const path = getOwnedOwnerPath(change.branch);
          if (path === undefined) continue;
          const notification: MembershipMetadata = {
            ...meta,
            [MEMBERSHIP]: change,
          };
          pathObservation().notify(
            path,
            undefined,
            undefined,
            path,
            undefined,
            getOwnedPositionIds(change.branch),
            notification,
            registry.id
          );
        }
      });
    },
  };
}

/** Called inside the realization adapter's validated invalidation group. */
export function realizePlainBranchMember(
  root: object,
  position: number,
  present: boolean,
  value: unknown
): void {
  const address = memberAddress(root, position);
  if (!address) throw new Error('Plain branch member location is unavailable');
  const { branch, key, node } = address;
  withWriteContext(
    { ...getActiveWriteContext(), intent: 'system', participation: 'realized' },
    () => {
      const supplied = Object.fromEntries(
        Object.keys(branch).map((key) => [key, true])
      );
      if (present) {
        Object.defineProperty(supplied, key, {
          value: true,
          enumerable: true,
          configurable: true,
        });
      } else {
        delete supplied[key];
      }
      const publish = capturePlainBranchMembership(branch, supplied);
      if (present) {
        if (isNodeAccessor(node)) (node as (value: unknown) => void)(value);
        else if (isWritableLocation(node)) replaceLocation(node, value);
      }
      const changed = setMemberPresence(
        branch,
        key,
        present ? 'active' : 'dormant'
      );
      publish?.();
      // A value write may already have reactivated the leaf. Invalidate the
      // branch enumeration even when the presence setter sees no further change.
      publishMembershipChange(branch);
      if (changed) {
        const runtime = getTreeScalarSlotRuntime(branch);
        const slot = runtime?.resolveScalarSlot(position);
        if (runtime && slot !== undefined) {
          runtime.publishPrepared({
            revision: runtime.revision(),
            changedSlots: [slot],
          });
        }
      }
    }
  );
}
