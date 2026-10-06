import type { FieldPresence } from '../../lib/internals/causal-runtime/causal-types';
import { placeFieldReversalsWhileRowsExist } from '../../lib/internals/causal-runtime/pending-rollback';
import {
  applyInInvalidationGroup,
  applicationFailureCause,
  wasAppliedBeforeFailure,
} from '../../lib/internals/causal-runtime/post-application-failure';
import { holdEntityMembershipDelivery } from '../../lib/internals/entity-membership-view';
import {
  plainBranchMembershipEffects,
  composePlainBranchMemberEffect,
  plainBranchMemberEffectIsNoop,
  canRealizePlainBranchMember,
  readPlainBranchMember,
  applyPlainBranchMemberSnapshot,
  preparePlainBranchMembers,
  type PlainBranchMemberPresence,
} from '../../lib/internals/plain-branch-membership';
import { getOrCreateSubjectReclamationSink } from '../../lib/internals/subject-reclamation-sink';
import {
  installRestorationReader,
  type RestorationEntryId,
  type RestorationReaderChange,
  type RestorationReaderState,
} from '../../lib/internals/restoration-reader';
import {
  getOrCreateSubjectRestorationClaims,
  type RestorationClaimOwner,
} from '../../lib/internals/subject-restoration-claims';
import {
  deriveLocation,
  getLocationRuntime,
  NEUTRAL_LOCATION_RUNTIME,
  isWritableLocation,
  replaceLocation,
} from '../../lib/internals/location-runtime';
import { getTreeScalarSlotRuntime } from '../../lib/internals/tree-scalar-slot-port';
import { markOwnerInvalidatedFrom } from '../../lib/internals/owner-invalidation-port';
import { rootAuthorityFor } from '../../lib/internals/root-source';

import { deepEqual, isTraversableNode, snapshotState } from '../../lib/utils';
import { interceptLeafSignals } from '../../lib/internals/intercept-leaf-signals';
import { observeIntrinsicMutations } from '../../lib/internals/intrinsic-mutation';
import {
  getOwnedPositionIds,
  getOwnedSubjectIds,
} from '../../lib/internals/owned-metadata';
import { getMutationCaptureRuntime } from '../../lib/internals/mutation-capture-runtime';
import type { CollectionOrderCapture } from '../../lib/internals/mutation-capture-runtime';
import {
  deriveCollectionOrderDelta,
  deriveDeclarativeTransitionTarget,
  prepareDeclarativeTransitionInstallation,
  requiresDeclarativeStructuralTarget,
  type CollectionTransitionTargetBinding,
  type CollectionOrderDelta,
  type ScalarTransitionTargetBinding,
} from '../../lib/internals/causal-runtime/target-transition';
import {
  getPositionRegistry,
  type PositionRegistry,
} from '../../lib/internals/position-registry';
import {
  createTreeRealizationAdapter,
  defineTreeRealizationDescriptors,
  defineTreeRealizationPort,
  forgetSubjectsInTreeRealizationDescriptors,
  getTreeRealizationDescriptors,
  getTreeRealizationPort,
  rememberTreeRealizationDescriptor,
} from '../../lib/internals/causal-runtime/tree-realization-adapter';
import {
  installTransactionLifecycleChannel,
  transactionIdentityKey,
} from '../../lib/internals/causal-runtime/transaction-lifecycle';
import {
  isMetaDesignated,
  isRestorationDesignated,
  markMetaDesignated,
} from '../../lib/internals/restoration-eligibility';
import { visitTree } from '../../lib/internals/visit-tree';
import { recordProductionSubstrateStat } from '../../lib/internals/production-substrate-stats';
import {
  getWriteParticipation,
  isInspectionWrite,
  isCompensationWrite,
} from '../../lib/write-participation';
import { getPathNotifier } from '../../lib/path-notifier';
import {
  getActiveWriteContext,
  withWriteContext,
} from '../../lib/write-context';

import type {
  Enhancer,
  ISignalTree,
  PositionId,
  StructuralEffect,
  RestorationConfig,
  TreeNode,
  EnhancerMeta,
  WriteMetadata,
} from '../../lib/types';
import type {
  RestorationHistoryEntry,
  RestorationMethods,
} from './restoration.types';

// `SignalTreeRollbackError` is no longer imported here: rollback errors are
// raised by `transactions()`, which owns rollback (TX-SURFACE-0).
import { ENHANCER_META } from '../../lib/types';
import { appendAll } from '../../lib/internals/utilities/append-all';

// Angular's build-time flag takes precedence. Framework-neutral runtimes use an
// explicit Node environment when available; unknown browser environments take
// the production-safe path for this expensive internal invariant assertion.
declare const ngDevMode: boolean | undefined;
declare const process:
  | { readonly env?: { readonly NODE_ENV?: string } }
  | undefined;

export function shouldRunRestorationConsistencyChecks(
  angularDevMode: boolean | undefined,
  nodeEnvironment: string | undefined
): boolean {
  return (
    angularDevMode ??
    (nodeEnvironment === 'development' || nodeEnvironment === 'test')
  );
}

const RUN_RESTORATION_CONSISTENCY_CHECKS =
  shouldRunRestorationConsistencyChecks(
    typeof ngDevMode === 'undefined' ? undefined : Boolean(ngDevMode),
    typeof process === 'undefined' ? undefined : process.env?.NODE_ENV
  );

import type {
  ReversalEffect,
  ReversalRefusal,
} from '../../lib/internals/causal-runtime/causal-types';

// A refusal is the error object restoration itself created when it declined an
// operation and changed nothing. Messages are not evidence: a validator or a
// listener may throw any text, including one that imitates ST1034.
const RESTORATION_REFUSALS = new WeakSet<Error>();
function restorationRefusal(message: string): Error {
  const error = new Error(message);
  RESTORATION_REFUSALS.add(error);
  return error;
}

// Re-export for convenience (do not redefine locally)
export type { RestorationConfig, RestorationHistoryEntry };

// (RestorationConfig is imported from canonical types)

/**
 * Internal restoration state management
 */

type CanonicalTurn<T> = Omit<RestorationHistoryEntry<T>, 'state'> & {
  state?: T;
  id: number;
  entryId: RestorationEntryId;
  __transactionId?: number;
  historyIndex: number;
  /**
   * RESTORATION CLAIM SET — the subjects whose backing must conservatively
   * remain available while this record is retained.
   *
   * SUFFICIENCY, NOT MINIMALITY. It is required to contain every retired
   * subject a legal traversal of this record could make live again; it is
   * permitted to name more. `probe-restoration-required-set.mjs` measures both
   * halves against an observational oracle that traverses undo to the oldest
   * retained entry and redo back to the newest: 0 required-but-unnamed at every
   * history size, and as of the `clear()` repair 0 named-but-never-live either.
   *
   * Not a debugging annotation. `restoreState()` CONSUMES it, and Step 8 makes
   * it the retention authority — the last record naming a subject is what keeps
   * that subject's backing alive. Do not widen it to "every subject mentioned
   * in `state`": a snapshot names the whole collection, so that would make
   * every retained record claim everything and reproduce today's unbounded
   * retention inside a tidier data structure.
   */
  restorationSubjectIds?: number[];
  __positionIds?: number[];
  __effects?: TurnEffect[];
  __orderDeltas?: CollectionOrderDelta[];
  __eventOrdinal?: number;
};

type HistoricalEvent = {
  readonly ordinal: number;
  readonly effects: TurnEffect[];
  readonly orderDeltas: CollectionOrderDelta[];
  boundaryTurnId?: number;
};

type TurnEffectBase = {
  position: number;
  ownerPath: string;
  path: string;
};

type ScalarSetEffect = TurnEffectBase & {
  kind: 'set';
  subject?: number;
  fieldSegments?: readonly string[];
  /**
   * Exact keys below `position` for a decomposed write to a plain branch.
   * `path` is a display string, so the literal key 'd.e' and the nested d.e
   * read the same there; these keys keep the address lossless.
   */
  branchSegments?: readonly string[];
  plainBranchMembership?: PlainBranchMemberPresence;
  fieldPresence?: FieldPresence;
  before: unknown;
  after: unknown;
  mutationIntent?: 'replace' | 'derive';
};

type CollectionAddEffect = TurnEffectBase & {
  kind: 'add';
  subject: number;
  key: string | number;
  value: unknown;
  beforeSubject?: number;
  afterSubject?: number;
};

type CollectionRemoveEffect = TurnEffectBase & {
  kind: 'remove';
  subject: number;
  key: string | number;
  value: unknown;
  beforeSubject?: number;
  afterSubject?: number;
};

type CollectionRekeyEffect = TurnEffectBase & {
  kind: 'rekey';
  subject: number;
  beforeKey: string | number;
  afterKey: string | number;
};

type TurnEffect =
  | ScalarSetEffect
  | CollectionAddEffect
  | CollectionRemoveEffect
  | CollectionRekeyEffect;

type DirectedTurnApplication = {
  readonly effects: TurnEffect[];
  readonly orderDeltas: CollectionOrderDelta[];
  readonly direction: 'undo' | 'redo';
};

// Admission evidence only: pending values remain owned by transactions().
type PendingRestorationFootprint = {
  position: number;
  path: string;
  subject?: number;
  fieldSegments?: readonly string[];
  structural: boolean;
};

type TreeRealizationDescriptorStore = Map<
  PositionId,
  {
    path?: string;
    ownerPath?: string;
    collectionPath?: string;
    fieldPathFromRow?: string;
    structuralEffects?: ReadonlyMap<string, StructuralEffect>;
    structuralEffectBySubject?: ReadonlyMap<string, StructuralEffect>;
    subjectDescriptors?: ReadonlyMap<
      string,
      {
        path: string;
        ownerPath: string;
        collectionPath?: string;
        fieldPathFromRow?: string;
      }
    >;
  }
>;

// The rollback TYPE cluster — LaterAppliedEffect,
// PendingRollbackDependencyConflict, PendingRollbackPlan, RollbackTurnLike,
// RollbackFailureCause, ROLLBACK_ERROR_MESSAGE — was DELETED in 15.0 with
// restoration()'s duplicate transaction() (TX-SURFACE-0).
//
// Rollback is `transactions()`' concern and it declares its own equivalents,
// built from its own captured effects rather than from restoration history.

function fieldSegmentsOverlap(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return left
    .slice(0, Math.min(left.length, right.length))
    .every((key, index) => key === right[index]);
}

function toReversalEffect(
  effect: TurnEffect,
  direction: 'undo' | 'redo'
): ReversalEffect {
  switch (effect.kind) {
    case 'set':
      return {
        owner: effect.position,
        before: direction === 'undo' ? effect.after : effect.before,
        after: direction === 'undo' ? effect.before : effect.after,
        subjectId: effect.subject,
        fieldSegments: effect.fieldSegments,
        plainBranchMembership: effect.plainBranchMembership
          ? direction === 'undo'
            ? {
                before: effect.plainBranchMembership.after,
                after: effect.plainBranchMembership.before,
              }
            : effect.plainBranchMembership
          : undefined,
        fieldPresence: effect.fieldPresence
          ? direction === 'undo'
            ? {
                before: effect.fieldPresence.after,
                after: effect.fieldPresence.before,
              }
            : effect.fieldPresence
          : undefined,
        path: effect.path,
        ownerPath: effect.ownerPath,
      };
    case 'remove': {
      const structuralContext: StructuralEffect = {
        kind: effect.kind,
        subject: effect.subject,
        key: effect.key,
        value: effect.value,
        beforeSubject: effect.beforeSubject,
        afterSubject: effect.afterSubject,
      };
      return {
        owner: effect.position,
        before: direction === 'undo' ? undefined : effect.key,
        after: direction === 'undo' ? effect.key : undefined,
        subjectId: effect.subject,
        path: effect.path,
        ownerPath: effect.ownerPath,
        structural: direction === 'undo' ? 'add' : 'remove',
        structuralContext,
      };
    }
    case 'add': {
      const structuralContext: StructuralEffect = {
        kind: effect.kind,
        subject: effect.subject,
        key: effect.key,
        value: effect.value,
        beforeSubject: effect.beforeSubject,
        afterSubject: effect.afterSubject,
      };
      return {
        owner: effect.position,
        before: direction === 'undo' ? effect.key : undefined,
        after: direction === 'undo' ? undefined : effect.key,
        subjectId: effect.subject,
        path: effect.path,
        ownerPath: effect.ownerPath,
        structural: direction === 'undo' ? 'remove' : 'add',
        structuralContext,
      };
    }
    case 'rekey': {
      const structuralContext: StructuralEffect = {
        kind: effect.kind,
        subject: effect.subject,
        beforeKey: effect.beforeKey,
        afterKey: effect.afterKey,
      };
      return {
        owner: effect.position,
        before: direction === 'undo' ? effect.afterKey : effect.beforeKey,
        after: direction === 'undo' ? effect.beforeKey : effect.afterKey,
        subjectId: effect.subject,
        path: effect.path,
        ownerPath: effect.ownerPath,
        structural: 'rekey',
        structuralContext,
      };
    }
  }
}

// `buildPendingRollbackPlan()` and its `RollbackFailureCause` /
// `ROLLBACK_ERROR_MESSAGE` helpers were DELETED in 15.0 with restoration()'s
// duplicate `transaction()` (TX-SURFACE-0). Rollback planning belongs to
// `transactions()`, which has its own equivalent built from its own captured
// effects rather than from restoration history.

type PendingEffectMap = Map<string, TurnEffect>;
type PendingCollectionOrder = Omit<CollectionOrderCapture, 'meta'>;

type CaptureBucket = {
  ownerPaths: Set<string>;
  subjectIds: Set<number>;
  positionIds: Set<number>;
  effects: PendingEffectMap;
  collectionOrders: Map<number, PendingCollectionOrder>;
  descriptorInputs: Array<
    Omit<Parameters<typeof rememberTreeRealizationDescriptor>[0], 'descriptors'>
  >;
  /**
   * HIST-C2: whether any write accumulated into this turn was designated
   * restoration-eligible. Turn-WIDE by construction — one designated write
   * promotes the whole turn, because the turn is the atomic unit (HIST-0 case
   * 4). It is a boolean rather than a count so nesting is idempotent.
   */
  designated: boolean;
};

/** A captured pre-image's place: a scope plus exact keys inside it. */
type RebaseAddress = { scope: string; segments: readonly string[] };
type RebaseValue = { value: unknown; present: boolean };
type RebaseAtom = RebaseAddress & { before: RebaseValue; after: RebaseValue };

const ABSENT: RebaseValue = { value: undefined, present: false };

const isRebaseRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const navigateRebaseValue = (
  at: RebaseValue,
  keys: readonly string[]
): RebaseValue => {
  let current = at;
  for (const key of keys) {
    if (
      !current.present ||
      !isRebaseRecord(current.value) ||
      !Object.prototype.hasOwnProperty.call(current.value, key)
    ) {
      return ABSENT;
    }
    current = { value: current.value[key], present: true };
  }
  return current;
};

/** Copy-on-write: shared snapshots are never mutated. */
const replaceRebaseValue = (
  at: RebaseValue,
  keys: readonly string[],
  next: RebaseValue
): RebaseValue => {
  if (keys.length === 0) return next;
  const [key, ...rest] = keys;
  const container: Record<string, unknown> =
    at.present && isRebaseRecord(at.value) ? { ...at.value } : {};
  const child = replaceRebaseValue(
    Object.prototype.hasOwnProperty.call(container, key)
      ? { value: container[key], present: true }
      : ABSENT,
    rest,
    next
  );
  if (child.present) container[key] = child.value;
  else delete container[key];
  return { value: container, present: true };
};

const sameRebaseValue = (left: RebaseValue, right: RebaseValue): boolean =>
  left.present === right.present &&
  (!left.present || deepEqual(left.value, right.value));

/**
 * Re-bases chronological effect lists recorded after a REJECTED turn onto
 * what that turn replaced, for every pre-image a record can hold. See
 * `RestorationManager.rebaseAfterRejection`.
 *
 *   field write (`set`)   its `before` and presence, at the exact address or
 *                         any address inside or around one the turn wrote
 *   row removal           the row's value snapshot, field by field (written,
 *                         added and dropped fields alike) and its key
 *   row rename            its from-key
 *   add / remove anchors  a row only the turn created is followed to its
 *                         nearest neighbour that survives the rejection
 *   rows the turn created every later record of them is dropped
 *
 * Each address is claimed by its FIRST later record: later records there were
 * based on that one. A record's own field writes claim before its removal
 * snapshot does, since the snapshot was taken after them.
 *
 * Addresses are lossless: a row is its owner position and lifetime plus the
 * exact field keys; a plain value is its position plus exact keys below it.
 * Never a display path: the literal key 'd.e' and the nested d.e are
 * different places (4b28e3bf keyed plain values by path, so they collided).
 * Every plain write notifies at its own leaf position, so a record write and a
 * leaf write to one place share the leaf's position.
 *
 * Exported for its unit spec only (`rebase-onto-rejection.spec.ts`), which
 * also covers the overlap shapes a rollback refuses before they can reach it.
 */
export function rebaseOntoRejection(
  rejected: readonly TurnEffect[],
  lists: readonly TurnEffect[][]
): TurnEffect[][] {
  const rowScope = (position: number, subject: number) =>
    `r${position}:${subject}`;
  const addressOf = (effect: ScalarSetEffect): RebaseAddress =>
    effect.subject === undefined
      ? { scope: `p${effect.position}`, segments: effect.branchSegments ?? [] }
      : {
          scope: rowScope(effect.position, effect.subject),
          segments: effect.fieldSegments ?? [],
        };
  const presenceOf = (
    effect: ScalarSetEffect,
    side: 'before' | 'after'
  ): boolean =>
    effect.plainBranchMembership?.[side] ??
    effect.fieldPresence?.[side] ??
    true;

  const created = new Map<string, CollectionAddEffect>();
  for (const effect of rejected) {
    if (effect.kind === 'add') {
      created.set(rowScope(effect.position, effect.subject), effect);
    }
  }
  const rekeys = new Map<string, CollectionRekeyEffect>();
  const atoms: RebaseAtom[] = [];
  for (const effect of rejected) {
    if (effect.kind === 'rekey') {
      const scope = rowScope(effect.position, effect.subject);
      if (!created.has(scope)) rekeys.set(scope, effect);
    } else if (effect.kind === 'set') {
      const address = addressOf(effect);
      if (created.has(address.scope)) continue;
      atoms.push({
        ...address,
        before: { value: effect.before, present: presenceOf(effect, 'before') },
        after: { value: effect.after, present: presenceOf(effect, 'after') },
      });
    }
  }
  if (created.size === 0 && rekeys.size === 0 && atoms.length === 0) {
    return [...lists];
  }

  // Atoms are indexed by scope, then by exact key path (a trie), so a claim
  // walks only its own path: O(depth) plus each atom consumed once, rather
  // than a scan of every live atom per claim (the re-review measured 860 ms
  // at 2,000 rejected effects x 10k later records, and 746 ms for a
  // 10k-key record). `seq` keeps the rejected turn's chronology for atoms one
  // claim consumes together: later writes are undone first.
  type TrieNode = {
    atoms: Array<RebaseAtom & { seq: number }>;
    children: Map<string, TrieNode>;
  };
  const roots = new Map<string, TrieNode>();
  const createNode = (): TrieNode => ({ atoms: [], children: new Map() });
  const insertAtom = (atom: RebaseAtom & { seq: number }): void => {
    let node: TrieNode | undefined = roots.get(atom.scope);
    if (!node) {
      node = createNode();
      roots.set(atom.scope, node);
    }
    for (const segment of atom.segments) {
      let child: TrieNode | undefined = node.children.get(segment);
      if (!child) {
        child = createNode();
        node.children.set(segment, child);
      }
      node = child;
    }
    node.atoms.push(atom);
  };
  atoms.forEach((atom, seq) => insertAtom({ ...atom, seq }));

  // Defence in depth: never write back a renamed-away key that a DIFFERENT
  // lifetime holds in a later record. The rollback planner refuses that shape
  // (a re-occupied vacated key is a dependency); if it ever got here, keeping
  // the later key is consistent where restoring the original would put two
  // lifetimes at one key.
  const liveRekeys = new Map(rekeys);
  const droppedRemovals = new Map<string, CollectionRemoveEffect>();
  if (liveRekeys.size > 0) {
    const renamedAwayKeys = new Map<string, string[]>();
    for (const [scope, rekey] of liveRekeys) {
      const at = `${rekey.position}\u0000${String(rekey.beforeKey)}`;
      const scopes = renamedAwayKeys.get(at);
      if (scopes) scopes.push(scope);
      else renamedAwayKeys.set(at, [scope]);
    }
    for (const effects of lists) {
      for (const effect of effects) {
        const occupied =
          effect.kind === 'add'
            ? effect.key
            : effect.kind === 'rekey'
            ? effect.afterKey
            : undefined;
        if (occupied === undefined) continue;
        for (const scope of renamedAwayKeys.get(
          `${effect.position}\u0000${String(occupied)}`
        ) ?? []) {
          const rekey = liveRekeys.get(scope);
          if (
            rekey &&
            rekey.subject !== effect.subject &&
            rekey.beforeKey === occupied
          ) {
            liveRekeys.delete(scope);
          }
        }
      }
    }
  }

  /** Split an atom one level, or undefined when its values are not records. */
  const refine = (
    atom: RebaseAtom & { seq: number }
  ): Array<RebaseAtom & { seq: number }> | undefined => {
    const sides = [atom.before, atom.after].map((side) =>
      !side.present ? {} : isRebaseRecord(side.value) ? side.value : undefined
    );
    if (sides[0] === undefined || sides[1] === undefined) return undefined;
    const children: Array<RebaseAtom & { seq: number }> = [];
    for (const key of new Set([
      ...Object.keys(sides[0]),
      ...Object.keys(sides[1]),
    ])) {
      const before = navigateRebaseValue(atom.before, [key]);
      const after = navigateRebaseValue(atom.after, [key]);
      if (sameRebaseValue(before, after)) continue;
      children.push({
        scope: atom.scope,
        segments: [...atom.segments, key],
        before,
        after,
        seq: atom.seq,
      });
    }
    return children;
  };

  /** Re-base `current` (the pre-image at `address`) against live atoms. */
  const claim = (address: RebaseAddress, current: RebaseValue): RebaseValue => {
    let node = roots.get(address.scope);
    // An atom ABOVE this address covers it only in part: split it down so the
    // rest stays claimable by later records.
    for (
      let depth = 0;
      node && depth < address.segments.length;
      depth += 1
    ) {
      if (node.atoms.length > 0) {
        const above = node.atoms;
        node.atoms = [];
        for (const atom of above) {
          const children = refine(atom);
          if (children) {
            for (const child of children) insertAtom(child);
            continue;
          }
          const rest = address.segments.slice(atom.segments.length);
          if (sameRebaseValue(current, navigateRebaseValue(atom.after, rest))) {
            current = navigateRebaseValue(atom.before, rest);
          }
        }
      }
      node = node.children.get(address.segments[depth]);
    }
    if (!node) return current;
    // Every atom AT or BELOW the address: this record claims them all.
    const below: Array<RebaseAtom & { seq: number }> = [];
    const pending = [node];
    while (pending.length > 0) {
      const next = pending.pop() as TrieNode;
      appendAll(below, next.atoms);
      next.atoms = [];
      for (const child of next.children.values()) pending.push(child);
      next.children = new Map();
    }
    below.sort((left, right) => right.seq - left.seq);
    for (const atom of below) {
      const rest = atom.segments.slice(address.segments.length);
      if (sameRebaseValue(navigateRebaseValue(current, rest), atom.after)) {
        current = replaceRebaseValue(current, rest, atom.before);
      }
    }
    return current;
  };

  const rebaseSet = (effect: ScalarSetEffect): ScalarSetEffect => {
    const presence = presenceOf(effect, 'before');
    const next = claim(addressOf(effect), {
      value: effect.before,
      present: presence,
    });
    if (next.value === effect.before && next.present === presence) {
      return effect;
    }
    if (effect.plainBranchMembership) {
      return {
        ...effect,
        before: next.value,
        plainBranchMembership: {
          before: next.present,
          after: effect.plainBranchMembership.after,
        },
      };
    }
    if (effect.subject !== undefined) {
      const after = effect.fieldPresence?.after ?? true;
      const { fieldPresence: _presence, ...rest } = effect;
      return next.present && after
        ? { ...rest, before: next.value }
        : {
            ...rest,
            before: next.value,
            fieldPresence: { before: next.present, after },
          };
    }
    // A plain value write cannot express absence; its value still re-bases.
    return next.present ? { ...effect, before: next.value } : effect;
  };

  const rebaseKey = (scope: string, key: string | number): string | number => {
    const rekey = liveRekeys.get(scope);
    if (!rekey) return key;
    liveRekeys.delete(scope);
    return key === rekey.afterKey ? rekey.beforeKey : key;
  };

  const follow = (
    position: number,
    subject: number | undefined,
    side: 'beforeSubject' | 'afterSubject'
  ): number | undefined => {
    let current = subject;
    const seen = new Set<number>();
    while (current !== undefined && !seen.has(current)) {
      const scope = rowScope(position, current);
      const creation = created.get(scope);
      if (!creation) break;
      seen.add(current);
      // Removed by an earlier (dropped) record: its neighbours then.
      // Otherwise still alive here: its neighbours when the turn created it.
      current = (droppedRemovals.get(scope) ?? creation)[side];
    }
    return current;
  };

  return lists.map((effects) => {
    const kept: TurnEffect[] = [];
    for (const effect of effects) {
      const row =
        effect.kind !== 'set' || effect.subject !== undefined
          ? rowScope(effect.position, effect.subject as number)
          : undefined;
      if (row !== undefined && created.has(row)) {
        if (effect.kind === 'remove') droppedRemovals.set(row, effect);
        continue;
      }
      kept.push(effect);
    }
    for (let index = 0; index < kept.length; index += 1) {
      const effect = kept[index];
      if (effect.kind === 'set') kept[index] = rebaseSet(effect);
    }
    for (let index = 0; index < kept.length; index += 1) {
      const effect = kept[index];
      if (effect.kind === 'rekey') {
        const beforeKey = rebaseKey(
          rowScope(effect.position, effect.subject),
          effect.beforeKey
        );
        if (beforeKey !== effect.beforeKey) {
          kept[index] = { ...effect, beforeKey };
        }
      } else if (effect.kind === 'remove') {
        const scope = rowScope(effect.position, effect.subject);
        const snapshot = claim(
          { scope, segments: [] },
          { value: effect.value, present: true }
        );
        const key = rebaseKey(scope, effect.key);
        if (snapshot.value !== effect.value || key !== effect.key) {
          kept[index] = { ...effect, value: snapshot.value, key };
        }
      }
    }
    for (let index = 0; index < kept.length; index += 1) {
      const effect = kept[index];
      if (effect.kind !== 'add' && effect.kind !== 'remove') continue;
      const beforeSubject = follow(
        effect.position,
        effect.beforeSubject,
        'beforeSubject'
      );
      const afterSubject = follow(
        effect.position,
        effect.afterSubject,
        'afterSubject'
      );
      if (
        beforeSubject !== effect.beforeSubject ||
        afterSubject !== effect.afterSubject
      ) {
        kept[index] = { ...effect, beforeSubject, afterSubject };
      }
    }
    return kept.filter(
      (effect) =>
        effect.kind !== 'rekey' || effect.beforeKey !== effect.afterKey
    );
  });
}

