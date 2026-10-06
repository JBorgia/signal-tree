import {
  getLocationRuntime,
  isWritableLocation,
  NEUTRAL_LOCATION_RUNTIME,
  writableLocationPublisher,
  type LocationPublisher,
} from './location-runtime';
import {
  isNodeAccessor,
  isTraversableNode,
  NODE_STORE_SYMBOL,
} from './node-shape';
import { getOwnedPositionIds } from './owned-metadata';
import { markOwnerInvalidatedFrom } from './owner-invalidation-port';
import { capturePathReAddIfObserved } from './path-observation-port';
import { publishMembershipChange } from './snapshot-authority';
import {
  getTreeScalarSlotRuntime,
  type MemberAbsence,
} from './tree-scalar-slot-port';

/**
 * BRANCH MEMBER MEMBERSHIP — §C / C5, GREENFIELD-BRANCH-WRITE-0.
 *
 * A whole-value assignment states the complete next value of a location, so a
 * key the value omits is NOT A MEMBER of it:
 *
 *     OMISSION IN A WHOLE VALUE CHANGES MEMBERSHIP.
 *     OMISSION IN A PROJECTION DEFINES SCOPE.
 *
 * (The second half is C4's `acquireScalarProjection`, which says nothing about
 * the keys it omits and must never route through here.)
 *
 * ## Authority
 *
 * MEMBERSHIP IS OWNED BY ENUMERABILITY, and by nothing else. `unwrap` already
 * computes a branch's value by enumerating its store (`for (const key in node)`),
 * so enumerability was ALREADY the de-facto authority — this module makes it
 * the deliberate one rather than adding a parallel membership set. A second
 * inventory would force every consumer to know which one wins.
 *
 *     enumerable      → a current member
 *     non-enumerable  → dormant; absent from the value
 *
 * ## Physical retention vs. observable truth
 *
 *     PHYSICAL RETENTION MUST NOT CREATE A SECOND OBSERVABLE STATE.
 *
 *     A DESCENDANT ABSENT FROM ITS PARENT'S CURRENT VALUE IS SEMANTICALLY
 *     ABSENT EVEN IF ITS PHYSICAL LOCATION IS RETAINED.
 *
 * The slot, its identity and its retained value all survive deactivation — that
 * is deliberate, and it is why nothing here writes `undefined`. But the retained
 * value MUST NOT remain readable, or `$.user()` and `$.user.age()` would give two
 * different answers to "what is the value at user.age", and the stale physical
 * representation would have leaked through the canonical state API.
 *
 * ## Why a stamp on the leaf rather than a back-reference to the parent
 *
 * A leaf is built bottom-up, before its parent store exists, so it cannot know
 * its own (parent, key) at construction without paying for a binding on EVERY
 * leaf. The stamp below is applied only when a leaf ACTUALLY goes dormant, which
 * is rare — SPECIALIZE THE RARE CASE BEFORE TAXING THE COMMON CASE. A leaf that
 * is never omitted carries no extra property at all.
 *
 * ⚠️ SINGLE WRITER. The stamp is not a second authority: the descriptor and the
 * stamp are written by the two functions below and nowhere else, so they cannot
 * disagree. Do NOT flip `enumerable` on a tree store directly.
 */

/**
 * Module-private. Absent on every leaf that has never been deactivated.
 *
 * Carries the (parent, key) binding as well as the flag, because a leaf that
 * goes dormant must be able to REACTIVATE ITSELF when written directly —
 * WRITING AN ABSENT DESCENDANT REACTIVATES ITS MEMBERSHIP. Storing the binding
 * eagerly on every leaf would tax the common case for a rare one; storing it at
 * the moment of deactivation costs nothing until a member is actually omitted.
 */
// ⚠️ THE `SignalTree:` PREFIX IS LOAD-BEARING. `unwrap`'s symbol loop skips
// that prefix by identity, so the stamp can never leak into a snapshot — the
// same reason DERIVED_STAMP and PROCESSOR_STAMP carry it. Measured with a plain
// `Symbol('signaltree.…')`: the marker appeared verbatim in `tree.$.user()`.
const DORMANT = Symbol.for('SignalTree:DormantMember');

type DormantBinding = { parent: object; key: string };

