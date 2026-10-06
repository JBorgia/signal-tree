import { isWritableLocation } from './location-runtime';
import { isNodeAccessor, isTraversableNode, NODE_STORE_SYMBOL } from './node-shape';
import {
  captureBranchMembershipIfObserved,
  hasPathObservers,
} from './path-observation-port';

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
  const descriptor = Object.getOwnPropertyDescriptor(binding.parent, binding.key);
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
    binding = memberBinding(nodeOf(binding.parent))
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
 * A structural write (a whole value, a reversal installing members) reconciles
 * membership itself, level by level, and announces it. A location written
 * inside one keeps the own-member reactivation it always had and announces
 * nothing, so no transition is announced twice.
 */
let structuralWrites = 0;

/** @internal Run a write that reconciles and announces membership itself. */
export function withStructuralWrite<T>(run: () => T): T {
  structuralWrites++;
  try {
    return run();
  } finally {
    structuralWrites--;
  }
}

/** @internal True while a structural write is in progress. */
export function inStructuralWrite(): boolean {
  return structuralWrites > 0;
}

let republishMember: ((parent: object, key: string) => void) | undefined;

/**
 * @internal Installed by `signal-tree`, which owns the publication carriers.
 * Wakes the observers of a member whose presence changed, and of every
 * present location below it, without writing anything.
 */
export function installMemberRepublisher(
  republish: (parent: object, key: string) => void
): void {
  republishMember = republish;
}

/** @internal See `installMemberRepublisher`. */
export function republishMemberSubtree(parent: object, key: string): void {
  republishMember?.(parent, key);
}

const NOOP = (): void => undefined;

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
 * @returns undefined when nothing changed. Otherwise a function the writer
 * calls after announcing its value write: it wakes held observers and
 * announces the membership changes to path observers, innermost first, so
 * restoration and transactions record them with the write (value first, then
 * membership, as a whole-value write does).
 */
export function reactivatePathOnWrite(node: unknown): (() => void) | undefined {
  if (structuralWrites > 0) return reactivateOnWrite(node) ? NOOP : undefined;
  const path: DormantBinding[] = [];
  let outer = -1;
  for (
    let binding = memberBinding(node);
    binding;
    binding = memberBinding(nodeOf(binding.parent))
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(
      binding.parent,
      binding.key
    );
    if (descriptor?.enumerable === false) outer = path.length;
    path.push(binding);
  }
  if (outer < 0) return undefined;
  const owner = nodeOf(path[outer].parent);
  const key = path[outer].key;
  // Captured before anything changes; each publishes what changed at its level.
  const announce: Array<(() => void) | undefined> = [];
  if (hasPathObservers())
    for (let i = 0; i <= outer; i++) {
      const branch = nodeOf(path[i].parent);
      const present: Record<string, true> = { [path[i].key]: true };
      if (i === outer)
        for (const member of Object.keys(branch)) present[member] = true;
      announce.push(captureBranchMembershipIfObserved(branch, present));
    }
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
  const republish = !isWritableLocation(node) || outer > 0;
  return () => {
    if (republish) republishMember?.(owner, key);
    for (const publish of announce) publish?.();
  };
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
  const child = (parent as Record<string, unknown>)[key];
  if (isTraversableNode(child)) {
    linkMember(parent, key, child);
    linkDescendants(child);
  }
  return true;
}

function linkMember(parent: object, key: string, child: object): void {
  Object.defineProperty(child, DORMANT, {
    value: { parent, key } satisfies DormantBinding,
    enumerable: false,
    configurable: true,
    writable: true,
  });
}

/**
 * Link every state location below a newly omitted member to its parent, once,
 * so a location under it can find the omission (`isAbsentMember`). A linked
 * location's own subtree was linked when it was, so it is not walked again.
 * Collections and markers are not membership-managed and are not entered.
 */
function linkDescendants(node: object): void {
  if (!isNodeAccessor(node)) return;
  for (const key of Object.getOwnPropertyNames(node)) {
    const child = Object.getOwnPropertyDescriptor(node, key)?.value;
    if (
      (!isNodeAccessor(child) && !isWritableLocation(child)) ||
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
export function linkAddedMember(branch: object, key: string, child: unknown): void {
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
  return isTraversableNode(peer) && peer !== branch ? (peer as object) : undefined;
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