function cloneTurnEffect(effect: TurnEffect): TurnEffect {
  switch (effect.kind) {
    case 'set':
      return { ...effect };
    case 'add':
    case 'remove':
      return { ...effect };
    case 'rekey':
      return { ...effect };
  }
}

function cloneCollectionOrderDelta(
  delta: CollectionOrderDelta
): CollectionOrderDelta {
  return {
    ...delta,
    participants: delta.participants.map((participant) => ({ ...participant })),
  };
}

function setDetachedNaturalValue<T>(
  source: T,
  path: string,
  value: unknown
): T {
  const segments = path === '' ? [] : path.split('.');
  const setAt = (current: unknown, offset: number): unknown => {
    if (offset === segments.length) {
      return value;
    }
    const key = segments[offset];
    const record =
      current !== null && typeof current === 'object' && !Array.isArray(current)
        ? (current as Record<string, unknown>)
        : {};
    return {
      ...record,
      [key]: setAt(record[key], offset + 1),
    };
  };
  return setAt(source, 0) as T;
}

function combineScalarMutationIntent(
  left?: 'replace' | 'derive',
  right?: 'replace' | 'derive'
): 'replace' | 'derive' | undefined {
  if (left === 'replace' || right === 'replace') {
    return 'replace';
  }
  if (left === 'derive' || right === 'derive') {
    return 'derive';
  }
  return undefined;
}

/** @internal Zero is no retention; every positive integer is an explicit capacity. */
function normaliseMaxHistorySize(value: number | undefined): number {
  if (value === undefined) return 50;
  if (!Number.isFinite(value) || value < 0) {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      console.error(
        `SignalTree: restoration({ maxHistorySize: ${String(
          value
        )} }) cannot ` +
          `express a supported retention policy. Pass 0 to retain no completed ` +
          `history, a positive integer for bounded undo, or omit it for the default ` +
          `of 50. Falling back to 50. [ST2032]`
      );
    }
    return 50;
  }
  return Math.floor(value);
}
class RestorationManager<T> {
  private history: CanonicalTurn<T>[] = [];
  private turns = new Map<number, CanonicalTurn<T>>();
  private pendingTurns = new Map<number, CanonicalTurn<T>>();
  private positionTurnIds = new Map<number, number[]>();
  private positionFrontiers = new Map<number, number>();
  private nextTurnId = 1;
  private nextEntryId = 1;
  private nextOperationId = 1;
  private activeOperation?: Set<RestorationEntryId>;
  private readonly publishObservation: (
    change: RestorationReaderChange
  ) => void;
  private historicalEvents: HistoricalEvent[] = [];
  private nextHistoricalOrdinal = 1;

  /**
   * The undo/redo position is a SIGNAL, because `canUndo()` bound in a template
   * has to update when it changes.
   *
   * It was a plain number, and `canUndo()`/`canRedo()` read it directly. Called
   * imperatively they were always correct, so this survived; but a
   * `computed(() => tree.canUndo())` evaluated once and cached `false` forever,
   * because it took no dependency on anything. Under zone-based change
   * detection the template re-read the method on every cycle and papered over
   * it. Zoneless — which is what this library targets and what Angular 22
   * defaults toward — has nothing to trigger that re-read, so the undo and redo
   * buttons of a zoneless app never enabled.
   *
   * `historyVersion` covers the other half: `canRedo()` and `getRestorationHistory()`
   * depend on the LENGTH of the history array, not just the position, and the
   * array is mutated in place (push/shift/slice-assign). Every mutation bumps
   * it, so a consumer reading history reactively sees entries appear.
   *
   * Found by comparing against a store that exposes reactive past/future status.
   */
  private readonly indexSignal;
  private readonly historyVersion;
  private readonly frontierVersion;
  private isTemporalViewActive = false;

  private get currentIndex(): number {
    return this.indexSignal();
  }
  private set currentIndex(value: number) {
    replaceLocation(this.indexSignal, value);
    markOwnerInvalidatedFrom(this.tree);
  }
  /** Call after any structural change to `this.history`. */
  private bumpRestorationHistory(): void {
    deriveLocation(this.historyVersion, (value) => value + 1);
    markOwnerInvalidatedFrom(this.tree);
  }

  /** Call after any structural change to frontier-derived turn state. */
  private bumpFrontiers(): void {
    deriveLocation(this.frontierVersion, (value) => value + 1);
    markOwnerInvalidatedFrom(this.tree);
  }

  retainsCompletedHistory(): boolean {
    return this.maxHistorySize > 0;
  }

  hasRetainedOrPendingHistory(): boolean {
    return this.history.length > 0 || this.pendingTurns.size > 0;
  }

  appendHistoricalGap(
    effects: TurnEffect[],
    collectionOrders: PendingCollectionOrder[],
    designated: boolean
  ): void {
    if (
      this.maxHistorySize === 0 ||
      (this.history.length === 0 && this.pendingTurns.size === 0)
    ) {
      return;
    }
    const lastTurn = this.history.at(-1);
    const lastEvent = this.historicalEvents.at(-1);
    if (
      lastTurn &&
      lastEvent?.boundaryTurnId === lastTurn.id &&
      designated &&
      collectionOrders.length === 0
    ) {
      appendAll(lastEvent.effects, effects.map(cloneTurnEffect));
      return;
    }
    this.appendHistoricalEvent(effects, collectionOrders);
  }

  private appendHistoricalEvent(
    effects: TurnEffect[],
    collectionOrders: PendingCollectionOrder[],
    boundaryTurnId?: number
  ): number | undefined {
    const orderDeltas = collectionOrders
      .map((order) =>
        deriveCollectionOrderDelta(
          order.owner,
          order.beforeSubjects,
          order.afterSubjects,
          order.beforeFrontier,
          order.afterFrontier
        )
      )
      .filter((delta) => delta.participants.length > 0);
    // A physically net-zero batch can still contain an authored turn (external
    // 0 -> 5, authored 5 -> 0). Its boundary must remain materializable.
    if (effects.length === 0 && orderDeltas.length === 0 && boundaryTurnId === undefined) {
      return undefined;
    }
    const ordinal = this.nextHistoricalOrdinal++;
    this.historicalEvents.push({
      ordinal,
      effects: effects.map(cloneTurnEffect),
      orderDeltas: orderDeltas.map(cloneCollectionOrderDelta),
      boundaryTurnId,
    });
    return ordinal;
  }

  private maxHistorySize: number;

  constructor(
    private tree: ISignalTree<T>,
    private positionRegistry: PositionRegistry,
    private config: RestorationConfig = {},
    private restoreStateFn?: (state: T) => void,
    private applyEffectsFn?: (applications: DirectedTurnApplication[]) => void
  ) {
    const locations = getLocationRuntime(tree) ?? NEUTRAL_LOCATION_RUNTIME;
    this.indexSignal = locations.createCell(-1);
    this.historyVersion = locations.createCell(0);
    this.frontierVersion = locations.createCell(0);
    this.maxHistorySize = normaliseMaxHistorySize(config.maxHistorySize);
    this.publishObservation = installRestorationReader(
      tree,
      this.positionRegistry.id,
      () => this.readObservation()
    );
  }

  private readObservation(): RestorationReaderState {
    return {
      entries: this.history.map((entry) => {
        const status = this.getTurnStatus(entry.id);
        return {
          entryId: entry.entryId,
          transactionIds:
            entry.__transactionId === undefined ? [] : [entry.__transactionId],
          status:
            status === 'applied' || status === 'unapplied'
              ? status
              : 'inconsistent',
        };
      }),
      currentIndex: this.currentIndex,
      canUndo: this.canUndoConfirmed(),
      canRedo: this.canRedoConfirmed(),
    };
  }

  private observeOperation(
    operation: 'undo' | 'redo' | 'jump',
    run: () => boolean
  ): boolean {
    const operationId = `restoration-operation:${this
      .nextOperationId++}` as const;
    const affected = new Set<RestorationEntryId>();
    const previous = this.activeOperation;
    const previousFailure = this.deliveryFailure;
    this.activeOperation = affected;
    this.deliveryFailure = undefined;
    let outcome: 'applied' | 'noop' | 'refused' | 'failed' = 'failed';
    try {
      const result = run();
      outcome = affected.size ? 'applied' : 'noop';
      // The operation completed its bookkeeping; a consumer that threw after
      // the reversal applied is surfaced now, with the outcome it really had.
      // Read through a widened type: run() may have set it.
      const failure = this.deliveryFailure as { error: unknown } | undefined;
      if (failure) throw applicationFailureCause(failure.error);
      return result;
    } catch (error) {
      if (outcome !== 'failed') throw error;
      outcome =
        affected.size === 0 &&
        error instanceof Error &&
        RESTORATION_REFUSALS.has(error)
          ? 'refused'
          : 'failed';
      throw error;
    } finally {
      this.activeOperation = previous;
      this.deliveryFailure = previousFailure;
      this.publishObservation({
        kind: 'operation',
        operationId,
        operation,
        outcome,
        affectedEntryIds: [...affected],
      });
    }
  }

  /**
   * Resolve BEFORE applying. Application delivers synchronously, and a
   * subscriber may reset or trim history there; the operation still applied
   * these entries, so the event must name them.
   */
  private entryIdsFor(turnIds: readonly number[]): RestorationEntryId[] {
    const ids: RestorationEntryId[] = [];
    for (const id of turnIds) {
      const entry = this.turns.get(id);
      if (entry) ids.push(entry.entryId);
    }
    return ids;
  }

  /** A consumer threw after the active operation's reversal applied. */
  private deliveryFailure: { error: unknown } | undefined;

  /**
   * Apply, treating a consumer's throw after the reversal was installed as a
   * delivery failure: the caller finishes its bookkeeping and the operation
   * rethrows at its end. A throw before installation propagates unchanged.
   */
  private applyReversal(apply: () => void): void {
    try {
      apply();
    } catch (error) {
      if (!wasAppliedBeforeFailure(error)) throw error;
      this.deliveryFailure ??= { error };
    }
  }

  /** Called only once application returned; a throw leaves them unrecorded. */
  private recordAppliedEntries(entryIds: readonly RestorationEntryId[]): void {
    if (!this.activeOperation) return;
    for (const id of entryIds) this.activeOperation.add(id);
  }

  /**
   * Add a new entry to the history.
   */
  // NOTE: there is deliberately NO `state` parameter.
  //
  // There used to be one, and it was a lie: every caller computed a snapshot to
  // pass in — the legacy controller read, `the legacy controller read` — and this method ignored it
  // and called `snapshotState()` itself. Harmless in cost (both hit the same
  // memo) and NOT harmless in contract: the signature promised "record this
  // state" while the body recorded "whatever the tree is right now". A caller
  // handing over a deferred or reconstructed state would have silently got
  // something else.
  //
  // Recomputing here is the behaviour we actually want, so the parameter is
  // gone rather than wired up.
  //
  // The `provisional` parameter and `finalizeProvisional()` went with it in
  // 14.1.1: a half-built coalescing scheme with no caller anywhere in
  // `packages/*/src`. Deferred entry completion IS a real requirement — it is
  // what a transaction's `commit()` needs — but that one has to close a
  // path-scoped delta spanning concurrent writers, which is not what this was
  // built for. Rebuilding ~20 lines beats reasoning about which of its
  // assumptions still hold. See docs/architecture/history-the-greenfield-target.md.
  addEntry(
    subjectIds?: number[],
    positionIds?: number[],
    effects?: TurnEffect[],
    collectionOrders?: PendingCollectionOrder[],
    explicitTurnId?: number,
    beforeInsert?: () => void,
    historicalCapture?: {
      effects: TurnEffect[];
      collectionOrders: PendingCollectionOrder[];
    }
  ): boolean {
    const entry = this.buildTurn(
      subjectIds,
      positionIds,
      effects,
      collectionOrders,
      explicitTurnId,
      false,
      historicalCapture
    );
    if (!entry) {
      return false;
    }

    beforeInsert?.();
    return this.insertConfirmedTurn(entry);
  }

  createPendingEntry(
    subjectIds?: number[],
    positionIds?: number[],
    effects?: TurnEffect[],
    collectionOrders?: PendingCollectionOrder[],
    explicitTurnId?: number,
    transactionId?: number
  ): CanonicalTurn<T> | undefined {
    const entry = this.buildTurn(
      subjectIds,
      positionIds,
      effects,
      collectionOrders,
      explicitTurnId,
      true
    );
    if (!entry) {
      return undefined;
    }
    entry.__transactionId = transactionId;
    this.pendingTurns.set(entry.id, entry);
    this.publishObservation({ kind: 'history-changed' });
    return {
      ...entry,
      restorationSubjectIds: entry.restorationSubjectIds
        ? [...entry.restorationSubjectIds]
        : undefined,
      __positionIds: entry.__positionIds ? [...entry.__positionIds] : undefined,
      __effects: entry.__effects
        ? entry.__effects.map(cloneTurnEffect)
        : undefined,
      __orderDeltas: entry.__orderDeltas
        ? entry.__orderDeltas.map(cloneCollectionOrderDelta)
        : undefined,
    };
  }

  confirmPendingTurn(turnId: number, beforeInsert?: () => void): boolean {
    const entry = this.pendingTurns.get(turnId);
    if (!entry) {
      return false;
    }

    beforeInsert?.();
    this.pendingTurns.delete(turnId);
    return this.insertConfirmedTurn(entry);
  }

  discardPendingTurn(turnId: number): boolean {
    const discarded = this.pendingTurns.delete(turnId);
    // A discarded pending turn is a REJECTED transaction: its writes were
    // compensated and never became history, so its event goes too. Kept as an
    // unbounded event, historical materialization replayed its inverse over a
    // state that no longer held it — getRestorationHistory() threw "Subject 2
    // is not active" after rejecting an undoable transaction that added a row.
    this.historicalEvents = this.historicalEvents.filter(
      (event) => event.boundaryTurnId !== turnId
    );
    if (this.history.length === 0 && this.pendingTurns.size === 0) {
      this.historicalEvents = [];
    }
    return discarded;
  }

  hasPendingTurn(turnId: number): boolean {
    return this.pendingTurns.has(turnId);
  }

  /** Turn ids and event ordinals allocated so far. */
  historyWatermark(): { turnId: number; ordinal: number } {
    return {
      turnId: this.nextTurnId - 1,
      ordinal: this.nextHistoricalOrdinal - 1,
    };
  }

  /**
   * THE LAW (15.4.4): after a transaction is rolled back, no undo, redo or
   * jumpTo may reinstate a value or row that only it wrote.
   *
   * Turns and events recorded while it was pending captured its speculative
   * values as their `before`: undo of a later write restored the rejected
   * value, and a row it created and a later turn removed came back. Each
   * address's FIRST later record is re-based onto what the rejected turn
   * replaced, when that record's `before` is the rejected turn's `after`;
   * later records at the address were based on that record and keep theirs.
   * Every later record of a row the rejected turn created is dropped (only it
   * created that row), and anchors pointing at a dropped removal follow the
   * removal's own anchors.
   */
  rebaseAfterRejection(
    rejected: readonly TurnEffect[],
    since: { turnId: number; ordinal: number }
  ): void {
    const later = [...this.history, ...this.pendingTurns.values()]
      .filter((turn) => turn.id > since.turnId && turn.__effects)
      .sort((left, right) => left.id - right.id);
    const turnEffects = rebaseOntoRejection(
      rejected,
      later.map((turn) => turn.__effects as TurnEffect[])
    );
    later.forEach((turn, index) => {
      turn.__effects = turnEffects[index];
    });
    const events = this.historicalEvents.filter(
      (event) => event.ordinal > since.ordinal
    );
    const eventEffects = rebaseOntoRejection(
      rejected,
      events.map((event) => event.effects)
    );
    events.forEach((event, index) => {
      (event as { effects: TurnEffect[] }).effects = eventEffects[index];
    });
    this.dropEmptiedTurns(later);
  }

  /**
   * A later turn whose every effect was the rejected transaction's own row
   * (now gone) is no operation at all; kept, it cost a no-op undo step. Dropped
   * like a discarded pending turn: its event goes too when it is empty, ids
   * stay, indices and frontiers are rebuilt, and the index is re-read.
   */
  private dropEmptiedTurns(candidates: readonly CanonicalTurn<T>[]): void {
    const isEmpty = (turn: CanonicalTurn<T>) =>
      (turn.__effects?.length ?? 0) === 0 &&
      (turn.__orderDeltas?.length ?? 0) === 0;
    const emptied = new Set(
      candidates
        .filter((turn) => this.turns.get(turn.id) === turn && isEmpty(turn))
        .map(({ id }) => id)
    );
    if (emptied.size === 0) return;
    const dropped = this.history.filter(({ id }) => emptied.has(id));
    const viewIndex = this.isTemporalViewActive ? this.currentIndex : undefined;
    const droppedAtOrBeforeView =
      viewIndex === undefined
        ? 0
        : dropped.filter((turn) => turn.historyIndex <= viewIndex).length;
    this.history = this.history.filter(({ id }) => !emptied.has(id));
    this.historicalEvents = this.historicalEvents.flatMap((event) => {
      if (
        event.boundaryTurnId === undefined ||
        !emptied.has(event.boundaryTurnId)
      ) {
        return [event];
      }
      return event.effects.length === 0 && event.orderDeltas.length === 0
        ? []
        : [{ ...event, boundaryTurnId: undefined }];
    });
    this.releaseRetainedRestorationEntries(dropped);
    this.rebuildTurnIndexes();
    this.currentIndex =
      viewIndex === undefined
        ? this.latestAppliedIndex()
        : viewIndex - droppedAtOrBeforeView;
    this.bumpRestorationHistory();
    this.pruneHistoricalEventsBeforeOldestBoundary();
    this.publishObservation({ kind: 'history-changed' });
  }