/**
 * @internal An entity collection's hook for a change in its presence: it, or
 * a member above it, was omitted or re-added (v16 8e). Its rows are its own
 * state and it reads absent while hidden, so it must re-read. The hook is
 * also what marks a collection as a member to link and wake here, without
 * this module knowing anything about collections.
 */
export const MEMBERSHIP_CHANGED = Symbol.for('SignalTree:MembershipChanged');

function membershipHook(node: unknown): (() => void) | undefined {
  return (node as { [MEMBERSHIP_CHANGED]?: () => void } | null | undefined)?.[
    MEMBERSHIP_CHANGED
  ];
}

/**
 * @internal The two physical objects one branch is represented by.
 *
 * A branch is ONE semantic object and TWO physical ones: the `NodeAccessor`
 * consumers hold, and the backing store its call path closes over. Both carry a
 * descriptor per member, and both are observable — the store through `branch()`
 * and every snapshot, the accessor through `Object.keys(branch)`, `'k' in
 * branch` and spread.
 */
const NODE_ACCESSOR_PEER = Symbol.for('SignalTree:NodeAccessorPeer');

/** @internal True when this leaf is absent from its parent's current value. */
/**
 * @internal True when this leaf is absent from its parent's current value.
 *
 * ⚠️ READS THE DESCRIPTOR, NEVER A CACHED FLAG. The binding below only answers
 * "where do I consult the authoritative descriptor"; it must never answer "is
 * this member active". Enumerability owns that, and a cached boolean beside it
 * would be a second membership truth able to disagree.
 */
export function isDormantMember(leaf: unknown): boolean {
  const binding = memberBinding(leaf);
  if (binding === undefined) return false;
  const descriptor = Object.getOwnPropertyDescriptor(
    binding.parent,
    binding.key
  );
  return descriptor !== undefined && descriptor.enumerable === false;
}

function memberBinding(leaf: unknown): DormantBinding | undefined {
  if (!isTraversableNode(leaf)) {
    return undefined;
  }
  return (leaf as Record<symbol, DormantBinding | undefined>)[DORMANT];
}

/** Restore a dormant member's own membership; used inside a structural write. */
function reactivateOnWrite(leaf: unknown): boolean {
  const binding = memberBinding(leaf);
  if (!binding) return false;
  // ⚠️ MEMBERSHIP ONLY — DELIBERATELY NO PUBLICATION HERE.
  //
  // The caller is the child's own `set`/`update`, which already knows its slot
  // and publishes it exactly once. Republishing the whole branch from here as
  // well emitted THREE publications for one semantic transition (measured:
  // 2 from the branch sweep + 1 from the caller). It is also unnecessary under
  // M-C2: the parent already holds a dependency on this dormant child's token,
  // so waking that one slot wakes the parent too.
  return setMemberPresence(binding.parent, binding.key, 'active');
}

/** The node a parent's own member link is stamped on (its accessor half). */
function nodeOf(parent: object): object {
  return (
    ((parent as Record<symbol, unknown>)[NODE_ACCESSOR_PEER] as object) ??
    parent
  );
}

/**
 * @internal True when `node` is absent from the current tree: it, or a member
 * above it, is omitted.
 *
 *     A DESCENDANT ABSENT FROM ITS PARENT'S CURRENT VALUE IS SEMANTICALLY
 *     ABSENT EVEN IF ITS PHYSICAL LOCATION IS RETAINED.
 *
 * `isDormantMember` answers only for the node's own descriptor, so a location
 * under an omitted branch read and wrote retained storage (v16 integration 8d,
 * open item 1). The links followed here are stamped when a member is first
 * omitted, on it and on every state location below it; they only locate
 * descriptors, and enumerability still answers. A node never under an omitted
 * member has no link and pays one symbol lookup, as before.
 */
export function isAbsentMember(node: unknown): boolean {
  for (
    let binding = memberBinding(node);
    binding;
    binding = memberBinding(binding.parent)
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(
      binding.parent,
      binding.key
    );
    if (descriptor?.enumerable === false) return true;
  }
  return false;
}

/**
 * @internal The keys from `branch` down to `node` when `branch` holds `node`
 * through member links, else `undefined`: what a membership change of
 * `branch` means for a consumer of `node` (Link, v15 port review, item 4).
 * The links exist once a member above `node` was first omitted, as for
 * `isAbsentMember`.
 */
