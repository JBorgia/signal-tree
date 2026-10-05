import type { WriteMetadata } from '../mutation-types';
import { getActiveWriteContext } from '../write-context';
import { unwrapBranchForWriteCapture } from '../utils';
import { getOwnedOwnerPath, getOwnedPositionIds } from './owned-metadata';
import { hasPathObservers, pathObservation } from './path-observation-port';
import {
  getPositionRegistry,
  type PositionRegistry,
} from './position-registry';
import { setMemberPresence } from './member-membership';
import { publishMembershipChange } from './snapshot-authority';
import { getTreeScalarSlotRuntime } from './tree-scalar-slot-port';
import { withWriteContext } from '../write-context';
import { isNodeAccessor } from './node-shape';
import { isWritableLocation, replaceLocation } from './location-runtime';
import type { ScalarSlotCommitResult } from './tree-scalar-slot-runtime';

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
    if (!present && typeof descriptor.value !== 'function') continue;
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
    if (
      path === undefined ||
      (!isNodeAccessor(node) && !isWritableLocation(node))
    )
      return [];
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
    (isNodeAccessor(address.node) || isWritableLocation(address.node))
    ? address
    : undefined;
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
      if (!isNodeAccessor(child) && !isWritableLocation(child)) continue;
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