  hasConfirmedTurnAfter(turnId: number): boolean {
    return this.history.some((turn) => turn.id > turnId);
  }

  // `getPendingRollbackPlan()` was DELETED in 15.0 with restoration()'s duplicate
  // `transaction()` (TX-SURFACE-0).
  //
  // TOMBSTONE, because this method IS the category-C defect the opt-in flip
  // found. Its first line was `const laterEffects = this.history` — it answered
  // "is rolling back this pending turn safe?" by reading the RESTORATION
  // HISTORY. That conflated two different questions: which operations a user may
  // reverse, and what has happened since a speculative turn. Under opt-in an
  // ordinary later write is not admitted to that history, so a dependent
  // rollback silently stopped being refused.
  //
  // `transactions()` answers the same question from its own captured effects and
  // never needed the history, which is why the repair was deletion rather than a
  // fix. Do not reintroduce a rollback-safety check that reads restoration
  // history: the dependency ledger and the undo stack are not the same thing.

  private buildTurn(
    subjectIds?: number[],
    positionIds?: number[],
    effects?: TurnEffect[],
    collectionOrders?: PendingCollectionOrder[],
    explicitTurnId?: number,
    retainPendingState = false,
    historicalCapture?: {
      effects: TurnEffect[];
      collectionOrders: PendingCollectionOrder[];
    }
  ): CanonicalTurn<T> | undefined {
    if (this.hasScopedRedoFuture()) {
      this.truncateScopedRedoFuture();
    }

    if (
      this.isTemporalViewActive &&
      this.currentIndex < this.history.length - 1
    ) {
      // DEFENSIVE, and honestly so: a probe that threw here on any discarded
      // entry carrying `restorationSubjectIds` fired ZERO times across the
      // whole suite, and mutating this call away fails nothing. Only
      // position-indexed entries name subjects, and `truncateScopedRedoFuture`
      // above has already removed those. The call stays because the coupling
      // that makes it redundant is not a property either function states, and
      // it costs one no-op release. Do not cite it as covered.
      const discarded = this.history.slice(this.currentIndex + 1);
      this.history = this.history.slice(0, this.currentIndex + 1);
      this.releaseRetainedRestorationEntries(discarded);
      this.bumpRestorationHistory();
    }

    // A restoration history entry IS the snapshot — no clone.
    //
    // This used to `structuredClone` the whole tree per entry, which made every
    // recorded write O(state) and retained a full copy of the state per entry:
    // 50 root writes each changing ONE number cost 0.03ms without restoration
    // and 340.60ms with it, at 10k rows.
    //
    // Materialisation is now memoised and structurally shared, so an unchanged
    // subtree is the SAME object across snapshots, and needs no copy to stay
    // correct because the library never mutates a materialised node: a write
    // builds new objects along the changed path and leaves the rest alone.
    //
    // ⚠️ WHAT THAT COSTS PER ENTRY, precisely — an earlier version of this
    // comment claimed "O(depth) per entry" flatly, and that is only true of
    // plain nested state. Measured on a 500-row collection, changing ONE entity:
    //
    //     unrelated branch shared : true      <- O(depth) holds here
    //     rows node shared        : false
    //     all ARRAY shared        : false
    //     entity objects shared   : 499 / 500
    //
    // So a collection costs O(collection-length IN POINTERS) per entry — the
    // `all` array is rebuilt — while the entity objects themselves are shared.
    // Far cheaper than the structuredClone it replaced, and far from free: 50
    // entries over 10k rows is ~500k pointer copies.
    //
    // This is why undo/redo over a large collection is not where SignalTree
    // wins: an immutable-root history can swap ONE reference on undo. SignalTree
    // instead preserves granular subject identity and republishes changed values.
    //
    // The ~150x figure this comment used to quote was the PRE-FIX number, from
    // before restore diffed instead of calling setAll unconditionally — and it
    // cited a comparison document that retracts it.
    //
    // This is what makes the snapshot read-only contract load-bearing rather
    // than advisory (nodes are frozen in dev). A caller that mutates a snapshot
    // now corrupts history as well as the cache.
    // No pruning step. `recordHistory` is gone, so the recorded snapshot IS the
    // materialised snapshot and the reference-dedupe below is exact again —
    // which also removes the phantom-entry class that pruning created.
    const pendingState = retainPendingState
      ? (snapshotState(this.tree.$ as unknown as TreeNode<T>) as T)
      : undefined;

    const turnId = explicitTurnId ?? this.nextTurnId;
    this.nextTurnId = Math.max(this.nextTurnId, turnId + 1);
    const effectSubjectIds = Array.from(
      new Set(
        (effects ?? [])
          .map((effect) => effect.subject)
          .filter((value): value is number => typeof value === 'number')
      )
    ).sort((left, right) => left - right);
    const effectPositionIds = Array.from(
      new Set((effects ?? []).map((effect) => effect.position))
    ).sort((left, right) => left - right);
    const entry: CanonicalTurn<T> = {
      id: turnId,
      entryId: `restoration-entry:${this.nextEntryId++}`,
      historyIndex: this.history.length,
      ...(pendingState === undefined ? {} : { state: pendingState }),
    };
    const orderDeltas = (collectionOrders ?? [])
      .map((order) =>
        deriveCollectionOrderDelta(
          order.owner,
          order.beforeSubjects,
          order.afterSubjects,
          order.beforeFrontier,
          order.afterFrontier
        )
      )
      .filter((delta) => delta.participants.length > 0);
    const resolvedSubjectIds =
      subjectIds && subjectIds.length > 0 ? subjectIds : effectSubjectIds;
    if (resolvedSubjectIds.length > 0) {
      entry.restorationSubjectIds = [...resolvedSubjectIds];
    }
    const resolvedPositionIds =
      positionIds && positionIds.length > 0 ? positionIds : effectPositionIds;
    if (resolvedPositionIds.length > 0) {
      entry.__positionIds = [...resolvedPositionIds];
    }
    if (effects && effects.length > 0) {
      entry.__effects = effects.map(cloneTurnEffect);
    }
    if (orderDeltas.length > 0) {
      entry.__orderDeltas = orderDeltas;
      entry.__positionIds = Array.from(
        new Set([
          ...(entry.__positionIds ?? []),
          ...orderDeltas.map(({ owner }) => owner),
        ])
      ).sort((left, right) => left - right);
    }

    // Dedupe by REFERENCE. `tree.$()` returns the identical object when nothing
    // changed, so this is exact for the case that matters and O(1) — the
    // deepEqual it replaces was a second full-state walk on every recorded
    // write, on top of the clone.
    //
    // Behaviour change worth knowing: two snapshots that are structurally equal
    // but referentially distinct are no longer collapsed. That needs a write
    // that changed something and a later write that changed it back, in
    // separate flushes — which is arguably two user actions and two entries.
    //
    // Reference identity is the whole check again. It was not, while
    // `recordHistory` existed: pruning produced snapshots that were structurally
    // identical and referentially distinct, so a `prunedEqual` walk had to run
    // whenever anything had been pruned. Deleting the option deleted the need.
    const isEffectEmpty =
      (!effects || effects.length === 0) && orderDeltas.length === 0;
    if (isEffectEmpty) {
      return undefined;
    }

    // No admission predicate here, and none at read time either — see the
    // tombstone above `redo()`. Admission is decided by `undoable()`, before a
    // turn exists.
    //
    // The reference-dedup above stays: it is O(1), structural rather than
    // semantic, and collapsing an identical snapshot loses nothing.

    const eventOrdinal = this.appendHistoricalEvent(
      historicalCapture?.effects ?? effects ?? [],
      historicalCapture?.collectionOrders ?? collectionOrders ?? [],
      turnId
    );
    if (eventOrdinal !== undefined) {
      entry.__eventOrdinal = eventOrdinal;
    }

    return entry;
  }

  private insertConfirmedTurn(entry: CanonicalTurn<T>): boolean {
    const insertIndex = this.history.findIndex(
      (candidate) => candidate.id > entry.id
    );
    // The common case: a new entry after a fully applied history (a write
    // truncates any redo future first). Anything else re-reads the prefix.
    const appendedAfterAppliedPrefix =
      insertIndex === -1 &&
      !this.isTemporalViewActive &&
      this.currentIndex === this.history.length - 1;
    if (insertIndex === -1) {
      this.history.push(entry);
    } else {
      this.history.splice(insertIndex, 0, entry);
    }
    this.bumpRestorationHistory();
    this.isTemporalViewActive = false;

    delete entry.state;

    this.retainRestorationClaims(entry);

    // Enforce max history size
    if (this.history.length > this.maxHistorySize) {
      const evicted = this.history.shift();
      if (evicted) {
        this.releaseRetainedRestorationEntries([evicted]);
      }
      this.bumpRestorationHistory();
    }

    this.rebuildTurnIndexes();
    // The latest APPLIED entry, not the last one: confirming a transaction
    // after a later write was undone inserts it before that undone entry
    // (through 30c6a90e this claimed the undone entry was applied).
    this.currentIndex = appendedAfterAppliedPrefix
      ? this.history.length - 1
      : this.latestAppliedIndex();
    this.pruneHistoricalEventsBeforeOldestBoundary();
    this.publishObservation({ kind: 'history-changed' });
    return true;
  }

  /** The latest applied history entry, or -1 when none is applied. */
  private latestAppliedIndex(): number {
    for (let index = this.history.length - 1; index >= 0; index -= 1) {
      if (this.getTurnStatus(this.history[index].id) === 'applied') {
        return index;
      }
    }
    return -1;
  }

  private pruneHistoricalEventsBeforeOldestBoundary(): void {
    const oldestOrdinal = [
      ...this.history.map(({ __eventOrdinal }) => __eventOrdinal),
      ...[...this.pendingTurns.values()].map(
        ({ __eventOrdinal }) => __eventOrdinal
      ),
    ]
      .filter((ordinal): ordinal is number => ordinal !== undefined)
      .sort((left, right) => left - right)[0];
    if (oldestOrdinal === undefined) {
      if (this.pendingTurns.size === 0) {
        this.historicalEvents = [];
      }
      return;
    }
    this.historicalEvents = this.historicalEvents.filter(
      (event) => event.ordinal >= oldestOrdinal
    );
  }

  getTurns(): Array<CanonicalTurn<T>> {
    const states = this.materializeHistoricalStates();
    const stateByTurnId = new Map(
      this.history.map((turn, index) => [turn.id, states[index]])
    );
    return [...this.turns.values(), ...this.pendingTurns.values()]
      .sort((left, right) => left.id - right.id)
      .map((turn) => ({
        ...turn,
        state: turn.state ?? stateByTurnId.get(turn.id),
        restorationSubjectIds: turn.restorationSubjectIds
          ? [...turn.restorationSubjectIds]
          : undefined,
        __positionIds: turn.__positionIds ? [...turn.__positionIds] : undefined,
        __effects: turn.__effects
          ? turn.__effects.map(cloneTurnEffect)
          : undefined,
        __orderDeltas: turn.__orderDeltas
          ? turn.__orderDeltas.map(cloneCollectionOrderDelta)
          : undefined,
      }));
  }

  getTurn(turnId: number): CanonicalTurn<T> | undefined {
    recordProductionSubstrateStat('turnIndexLookups');
    const turn = this.turns.get(turnId) ?? this.pendingTurns.get(turnId);
    if (!turn) {
      return undefined;
    }

    const historyIndex = this.history.findIndex((entry) => entry.id === turnId);
    const state =
      turn.state ??
      (historyIndex >= 0
        ? this.materializeHistoricalStates()[historyIndex]
        : undefined);
    return {
      ...turn,
      state,
      restorationSubjectIds: turn.restorationSubjectIds
        ? [...turn.restorationSubjectIds]
        : undefined,
      __positionIds: turn.__positionIds ? [...turn.__positionIds] : undefined,
      __effects: turn.__effects
        ? turn.__effects.map(cloneTurnEffect)
        : undefined,
      __orderDeltas: turn.__orderDeltas
        ? turn.__orderDeltas.map(cloneCollectionOrderDelta)
        : undefined,
    };
  }

  getTurnRef(turnId: number): CanonicalTurn<T> | undefined {
    recordProductionSubstrateStat('turnIndexLookups');
    return this.turns.get(turnId);
  }

  getRestorationHistoryRef(index: number): CanonicalTurn<T> | undefined {
    return this.history[index];
  }

  getTurnIdsForPosition(positionId: number): number[] {
    return [...(this.positionTurnIds.get(positionId) ?? [])];
  }

  containsPosition(
    authorityPositionId: number,
    participantPositionId: number
  ): boolean {
    return this.positionRegistry.contains(
      authorityPositionId,
      participantPositionId
    );
  }

  turnIsContainedBy(turnId: number, authorityPositionId: number): boolean {
    recordProductionSubstrateStat('turnIndexLookups');
    const turn = this.turns.get(turnId) ?? this.pendingTurns.get(turnId);
    if (!turn) {
      return false;
    }

    return (turn.__positionIds ?? []).every((participantPositionId) =>
      this.containsPosition(authorityPositionId, participantPositionId)
    );
  }

  private getContainedPositionIds(authorityPositionId: number): number[] {
    const contained = new Set<number>([authorityPositionId]);

    for (const positionId of this.positionTurnIds.keys()) {
      if (this.containsPosition(authorityPositionId, positionId)) {
        contained.add(positionId);
      }
    }

    return [...contained].sort((left, right) => left - right);
  }

  private resolveContainedUndoClosure(authorityPositionId: number): number[] {
    let seedPositionId: number | undefined;
    let seedTurn: CanonicalTurn<T> | undefined;

    for (const positionId of this.getContainedPositionIds(
      authorityPositionId
    )) {
      const turnIds = this.positionTurnIds.get(positionId) ?? [];
      const frontier = this.getFrontier(positionId);
      if (frontier <= 0) {
        continue;
      }

      recordProductionSubstrateStat('turnIndexLookups');
      const candidateTurn = this.turns.get(turnIds[frontier - 1]);
      if (
        candidateTurn &&
        (!seedTurn ||
          (candidateTurn.historyIndex ?? -1) > (seedTurn.historyIndex ?? -1))
      ) {
        seedTurn = candidateTurn;
        seedPositionId = positionId;
      }
    }

    if (seedPositionId === undefined) {
      return [];
    }

    const closure = this.resolveUndoClosure(seedPositionId);
    return closure.every((turnId) =>
      this.turnIsContainedBy(turnId, authorityPositionId)
    )
      ? closure
      : [];
  }

  private resolveContainedRedoClosure(authorityPositionId: number): number[] {
    let seedPositionId: number | undefined;
    let seedTurn: CanonicalTurn<T> | undefined;

    for (const positionId of this.getContainedPositionIds(
      authorityPositionId
    )) {
      const turnIds = this.positionTurnIds.get(positionId) ?? [];
      const frontier = this.getFrontier(positionId);
      if (frontier >= turnIds.length) {
        continue;
      }

      recordProductionSubstrateStat('turnIndexLookups');
      const candidateTurn = this.turns.get(turnIds[frontier]);
      if (
        candidateTurn &&
        (!seedTurn ||
          (candidateTurn.historyIndex ?? Number.POSITIVE_INFINITY) <
            (seedTurn.historyIndex ?? Number.POSITIVE_INFINITY))
      ) {
        seedTurn = candidateTurn;
        seedPositionId = positionId;
      }
    }

    if (seedPositionId === undefined) {
      return [];
    }

    const closure = this.resolveRedoClosure(seedPositionId);
    return closure.every((turnId) =>
      this.turnIsContainedBy(turnId, authorityPositionId)
    )
      ? closure
      : [];
  }

  getFrontier(positionId: number): number {
    return this.positionFrontiers.get(positionId) ?? 0;
  }

  getAppliedTurnIdsForPosition(positionId: number): number[] {
    const turnIds = this.positionTurnIds.get(positionId) ?? [];
    const frontier = this.getFrontier(positionId);
    return turnIds.slice(0, frontier);
  }

  getTurnStatus(
    turnId: number
  ): 'pending' | 'applied' | 'unapplied' | 'inconsistent' | undefined {
    if (this.pendingTurns.has(turnId)) {
      return 'pending';
    }

    recordProductionSubstrateStat('turnIndexLookups');
    const turn = this.turns.get(turnId);
    if (!turn) {
      return undefined;
    }

    let applied: boolean | undefined;
    for (const positionId of turn.__positionIds ?? []) {
      const turnIds = this.positionTurnIds.get(positionId) ?? [];
      const turnIndex = turnIds.indexOf(turnId);
      const positionApplied =
        turnIndex !== -1 && turnIndex < this.getFrontier(positionId);
      if (applied === undefined) {
        applied = positionApplied;
      } else if (applied !== positionApplied) {
        return 'inconsistent';
      }
    }

    return applied ? 'applied' : 'unapplied';
  }

  isTurnApplied(turnId: number): boolean | undefined {
    const status = this.getTurnStatus(turnId);
    if (status === 'inconsistent') {
      throw new Error(`Inconsistent applied status for turn ${turnId}`);
    }
    if (status === undefined) {
      return undefined;
    }
    return status === 'applied';
  }

  assertTurnStatusConsistency(): void {
    for (const turnId of this.turns.keys()) {
      this.isTurnApplied(turnId);
    }
  }

  resolveUndoClosure(positionId: number): number[] {
    const turnIds = this.positionTurnIds.get(positionId) ?? [];
    const frontier = this.getFrontier(positionId);
    if (frontier <= 0) {
      return [];
    }

    const seedTurnId = turnIds[frontier - 1];
    const closure = new Set<number>([seedTurnId]);
    let changed = true;

    while (changed) {
      changed = false;
      const closureTurnIds = [...closure];

      for (const candidateTurnId of closureTurnIds) {
        recordProductionSubstrateStat('turnIndexLookups');
        const turn = this.turns.get(candidateTurnId);
        if (!turn) {
          continue;
        }

        for (const candidatePositionId of turn.__positionIds ?? []) {
          const candidatePositionTurnIds =
            this.positionTurnIds.get(candidatePositionId) ?? [];
          const candidateFrontier = this.getFrontier(candidatePositionId);
          const earliestClosureIndex = candidatePositionTurnIds.findIndex(
            (indexedTurnId, turnIndex) =>
              turnIndex < candidateFrontier && closure.has(indexedTurnId)
          );

          if (earliestClosureIndex === -1) {
            continue;
          }

          for (
            let turnIndex = earliestClosureIndex;
            turnIndex < candidateFrontier;
            turnIndex++
          ) {
            const dependentTurnId = candidatePositionTurnIds[turnIndex];
            if (!closure.has(dependentTurnId)) {
              closure.add(dependentTurnId);
              changed = true;
            }
          }
        }
      }
    }

    return [...closure].sort((left, right) => {
      recordProductionSubstrateStat('turnIndexLookups', 2);
      const leftTurn = this.turns.get(left);
      const rightTurn = this.turns.get(right);
      return (rightTurn?.historyIndex ?? -1) - (leftTurn?.historyIndex ?? -1);
    });
  }

  resolveRedoClosure(positionId: number): number[] {
    const turnIds = this.positionTurnIds.get(positionId) ?? [];
    const frontier = this.getFrontier(positionId);
    if (frontier >= turnIds.length) {
      return [];
    }

    const seedTurnId = turnIds[frontier];
    const closure = new Set<number>([seedTurnId]);
    let changed = true;

    while (changed) {
      changed = false;
      const closureTurnIds = [...closure];

      for (const candidateTurnId of closureTurnIds) {
        recordProductionSubstrateStat('turnIndexLookups');
        const turn = this.turns.get(candidateTurnId);
        if (!turn) {
          continue;
        }

        for (const candidatePositionId of turn.__positionIds ?? []) {
          const candidatePositionTurnIds =
            this.positionTurnIds.get(candidatePositionId) ?? [];
          const candidateFrontier = this.getFrontier(candidatePositionId);
          let latestClosureIndex = -1;
          for (
            let turnIndex = candidateFrontier;
            turnIndex < candidatePositionTurnIds.length;
            turnIndex++
          ) {
            if (closure.has(candidatePositionTurnIds[turnIndex])) {
              latestClosureIndex = turnIndex;
            }
          }

          if (latestClosureIndex === -1) {
            continue;
          }

          for (
            let turnIndex = candidateFrontier;
            turnIndex <= latestClosureIndex;
            turnIndex++
          ) {
            const prerequisiteTurnId = candidatePositionTurnIds[turnIndex];
            if (!closure.has(prerequisiteTurnId)) {
              closure.add(prerequisiteTurnId);
              changed = true;
            }
          }
        }
      }
    }

    return [...closure].sort((left, right) => {
      recordProductionSubstrateStat('turnIndexLookups', 2);
      const leftTurn = this.turns.get(left);
      const rightTurn = this.turns.get(right);
      return (leftTurn?.historyIndex ?? -1) - (rightTurn?.historyIndex ?? -1);
    });
  }

  private restoreVisibleStateToConfirmed(): void {
    if (!this.isTemporalViewActive) {
      return;
    }

    const temporalIndex = this.currentIndex;
    const turnIdsToUndo: number[] = [];
    const turnIdsToRedo: number[] = [];

    for (const turn of this.history) {
      if (
        (!turn.__effects || turn.__effects.length === 0) &&
        (!turn.__orderDeltas || turn.__orderDeltas.length === 0)
      ) {
        continue;
      }

      const temporalApplied = turn.historyIndex <= temporalIndex;
      const confirmedApplied = this.getTurnStatus(turn.id) === 'applied';

      if (temporalApplied && !confirmedApplied) {
        turnIdsToUndo.unshift(turn.id);
      } else if (!temporalApplied && confirmedApplied) {
        turnIdsToRedo.push(turn.id);
      }
    }

    this.applyDirectedTurnTransition(turnIdsToUndo, turnIdsToRedo);

    this.isTemporalViewActive = false;
    // Back at the undo position: so is the index, even if the step that
    // follows throws (a view never moves frontiers, so they still say where).
    this.currentIndex = this.latestAppliedIndex();
  }