export function keysBelow(branch: object, node: unknown): string[] | undefined {
  const keys: string[] = [];
  for (
    let binding = memberBinding(node);
    binding;
    binding = memberBinding(binding.parent)
  ) {
    keys.unshift(binding.key);
    // Both name a branch's accessor half (`linkMember`, `recursiveUpdate`).
    if (binding.parent === branch) return keys;
  }
  return undefined;
}

/**
 * @internal A structural write (a whole value, a reversal installing members)
 * reconciles membership itself, level by level, and announces it. A location
 * of the same tree written inside one keeps the own-member reactivation it
 * always had and announces nothing, so no transition is announced twice.
 *
 * ⚠️ PER TREE (v16 8e review). `trees` holds the tree of each open
 * structural write, by its slot runtime, which every branch of a tree
 * carries. A write to another tree from a tap or a sync effect running
 * inside one is an ordinary write and re-adds its path: a global counter made
 * it vanish into retained storage.
 *
 * `end` runs when the outermost structural write closes. Only entity
 * collections install it, to wake their consumers after it rather than inside
 * it (`entity-signal`), so a tree without collections carries none of that.
 */
export const structuralWrites: {
  depth: number;
  trees: unknown[];
  end?: (failed?: boolean) => void;
} = {
  depth: 0,
  trees: [],
};

/**
 * @internal Open a structural write on the tree `node` belongs to; close it
 * with `endStructuralWrite` in a `finally`.
 */
export function beginStructuralWrite(node: unknown): void {
  structuralWrites.depth++;
  structuralWrites.trees.push(getTreeScalarSlotRuntime(node));
}

/**
 * @internal Close a structural write opened with `beginStructuralWrite`.
 * `failed` when it is closing because the write threw, so that what `end`
 * runs does not replace the write's own error (`entity-signal`).
 */
export function endStructuralWrite(failed?: boolean): void {
  structuralWrites.trees.pop();
  if (!--structuralWrites.depth) structuralWrites.end?.(failed);
}

/**
 * @internal True when a structural write is open on the tree `node`
 * belongs to: a branch carries its tree's runtime, anything else is reached
 * through the branch its member link names.
 */
export function inStructuralWrite(node: unknown): boolean {
  return (
    structuralWrites.depth > 0 &&
    structuralWrites.trees.includes(
      getTreeScalarSlotRuntime(node) ??
        getTreeScalarSlotRuntime(memberBinding(node)?.parent)
    )
  );
}

/**
 * @internal While positive, every location reads its stored value whatever
 * its presence. History capture reads before-images this way: a membership
 * change recorded while its location was absent must restore what storage
 * held, as a whole value does. Reading the absent value instead recorded
 * `undefined`, so undo or rollback of a turn that omitted a branch and then
 * wrote under it left that branch's members undefined (v16 8e, measured).
 */
export const storedReads = { depth: 0 };

/**
 * @internal Re-add a written location that is absent from the current tree.
 *
 *     WRITING AN ABSENT DESCENDANT REACTIVATES ITS MEMBERSHIP
 *     (`whole-value-membership.spec.ts` 7), ALONG ITS WHOLE PATH.
 *
 * Call it after the written value is installed: the value is the
 * authoritative supplied value `activateOne` requires. From the outermost
 * omitted member down to the written location's parent, every member off the
 * path is made dormant first: it was absent and stays absent, because
 * "DORMANT STORAGE MUST NOT SUPPLY THE REACTIVATED VALUE" (case 18). Then every
 * omitted member on the path is re-added. The result is what a whole value at
 * the outermost omitted member, holding only the written path, would give.
 *
 * Every level's membership change is announced, as that whole value would
 * announce it. Restoration and transactions register a member's location
 * when they observe its change, and a later reversal that must re-add a
 * member depends on that registration; announcing only the outermost member
 * left the siblings unregistered, and undo of an earlier write to one of them
 * refused with "its retained location is no longer available" (measured).
 *
 * ⚠️ ANNOUNCED HERE, BEFORE THE WRITER ANNOUNCES ITS VALUE (v16 8e). 8d
 * announced membership after the value, as a whole value does, which needed a
 * wrapper (two closures) around every leaf's writers in every tree. Both
 * history capture paths compose a member's value and presence per position in
 * either order (`composePlainBranchMemberEffect`), and the 8d mutation that
 * announced first was killed only by the test that pinned the order.
 *
 * @returns whether membership changed, so the writer publishes its own token
 * even when the retained value equalled the written one.
 */
export function reactivatePathOnWrite(node: unknown): boolean {
  if (inStructuralWrite(node)) return reactivateOnWrite(node);
  const path: DormantBinding[] = [];
  let outer = -1;
  for (
    let binding = memberBinding(node);
    binding;
    binding = memberBinding(binding.parent)
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(
      binding.parent,
      binding.key
    );
    if (descriptor?.enumerable === false) outer = path.length;
    path.push(binding);
  }
  if (outer < 0) return false;
  // Captured before anything changes, only when something observes paths.
  const announce = capturePathReAddIfObserved(path, outer);
  for (let i = outer - 1; i >= 0; i--) {
    const { parent, key: kept } = path[i];
    for (const member of Object.keys(parent))
      if (member !== kept) setMemberPresence(parent, member, 'dormant');
  }
  for (let i = outer; i >= 0; i--)
    setMemberPresence(path[i].parent, path[i].key, 'active');
  // A re-added leaf is the written location itself, and its writer publishes
  // its token once (`whole-value-membership.spec.ts` 16). A re-added branch
  // has no token: its observers and those below it are woken here.
  if (!isWritableLocation(node) || outer > 0)
    republishMembers(path[outer].parent, [path[outer].key]);
  announce?.();
  return true;
}

/**
 * The liveness a tree's leaves consult once a member of that tree has been
 * omitted. Until then their read and write paths see one empty slot and run
 * none of it (`MemberAbsence`, v16 8e).
 */
const ABSENCE: MemberAbsence = {
  // History capture reads what storage holds (`storedReads`).
  isAbsent: (node) => !storedReads.depth && isAbsentMember(node),
  reAdd: reactivatePathOnWrite,
};

/**
 * @internal Invalidate the OBSERVATION of every scalar member under `parent`
 * after a membership transition, without writing anything.
 *
 * ⚠️ THIS IS AN INVALIDATION CARRIER, NOT A MEMBERSHIP AUTHORITY. Enumerability
 * decides membership; this only wakes the consumers so they re-read it.
 *
 * It reuses the per-slot publication tokens that already exist and that each
 * leaf ALREADY depends on — `createAngularLeaf` calls `publication.observe(slot)`
 * INSIDE its computation, so the dependency edge is established on the leaf's
 * first read. That is what makes membership free: no new reactive state, and no
 * first-transition problem. A lazily created membership signal would NOT be a
 * dependency of a computation that had already run — measured, and the reason
 * the per-leaf design was abandoned.
 *
 * Moved here from `signal-tree.ts` in v16 8e: path re-adds and reversals call
 * it too, and a port to reach it cost more than the move.
 */