  undoPosition(
    positionId: number,
    beforePublish?: (closure: number[]) => void
  ): number[] {
    const closure = this.resolveUndoClosure(positionId);
    if (closure.length === 0) {
      return closure;
    }

    const frontierUpdates = new Map<number, number>();

    for (const turnId of closure) {
      recordProductionSubstrateStat('turnIndexLookups');
      const turn = this.turns.get(turnId);
      if (!turn) {
        continue;
      }

      for (const candidatePositionId of turn.__positionIds ?? []) {
        const turnIds = this.positionTurnIds.get(candidatePositionId) ?? [];
        const turnIndex = turnIds.indexOf(turnId);
        if (turnIndex === -1) {
          continue;
        }
        frontierUpdates.set(
          candidatePositionId,
          Math.min(
            frontierUpdates.get(candidatePositionId) ??
              this.getFrontier(candidatePositionId),
            turnIndex
          )
        );
      }
    }

    this.applyTurnEffects(closure, 'undo');

    for (const [candidatePositionId, frontier] of frontierUpdates.entries()) {
      this.positionFrontiers.set(candidatePositionId, frontier);
    }
    beforePublish?.(closure);
    this.bumpFrontiers();

    if (RUN_RESTORATION_CONSISTENCY_CHECKS) {
      this.assertTurnStatusConsistency();
    }
    return closure;
  }

  redoPosition(
    positionId: number,
    beforePublish?: (closure: number[]) => void
  ): number[] {
    const closure = this.resolveRedoClosure(positionId);
    if (closure.length === 0) {
      return closure;
    }

    const frontierUpdates = new Map<number, number>();

    for (const turnId of closure) {
      recordProductionSubstrateStat('turnIndexLookups');
      const turn = this.turns.get(turnId);
      if (!turn) {
        continue;
      }

      for (const candidatePositionId of turn.__positionIds ?? []) {
        const turnIds = this.positionTurnIds.get(candidatePositionId) ?? [];
        const turnIndex = turnIds.indexOf(turnId);
        if (turnIndex === -1) {
          continue;
        }
        frontierUpdates.set(
          candidatePositionId,
          Math.max(
            frontierUpdates.get(candidatePositionId) ??
              this.getFrontier(candidatePositionId),
            turnIndex + 1
          )
        );
      }
    }

    this.applyTurnEffects(closure, 'redo');

    for (const [candidatePositionId, frontier] of frontierUpdates.entries()) {
      this.positionFrontiers.set(candidatePositionId, frontier);
    }
    beforePublish?.(closure);
    this.bumpFrontiers();

    if (RUN_RESTORATION_CONSISTENCY_CHECKS) {
      this.assertTurnStatusConsistency();
    }
    return closure;
  }

  canUndoAt(positionId: number): boolean {
    this.frontierVersion();
    return this.resolveContainedUndoClosure(positionId).length > 0;
  }

  canRedoAt(positionId: number): boolean {
    this.frontierVersion();
    return this.resolveContainedRedoClosure(positionId).length > 0;
  }

  undoAt(positionId: number): boolean {
    return this.observeOperation('undo', () => this.runUndoAt(positionId));
  }

  private runUndoAt(positionId: number): boolean {
    if (!this.canUndoAt(positionId)) {
      return false;
    }

    this.restoreVisibleStateToConfirmed();
    const closure = this.resolveContainedUndoClosure(positionId);
    if (closure.length === 0) {
      return false;
    }

    const seedTurnId = closure[0];
    if (seedTurnId === undefined) {
      return this.undoPosition(positionId).length > 0;
    }
    recordProductionSubstrateStat('turnIndexLookups');
    const seedPositionId =
      this.turns
        .get(seedTurnId)
        ?.__positionIds?.find((candidatePositionId) =>
          this.containsPosition(positionId, candidatePositionId)
        ) ?? positionId;
    return this.undoPosition(seedPositionId).length > 0;
  }

  redoAt(positionId: number): boolean {
    return this.observeOperation('redo', () => this.runRedoAt(positionId));
  }

  private runRedoAt(positionId: number): boolean {
    if (!this.canRedoAt(positionId)) {
      return false;
    }

    this.restoreVisibleStateToConfirmed();
    const closure = this.resolveContainedRedoClosure(positionId);
    if (closure.length === 0) {
      return false;
    }

    const seedTurnId = closure[0];
    if (seedTurnId === undefined) {
      return this.redoPosition(positionId).length > 0;
    }
    recordProductionSubstrateStat('turnIndexLookups');
    const seedPositionId =
      this.turns
        .get(seedTurnId)
        ?.__positionIds?.find((candidatePositionId) =>
          this.containsPosition(positionId, candidatePositionId)
        ) ?? positionId;
    return this.redoPosition(seedPositionId).length > 0;
  }

  private getLatestAppliedTurn(): CanonicalTurn<T> | undefined {
    let latestTurn: CanonicalTurn<T> | undefined;

    for (const [positionId, turnIds] of this.positionTurnIds.entries()) {
      recordProductionSubstrateStat('publicUndoPositionEntriesExamined');
      const frontier = this.getFrontier(positionId);
      if (frontier <= 0) {
        continue;
      }

      const turnId = turnIds[frontier - 1];
      recordProductionSubstrateStat('turnIndexLookups');
      const turn = this.turns.get(turnId);
      if (!turn) {
        continue;
      }

      if (
        !latestTurn ||
        (turn.historyIndex ?? -1) > (latestTurn.historyIndex ?? -1)
      ) {
        latestTurn = turn;
      }
    }

    return latestTurn;
  }

  private getEarliestUnappliedTurn(): CanonicalTurn<T> | undefined {
    let earliestTurn: CanonicalTurn<T> | undefined;

    for (const [positionId, turnIds] of this.positionTurnIds.entries()) {
      const frontier = this.getFrontier(positionId);
      if (frontier >= turnIds.length) {
        continue;
      }

      const turnId = turnIds[frontier];
      recordProductionSubstrateStat('turnIndexLookups');
      const turn = this.turns.get(turnId);
      if (!turn) {
        continue;
      }

      if (
        !earliestTurn ||
        (turn.historyIndex ?? Number.POSITIVE_INFINITY) <
          (earliestTurn.historyIndex ?? Number.POSITIVE_INFINITY)
      ) {
        earliestTurn = turn;
      }
    }

    return earliestTurn;
  }

  undoConfirmed(): boolean {
    return this.observeOperation('undo', () => this.runUndoConfirmed());
  }

  private runUndoConfirmed(): boolean {
    if (!this.canUndoConfirmed()) {
      return false;
    }

    this.restoreVisibleStateToConfirmed();

    const latestTurn = this.getLatestAppliedTurn();
    const seedPositionId = latestTurn?.__positionIds?.[0];

    if (latestTurn && seedPositionId !== undefined) {
      // The index moves with the frontiers, before either is published: a
      // synchronous watcher saw canUndo() change while the index was stale.
      this.undoPosition(seedPositionId, (closure) =>
        this.moveCurrentIndex(closure, 'undo')
      );
      return true;
    }

    return false;
  }

  /**
   * `getCurrentIndex()` is the latest APPLIED history entry (-1 when none):
   * the entry jumpTo() would land on to show the current state. Public
   * undo/redo is whole-tree, so the applied entries are a prefix of history
   * and this one number gives both step counts (back = index + 1, forward =
   * length - 1 - index). Only jumpTo and history changes moved it through
   * 15.4.3; undo() and redo() left it stale.
   *
   * Read off the closure the step just applied (undo: one before its earliest
   * entry; redo: its latest entry) rather than rescanning every entry's status,
   * so a step's logical work stays what the complexity audit pins.
   */
  private moveCurrentIndex(
    closure: readonly number[],
    direction: 'undo' | 'redo'
  ): void {
    let next: number | undefined;
    for (const turnId of closure) {
      const index = this.turns.get(turnId)?.historyIndex;
      if (index === undefined) continue;
      if (next === undefined) next = index;
      else
        next =
          direction === 'undo' ? Math.min(next, index) : Math.max(next, index);
    }
    if (next === undefined) return;
    if (direction === 'undo') next -= 1;
    if (next !== this.currentIndex) this.currentIndex = next;
  }

  undo(): boolean {
    return this.undoConfirmed();
  }

  // `skipsBackward()` / `skipsForward()` and `shouldSkip` were DELETED in 15.0.
  //
  // TOMBSTONE, because the deletion looked like navigation and was not. The
  // predicate asked "is the transition between these two states one the user
  // would recognise as a step?" — an ADMISSION question, asked late. The
  // navigation functions had no policy of their own: strip the predicate and
  // they reduce to `from - 1` and `from + 1`, which is what they are now.
  //
  // Moving the comparator from record time to read time (14.1.1) was a real
  // improvement over discarding entries on the hot path — it stopped an
  // O(state) predicate running per write, and stopped a wrong predicate losing
  // history irreversibly. But it treated deciding LATE as the problem, when the
  // problem was deciding at all: history should not have been recording the
  // transition in the first place.
  //
  // `undoable()` asks the same question on the correct side of the boundary. A
  // cursor move is not designated, so it never becomes a turn, so there is
  // nothing to skip past and no per-transition predicate to run.
  //
  // Do not reintroduce a read-time admission filter. If a future requirement
  // needs navigation among ALREADY-ADMITTED turns — "jump to the last turn that
  // touched X" — that is a different primitive and needs its own derivation.

  redo(): boolean {
    return this.redoConfirmed();
  }

  redoConfirmed(): boolean {
    return this.observeOperation('redo', () => this.runRedoConfirmed());
  }

  private runRedoConfirmed(): boolean {
    if (!this.canRedoConfirmed()) {
      return false;
    }

    this.restoreVisibleStateToConfirmed();

    const earliestTurn = this.getEarliestUnappliedTurn();
    const seedPositionId = earliestTurn?.__positionIds?.[0];

    if (earliestTurn && seedPositionId !== undefined) {
      this.redoPosition(seedPositionId, (closure) =>
        this.moveCurrentIndex(closure, 'redo')
      );
      return true;
    }

    return false;
  }

  getRestorationHistory(): RestorationHistoryEntry<T>[] {
    // Entry objects are copied, but STATE is handed over by reference.
    //
    // This used to `deepClone` every entry's state on every call — O(state x
    // entries) each time you asked, which is brutal for a devtools panel that
    // reads history on a timer, and it discarded the structural sharing between
    // entries at the API boundary: two entries differing in one leaf came back
    // as two full, unrelated copies.
    //
    // Snapshots are immutable by contract and frozen in dev, so the copy bought
    // nothing that the contract does not already give.
    this.historyVersion();
    const states = this.materializeHistoricalStates();
    return this.history.map((entry, index) => {
      const state = states[index] ?? entry.state;
      if (state === undefined) {
        throw new Error(
          `Historical state ${entry.id} could not be materialized`
        );
      }
      const { entryId, __transactionId, ...existingView } = entry;
      // Lineage belongs to the dedicated reader; preserve the existing history
      // API's runtime shape as well as its declared type.
      void entryId;
      void __transactionId;
      return { ...existingView, state };
    });
  }

  private materializeHistoricalStates(): T[] {
    if (this.history.length === 0) {
      return [];
    }
    const bindings = new Map<number, CollectionTransitionTargetBinding>();
    visitTree(this.tree.$, (node) => {
      const binding = (
        node as {
          __prepareTransitionTarget?: CollectionTransitionTargetBinding;
        }
      ).__prepareTransitionTarget;
      if (binding) {
        bindings.set(binding.owner, binding);
      }
      return undefined;
    });
    let natural = snapshotState(this.tree.$ as unknown as TreeNode<T>) as T;
    const collections = new Map(
      [...bindings].map(([owner, binding]) => [owner, binding.readSource()])
    );
    const states = new Array<T>(this.history.length);
    const historyIndexByTurnId = new Map(
      this.history.map((turn, index) => [turn.id, index])
    );

    const applyDetachedTurn = (
      turn: CanonicalTurn<T>,
      direction: 'undo' | 'redo'
    ): void => {
      const effects =
        direction === 'undo'
          ? [...(turn.__effects ?? [])].reverse()
          : [...(turn.__effects ?? [])];
      const reversalEffects = placeFieldReversalsWhileRowsExist(
        effects.map((effect) => toReversalEffect(effect, direction))
      );
      const collectionOwners = new Set([
        ...(turn.__orderDeltas ?? []).map(({ owner }) => owner),
        ...reversalEffects
          .filter(({ subjectId }) => typeof subjectId === 'number')
          .map(({ owner }) => owner),
      ]);
      const target = deriveDeclarativeTransitionTarget({
        collections: [...collectionOwners].map((owner) => {
          const source = collections.get(owner);
          if (!source) {
            throw new Error(
              `Historical materialization has no collection ${owner}`
            );
          }
          return source;
        }),
        effects: reversalEffects,
        orderDeltas: turn.__orderDeltas,
        orderEndpoint: direction === 'undo' ? 'before' : 'after',
      });
      for (const [owner, collection] of target.collections) {
        collections.set(owner, collection);
        const binding = bindings.get(owner);
        if (!binding) {
          throw new Error(`Historical materialization has no binding ${owner}`);
        }
        natural = setDetachedNaturalValue(natural, binding.ownerPath, {
          all: collection.order.map((subjectId) => {
            const subject = collection.subjects.find(
              (candidate) => candidate.subject === subjectId
            );
            if (!subject) {
              throw new Error(
                `Historical materialization lost subject ${subjectId}`
              );
            }
            return subject.value;
          }),
        });
      }
      for (const effect of reversalEffects) {
        if (effect.structural !== undefined || effect.subjectId !== undefined) {
          continue;
        }
        if (typeof effect.path !== 'string') {
          throw new Error('Historical scalar effect has no path');
        }
        natural = effect.plainBranchMembership
          ? applyPlainBranchMemberSnapshot(
              this.tree.$,
              natural,
              effect.owner,
              effect.plainBranchMembership.after,
              effect.after
            )
          : setDetachedNaturalValue(natural, effect.path, effect.after);
      }
    };

    const unappliedTail = this.history.filter((turn) =>
      this.isTemporalViewActive
        ? turn.historyIndex > this.currentIndex
        : this.getTurnStatus(turn.id) === 'unapplied'
    );
    for (const turn of unappliedTail) {
      applyDetachedTurn(turn, 'redo');
    }

    for (let index = this.historicalEvents.length - 1; index >= 0; index -= 1) {
      const event = this.historicalEvents[index];
      if (event.boundaryTurnId !== undefined) {
        const historyIndex = historyIndexByTurnId.get(event.boundaryTurnId);
        if (historyIndex !== undefined) {
          states[historyIndex] = natural;
        }
      }
      const reversalEffects = placeFieldReversalsWhileRowsExist(
        [...event.effects]
          .reverse()
          .map((effect) => toReversalEffect(effect, 'undo'))
      );
      const collectionOwners = new Set([
        ...event.orderDeltas.map(({ owner }) => owner),
        ...reversalEffects
          .filter(({ subjectId }) => typeof subjectId === 'number')
          .map(({ owner }) => owner),
      ]);
      const collectionSources = [...collectionOwners].map((owner) => {
        const source = collections.get(owner);
        if (!source) {
          throw new Error(
            `Historical materialization has no collection ${owner}`
          );
        }
        return source;
      });
      const target = deriveDeclarativeTransitionTarget({
        collections: collectionSources,
        effects: reversalEffects,
        orderDeltas: event.orderDeltas,
        orderEndpoint: 'before',
      });
      for (const [owner, collection] of target.collections) {
        collections.set(owner, collection);
        const binding = bindings.get(owner);
        if (!binding) {
          throw new Error(`Historical materialization has no binding ${owner}`);
        }
        natural = setDetachedNaturalValue(natural, binding.ownerPath, {
          all: collection.order.map((subjectId) => {
            const subject = collection.subjects.find(
              (candidate) => candidate.subject === subjectId
            );
            if (!subject) {
              throw new Error(
                `Historical materialization lost subject ${subjectId}`
              );
            }
            return subject.value;
          }),
        });
      }
      for (const effect of reversalEffects) {
        if (effect.structural !== undefined || effect.subjectId !== undefined) {
          continue;
        }
        if (typeof effect.path !== 'string') {
          throw new Error('Historical scalar effect has no path');
        }
        natural = effect.plainBranchMembership
          ? applyPlainBranchMemberSnapshot(
              this.tree.$,
              natural,
              effect.owner,
              effect.plainBranchMembership.after,
              effect.after
            )
          : setDetachedNaturalValue(natural, effect.path, effect.after);
      }
    }

    return states;
  }

  /** Advanced by every reset, so an operation can tell history was replaced under it. */
  private resetGeneration = 0;

  resetRestorationHistory(): void {
    this.resetGeneration++;
    // Before `nextTurnId` goes back to 1. Owner strings are derived from turn
    // ids, so releasing after the counter reset would leave the old claims
    // attached to owners the next entries are about to mint.
    this.releaseAllOwnedRestorationClaims();
    this.history = [];
    this.turns.clear();
    this.pendingTurns.clear();
    this.positionTurnIds.clear();
    this.positionFrontiers.clear();
    this.historicalEvents = [];
    this.nextHistoricalOrdinal = 1;
    this.nextTurnId = 1;
    this.isTemporalViewActive = false;
    this.bumpRestorationHistory();
    this.currentIndex = -1;
    this.publishObservation({ kind: 'history-changed' });
  }

  jumpTo(index: number): boolean {
    return this.observeOperation('jump', () => this.runJumpTo(index));
  }