export function republishMembers(
  parent: object,
  keys: readonly string[]
): void {
  const runtime = getTreeScalarSlotRuntime(parent);
  if (!runtime) return;

  // ⚠️ ONLY THE SLOTS WHOSE MEMBERSHIP CHANGED.
  //
  //     changedSlots = value-changed slots UNION membership-changed slots
  //     each semantic slot published ONCE per transition
  //
  // Sweeping every slot under the branch published siblings whose membership and
  // value were both untouched, and double-published the one that did change.
  const changedSlots: number[] = [];
  // ⚠️ A SLOT IS POSITION-ADDRESSABLE ONLY UNDER `position-topology`.
  //
  // Every tree has scalar slots since 5efeb7f5, but a leaf receives a PositionId
  // only with that capability (transactions, restoration). Without it the slot
  // lookup below finds nothing, and the leaf was treated as tokenless: its own
  // token was never published, so a derived, a `subscribe` listener and every
  // native carrier (Angular, Vue, Solid) kept the retained value after
  // `p({ name: 'a' })` removed `age`. The leaf's location binding IS that token
  // — the one its own writes publish — so it is published instead.
  const unaddressedLeaves: LocationPublisher[] = [];
  // ⚠️ A BRANCH MEMBER'S PRESENCE IS EVERY PRESENT LOCATION'S BELOW IT.
  //
  // Omitting or re-adding a branch changes what each present location under
  // it reads, but none of them was written. Measured before v16 8d: a held
  // `computed(() => box.drop())` kept `{v:2}` after `box({keep})` omitted
  // `drop`, and held reads under an omitted `a` kept retained storage. Each
  // present branch below re-reads through its membership revision, each leaf
  // through its own token. Dormant members below are skipped: they read
  // absent before and after.
  const branches: object[] = [];
  // Publish a member's own token; a branch has none, so its subtree is
  // visited instead. True for a token-carrying member.
  const publish = (child: unknown): boolean => {
    const positionId = getOwnedPositionIds(child)?.[0];
    const slot =
      positionId === undefined
        ? undefined
        : runtime.resolveScalarSlot(positionId);
    if (slot !== undefined) return changedSlots.push(slot) > 0;
    const publisher = writableLocationPublisher(child);
    if (publisher) return unaddressedLeaves.push(publisher) > 0;
    membershipHook(child)?.();
    if (isNodeAccessor(child)) {
      branches.push(child);
      for (const key of Object.keys(child))
        publish((child as unknown as Record<string, unknown>)[key]);
    }
    return false;
  };
  let tokenCarrying = 0;
  for (const key of keys)
    if (publish((parent as Record<string, unknown>)[key])) tokenCarrying++;

  // ⚠️ PUBLISHED INDEPENDENTLY OF VALUE EQUALITY.
  //
  //     SEMANTIC MEMBERSHIP CHANGE IS AN OBSERVABLE SLOT CHANGE EVEN WHEN THE
  //     RETAINED VALUE IS IDENTICAL.
  //
  // The ordinary write path SUPPRESSES an unchanged commit — correctly, for a
  // value. But reintroducing `age: 42` over a dormant slot that still holds 42
  // changes what the leaf OBSERVES (undefined -> 42) without changing what it
  // stores, so routing membership through the value comparator would leave an
  // already-subscribed consumer stuck at `undefined`.
  // ⚠️ A BRANCH MEMBER HAS NO PUBLICATION TOKEN, so its membership transition is
  // unobservable through the dependency graph.
  //
  // A dormant LEAF is carried by its retained per-slot token: the parent's
  // dormant-child read returns a CHANGED value and propagates. A dormant BRANCH
  // returns `undefined` now too, but that call reads no signal whose value
  // changed — the child's own memo still depends on unchanged leaf tokens — so
  // nothing invalidates the parent. Measured: `drop()` correctly became
  // `undefined` while `box()` still listed `drop`.
  //
  // This is the SAME structural condition as first appearance, not a generic
  // structural-edit hammer:
  //
  //     A MEMBERSHIP TRANSITION WHOSE MEMBER CARRIES NO OBSERVABLE DEPENDENCY
  //     MUST INVALIDATE ANY SNAPSHOT WHOSE DEPENDENCY SET COULD NOT REFLECT IT.
  // ⚠️ TOKENLESS MEANS NO SLOT, NOT NO POSITION. A branch member DOES own a
  // PositionId — an earlier version of this check tested for one and therefore
  // never fired. What a branch lacks is a per-slot PUBLICATION TOKEN, which is
  // what the dependency graph actually carries.
  if (tokenCarrying < keys.length) {
    publishMembershipChange(parent);
  } else {
    // ⚠️ OWNER INVALIDATION DOES NOT DEPEND ON WHICH CARRIER WAKES THE GRAPH.
    //
    // `publishMembershipChange` also invalidates the owner. This branch is the
    // case where it does not run: every changed member is a leaf whose token
    // is published below. Before this branch existed that was the ordinary
    // case under `position-topology` (transactions, restoration), and the
    // owner was never told — measured: `p({ name: 'a' })` over
    // `{ name: 'a', age: 1 }` gave 0 invalidations with either enhancer and 1
    // without, while `tree.$()` already read the removal. Without the
    // capability the leaf was mistaken for tokenless, so the branch above ran
    // and invalidated by accident.
    //
    // The commit revision is still NOT advanced: owner invalidation is a
    // reread request, not a commit. The membership revision is not bumped
    // either: a branch snapshot re-reads every member leaf, so the leaf tokens
    // published below are what wake it. A dormant BRANCH member has no token and
    // takes the `publishMembershipChange` path above instead.
    markOwnerInvalidatedFrom(parent);
  }

  for (const branch of branches) publishMembershipChange(branch);

  if (changedSlots.length > 0) {
    // `advanceRevision` is NOT wanted: nothing was committed, so the physical
    // commit clock must not move.
    runtime.publishPrepared({ revision: runtime.revision(), changedSlots });
  }

  if (unaddressedLeaves.length > 0) {
    // The tree's own runtime, so the publication joins its invalidation group;
    // the neutral fallback mirrors `publishMembershipChange`.
    (getLocationRuntime(parent) ?? NEUTRAL_LOCATION_RUNTIME).publish(
      unaddressedLeaves
    );
  }

  // The node's own snapshot is memoised over the members it enumerated, and a
  // membership change is invisible to that memo — see publishMembershipChange.
}

/**
 * @internal Remove `key` from `parent`'s current value.
 *
 * ⚠️ NO VALUE IS WRITTEN. The BR-A probe expressed absence by assigning
 * `undefined` to omitted descendants and misbehaved twice for it — a spurious
 * mutation event per omitted key, and unknown keys discarded before the
 * unknown-key diagnostic could see them. Absence is a membership change, not a
 * write.
 */
function deactivateOne(parent: object, key: string): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(parent, key);
  if (!descriptor || descriptor.enumerable === false) {
    return false;
  }
  if (!descriptor.configurable) {
    return false;
  }

  Object.defineProperty(parent, key, { ...descriptor, enumerable: false });
  markHasDormant(parent);
  // The first omission in a tree is what installs liveness on its leaves.
  getTreeScalarSlotRuntime(parent)?.enableAbsence?.(ABSENCE);
  const child = (parent as Record<string, unknown>)[key];
  if (isTraversableNode(child)) {
    linkMember(parent, key, child);
    linkDescendants(child);
  }
  return true;
}

/**
 * The link names the parent's accessor half, the one its own parent's link
 * names in turn, so a walk follows links without resolving peers.
 */
function linkMember(parent: object, key: string, child: object): void {
  Object.defineProperty(child, DORMANT, {
    value: { parent: nodeOf(parent), key } satisfies DormantBinding,
    enumerable: false,
    configurable: true,
    writable: true,
  });
}

/**
 * Link every state location below a newly omitted member to its parent, once,
 * so a location under it can find the omission (`isAbsentMember`). A linked
 * location's own subtree was linked when it was, so it is not walked again.
 * An entity collection is linked so it can read absent (v16 8e), but not
 * entered: its rows are its own state. Other markers are left alone.
 */
function linkDescendants(node: object): void {
  if (!isNodeAccessor(node)) return;
  for (const key of Object.getOwnPropertyNames(node)) {
    const child = Object.getOwnPropertyDescriptor(node, key)?.value;
    if (
      (!isNodeAccessor(child) &&
        !isWritableLocation(child) &&
        !membershipHook(child)) ||
      memberBinding(child)
    )
      continue;
    linkMember(node, key, child as object);
    linkDescendants(child as object);
  }
}

/**
 * @internal Link a member added after construction when its branch is already
 * linked, so a later omission above it is visible to it.
 */
export function linkAddedMember(
  branch: object,
  key: string,
  child: unknown
): void {
  if (!isTraversableNode(child) || !memberBinding(nodeOf(branch))) return;
  linkMember(branch, key, child);
  linkDescendants(child);
}

/**
 * @internal Restore `key` to `parent`'s current value.
 *
 *     MEMBERSHIP ACTIVATION IS NEVER A STANDALONE OPERATION.
 *     IT MUST BE COUPLED TO AN AUTHORITATIVE SUPPLIED VALUE.
 *
 * ⚠️ CALL THIS ONLY AFTER THE SUPPLIED VALUE HAS BEEN INSTALLED. Bare
 * re-enumeration exposes whatever the dormant slot still holds — measured: a
 * leaf dormant at 42 reads 42 again the instant it is re-enumerated, with
 * nothing having supplied it. There are exactly two admissible callers, and both
 * install first:
 *
 *   recursiveUpdate        the supplied-key loop has already written the value
 *   reactivatePathOnWrite  the location's own write is the supplied value
 *
 * Do not add a third without an authoritative value to couple it to.
 */