  private runJumpTo(index: number): boolean {
    if (index < 0 || index >= this.history.length) {
      return false;
    }

    this.restoreVisibleStateToConfirmed();

    const turnIdsToUndo = this.history
      .filter(
        (turn) =>
          turn.historyIndex > index && this.getTurnStatus(turn.id) === 'applied'
      )
      .sort((left, right) => right.historyIndex - left.historyIndex)
      .map(({ id }) => id);
    const turnIdsToRedo = this.history
      .filter(
        (turn) =>
          turn.historyIndex <= index &&
          this.getTurnStatus(turn.id) === 'unapplied'
      )
      .sort((left, right) => left.historyIndex - right.historyIndex)
      .map(({ id }) => id);

    const generation = this.resetGeneration;
    this.applyDirectedTurnTransition(turnIdsToUndo, turnIdsToRedo);

    // A synchronous subscriber may reset history while the jump applies. The
    // jump still happened; its index belongs to history that no longer exists.
    if (this.resetGeneration !== generation) return true;
    this.currentIndex = index;
    this.isTemporalViewActive = true;
    return true;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  private hasAppliedConfirmedTurns(): boolean {
    for (const [positionId] of this.positionTurnIds.entries()) {
      recordProductionSubstrateStat('publicUndoPositionEntriesExamined');
      if (this.getFrontier(positionId) > 0) {
        return true;
      }
    }
    return false;
  }

  private hasUnappliedConfirmedTurns(): boolean {
    for (const [positionId, turnIds] of this.positionTurnIds.entries()) {
      if (this.getFrontier(positionId) < turnIds.length) {
        return true;
      }
    }
    return false;
  }
  canUndoConfirmed(): boolean {
    this.frontierVersion();
    return this.hasAppliedConfirmedTurns();
  }

  canRedoConfirmed(): boolean {
    this.frontierVersion();
    return this.hasUnappliedConfirmedTurns();
  }

  canUndo(): boolean {
    return this.canUndoConfirmed();
  }

  canRedo(): boolean {
    return this.canRedoConfirmed();
  }

  /**
   * Restore state without triggering restoration middleware
   */
  // ⚠️ THE `positionIds` PARAMETER WAS DELETED IN 15.0 — it existed only to feed
  // `WriteMetadata.positionIds`, proven duplicate. `subjectIds` REMAINS: on the
  // `interceptLeafSignals` replay route the ambient copy is the only carrier of
  // the EFFECT's subject, and the node's `__subjectIds` answers a different
  // question (`[1, 2]` for a rekeyed row where the effect names `[1]`).
  // ⚠️ BOTH IDENTITY PARAMETERS ARE GONE (15.0). They existed only to feed
  // `WriteMetadata.positionIds`/`subjectIds`, deleted for having writers and no
  // production readers. The history-entry fields they came from are untouched:
  // `restorationSubjectIds` still feeds the claims retention authority and
  // `__positionIds` still has ~20 readers here.
  private restoreState(state: T): void {
    // Tag every leaf write performed during this undo/redo/jump with
    // `origin: 'restoration'`. Enhancers (validation, guardrails) read this
    // via `getActiveWriteContext()` and can suppress side effects for replays.
    withWriteContext(
      {
        ...(getActiveWriteContext() ?? {}),
        intent: 'system',
        origin: 'restoration',
        participation: 'realized',
      },
      () => {
        if (this.restoreStateFn) {
          this.restoreStateFn(state);
        } else {
          // Fallback if no restoration function provided
          rootAuthorityFor(this.tree).replace(state);
        }
      }
    );
  }

  private applyTurnEffects(
    turnIds: number[],
    direction: 'undo' | 'redo'
  ): void {
    if (!this.applyEffectsFn) {
      return;
    }

    const effects: TurnEffect[] = [];
    const orderDeltas: CollectionOrderDelta[] = [];
    for (const turnId of turnIds) {
      recordProductionSubstrateStat('turnIndexLookups');
      const turn = this.turns.get(turnId);
      if (!turn) {
        continue;
      }
      const turnEffects = turn.__effects ?? [];
      orderDeltas.push(
        ...(turn.__orderDeltas ?? []).map(cloneCollectionOrderDelta)
      );
      recordProductionSubstrateStat(
        'publicUndoTurnEffectsExamined',
        turnEffects.length
      );
      if (direction === 'undo') {
        for (let i = turnEffects.length - 1; i >= 0; i--) {
          effects.push(turnEffects[i]);
        }
      } else {
        appendAll(effects, turnEffects);
      }
    }

    for (const effect of effects) {
      if (!this.isSupportedEffect(effect)) {
        throw new Error(`Unsupported scoped undo effect at ${effect.path}`);
      }
    }

    const entryIds = this.entryIdsFor(turnIds);
    const applyEffects = this.applyEffectsFn;
    this.applyReversal(() =>
      applyEffects([{ effects, direction, orderDeltas }])
    );
    this.recordAppliedEntries(entryIds);
  }

  private applyDirectedTurnTransition(
    turnIdsToUndo: number[],
    turnIdsToRedo: number[]
  ): void {
    if (!this.applyEffectsFn) {
      return;
    }
    const applications: DirectedTurnApplication[] = [];
    for (const [turnIds, direction] of [
      [turnIdsToUndo, 'undo'],
      [turnIdsToRedo, 'redo'],
    ] as const) {
      if (turnIds.length === 0) {
        continue;
      }
      const effects: TurnEffect[] = [];
      const orderDeltas: CollectionOrderDelta[] = [];
      for (const turnId of turnIds) {
        recordProductionSubstrateStat('turnIndexLookups');
        const turn = this.turns.get(turnId);
        if (!turn) {
          continue;
        }
        const turnEffects = turn.__effects ?? [];
        if (direction === 'undo') {
          for (let i = turnEffects.length - 1; i >= 0; i--)
            effects.push(turnEffects[i]);
        } else {
          appendAll(effects, turnEffects);
        }
        orderDeltas.push(
          ...(turn.__orderDeltas ?? []).map(cloneCollectionOrderDelta)
        );
      }
      applications.push({ effects, orderDeltas, direction });
    }
    if (applications.length > 0) {
      const entryIds = this.entryIdsFor([...turnIdsToUndo, ...turnIdsToRedo]);
      const applyEffects = this.applyEffectsFn;
      this.applyReversal(() => applyEffects(applications));
      this.recordAppliedEntries(entryIds);
    }
  }

  private isSupportedEffect(effect: TurnEffect): boolean {
    switch (effect.kind) {
      case 'set':
        if (effect.plainBranchMembership) {
          return canRealizePlainBranchMember(this.tree.$, effect.position);
        }
        // A registered terminal location restores one value, regardless of
        // its payload's shape. Object values do not make it a branch.
        if (
          effect.subject === undefined &&
          (getTreeScalarSlotRuntime(this.tree) ??
            getTreeScalarSlotRuntime(this.tree.$))?.resolveScalarSlot(
            effect.position
          ) !== undefined
        ) {
          return true;
        }
        // A row FIELD (subject + field path) is realized through its subject
        // whatever the value's shape: an object or array field added, dropped
        // or replaced is one effect carrying the whole value. Requiring scalars
        // here refused every such undo ("Unsupported scoped undo effect at
        // rows.a.nest"), while transactions() rolled the same effects back.
        if (
          effect.subject !== undefined &&
          effect.fieldSegments !== undefined &&
          effect.fieldSegments.length > 0
        ) {
          return true;
        }
        return (
          (this.isScalarValue(effect.before) &&
            this.isScalarValue(effect.after)) ||
          (effect.subject === undefined && effect.ownerPath !== effect.path)
        );
      case 'remove':
        return effect.subject !== undefined;
      case 'add':
        return effect.subject !== undefined;
      case 'rekey':
        return effect.subject !== undefined;
    }
  }

  private isScalarValue(value: unknown): boolean {
    return (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    );
  }

  // ==========================================================================
  // RESTORATION CLAIMS — the single boundary
  // ==========================================================================
  //
  // A retained restoration history entry is a REASON to keep retired subjects alive. It
  // stops being one at exactly five moments, and before this there was no code
  // at any of them: max-size eviction, redo truncation on a new write after an
  // undo, scoped redo truncation, `resetRestorationHistory()`, and destroy (which routes
  // through `resetRestorationHistory()`). Every one of them dropped the entry and left the
  // subjects it named pinned forever — 945 B each, 90% of the measured slope.
  //
  // Every removal path calls `releaseRetainedRestorationEntries`. Nothing else may
  // remove an entry from `this.history`.

  private restorationClaimOwner(turnId: number): RestorationClaimOwner {
    // `<system>:<id>` so restoration and transactions cannot collide in the
    // shared registry. NOT a history index — indices shift when the window
    // slides, and a shifted index re-points a live claim at another record.
    //
    // Turn ids restart at 1 after `resetRestorationHistory()`, so an owner string CAN be
    // reused across a reset. That is safe only because the reset releases every
    // owner before the counter goes back; if that order ever inverts, a new
    // entry inherits a dead entry's claims.
    return `restoration:${turnId}`;
  }

  /** Claim the subjects an entry needs kept alive. Idempotent per entry. */
  private retainRestorationClaims(entry: CanonicalTurn<T>): void {
    const claims = getOrCreateSubjectRestorationClaims(this.tree);
    if (!claims) {
      return;
    }
    claims.retain(
      this.restorationClaimOwner(entry.id),
      entry.restorationSubjectIds ?? []
    );
  }

  /**
   * THE boundary. Releases these entries' claims and offers whatever that left
   * unowned to the physical layer.
   *
   * The offer is where retention actually ends. The sink re-checks the registry
   * per subject, so a subject another owner still holds — a second entry, a
   * pending transaction — is skipped rather than freed; that check lives there
   * rather than here because a caller that had to remember it would forget.
   */
  private releaseRetainedRestorationEntries(
    entries: readonly CanonicalTurn<T>[]
  ): readonly number[] {
    const claims = getOrCreateSubjectRestorationClaims(this.tree);
    if (!claims || entries.length === 0) {
      return [];
    }
    const newlyUnowned: number[] = [];
    for (const entry of entries) {
      appendAll(
        newlyUnowned,
        claims.release(this.restorationClaimOwner(entry.id))
      );
    }
    if (newlyUnowned.length > 0) {
      const released =
        getOrCreateSubjectReclamationSink(this.tree)?.offerUnclaimed(
          newlyUnowned
        ) ?? [];
      if (released.length > 0) {
        // The realization descriptors are per-SUBJECT restoration state, read
        // only by reversal planning and keyed only by subject id, and nothing
        // pruned them: they grew four entries per retired subject and were the
        // whole remaining retention slope once the entity layer plateaued.
        // Their lifetime is the subject's claim, so they end here with it.
        const descriptors =
          getTreeRealizationDescriptors(this.tree) ??
          getTreeRealizationDescriptors(
            (this.tree as unknown as { $?: unknown }).$
          );
        if (descriptors) {
          forgetSubjectsInTreeRealizationDescriptors(descriptors, released);
        }
      }
    }
    return newlyUnowned;
  }

  /**
   * Release every claim THIS manager holds — destroy, and the reset path.
   *
   * Derived from `this.history` rather than from a second ledger: the owners a
   * manager holds are exactly the entries it retains, so there is no bookkeeping
   * that can drift out of step with the array. Never `releaseAll()`, which
   * would also free claims a `transactions()` enhancer on the same tree holds.
   */
  private releaseAllOwnedRestorationClaims(): readonly number[] {
    return this.releaseRetainedRestorationEntries([...this.history]);
  }

  /** Test-only inventory: what this tree currently pins, and for whom. */
  __restorationClaimInventoryForTesting(): {
    owners: number;
    claimedSubjects: number;
    subjects: number[];
  } {
    const claims = getOrCreateSubjectRestorationClaims(this.tree);
    if (!claims) {
      return { owners: 0, claimedSubjects: 0, subjects: [] };
    }
    const snapshot = claims.snapshot();
    return {
      owners: snapshot.owners,
      claimedSubjects: snapshot.claimedSubjects,
      subjects: [...claims.claimedSubjects()].sort((a, b) => a - b),
    };
  }

  private rebuildTurnIndexes(): void {
    const appliedTurnIds = new Set<number>();
    for (const [positionId, turnIds] of this.positionTurnIds.entries()) {
      const frontier = this.getFrontier(positionId);
      for (let i = 0; i < frontier; i++) {
        const turnId = turnIds[i];
        if (turnId !== undefined) {
          appliedTurnIds.add(turnId);
        }
      }
    }
    const previousTurnIds = new Set(this.turns.keys());

    this.turns.clear();
    this.positionTurnIds.clear();
    this.positionFrontiers.clear();

    this.history.forEach((entry, historyIndex) => {
      entry.historyIndex = historyIndex;
      this.turns.set(entry.id, entry);

      for (const positionId of entry.__positionIds ?? []) {
        const turnIds = this.positionTurnIds.get(positionId);
        if (turnIds) {
          turnIds.push(entry.id);
        } else {
          this.positionTurnIds.set(positionId, [entry.id]);
        }
      }
    });

    this.restoreFrontiersFromAppliedTurns(appliedTurnIds, previousTurnIds);
    this.bumpFrontiers();
  }

  private restoreFrontiersFromAppliedTurns(
    appliedTurnIds: Set<number>,
    previousTurnIds: Set<number>
  ): void {
    for (const [positionId, turnIds] of this.positionTurnIds.entries()) {
      let frontier = 0;
      while (frontier < turnIds.length) {
        const turnId = turnIds[frontier];
        const wasApplied = appliedTurnIds.has(turnId);
        const isNewTurn = !previousTurnIds.has(turnId);
        if (!wasApplied && !isNewTurn) {
          break;
        }
        frontier++;
      }
      this.positionFrontiers.set(positionId, frontier);
    }
  }

  private hasScopedRedoFuture(): boolean {
    for (const [positionId, turnIds] of this.positionTurnIds.entries()) {
      if (this.getFrontier(positionId) < turnIds.length) {
        return true;
      }
    }
    return false;
  }

  private truncateScopedRedoFuture(): void {
    const survivingIds = new Set<number>();
    for (const [positionId, turnIds] of this.positionTurnIds.entries()) {
      const frontier = this.getFrontier(positionId);
      for (let i = 0; i < frontier; i++) {
        survivingIds.add(turnIds[i]);
      }
    }

    const surviving: CanonicalTurn<T>[] = [];
    const discarded: CanonicalTurn<T>[] = [];
    for (const entry of this.history) {
      const indexed = (entry.__positionIds?.length ?? 0) > 0;
      (!indexed || survivingIds.has(entry.id) ? surviving : discarded).push(
        entry
      );
    }
    this.history = surviving;
    const discardedTurnIds = new Set(discarded.map(({ id }) => id));
    this.historicalEvents = this.historicalEvents.filter(
      (event) =>
        event.boundaryTurnId === undefined ||
        !discardedTurnIds.has(event.boundaryTurnId)
    );
    this.releaseRetainedRestorationEntries(discarded);
    this.currentIndex = this.history.length - 1;
    this.bumpRestorationHistory();
    this.rebuildTurnIndexes();
    this.pruneHistoricalEventsBeforeOldestBoundary();
  }
}

// TOMBSTONE: `ScopedHistoryAuthority` / `createScopedHistoryAuthority`.
//
// A private `RestorationManager` over a standalone snapshot signal, built by
// `ed09e864` so form history could share the causal engine. Its only consumer
// was `trackHistory()`, and TH-DEL took that; `dead-exports` found it the same
// hour, unreachable from every entry point and every import.
//
// Not preserved "in case": a second history engine over a synthetic one-node
// tree is exactly the shape TH-0 measured as harmful — a restoration system
// whose writes another restoration system reads as new authored mutations.

/**
 * Enhances a SignalTree with comprehensive restoration capabilities.
 *
 * Adds undo/redo for explicitly designated turns and bounded history management.
 * Automatically tracks state changes and provides methods to navigate through
 * the application's state history with configurable limits and optimizations.
 *
 * @template T - The state object type
 * @param config - Configuration options for restoration behavior
 * @returns Function that enhances a SignalTree with restoration capabilities
 *
 * @example
 * ```typescript
 * // Basic restoration enhancement
 * const store = signalTree({ count: 0, text: '' }, { enhancers: [restoration()] });
 *
 * // Make some changes
 * store.count.set(1);
 * store.text.set('hello');
 * store.count.set(2);
 *
 * // Access restoration interface
 * const restoration = store.__restoration;
 *
 * // Navigate history
 * console.log(restoration.canUndo()); // true
 * restoration.undo(); // count: 1, text: 'hello'
 * restoration.undo(); // count: 1, text: ''
 * restoration.undo(); // count: 0, text: ''
 *
 * restoration.redo(); // count: 1, text: ''
 * console.log(restoration.canRedo()); // true
 * ```
 *
 * @example
 * ```typescript
 * // Advanced configuration
 * const store = signalTree({
 *   document: { title: '', content: '' },
 *   settings: { theme: 'light' }
 * }, { enhancers: [restoration({ maxHistorySize: 50 })]});
 *
 * // Named actions with metadata
 * store.update(() => ({ document: { title: 'New Title' } }), 'update_title');
 *
 * // View restoration snapshots
 * const history = store.__restoration.getRestorationHistory();
 * console.log(history[0].state);
 * ```
 */

/**
 * @internal Retained collection pointers above which history is worth a word.
 *
 * The unit is the one that actually costs memory: a restoration history entry retains one
 * POINTER per entity in every included collection, so retention is
 * `entries x collection width`, not either alone. RE-MEASURED for 14.1.1 with
 * `tools/bench-retention-arms.mjs` (50 recorded writes, heap baselined after
 * seeding), which comes out at ~8 bytes per retained pointer — a 64-bit pointer,
 * not the ~10 this was originally calibrated against:
 *
 *     1,000 rows x 50 entries =    50k pointers ->  0.51MB  (~10.5 B/ptr)
 *    10,000 rows x 50 entries =   500k pointers ->  3.95MB  (~8.3 B/ptr)
 *    50,000 rows x 50 entries = 2,500k pointers -> 19.38MB  (~8.1 B/ptr)
 *
 * The 1,000-row row reads high because fixed per-entry overhead is a large
 * fraction of a 0.5MB total; the linear model holds from ~10k up.
 *
 * This is a FLOOR, not a worst case: it is what touching the collection at all
 * costs, and one changed row costs the same as fifty different ones. Each
 * CHANGED row adds ~40 bytes on top, so an all-rows write at 50k retains
 * 114.77MB — 5.9x the floor.
 *
 * 500k is therefore ~4MB of history spent purely on collection arrays, which is
 * where "silently heavier forever" stops being theoretical. Deriving the
 * threshold from retention rather than from a row count also means a small
 * collection with a long history and a big one with a short history are judged
 * by the same standard — a row-count threshold gets both wrong.
 */
export function restoration(
  config: RestorationConfig = {}
): Enhancer<RestorationMethods> {
  const { enabled = true } = config;
  const enhancerFn = <T>(
    tree: ISignalTree<T>
  ): ISignalTree<T> & RestorationMethods => {
    // Disabled (noop) path
    if (!enabled) {
      const noopMethods = {
        undo(): void {
          /* disabled */
        },
        redo(): void {
          /* disabled */
        },
        transaction(fn: () => void) {
          fn();
          return {
            confirm(): void {
              /* disabled */
            },
            rollback(): void {
              /* disabled */
            },
          };
        },
        canUndo(): boolean {
          return false;
        },
        canRedo(): boolean {
          return false;
        },
        getRestorationHistory(): RestorationHistoryEntry<T>[] {
          return [];
        },
        resetRestorationHistory(): void {
          /* disabled */
        },
        jumpTo(_index: number): void {
          void _index; /* disabled */
        },
        getCurrentIndex(): number {
          return -1;
        },
      };

      return Object.assign(tree, noopMethods) as unknown as ISignalTree<T> &
        RestorationMethods;
    }
    const rootAuthority = rootAuthorityFor(tree);

    // Flag to prevent restoration during restoration
    let isRestoring = false;

    const realizationDescriptors =
      getTreeRealizationDescriptors(tree) ??
      getTreeRealizationDescriptors(tree.$) ??
      (new Map() as TreeRealizationDescriptorStore);
    defineTreeRealizationDescriptors(
      tree as unknown as object,
      realizationDescriptors
    );
    defineTreeRealizationDescriptors(
      (tree as ISignalTree<T>).$ as unknown as object,
      realizationDescriptors
    );

    const realizationPort =
      getTreeRealizationPort(tree) ??
      getTreeRealizationPort(tree.$) ??
      createTreeRealizationAdapter({
        tree: tree as unknown as ISignalTree<object>,
        descriptors: realizationDescriptors,
      });
    const scalarSlotRuntime =
      getTreeScalarSlotRuntime(tree) ?? getTreeScalarSlotRuntime(tree.$);
    defineTreeRealizationPort(tree as unknown as object, realizationPort);
    defineTreeRealizationPort(
      (tree as ISignalTree<T>).$ as unknown as object,
      realizationPort
    );

    const applyTurnEffectsThroughRealizationPort = (
      applications: DirectedTurnApplication[]
    ): void => {
      if (
        pendingRestorationFootprints.size > 0 ||
        pendingTransactions.size > 0
      ) {
        const touches = applications.flatMap(({ effects, orderDeltas }) => [
          ...effects.map(restorationFootprint),
          ...orderDeltas.map(({ owner }) => ({
            position: owner,
            path:
              positionRegistry?.collectionPathFor(owner as PositionId) ?? '',
            structural: true,
          })),
        ]);
        const pendingTouches = [
          ...pendingRestorationFootprints.values(),
          ...[...pendingTransactions.values()].map((bucket) => [
            ...[...bucket.effects.values()].map(restorationFootprint),
            ...[...bucket.collectionOrders.values()].map((order) => ({
              position: order.owner,
              path: order.ownerPath,
              structural: true,
            })),
          ]),
        ];
        for (const pending of pendingTouches) {
          const conflict = touches.find((touch) =>
            pending.some((other) => restorationFootprintsOverlap(touch, other))
          );
          if (conflict) {
            throw restorationRefusal(
              `ST1034: restoration refused — '${conflict.path}' overlaps a pending ` +
                'transaction. Settle that transaction before retrying. Nothing ' +
                'was changed; the history position is unmoved.'
            );
          }
        }
      }
      // A row's field reversals land after its re-add. Capture order is not
      // chronological — rekey-then-remove composes into one removal that keeps
      // the rekey's EARLIER slot — so reversing it put the field reversal
      // before the row was back, and undo refused as structural drift.
      const reversalEffects = placeFieldReversalsWhileRowsExist(
        applications.flatMap((application) =>
          application.effects.map((effect) =>
            toReversalEffect(effect, application.direction)
          )
        )
      );
      const orderDeltas = applications.flatMap(
        (application) => application.orderDeltas
      );
      const orderEndpoints = new Map<number, 'before' | 'after'>();
      for (const application of applications) {
        for (const delta of application.orderDeltas) {
          const endpoint =
            application.direction === 'undo' ? 'before' : 'after';
          const existing = orderEndpoints.get(delta.owner);
          if (existing && existing !== endpoint) {
            throw new Error(
              'Declarative transition cannot apply both order endpoints for one owner'
            );
          }
          orderEndpoints.set(delta.owner, endpoint);
        }
      }
      const usesDeclarativeTarget =
        (applications.length > 1 ||
          orderDeltas.length > 0 ||
          requiresDeclarativeStructuralTarget(reversalEffects)) &&
        reversalEffects.every(
          (effect) =>
            typeof effect.subjectId === 'number' ||
            effect.structural === undefined
        );
      const applyDeclarativeTarget = (): void => {
        const deltaOwners = new Set(orderDeltas.map(({ owner }) => owner));
        if (deltaOwners.size !== orderDeltas.length) {
          throw new Error(
            'Declarative order replay requires transition-level delta composition'
          );
        }
        const targetOwners = new Set([
          ...deltaOwners,
          ...reversalEffects
            .filter(({ subjectId }) => typeof subjectId === 'number')
            .map(({ owner }) => owner),
        ]);
        const conflictingOrderOwner = [...targetOwners].find((owner) =>
          externalOrderOwners.has(owner)
        );
        if (conflictingOrderOwner !== undefined) {
          throw restorationRefusal(
            `ST1034: restoration refused — collection order ${conflictingOrderOwner} ` +
              'changed after the operation being reversed. Nothing was changed; ' +
              'the history position is unmoved.'
          );
        }
        const bindings = new Map<number, CollectionTransitionTargetBinding>();
        visitTree((tree as ISignalTree<T>).$, (node) => {
          const binding = (
            node as {
              __prepareTransitionTarget?: CollectionTransitionTargetBinding;
            }
          ).__prepareTransitionTarget;
          if (binding) {
            bindings.set(binding.owner, binding);
          }
          return undefined;
        });
        const sources = [...targetOwners].map((owner) => {
          const binding = bindings.get(owner);
          if (!binding) {
            throw new Error(`Declarative order replay has no binding ${owner}`);
          }
          return binding.readSource();
        });
        const target = deriveDeclarativeTransitionTarget({
          collections: sources,
          effects: reversalEffects,
          orderDeltas,
          orderEndpoints,
        });
        const scalarBinding: ScalarTransitionTargetBinding | undefined =
          scalarSlotRuntime
            ? {
                prepareTarget(scalars) {
                  const frame = scalarSlotRuntime.beginFrame();
                  for (const [owner, value] of scalars) {
                    const slot = scalarSlotRuntime.resolveScalarSlot(owner);
                    if (slot === undefined) {
                      frame.discard();
                      throw new Error(
                        `Declarative scalar target has no slot ${owner}`
                      );
                    }
                    frame.set(slot, value);
                  }
                  let result: ReturnType<typeof frame.commit> | undefined;
                  return {
                    install(): void {
                      result = frame.commit({
                        advanceRevision: false,
                        publish: false,
                      });
                    },
                    publish(): void {
                      if (!result) {
                        throw new Error(
                          'Declarative scalar target published before installation'
                        );
                      }
                      scalarSlotRuntime.publishPrepared(result);
                    },
                  };
                },
              }
            : undefined;
        const prepared = prepareDeclarativeTransitionInstallation(
          target,
          bindings,
          scalarBinding,
          {
            prepareTarget: (members) =>
              preparePlainBranchMembers(tree.$, members),
          }
        );
        isRestoring = true;
        try {
          const apply = () =>
            withWriteContext(
              {
                origin: 'restoration',
                ownerId: getPositionRegistry(tree.$)?.id,
              },
              () => prepared.install()
            );
          const releaseMembership = holdEntityMembershipDelivery(tree.$);
          try {
            applyInInvalidationGroup(tree.$, apply);
          } finally {
            releaseMembership();
          }
        } finally {
          isRestoring = false;
        }
      };
      // RESTORE-P0 P0-C — world-relative validity, checked BEFORE any mutation
      // and before the cursor moves, so a refused restoration leaves the state
      // and the history position exactly as they were.
      //
      // The rule is provenance-based, not value-based: refuse only when the
      // location currently holds EXTERNAL truth that this restoration is not
      // reversing. A location holding a later AUTHORED value is fine — that is
      // what a closure undo looks like mid-flight.
      const readNested = (
        source: unknown,
        segments: readonly string[]
      ): unknown => {
        let cursor = source;
        for (const segment of segments) {
          if (cursor === null || typeof cursor !== 'object') return undefined;
          cursor = (cursor as Record<string, unknown>)[segment];
        }
        return cursor;
      };

      const externalConflict = ((): ReversalRefusal | undefined => {
        for (const effect of reversalEffects) {
          if (effect.subjectId !== undefined || effect.structural !== undefined)
            continue;
          const truth = externalMembershipTruth.get(effect.owner);
          if (!truth) continue;
          const current = readPlainBranchMember(tree.$, effect.owner);
          if (!current || current.present !== truth.present) continue;
          const targetPresent = effect.plainBranchMembership?.after ?? true;
          // Presence has its own authority. A fresh branch snapshot is not
          // evidence that the realized membership has been superseded.
          if (
            targetPresent !== truth.present ||
            (targetPresent &&
              current.present &&
              deepEqual(current.value, truth.value) &&
              !deepEqual(effect.after, truth.value))
          ) {
            return {
              kind: 'value-drift',
              path: effect.path ?? '',
              current: truth.value,
              expected: effect.after,
            };
          }
        }

        if (
          externalTruthByPath.size === 0 &&
          externalTruthBySubject.size === 0
        ) {
          return undefined;
        }
        for (const effect of reversalEffects) {
          if (effect.structural !== undefined) continue;
          const path = effect.path;
          if (typeof path !== 'string') continue;

          // Tree-level scalar: the path-keyed index resolves directly.
          if (externalTruthByPath.has(path)) {
            const live = resolveLiveNodeAtPath(path);
            if (typeof live === 'function') {
              const current = (live as () => unknown)();
              if (
                Object.is(current, externalTruthByPath.get(path)) &&
                !Object.is(current, effect.after)
              ) {
                return {
                  kind: 'value-drift',
                  path,
                  current,
                  expected: effect.after,
                };
              }
              continue;
            }
          }

          // Entity notifications contain a row snapshot, but only changed
          // fields acquire external provenance. Unchanged siblings stay authored.
          const subjectKey = subjectTruthKey(effect.owner, effect.subjectId);
          if (subjectKey === undefined) continue;
          const rowTruth = externalTruthBySubject.get(subjectKey);
          if (!rowTruth) continue;
          const fieldPath = effect.fieldSegments;
          if (!fieldPath) continue;
          for (const {
            segments: externalPath,
            value,
          } of rowTruth.fields.values()) {
            if (!fieldSegmentsOverlap(fieldPath, externalPath)) continue;
            const current =
              fieldPath.length > externalPath.length
                ? readNested(value, fieldPath.slice(externalPath.length))
                : value;
            const expected =
              externalPath.length > fieldPath.length
                ? readNested(effect.after, externalPath.slice(fieldPath.length))
                : effect.after;
            if (!Object.is(current, expected)) {
              return { kind: 'value-drift', path, current, expected };
            }
          }
        }
        return undefined;
      })();

      const refusal =
        externalConflict ??
        (usesDeclarativeTarget
          ? undefined
          : realizationPort.validateEffects(reversalEffects));
      if (refusal) {
        if (refusal.kind === 'value-drift') {
          // RESTORE-P0 P0-C. An undo either reverses the authored operation or
          // it does not happen. The two rejected alternatives:
          //
          //   skip the conflicting effect -> an atomically authored turn is
          //     partially reversed, which is the HIST-B failure through a
          //     different door
          //   let the inverse win -> history overwrites external truth it does
          //     not own, which is the case-6 defect
          throw restorationRefusal(
            `ST1034: restoration refused — '${refusal.path}' changed after the ` +
              `operation being reversed. Expected ${JSON.stringify(
                refusal.expected
              )} but found ${JSON.stringify(
                refusal.current
              )}. Nothing was changed; the history position is unmoved.`
          );
        }
        // A structured refusal from validation: nothing was applied.
        throw restorationRefusal(
          `Unsupported scoped undo effect at ${refusal.kind}`
        );
      }

      if (usesDeclarativeTarget) {
        applyDeclarativeTarget();
        return;
      }

      isRestoring = true;
      const replayOwnerId = getPositionRegistry(
        (tree as { $?: object }).$ ?? tree
      )?.id;
      // Set only when the reversal applied and a consumer then threw: the
      // bookkeeping below still runs, and the failure is rethrown after it.
      let deliveryFailure: { error: unknown } | undefined;
      try {
        // State the origin so the port propagates it. `isRestoring` is a
        // synchronous flag and is already false by the time the notifier
        // delivers — which is the whole reason provenance has to travel WITH the
        // write rather than be inferred at delivery.
        // OWNER-REPLAY-1. `ownerId` is stamped ONCE, on the wrap that already
        // surrounds the whole replay, rather than at each
        // `notifier.notify(...)` site. Every downstream meta spreads
        // `getActiveWriteContext()`, so the namespace reaches all of them —
        // including the realization adapter's seven `intent: 'system'` sites —
        // and a NEW replay site inherits it without anyone remembering to.
        //
        // Without this a replayed write reaches the notifier with
        // `ownerId: undefined`, and an owner-filtered observer is blind to every
        // undo: measured as OWNER-REPLAY-0 in EGRESS-1.
        withWriteContext(
          { origin: 'restoration', ownerId: replayOwnerId },
          () => {
            realizationPort.applyAtomically(reversalEffects);
          }
        );
      } catch (error) {
        if (!wasAppliedBeforeFailure(error)) throw error;
        deliveryFailure = { error };
      } finally {
        isRestoring = false;
      }

      // RESTORE-P0 P0-C. A restoration's OWN writes are published with
      // `participation: 'realized'` — measured via MUT-2, which records that
      // redo is marked realization too — and they carried `origin: 'system'`
      // rather than `'restoration'`, so the notifier subscription cannot tell
      // them from server truth. Banking them would make the next undo refuse
      // against the previous undo's output.
      //
      // The restoration's own writes now carry `origin: 'restoration'`, so the
      // notifier subscription filters them before the external-truth branch is
      // reached. The consume-once marking that used to be needed here is gone —
      // see the tombstone at `externalTruthByPath`.
      for (const effect of reversalEffects) {
        if (
          effect.structural === undefined &&
          typeof effect.path === 'string'
        ) {
          externalTruthByPath.delete(effect.path);
        }
        const restoredSubjectKey = subjectTruthKey(
          effect.owner,
          effect.subjectId
        );
        if (
          restoredSubjectKey !== undefined &&
          typeof effect.path === 'string'
        ) {
          const truth = externalTruthBySubject.get(restoredSubjectKey);
          const fieldPath = effect.fieldSegments;
          if (truth && effect.structural === undefined && fieldPath) {
            clearExternalFields(truth.fields, fieldPath);
            if (truth.fields.size === 0)
              externalTruthBySubject.delete(restoredSubjectKey);
          }
        }
      }
      if (deliveryFailure) throw deliveryFailure.error;
    };

    const positionRegistry = getPositionRegistry(tree.$);
    if (!positionRegistry) {
      throw new Error(
        'SignalTree: restoration() requires a tree-owned PositionRegistry.'
      );
    }

    // Create restoration manager with restoration function
    const restorationManager = new RestorationManager(
      tree,
      positionRegistry,
      config,
      (state: T) => {
        isRestoring = true;
        try {
          rootAuthority.replace(state);
        } finally {
          isRestoring = false;
        }
      },
      applyTurnEffectsThroughRealizationPort
    );

    // If PathNotifier batching is enabled, use flush events to record
    // a single snapshot per flush; otherwise, keep the existing immediate
    // update-based restoration history entry.
    //
    // IMPORTANT: signalTree's recursive update pipeline writes to locations
    // directly without calling PathNotifier.notify(); only entity collections
    // notify by themselves. To make direct writes such as
    // `tree.$.user.profile.name('x')` observable here we subscribe to each
    // writable location's intrinsic mutation channel and route writes through
    // the global notifier.
    const createCaptureBucket = (): CaptureBucket => ({
      ownerPaths: new Set<string>(),
      subjectIds: new Set<number>(),
      positionIds: new Set<number>(),
      effects: new Map(),
      collectionOrders: new Map(),
      descriptorInputs: [],
      designated: false,
    });
    const pendingCapture = createCaptureBucket();
    // Reconstruction needs every physical change, including external truth.
    // Reversal owns authored work only. Sharing their effect map lets an
    // external 0 -> 5 contaminate a later authored 5 -> 6 undo with before=0.
    // Before any retained/pending boundary exists, authored effects alone are
    // sufficient: there is no earlier historical snapshot to reconstruct.
    let historicalCapture: CaptureBucket | undefined;
    const getHistoricalCapture = (): CaptureBucket | undefined => {
      if (!restorationManager.hasRetainedOrPendingHistory()) return undefined;
      return historicalCapture ??= createCaptureBucket();
    };
    const clearHistoricalCapture = (): void => {
      if (historicalCapture) clearCaptureBucket(historicalCapture);
      historicalCapture = undefined;
    };

    /**
     * RESTORE-P0 P0-C — the last value a REALIZATION wrote at a scalar path,
     * cleared as soon as an authored write lands there.
     *
     * This is the provenance signal that separates the two kinds of divergence:
     *
     *   authored divergence  a closure undo reverses a dependent turn first, so
     *                        the location holds a LATER AUTHORED value. Normal;
     *                        the restoration is reversing that turn too.
     *   external divergence  a realization superseded the location. Replaying
     *                        the inverse would destroy truth history does not
     *                        own.
     *
     * Only the second is a conflict. Keyed by path and holding the VALUE rather
     * than a timestamp, so an authored write that happens to restore the same
     * value does not leave a stale conflict behind.
     */
    const externalTruthByPath = new Map<string, unknown>();
    type MembershipTruth = { present: boolean; value: unknown };
    const externalMembershipTruth = new Map<number, MembershipTruth>();
    const displacedMembershipTruth = new Map<
      number,
      Map<number, MembershipTruth | undefined>
    >();
    const rememberMembershipTruth = (
      transactionId: number | undefined,
      position: number
    ): void => {
      if (transactionId === undefined) return;
      let previous = displacedMembershipTruth.get(transactionId);
      if (!previous)
        displacedMembershipTruth.set(transactionId, (previous = new Map()));
      if (!previous.has(position))
        previous.set(position, externalMembershipTruth.get(position));
    };
    const restoreMembershipTruth = (
      transactionId: number | undefined,
      position: number
    ): void => {
      const previous =
        transactionId === undefined
          ? undefined
          : displacedMembershipTruth.get(transactionId);
      if (!previous?.has(position)) return;
      const truth = previous.get(position);
      if (truth) externalMembershipTruth.set(position, truth);
      else externalMembershipTruth.delete(position);
      previous.delete(position);
      if (previous.size === 0)
        displacedMembershipTruth.delete(transactionId as number);
    };

    // Entity writes publish whole rows while reversal effects address fields.
    // Keep provenance at the same field granularity as those effects, keyed by
    // stable position+subject so sibling writes cannot claim or erase authority.
    const externalTruthBySubject = new Map<
      string,
      {
        readonly rowPath: string;
        readonly fields: Map<
          string,
          { segments: readonly string[]; value: unknown }
        >;
      }
    >();
    const clearExternalFields = (
      fields: Map<string, { segments: readonly string[]; value: unknown }>,
      path: readonly string[]
    ): void => {
      for (const [key, field] of fields) {
        if (fieldSegmentsOverlap(field.segments, path)) fields.delete(key);
      }
    };
    const updateExternalRowFields = (
      subjectKey: string,
      rowPath: string,
      before: unknown,
      after: Record<string, unknown>,
      realized: boolean
    ): void => {
      const previousTruth = externalTruthBySubject.get(subjectKey);
      if (!realized && !previousTruth) return;
      const fields =
        previousTruth?.fields ??
        new Map<string, { segments: readonly string[]; value: unknown }>();
      const visit = (
        prev: unknown,
        next: unknown,
        path: readonly string[]
      ): void => {
        if (Object.is(prev, next)) return;
        if (isPlainRecord(prev) && isPlainRecord(next)) {
          for (const key of new Set([
            ...Object.keys(prev),
            ...Object.keys(next),
          ])) {
            visit(prev[key], next[key], [...path, key]);
          }
          return;
        }
        clearExternalFields(fields, path);
        if (realized)
          fields.set(JSON.stringify(path), { segments: path, value: next });
      };
      // Initial row acquisition has no prior record; index its fields too.
      visit(isPlainRecord(before) ? before : {}, after, []);
      if (previousTruth && previousTruth.rowPath !== rowPath) {
        externalTruthByPath.delete(previousTruth.rowPath);
      }
      if (fields.size)
        externalTruthBySubject.set(subjectKey, { rowPath, fields });
      else externalTruthBySubject.delete(subjectKey);
    };
    const externalOrderOwners = new Set<number>();
    // Accepts `unknown` because `PositionId` is a branded type on the reversal
    // side and a plain number on the notification side; the key only needs the
    // two to stringify identically.
    const subjectTruthKey = (
      position: unknown,
      subject: unknown
    ): string | undefined =>
      position === undefined || subject === undefined
        ? undefined
        : `${String(position)}\u0000${String(subject)}`;

    // `restorationWrittenPaths` / `restorationWrittenSubjects` were DELETED once
    // restoration carried its own origin.
    //
    // TOMBSTONE, because the deletion is the point. P0-C needed them because a
    // restoration published its writes as realizations with a fabricated origin,
    // indistinguishable from server truth at the notifier — so each undo banked
    // its own output as external truth and the NEXT undo refused against it.
    // They were a consume-once workaround for a missing fact.
    //
    // With `origin: 'restoration'` propagated through the write path, the
    // subscription filters restoration writes before the external-truth branch
    // is reached, and there is nothing to suppress. Verified by neutering the
    // mechanism first and confirming the suite stayed correct, then deleting it —
    // rather than assuming provenance would be sufficient.

    const pendingTransactions = new Map<number, CaptureBucket>();
    // Pending ownership survives history reset and explicit rollback refusal.
    // Only a confirmed/rolled-back lifecycle event (or destroy) releases it.
    // Keep addresses only, never a second copy of the transaction's values.
    const pendingRestorationFootprints = new Map<
      number,
      PendingRestorationFootprint[]
    >();
    const restorationFootprint = (
      effect: TurnEffect
    ): PendingRestorationFootprint => ({
      position: effect.position,
      path: effect.path,
      subject: effect.subject,
      fieldSegments: effect.kind === 'set' ? effect.fieldSegments : undefined,
      structural: effect.kind !== 'set',
    });
    const restorationFootprintsOverlap = (
      left: PendingRestorationFootprint,
      right: PendingRestorationFootprint
    ): boolean => {
      if (left.position === right.position) {
        // Structural transitions can change collection ordering as well as
        // membership. Field writes on independent rows do not overlap.
        if (left.structural && right.structural) return true;
        if (left.subject !== undefined && right.subject !== undefined) {
          if (left.subject !== right.subject) return false;
          return (
            left.structural ||
            right.structural ||
            left.fieldSegments === undefined ||
            right.fieldSegments === undefined ||
            fieldSegmentsOverlap(left.fieldSegments, right.fieldSegments)
          );
        }
        // A pure order footprint does not claim a row's field values.
        if (left.structural || right.structural) return false;
      }
      // Diagnostic path text is not location identity: a literal 'a.b' key
      // and a nested a.b leaf have different positions in this registry.
      return (
        positionRegistry.contains(
          left.position as PositionId,
          right.position as PositionId
        ) ||
        positionRegistry.contains(
          right.position as PositionId,
          left.position as PositionId
        )
      );
    };
    /**
     * External provenance displaced by a speculative authored write, by PATH.
     *
     * An authored write returns a location to history's control — correct while
     * the turn is in force. But an ABANDONED turn must not keep that authority:
     * rollback restores prior truth AND prior authority over it. Without this,
     * a rolled-back transaction silently handed history a value the server
     * owned, and a later undo would overwrite it.
     *
     *   rollback     restores prior authority (the entry is replayed)
     *   confirmation replaces prior authority (the entry is dropped)
     *
     * Keyed by PATH, not by transaction id, because the id cannot be the join:
     * a speculative write resolves through `resolveTransactionId`, which needs
     * a matching `transactionOwner`, while the compensation carries a bare
     * `transactionId` under `origin: 'transaction-rollback'`. Measured, they
     * disagree — remember recorded under 1, the compensation asked for 2.
     *
     * The restore also cannot live in the `rolled-back` lifecycle handler:
     * measured, that fires BEFORE the compensation writes land, and each of
     * those clears provenance at its own path, wiping anything restored there.
     *
     * Only paths that actually HELD external truth are recorded, so an ordinary
     * transaction over history-owned state stores nothing.
     */
    const supersededExternalTruth = new Map<number, Map<string, unknown>>();
    /**
     * A rollback's compensation hands the location back to whoever owned it
     * before the speculative turn: the displaced external truth if there was
     * one, otherwise history. Consumed per path so the baseline does not
     * outlive the transaction that created it.
     */
    /**
     * The transaction a COMPENSATION belongs to.
     *
     * `resolveTransactionId` cannot answer this. Its last branch requires the
     * transaction to still be OPEN — correct for its own job, since a stale id
     * must not divert writes into a bucket nothing will drain — but a
     * compensation arrives by definition AFTER the decision, once the
     * `rolled-back` handler has already removed the id from
     * `activeForeignTransactions`. Traced: the speculative write resolved to 1
     * and the compensation to `undefined`, so the baseline was never found.
     *
     * Ownership is still checked. What is dropped is only the openness
     * requirement, and `origin: 'transaction-rollback'` has already established
     * that this write is that transaction's own compensation.
     */
    const compensationTransactionId = (meta?: {
      transactionId?: unknown;
    }): number | undefined => {
      // Only ever called behind `isCompensationWrite`, so
      // `origin: 'transaction-rollback'` has already established both that this
      // is a compensation and whose it is. No owner token is required — and
      // none is available: stamping `transactionOwner` on a compensation makes
      // `activeTransactionContext()` report an open scope, reopening the
      // callback scope a rollback must leave closed.
      return typeof meta?.transactionId === 'number'
        ? meta.transactionId
        : undefined;
    };
    const restoreSupersededTruth = (
      transactionId: number | undefined,
      path: string
    ): void => {
      const displaced =
        transactionId === undefined
          ? undefined
          : supersededExternalTruth.get(transactionId);
      if (displaced?.has(path)) {
        externalTruthByPath.set(path, displaced.get(path));
        displaced.delete(path);
        if (displaced.size === 0 && transactionId !== undefined) {
          supersededExternalTruth.delete(transactionId);
        }
        return;
      }
      externalTruthByPath.delete(path);
    };
    const rememberSupersededTruth = (
      transactionId: number | undefined,
      path: string
    ): void => {
      if (transactionId === undefined) return;
      if (!externalTruthByPath.has(path)) return;
      let displaced = supersededExternalTruth.get(transactionId);
      if (!displaced) {
        displaced = new Map();
        supersededExternalTruth.set(transactionId, displaced);
      }
      // First supersession wins: later writes in the same turn supersede the
      // speculative value, not the external one.
      if (!displaced.has(path)) {
        displaced.set(path, externalTruthByPath.get(path));
      }
    };
    const pendingDescriptorInputs = new Map<
      number,
      CaptureBucket['descriptorInputs']
    >();
    const transactionOwnerToken = {};
    const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      !(value instanceof Map) &&
      !(value instanceof Set);
    const clearCaptureBucket = (bucket: CaptureBucket): void => {
      bucket.ownerPaths.clear();
      bucket.subjectIds.clear();
      bucket.positionIds.clear();
      bucket.effects.clear();
      bucket.collectionOrders.clear();
      bucket.descriptorInputs.length = 0;
      bucket.designated = false;
    };
    const drainCaptureBucket = (
      bucket: CaptureBucket
    ): {
      ownerPaths: string[];
      subjectIds: number[];
      positionIds: number[];
      effects: TurnEffect[];
      collectionOrders: PendingCollectionOrder[];
      descriptorInputs: CaptureBucket['descriptorInputs'];
      designated: boolean;
    } => {
      const ownerPaths = Array.from(bucket.ownerPaths).sort();
      bucket.ownerPaths.clear();
      const subjectIds = Array.from(bucket.subjectIds).sort(
        (left, right) => left - right
      );
      bucket.subjectIds.clear();
      const positionIds = Array.from(bucket.positionIds).sort(
        (left, right) => left - right
      );
      bucket.positionIds.clear();
      const effects = Array.from(bucket.effects.values()).map(cloneTurnEffect);
      bucket.effects.clear();
      const collectionOrders = Array.from(bucket.collectionOrders.values()).map(
        (order) => ({
          ...order,
          beforeSubjects: [...order.beforeSubjects],
          afterSubjects: [...order.afterSubjects],
        })
      );
      bucket.collectionOrders.clear();
      const descriptorInputs = bucket.descriptorInputs.splice(0);
      const designated = bucket.designated;
      bucket.designated = false;
      return {
        ownerPaths,
        subjectIds,
        positionIds,
        effects,
        collectionOrders,
        descriptorInputs,
        designated,
      };
    };

    const retainDescriptorInputs = (
      descriptorInputs: CaptureBucket['descriptorInputs']
    ): void => {
      if (!restorationManager.retainsCompletedHistory()) {
        return;
      }
      for (const input of descriptorInputs) {
        rememberTreeRealizationDescriptor({
          ...input,
          descriptors: realizationDescriptors,
        });
      }
    };

    /**
     * THE admission predicate. Every record site consults this one function,
     * so eligibility cannot drift between the flush path, the root path and the
     * transaction path.
     *
     * It is now the identity of `designated`, because the `restorationEligibility`
     * instrument that made it a choice was deleted once opt-in became the only
     * semantic. The function stays rather than being inlined: it is the single
     * place admission is decided, and that is worth a name.
     *
     * Gated BEFORE `buildTurn()` on purpose. `buildTurn` snapshots state, and
     * the whole point of HIST-C2 is that a non-reversible operation acquires no
     * restoration cost — gating at `insertConfirmedTurn()` would be the single
     * cleanest site semantically but would still pay for the snapshot.
     */
    const isTurnEligible = (designated: boolean): boolean => designated;
    const resolveOwnerPositionId = (ownerPath?: string): number | undefined => {
      if (!ownerPath) {
        return undefined;
      }

      const segments = ownerPath.split('.');
      let cursor: unknown = (tree as ISignalTree<T>).$ as Record<
        string,
        unknown
      >;
      for (const segment of segments) {
        if (!isTraversableNode(cursor)) {
          return undefined;
        }
        cursor = (cursor as Record<string, unknown>)[segment];
      }

      const resolved = (cursor as { __positionIds?: number[] } | undefined)
        ?.__positionIds?.[0];
      return typeof resolved === 'number' ? resolved : undefined;
    };
    const resolveLiveNodeAtPath = (path?: string): unknown => {
      if (!path) {
        return undefined;
      }

      const segments = path.split('.');
      let cursor: unknown = (tree as ISignalTree<T>).$ as Record<
        string,
        unknown
      >;
      for (const segment of segments) {
        if (!isTraversableNode(cursor)) {
          return undefined;
        }
        cursor = (cursor as Record<string, unknown>)[segment];
      }

      return cursor;
    };
    const effectKey = (effect: TurnEffect): string => {
      switch (effect.kind) {
        case 'set':
          return `${effect.kind}\u0000${
            effect.fieldSegments
              ? JSON.stringify(effect.fieldSegments)
              : effect.path
          }\u0000${effect.position}\u0000${effect.subject ?? ''}`;
        // RESTORE-P0: structural effects key by SUBJECT, deliberately WITHOUT
        // `kind`. Including the kind gave `add(a)` and `remove(a)` different
        // slots, so one turn kept two contradictory inverses. Keying by subject
        // makes them collide so `enqueueEffect` can compose the turn's NET
        // effect — and makes that an O(1) map hit rather than a scan.
        case 'remove':
        case 'add':
        case 'rekey':
          return `structural\u0000${effect.ownerPath}\u0000${effect.position}\u0000${effect.subject}`;
      }
    };
    /**
     * RESTORE-P0 A/B — compose STRUCTURAL effects on the same subject.
     *
     * `effectKey` includes `kind`, so `add(a)` and `remove(a)` in one turn used
     * to land under different keys and both survived into the turn. Reversal is
     * per-effect (`toReversalEffect`), so the turn then carried two
     * contradictory inverses — re-add and re-remove — and applying both left the
     * collection in a state that was never the pre-turn state.
     *
     * Both pinned defects are this one bug:
     *
     *   setAll([a,b]) + removeOne('a')      undo -> ['a']   should be []
     *   changeId('a','a2') + removeOne('a2') rollback -> ['a2']  should be ['a']
     *
     * The fix is to record the turn's NET effect per subject, because that is
     * what a turn means: reversal restores the state before the whole turn, not
     * before each write inside it.
     *
     * Deliberately NOT composed: `remove` then `add` of the same subject. Its
     * net is a key/value change for a subject that existed before and after,
     * which no single effect kind expresses, and there is no evidence it is
     * broken today. It keeps its existing two-entry behaviour.
     */
    const enqueueEffect = (
      effectMap: PendingEffectMap,
      effect: TurnEffect
    ): void => {
      const key = effectKey(effect);
      const existing = effectMap.get(key);
      if (existing) {
        if (existing.kind === 'set' && effect.kind === 'set') {
          if (!composePlainBranchMemberEffect(existing, effect)) {
            existing.after = effect.after;
            // First presence before, latest presence after.
            const before = existing.fieldPresence?.before ?? true;
            const after = effect.fieldPresence?.after ?? true;
            if (before && after) delete existing.fieldPresence;
            else existing.fieldPresence = { before, after };
          }
          existing.mutationIntent = combineScalarMutationIntent(
            existing.mutationIntent,
            effect.mutationIntent
          );
          if (plainBranchMemberEffectIsNoop(existing)) {
            effectMap.delete(key);
          }
          return;
        }

        if (existing.kind !== 'set' && effect.kind !== 'set') {
          // Created and destroyed inside one turn: the subject did not exist
          // before the turn and does not exist after it, so the turn has NO
          // structural effect on it. P0-A.
          if (existing.kind === 'add' && effect.kind === 'remove') {
            effectMap.delete(key);
            return;
          }

          // Renamed then removed: the pre-turn state had the row under its
          // ORIGINAL key, so that is the key reversal must restore. P0-B.
          if (existing.kind === 'rekey' && effect.kind === 'remove') {
            effectMap.set(key, { ...effect, key: existing.beforeKey });
            return;
          }

          // Created then renamed: one creation, under the final key.
          if (existing.kind === 'add' && effect.kind === 'rekey') {
            existing.key = effect.afterKey;
            return;
          }

          // Renamed twice: one rename, original to final. A round trip is no
          // rename at all.
          if (existing.kind === 'rekey' && effect.kind === 'rekey') {
            if (existing.beforeKey === effect.afterKey) {
              effectMap.delete(key);
              return;
            }
            existing.afterKey = effect.afterKey;
            return;
          }
        }
        return;
      }
      effectMap.set(key, effect);
    };
    const buildTurnEffectFromStructural = (
      ownerPath: string,
      path: string,
      meta?: WriteMetadata,
      positionIds?: number[],
      subjectIds?: number[]
    ): TurnEffect | undefined => {
      const position = positionIds?.[0];
      const subject = subjectIds?.[0];
      if (position === undefined || subject === undefined) {
        return undefined;
      }

      const effect = meta?.structuralEffect;
      if (!effect) {
        return undefined;
      }

      switch (effect.kind) {
        case 'add':
          return {
            ...effect,
            ownerPath,
            path,
            position,
          } satisfies CollectionAddEffect;
        case 'remove':
          return {
            ...effect,
            ownerPath,
            path,
            position,
          } satisfies CollectionRemoveEffect;
        case 'rekey':
          return {
            ...effect,
            ownerPath,
            path,
            position,
          } satisfies CollectionRekeyEffect;
      }
    };
    const captureEffects = (
      effectMap: PendingEffectMap,
      path: string,
      next: unknown,
      prev: unknown,
      meta?: WriteMetadata,
      ownerPath?: string,
      subjectIds?: number[],
      positionIds?: number[]
    ): void => {
      const membership = plainBranchMembershipEffects(meta);
      if (membership) {
        for (const effect of membership)
          enqueueEffect(effectMap, { ...effect });
        return;
      }
      const enqueueScalarDiff = (
        diffPath: string,
        before: unknown,
        after: unknown,
        fieldSegments: readonly string[] = [],
        presence?: FieldPresence
      ): void => {
        const position = positionIds?.[0];
        if (
          position === undefined ||
          (before === after &&
            (presence === undefined || presence.before === presence.after))
        ) {
          return;
        }

        if (isPlainRecord(before) && isPlainRecord(after)) {
          const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
          for (const key of keys) {
            const beforeChild = before[key];
            const afterChild = after[key];
            const beforePresent = Object.prototype.hasOwnProperty.call(before, key);
            const afterPresent = Object.prototype.hasOwnProperty.call(after, key);
            // Keep read order and presence semantics while avoiding child
            // capture allocations for values the recursive guard would skip.
            if (beforeChild === afterChild && beforePresent === afterPresent) {
              continue;
            }
            enqueueScalarDiff(
              `${diffPath}.${key}`,
              beforeChild,
              afterChild,
              [...fieldSegments, key],
              {
                before: beforePresent,
                after: afterPresent,
              }
            );
          }
          return;
        }

        enqueueEffect(effectMap, {
          kind: 'set',
          path: diffPath,
          ownerPath: ownerPath ?? path,
          position,
          subject: subjectIds?.[0],
          fieldSegments: subjectIds?.length ? fieldSegments : undefined,
          ...(!subjectIds?.length && fieldSegments.length > 0
            ? { branchSegments: fieldSegments }
            : {}),
          ...(subjectIds?.length &&
          presence !== undefined &&
          !(presence.before && presence.after)
            ? { fieldPresence: { ...presence } }
            : {}),
          before,
          after,
          mutationIntent: meta?.mutationIntent,
        });
      };

      const structuralEffect = ownerPath
        ? buildTurnEffectFromStructural(
            ownerPath,
            path,
            meta,
            positionIds,
            subjectIds
          )
        : undefined;
      if (structuralEffect) {
        enqueueEffect(effectMap, structuralEffect);
        return;
      }

      if (next === undefined && prev === undefined) {
        return;
      }

      // Payload shape is not topology: a registered terminal slot owns the
      // whole value. Only branch/subject values need field decomposition.
      if (
        isPlainRecord(next) &&
        isPlainRecord(prev) &&
        !(
          !subjectIds?.length &&
          positionIds?.[0] !== undefined &&
          scalarSlotRuntime?.resolveScalarSlot(positionIds[0]) !== undefined
        )
      ) {
        enqueueScalarDiff(path, prev, next);
        return;
      }

      const position = positionIds?.[0];
      if (position === undefined) {
        return;
      }

      if (prev === next) {
        return;
      }

      enqueueEffect(effectMap, {
        kind: 'set',
        path,
        ownerPath: ownerPath ?? path,
        position,
        subject: subjectIds?.[0],
        fieldSegments: subjectIds?.length ? [] : undefined,
        before: prev,
        after: next,
        mutationIntent: meta?.mutationIntent,
      });
    };
    const captureIntoBucket = (
      bucket: CaptureBucket,
      path: string,
      next: unknown,
      prev: unknown,
      meta?: WriteMetadata,
      ownerPath?: string,
      subjectIds?: number[],
      positionIds?: number[]
    ): void => {
      // HIST-C2. OR, never assign: the turn is eligible if ANY of its writes
      // was designated. Assigning would let a later undesignated write in the
      // same turn demote it, which would partially reverse an atomic operation
      // — the exact HIST-B failure.
      //
      // Read off the DELIVERED meta, not the ambient flag: this runs at flush
      // time, after the designation scope has returned.
      if (isMetaDesignated(meta)) {
        bucket.designated = true;
      }

      const membership = plainBranchMembershipEffects(meta);
      if (membership) {
        for (const effect of membership) {
          bucket.positionIds.add(effect.position);
          bucket.ownerPaths.add(effect.ownerPath);
          enqueueEffect(bucket.effects, { ...effect });
        }
        return;
      }

      const resolvedPositionIds =
        positionIds && positionIds.length > 0
          ? positionIds
          : (() => {
              const fallback = resolveOwnerPositionId(ownerPath);
              return fallback === undefined ? [] : [fallback];
            })();

      bucket.descriptorInputs.push({
        path,
        ownerPath,
        positionIds: resolvedPositionIds,
        subjectIds,
        meta,
        registry: getPositionRegistry(tree.$),
      });

      bucket.ownerPaths.add(ownerPath ?? path);
      for (const subjectId of subjectIds ?? []) {
        bucket.subjectIds.add(subjectId);
      }
      for (const positionId of resolvedPositionIds) {
        bucket.positionIds.add(positionId);
      }
      captureEffects(
        bucket.effects,
        path,
        next,
        prev,
        meta,
        ownerPath,
        subjectIds,
        resolvedPositionIds
      );
    };
    const captureCollectionOrderIntoBucket = (
      bucket: CaptureBucket,
      capture: CollectionOrderCapture
    ): void => {
      if (isMetaDesignated(capture.meta)) {
        bucket.designated = true;
      }
      const existing = bucket.collectionOrders.get(capture.owner);
      bucket.collectionOrders.set(capture.owner, {
        owner: capture.owner,
        ownerPath: capture.ownerPath,
        beforeSubjects: existing?.beforeSubjects ?? [...capture.beforeSubjects],
        afterSubjects: [...capture.afterSubjects],
        beforeFrontier: existing?.beforeFrontier ?? capture.beforeFrontier,
        afterFrontier: capture.afterFrontier,
      });
      bucket.ownerPaths.add(capture.ownerPath);
      bucket.positionIds.add(capture.owner);
    };
    const getTransactionBucket = (transactionId: number): CaptureBucket => {
      let bucket = pendingTransactions.get(transactionId);
      if (!bucket) {
        bucket = createCaptureBucket();
        pendingTransactions.set(transactionId, bucket);
      }
      return bucket;
    };
    /**
     * TURN-FEED-0 — active foreign transactions, keyed by `(owner, id)`.
     *
     * This used to compare `meta.transactionOwner` against `transactionOwnerToken`,
     * restoration's own private token. That was correct only while restoration
     * shipped its own `transaction()`; a transaction opened by `transactions()`
     * was invisible, and its speculative writes landed in CONFIRMED restoration
     * history before `confirm()`.
     *
     * Recognition alone is not enough — measured. Without a lifecycle signal the
     * pending bucket never drains. Hence the subscription below.
     */
    const activeForeignTransactions = new Map<string, number>();

    /**
     * Turns built at 'staged' and awaiting a decision, keyed by `(owner, id)`.
     * Held here rather than rebuilt at 'confirmed' so the turn's snapshot is
     * taken while it is still the newest thing that happened.
     */
    const stagedForeignTurns = new Map<string, number>();
    /**
     * Each open foreign transaction's own effects, kept until it settles so a
     * rejection can re-base later history (`rebaseAfterRejection`). Kept
     * whether or not the transaction became an undoable turn: a plain
     * transaction's speculative values reach later turns just the same.
     */
    const speculativeContributions = new Map<
      number,
      {
        effects: TurnEffect[];
        since: { turnId: number; ordinal: number };
      }
    >();

    const resolveTransactionId = (meta?: {
      transactionId?: unknown;
      transactionOwner?: unknown;
    }): number | undefined => {
      if (typeof meta?.transactionId !== 'number') {
        return undefined;
      }
      if (meta.transactionOwner === transactionOwnerToken) {
        return meta.transactionId;
      }
      if (
        typeof meta.transactionOwner !== 'object' ||
        meta.transactionOwner === null
      ) {
        return undefined;
      }
      // Only while the announcing owner says it is OPEN. A stale id from a
      // settled transaction must not divert writes into a bucket nothing will
      // drain.
      const key = transactionIdentityKey(meta.transactionId);
      return activeForeignTransactions.has(key)
        ? activeForeignTransactions.get(key)
        : undefined;
    };
    const materializePendingTransaction = (
      transactionId: number
    ): CanonicalTurn<T> | undefined => {
      const bucket = pendingTransactions.get(transactionId);
      pendingTransactions.delete(transactionId);
      // NOT `supersededExternalTruth.delete` here. This runs at 'staged' —
      // every transaction stages, decided or not — so discarding the displaced
      // provenance at this point destroys it before a rollback can restore it.
      // The lifecycle handler discards it after the decision instead.
      if (!bucket) {
        return undefined;
      }
      const {
        subjectIds,
        positionIds,
        effects,
        collectionOrders,
        descriptorInputs,
        designated,
      } = drainCaptureBucket(bucket);
      // Even undesignated pending work is protected. Restoration history
      // admission is not evidence that transaction-owned writes are settled.
      pendingRestorationFootprints.set(transactionId, [
        ...effects.map(restorationFootprint),
        ...collectionOrders.map((order) => ({
          position: order.owner,
          path: order.ownerPath,
          structural: true,
        })),
      ]);
      const entry =
        isTurnEligible(designated) &&
        restorationManager.retainsCompletedHistory() &&
        (effects.length > 0 || collectionOrders.length > 0)
          ? restorationManager.createPendingEntry(
              subjectIds.length > 0 ? subjectIds : undefined,
              positionIds.length > 0 ? positionIds : undefined,
              effects.length > 0 ? effects : undefined,
              collectionOrders.length > 0 ? collectionOrders : undefined,
              undefined,
              transactionId
            )
          : undefined;
      if (entry) {
        pendingDescriptorInputs.set(entry.id, descriptorInputs);
      }
      if (effects.length > 0) {
        speculativeContributions.set(transactionId, {
          effects: effects.map(cloneTurnEffect),
          since: restorationManager.historyWatermark(),
        });
      }
      return entry;
    };
    /**
     * TURN-FEED-0 — observe a FOREIGN transaction's lifecycle.
     *
     * Time-travel is a pure observer here. It learns that a transaction opened,
     * confirmed or rolled back; it does not decide any of those, and learning
     * that one confirmed grants no restoration rights — `materializePendingTransaction`
     * still runs `isTurnEligible`, so admission stays with `undoable()`.
     *
     * Its own transactions are NOT routed through this. They already hold
     * `transactionOwnerToken` and drive the manager directly.
     */
    // TURN-FEED-0.2. Restoration owns transactions of its own
    // (`transactionOwnerToken`), so it is an owner-side installer, not merely an
    // observer. Installing here rather than resolving is what makes the
    // subscription independent of enhancer order: whichever authority sets up
    // first creates the one channel, and the other joins it.
    let unsubscribeCommittedEntities: (() => void) | undefined;
    const observePendingEntities = (): void => {
      unsubscribeCommittedEntities ??= getMutationCaptureRuntime(
        tree
      )?.subscribeCommittedEntity?.((capture) => {
        if (
          isRestoring ||
          capture.meta?.origin === 'restoration' ||
          isInspectionWrite(capture.meta) ||
          isCompensationWrite(capture.meta) ||
          getWriteParticipation(capture.meta) === 'realized'
        )
          return;
        const transactionId = resolveTransactionId(capture.meta);
        if (transactionId === undefined) return;
        const touches = pendingRestorationFootprints.get(transactionId) ?? [];
        for (const change of capture.changes) {
          const add = (fieldSegments?: readonly string[]): void => {
            if (
              touches.some(
                (touch) =>
                  touch.position === capture.owner &&
                  touch.subject === change.subject &&
                  touch.structural === change.structural &&
                  (touch.fieldSegments === fieldSegments ||
                    (touch.fieldSegments &&
                      fieldSegments &&
                      touch.fieldSegments.length === fieldSegments.length &&
                      touch.fieldSegments.every(
                        (key, index) => key === fieldSegments[index]
                      )))
              )
            )
              return;
            touches.push({
              position: capture.owner,
              path: capture.ownerPath,
              subject: change.subject,
              fieldSegments,
              structural: change.structural,
            });
          };
          const visit = (
            before: unknown,
            after: unknown,
            segments: readonly string[]
          ): void => {
            if (Object.is(before, after)) return;
            if (isPlainRecord(before) && isPlainRecord(after)) {
              for (const key of new Set([
                ...Object.keys(before),
                ...Object.keys(after),
              ])) {
                visit(before[key], after[key], [...segments, key]);
              }
            } else add(segments);
          };
          if (change.structural) add();
          else visit(change.before, change.after, []);
        }
        if (touches.length)
          pendingRestorationFootprints.set(transactionId, touches);
      });
    };

    const unsubscribeTransactionLifecycle = installTransactionLifecycleChannel(
      tree as object
    ).subscribe((event) => {
      if (event.owner === transactionOwnerToken) {
        return;
      }
      const key = transactionIdentityKey(event.id);

      if (event.kind === 'opened') {
        // Registered BEFORE the transaction's writes arrive, which is why the
        // announcement has to precede the callback.
        activeForeignTransactions.set(key, event.id);
        observePendingEntities();
        return;
      }

      if (event.kind === 'staged') {
        // The contribution is complete but undecided, so the turn is BUILT now
        // and held pending. Building it at 'confirmed' instead was measured
        // wrong: surrounding writes flush in between and record a snapshot that
        // already contains the speculative state, so the transaction's own turn
        // is reference-identical to it and dedupes away to nothing.
        if (!activeForeignTransactions.has(key)) {
          return;
        }
        getPathNotifier()?.flushSync();
        const staged = materializePendingTransaction(event.id);
        if (staged) {
          stagedForeignTurns.set(key, staged.id);
        }
        return;
      }

      activeForeignTransactions.delete(key);
      pendingRestorationFootprints.delete(event.id);
      if (activeForeignTransactions.size === 0) {
        unsubscribeCommittedEntities?.();
        unsubscribeCommittedEntities = undefined;
      }
      const contribution = speculativeContributions.get(event.id);
      speculativeContributions.delete(event.id);
      if (event.kind === 'rolled-back') {
        pendingTransactions.delete(event.id);
        if (contribution) {
          restorationManager.rebaseAfterRejection(
            contribution.effects,
            contribution.since
          );
        }
        // NOT restored here. Measured: this event fires BEFORE the rollback's
        // compensation writes land, and each of those clears provenance at its
        // own path — so anything restored here is immediately wiped. The
        // compensation write restores it instead, which is also the only place
        // that knows the path actually came back.
      }
      if (event.kind !== 'rolled-back') {
        displacedMembershipTruth.delete(event.id);
        // Confirmation REPLACES prior authority: the authored turn genuinely
        // superseded the realization, so the displaced provenance is dropped.
        supersededExternalTruth.clear();
      }
      const stagedTurnId = stagedForeignTurns.get(key);
      stagedForeignTurns.delete(key);
      if (stagedTurnId === undefined) {
        // Nothing was staged — either never opened here, or it produced no
        // eligible turn. Either way there is nothing to decide.
        return;
      }

      if (event.kind === 'confirmed') {
        const descriptorInputs =
          pendingDescriptorInputs.get(stagedTurnId) ?? [];
        const confirmed = restorationManager.confirmPendingTurn(
          stagedTurnId,
          () => retainDescriptorInputs(descriptorInputs)
        );
        if (confirmed) {
          pendingDescriptorInputs.delete(stagedTurnId);
        }
        return;
      }

      // 'rolled-back'. The writes never happened, so the staged turn is thrown
      // away rather than admitted. Compensation is the owner's job — restoration
      // neither applies nor validates it.
      restorationManager.discardPendingTurn(stagedTurnId);
      pendingDescriptorInputs.delete(stagedTurnId);
    });

    /** Set by this tree's own leaf interceptors; read by the global flush hook. */
    let restoreLeafInterceptors: (() => void) | null = null;
    /** Set by this tree's own notifier subscription; read by the global flush hook. */
    let selfDirty = false;
    let suppressNextFlushRecord = false;
    let unsubscribeFlush: (() => void) | null = null;
    let unsubscribeNotifications: (() => void) | null = null;
    let unsubscribeReset: (() => void) | null = null;
    let unsubscribeCollectionOrders: (() => void) | null = null;
    const releaseCapture = getMutationCaptureRuntime(tree)?.activateCapture();
    try {
      unsubscribeCollectionOrders =
        getMutationCaptureRuntime(tree)?.subscribeCollectionOrder?.(
          (capture) => {
            // Pending work never entered completed history. Its compensation
            // returns to that baseline; it is not a new order gap or authority.
            // Inspection owns neither history nor external-order authority.
            if (
              isCompensationWrite(capture.meta) ||
              isInspectionWrite(capture.meta)
            ) {
              return;
            }
            if (
              getWriteParticipation(capture.meta) === 'realized' ||
              resolveTransactionId(capture.meta) === undefined
            ) {
              const historical = getHistoricalCapture();
              if (historical) captureCollectionOrderIntoBucket(historical, capture);
            }
            if (getWriteParticipation(capture.meta) === 'realized') {
              externalOrderOwners.add(capture.owner);
              selfDirty = true;
              return;
            }
            externalOrderOwners.delete(capture.owner);
            const transactionId = resolveTransactionId(capture.meta);
            if (transactionId !== undefined) {
              captureCollectionOrderIntoBucket(
                getTransactionBucket(transactionId),
                capture
              );
              return;
            }
            selfDirty = true;
            captureCollectionOrderIntoBucket(pendingCapture, capture);
          }
        ) ?? null;
      const notifier = getPathNotifier();
      if (notifier) {
        const treeOwnerId = getPositionRegistry(tree.$)?.id;
        const subscribeCollectionNotifications = (): void => {
          unsubscribeNotifications?.();
          unsubscribeNotifications = notifier.subscribe(
            '**',
            (
              next,
              prev,
              path,
              ownerPath,
              origin,
              subjectIds,
              positionIds,
              meta
            ) => {
              if (origin === 'restoration') {
                return;
              }
              // NOTIFIER-SCOPE-0. The notifier is PROCESS-GLOBAL and this
              // subscription is `'**'`, so writes belonging to OTHER trees
              // arrive here. Before registry-qualified ownership they were
              // invisible for the worse reason — coalesced away, taking a real
              // write with them. Now they are delivered and must be DECLINED:
              // capturing a foreign write put another tree's baseline into this
              // tree's history, and `b.undo()` applied tree A's value to tree B.
              //
              // An emitter that supplies no namespace is accepted, as before —
              // the guard can only ever reject a write that positively names a
              // different owner.
              const writeOwnerId = (meta as { ownerId?: number } | undefined)
                ?.ownerId;
              if (
                writeOwnerId !== undefined &&
                treeOwnerId !== undefined &&
                writeOwnerId !== treeOwnerId
              ) {
                return;
              }

              // DEVTOOLS-JUMP-0.1. Inspection records NO external truth. It is
              // not truth anyone committed, so it earns no protection from
              // P0-C — a diagnostic snapshot must never be able to refuse a
              // legitimate undo. Measured: the undo overwrites the scrub.
              if (isInspectionWrite(meta)) {
                return;
              }
              if (
                !isCompensationWrite(meta) &&
                (getWriteParticipation(meta) === 'realized' ||
                  resolveTransactionId(meta) === undefined)
              ) {
                const historical = getHistoricalCapture();
                if (historical) captureEffects(
                  historical.effects, path, next, prev, meta,
                  ownerPath, subjectIds, positionIds
                );
              }
              const membership = plainBranchMembershipEffects(meta);
              if (membership) {
                const transactionId = resolveTransactionId(meta);
                const compensation = isCompensationWrite(meta);
                const realized = getWriteParticipation(meta) === 'realized';
                for (const effect of membership) {
                  if (compensation) {
                    restoreMembershipTruth(
                      compensationTransactionId(meta),
                      effect.position
                    );
                  } else if (realized) {
                    externalMembershipTruth.set(effect.position, {
                      present: effect.plainBranchMembership.after,
                      value: effect.after,
                    });
                  } else {
                    rememberMembershipTruth(transactionId, effect.position);
                    externalMembershipTruth.delete(effect.position);
                  }
                }
                if (compensation) return;
                if (realized) {
                  selfDirty = true;
                } else {
                  captureIntoBucket(
                    transactionId === undefined
                      ? pendingCapture
                      : getTransactionBucket(transactionId),
                    path,
                    next,
                    prev,
                    meta,
                    ownerPath,
                    subjectIds,
                    positionIds
                  );
                  if (transactionId === undefined) selfDirty = true;
                }
                return;
              }
              if (!subjectIds?.length) {
                for (const position of positionIds ?? []) {
                  if (isCompensationWrite(meta)) {
                    restoreMembershipTruth(
                      compensationTransactionId(meta),
                      position
                    );
                  } else if (getWriteParticipation(meta) !== 'realized') {
                    rememberMembershipTruth(
                      resolveTransactionId(meta),
                      position
                    );
                    externalMembershipTruth.delete(position);
                  } else if (externalMembershipTruth.has(position)) {
                    externalMembershipTruth.set(position, {
                      present: true,
                      value: next,
                    });
                  }
                }
              }
              if (getWriteParticipation(meta) === 'realized') {
                // RESTORE-P0 P0-C. Recorded HERE rather than only in the leaf
                // interceptor: measured, that interceptor is not installed for
                // every tree shape, and for a plain nested branch it never runs
                // at all — the notifier subscription is the observation point
                // every write reaches.
                const subjectKey = subjectTruthKey(
                  positionIds?.[0],
                  subjectIds?.[0]
                );
                // A rollback's restore half is `realized` but is NOT external
                // truth — it returns a value history already owns. Recording it
                // here made an abandoned speculative turn refuse a later undo
                // of an EARLIER authored turn. See `isCompensationWrite`.
                const compensation = isCompensationWrite(meta);
                if (compensation) {
                  restoreSupersededTruth(compensationTransactionId(meta), path);
                  // A discarded pending turn is absent from completed history.
                  // Capturing its inverse here would fold the speculative
                  // baseline into a later authored write in the same flush
                  // (and cancel a restored entity's subsequent removal).
                  return;
                } else if (
                  next === undefined &&
                  !(
                    !subjectIds?.length &&
                    positionIds?.[0] !== undefined &&
                    scalarSlotRuntime?.resolveScalarSlot(positionIds[0]) !==
                      undefined
                  )
                ) {
                  externalTruthByPath.delete(path);
                } else {
                  // A terminal can hold undefined as external truth. Collection
                  // notifications with no value still take the branch above.
                  externalTruthByPath.set(path, next);
                }
                // Only a row-shaped payload is useful here; the collection also
                // notifies at its own path with an undefined value.
                if (
                  !compensation &&
                  subjectKey !== undefined &&
                  next !== null &&
                  typeof next === 'object'
                ) {
                  updateExternalRowFields(
                    subjectKey,
                    path,
                    prev,
                    next as Record<string, unknown>,
                    true
                  );
                }
                selfDirty = true;
                return;
              }
              // An authored write returns this location to history's control —
              // but if it is speculative, remember what authority it displaced
              // so a rollback can hand it back.
              rememberSupersededTruth(resolveTransactionId(meta), path);
              externalTruthByPath.delete(path);
              const authoredPosition = positionIds?.[0];
              if (authoredPosition !== undefined) {
                externalOrderOwners.delete(authoredPosition);
              }
              const authoredSubjectKey = subjectTruthKey(
                positionIds?.[0],
                subjectIds?.[0]
              );
              if (authoredSubjectKey !== undefined && isPlainRecord(next)) {
                updateExternalRowFields(
                  authoredSubjectKey,
                  path,
                  prev,
                  next,
                  false
                );
              }
              const transactionId = resolveTransactionId(meta);
              if (transactionId !== undefined) {
                captureIntoBucket(
                  getTransactionBucket(transactionId),
                  path,
                  next,
                  prev,
                  meta,
                  ownerPath,
                  subjectIds,
                  positionIds
                );
                return;
              }
              selfDirty = true;
              captureIntoBucket(
                pendingCapture,
                path,
                next,
                prev,
                meta,
                ownerPath,
                subjectIds,
                positionIds
              );
            }
          );
        };
        subscribeCollectionNotifications();
        if (typeof notifier.onReset === 'function') {
          unsubscribeReset = notifier.onReset(() => {
            subscribeCollectionNotifications();
          });
        }
        if ('$' in tree) {
          restoreLeafInterceptors = interceptLeafSignals(
            (tree as ISignalTree<T>).$ as Record<string, unknown>,
            (path, next, prev, meta, ownerPath, subjectIds, positionIds) => {
              const ambient = meta ?? getActiveWriteContext();
              // Stamped here because this callback is synchronous with the
              // `.set()`, and because handing `effectiveMeta` to `notify()` as a
              // metaOverride would otherwise bypass notify's own stamping.
              const effectiveMeta: WriteMetadata | undefined =
                isRestorationDesignated()
                  ? markMetaDesignated(ambient)
                  : ambient;
              if (isRestoring) return;
              // DEVTOOLS-JUMP-0.1. Notified but recorded nowhere, and
              // deliberately NOT deleting the external-truth marker below:
              // inspection is inert with respect to provenance, so looking at a
              // location cannot release it from another authority's protection.
              if (isInspectionWrite(effectiveMeta)) {
                notifier.notify(
                  path,
                  next,
                  prev,
                  ownerPath,
                  subjectIds,
                  positionIds,
                  effectiveMeta
                );
                return;
              }
              if (getWriteParticipation(effectiveMeta) === 'realized') {
                // P0-C: remember that this location now holds external truth —
                // unless this is a transaction's own compensation, which
                // restores a value history already owns.
                if (isCompensationWrite(effectiveMeta)) {
                  restoreSupersededTruth(
                    compensationTransactionId(effectiveMeta),
                    path
                  );
                } else {
                  externalTruthByPath.set(path, next);
                }
                notifier.notify(
                  path,
                  next,
                  prev,
                  ownerPath,
                  subjectIds,
                  positionIds,
                  effectiveMeta
                );
                return;
              }
              // An authored write supersedes the realization at this location,
              // so the location is back under history's control — recording
              // what it displaced, in case this turn is abandoned.
              const transactionId = resolveTransactionId(effectiveMeta);
              rememberSupersededTruth(transactionId, path);
              externalTruthByPath.delete(path);
              if (transactionId !== undefined) {
                captureIntoBucket(
                  getTransactionBucket(transactionId),
                  path,
                  next,
                  prev,
                  effectiveMeta,
                  ownerPath,
                  subjectIds,
                  positionIds
                );
              } else {
                // The plain-leaf path does not go through `captureIntoBucket`,
                // so the designation has to be OR-ed in here too. Same rule:
                // one designated write promotes the whole turn.
                if (isMetaDesignated(effectiveMeta)) {
                  pendingCapture.designated = true;
                }
                captureEffects(
                  pendingCapture.effects,
                  path,
                  next,
                  prev,
                  effectiveMeta,
                  ownerPath,
                  subjectIds,
                  positionIds
                );
              }
              notifier.notify(
                path,
                next,
                prev,
                ownerPath,
                subjectIds,
                positionIds,
                effectiveMeta,
                treeOwnerId
              );
            }
          );
        }
        if (typeof notifier.onFlush === 'function') {
          unsubscribeFlush = notifier.onFlush(() => {
            // Avoid recording history while restoring
            if (isRestoring) return;
            if (suppressNextFlushRecord) {
              suppressNextFlushRecord = false;
              selfDirty = false;
              drainCaptureBucket(pendingCapture);
              clearHistoricalCapture();
              return;
            }
            // `onFlush` is on the GLOBAL PathNotifier, so this fires for writes
            // to trees that have nothing to do with this one. Recording
            // unconditionally meant a full materialise + structuredClone of
            // THIS tree on every unrelated flush, then throwing it away:
            // measured 0.008ms -> 3.7 -> 7.2 -> 9.7ms as 1/2/3 unrelated
            // 10k-leaf trees were kept alive. Cost that scales with OTHER
            // people's trees is the worst kind.
            if (!selfDirty) return;
            selfDirty = false;
            // Decide only at flush: a later designated write can promote the
            // whole turn. Retained (including redo) and pending history still
            // need ordinary gaps to reconstruct their historical boundaries.
            if (
              !isTurnEligible(pendingCapture.designated) &&
              !restorationManager.hasRetainedOrPendingHistory()
            ) {
              clearCaptureBucket(pendingCapture);
              clearHistoricalCapture();
              return;
            }
            const {
              subjectIds,
              positionIds,
              effects,
              collectionOrders,
              descriptorInputs,
              designated,
            } = drainCaptureBucket(pendingCapture);
            const historical = historicalCapture
              ? drainCaptureBucket(historicalCapture)
              : undefined;
            historicalCapture = undefined;
            const eligible =
              isTurnEligible(designated) &&
              restorationManager.retainsCompletedHistory() &&
              (effects.length > 0 || collectionOrders.length > 0);
            const recorded = eligible
              ? restorationManager.addEntry(
                  subjectIds.length > 0 ? subjectIds : undefined,
                  positionIds.length > 0 ? positionIds : undefined,
                  effects.length > 0 ? effects : undefined,
                  collectionOrders.length > 0 ? collectionOrders : undefined,
                  undefined,
                  () => retainDescriptorInputs(descriptorInputs),
                  historical
                )
              : false;
            if (!recorded) {
              restorationManager.appendHistoricalGap(
                historical?.effects ?? effects,
                historical?.collectionOrders ?? collectionOrders,
                designated
              );
            }
          });
        }
      }
    } catch {
      // Ignore - fall back to default behavior
    }

    const enhancedTree = tree;
    defineTreeRealizationDescriptors(
      enhancedTree as unknown as object,
      realizationDescriptors
    );
    defineTreeRealizationPort(
      enhancedTree as unknown as object,
      realizationPort
    );
    (enhancedTree as ISignalTree<T> & RestorationMethods)['undo'] = () => {
      restorationManager.undoConfirmed();
    };
    (enhancedTree as ISignalTree<T> & RestorationMethods)['redo'] = () => {
      restorationManager.redoConfirmed();
    };
    // `transaction()` was REMOVED from restoration() in 15.0 (TX-SURFACE-0).
    //
    // TOMBSTONE. It was a SECOND implementation of a concept `transactions()`
    // already owns, reaching the public surface silently through
    // `RestorationMethods extends TransactionMethods`.
    //
    // It was also the incorrect one. Its rollback plan came from
    // `getPendingRollbackPlan()`, which read `this.history` as its dependency
    // ledger. Under opt-in eligibility an ordinary later write is not admitted
    // to that history, so a dependent rollback stopped being refused: 7 refusal
    // tests stopped throwing the moment the default flipped, all of them
    // installing `restoration()` alone. `transactions()` was unaffected, because
    // it builds its dependency store from its OWN captured effects.
    //
    // Deleting it needed TURN-FEED-0 first. Without a lifecycle channel,
    // `transactions()`' speculative writes landed in CONFIRMED restoration
    // history — measured, in both enhancer orders — because restoration
    // recognised a pending transaction only by its own private token.
    //
    // NOT deleted: the `pendingTransactions` capture buckets, which record a
    // transaction confirmed by `transactions()` as one turn. That is
    // restoration's own job and the lifecycle observer drives it.
    (enhancedTree as ISignalTree<T> & RestorationMethods)[
      'getRestorationHistory'
    ] = () => restorationManager.getRestorationHistory();
    const resetRestorationRetention = (): void => {
      restorationManager.resetRestorationHistory();
      clearCaptureBucket(pendingCapture);
      clearHistoricalCapture();
      pendingDescriptorInputs.clear();
      stagedForeignTurns.clear();
      // A reset clears HISTORY, not pending transactions: a transaction still
      // open across it can be rejected afterwards, and every record from then
      // on is later than it. Turn ids and ordinals restart at 1, so its
      // watermark moves to the new start. Clearing this (through 4b28e3bf)
      // let undo restore the rejected value after a reset.
      for (const contribution of speculativeContributions.values()) {
        contribution.since = { turnId: 0, ordinal: 0 };
      }
      pendingTransactions.clear();
      supersededExternalTruth.clear();
      externalTruthByPath.clear();
      externalMembershipTruth.clear();
      displacedMembershipTruth.clear();
      externalTruthBySubject.clear();
      externalOrderOwners.clear();
    };
    (enhancedTree as ISignalTree<T> & RestorationMethods)[
      'resetRestorationHistory'
    ] = () => {
      resetRestorationRetention();
    };
    (enhancedTree as ISignalTree<T> & RestorationMethods)['jumpTo'] = (
      index: number
    ) => {
      restorationManager.jumpTo(index);
    };
    (enhancedTree as ISignalTree<T> & RestorationMethods)['canUndo'] = () =>
      restorationManager.canUndoConfirmed();
    (enhancedTree as ISignalTree<T> & RestorationMethods)['canRedo'] = () =>
      restorationManager.canRedoConfirmed();
    (enhancedTree as ISignalTree<T> & RestorationMethods)['getCurrentIndex'] =
      () => restorationManager.getCurrentIndex();

    // Expose internal manager for advanced tooling / demo usage
    (enhancedTree as unknown as Record<string, unknown>)['__restoration'] =
      restorationManager;

    const releasePendingScalarObservers: Array<() => void> = [];
    visitTree((enhancedTree as ISignalTree<T>).$, (node, path) => {
      const position = getOwnedPositionIds(node)?.[0];
      if (
        position !== undefined &&
        !getOwnedSubjectIds(node)?.length &&
        isWritableLocation(node)
      ) {
        const release = observeIntrinsicMutations(
          node as object,
          (mutation) => {
            if (!mutation.changed || isRestoring) return;
            const transactionId = resolveTransactionId(getActiveWriteContext());
            if (transactionId === undefined) return;
            const touches =
              pendingRestorationFootprints.get(transactionId) ?? [];
            if (!touches.some((touch) => touch.position === position)) {
              touches.push({ position, path, structural: false });
              pendingRestorationFootprints.set(transactionId, touches);
            }
          }
        );
        if (release) releasePendingScalarObservers.push(release);
      }
      const scopedNode = node as {
        __positionIds?: number[];
        history?: {
          __bindSharedAuthority?: (authority: {
            undo(): boolean;
            redo(): boolean;
            canUndo(): boolean;
            canRedo(): boolean;
          }) => void;
        };
      };
      const positionId = scopedNode.__positionIds?.[0];

      if (
        typeof positionId === 'number' &&
        typeof scopedNode.history?.__bindSharedAuthority === 'function'
      ) {
        scopedNode.history.__bindSharedAuthority({
          undo: () => restorationManager.undoAt(positionId),
          redo: () => restorationManager.redoAt(positionId),
          canUndo: () => restorationManager.canUndoAt(positionId),
          canRedo: () => restorationManager.canRedoAt(positionId),
        });
        return false;
      }

      return undefined;
    });

    // Register cleanup to free history snapshots on destroy and to tear down
    // PathNotifier subscriptions / leaf-signal interceptors.
    if (typeof tree.registerCleanup === 'function') {
      tree.registerCleanup(() => {
        try {
          unsubscribeFlush?.();
        } catch {
          /* ignore */
        }
        try {
          unsubscribeNotifications?.();
        } catch {
          /* ignore */
        }
        try {
          unsubscribeTransactionLifecycle?.();
        } catch {
          /* ignore */
        }
        try {
          unsubscribeReset?.();
        } catch {
          /* ignore */
        }
        try {
          unsubscribeCollectionOrders?.();
        } catch {
          /* ignore */
        }
        try {
          restoreLeafInterceptors?.();
        } catch {
          /* ignore */
        }
        unsubscribeFlush = null;
        unsubscribeNotifications = null;
        unsubscribeReset = null;
        unsubscribeCollectionOrders = null;
        restoreLeafInterceptors = null;
        unsubscribeCommittedEntities?.();
        unsubscribeCommittedEntities = undefined;
        releaseCapture?.();
        for (const release of releasePendingScalarObservers) release();
        resetRestorationRetention();
        pendingRestorationFootprints.clear();
        speculativeContributions.clear();
        pendingTransactions.clear();
        supersededExternalTruth.clear();
        activeForeignTransactions.clear();
      });
    }

    return enhancedTree as unknown as ISignalTree<T> & RestorationMethods;
  };

  const meta: EnhancerMeta = {
    name: 'restoration',
    provides: ['restoration'],
    capabilities: ['causal-runtime', 'temporal-snapshots'],
  };
  (enhancerFn as unknown as { metadata: EnhancerMeta }).metadata = meta;
  (enhancerFn as unknown as Record<symbol, EnhancerMeta>)[ENHANCER_META] = meta;

  // THE ONE BOUNDARY CAST — same shape as `batching`, same reason, and it must
  // be re-justified per enhancer rather than assumed. `enhancerFn` reads the
  // realized tree so its parameter is `ISignalTree<T>`; `Enhancer<TAdded>`
  // takes the neutral `EnhancerHost`, and parameters are contravariant under
  // `strictFunctionTypes`. The body is untouched.
  //
  // `RestorationMethods.getRestorationHistory()` recovers its state from polymorphic
  // `this`, NOT from anything this cast carries — which is why the public
  // contract stays state-precise across it. `b266457d` removed the old
  // `RestorationMethods<T>` generic for exactly this reason; the rows in
  // `restoration-contract.typing.spec.ts` are what verify it.
  return enhancerFn as unknown as Enhancer<RestorationMethods>;
}

/**
 * Convenience function to enable basic restoration.
 *
 * NOT PUBLIC — absent from `tools/api-baseline.json` and from every barrel, so
 * it reaches no entry point. Migrated with `restoration()` rather than left
 * declaring the pre-15.0 shape; deletion candidate for the deletion-first
 * utility audit, alongside `batchingWithConfig`.
 */
export function enableRestoration(): Enhancer<RestorationMethods> {
  return restoration({ enabled: true });
}

/**
 * Restoration with custom history size (v6 pattern).
 *
 * Not exported: reachable only as `withRestoration.history`, which is the
 * documented surface. Nothing imports the bare name.
 */
function restorationHistory(
  maxHistorySize: number
): Enhancer<RestorationMethods> {
  return restoration({ maxHistorySize });
}

// New v6-friendly export: `restoration` with named presets.
export const withRestoration = Object.assign(
  (config: RestorationConfig = {}) => restoration(config),
  {
    minimal: () => restoration({ maxHistorySize: 20 }),
    debug: () => restoration({ maxHistorySize: 200 }),
    history: restorationHistory,
  }
);