function activateOne(parent: object, key: string): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(parent, key);
  if (!descriptor || descriptor.enumerable === true) {
    return false;
  }
  if (!descriptor.configurable) {
    return false;
  }

  Object.defineProperty(parent, key, { ...descriptor, enumerable: true });
  // ⚠️ The binding is NOT cleared. It locates the descriptor; it is not a
  // dormancy flag. Clearing it here would make "has a binding" mean "is
  // dormant", which is exactly the second membership truth this design forbids.
  return true;
}

/**
 * Hint only. Answers "does this branch have ANY dormant member", never "is X a
 * member" — enumerability alone answers that. A stale hint costs one harmless
 * extra walk; it can never contradict the authority.
 */
const HAS_DORMANT = Symbol.for('SignalTree:HasDormantMembers');

/** @internal Cheap check so an ordinary branch read pays one property lookup. */
export function hasDormantMembers(parent: object): boolean {
  return (parent as Record<symbol, unknown>)[HAS_DORMANT] === true;
}

function markHasDormant(parent: object): void {
  if (hasDormantMembers(parent)) return;
  Object.defineProperty(parent, HAS_DORMANT, {
    value: true,
    enumerable: false,
    configurable: true,
    writable: true,
  });
}

/** @internal Own keys of `parent` that are NOT current members. */
export function dormantKeys(parent: object): string[] {
  return Object.getOwnPropertyNames(parent).filter((key) => {
    const d = Object.getOwnPropertyDescriptor(parent, key);
    return d !== undefined && d.enumerable === false && 'value' in d;
  });
}

/** Resolve the other physical half of a branch, from either side. */
function peerOf(branch: object): object | undefined {
  const record = branch as Record<symbol, unknown>;
  const peer = record[NODE_STORE_SYMBOL] ?? record[NODE_ACCESSOR_PEER];
  // ⚠️ `isTraversableNode`, NOT `typeof peer === 'object'`. A NodeAccessor is
  // CALLABLE, so the object-only test silently discarded every accessor peer:
  // the helper resolved store->accessor to `undefined` and converged nothing
  // while still reporting `changed === true` from the store side. That is the
  // precise failure the repo's no-hand-rolled-walker-guard lint rule exists to
  // prevent, and writing one here reproduced it inside the very helper meant to
  // make this class of bug structural.
  return isTraversableNode(peer) && peer !== branch
    ? (peer as object)
    : undefined;
}

/** @internal */
export type MemberPresence = 'active' | 'dormant';

/**
 * @internal Set whether `key` is a member of `branch`, ON BOTH PHYSICAL HALVES.
 *
 *     ACCESSOR/STORE COHERENCE MUST HAVE ONE MUTATION OWNER.
 *
 * ⚠️ THIS EXISTS BECAUSE THE SPLIT BIT THREE TIMES. First appearance had to
 * define both; dynamic reacquisition had to activate both; and a measurement
 * taken while extracting this helper found the third and worst case — NO
 * deactivation path had ever touched the accessor at all. After
 * `user({name: 'A'})` removed `age`, the snapshot correctly said `["name"]`
 * while `Object.keys($.user)` and `{...$.user}` both still said
 * `["age","name"]`. That is the second observable state the architecture
 * forbids: PHYSICAL RETENTION MUST NOT CREATE A SECOND OBSERVABLE STATE.
 *
 * The callers were not careless. Each held whichever half was natural at its
 * own site — `recursiveUpdate` reconciles over the store, dynamic reacquisition
 * arrives at the accessor — and "remember to also update the other one" is not
 * a property a call site can be trusted to carry. So the helper resolves the
 * peer itself, in either direction, and the single-object primitives are no
 * longer exported: `activateMember(accessor, key)` compiles, looks plausible,
 * and is semantically incomplete, so it must not be reachable.
 *
 * ⚠️ NO NEW MEMBERSHIP STATE. Enumerability remains the sole authority. This
 * changes WHERE it is written, never what answers the question — and the two
 * halves agreeing is precisely what makes "enumerability" a single answer
 * rather than two.
 *
 * @returns whether membership actually changed — ONE semantic result for the
 * pair, true if either half moved.
 */
export function setMemberPresence(
  branch: object,
  key: string,
  presence: MemberPresence
): boolean {
  const apply = presence === 'active' ? activateOne : deactivateOne;
  let changed = apply(branch, key);
  const peer = peerOf(branch);
  if (peer) changed = apply(peer, key) || changed;
  return changed;
}
