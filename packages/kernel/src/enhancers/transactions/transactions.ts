import { registerScalarResponsibility } from '../../lib/internals/scalar-responsibility-attachment';
import type { ScalarResponsibilityPreparer } from '../../lib/internals/mutation-capture-runtime';
import { scalarAdmissionMetadata } from '../../lib/internals/scalar-admission-metadata';
import {registerScalarSelection} from '../../lib/internals/native-scalar-selection';
import { scalarFrameMetadata } from '../../lib/internals/scalar-publication-coverage';
import {fieldEndpoints,bindFieldEndpoints,composeFieldEndpoints} from '../../lib/internals/native-field-selection';
import {
  completeOrderCapture,
  type OrderBoundaryEvidence,
} from '../restoration/order-boundary-evidence';
import {
  prepareOrdinaryRealization,
  ordinaryRealization,
} from '../../lib/internals/causal-runtime/ordinary-realization';
import {
  composeOccupancy,
  occupancyEffect,
  type OccupancyComposition,
} from './occupancy-composition';
import { ordinaryEntityEntries } from '../../lib/internals/ordinary-entity-entries';
import {
  entityValueTransition,
  getEntityOrdinaryChanges,
  withEntityOrdinaryChanges,
  withoutEntityOrdinaryChanges,
} from '../../lib/internals/entity-value-transition';
import * as research from '../../lib/experimental-publication/private';
import {
  installTerminalRecord,
  type TerminalRecordPlan,
} from '../../lib/internals/intrinsic-mutation';
import { publishingExposedOnly } from '../../lib/internals/exposed-publication';
import {
  collectionBindingAt,
  plainBranchMembershipEffects,
  plainBranchMembershipChange,
  composePlainBranchMemberEffect,
  settleTurnMemberEffects,
  plainBranchMemberEffectIsNoop,
  preparePlainBranchMembers,
  prepareNewMemberResponsibility,
  refreshOmittedCollection,
  changedOmittedCollection,
} from '../../lib/internals/plain-branch-membership';
import {
  beginStructuralWrite,
  endStructuralWrite,
} from '../../lib/internals/member-membership';
import {
  openPhysicalRows,
  physicalRows,
} from '../../lib/internals/physical-rows';
import type { PlainBranchMemberPresence } from '../../lib/internals/plain-branch-membership';
import { applicationFailureCause } from '../../lib/internals/causal-runtime/post-application-failure';
import type { FieldPresence } from '../../lib/internals/causal-runtime/causal-types';
import {
  getOrCreateSubjectRestorationClaims,
  getSubjectRestorationClaims,
} from '../../lib/internals/subject-restoration-claims';
import { initializeSubjectReclamation } from '../../lib/internals/subject-reclamation-sink';
import type {
  CarrierKind,
  Enhancer,
  EnhancerMeta,
  ISignalTree,
  WriteMetadata,
} from '../../lib/types';
import type {
  PendingTransaction,
  TransactionInspection,
  ChangeStatus,
  TransactionMethods,
} from './transactions.types';

import {
  getWriteParticipation,
  isInspectionWrite,
} from '../../lib/write-participation';
import { ENHANCER_META, SignalTreeRollbackError } from '../../lib/types';
import {
  cancelCommitScopes,
  isCommitScopeOpen,
  openCommitScope,
  settleCommitScope,
} from '../../lib/internals/commit-consequence';
import {
  defineTransactionLifecycleSource,
  type TransactionLifecycleFact,
  type TransactionLifecycleObserver,
} from '../../lib/internals/transaction-lifecycle-source';
import type { ToolingTree } from '../../lib/internals/tooling-tree';
import { holdEntityMembershipDelivery } from '../../lib/internals/entity-membership-source';
import { AppliedTurnProjection } from '../../lib/internals/causal-runtime/applied-turn-projection';
import { markOwnerInvalidatedFrom } from '../../lib/internals/owner-invalidation-port';
import type {
  CausalEffect,
  PositionId as CausalPositionId,
  ReversalEffect,
} from '../../lib/internals/causal-runtime/causal-types';
import {
  deriveCollectionOrderDelta,
  deriveDeclarativeTransitionTarget,
  prepareDeclarativeTransitionInstallation,
  requiresDeclarativeStructuralTarget,
  type CollectionOrderDelta,
  type CollectionTransitionTargetBinding,
  type ScalarTransitionTargetBinding,
} from '../../lib/internals/causal-runtime/target-transition';
import {
  placeFieldReversalsWhileRowsExist,
  rollbackPendingTurnAt,
} from '../../lib/internals/causal-runtime/pending-rollback';
import {
  getTransactionLifecycleChannel,
  installTransactionLifecycleChannel,
} from '../../lib/internals/causal-runtime/transaction-lifecycle';
import { createRealizationContextSource } from '../../lib/internals/causal-runtime/realization-context';
import {
  createTreeRealizationAdapter,
  admitSelectedOperation,

  defineTreeRealizationDescriptors,
  defineTreeRealizationPort,
  forgetSubjectsInTreeRealizationDescriptors,
  getTreeRealizationDescriptors,
  getTreeRealizationPort,
  rememberTreeRealizationDescriptor,
  preparePointRealization,
} from '../../lib/internals/causal-runtime/tree-realization-adapter';
import { TurnStore } from '../../lib/internals/causal-runtime/turn-store';
import { interceptLeafSignals } from '../../lib/internals/intercept-leaf-signals';
import {
  getMutationCaptureRuntime,
  bindMutationCaptureRegistry,
  type CollectionOrderCapture,
} from '../../lib/internals/mutation-capture-runtime';
import { getOwnedPositionIds } from '../../lib/internals/owned-mutation';
import { getPositionRegistry } from '../../lib/internals/position-registry';
import { reportContainedObserverError } from '../../lib/internals/error-reporter';
import { getPathNotifier } from '../../lib/path-notifier';
import { deepEqual, isTraversableNode } from '../../lib/utils';
import {
  getActiveWriteContext,
  withWriteContext,
} from '../../lib/write-context';
import { visitTree } from '../../lib/internals/visit-tree';
import { getTreeScalarSlotRuntime } from '../../lib/internals/tree-scalar-slot-port';
import { getPhysicalCommitClock } from '../../lib/internals/physical-commit-clock';
import { getLocationRuntime } from '../../lib/internals/location-runtime';

// Private source admission identity survives cloning without entering public records.
const captureIdentity = Symbol('transaction source admission');
type CaptureIdentity = { readonly revision: number; readonly segment: number };
const identityOf = (effect: TurnEffect): CaptureIdentity | undefined =>
  (effect as TurnEffect & { [captureIdentity]?: CaptureIdentity })[
    captureIdentity
  ];
const identify = <T extends TurnEffect>(
  effect: T,
  identity: CaptureIdentity
): T => {
  Object.defineProperty(effect, captureIdentity, {
    value: Object.freeze(identity),
    enumerable: true,
    configurable: true,
  });
  return effect;
};
const isLaterAdmission = (own: TurnEffect, later: TurnEffect): boolean => {
  const a = identityOf(own),
    b = identityOf(later);
  return !a || !b || b.revision > a.revision;
};

type TurnEffectBase = {
  position: number;
  ownerPath: string;
  path: string;
};

export type ScalarSetEffect = TurnEffectBase & {
  kind: 'set';
  subject?: number;
  /** Producer-known row-relative address; display paths never encode identity. */
  subjectFieldSegments?: readonly string[];
  plainBranchMembership?: PlainBranchMemberPresence;
  fieldPresence?: FieldPresence;
  before: unknown;
  after: unknown;
  mutationIntent?: 'replace' | 'derive';
};

export type CollectionAddEffect = TurnEffectBase & {
  kind: 'add';
  subject: number;
  key: string | number;
  value: unknown;
  beforeSubject?: number;
  afterSubject?: number;
};

export type CollectionRemoveEffect = TurnEffectBase & {
  kind: 'remove';
  subject: number;
  key: string | number;
  value: unknown;
  beforeSubject?: number;
  afterSubject?: number;
};

export type CollectionRekeyEffect = TurnEffectBase & {
  kind: 'rekey';
  subject: number;
  beforeKey: string | number;
  afterKey: string | number;
};

export type TurnEffect =
  | ScalarSetEffect
  | CollectionAddEffect
  | CollectionRemoveEffect
  | CollectionRekeyEffect;

type LaterAppliedEffect = {
  turnId: number;
  effect: TurnEffect;
};

export type PendingRollbackDependencyConflict = {
  kind: 'later-confirmed-dependency';
  pendingTurnId: number;
  pendingEffect: TurnEffect;
  conflictingTurnId?: number;
  conflictingEffect?: TurnEffect;
};

type OrderInterference = {
  readonly ownerPath: string;
  readonly independentAdmission: number;
  readonly resumedOwnAdmission: number;
};
type PendingRollbackPlan =
  | { compensation: TurnEffect[] }
  | {
      conflict:
        | PendingRollbackDependencyConflict
        | Extract<RollbackFailureCause, { kind: 'effect-validation-failed' }>;
    };

export type RollbackFailureCause =
  | PendingRollbackDependencyConflict
  | {
      kind: 'effect-validation-failed';
      pendingTurnId: number;
      compensation: TurnEffect[];
      errorMessage: string;
      cause?: unknown;
      callbackError?: unknown;
    };

type PendingEffectMap = Map<string, TurnEffect>;

type OrderBoundaryLink = Readonly<{
  evidence: OrderBoundaryEvidence;
  previous?: OrderBoundaryLink;
}>;
const materializeOrderBoundaries = (
  head: OrderBoundaryLink | undefined
): OrderBoundaryEvidence[] => {
  const result: OrderBoundaryEvidence[] = [];
  for (let item = head; item; item = item.previous) result.push(item.evidence);
  return result.reverse();
};
type CaptureBucket = {
  orderBoundaries: Map<number, OrderBoundaryLink>;
  /**
   * Committed entity touches of a callback that is still open, recorded before
   * any notifier listener can see them. Admission evidence only: it is exposed
   * through the reserved pending record and dropped at materialization, which
   * takes the normally captured effects. It never supplies baselines.
   */
  entityFootprints: PendingEffectMap;
  /**
   * TX-AUTO-ROLLBACK-0: window sequence of this bucket's last write per
   * location key (see windowKeys).
   */
  ownWriteSeq: Map<string, number>;
  ownerPaths: Set<string>;
  subjectIds: Set<number>;
  positionIds: Set<number>;
  baselineValues: Map<number, unknown>;
  effects: PendingEffectMap;
  occupancy: Map<string, OccupancyComposition>;
  /** Read-only source for lazy, touched-field scratch composition. */
  priorEffects?: PendingEffectMap;
  /** Operation-local derived ordinary field facts, never retained after staging. */
  derivedFields?: ScalarSetEffect[];
  collectionOrders: Map<number, Omit<CollectionOrderCapture, 'meta'>>;
};

export type TransactionTurnRecord = {
  id: number;
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
  __baselineValues?: Map<number, unknown>;
};

type TransactionLifecycleListener = (turn: TransactionTurnRecord) => void;

export interface InternalTransactionRuntime {
  /** @internal Count-only retention probe; no state or writer identities escape. */
  getInspectionFootprintCountsForTesting(): {
    writers: number;
    footprints: number;
  };
  /** @internal Active admission metadata only; count evidence, not GC proof. */
  getSourceAdmissionCountsForTesting(): {
    segments: number;
    admissions: number;
    dependencies: number;
  };
  transaction(fn: () => void): PendingTransaction;
  /** @internal Raw retained records; projected by `/internals`. */
  getConfirmedTurnRecords(): readonly TransactionTurnRecord[];
  /** L15: opt-in evidence retention beyond the correctness obligation. */
  setHistoryRetention(retain: number): void;
  /** Explicit retention metadata; the reader must not infer it from ids. */
  getConfirmedRetention(): {
    truncated: boolean;
    firstAvailableTurnId?: number;
  };
  /** @internal PROPOSAL-INSPECTION-0 raw material; unclassified. */
  describePendingTurn(
    turnId: number
  ):
    | { effects: readonly TurnEffect[]; laterEffects: readonly TurnEffect[] }
    | undefined;
  getConfirmedTurnCount(): number;
  getPendingTurnCount(): number;
  getConfirmedTurnIds(): number[];
  getPendingTurnIds(): number[];
  onPendingCreated(listener: TransactionLifecycleListener): () => void;
  onPendingConfirmed(listener: TransactionLifecycleListener): () => void;
  onPendingDiscarded(listener: TransactionLifecycleListener): () => void;
}

const INTERNAL_TRANSACTION_RUNTIME = Symbol(
  'signaltree:internal:transaction-runtime'
);

/**
 * PROPOSAL-0. Carries the pending turn id from `transaction()` to the handle decorator
 * without widening `PendingTransaction`, which is public. Module-private, so
 * nothing outside this file can read or forge it.
 */
const PENDING_TURN_ID = Symbol('signaltree:internal:pending-turn-id');

const ROLLBACK_ERROR_MESSAGE =
  'SignalTree could not rollback the pending transaction';

/**
 * Why the rollback was refused, as a sentence rather than only as a `cause`.
 *
 * ⚠️ A LEGIBILITY REGRESSION FROM TX-SURFACE-0, repaired here. Both refusal
 * kinds produced the SAME constant message; the kind survived only on `.cause`,
 * which a thrown-error message in a console never shows. A developer saw
 * "could not rollback" and had no way to tell a dependency conflict — where
 * later work relies on facts the rollback would invalidate, and refusing is
 * CORRECT — from a compensation that simply failed to validate.
 *
 * ⚠️ SEMANTICS ARE UNCHANGED, DELIBERATELY. Same refusal in the same cases, same
 * error type, same `cause` payload. Only the rendering of an already-made
 * decision improves. The constant remains the PREFIX so existing matchers keep
 * matching — the message is additive, not replaced.
 */
export const explainRollbackFailure = (cause: RollbackFailureCause): string => {
  if (cause.kind === 'later-confirmed-dependency') {
    const at =
      cause.conflictingTurnId === undefined
        ? 'later work'
        : `turn ${cause.conflictingTurnId}`;
    return (
      `${ROLLBACK_ERROR_MESSAGE}: ${at} depends on state this rollback would ` +
      `invalidate, so reversing turn ${cause.pendingTurnId} is no longer safe ` +
      `[later-confirmed-dependency]`
    );
  }
  return (
    `${ROLLBACK_ERROR_MESSAGE}: compensating turn ${cause.pendingTurnId} ` +
    `failed validation — ${cause.errorMessage} [effect-validation-failed]`
  );
};

const createRollbackError = (
  cause: RollbackFailureCause
): SignalTreeRollbackError =>
  new SignalTreeRollbackError(explainRollbackFailure(cause), { cause });

function cloneTurnEffect(effect: TurnEffect): TurnEffect {
  return effect.kind === 'set' && effect.subjectFieldSegments
    ? { ...effect, subjectFieldSegments: [...effect.subjectFieldSegments] }
    : { ...effect };
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

/** Compare producer-known coordinates before consulting legacy display paths. */
function scalarRelation(
  left: ScalarSetEffect,
  right: ScalarSetEffect
): 'same' | 'overlap' | 'disjoint' {
  const a = left.subjectFieldSegments;
  const b = right.subjectFieldSegments;
  if (a && b) {
    const common = Math.min(a.length, b.length);
    for (let i = 0; i < common; i++) if (a[i] !== b[i]) return 'disjoint';
    return a.length === b.length ? 'same' : 'overlap';
  }
  if (left.path === right.path) return 'same';
  return left.path.startsWith(`${right.path}.`) ||
    right.path.startsWith(`${left.path}.`)
    ? 'overlap'
    : 'disjoint';
}

function buildPendingRollbackPlan(
  pendingTurn: TransactionTurnRecord | undefined,
  laterEffects: LaterAppliedEffect[],
  encloses?: (outer: number, inner: number) => boolean
): PendingRollbackPlan {
  if (!pendingTurn) {
    return { compensation: [] };
  }

  laterEffects = laterEffects.slice().sort((a, b) => {
    const left = identityOf(a.effect),
      right = identityOf(b.effect);
    return left && right ? left.revision - right.revision : 0;
  });
  const pendingEffects = pendingTurn.__effects ?? [];
  const makeScalarKey = (effect: ScalarSetEffect): string =>
    JSON.stringify([
      effect.position,
      effect.subject,
      effect.subjectFieldSegments ?? effect.path,
    ]);

  const classifyLaterOverlap = (
    effect: ScalarSetEffect
  ):
    | { kind: 'none' }
    | { kind: 'superseded' }
    | {
        kind: 'conflict';
        conflictingTurnId?: number;
        conflictingEffect?: TurnEffect;
      } => {
    let superseded = false;
    for (const laterEntry of laterEffects) {
      if (!isLaterAdmission(effect, laterEntry.effect)) continue;
      const laterEffect = laterEntry.effect;
      if (laterEffect.position !== effect.position) {
        // Restoring/removing an enclosing membership also affects descendants
        // at different positions. Their surviving writes cannot be hidden by
        // treating membership as an unrelated scalar location.
        if (
          effect.plainBranchMembership?.before === false &&
          effect.plainBranchMembership.after === true &&
          encloses?.(effect.position, laterEffect.position)
        ) {
          return {
            kind: 'conflict',
            conflictingTurnId: laterEntry.turnId,
            conflictingEffect: laterEffect,
          };
        }
        continue;
      }
      if (
        laterEffect.subject !== undefined &&
        effect.subject !== undefined &&
        laterEffect.subject !== effect.subject
      ) {
        continue;
      }
      if (
        laterEffect.kind === 'set'
          ? scalarRelation(effect, laterEffect) === 'same'
          : laterEffect.path === effect.path
      ) {
        if (laterEffect.kind !== 'set') {
          return {
            kind: 'conflict',
            conflictingTurnId: laterEntry.turnId,
            conflictingEffect: laterEffect,
          };
        }
        if (laterEffect.mutationIntent === 'replace') {
          if (
            laterEffects.some(
              ({ effect: candidate }) =>
                candidate.kind === 'set' &&
                isLaterAdmission(effect, candidate) &&
                makeScalarKey(candidate) === makeScalarKey(effect)
            )
          ) {
            superseded = true;
            continue;
          }
        }
        return {
          kind: 'conflict',
          conflictingTurnId: laterEntry.turnId,
          conflictingEffect: laterEffect,
        };
      }
      if (
        laterEffect.kind === 'set'
          ? scalarRelation(effect, laterEffect) === 'overlap'
          : laterEffect.path.startsWith(`${effect.path}.`) ||
            effect.path.startsWith(`${laterEffect.path}.`)
      ) {
        return {
          kind: 'conflict',
          conflictingTurnId: laterEntry.turnId,
          conflictingEffect: laterEffect,
        };
      }
    }
    return superseded ? { kind: 'superseded' } : { kind: 'none' };
  };

  const hasSameSubjectDependency = (
    effect: CollectionAddEffect | CollectionRemoveEffect | CollectionRekeyEffect
  ):
    | { conflictingTurnId?: number; conflictingEffect?: TurnEffect }
    | undefined => {
    for (const laterEntry of laterEffects) {
      if (!isLaterAdmission(effect, laterEntry.effect)) continue;
      const laterEffect = laterEntry.effect;
      if (laterEffect.ownerPath !== effect.ownerPath) {
        continue;
      }
      if (laterEffect.kind === 'set') {
        if (laterEffect.subject === effect.subject && effect.kind !== 'rekey') {
          return {
            conflictingTurnId: laterEntry.turnId,
            conflictingEffect: laterEffect,
          };
        }
        continue;
      }
      if (laterEffect.subject === effect.subject) {
        return {
          conflictingTurnId: laterEntry.turnId,
          conflictingEffect: laterEffect,
        };
      }
    }
    return undefined;
  };

  /**
   * PROPOSAL-REJECTION-0, disposition PR-A.
   *
   * The axis is SUPERSESSION vs DEPENDENCY, not scalar vs structural.
   * `hasSameSubjectDependency` is named for a dependency test but implements a
   * presence test: any later effect on the same subject refuses. That is right
   * when newer truth RESTS ON the structure this turn created — removing the
   * row would destroy it, and compensating only the turn's other effects would
   * half-apply a turn we reported as rejected, which is worse than refusing.
   *
   * It is wrong when newer truth ERASED that structure instead. A later remove
   * of a subject this turn added has already performed the compensation the
   * rollback would issue: there is nothing left to undo at that position and
   * nothing there to destroy. Reversing the turn's remaining effects then
   * COMPLETES the reversal rather than half-applying it, and refusing instead
   * strands unrelated speculative values — measured at
   * `proposal-rejection-0.spec.ts` cases 11 and 12, where `x` and `y` stayed
   * at their proposed values after a reject although nothing ever wrote to
   * them.
   *
   * Anything that puts the subject BACK would mean newer truth occupies the
   * position again and the refusal should stand, which is why this scans to
   * the end rather than returning on the first remove.
   *
   * Honest limit on that last sentence: the distinction is currently
   * UNOBSERVABLE. Replacing the scan with a break on the first remove passes
   * every test in the suite, because stable entity lifetime means a removed
   * subject can never be referenced again — a later add of the same business
   * key creates a DIFFERENT subject (`proposal-rejection-0.spec.ts` case 13,
   * `rekey-supersession-0.spec.ts` case 3). The scan is kept as the form that
   * stays correct if subject resurrection ever becomes representable, not
   * because a test currently distinguishes it.
   *
   * Deliberately narrow: only a pending `add` can be superseded this way.
   *
   * A pending `remove` compensates by re-adding, and a later writer re-adding
   * that subject is newer truth the re-add would clobber, so it must keep
   * refusing; a later remove of an already-removed subject is unreachable
   * (the collection throws "Entity with id ... not found"), which is why
   * widening this test to `remove` is inert rather than merely untested.
   *
   * A pending `rekey` is included for the same reason and on the same rule:
   * when the subject it retargeted is gone, the compensating rename has
   * nothing to act on and nothing to resurrect. That was added by
   * REKEY-SUPERSESSION-0, which first pinned the documented rekey repair
   * (RESTORE-P0 P0-B, `rekeyed-rollback-defect.spec.ts`) as cases 4 and 5 of
   * `rekey-supersession-0.spec.ts` so the widening could not regress it
   * quietly. Dropping the erasure test for rekeys kills five tests, including
   * those controls.
   *
   * A later UPDATE of a rekeyed subject is deliberately NOT a conflict —
   * `hasSameSubjectDependency` guards later `set` effects with
   * `effect.kind !== 'rekey'`, because a rekey changes the KEY while a set
   * changes a FIELD of the same subject. They do not contend, the rename
   * reverses and the newer field value rides along with the subject.
   */
  const classifyStructuralOverlap = (
    effect: CollectionAddEffect | CollectionRemoveEffect | CollectionRekeyEffect
  ):
    | { kind: 'none' }
    | { kind: 'superseded' }
    | {
        kind: 'conflict';
        conflictingTurnId?: number;
        conflictingEffect?: TurnEffect;
      } => {
    if (effect.kind === 'add' || effect.kind === 'rekey') {
      let erased = false;
      for (const laterEntry of laterEffects) {
        if (!isLaterAdmission(effect, laterEntry.effect)) continue;
        const laterEffect = laterEntry.effect;
        if (laterEffect.ownerPath !== effect.ownerPath) {
          continue;
        }
        if (laterEffect.subject !== effect.subject) {
          continue;
        }
        erased = laterEffect.kind === 'remove';
      }
      if (erased) {
        return { kind: 'superseded' };
      }
    }

    // REKEY-OCCUPANCY-0. Compensating a rekey renames the subject back to its
    // ORIGINAL key. If newer truth has since put a DIFFERENT subject at that
    // key, the rename has nowhere to land and the turn genuinely depends on
    // newer truth.
    //
    // This was already refused before this rule existed, but by accident: the
    // compensating re-add failed physically on a taken key, AFTER compensation
    // had begun. Deciding by accident is why that path stranded the turn's
    // other effects (measured as `effect-validation-failed` with `x` left at
    // its proposed value). Recognising it here, at plan time, refuses before
    // anything is touched and keeps the turn retryable once the key frees up.
    //
    // Subject identity is what makes this decidable rather than a guess: the
    // occupant is a different SUBJECT, not the same one renamed back.
    if (effect.kind === 'rekey') {
      // NET occupancy, not "an add appears in history". The later effects are
      // a log: an add that was subsequently removed leaves the key free, and
      // refusing on the stale add would make the refusal unrecoverable — the
      // caller clears the conflict and the retry still refuses.
      let occupant: LaterAppliedEffect | undefined;
      for (const laterEntry of laterEffects) {
        if (!isLaterAdmission(effect, laterEntry.effect)) continue;
        const later = laterEntry.effect;
        if (later.ownerPath !== effect.ownerPath) continue;
        if (later.kind === 'add' && later.key === effect.beforeKey) {
          occupant = later.subject === effect.subject ? undefined : laterEntry;
        } else if (later.kind === 'remove' && later.key === effect.beforeKey) {
          occupant = undefined;
        } else if (later.kind === 'rekey') {
          // A rename can vacate the key or move a different subject onto it.
          if (later.beforeKey === effect.beforeKey) occupant = undefined;
          if (
            later.afterKey === effect.beforeKey &&
            later.subject !== effect.subject
          ) {
            occupant = laterEntry;
          }
        }
      }
      if (occupant) {
        return {
          kind: 'conflict',
          conflictingTurnId: occupant.turnId,
          conflictingEffect: occupant.effect,
        };
      }
    }

    const dependency = hasSameSubjectDependency(effect);
    return dependency
      ? {
          kind: 'conflict',
          conflictingTurnId: dependency.conflictingTurnId,
          conflictingEffect: dependency.conflictingEffect,
        }
      : { kind: 'none' };
  };

  const compensation: TurnEffect[] = [];
  for (let i = pendingEffects.length - 1; i >= 0; i--) {
    const effect = pendingEffects[i];
    switch (effect.kind) {
      case 'set': {
        const overlap = classifyLaterOverlap(effect);
        if (overlap.kind === 'conflict') {
          return {
            conflict: {
              kind: 'later-confirmed-dependency',
              pendingTurnId: pendingTurn.id,
              pendingEffect: effect,
              conflictingTurnId: overlap.conflictingTurnId,
              conflictingEffect: overlap.conflictingEffect,
            },
          };
        }
        if (overlap.kind === 'superseded') {
          continue;
        }
        compensation.push(effect);
        break;
      }
      case 'add':
      case 'remove':
      case 'rekey': {
        const overlap = classifyStructuralOverlap(effect);
        if (overlap.kind === 'conflict') {
          return {
            conflict: {
              kind: 'later-confirmed-dependency',
              pendingTurnId: pendingTurn.id,
              pendingEffect: effect,
              conflictingTurnId: overlap.conflictingTurnId,
              conflictingEffect: overlap.conflictingEffect,
            },
          };
        }
        if (overlap.kind === 'superseded') {
          continue;
        }
        compensation.push(effect);
        break;
      }
    }
  }

  return { compensation };
}

class TransactionAuthority {
  private confirmedTurns: TransactionTurnRecord[] = [];
  /**
   * L15. Records kept purely as evidence, beyond what correctness requires.
   * 0 means correctness-only, which is the default.
   */
  private historyRetain = 0;
  /**
   * Whether an explicit retention contract exists. Until one does, the ledger
   * is left exactly as it has always behaved: the reader-visible history
   * policy may not change silently, and `confirmedTurnReader` is a shipped
   * surface whose purpose is reading confirmed history.
   */
  /**
   * Set once any confirmed record has actually been dropped. The reader must
   * never infer truncation from id gaps — pending and rejected turns leave
   * gaps too — so this is the explicit metadata internals.ts asks for,
   * including the case where the whole window is gone.
   */
  private evictedConfirmed = false;
  private pendingTurns = new Map<number, TransactionTurnRecord>();
  // How many pending turns wrote each position. Kept in step with
  // `pendingTurns` at its only three mutation sites, so asking whether a
  // settlement may forget a descriptor is O(1) rather than a rebuild of every
  // pending turn's positions (which made settling P overlapping turns O(P^2)).
  private readonly pendingPositionCounts = new Map<number, number>();
  private nextTurnId = 1;
  private queuedEvidence = new Map<number, Map<string, TurnEffect>>();

  /**
   * TX-LEDGER C3 — later effects that are NOT authored turns.
   *
   * Rollback safety asks "has anything since relied on the structure I am about
   * to invalidate?". That question is about causal DEPENDENCE, not authorship,
   * and the old answer came only from `confirmedTurns` — which excludes
   * realizations by construction. So a server refresh landing on a speculative
   * row created no dependency and the rollback deleted the row the server had
   * just written to: RESTORE-P0 P0-C one layer up.
   *
   * Deliberately NOT a causal history:
   *
   *   recorded ONLY while a pending turn exists   nothing outstanding, nothing
   *                                               retained
   *   dropped when the last pending turn settles  no accumulation
   *   monotonic                                   a dependency latches; the
   *                                               later write being reversed by
   *                                               hand does not un-depend it
   *                                               (measured, case 4)
   *   sequence-scoped                             a turn only sees effects that
   *                                               landed after IT opened
   *
   * The sequence matters with two open transactions: an effect recorded before
   * the second opened is not "later" for the second, only for the first.
   */
  private dependencyLedger: Array<{ seq: number; effect: TurnEffect }> = [];
  private ledgerSeq = 0;
  private readonly sourceDependencies = new Map<
    number,
    readonly TurnEffect[]
  >();
  getSourceDependencyCountForTesting(): number {
    return this.sourceDependencies.size;
  }
  prepareSourceDependencies(
    revision: number,
    effects: readonly TurnEffect[]
  ): TerminalRecordPlan['writes'][number] {
    return { map: this.sourceDependencies, key: revision, value: effects };
  }

  private readonly pendingOpenedAtSeq = new Map<number, number>();

  /**
   * Restoration-claim hooks, injected because the authority has no tree.
   *
   * An UNSETTLED turn owns the subjects it retired: Phase 6B measured that
   * reclaiming one makes `rollback()` throw and loses the row permanently. The
   * claim exists for exactly that interval — optimistic mutation to settlement,
   * confirm or reject alike — so the bound is how many operations are
   * outstanding right now, never a configured depth.
   */
  constructor(
    private readonly retainPendingClaims: (
      turnId: number,
      subjectIds: readonly number[]
    ) => void = () => undefined,
    private readonly releasePendingClaims: (turnId: number) => void = () =>
      undefined,
    private readonly encloses?: (outer: number, inner: number) => boolean
  ) {}

  private buildTurn(
    subjectIds?: number[],
    positionIds?: number[],
    effects?: TurnEffect[],
    baselineValues?: ReadonlyMap<number, unknown>,
    reservedId?: number
  ): TransactionTurnRecord | undefined {
    if (
      (subjectIds?.length ?? 0) === 0 &&
      (positionIds?.length ?? 0) === 0 &&
      (effects?.length ?? 0) === 0
    ) {
      return undefined;
    }

    return {
      id: reservedId ?? this.nextTurnId++,
      restorationSubjectIds: subjectIds ? [...subjectIds] : undefined,
      __positionIds: positionIds ? [...positionIds] : undefined,
      __effects: effects ? effects.map(cloneTurnEffect) : undefined,
      __baselineValues: baselineValues ? new Map(baselineValues) : undefined,
    };
  }

  recordConfirmed(
    subjectIds?: number[],
    positionIds?: number[],
    effects?: TurnEffect[]
  ): TransactionTurnRecord | undefined {
    const turn = this.buildTurn(subjectIds, positionIds, effects);
    if (!turn) {
      return undefined;
    }
    this.insertConfirmed(turn);
    // ORDINARY writes reach the ledger here, not through confirmPending, so
    // without this the obligation bound applied to transactional churn only
    // and `retain: 5` retained 49. Safe by the same argument as confirmPending:
    // a turn recorded while something is pending has a higher id than
    // min(pendingIds) and is kept by `required`.
    this.releaseConfirmedBeyondObligation();
    return cloneTurnRecord(turn);
  }

  /**
   * Reserve a transaction's contribution order before anything can re-enter.
   *
   * The id used to be allocated at materialization, AFTER the post-callback
   * flush. A write made by an observer of the callback's own writes was then
   * recorded first, received the OLDER id, and was invisible to this turn's
   * rollback: `confirmedTurns.filter(t => t.id > pendingId)` excluded it, the
   * obligation bound could evict it, and an external write never entered the
   * dependency ledger because nothing was pending yet. Observed writes must
   * stay later than the transaction they observe.
   *
   * The placeholder owns no second ledger: its effects are a live view of the
   * open capture, so an older handle settled from inside this callback (or by
   * an observer before this handle exists) sees the writes captured so far.
   * `createPending` replaces it; `discardPending` releases it.
   */
  reservePending(bucket: CaptureBucket): number {
    const id = this.nextTurnId++;
    this.pendingTurns.set(id, {
      id,
      get __effects() {
        return [
          ...bucket.effects.values(),
          ...bucket.entityFootprints.values(),
        ];
      },
    });
    this.pendingOpenedAtSeq.set(id, this.ledgerSeq);
    return id;
  }

  createPending(
    reservedId: number,
    subjectIds?: number[],
    positionIds?: number[],
    effects?: TurnEffect[],
    baselineValues?: ReadonlyMap<number, unknown>
  ): TransactionTurnRecord | undefined {
    const turn = this.buildTurn(
      subjectIds,
      positionIds,
      effects,
      baselineValues,
      reservedId
    );
    if (!turn) {
      this.discardPending(reservedId);
      return undefined;
    }
    // Replaces the reservation; its ledger sequence is the opening point.
    this.pendingTurns.set(turn.id, turn);
    this.countPendingPositions(turn, 1);
    this.retainPendingClaims(turn.id, turn.restorationSubjectIds ?? []);
    return cloneTurnRecord(turn);
  }

  /**
   * Record a later effect for dependency purposes, whatever authored it.
   *
   * Returns immediately when nothing is pending, which is what keeps this a
   * projection rather than an inventory: with no outstanding rollback right
   * there is no question to answer and nothing is kept.
   *
   * @internal
   */
  observeLaterEffects(effects: readonly TurnEffect[]): void {
    if (this.pendingTurns.size === 0 || effects.length === 0) {
      return;
    }
    this.ledgerSeq += 1;
    for (const effect of effects) {
      this.dependencyLedger.push({ seq: this.ledgerSeq, effect });
    }
  }

  /** Drop the ledger once no pending turn can ask about it. */
  private releaseLedgerIfQuiet(): void {
    if (this.pendingTurns.size === 0) {
      this.dependencyLedger = [];
      this.sourceDependencies.clear();
      this.ledgerSeq = 0;
      this.pendingOpenedAtSeq.clear();
    }
  }

  confirmPending(turnId: number): TransactionTurnRecord | undefined {
    const turn = this.pendingTurns.get(turnId);
    if (!turn) {
      return undefined;
    }
    this.pendingTurns.delete(turnId);
    this.countPendingPositions(turn, -1);
    this.pendingOpenedAtSeq.delete(turnId);
    this.queuedEvidence.delete(turnId);
    // SETTLED. Confirmation discards rollback state rather than becoming
    // permanent history — those are different product concepts. A tree that
    // also has `restoration()` has already claimed these subjects through its
    // own capture of the same writes, so the subject is not left unowned by
    // the handoff.
    this.releasePendingClaims(turnId);
    this.insertConfirmed(turn);
    this.releaseLedgerIfQuiet();
    // The pending set shrank and a confirmed record arrived: the obligation
    // set changed in both directions.
    this.releaseConfirmedBeyondObligation();
    return cloneTurnRecord(turn);
  }

  discardPending(turnId: number): TransactionTurnRecord | undefined {
    const turn = this.pendingTurns.get(turnId);
    if (!turn) {
      return undefined;
    }
    this.pendingTurns.delete(turnId);
    this.countPendingPositions(turn, -1);
    this.pendingOpenedAtSeq.delete(turnId);
    this.queuedEvidence.delete(turnId);
    this.releasePendingClaims(turnId);
    this.releaseLedgerIfQuiet();
    // Discarding a pending turn can raise min(pendingIds) and so discharge the
    // obligation that was keeping confirmed records alive.
    this.releaseConfirmedBeyondObligation();
    return cloneTurnRecord(turn);
  }

  observeQueuedEffects(turnId: number, queued: readonly TurnEffect[]): void {
    if (!this.pendingTurns.has(turnId)) return;
    // Evidence read before delivery belongs to THIS pending turn. Do not put
    // it in the global sequence ledger: that would make retries duplicate it
    // or incorrectly classify it as later than a subsequently opened turn.
    let retained = this.queuedEvidence.get(turnId);
    if (!retained && queued.length) {
      retained = new Map();
      this.queuedEvidence.set(turnId, retained);
    }
    for (const effect of queued) {
      retained?.set(
        JSON.stringify([
          effect.kind,
          effect.position,
          effect.subject ?? null,
          effect.kind === 'set'
            ? effect.subjectFieldSegments ?? effect.path
            : effect.path,
        ]),
        effect
      );
    }
  }

  getPendingRollbackPlan(
    turnId: number,
    queued: readonly TurnEffect[] = [],
    orderInterference?: OrderInterference
  ): PendingRollbackPlan {
    this.observeQueuedEffects(turnId, queued);
    const pending = this.pendingTurns.get(turnId);
    if (pending && orderInterference)
      return {
        conflict: {
          kind: 'effect-validation-failed',
          pendingTurnId: turnId,
          compensation: [],
          errorMessage: `Collection ordering conflict at ${orderInterference.ownerPath}: an independent order was admitted between this transaction's own order operations`,
        },
      };
    const retained = this.queuedEvidence.get(turnId);
    // A later pending replacement is not settled authority. Reversing its
    // baseline would make its own later rollback resurrect rejected state.
    for (const later of this.pendingTurns.values()) {
      if (later.id <= turnId) continue;
      for (const effect of pending?.__effects ?? []) {
        const overlap = later.__effects?.find(
          (candidate) =>
            (candidate.position === effect.position &&
              (candidate.subject === undefined ||
                effect.subject === undefined ||
                candidate.subject === effect.subject) &&
              (candidate.kind === 'set' && effect.kind === 'set'
                ? scalarRelation(candidate, effect) !== 'disjoint'
                : candidate.path === effect.path ||
                  candidate.path.startsWith(`${effect.path}.`) ||
                  effect.path.startsWith(`${candidate.path}.`))) ||
            // A later pending membership change of an enclosing member
            // captured this location in its own before-image just the same.
            // (v16 integration 8b.)
            (candidate.kind === 'set' &&
              candidate.plainBranchMembership !== undefined &&
              this.encloses?.(candidate.position, effect.position) === true) ||
            (effect.kind === 'set' &&
              effect.plainBranchMembership?.before === false &&
              effect.plainBranchMembership.after === true &&
              this.encloses?.(effect.position, candidate.position) === true)
        );
        if (overlap)
          return {
            conflict: {
              kind: 'later-confirmed-dependency',
              pendingTurnId: turnId,
              pendingEffect: effect,
              conflictingTurnId: later.id,
              conflictingEffect: overlap,
            },
          };

        // KEY OCCUPANCY across pending turns. The check above matches by
        // position/path, so a DIFFERENT subject sitting at a different
        // position never matches — yet a pending add at the key a rekey
        // vacated occupies that key just as physically as a confirmed one,
        // because pending writes are applied optimistically. Without this the
        // arm fell through to the physical-failure door.
        if (effect.kind === 'rekey') {
          const occupant = later.__effects?.find(
            (candidate) =>
              candidate.kind === 'add' &&
              candidate.ownerPath === effect.ownerPath &&
              candidate.key === effect.beforeKey &&
              candidate.subject !== effect.subject
          );
          if (occupant)
            return {
              conflict: {
                kind: 'later-confirmed-dependency',
                pendingTurnId: turnId,
                pendingEffect: effect,
                conflictingTurnId: later.id,
                conflictingEffect: occupant,
              },
            };
        }
      }
    }
    const authoredLater = this.confirmedTurns
      .filter((turn) => turn.id > turnId)
      .flatMap((turn) =>
        (turn.__effects ?? []).map((effect) => ({ turnId: turn.id, effect }))
      );

    // TX-LEDGER C3. Effects with no authored turn of their own — a realization,
    // typically — count when they landed after THIS turn opened. Admission is by
    // dependence: `buildPendingRollbackPlan` decides relevance by position and
    // subject overlap, so an unrelated realization is ignored exactly as an
    // unrelated authored write is.
    const openedAt = this.pendingOpenedAtSeq.get(turnId) ?? 0;
    const observedLater = this.dependencyLedger
      .filter((entry) => entry.seq > openedAt)
      .map((entry) => ({
        entry: { turnId, effect: entry.effect },
        seq: entry.seq,
      }));

    // REKEY-OCCUPANCY-0 follow-up. These three sources are concatenated by
    // ORIGIN, so without a merge key every authored effect sorts before every
    // realized one regardless of when each happened. Both folds downstream —
    // `erased` and the net-occupancy loop — are last-write-wins and therefore
    // read a wrong "latest" for any key touched by more than one source.
    //
    // `ledgerSeq` is the shared clock: pending turns are already stamped with
    // it on open, and confirmed turns are now stamped on insertion.
    const ordered = [
      ...authoredLater.map((entry) => ({
        entry,
        seq: this.confirmedAtSeq.get(entry.turnId) ?? 0,
      })),
      ...observedLater,
    ]
      .sort((a, b) => a.seq - b.seq)
      .map((wrapped) => wrapped.entry);

    // Queued evidence stays last: it is read before delivery and belongs to
    // THIS turn, so it is not part of the shared chronology.
    return buildPendingRollbackPlan(
      this.pendingTurns.get(turnId),
      [
        ...ordered,
        ...[...this.sourceDependencies.values()].flatMap((effects) =>
          effects.map((effect) => ({ turnId, effect }))
        ),
        ...[...(retained?.values() ?? [])].map((effect) => ({
          turnId,
          effect,
        })),
      ],
      this.encloses
    );
  }

  setHistoryRetention(retain: number): void {
    this.historyRetain = Number.isFinite(retain) && retain > 0 ? retain : 0;
    this.releaseConfirmedBeyondObligation();
  }

  /**
   * L15: correctness retention follows live responsibility.
   *
   * `getPendingRollbackPlan` is the ONLY correctness consumer of this ledger,
   * and it selects `confirmedTurns.filter(t => t.id > pendingId)`. Turn ids are
   * monotonic, so a confirmed turn can only ever be needed by a pending turn
   * OLDER than itself. Once no such pending turn remains, the record can never
   * appear in any future plan, and keeping it is diagnostics, not correctness.
   * (A `hasConfirmedTurnAfter` reader existed alongside it with no call sites
   * anywhere and was deleted, so it imposes no obligation either.)
   *
   * This is not an arbitrary cap: the bound is derived from the obligation.
   * `historyRetain` is a SEPARATE, explicitly requested evidence facility
   * layered on top of it.
   */
  private releaseConfirmedBeyondObligation(): void {
    // Correctness-only is the DEFAULT (owner decision, 2026-09-24). Retaining
    // records inside the correctness machinery for diagnostic purposes is the
    // L15 violation itself, and the old default asserted a complete history
    // that no contract backed — `truncated: false` was true only because
    // nothing evicted. Diagnostics are now requested explicitly via
    // `transactions({ history: { retain } })`, and the reader reports what it
    // actually kept.
    if (this.confirmedTurns.length === 0) return;
    let minPending = Infinity;
    for (const id of this.pendingTurns.keys()) {
      if (id < minPending) minPending = id;
    }
    const required = (turn: TransactionTurnRecord) => turn.id > minPending;
    const before = this.confirmedTurns.length;
    if (this.historyRetain <= 0) {
      this.confirmedTurns = this.confirmedTurns.filter(required);
      if (this.confirmedTurns.length < before) this.evictedConfirmed = true;
      this.forgetStampsOutside();
      return;
    }
    const keep = new Set<number>();
    for (const turn of this.confirmedTurns)
      if (required(turn)) keep.add(turn.id);
    for (const turn of this.confirmedTurns.slice(-this.historyRetain))
      keep.add(turn.id);
    this.confirmedTurns = this.confirmedTurns.filter((t) => keep.has(t.id));
    if (this.confirmedTurns.length < before) this.evictedConfirmed = true;
    this.forgetStampsOutside();
  }

  /**
   * `confirmedAtSeq` is CORRECTNESS state — `getPendingRollbackPlan` reads it
   * to order `authoredLater` — so L15 binds it exactly as it binds the records
   * themselves. Bounding the array while letting the stamps accumulate left
   * ~50 B per settled turn growing linearly forever while the ledger reported
   * zero retained records, which made "correctness-only retention" only half
   * true.
   */
  private forgetStampsOutside(): void {
    if (this.confirmedAtSeq.size === 0) return;
    const live = new Set(this.confirmedTurns.map((turn) => turn.id));
    for (const id of this.confirmedAtSeq.keys()) {
      if (!live.has(id)) this.confirmedAtSeq.delete(id);
    }
  }

  /** Explicit retention metadata for the reader. Never inferred from ids. */
  getConfirmedRetention(): {
    truncated: boolean;
    firstAvailableTurnId?: number;
  } {
    return {
      truncated: this.evictedConfirmed,
      firstAvailableTurnId: this.confirmedTurns[0]?.id,
    };
  }

  releaseConfirmedTurnsOnDestroy(): void {
    this.confirmedAtSeq.clear();
    // Drop authority ownership without mutating records or arrays already
    // returned to callers. Live history retention remains unchanged.
    this.confirmedTurns = [];
  }

  getConfirmedTurnCount(): number {
    return this.confirmedTurns.length;
  }

  getPendingTurn(
    turnId: number | undefined
  ): TransactionTurnRecord | undefined {
    return turnId === undefined ? undefined : this.pendingTurns.get(turnId);
  }

  getPendingTurnCount(): number {
    return this.pendingTurns.size;
  }

  getConfirmedTurnIds(): number[] {
    return this.confirmedTurns.map((turn) => turn.id);
  }

  getPendingTurnIds(): number[] {
    return [...this.pendingTurns.keys()].sort((left, right) => left - right);
  }

  /** Whether a still-pending turn wrote this position; its rollback needs the realization. */
  isPositionPending(position: number): boolean {
    return this.pendingPositionCounts.has(position);
  }

  private countPendingPositions(
    turn: TransactionTurnRecord,
    delta: 1 | -1
  ): void {
    for (const position of new Set(turn.__positionIds ?? [])) {
      const next = (this.pendingPositionCounts.get(position) ?? 0) + delta;
      if (next > 0) this.pendingPositionCounts.set(position, next);
      else this.pendingPositionCounts.delete(position);
    }
  }

  /**
   * @internal Raw retained records, for the `/internals` read seam.
   *
   *     A PROJECTION ON THIS CLASS CANNOT BE TREE-SHAKEN.
   *
   * ⚠️ This used to be `readConfirmedTurns()`, which built the whole
   * `ConfirmedTurnView` here. Class methods are retained whenever the class is
   * instantiated, and the transactions enhancer always instantiates this one —
   * so every consumer of `transactions()` paid for the projection whether or
   * not any tool ever read it. Measured: +489 B minified / +161 B gzip against
   * a 100 B budget.
   *
   * The projection now lives in `internals.ts` and is pulled in only by a build
   * that imports `@signal-tree/kernel/internals`. What remains here is the
   * narrow accessor that cannot live anywhere else.
   */
  getConfirmedTurnRecords(): readonly TransactionTurnRecord[] {
    return this.confirmedTurns;
  }

  /**
   * When each confirmed turn entered the ledger, on the SAME clock the
   * dependency ledger uses. Without this, later-effects can only be ordered
   * within their own source.
   */
  private confirmedAtSeq = new Map<number, number>();

  private insertConfirmed(turn: TransactionTurnRecord): void {
    // The clock must tick for AUTHORED work too. It previously advanced only
    // inside `observeLaterEffects`, so every authored confirmation shared
    // whatever value a realization had last left behind — stamps tied, the
    // stable sort fell back to source order, and the merge was no better than
    // the concatenation it replaced.
    this.ledgerSeq += 1;
    this.confirmedAtSeq.set(turn.id, this.ledgerSeq);
    const insertIndex = this.confirmedTurns.findIndex(
      (candidate) => candidate.id > turn.id
    );
    if (insertIndex === -1) {
      this.confirmedTurns.push(turn);
    } else {
      this.confirmedTurns.splice(insertIndex, 0, turn);
    }
  }
}

function cloneTurnRecord(turn: TransactionTurnRecord): TransactionTurnRecord {
  return {
    ...turn,
    restorationSubjectIds: turn.restorationSubjectIds
      ? [...turn.restorationSubjectIds]
      : undefined,
    __positionIds: turn.__positionIds ? [...turn.__positionIds] : undefined,
    __effects: turn.__effects ? turn.__effects.map(cloneTurnEffect) : undefined,
    __baselineValues: turn.__baselineValues
      ? new Map(turn.__baselineValues)
      : undefined,
  };
}

function createCaptureBucket(): CaptureBucket {
  return {
    entityFootprints: new Map(),
    ownWriteSeq: new Map<string, number>(),
    ownerPaths: new Set<string>(),
    subjectIds: new Set<number>(),
    positionIds: new Set<number>(),
    baselineValues: new Map(),
    effects: new Map(),
    occupancy: new Map(),
    orderBoundaries: new Map(),
    collectionOrders: new Map(),
  };
}

/**
 * @internal Read the transaction runtime WITHOUT creating one.
 *
 * ⚠️ NEVER USE `getOrCreateInternalTransactionRuntime` FOR OBSERVATION. It
 * allocates a `TransactionAuthority` for a tree that may never have run a
 * transaction, which is exactly the "no retained state when unused" rule the
 * Studio seam has to satisfy. Observation peeks; it does not install.
 */
export function peekInternalTransactionRuntime<
  T,
  C extends CarrierKind = CarrierKind,
  TAccum = unknown
>(tree: ToolingTree<T, C, TAccum>): InternalTransactionRuntime | undefined {
  return (tree as unknown as Record<PropertyKey, unknown>)[
    INTERNAL_TRANSACTION_RUNTIME
  ] as InternalTransactionRuntime | undefined;
}

export function getOrCreateInternalTransactionRuntime<T>(
  tree: ISignalTree<T>
): InternalTransactionRuntime {
  const existing = (tree as unknown as Record<PropertyKey, unknown>)[
    INTERNAL_TRANSACTION_RUNTIME
  ] as InternalTransactionRuntime | undefined;
  if (existing) {
    return existing;
  }

  const authority = new TransactionAuthority(
    (turnId, subjectIds) => {
      if (subjectIds.length === 0) {
        return;
      }
      getOrCreateSubjectRestorationClaims(tree)?.retain(
        `transaction:${turnId}`,
        subjectIds
      );
    },
    (turnId) => {
      // Settlement can precede restoration capture. Queue last-owner releases
      // for the shared post-capture boundary, never reclaim them inline.
      reclamation.offer(getOrCreateSubjectRestorationClaims(tree)?.release(
        `transaction:${turnId}`
      ) ?? []);
    },
    // Structured addresses, never display paths: `outer` encloses `inner`
    // when its address is a strict prefix of inner's.
    (outer, inner) => {
      const registry = getPositionRegistry(tree.$);
      const prefix = registry?.addressFor(outer);
      const address = registry?.addressFor(inner);
      return (
        !!prefix &&
        !!address &&
        prefix.length < address.length &&
        prefix.every((key, index) => key === address[index])
      );
    }
  );
  // Only this initializer's resources: normal destruction and failed attachment
  // share releases. Clear the captured callback before invoking it so retries and
  // later tree destruction cannot release a replacement owner's resources.
  const ownedCleanups = new Set<() => void>();
  const registerOwnedCleanup = (cleanup: () => void): void => {
    let current: (() => void) | undefined = cleanup;
    const release = (): void => {
      const run = current;
      current = undefined;
      ownedCleanups.delete(release);
      run?.();
    };
    ownedCleanups.add(release);
    tree.registerCleanup(release);
  };
  const unwindOwnedInitialization = (): void => {
    for (const release of [...ownedCleanups].reverse()) {
      try { release(); }
      catch (error) { reportCleanupFailure('initialization unwind', error); }
    }
  };
  const transactionOwnerToken = {};
  let nextTransactionId = 1;
  let destroyed = false;
  const isRestoring = false;
  let selfDirty = false;
  let unsubscribeFlush: (() => void) | null = null;
  let unsubscribeNotifications: (() => void) | null = null;
  let unsubscribeEnqueue: (() => void) | null = null;
  let unsubscribeReset: (() => void) | null = null;
  let unsubscribeCollectionOrders: (() => void) | null = null;
  let restoreLeafInterceptors: (() => void) | null = null;
  let scalarAttachmentFailed=false;
  const pendingCapture = createCaptureBucket();
  const pendingTransactions = new Map<number, CaptureBucket>();
  const reclamation = initializeSubjectReclamation(
    { $: tree.$, registerCleanup: registerOwnedCleanup },
    () => pendingTransactions.size === 0
  );
  // External writes can arrive while the callback is still collecting, before
  // it has a turn id. Keep that evidence under the transaction id until admission.
  const callbackExternalEffects = new Map<number, TurnEffect[]>();
  let sourceRevision = 0;
  const sourceSegments = new Map<
    string,
    { writer: number | undefined; segment: number }
  >();
  const sourceAdmissions = new Map<number, readonly TurnEffect[]>();
  let pairedEntityAdmissions = new WeakMap<object, CaptureIdentity>();
  // Only the exact ordinary fact admitted by the source may suppress its
  // notification projection. Sibling writers without preparation stay visible.
  const unpairedEntityMetadata = (
    meta: WriteMetadata | undefined
  ): WriteMetadata | undefined => {
    const changes = getEntityOrdinaryChanges(meta);
    return changes === undefined
      ? meta
      : withEntityOrdinaryChanges(
          meta,
          changes.filter((change) => !pairedEntityAdmissions.has(change))
        );
  };
  const sourceLifetimeKey = (effect: TurnEffect): string =>
    `${effect.position}:${effect.subject ?? ''}`;

  // Inspection owns local mutation chronology, not conservative rollback evidence.
  // Keep only the latest footprint per location/writer while a pending is open.
  type InspectionWrite = { seq: number; effect: TurnEffect };
  let inspectionSeq = 0;
  let inspectionUnavailable = false;
  const inspectionWrites = new Map<
    number | undefined,
    Map<string, InspectionWrite>
  >();
  const inspectionTransactionByTurn = new Map<number, number>();
  // L19. The enqueue observer records inspection evidence, and its callback is
  // a no-op unless a transaction or pending turn exists. But merely REGISTERING
  // it makes PathNotifier build a frozen evidence snapshot on every write for
  // this owner, idle or not -- measured at roughly 2.6x ordinary write cost on
  // a tree that never transacts. So it is registered on demand: before the
  // first write that can create causal responsibility (a transaction opening),
  // and released at the same quiescence point that clears inspection state.
  // The snapshot copy never alters queued entries or delivery, so registering
  // lazily cannot change what any other notifier consumer observes.
  //
  // Release is DEFERRED to a microtask and cancelled if a transaction reopens
  // first. Releasing synchronously at every quiescence made a tree that
  // transacts on every write pay a register/release pair per transaction --
  // measured at ~6-7% on that path, repeatably. Deferring keeps a synchronous
  // burst registered throughout, while a tree that goes idle still releases.
  let registerEnqueueObserver: (() => void) | null = null;
  let enqueueReleaseScheduled = false;
  const ensureEnqueueObserver = (): void => {
    if (!unsubscribeEnqueue && !destroyed) registerEnqueueObserver?.();
  };
  const releaseEnqueueObserverWhenIdle = (): void => {
    if (enqueueReleaseScheduled || !unsubscribeEnqueue) return;
    enqueueReleaseScheduled = true;
    queueMicrotask(() => {
      enqueueReleaseScheduled = false;
      if (authority.getPendingTurnCount() || pendingTransactions.size) return;
      unsubscribeEnqueue?.();
      unsubscribeEnqueue = null;
    });
  };
  const releaseInspectionIfQuiet = (): void => {
    if (authority.getPendingTurnCount() || pendingTransactions.size) return;
    inspectionWrites.clear();
    sourceSegments.clear();
    sourceAdmissions.clear();
    pairedEntityAdmissions = new WeakMap();
    inspectionTransactionByTurn.clear();
    transactionOrderAdmissions.clear();
    inspectionSeq = 0;
    inspectionUnavailable = false;
    releaseEnqueueObserverWhenIdle();
  };
  const pendingOrderDeltas = new Map<number, CollectionOrderDelta[]>();
  // Value-free source admission chronology. Endpoint folding cannot retire an
  // independent order hidden between two own full-order operations, even ABA.
  let orderAdmission = 0;
  const transactionOrderAdmissions = new Map<
    number,
    Map<
      number,
      {
        independentAfterOwn?: number;
        conflict?: OrderInterference;
      }
    >
  >();
  const orderInterferenceFor = (
    transactionId: number
  ): OrderInterference | undefined => {
    for (const admission of transactionOrderAdmissions
      .get(transactionId)
      ?.values() ?? [])
      if (admission.conflict) return admission.conflict;
    return undefined;
  };
  const pendingCreatedListeners = new Set<TransactionLifecycleListener>();
  const pendingConfirmedListeners = new Set<TransactionLifecycleListener>();
  const pendingDiscardedListeners = new Set<TransactionLifecycleListener>();
  /**
   * Lifecycle observation (`transactionLifecycleReader`). One record per
   * transaction from its 'opened' announcement until its handle settles or its
   * reservation is abandoned. Not a second pending ledger: the authority and
   * the handle decide; this mirrors their transitions for the read-only feed.
   */
  type LifecycleView = { transactionId: number; phase: 'opened' | 'staged' };
  const lifecycleViews = new Map<number, LifecycleView>();
  // The scope is the authority on consequences. It opens after the 'opened'
  // announcement, so a transaction whose scope is not yet open has released
  // nothing either.
  const lifecycleScopes = new Set<number>();
  const consequencesReleased = (transactionId: number): boolean =>
    lifecycleScopes.has(transactionId) &&
    !isCommitScopeOpen(transactionOwnerToken, transactionId);
  // Transitions are counted here so a reader that attaches late still sees a
  // coherent sequence; everything else waits for an observer to attach.
  let lifecycleSequence = 0;
  let lifecycleObserver: TransactionLifecycleObserver | undefined;
  const lifecycleRegistry = getPositionRegistry(tree.$);
  if (lifecycleRegistry)
    defineTransactionLifecycleSource(lifecycleRegistry, {
      treeId: lifecycleRegistry.id,
      read: () => ({
        sequence: lifecycleSequence,
        pending: [...lifecycleViews.values()].map(
          ({ transactionId, phase }) => ({
            transactionId,
            phase,
            consequencesReleased: consequencesReleased(transactionId),
          })
        ),
      }),
      attach: (observer) => {
        lifecycleObserver = observer;
      },
    });
  if (lifecycleRegistry)
    research.register(
      lifecycleRegistry.id,
      { read: () => ({ pending: [...lifecycleViews.values()] }) },
      transactionOwnerToken
    );
  const publishLifecycle = (fact: TransactionLifecycleFact): void => {
    research.transition(lifecycleRegistry?.id, fact);
    lifecycleSequence++;
    lifecycleObserver?.record(fact);
  };
  const holdLifecycle = () => lifecycleObserver?.hold();
  const retireLifecycleView = (transactionId: number): void => {
    lifecycleViews.delete(transactionId);
    lifecycleScopes.delete(transactionId);
  };
  /**
   * A transaction the owner gave up before it had a handle: it leaves the
   * snapshot under a new sequence. The engine announces no terminal transition
   * on these paths, so the reader invents none; only the count advances.
   */
  const abandonLifecycleView = (transactionId: number): void => {
    if (!lifecycleViews.has(transactionId)) return;
    research.transition(lifecycleRegistry?.id, {
      kind: 'abandoned',
      transactionId,
    });
    retireLifecycleView(transactionId);
    lifecycleSequence++;
  };
  /** A refusal it threw; the reader classifies it from the error's cause. */
  const publishRefusal = (transactionId: number, error: unknown): void =>
    publishLifecycle({ kind: 'refused', transactionId, error });
  const realizationTree = tree as unknown as ISignalTree<object>;
  const treeWrapper = tree as unknown as object;
  const stateRoot = tree.$ as unknown as object;
  const realizationDescriptors =
    getTreeRealizationDescriptors(stateRoot) ??
    getTreeRealizationDescriptors(treeWrapper) ??
    new Map();
  defineTreeRealizationDescriptors(treeWrapper, realizationDescriptors);
  defineTreeRealizationDescriptors(stateRoot, realizationDescriptors);
  const realizationPort =
    getTreeRealizationPort(stateRoot) ??
    getTreeRealizationPort(treeWrapper) ??
    createTreeRealizationAdapter({
      tree: realizationTree,
      descriptors: realizationDescriptors,
    });
  defineTreeRealizationPort(treeWrapper, realizationPort);
  defineTreeRealizationPort(stateRoot, realizationPort);

  // TX-AUTO-ROLLBACK-0. The rollback after a failure that happens AFTER the
  // callback returned (the invalidation group closing, the capture failing
  // to release) runs while transact() is still in progress, when observers
  // have already had a chance to write the same locations: a location
  // subscriber or framework effect at the group close, an observeWrites
  // subscriber in the flush, a transaction one of them opened. Restoring this
  // transaction's before-image over such a write would destroy it, so that
  // rollback refuses when a later write touched one of its locations; the
  // recovery handle attached to the refusal leaves the decision with the
  // caller. The throwing-callback rollback is unchanged from 9df8fbff.
  //
  // A location is a position, or a position and an entity subject: every
  // entityMap write carries the collection's single position and names the
  // row only in subjectIds, so keying by position alone made a write to ANY
  // other row look like a conflict. A write naming no subject (a scalar, or a
  // collection-level write) conflicts with every row at its position.
  //
  // Writes are sequenced only while a transaction is open, and the record is
  // cleared whenever none is, so nothing accumulates.
  let windowWriteSeq = 0;
  const lastWindowWriteSeq = new Map<string, number>();
  const lastWindowRowWriteSeq = new Map<number, number>();
  const windowKeys = (
    positionIds?: readonly number[],
    subjectIds?: readonly number[]
  ): string[] => {
    const keys: string[] = [];
    for (const position of positionIds ?? []) {
      if (subjectIds && subjectIds.length > 0) {
        for (const subject of subjectIds) keys.push(`${position}:${subject}`);
      } else {
        keys.push(String(position));
      }
    }
    return keys;
  };
  const recordWindowWrite = (
    positionIds?: readonly number[],
    subjectIds?: readonly number[]
  ): void => {
    const seq = ++windowWriteSeq;
    for (const key of windowKeys(positionIds, subjectIds)) {
      lastWindowWriteSeq.set(key, seq);
      const colon = key.indexOf(':');
      if (colon !== -1) {
        lastWindowRowWriteSeq.set(Number(key.slice(0, colon)), seq);
      }
    }
  };
  const writtenSinceBy = (bucket: CaptureBucket): boolean => {
    for (const [key, own] of bucket.ownWriteSeq) {
      const colon = key.indexOf(':');
      const position = colon === -1 ? key : key.slice(0, colon);
      // The same location, or a subject-less write at its position.
      if ((lastWindowWriteSeq.get(key) ?? 0) > own) return true;
      if ((lastWindowWriteSeq.get(position) ?? 0) > own) return true;
      // A subject-less location is touched by a write to any of its rows.
      if (
        colon === -1 &&
        (lastWindowRowWriteSeq.get(Number(position)) ?? 0) > own
      ) {
        return true;
      }
    }
    return false;
  };
  const releaseWindowIfClosed = (): void => {
    if (pendingTransactions.size === 0) {
      reclamation.resume();
      lastWindowWriteSeq.clear();
      lastWindowRowWriteSeq.clear();
    }
  };

  // LINK-OVERLAP-ROLLBACK-0. A descriptor this settlement would forget can
  // still be needed by an OVERLAPPING transaction: its rollback resolves the
  // path to notify on through the descriptor, and with the descriptor gone the
  // compensation is applied silently -- no subscriber, Link included, learns
  // the value changed back. Such a descriptor is kept.
  //
  // It is deliberately NOT collected later. A later transaction's
  // before-snapshot protects it like any descriptor that predates it, and
  // restoration's undo relies on that protection: an earlier revision
  // collected spared descriptors once nothing pending needed them, and a
  // later undo of the same location then notified nobody. The cost is at most
  // one descriptor per written position, the steady state ordinary writes
  // already produce.
  //
  // Only the settling transaction's OWN positions are examined: every
  // descriptor its capture created is keyed by one of them. Scanning the whole
  // map made each settlement O(descriptors), and settling P overlapping
  // transactions O(P^2). Deleting less can never silence a notification.
  //
  // Subject details are released only when unclaimed AND not captured by a
  // still-open callback: such a capture has recorded reversal inputs before
  // materialization registers its pending claims, and a reentrant ordinary
  // flush can complete in that interval. Position shells are only examined for
  // a settling transaction's own positions; an ordinary flush releases subject
  // details and leaves every shell routing notifications.
  const forgetUnclaimedDescriptorSubjects = (
    subjectIds: readonly number[],
    descriptorOwnersBefore?: ReadonlySet<number>,
    ownPositions: readonly number[] = []
  ): void => {
    if (subjectIds.length === 0 && ownPositions.length === 0) return;
    const claims = getSubjectRestorationClaims(tree);
    const unclaimed = [...new Set(subjectIds)].filter((subjectId) => {
      if (claims?.isClaimed(subjectId)) return false;
      for (const bucket of pendingTransactions.values())
        if (bucket.subjectIds.has(subjectId)) return false;
      return true;
    });
    forgetSubjectsInTreeRealizationDescriptors(
      realizationDescriptors,
      unclaimed
    );
    const neededByPending = (owner: number): boolean => {
      if (authority.isPositionPending(owner)) return true;
      // An OPEN transaction's writes are normally captured (and their
      // descriptors recreated) at its post-callback flush, after anything its
      // callback settles. This covers a flush inside the callback; there can
      // be more than one open bucket when an observer opened a transaction
      // while another had not returned yet.
      for (const bucket of pendingTransactions.values())
        if (bucket.positionIds.has(owner)) return true;
      return false;
    };
    for (const owner of new Set(ownPositions)) {
      if (descriptorOwnersBefore?.has(owner)) {
        continue;
      }
      const descriptor = realizationDescriptors.get(owner);
      if (
        descriptor &&
        (descriptor.subjectDescriptors?.size ?? 0) === 0 &&
        (descriptor.structuralEffects?.size ?? 0) === 0 &&
        (descriptor.structuralEffectBySubject?.size ?? 0) === 0 &&
        !neededByPending(owner)
      ) {
        realizationDescriptors.delete(owner);
      }
    }
  };

  const notifyListeners = (
    listeners: Set<TransactionLifecycleListener>,
    turn: TransactionTurnRecord
  ): void => {
    const payload = cloneTurnRecord(turn);
    for (const listener of listeners) {
      // TX-OBSERVER-STRAND-0. A listener observes a turn that already exists;
      // its throw would cost the caller the handle for it.
      try {
        listener(payload);
      } catch (error) {
        reportContainedObserverError({
          error,
          operation: 'transaction:listener',
          treeId: getPositionRegistry(tree.$)?.id,
        });
      }
    }
  };

  const drainCaptureBucket = (
    bucket: CaptureBucket
  ): {
    ownerPaths: string[];
    subjectIds: number[];
    positionIds: number[];
    baselineValues: Map<number, unknown>;
    effects: TurnEffect[];
    collectionOrders: Array<Omit<CollectionOrderCapture, 'meta'>>;
  } => {
    const ownerPaths = Array.from(bucket.ownerPaths).sort();
    bucket.ownerPaths.clear();
    bucket.ownWriteSeq.clear();
    bucket.entityFootprints.clear();
    const subjectIds = Array.from(bucket.subjectIds).sort((a, b) => a - b);
    bucket.subjectIds.clear();
    const positionIds = Array.from(bucket.positionIds).sort((a, b) => a - b);
    bucket.positionIds.clear();
    const baselineValues = new Map(bucket.baselineValues);
    bucket.baselineValues.clear();
    // A transaction's member images are its endpoints, and net no-ops are
    // dropped only now, as restoration's turns (`settleTurnMemberEffects`,
    // v16 8g): rollback of `x(5); omit g; re-add g` came back with x 5.
    const effects = settleTurnMemberEffects(
      tree.$ as object,
      Array.from(bucket.effects.values()).filter(Boolean).map(cloneTurnEffect)
    );
    bucket.effects.clear();
    bucket.occupancy.clear();
    const collectionOrders = Array.from(bucket.collectionOrders.values()).map(
      (order) =>
        completeOrderCapture(
          {
            ...order,
            beforeSubjects: [...order.beforeSubjects],
            afterSubjects: [...order.afterSubjects],
          },
          materializeOrderBoundaries(bucket.orderBoundaries.get(order.owner))
        )
    );
    bucket.collectionOrders.clear();
    bucket.orderBoundaries.clear();
    return {
      ownerPaths,
      subjectIds,
      positionIds,
      baselineValues,
      effects,
      collectionOrders,
    };
  };

  const rememberBaselineValue = (
    bucket: CaptureBucket,
    effect: TurnEffect
  ): void => {
    if (!bucket.baselineValues.has(effect.position)) {
      switch (effect.kind) {
        case 'set':
          bucket.baselineValues.set(effect.position, effect.before);
          break;
        case 'add':
          bucket.baselineValues.set(effect.position, undefined);
          break;
        case 'remove':
          bucket.baselineValues.set(effect.position, effect.key);
          break;
        case 'rekey':
          bucket.baselineValues.set(effect.position, effect.beforeKey);
          break;
      }
    }
  };

  const effectKey = (effect: TurnEffect): string => {
    switch (effect.kind) {
      case 'set':
        return JSON.stringify([
          effect.kind,
          effect.position,
          effect.subject,
          effect.subjectFieldSegments ?? effect.path,
        ]);
      // RESTORE-P0 P0-B: keyed by SUBJECT, deliberately without `kind`, so the
      // transaction's effects on one subject collide and can be composed into
      // the NET effect. With `kind` in the key, `rekey('a','a2')` and
      // `removeOne('a2')` occupied separate slots and rollback applied both
      // inverses, returning the row under the name it had been renamed TO.
      // Mirrors the same repair in restoration.ts.
      case 'remove':
      case 'add':
      case 'rekey':
        return `structural\u0000${effect.ownerPath}\u0000${effect.position}\u0000${effect.subject}`;
    }
  };

  // Semantic overlap and authored segment identity are deliberately distinct.
  const captureKey = (effect: TurnEffect): string => {
    const identity = identityOf(effect);
    return identity
      ? `${effectKey(effect)}\u0000segment:${identity.segment}`
      : effectKey(effect);
  };

  const enqueueEffect = (
    bucket: CaptureBucket,
    effectMap: PendingEffectMap,
    effect: TurnEffect
  ): void => {
    const key = captureKey(effect);
    const identity = identityOf(effect);
    if (effect.kind !== 'set') {
      // All capture routes use the same interval endpoints. Retain canceled
      // occupancy independently of the visible effect map until capture drains.
      const previous = bucket.occupancy.get(key);
      const state = composeOccupancy(previous, effect);
      const normalized = occupancyEffect(state);
      if (normalized && identity) identify(normalized, identity);
      // A rebind can carry an explicitly authored ordinary value as well as
      // occupancy. Keep that value transition when occupancy becomes rekey or
      // cancels. Inputs are admitted ordinary images, never physical display.
      if (
        effect.kind === 'add' &&
        previous?.beforeKey !== undefined &&
        previous.latestRemoval
      ) {
        const fields = createCaptureBucket();
        captureEffects(
          fields,
          fields.effects,
          effect.path,
          effect.value,
          previous.latestRemoval.value,
          undefined,
          effect.ownerPath,
          [effect.subject],
          [effect.position]
        );
        for (const field of fields.effects.values()) {
          if (field.kind !== 'set')
            throw new Error('Invalid rebind field fact');
          if (identity) identify(field, identity);
          bucket.derivedFields?.push(cloneTurnEffect(field) as ScalarSetEffect);
          enqueueEffect(bucket, effectMap, field);
        }
      }
      bucket.occupancy.set(key, state);
      if (effectMap !== bucket.entityFootprints)
        rememberBaselineValue(bucket, effect);
      if (normalized) effectMap.set(key, normalized);
      else effectMap.delete(key);
      return;
    }
    let existing = effectMap.get(key);
    if (!existing && bucket.priorEffects) {
      const prior = bucket.priorEffects.get(key);
      if (prior) {
        existing = cloneTurnEffect(prior);
        effectMap.set(key, existing);
      }
    }
    if (existing) {
      if (existing.kind === 'set' && effect.kind === 'set') {
        const replaceBaseline=!existing.plainBranchMembership&&effect.plainBranchMembership?.before===false;
        if (identity) identify(existing, identity);
        if (!composePlainBranchMemberEffect(existing, effect)) {
          existing.after = effect.after;
          // Preserve first own-presence before and latest own-presence after.
          const beforePresent = existing.fieldPresence?.before ?? true;
          const afterPresent = effect.fieldPresence?.after ?? true;
          if (beforePresent && afterPresent) delete existing.fieldPresence;
          else
            existing.fieldPresence = {
              before: beforePresent,
              after: afterPresent,
            };
        }
        composeFieldEndpoints(existing,effect,replaceBaseline);
        existing.mutationIntent = combineScalarMutationIntent(
          existing.mutationIntent,
          effect.mutationIntent
        );
        // A net no-op stays in the transaction's effects until they are
        // drained (`settleTurnMemberEffects`); a footprint drops it at once.
        if (
          effectMap === bucket.entityFootprints &&
          plainBranchMemberEffectIsNoop(existing) &&
          (existing.fieldPresence?.before ?? true) ===
            (existing.fieldPresence?.after ?? true)
        ) {
          effectMap.delete(key);
        }
        return;
      }

      return;
    }
    if (effectMap !== bucket.entityFootprints) {
      rememberBaselineValue(bucket, effect);
    }
    effectMap.set(key, effect);
  };

  const buildTurnEffectFromStructural = (
    meta: WriteMetadata | undefined,
    ownerPath: string,
    path: string,
    positionIds?: number[],
    subjectIds?: number[]
  ): TurnEffect | undefined => {
    const position = positionIds?.[0];
    const subject = subjectIds?.[0];
    if (position === undefined || subject === undefined) {
      return undefined;
    }

    const effect = meta?.structuralEffect;
    if (!effect || effect.subject !== subject) {
      return undefined;
    }

    return {
      ...effect,
      ownerPath,
      path,
      position,
    } as TurnEffect;
  };

  const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof Map) &&
    !(value instanceof Set);

  const captureEffects = (
    bucket: CaptureBucket,
    effectMap: PendingEffectMap,
    path: string,
    next: unknown,
    prev: unknown,
    meta?: WriteMetadata,
    ownerPath?: string,
    subjectIds?: number[],
    positionIds?: number[]
  ): void => {
    if (getEntityOrdinaryChanges(meta) !== undefined) {
      for (const entry of ordinaryEntityEntries({
        path,
        newValue: next,
        oldValue: prev,
        meta,
        subjectIds,
      })) {
        captureEffects(
          bucket,
          effectMap,
          entry.path,
          entry.newValue,
          entry.oldValue,
          entry.meta,
          ownerPath,
          entry.subjectIds,
          positionIds
        );
      }
      return;
    }
    const membership = plainBranchMembershipEffects(meta);
    if (membership) {
      for (const effect of membership) {
        bucket.positionIds.add(effect.position);
        enqueueEffect(bucket, effectMap, effect);
      }
      return;
    }
    const structuralEffect = ownerPath
      ? buildTurnEffectFromStructural(
          meta,
          ownerPath,
          path,
          positionIds,
          subjectIds
        )
      : undefined;
    if (structuralEffect) {
      enqueueEffect(bucket, effectMap, structuralEffect);
      return;
    }

    if (next === undefined && prev === undefined) {
      return;
    }

    // Payload shape is not topology (v15 2892b650): a registered terminal
    // slot owns its whole value, so a plain-object replacement stays one
    // effect. Only branch and subject (entity row) values decompose by field.
    if (
      isPlainRecord(next) &&
      isPlainRecord(prev) &&
      !(
        !subjectIds?.length &&
        positionIds?.[0] !== undefined &&
        (
          getTreeScalarSlotRuntime(tree) ?? getTreeScalarSlotRuntime(tree.$)
        )?.resolveScalarSlot(positionIds[0]) !== undefined
      )
    ) {
      const position = positionIds?.[0];
      const subject = subjectIds?.[0];
      if (position === undefined) {
        return;
      }
      const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
      for (const key of keys) {
        const before = prev[key];
        const after = next[key];
        const beforePresent = Object.prototype.hasOwnProperty.call(prev, key);
        const afterPresent = Object.prototype.hasOwnProperty.call(next, key);
        if (before === after && beforePresent === afterPresent) {
          continue;
        }
        enqueueEffect(bucket, effectMap, {
          kind: 'set',
          path: `${path}.${key}`,
          ownerPath: ownerPath ?? path,
          position,
          subject,
          subjectFieldSegments: subject === undefined ? undefined : [key],
          ...(subject !== undefined && !(beforePresent && afterPresent)
            ? { fieldPresence: { before: beforePresent, after: afterPresent } }
            : {}),
          before,
          after,
          mutationIntent: meta?.mutationIntent,
        });
      }
      return;
    }

    const position = positionIds?.[0];
    if (position === undefined || prev === next) {
      return;
    }

    enqueueEffect(bucket, effectMap, {
      kind: 'set',
      path,
      ownerPath: ownerPath ?? path,
      position,
      subject: subjectIds?.[0],
      before: prev,
      after: next,
      mutationIntent: meta?.mutationIntent,
    });
  };

  const inspectPendingTurn = (turnId: number) => {
    if (inspectionUnavailable)
      throw new Error(
        'SignalTree: pending inspection unavailable because mutation chronology capture failed.'
      );
    const turn = authority.getPendingTurn(turnId);
    if (!turn) return undefined;
    // Public inspection describes semantic contributions, while settlement keeps
    // every authored segment. The latest own segment supplies its current status.
    const effects = [
      ...new Map(
        (turn.__effects ?? []).map((effect) => [effectKey(effect), effect])
      ).values(),
    ];
    const transactionId = inspectionTransactionByTurn.get(turnId);
    const own = inspectionWrites.get(transactionId);
    const later = new Set<InspectionWrite>();
    for (const effect of effects) {
      const authored = own?.get(captureKey(effect));
      if (!authored) {
        inspectionUnavailable = true;
        throw new Error(
          'SignalTree: pending inspection unavailable because an authored contribution has no mutation chronology.'
        );
      }
      for (const [writer, writes] of inspectionWrites) {
        if (writer === transactionId) continue;
        for (const candidate of writes.values()) {
          if (
            identityOf(effect) && identityOf(candidate.effect)
              ? !isLaterAdmission(effect, candidate.effect)
              : candidate.seq <= authored.seq
          )
            continue;
          const other = candidate.effect;
          if (
            other.position !== effect.position ||
            other.subject !== effect.subject
          )
            continue;
          if (effect.kind === 'set') {
            if (
              other.kind === 'remove' ||
              (other.kind === 'set' && scalarRelation(other, effect) === 'same')
            )
              later.add(candidate);
          } else if (other.kind !== 'set') later.add(candidate);
        }
      }
    }
    return {
      effects,
      laterEffects: [...later]
        .sort((a, b) => a.seq - b.seq)
        .map(({ effect }) => cloneTurnEffect(effect)),
    };
  };

  // Replay is still captured through the normal notifier. This transient view
  // serves admission only while a callback is open: an older handle may be
  // rolled back after entity storage committed but before any notifier
  // listener has seen the write. Discarded with the bucket at materialization.
  const observeOpenEntityCapture = (
    transactionId: number,
    bucket: CaptureBucket
  ): (() => void) | undefined =>
    getMutationCaptureRuntime(tree)?.subscribeEntityWitness?.((capture) => {
      if (
        capture.meta?.origin === 'transaction-rollback' ||
        capture.meta?.origin === 'restoration' ||
        isInspectionWrite(capture.meta) ||
        getWriteParticipation(capture.meta) === 'realized' ||
        resolveTransactionId(capture.meta) !== transactionId
      )
        return;
      for (const change of capture.changes) {
        bucket.subjectIds.add(change.subject);
        if (change.structural) {
          const effect: ScalarSetEffect = {
            kind: 'set',
            position: capture.owner,
            ownerPath: capture.ownerPath,
            path: capture.ownerPath,
            subject: change.subject,
            subjectFieldSegments: [],
            before: change.before,
            after: change.after,
          };
          bucket.entityFootprints.set(effectKey(effect), effect);
        } else {
          captureEffects(
            bucket,
            bucket.entityFootprints,
            capture.ownerPath,
            change.after,
            change.before,
            withoutEntityOrdinaryChanges(capture.meta),
            capture.ownerPath,
            [change.subject],
            [capture.owner]
          );
        }
      }
    });

  // Research operation journal: prepared facts survive independently of diagnostics.
  type OperationRecord = {
    sequence: number;
    structuralFrontier?: import('../../lib/internals/mutation-capture-runtime').StructuralFrontierInterval;
    owner: number;
    effects: readonly TurnEffect[];
    previous?: OperationRecord;
    owners: Set<number>;
  };
  const installedOperations = new Map<number, OperationRecord>();
  const expectedDispositions = new Map<number, readonly TurnEffect[]>();
  registerOwnedCleanup(() => {
    installedOperations.clear();
    expectedDispositions.clear();
  });
  const sourceCaptureRuntime = getMutationCaptureRuntime(tree);
  if (sourceCaptureRuntime) {
    const sourceRegistry = getPositionRegistry(tree.$);
    if (sourceRegistry)
      registerOwnedCleanup(
        bindMutationCaptureRegistry(sourceRegistry, sourceCaptureRuntime)
      );
    sourceCaptureRuntime.prepareMemberResponsibility = (
      branch,
      key,
      child,
      presence
    ) => {
      const meta = getActiveWriteContext();
      const id = resolveTransactionId(meta);
      if (
        id === undefined ||
        isRestoring ||
        isInspectionWrite(meta) ||
        getWriteParticipation(meta) === 'realized' ||
        meta?.origin === 'restoration' ||
        meta?.origin === 'transaction-rollback'
      )
        return;
      const prepared = prepareNewMemberResponsibility(
        branch,
        key,
        child,
        presence
      );
      if (!prepared) return;
      const { effect, address } = prepared;
      const bucket = getTransactionBucket(id);
      const keyOfEffect = effectKey(effect);
      const existing = bucket.effects.get(keyOfEffect);
      const composed = existing
        ? cloneTurnEffect(existing)
        : cloneTurnEffect(effect);
      if (composed.kind === 'set')
        composePlainBranchMemberEffect(composed, effect);
      const previous = installedOperations.get(id);
      const operation: OperationRecord = {
        sequence: (previous?.sequence ?? -1) + 1,
        owner: effect.position,
        effects: [cloneTurnEffect(effect)],
        previous,
        owners: previous?.owners ?? new Set<number>(),
      };
      return {
        writes: [
          address,
          { map: bucket.effects, key: keyOfEffect, value: composed },
          {
            map: bucket.baselineValues,
            key: effect.position,
            value: bucket.baselineValues.has(effect.position)
              ? bucket.baselineValues.get(effect.position)
              : effect.before,
          },
          { map: installedOperations, key: id, value: operation },
        ],
        adds: [
          { set: operation.owners, value: effect.position },
          { set: bucket.positionIds, value: effect.position },
          { set: bucket.ownerPaths, value: effect.ownerPath },
        ],
      };
    };
    sourceCaptureRuntime.prepareEntityResponsibility = (capture) => {
      const id =
        getWriteParticipation(capture.meta) === 'realized'
          ? undefined
          : resolveTransactionId(capture.meta);
      if (
        isRestoring ||
        isInspectionWrite(capture.meta) ||
        capture.meta?.origin === 'transaction-rollback' ||
        capture.meta?.origin === 'restoration'
      )
        return;
      if (
        id === undefined &&
        !pendingTransactions.size &&
        !authority.getPendingTurnCount()
      )
        return;
      const orderPlan = capture.topologyUnit?.order
        ? prepareOrderAdmission(capture)
        : undefined;
      const bucket =
        id === undefined ? createCaptureBucket() : getTransactionBucket(id);
      const scratch = createCaptureBucket();
      scratch.priorEffects = bucket.effects;
      scratch.derivedFields = [];
      const effects: TurnEffect[] = [];
      for (const change of capture.changes) {
        const path = change.path;
        if (path === undefined)
          throw new Error('Entity responsibility has no mutation path');
        if (change.structuralRecord)
          effects.push({
            ...change.structuralRecord,
            position: capture.owner,
            ownerPath: capture.ownerPath,
            path,
          } as TurnEffect);
        else if (
          !isPlainRecord(change.before) ||
          !isPlainRecord(change.after)
        ) {
          // Match rich capture's existing whole-row boundary. Arrays and opaque
          // values are not record fields; index enumeration loses their shape.
          if (change.before !== change.after)
            effects.push({
              kind: 'set',
              position: capture.owner,
              ownerPath: capture.ownerPath,
              path,
              subject: change.subject,
              before: change.before,
              after: change.after,
              mutationIntent: capture.meta?.mutationIntent,
            });
        } else {
          const before = change.before,
            after = change.after;
          for (const key of new Set([
            ...Object.keys(before),
            ...Object.keys(after),
          ])) {
            const beforeValue = before[key],
              afterValue = after[key];
            const beforePresent = Object.prototype.hasOwnProperty.call(
                before,
                key
              ),
              afterPresent = Object.prototype.hasOwnProperty.call(after, key);
            if (beforeValue === afterValue && beforePresent === afterPresent)
              continue;
            effects.push({
              kind: 'set',
              position: capture.owner,
              ownerPath: capture.ownerPath,
              path: `${path}.${key}`,
              subject: change.subject,
              subjectFieldSegments: [key],
              before: beforeValue,
              after: afterValue,
              mutationIntent: capture.meta?.mutationIntent,
              ...(!(beforePresent && afterPresent)
                ? {
                    fieldPresence: {
                      before: beforePresent,
                      after: afterPresent,
                    },
                  }
                : {}),
            });
          }
        }
      }
      if(capture.fieldSelections){
        for(const change of capture.changes){
          if(change.structural)continue;
          const keys=new Set([...Object.keys(change.before??{}),...Object.keys(change.after??{})]);
          for(const key of keys){
            const effect=effects.find(effect=>effect.kind==='set'&&effect.subject===change.subject&&effect.subjectFieldSegments?.length===1&&effect.subjectFieldSegments[0]===key);
            const before=capture.fieldSelections.before(change.subject,key);
            if(effect){
              const after=Object.freeze({...capture.fieldSelections.proposed(change.subject,key),owner:id});
              bindFieldEndpoints(effect,{before,after});capture.fieldSelections.choose(change.subject,key,after);
            }else if(before.owner!==undefined){capture.fieldSelections.choose(change.subject,key,before);}
          }
        }
      }
      const revision = ++sourceRevision;
      const segmentWrites = new Map<
        string,
        { writer: number | undefined; segment: number }
      >();
      for (const effect of effects) {
        const key = sourceLifetimeKey(effect);
        const previous = segmentWrites.get(key) ?? sourceSegments.get(key);
        const segment =
          previous && id !== undefined && previous.writer === id
            ? previous.segment
            : revision;
        identify(effect, { revision, segment });
        segmentWrites.set(key, { writer: id, segment });
      }
      const admissionWrites: Array<TerminalRecordPlan['writes'][number]> = [
        ...(orderPlan?.writes ?? []),
        ...(id !== undefined && capture.topologyUnit?.order
          ? [
              {
                map: bucket.collectionOrders,
                key: capture.owner,
                value: prepareCollectionOrder(
                  {
                    owner: capture.owner,
                    ownerPath: capture.ownerPath,
                    ...capture.topologyUnit.order,
                    beforeFrontier: capture.topologyUnit.physical.before,
                    afterFrontier: capture.topologyUnit.physical.after,
                    topologyUnit: capture.topologyUnit,
                  },
                  bucket.collectionOrders.get(capture.owner)
                ),
              },
              {
                map: installedCollectionUnits,
                key: capture.topologyUnit.id,
                value: true,
              },
            ]
          : []),
        ...(id !== undefined &&
        capture.topologyUnit &&
        (capture.topologyUnit.physical.before !==
          capture.topologyUnit.physical.after ||
          capture.topologyUnit.ordinary.before !==
            capture.topologyUnit.ordinary.after)
          ? [
              {
                map: bucket.orderBoundaries,
                key: capture.owner,
                value: {
                  previous: bucket.orderBoundaries.get(capture.owner),
                  evidence: {
                    before: capture.topologyUnit.physical.before,
                    after: capture.topologyUnit.physical.after,
                    records: [],
                    physical: capture.topologyUnit.physical,
                    ordinary: capture.topologyUnit.ordinary,
                  },
                },
              },
              {
                map: installedBoundaryUnits,
                key: capture.topologyUnit.id,
                value: true,
              },
            ]
          : []),
        { map: sourceAdmissions, key: capture.owner, value: effects },
        ...capture.changes.map((change) => ({
          map: pairedEntityAdmissions,
          key: change,
          value: Object.freeze({
            revision,
            segment:
              segmentWrites.get(`${capture.owner}:${change.subject}`)
                ?.segment ?? revision,
          }),
        })),
        ...[...segmentWrites].map(([key, value]) => ({
          map: sourceSegments,
          key,
          value,
        })),
      ];
      const sequence = ++inspectionSeq;
      let footprints = inspectionWrites.get(id);
      if (!footprints) {
        footprints = new Map();
        admissionWrites.push({
          map: inspectionWrites,
          key: id,
          value: footprints,
        });
      }
      for (const effect of effects) {
        const footprint =
          effect.kind === 'set'
            ? { ...effect, before: undefined, after: undefined }
            : effect.kind === 'rekey'
            ? { ...effect }
            : { ...effect, value: undefined };
        admissionWrites.push({
          map: footprints,
          key: captureKey(effect),
          value: { seq: sequence, effect: footprint },
        });
      }
      if (id === undefined) {
        admissionWrites.push(
          authority.prepareSourceDependencies(revision, effects)
        );
        for (const transactionId of pendingTransactions.keys())
          admissionWrites.push({
            map: callbackExternalEffects,
            key: transactionId,
            value: [
              ...(callbackExternalEffects.get(transactionId) ?? []),
              ...effects,
            ],
          });
        return { writes: admissionWrites, adds: [] };
      }
      const touchedKeys = new Set(effects.map(captureKey));
      for (const key of touchedKeys) {
        const prior = bucket.effects.get(key);
        if (prior) scratch.effects.set(key, cloneTurnEffect(prior));
        const occupancy = bucket.occupancy.get(key);
        if (occupancy) scratch.occupancy.set(key, occupancy);
      }
      for (const effect of effects) {
        if (bucket.baselineValues.has(effect.position))
          scratch.baselineValues.set(
            effect.position,
            bucket.baselineValues.get(effect.position)
          );
      }
      for (const effect of effects)
        enqueueEffect(scratch, scratch.effects, cloneTurnEffect(effect));
      if(capture.fieldSelections)for(const effect of scratch.effects.values()){
        if(effect.kind!=='set'||effect.subject===undefined||effect.subjectFieldSegments?.length!==1)continue;
        const pair=fieldEndpoints(effect);if(!pair)continue;
        const noop=plainBranchMemberEffectIsNoop(effect)&&(effect.fieldPresence?.before??true)===(effect.fieldPresence?.after??true);
        capture.fieldSelections.choose(effect.subject,effect.subjectFieldSegments[0],noop?pair.before:pair.after);
      }
      const previous = installedOperations.get(id);
      const operation: OperationRecord = {
        sequence: (previous?.sequence ?? -1) + 1,
        structuralFrontier: capture.structuralFrontier,
        owner: capture.owner,
        effects,
        previous,
        owners: previous?.owners ?? new Set<number>(),
      };
      const writes: Array<TerminalRecordPlan['writes'][number]> = [
        ...admissionWrites,
        { map: installedOperations, key: id, value: operation },
      ];
      // Interval normalization may expose a field contribution carried by an
      // ordinary rebind. Pair its value-free chronology with responsibility,
      // before observers can reenter. Per-operation add/remove facts remain
      // unchanged for restoration and publication. A failed preparation may
      // leave a sequence gap, but installs no footprint or authority.
      if (scratch.derivedFields.length) {
        const sequence = ++inspectionSeq;
        let footprints = inspectionWrites.get(id);
        if (!footprints) {
          footprints = new Map();
          writes.push({ map: inspectionWrites, key: id, value: footprints });
        }
        for (const field of scratch.derivedFields) {
          const footprint: ScalarSetEffect = {
            ...field,
            before: undefined,
            after: undefined,
          };
          writes.push({
            map: footprints,
            key: captureKey(field),
            value: { seq: sequence, effect: footprint },
          });
        }
      }
      // Replace the prepared map, including composed-away structural entries.
      for (const key of touchedKeys)
        if (!scratch.effects.has(key))
          writes.push({ map: bucket.effects, key, value: undefined });
      for (const [key, value] of scratch.effects)
        writes.push({ map: bucket.effects, key, value });
      for (const [key, value] of scratch.occupancy)
        writes.push({ map: bucket.occupancy, key, value });
      for (const [key, value] of scratch.baselineValues)
        writes.push({ map: bucket.baselineValues, key, value });
      if (pendingTransactions.size > 0)
        for (const key of windowKeys(
          [capture.owner],
          capture.changes.map((c) => c.subject)
        ))
          writes.push({ map: bucket.ownWriteSeq, key, value: windowWriteSeq });
      return {
        writes,
        adds: [
          { set: operation.owners, value: capture.owner },
          { set: bucket.positionIds, value: capture.owner },
          { set: bucket.ownerPaths, value: capture.ownerPath },
          ...capture.changes.map((c) => ({
            set: bucket.subjectIds,
            value: c.subject,
          })),
        ],
      };
    };
    registerOwnedCleanup(() => {
      delete sourceCaptureRuntime.prepareEntityResponsibility;
      delete sourceCaptureRuntime.prepareMemberResponsibility;
    });
  }
  const foldOperationDisposition = (id: number): readonly TurnEffect[] => {
    const newest = installedOperations.get(id);
    if (!newest) return [];
    const records: OperationRecord[] = new Array(newest.sequence + 1);
    let record: OperationRecord | undefined = newest;
    for (let i = records.length - 1; i >= 0; i--) {
      if (!record || record.sequence !== i)
        throw new Error('Operation journal sequence gap');
      records[i] = record;
      record = record.previous;
    }
    if (record) throw new Error('Operation journal sequence gap');
    const expected = createCaptureBucket();
    for (const operation of records)
      for (const effect of operation.effects)
        enqueueEffect(expected, expected.effects, cloneTurnEffect(effect));
    return settleTurnMemberEffects(
      tree.$ as object,
      [...expected.effects.values()].map(cloneTurnEffect)
    );
  };
  const validateOperationDisposition = (
    id: number,
    turnId: number | undefined
  ): void => {
    const folded = expectedDispositions.get(id);
    if (!folded?.length) return;
    const retained = authority.getPendingTurn(turnId)?.__effects ?? [];
    const indexed = new Map(
      retained.map((effect) => [captureKey(effect), effect])
    );
    for (const effect of folded) {
      const actual = indexed.get(captureKey(effect));
      const same =
        actual &&
        actual.kind === effect.kind &&
        [...new Set([...Object.keys(effect), ...Object.keys(actual)])].every(
          (key) => {
            const expectedValue = (
              effect as unknown as Record<string, unknown>
            )[key];
            const actualValue = (actual as unknown as Record<string, unknown>)[
              key
            ];
            const memberImage =
              (key === 'before' || key === 'after') &&
              effect.kind === 'set' &&
              effect.plainBranchMembership !== undefined;
            return memberImage ||
              key === 'subjectFieldSegments' ||
              key === 'fieldPresence' ||
              key === 'plainBranchMembership'
              ? deepEqual(actualValue, expectedValue)
              : Object.is(actualValue, expectedValue);
          }
        );
      if (!same) {
        const refusal = createRollbackError({
          kind: 'effect-validation-failed',
          pendingTurnId: turnId ?? id,
          compensation: [],
          errorMessage:
            'Installed operation lacks a matching settlement disposition',
        });
        publishRefusal(id, refusal);
        throw refusal;
      }
    }
  };

  const resolveOwnerPositionId = (ownerPath?: string): number | undefined => {
    if (!ownerPath) {
      return undefined;
    }
    const segments = ownerPath.split('.');
    let cursor: unknown = tree.$ as Record<string, unknown>;
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
    const membership = plainBranchMembershipEffects(meta);
    const membershipTransaction = resolveTransactionId(meta);
    if (membership?.length && membershipTransaction !== undefined) {
      const previous = installedOperations.get(membershipTransaction);
      installedOperations.set(membershipTransaction, {
        sequence: (previous?.sequence ?? -1) + 1,
        owner: membership[0].position,
        effects: membership.map(cloneTurnEffect),
        previous,
        owners: previous?.owners ?? new Set<number>(),
      });
    }
    if (membership) {
      for (const effect of membership) {
        bucket.positionIds.add(effect.position);
        bucket.ownerPaths.add(effect.ownerPath);
        if (pendingTransactions.size > 0) {
          for (const key of windowKeys([effect.position], undefined))
            bucket.ownWriteSeq.set(key, windowWriteSeq);
        }
        enqueueEffect(bucket, bucket.effects, effect);
      }
      return;
    }
    bucket.ownerPaths.add(ownerPath ?? path);
    for (const subjectId of subjectIds ?? []) {
      bucket.subjectIds.add(subjectId);
    }
    const resolvedPositionIds =
      positionIds && positionIds.length > 0
        ? positionIds
        : (() => {
            const fallback = resolveOwnerPositionId(ownerPath);
            return fallback === undefined ? [] : [fallback];
          })();
    for (const positionId of resolvedPositionIds) {
      bucket.positionIds.add(positionId);
    }
    if (pendingTransactions.size > 0) {
      for (const key of windowKeys(resolvedPositionIds, subjectIds)) {
        bucket.ownWriteSeq.set(key, windowWriteSeq);
      }
    }
    rememberTreeRealizationDescriptor({
      descriptors: realizationDescriptors,
      path,
      ownerPath,
      positionIds: resolvedPositionIds,
      subjectIds,
      meta,
      registry: getPositionRegistry(tree.$),
    });
    const recorded = resolveTransactionId(meta);
    // Realized external input is not authored notification replay.
    if (
      getWriteParticipation(meta) !== 'realized' &&
      recorded !== undefined &&
      installedOperations.get(recorded)?.owners.has(resolvedPositionIds[0])
    )
      return;
    captureEffects(
      bucket,
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

  const releaseScalarSelection=lifecycleRegistry?registerScalarSelection(lifecycleRegistry,(node,mutation,before,proposed,allowConfirmedRefresh)=>{
    const active=getActiveWriteContext();
    const meta=mutation.admissionParticipation?scalarAdmissionMetadata(active,mutation):active,position=getOwnedPositionIds(node)?.[0];
    if(!mutation.changed)return {endpoint:before.owner!==undefined&&!allowConfirmedRefresh?before:proposed};
    if(isRestoring||meta?.origin==='restoration'||isInspectionWrite(meta)||getWriteParticipation(meta)==='realized'||meta?.transactionOwner!==transactionOwnerToken)return;
    const id=resolveTransactionId(meta);
    if(id===undefined||position===undefined)return;
    const slots=getTreeScalarSlotRuntime(tree)??getTreeScalarSlotRuntime(tree.$);
    if(slots?.resolveScalarSlot(position)===undefined)return;
    const bucket=getTransactionBucket(id);
    const path=lifecycleRegistry.addressFor(position)?.join('.')??'';
    const key=effectKey({kind:'set',position,path,ownerPath:path,before:mutation.before,after:mutation.after});
    const old=bucket.effects.get(key);
    const prior=old&&fieldEndpoints(old)?.before;
    const first=prior??Object.freeze({...before,value:mutation.before});
    const after=Object.freeze({...proposed,owner:id});
    const pair={before:first,after};
    const endpoint=Object.is(old?.kind==='set'?old.before:mutation.before,mutation.after)?first:after;
    const admission=mutation.preparedTerminal?.scalarAdmission;
    if(!admission)throw new Error('Scalar selection requires prepared admission');
    // These are this attempt's detached effect objects, not installed bucket state.
    bindFieldEndpoints(admission.effect,pair);
    bindFieldEndpoints(admission.operationEffect,{before,after});
    return {endpoint};
  }):undefined;

  const recordConfirmedBucket = (
    bucket: CaptureBucket
  ): TransactionTurnRecord | undefined => {
    const { subjectIds, positionIds, effects } = drainCaptureBucket(bucket);
    const turn = authority.recordConfirmed(
      subjectIds.length > 0 ? subjectIds : undefined,
      positionIds.length > 0 ? positionIds : undefined,
      effects.length > 0 ? effects : undefined
    );
    // Subject addresses serve pending rollback and retained undo/redo claims.
    // A confirmed record only classifies dependencies: retaining it (for
    // correctness or diagnostics) is not a reason to retain these addresses.
    // Restoration reinstalls its own captured descriptor inputs when it admits
    // a history entry, whichever flush listener runs first. Physical
    // reclamation has its own eligibility boundary.
    forgetUnclaimedDescriptorSubjects(subjectIds);
    return turn;
  };

  const getTransactionBucket = (transactionId: number): CaptureBucket => {
    let bucket = pendingTransactions.get(transactionId);
    if (!bucket) {
      bucket = createCaptureBucket();
      pendingTransactions.set(transactionId, bucket);
    }
    return bucket;
  };

  const resolveTransactionId = (meta?: {
    transactionId?: unknown;
    transactionOwner?: unknown;
  }): number | undefined =>
    typeof meta?.transactionId === 'number' &&
    meta.transactionOwner === transactionOwnerToken
      ? meta.transactionId
      : undefined;

  const installedOrderUnits = new WeakMap<object, boolean>();
  const installedBoundaryUnits = new WeakMap<object, boolean>();
  const installedCollectionUnits = new WeakMap<object, boolean>();
  const prepareCollectionOrder = (
    capture: CollectionOrderCapture,
    existing: Omit<CollectionOrderCapture, 'meta'> | undefined
  ): Omit<CollectionOrderCapture, 'meta'> => ({
    owner: capture.owner,
    ownerPath: capture.ownerPath,
    beforeSubjects: existing?.beforeSubjects ?? [...capture.beforeSubjects],
    afterSubjects: [...capture.afterSubjects],
    beforeFrontier: existing?.beforeFrontier ?? capture.beforeFrontier,
    afterFrontier: capture.afterFrontier,
    ordinaryEndpoints:
      capture.ordinaryEndpoints && (!existing || existing.ordinaryEndpoints)
        ? Object.freeze({
            beforeToken:
              existing?.ordinaryEndpoints?.beforeToken ??
              capture.ordinaryEndpoints.beforeToken,
            afterToken: capture.ordinaryEndpoints.afterToken,
            before:
              existing?.ordinaryEndpoints?.before ??
              capture.ordinaryEndpoints.before,
            after: capture.ordinaryEndpoints.after,
            domain: Object.freeze([
              ...new Set([
                ...(existing?.ordinaryEndpoints?.domain ??
                  capture.ordinaryEndpoints.domain ??
                  capture.ordinaryEndpoints.before),
                ...(capture.ordinaryEndpoints.domain ??
                  capture.ordinaryEndpoints.after),
              ]),
            ]),
          })
        : undefined,
  });

  const prepareOrderAdmission = (capture: {
    owner: number;
    ownerPath: string;
    meta?: WriteMetadata;
    topologyUnit?: import('../../lib/internals/mutation-capture-runtime').CompletedTopologyUnit;
  }): TerminalRecordPlan => {
    const writes: TerminalRecordPlan['writes'][number][] = [];
    const revision = ++orderAdmission;
    const transactionId =
      getWriteParticipation(capture.meta) === 'realized'
        ? undefined
        : resolveTransactionId(capture.meta);
    for (const [id, owners] of transactionOrderAdmissions) {
      if (id === transactionId || !pendingTransactions.has(id)) continue;
      const prior = owners.get(capture.owner);
      if (prior) {
        const copy = new Map(owners);
        copy.set(capture.owner, { ...prior, independentAfterOwn: revision });
        writes.push({ map: transactionOrderAdmissions, key: id, value: copy });
      }
    }
    if (transactionId !== undefined) {
      const owners = new Map(transactionOrderAdmissions.get(transactionId));
      const prior = { ...(owners.get(capture.owner) ?? {}) };
      if (prior.independentAfterOwn !== undefined && !prior.conflict)
        prior.conflict = Object.freeze({
          ownerPath: capture.ownerPath,
          independentAdmission: prior.independentAfterOwn,
          resumedOwnAdmission: revision,
        });
      prior.independentAfterOwn = undefined;
      owners.set(capture.owner, prior);
      writes.push({
        map: transactionOrderAdmissions,
        key: transactionId,
        value: owners,
      });
    }
    if (capture.topologyUnit)
      writes.push({
        map: installedOrderUnits,
        key: capture.topologyUnit.id,
        value: true,
      });
    return { writes, adds: [] };
  };
  const unsubscribePairedBoundaries = getMutationCaptureRuntime(
    tree
  )?.subscribeStructuralWitness?.((capture) => {
    const unit = capture.topologyUnit;
    if (
      !unit ||
      installedBoundaryUnits.has(unit.id) ||
      isInspectionWrite(capture.meta) ||
      capture.meta?.origin === 'restoration' ||
      capture.meta?.origin === 'transaction-rollback' ||
      getWriteParticipation(capture.meta) === 'realized'
    )
      return;
    const id = resolveTransactionId(capture.meta);
    if (id === undefined) return;
    const bucket = getTransactionBucket(id);
    bucket.orderBoundaries.set(capture.owner, {
      previous: bucket.orderBoundaries.get(capture.owner),
      evidence: {
        before: unit.physical.before,
        after: unit.physical.after,
        records: [],
        physical: unit.physical,
        ordinary: unit.ordinary,
      },
    });
  });
  unsubscribeCollectionOrders =
    getMutationCaptureRuntime(tree)?.subscribeCollectionOrder?.((capture) => {
      if (
        isInspectionWrite(capture.meta) ||
        capture.meta?.origin === 'restoration' ||
        capture.meta?.origin === 'transaction-rollback'
      )
        return;
      if (
        !capture.topologyUnit ||
        !installedOrderUnits.has(capture.topologyUnit.id)
      ) {
        const plan = prepareOrderAdmission(capture);
        installTerminalRecord(plan);
      }
      const transactionId =
        getWriteParticipation(capture.meta) === 'realized'
          ? undefined
          : resolveTransactionId(capture.meta);
      if (transactionId === undefined) return;
      const bucket = getTransactionBucket(transactionId);
      if (
        !capture.topologyUnit ||
        !installedCollectionUnits.has(capture.topologyUnit.id)
      )
        bucket.collectionOrders.set(
          capture.owner,
          prepareCollectionOrder(
            capture,
            bucket.collectionOrders.get(capture.owner)
          )
        );
      bucket.ownerPaths.add(capture.ownerPath);
      bucket.positionIds.add(capture.owner);
    }) ?? null;

  const materializePendingTransaction = (
    transactionId: number,
    reservedId: number
  ): TransactionTurnRecord | undefined => {
    const bucket = pendingTransactions.get(transactionId);
    pendingTransactions.delete(transactionId);
    releaseWindowIfClosed();
    if (!bucket) {
      authority.discardPending(reservedId);
      return undefined;
    }
    const dispositions = foldOperationDisposition(transactionId);
    expectedDispositions.set(transactionId, dispositions);
    const {
      subjectIds,
      positionIds: capturedPositionIds,
      effects,
      baselineValues,
      collectionOrders,
    } = drainCaptureBucket(bucket);
    // Prepared scalar writes record admission before installation. Their raw
    // footprint is not a net turn: x(2); x(1) over baseline 1 must leave an
    // older pending turn untouched. Only prune positions whose scalar writes
    // are independently journaled and have no remaining disposition. Legacy
    // footprint-only owners and entity lifetime claims keep their admission.
    const preparedOwners = installedOperations.get(transactionId)?.owners;
    const slots =
      getTreeScalarSlotRuntime(tree) ?? getTreeScalarSlotRuntime(tree.$);
    const netPositions = new Set([
      ...effects.map((effect) => effect.position),
      ...dispositions.map((effect) => effect.position),
      ...collectionOrders.map((order) => order.owner),
    ]);
    const positionIds = capturedPositionIds.filter(
      (position) =>
        !preparedOwners?.has(position) ||
        slots?.resolveScalarSlot(position) === undefined ||
        netPositions.has(position)
    );
    const pending = authority.createPending(
      reservedId,
      subjectIds.length > 0 ? subjectIds : undefined,
      positionIds.length > 0 ? positionIds : undefined,
      effects.length > 0 ? effects : undefined,
      baselineValues.size > 0 ? baselineValues : undefined
    );
    const externalEffects = callbackExternalEffects.get(transactionId) ?? [];
    callbackExternalEffects.delete(transactionId);
    if (pending && externalEffects.length) {
      // The callback can author again after an ingress. Until that mixed
      // ownership can be separated, refuse overlap rather than declaring its
      // final speculative value settled because an earlier ingress replaced it.
      authority.observeQueuedEffects(
        pending.id,
        externalEffects.map((effect) =>
          effect.kind === 'set'
            ? { ...effect, mutationIntent: 'derive' }
            : effect
        )
      );
    }
    if (pending && collectionOrders.length > 0) {
      pendingOrderDeltas.set(
        pending.id,
        collectionOrders.map((order) =>
          deriveCollectionOrderDelta(
            order.owner,
            order.beforeSubjects,
            order.afterSubjects,
            order.beforeFrontier,
            order.afterFrontier,
            order.ordinaryEndpoints
          )
        )
      );
    }
    return pending;
  };

  const toCausalEffect = (effect: TurnEffect): CausalEffect => {
    switch (effect.kind) {
      case 'set':
        return bindFieldEndpoints({
          owner: effect.position as CausalPositionId,
          before: effect.before,
          after: effect.after,
          subjectId: effect.subject,
          subjectFieldSegments: effect.subjectFieldSegments,
          plainBranchMembership: effect.plainBranchMembership,
          fieldPresence: effect.fieldPresence,
          path: effect.path,
          ownerPath: effect.ownerPath,
        },fieldEndpoints(effect));
      case 'add':
        return {
          owner: effect.position as CausalPositionId,
          before: undefined,
          after: effect.key,
          subjectId: effect.subject,
          path: effect.path,
          ownerPath: effect.ownerPath,
          structural: 'add',
          structuralContext: {
            kind: 'add',
            subject: effect.subject,
            key: effect.key,
            value: effect.value,
            beforeSubject: effect.beforeSubject,
            afterSubject: effect.afterSubject,
          },
        };
      case 'remove':
        return {
          owner: effect.position as CausalPositionId,
          before: effect.key,
          after: undefined,
          subjectId: effect.subject,
          path: effect.path,
          ownerPath: effect.ownerPath,
          structural: 'remove',
          structuralContext: {
            kind: 'remove',
            subject: effect.subject,
            key: effect.key,
            value: effect.value,
            beforeSubject: effect.beforeSubject,
            afterSubject: effect.afterSubject,
          },
        };
      case 'rekey':
        return {
          owner: effect.position as CausalPositionId,
          before: effect.beforeKey,
          after: effect.afterKey,
          subjectId: effect.subject,
          path: effect.path,
          ownerPath: effect.ownerPath,
          structural: 'rekey',
          structuralContext: {
            kind: 'rekey',
            subject: effect.subject,
            beforeKey: effect.beforeKey,
            afterKey: effect.afterKey,
          },
        };
    }
  };

  const toRollbackEffect = (effect: TurnEffect): ReversalEffect => {
    const causal = toCausalEffect(effect);
    const pair=fieldEndpoints(effect);
    return bindFieldEndpoints({
      ...causal,
      before: causal.after,
      after: causal.before,
      plainBranchMembership: causal.plainBranchMembership
        ? {
            before: causal.plainBranchMembership.after,
            after: causal.plainBranchMembership.before,
          }
        : undefined,
      fieldPresence: causal.fieldPresence
        ? {
            before: causal.fieldPresence.after,
            after: causal.fieldPresence.before,
          }
        : undefined,
      structural:
        causal.structural === 'add'
          ? 'remove'
          : causal.structural === 'remove'
          ? 'add'
          : causal.structural,
    },pair?{before:pair.after,after:pair.before}:undefined);
  };

  // Capture segmentation preserves admission authority. After disposition,
  // continuous selected own occupancy compiles to one bounded endpoint.
  const compileSelectedCompensation = (
    selected: readonly TurnEffect[]
  ): TurnEffect[] => {
    const compiled: Array<TurnEffect | undefined> = [];
    const runs = new Map<
      string,
      { index: number; state: ReturnType<typeof composeOccupancy> }
    >();
    for (const effect of selected) {
      if (effect.kind === 'set') {
        compiled.push(effect);
        continue;
      }
      const key = effectKey(effect);
      const before =
        effect.kind === 'add'
          ? undefined
          : effect.kind === 'remove'
          ? effect.key
          : effect.beforeKey;
      const previous = runs.get(key);
      const continuous = previous && Object.is(previous.state.afterKey, before);
      const state = composeOccupancy(
        continuous ? previous.state : undefined,
        effect
      );
      if (continuous) {
        previous.state = state;
        compiled[previous.index] = occupancyEffect(state);
      } else {
        const index = compiled.length;
        runs.set(key, { index, state });
        compiled.push(occupancyEffect(state));
      }
    }
    return compiled.filter(
      (effect): effect is TurnEffect => effect !== undefined
    );
  };

  const compensatedFrontiers = (
    transactionId: number,
    effects: readonly TurnEffect[],
    orderDeltas: readonly CollectionOrderDelta[]
  ): Map<
    number,
    {
      before: unknown;
      after: unknown;
      binding: CollectionTransitionTargetBinding;
    }
  > => {
    // Missing responsibility is not equivalent to a known canceled contribution.
    if (!expectedDispositions.has(transactionId)) return new Map();
    const intervals = new Map<
      number,
      { before: unknown; after: unknown; valid: boolean }
    >();
    for (
      let operation = installedOperations.get(transactionId);
      operation;
      operation = operation.previous
    ) {
      const interval = operation.structuralFrontier;
      if (!interval || interval.before === interval.after) continue;
      const newer = intervals.get(operation.owner);
      if (newer) {
        newer.valid &&= interval.after === newer.before;
        newer.before = interval.before;
      } else intervals.set(operation.owner, { ...interval, valid: true });
    }
    const expectedByOwner = new Map<number, Map<string, TurnEffect>>();
    const actualByOwner = new Map<number, Map<string, TurnEffect>>();
    const group = (
      source: readonly TurnEffect[],
      into: Map<number, Map<string, TurnEffect>>
    ): void => {
      for (const effect of source) {
        if (effect.kind === 'set') continue;
        let entries = into.get(effect.position);
        if (!entries) into.set(effect.position, (entries = new Map()));
        entries.set(effectKey(effect), effect);
      }
    };
    group(expectedDispositions.get(transactionId) ?? [], expectedByOwner);
    group(effects, actualByOwner);
    const orderedOwners = new Set(orderDeltas.map((delta) => delta.owner));
    const result = new Map<
      number,
      {
        before: unknown;
        after: unknown;
        binding: CollectionTransitionTargetBinding;
      }
    >();
    for (const [owner, interval] of intervals) {
      if (!interval.valid || orderedOwners.has(owner)) continue;
      const expected = expectedByOwner.get(owner);
      const actual = actualByOwner.get(owner);
      // Lineage continuity alone does not prove complete compensation. Every
      // net structural responsibility must be represented by this unit.
      if ((expected?.size ?? 0) !== (actual?.size ?? 0)) continue;
      let complete = true;
      for (const [key, effect] of expected ?? []) {
        const candidate = actual?.get(key);
        if (
          !candidate ||
          candidate.kind !== effect.kind ||
          candidate.subject !== effect.subject ||
          (effect.kind === 'rekey' && candidate.kind === 'rekey'
            ? effect.beforeKey !== candidate.beforeKey ||
              effect.afterKey !== candidate.afterKey
            : effect.kind !== 'set' &&
              effect.kind !== 'rekey' &&
              candidate.kind !== 'set' &&
              candidate.kind !== 'rekey'
            ? effect.key !== candidate.key
            : true)
        ) {
          complete = false;
          break;
        }
      }
      if (!complete) continue;
      const binding = collectionBindingAt(tree.$, owner);
      if (
        binding?.installCompensatedOrderFrontier &&
        binding.readOrderFrontier?.() === interval.after
      )
        result.set(owner, { ...interval, binding });
    }
    return result;
  };

  const installPreparedCompensation = (
    point: { install(): void; publish(options?:{deferCompletion?:boolean}): void; complete?():void } | undefined,
    frontiers: ReturnType<typeof compensatedFrontiers>,
    completion?: { selected: boolean; committed: boolean; deliveries?:Array<()=>void> }
  ): void => {
    if (completion) completion.selected = true;
    for (const interval of frontiers.values())
      if (interval.binding.readOrderFrontier?.() !== interval.after)
        throw new Error(
          'Compensation structural frontier changed during preparation'
        );
    // Point installation emits committed membership facts before publication
    // refreshes projections. As on the complete-target route, hold listeners
    // until every collection and compensated frontier is coherent.
    const releaseMembership = holdEntityMembershipDelivery(tree.$ as object);
    try {
      point?.install();
      for (const interval of frontiers.values())
        interval.binding.installCompensatedOrderFrontier?.(interval.before);
      // Interval-only compensation has no value frame to advance the revision.
      if (!point && frontiers.size)
        (
          getPhysicalCommitClock(tree.$) ?? getPhysicalCommitClock(tree)
        )?.advance();
      if (completion) completion.committed = true;
      const completePoint=point?.complete;
        if(completePoint&&completion?.deliveries)completion.deliveries.push(()=>completePoint.call(point));
      point?.publish({deferCompletion:!!completion?.deliveries});
    } finally {
      releaseMembership();
    }
  };

  const rollbackPendingTarget = (
    effects: readonly ReversalEffect[],
    orderDeltas: CollectionOrderDelta[],
    completion?: { selected: boolean; committed: boolean; deliveries?:Array<()=>void> },
    frontiers?: ReturnType<typeof compensatedFrontiers>
  ): void => {
    if (completion) completion.selected = true;
    const preparationClock =
      getPhysicalCommitClock(tree.$) ?? getPhysicalCommitClock(tree);
    const preparationRevision = preparationClock?.revision();
    const reversalEffects = placeFieldReversalsWhileRowsExist(
      ordinaryRealization(effects)?.ordinary ?? effects
    );
    const notifier = getPathNotifier();
    const treeOwnerId = getPositionRegistry(tree.$)?.id;
    const bindings = new Map<number, CollectionTransitionTargetBinding>();
    visitTree(tree.$, (node) => {
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
    const collectionOwners = new Set([
      ...orderDeltas.map(({ owner }) => owner),
      ...reversalEffects
        .filter(({ subjectId }) => typeof subjectId === 'number')
        .map(({ owner }) => owner),
    ]);
    const collections = [...collectionOwners].map((owner) => {
      // A collection hidden by an omitted member is skipped by the
      // current-tree walk. Rollback still compensates its retained storage:
      // a rejected value must not come back on a later re-add (owner law,
      // slice 8b/8c).
      const binding = bindings.get(owner) ?? collectionBindingAt(tree.$, owner);
      if (binding) bindings.set(owner, binding);
      if (!binding) {
        throw new Error(
          `Transaction rollback has no collection binding ${owner}`
        );
      }
      return binding.readSource();
    });
    const physicalSources = new Map(
      collections.map((collection) => [
        collection.owner,
        new Map(collection.subjects.map((row) => [row.subject, row.key])),
      ])
    );
    const realized = prepareOrdinaryRealization(
      reversalEffects,
      (owner, subject) => physicalSources.get(owner)?.get(subject)
    );
    const derivedTarget = deriveDeclarativeTransitionTarget({
      collections,
      effects: realized.physical,
      orderDeltas,
      orderEndpoint: 'before',
    });
    // The complete physical target cannot identify authored ordinary facts.
    // Carry the original admitted transaction inverses, preserving their order.
    const admittedTarget = {
      ...derivedTarget,
      collections: new Map(
        [...derivedTarget.collections].map(([owner, collection]) => [
          owner,
          {
            ...collection,
            admittedEffects: reversalEffects.filter(
              (effect) => effect.owner === owner
            ),
            admittedOrder: (() => {
              const ordinary = orderDeltas.find(
                (delta) => delta.owner === owner
              )?.ordinaryEndpoints;
              return ordinary?.before.filter(
                (subject) =>
                  ordinary.domain === undefined ||
                  ordinary.domain.includes(subject)
              );
            })(),
          },
        ])
      ),
    };
    const target = frontiers?.size
      ? {
          ...admittedTarget,
          collections: new Map(
            [...admittedTarget.collections].map(([owner, collection]) => {
              const interval = frontiers.get(owner);
              return [
                owner,
                interval
                  ? { ...collection, orderFrontier: interval.before }
                  : collection,
              ];
            })
          ),
        }
      : admittedTarget;
    const scalarSlotRuntime =
      getTreeScalarSlotRuntime(tree) ?? getTreeScalarSlotRuntime(tree.$);
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
                    `Transaction rollback has no scalar slot ${owner}`
                  );
                }
                frame.set(slot, value);
              }
              const install = frame.prepareCommit
                ? frame.prepareCommit({
                    advanceRevision: false,
                    publish: false,
                    admissionParticipation: 'realized',
                  })
                : undefined;
              if (!install) throw new Error('Transaction scalar preparation unavailable');
              let result: ReturnType<typeof frame.commit> | undefined;
              return {
                install(): void {
                  result = install();
                },
                publish(): void {
                  if (!result) {
                    throw new Error(
                      'Transaction scalar published before installation'
                    );
                  }
                  let failed = false;
                  let first: unknown;
                  try {
                    scalarSlotRuntime.publishPrepared(result);
                  } catch (error) {
                    failed = true;
                    first = error;
                  }
                  // The prepared route publishes the same realized path facts as
                  // the existing realization port, after the complete unit installs.
                  for (const effect of reversalEffects) {
                    if (
                      effect.subjectId !== undefined ||
                      effect.plainBranchMembership ||
                      !scalars.has(effect.owner)
                    )
                      continue;
                    const descriptor = realizationDescriptors.get(effect.owner);
                    const path = effect.path ?? descriptor?.ownerPath;
                    if (!path) continue;
                    try {
                      notifier.notify(
                        path,
                        effect.after,
                        effect.before,
                        effect.ownerPath ?? descriptor?.ownerPath ?? path,
                        undefined,
                        [effect.owner],
                        scalarFrameMetadata(result, scalarSlotRuntime.resolveScalarSlot(effect.owner), {
                          ...getActiveWriteContext(),
                          intent: 'system',
                          participation: 'realized',
                        }),
                        treeOwnerId
                      );
                    } catch (error) {
                      if (!failed) {
                        failed = true;
                        first = error;
                      }
                    }
                  }
                  if (failed) throw first;
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
        prepareTarget: (members, scalars, turns) => ({
          ...preparePlainBranchMembers(tree.$ as object, members, [...(scalars ?? [])].map(([owner,after])=>({owner,after,turn:turns?.get(owner)})),undefined,'realized'),
          includesScalars: true,
        }),
      },
      {
        onCommitted() {
          // A canceled structural owner has no row target, but its verified
          // lineage is part of this same installation, before any delivery.
          for (const [owner, interval] of frontiers ?? [])
            if (!target.collections.has(owner))
              interval.binding.installCompensatedOrderFrontier?.(
                interval.before
              );
          if (completion) completion.committed = true;
        },
      }
    );
    const apply = () => {
      // The occupancy join and its display plan belong to one prepared revision.
      if (preparationClock?.revision() !== preparationRevision)
        throw new Error(
          'Compensation physical state changed during preparation'
        );
      // Preparation may call user code. Recheck lineage before ANY target installs.
      for (const interval of frontiers?.values() ?? [])
        if (interval.binding.readOrderFrontier?.() !== interval.after)
          throw new Error(
            'Compensation structural frontier changed during preparation'
          );
      prepared.install();
    };
    const locations = getLocationRuntime(tree.$);
    // Membership listeners run once every target is installed and published.
    const releaseMembership = holdEntityMembershipDelivery(tree.$ as object);
    try {
      if (locations) {
        locations.runInvalidationGroup(apply);
      } else {
        apply();
      }
    } finally {
      releaseMembership();
    }
  };

  const applyRollbackCompensation = (
    transactionId: number,
    selectedEffects: TurnEffect[],
    baselineValues: ReadonlyMap<number, unknown>,
    orderDeltas: CollectionOrderDelta[] = [],
    callbackError?: unknown,
    /**
     * The TRANSACTION this compensation belongs to, when that differs from the
     * pending-turn id above.
     *
     * The first parameter is a pending-TURN id at one call site and a
     * transaction id at the other, and the write context was stamping whichever
     * arrived. Restoration joins a compensation to the authority its
     * speculative writes displaced by transaction id, so a turn id there is not
     * merely imprecise — it names a different thing. Traced: the speculative
     * write recorded under transaction 1 while its own compensation announced
     * 2, and the join silently missed.
     */
    owningTransactionId: number = transactionId,
    completion?: { selected: boolean; committed: boolean; deliveries?:Array<()=>void> }
  ): void => {
    const effects = compileSelectedCompensation(selectedEffects);
    const inverseEffects = placeFieldReversalsWhileRowsExist(
      [...effects].reverse().map(toRollbackEffect)
    );
    const frontiers = compensatedFrontiers(
      owningTransactionId,
      effects,
      orderDeltas
    );
    if (
      effects.length === 0 &&
      orderDeltas.length === 0 &&
      frontiers.size === 0
    ) {
      return;
    }

    // A hidden entity collection the rollback makes current again (omitted
    // itself, or with a branch it re-adds) must hold the rows it held when
    // hidden, apart from this transaction's own. A plain write through a held
    // handle is no later turn, so nothing else refuses it (v16 integration 8d
    // (b), review of 370d2f48).
    const ownRows = new Map<number, Set<unknown>>();
    for (const effect of effects)
      if (effect.kind !== 'set' || effect.subject !== undefined) {
        let rows = ownRows.get(effect.position);
        if (!rows) ownRows.set(effect.position, (rows = new Set()));
        rows.add(effect.subject);
      }
    // `effects` are the transaction's own, not yet inverted: a member it
    // omitted (present before, absent after) is one the rollback re-adds.
    for (const effect of effects) {
      if (
        effect.kind !== 'set' ||
        effect.plainBranchMembership?.before !== true ||
        effect.plainBranchMembership.after
      )
        continue;
      const changed = changedOmittedCollection(
        tree.$ as object,
        effect.position,
        (owner) => ownRows.get(owner) ?? new Set(),
        (owner) => orderDeltas.some((delta) => delta.owner === owner)
      );
      if (changed !== undefined)
        throw createRollbackError({
          kind: 'effect-validation-failed',
          pendingTurnId: transactionId,
          compensation: effects,
          errorMessage:
            `the entity collection at '${changed}' was omitted and changed ` +
            'after that, so re-adding it would not restore it as it was',
          callbackError,
        });
    }

    const positionRegistry = getPositionRegistry(tree.$);
    const authorityPosition = getOwnedPositionIds(tree.$)?.[0] as
      | CausalPositionId
      | undefined;
    if (!positionRegistry || authorityPosition === undefined) {
      throw createRollbackError({
        kind: 'effect-validation-failed',
        pendingTurnId: transactionId,
        compensation: effects,
        errorMessage:
          'Transaction rollback requires tree realization infrastructure',
        callbackError,
      });
    }

    const store = new TurnStore();
    store.admitPending({
      id: transactionId,
      effects: effects.map(toCausalEffect),
    });
    const appliedTurns = new AppliedTurnProjection(store);
    const realizationContext = createRealizationContextSource({
      baselineValues,
      store,
      appliedTurns,
    });
    // DIAG-JOURNAL-1.1. Two facts, stated rather than inferred:
    //
    //   origin: 'transaction-rollback'   WHY this realized write exists
    //   transactionId                    WHICH transaction it compensates
    //
    // Without them a compensation turn was indistinguishable from external
    // truth, and the only way to correlate it with its transaction was "it came
    // after the rolled-back event" — temporal adjacency, not correlation. The
    // id is safe as a bare number here because a tree announces under exactly
    // one owner (measured in diag-journal-1-1-correlation.spec.ts) and a journal
    // observes one tree.
    // Physical truth, as a reversal (`structuralWrites`, `physicalRows`,
    // v16 8e).
    beginStructuralWrite();
    openPhysicalRows(positionRegistry);
    let result: ReturnType<typeof rollbackPendingTurnAt> | { ok: true };
    let failed = true;
    try {
      // Path observers see what the tree exposes, never a location's
      // retained storage (`publishingExposedOnly`, v16 8g).
      result = publishingExposedOnly(tree.$ as object, () =>
        withWriteContext(
          {
            origin: 'transaction-rollback',
            transactionId: owningTransactionId,
            // NOT `transactionOwner`. Stamping it here makes
            // `activeTransactionContext()` report an open scope during the
            // compensation, which reopens the callback scope a rollback must leave
            // closed — `active-transaction-context.spec.ts` pins that. The join
            // restoration needs is carried by `origin` plus the corrected
            // `transactionId` instead.
            // OWNER-REPLAY-1, same shape as restoration's: stamped once on the wrap
            // that already surrounds the compensation, so every downstream meta
            // that spreads `getActiveWriteContext()` carries the namespace.
            ownerId: positionRegistry?.id,
          },
          () => {
            if (effects.length === 0 && orderDeltas.length === 0) {
              installPreparedCompensation(undefined, frontiers, completion);
              return { ok: true as const };
            }
            const operation={effects:inverseEffects,orderDeltas,frontiers,
              structuralRequired: requiresDeclarativeStructuralTarget(inverseEffects, (owner) => {
                let binding: CollectionTransitionTargetBinding | undefined;
                visitTree(tree.$, (node) => {
                  const candidate = (
                    node as {
                      __prepareTransitionTarget?: CollectionTransitionTargetBinding;
                    }
                  ).__prepareTransitionTarget;
                  if (candidate?.owner === owner) binding = candidate;
                  return undefined;
                });
                return binding?.readSource();
              })};
            const selected=admitSelectedOperation(realizationTree,operation);
            if(selected){
              if(completion)completion.selected=true;
              const prepared=selected.prepare();
              installPreparedCompensation(prepared,selected.operation.frontiers,completion);
              return {ok:true as const};
            }
            // Inapplicable complete descriptions retain the existing complete route.
            if (operation.orderDeltas.length > 0 || operation.structuralRequired) {
              rollbackPendingTarget(
                inverseEffects,
                orderDeltas,
                completion,
                frontiers
              );
              return { ok: true as const };
            }
            let preparedEffects: readonly ReversalEffect[] | undefined;
            return rollbackPendingTurnAt({
              authority: authorityPosition,
              turnId: transactionId,
              store,
              topology: positionRegistry,
              realizationContext,
              selectedCompensation: inverseEffects,
              port: {
                validateEffects: (normalized) => {
                  preparedEffects =
                    realizationPort.prepareOrdinaryEffects?.(normalized) ??
                    normalized;
                  return realizationPort.validateEffects?.(preparedEffects);
                },
                applyAtomically(normalized): void {
                  normalized = preparedEffects ?? normalized;
                  // D2's additional mixed route keeps ordinary normalized
                  // admission; it changes physical installation only.
                  if (
                    frontiers.size > 0 ||
                    (normalized.some((e) => e.subjectId === undefined) &&
                      normalized.some((e) => e.subjectId !== undefined))
                  ) {
                    const point = preparePointRealization(
                      realizationTree,
                      normalized
                    );
                    if (point) {
                      installPreparedCompensation(point, frontiers, completion);
                    } else if (
                      frontiers.size > 0 ||
                      normalized.some((effect) => effect.plainBranchMembership)
                    ) {
                      rollbackPendingTarget(
                        normalized,
                        orderDeltas,
                        completion,
                        frontiers
                      );
                    } else {
                      realizationPort.applyAtomically(normalized);
                    }
                  } else {
                    realizationPort.applyAtomically(normalized);
                  }
                },
              },
            });
          }
        )
      );
      failed = false;
    } finally {
      physicalRows.pop();
      endStructuralWrite(failed);
    }
    if (!result.ok) {
      throw createRollbackError({
        kind: 'effect-validation-failed',
        pendingTurnId: transactionId,
        compensation: effects,
        errorMessage: `Transaction rollback refused: ${result.refusal.kind}`,
        cause: result.refusal,
        callbackError,
      });
    }
    // Rows compensated in an omitted collection are what a later re-add of
    // it must find (v16 integration 8d (b)).
    for (const effect of effects)
      if (effect.kind !== 'set' || effect.subject !== undefined)
        refreshOmittedCollection(tree.$ as object, effect.position);
    for (const delta of orderDeltas)
      refreshOmittedCollection(tree.$ as object, delta.owner);
  };

  /**
   * CURRENT-TRUTH-OBSERVATION-0. Compensation moves canonical truth, so a held
   * observer must be told to reread it.
   *
   * Measured before this existed: an owner observer saw the speculative 7 and
   * then NOTHING when the turn was rolled back, leaving an adapter showing a
   * value the tree no longer held. The old settlement-gated seam masked it,
   * because a single invalidation fired at settle and happened to sweep up the
   * final value. Once observation stopped waiting for settlement, the gap in
   * the compensation path itself became visible.
   *
   * Authorship decides authority, history and consequences. It does not decide
   * whether current truth is observable.
   */
  const rollbackPendingEffectsThroughRealizationPort = (
    transactionId: number,
    effects: TurnEffect[],
    baselineValues: ReadonlyMap<number, unknown>,
    orderDeltas: CollectionOrderDelta[] = [],
    callbackError?: unknown,
    owningTransactionId: number = transactionId,
    completion?: { selected: boolean; committed: boolean; deliveries?:Array<()=>void> }
  ): void => {
    applyRollbackCompensation(
      transactionId,
      effects,
      baselineValues,
      orderDeltas,
      callbackError,
      owningTransactionId,
      completion
    );
    markOwnerInvalidatedFrom(tree.$ as object);
  };

  function reportCleanupFailure(step: string, error: unknown): void {
    // Guarded: a throwing console (a fail-on-console harness) must not turn
    // a report into a new failure on the path that is cleaning up.
    try {
      console.error(
        `SignalTree: transactions() cleanup failed during ${step}.`,
        error
      );
    } catch {
      // Nothing further can be reported safely.
    }
  }

  registerOwnedCleanup(() => {
      destroyed = true;
      releaseScalarSelection?.();
      research.unregister(lifecycleRegistry?.id);
      lifecycleViews.clear();
      lifecycleScopes.clear();
      authority.releaseConfirmedTurnsOnDestroy();
      cancelCommitScopes(transactionOwnerToken);
      for (const id of authority.getPendingTurnIds()) {
        const discarded = authority.discardPending(id);
        forgetUnclaimedDescriptorSubjects(
          discarded?.restorationSubjectIds ?? [],
          new Set(),
          discarded?.__positionIds ?? []
        );
      }
      pendingTransactions.clear();
      lastWindowWriteSeq.clear();
      lastWindowRowWriteSeq.clear();
      callbackExternalEffects.clear();
      inspectionWrites.clear();
      sourceSegments.clear();
      sourceAdmissions.clear();
      pairedEntityAdmissions = new WeakMap();
      inspectionTransactionByTurn.clear();
      unsubscribeEnqueue?.();
      unsubscribeEnqueue = null;
      pendingCreatedListeners.clear();
      pendingConfirmedListeners.clear();
      pendingDiscardedListeners.clear();
      drainCaptureBucket(pendingCapture);

      try {
        unsubscribeFlush?.();
      } catch (error) {
        reportCleanupFailure('flush unsubscription', error);
      }
      try {
        unsubscribeNotifications?.();
      } catch (error) {
        reportCleanupFailure('notification unsubscription', error);
      }
      try {
        unsubscribeReset?.();
      } catch (error) {
        reportCleanupFailure('reset unsubscription', error);
      }
      try {
        unsubscribePairedBoundaries?.();
        unsubscribeCollectionOrders?.();
      } catch (error) {
        reportCleanupFailure('collection-order unsubscription', error);
      }
      try {
        restoreLeafInterceptors?.();
      } catch (error) {
        reportCleanupFailure('leaf interceptor teardown', error);
      }
      unsubscribeFlush = null;
      unsubscribeNotifications = null;
      unsubscribeReset = null;
      unsubscribeCollectionOrders = null;
      restoreLeafInterceptors = null;
      pendingOrderDeltas.clear();
      transactionOrderAdmissions.clear();
  });

  try {
    const notifier = getPathNotifier();
    if (notifier) {
      const treeOwnerId = getPositionRegistry(tree.$)?.id;
      if (treeOwnerId !== undefined) {
        registerEnqueueObserver = () => {
          unsubscribeEnqueue = notifier.observeEnqueue(treeOwnerId, (entry) => {
            if (
              destroyed ||
              (!authority.getPendingTurnCount() && !pendingTransactions.size)
            )
              return;
            const meta = entry.meta;
            if (
              meta?.origin === 'restoration' ||
              meta?.origin === 'transaction-rollback' ||
              isInspectionWrite(meta)
            )
              return;
            const realized = getWriteParticipation(meta) === 'realized';
            if (
              !realized &&
              typeof meta?.transactionId === 'number' &&
              meta.transactionOwner !== transactionOwnerToken
            )
              return;
            const writer =
              !realized && meta?.transactionOwner === transactionOwnerToken
                ? meta.transactionId
                : undefined;
            try {
              const probe = createCaptureBucket();
              const transition = entityValueTransition(meta);
              captureEffects(
                probe,
                probe.effects,
                entry.path,
                transition ? transition.ordinaryAfter : entry.newValue,
                transition ? transition.ordinaryBefore : entry.oldValue,
                unpairedEntityMetadata(meta),
                entry.ownerPath,
                entry.subjectIds,
                entry.positionIds
              );
              const effects = drainCaptureBucket(probe).effects;
              if (!effects.length) return;
              const seq = ++inspectionSeq;
              let writes = inspectionWrites.get(writer);
              if (!writes) inspectionWrites.set(writer, (writes = new Map()));
              for (const effect of effects) {
                // No value snapshots or row references belong in inspection evidence.
                const footprint: TurnEffect =
                  effect.kind === 'set'
                    ? { ...effect, before: undefined, after: undefined }
                    : effect.kind === 'rekey'
                    ? { ...effect }
                    : { ...effect, value: undefined };
                writes.set(captureKey(effect), { seq, effect: footprint });
              }
            } catch (error) {
              // The write already happened; never report a confident status after
              // losing its chronology. The notifier isolates and reports the error.
              inspectionUnavailable = true;
              throw error;
            }
          });
        };
      }

      const subscribeCollectionNotifications = (): void => {
        unsubscribeNotifications?.();
        unsubscribeNotifications = notifier.subscribe(
          '**',
          function receiveOrdinaryNotification(
            next,
            prev,
            path,
            ownerPath,
            origin,
            subjectIds,
            positionIds,
            meta
          ) {
            if (getWriteParticipation(meta) === 'realized')
              meta = unpairedEntityMetadata(meta);
            if (getEntityOrdinaryChanges(meta) !== undefined) {
              for (const entry of ordinaryEntityEntries({
                path,
                newValue: next,
                oldValue: prev,
                meta,
                subjectIds,
              })) {
                receiveOrdinaryNotification(
                  entry.newValue,
                  entry.oldValue,
                  entry.path,
                  ownerPath,
                  origin,
                  entry.subjectIds,
                  positionIds,
                  entry.meta
                );
              }
              return;
            }
            const transition = entityValueTransition(meta);
            if (transition) {
              next = transition.ordinaryAfter;
              prev = transition.ordinaryBefore;
            }
            if (pendingTransactions.size > 0 && !isInspectionWrite(meta)) {
              const windowOwner = (meta as { ownerId?: number } | undefined)
                ?.ownerId;
              if (
                windowOwner === undefined ||
                treeOwnerId === undefined ||
                windowOwner === treeOwnerId
              ) {
                const membership = plainBranchMembershipChange(meta);
                recordWindowWrite(
                  membership
                    ? membership.members.flatMap((member) => [
                        ...(member.positionIds ?? []),
                      ])
                    : positionIds,
                  subjectIds
                );
              }
            }
            if (origin === 'restoration' || origin === 'transaction-rollback') {
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

            // DEVTOOLS-JUMP-0.1. Inspection contributes NOTHING here: no
            // bucket, no confirmed effect, and above all no dependency
            // evidence. Placed ahead of the realization branch because the C3
            // probe below deliberately admits later effects regardless of
            // origin, which is right for external truth and wrong for a
            // diagnostic snapshot.
            if (isInspectionWrite(meta)) {
              return;
            }
            if (getWriteParticipation(meta) === 'realized') {
              // TX-LEDGER C3. A realization is NOT an authored turn and must
              // never become one — but it can still make a pending rollback
              // unsafe by depending on speculative structure. Build its effects
              // into a throwaway bucket and hand them to the dependency ledger
              // only; nothing here reaches confirmedTurns.
              //
              // Skipped entirely when nothing is pending, so a tree with no open
              // transaction pays nothing for this.
              if (
                authority.getPendingTurnCount() > 0 ||
                pendingTransactions.size > 0
              ) {
                const probe = createCaptureBucket();
                captureIntoBucket(
                  probe,
                  path,
                  next,
                  prev,
                  meta,
                  ownerPath,
                  subjectIds,
                  positionIds
                );
                const effects = drainCaptureBucket(probe).effects;
                authority.observeLaterEffects(effects);
                for (const id of pendingTransactions.keys()) {
                  const prior = callbackExternalEffects.get(id) ?? [];
                  callbackExternalEffects.set(id, [...prior, ...effects]);
                }
              }
              return;
            }
            if (
              typeof meta?.transactionId === 'number' &&
              meta.transactionOwner !== transactionOwnerToken
            ) {
              return;
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

      const prepareScalarResponsibility:ScalarResponsibilityPreparer = (
            path,
            next,
            prev,
            meta,
            ownerPath,
            subjectIds,
            positionIds
          ) => {
            if (
              isRestoring ||
              meta?.origin === 'restoration' ||
              isInspectionWrite(meta) ||
              getWriteParticipation(meta) === 'realized'
            )
              return;
            if (meta?.transactionOwner !== transactionOwnerToken) return;
            const id = resolveTransactionId(meta),
              position = positionIds?.[0];
            if (
              id === undefined ||
              position === undefined ||
              subjectIds?.length ||
              Object.is(prev, next)
            )
              return;
            const slots =
              getTreeScalarSlotRuntime(tree) ??
              getTreeScalarSlotRuntime(tree.$);
            if (slots?.resolveScalarSlot(position) === undefined) return;
            const bucket = getTransactionBucket(id);
            const effect: TurnEffect = {
              kind: 'set',
              path,
              ownerPath: ownerPath ?? path,
              position,
              before: prev,
              after: next,
              mutationIntent: meta?.mutationIntent,
            };
            const key = effectKey(effect),
              old = bucket.effects.get(key);
            if (old && old.kind !== 'set')
              throw new Error(
                'Terminal record conflicts with structural evidence'
              );
            const combined = old
              ? {
                  ...old,
                  after: next,
                  mutationIntent: combineScalarMutationIntent(
                    old.mutationIntent,
                    effect.mutationIntent
                  ),
                }
              : effect;
            const previous = installedOperations.get(id);
            const operation: OperationRecord = {
              sequence: (previous?.sequence ?? -1) + 1,
              owner: position,
              effects: [cloneTurnEffect(effect)],
              previous,
              owners: previous?.owners ?? new Set<number>(),
            };
            const writes: Array<TerminalRecordPlan['writes'][number]> = [
              { map: bucket.effects, key, value: combined },
              { map: installedOperations, key: id, value: operation },
            ];
            if (!bucket.baselineValues.has(position))
              writes.push({
                map: bucket.baselineValues,
                key: position,
                value: prev,
              });
            if (pendingTransactions.size > 0)
              for (const key of windowKeys([position], undefined))
                writes.push({
                  map: bucket.ownWriteSeq,
                  key,
                  value: windowWriteSeq,
                });
            return {
              scalarAdmission:{effect:combined,operationEffect:operation.effects[0]},
              writes,
              adds: [
                { set: operation.owners, value: position },
                { set: bucket.positionIds, value: position },
                { set: bucket.ownerPaths, value: ownerPath ?? path },
              ],
            };
          };
      let releaseScalarResponsibility:(()=>void)|undefined;
      try {
        if(sourceCaptureRuntime)releaseScalarResponsibility=registerScalarResponsibility(sourceCaptureRuntime,prepareScalarResponsibility);
      restoreLeafInterceptors = interceptLeafSignals(
        tree.$ as Record<string, unknown>,
        (path, next, prev, meta, ownerPath, subjectIds, positionIds) => {
          const effectiveMeta = meta ?? getActiveWriteContext();
          if (isRestoring) return;
          if (effectiveMeta?.origin === 'restoration') {
            return;
          }
          // DEVTOOLS-JUMP-0.1. Notified so the write still reaches observers
          // and the tree updates, but captured nowhere.
          if (
            isInspectionWrite(effectiveMeta) ||
            getWriteParticipation(effectiveMeta) === 'realized'
          ) {
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
          if (
            typeof effectiveMeta?.transactionId === 'number' &&
            effectiveMeta.transactionOwner !== transactionOwnerToken
          ) {
            return;
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
        },
        {
          scalarResponsibility: sourceCaptureRuntime,
          beforePublication: (
            path,
            next,
            prev,
            meta,
            ownerPath,
            subjectIds,
            positionIds
          ) => {
            const effectiveMeta = meta ?? getActiveWriteContext();
            if (
              isRestoring ||
              effectiveMeta?.origin === 'restoration' ||
              isInspectionWrite(effectiveMeta) ||
              getWriteParticipation(effectiveMeta) === 'realized'
            )
              return;
            if (
              typeof effectiveMeta?.transactionId === 'number' &&
              effectiveMeta.transactionOwner !== transactionOwnerToken
            )
              return;
            const transactionId = resolveTransactionId(effectiveMeta);
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
              captureEffects(
                pendingCapture,
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
          },
        }
      );

        if(releaseScalarResponsibility)registerOwnedCleanup(releaseScalarResponsibility);
      }catch(error){scalarAttachmentFailed=true;releaseScalarResponsibility?.();throw error;}

      if (typeof notifier.onFlush === 'function') {
        unsubscribeFlush = notifier.onFlush(() => {
          if (isRestoring || !selfDirty) {
            return;
          }
          selfDirty = false;
          recordConfirmedBucket(pendingCapture);
        });
      }
    }
  } catch(error) {
    if (scalarAttachmentFailed) {
      unwindOwnedInitialization();
      throw error;
    }
    // fall through without capture support
  }

  const readQueuedLaterEffects = (): TurnEffect[] => {
    const ownerId = getPositionRegistry(tree.$)?.id;
    return (getPathNotifier()?.readPending() ?? [])
      .flatMap((entry) =>
        ordinaryEntityEntries({
          ...entry,
          meta: unpairedEntityMetadata(entry.meta),
        })
      )
      .flatMap<TurnEffect>((rawEntry) => {
        const entry = rawEntry;
        const meta = entry.meta;
        if (
          (entry.ownerId ?? meta?.ownerId) !== ownerId ||
          meta?.origin === 'restoration' ||
          meta?.origin === 'transaction-rollback' ||
          isInspectionWrite(meta) ||
          (getWriteParticipation(meta) !== 'realized' &&
            meta?.transactionOwner === transactionOwnerToken &&
            typeof meta.transactionId === 'number')
        )
          return [];
        const membership = plainBranchMembershipEffects(meta);
        if (membership) return [...membership];
        const position = entry.positionIds?.[0];
        if (position === undefined) return [];
        const structural = entry.ownerPath
          ? buildTurnEffectFromStructural(
              meta,
              entry.ownerPath,
              entry.path,
              entry.positionIds,
              entry.subjectIds
            )
          : undefined;
        if (structural) return [structural];
        if (
          entry.subjectFieldKeys !== undefined &&
          entry.subjectIds?.length === 1
        ) {
          const before = entry.oldValue as Record<string, unknown>;
          const after = entry.newValue as Record<string, unknown>;
          // The notifier preserves the producer's literal field footprint even
          // when coalescing returns to the original value (ABA).
          return entry.subjectFieldKeys.map((key) => ({
            kind: 'set' as const,
            position,
            path: `${entry.path}.${key}`,
            ownerPath: entry.ownerPath ?? entry.path,
            subject: entry.subjectIds?.[0],
            subjectFieldSegments: [key],
            fieldPresence: {
              before: Object.prototype.hasOwnProperty.call(before, key),
              after: Object.prototype.hasOwnProperty.call(after, key),
            },
            before: before[key],
            after: after[key],
            mutationIntent: 'derive' as const,
          }));
        }
        // A queued row may have returned to the same object/value. Its path and
        // identity still witness a write; equality cannot grant rollback rights.
        return [
          {
            kind: 'set' as const,
            position,
            path: entry.path,
            ownerPath: entry.ownerPath ?? entry.path,
            subject: entry.subjectIds?.[0],
            before: entry.oldValue,
            after: entry.newValue,
            mutationIntent: 'derive' as const,
          },
        ];
      });
  };

  /**
   * Add `inspect()` to a raw settle handle.
   *
   * Lives in the RUNTIME so both paths that mint a handle get it: the ordinary
   * `transaction()` return, and the RECOVERY handle attached to a rollback
   * error when the callback itself threw. Built in the enhancer instead, it
   * made "inspection is available on every handle" FALSE — a caller recovering
   * from a failed callback got settlement only and could not see what the
   * partial turn contained, which is the same arbitrary asymmetry that folding
   * `propose()` in was meant to remove.
   */
  const decorateHandle = (
    pending: { confirm(): void; rollback(): void },
    turnId: number | undefined
  ): PendingTransaction => {
    let settled: TransactionInspection | undefined;

    const read = (): TransactionInspection => {
      if (turnId === undefined) {
        return { changes: [] };
      }
      const raw = inspectPendingTurn(turnId);
      if (!raw) {
        return { changes: [] };
      }
      // The registry already holds the typed segment address for every
      // position — the same L17 machinery `link()` egress uses. Projecting
      // only the dotted string was what made two different locations
      // indistinguishable to a reviewer.
      const registry = getPositionRegistry(tree.$);
      return {
        changes: raw.effects.map((effect) => ({
          path: effect.path,
          // The position address locates the OWNER (for an entity field that
          // is the collection); `subjectFieldSegments` is the producer-known
          // row-relative address. Appending it is what makes two fields of
          // one row distinguishable. The segments already existed and were
          // already authoritative — `scalarRelation` and `makeScalarKey`
          // key on them — so only the public projection was dropping them.
          address: (() => {
            const owner = registry?.addressFor(effect.position);
            if (!owner) return owner;
            const within =
              effect.kind === 'set' ? effect.subjectFieldSegments : undefined;
            return within ? [...owner, ...within] : owner;
          })(),
          subject:
            'subject' in effect && typeof effect.subject === 'number'
              ? effect.subject
              : undefined,
          status: classifyProposedEffect(
            effect,
            raw.laterEffects.filter((later) => isLaterAdmission(effect, later))
          ),
        })),
      };
    };

    /**
     * ⚠️ SETTLEMENT MUST NOT DEPEND ON INSPECTION.
     *
     * `read()` throws when mutation chronology capture has failed, and
     * folding the review projection into `transact()` briefly made
     * `confirm()` call it unguarded — so a tree whose inspection was
     * unavailable could no longer be SETTLED at all. The handle wedged.
     * `path-notifier-enqueue.spec.ts` caught it: "the low-level settlement
     * handle does not depend on the inspection UI."
     *
     * Returning `undefined` rather than an empty inspection is deliberate.
     * `{ changes: [] }` would be a FALSE claim that the turn changed
     * nothing; leaving it unset makes a later `inspect()` fall through to
     * `read()` and report the unavailability honestly.
     */
    const snapshot = (): TransactionInspection | undefined => {
      try {
        return read();
      } catch {
        return undefined;
      }
    };

    /**
     * Did settlement become TERMINAL, whatever else happened?
     *
     * ⚠️ A settle call can throw AFTER it has already succeeded. The runtime
     * installs the compensation, retires the turn, and only THEN rethrows an
     * observer-delivery failure — deliberately, because delivery failing must
     * not make a completed reversal look retryable.
     *
     * The wrapper has to preserve that distinction or it silently destroys
     * it. Measured before this guard: compensation succeeded (x=0, y=0), the
     * turn retired, `rollback()` threw, and `inspect()` afterwards reported
     * `{ changes: [] }` — the settlement snapshot was never cached because
     * the assignment sat after the call.
     *
     * An unconditional `finally` is the WRONG fix: a genuine refusal leaves
     * the turn pending and its inspection must stay LIVE, not freeze at a
     * pre-refusal snapshot. Turn presence is the honest discriminator.
     */
    const settlementWasTerminal = (): boolean =>
      turnId !== undefined && !authority.getPendingTurnIds().includes(turnId);

    return {
      inspect(): TransactionInspection {
        // After settlement the turn is no longer pending, so the inspection
        // as of that settlement is what there is to report.
        return settled ?? read();
      },
      confirm(): void {
        // Snapshot BEFORE confirming: this is the race inspect() alone
        // cannot close, and after confirm the pending turn is gone. The
        // snapshot is kept even though confirm() returns void, so a later
        // inspect() still reports the truth as of settlement.
        const atSettlement = settled ?? snapshot();
        try {
          pending.confirm();
        } catch (error) {
          if (settlementWasTerminal()) settled = atSettlement;
          throw error;
        }
        settled = atSettlement;
      },
      rollback(): void {
        const atSettlement = settled ?? snapshot();
        // Throws on a conservative refusal, and ALSO on an observer failure
        // that followed a successful compensation. Rethrown either way — the
        // caller must see both — but only the second is terminal, so only
        // the second caches the snapshot. A refused rollback leaves the
        // handle reporting live state, matching the turn, which stays
        // pending.
        try {
          pending.rollback();
        } catch (error) {
          if (settlementWasTerminal()) settled = atSettlement;
          throw error;
        }
        settled = atSettlement;
      },
    };
  };

  const runtime: InternalTransactionRuntime = {
    transaction(fn: () => void): PendingTransaction {
      if (destroyed) throw new Error('Cannot transact on a destroyed tree');
      const activeMeta = getActiveWriteContext();
      const notifier = getPathNotifier();
      const captureRuntime = getMutationCaptureRuntime(tree);
      if (typeof activeMeta?.transactionId === 'number') {
        throw new Error('Nested transaction is not supported');
      }

      // The existing construction flush must not erase net-equal queued
      // evidence for older pending turns while allocating this new turn.
      const beforeOpen = readQueuedLaterEffects();
      for (const id of authority.getPendingTurnIds()) {
        authority.observeQueuedEffects(id, beforeOpen);
      }
      notifier?.flushSync();
      const transactionId = nextTransactionId++;
      const captureBucket = createCaptureBucket();
      pendingTransactions.set(transactionId, captureBucket);
      // Before the callback: the first write inside it must already reach the
      // evidence observer, or inspect() would silently miss it.
      ensureEnqueueObserver();

      // TURN-FEED-0. Announced BEFORE the callback runs, because an observer has
      // to know the transaction is open in order to treat the writes inside it
      // as speculative. Announcing after would be announcing too late.
      const lifecycleChannel = getTransactionLifecycleChannel(tree as object);
      // Lifecycle observation records the transition here, before the engine
      // announcement runs other owners' callbacks; public listeners run after
      // it, and before the drain below, like any other 'opened' listener.
      const lifecycleView: LifecycleView = { transactionId, phase: 'opened' };
      lifecycleViews.set(transactionId, lifecycleView);
      let descriptorOwnersBefore: Set<number>;
      let releaseCapture: (() => void) | undefined;
      let releaseEntityCapture: (() => void) | undefined;
      let reservedTurnId: number;
      try {
        const releaseOpenedDelivery = holdLifecycle();
        publishLifecycle({ kind: 'opened', transactionId });
        try {
          lifecycleChannel.announce({
            kind: 'opened',
            owner: transactionOwnerToken,
            id: transactionId,
          });
        } finally {
          releaseOpenedDelivery?.();
        }

        // 'opened' listeners can author ordinary writes or complete transactions.
        // Neither belongs to this callback's contribution, so drain them before
        // its order is reserved: queued at transaction entry they would read as
        // LATER evidence against this turn, and refuse its rollback over its own
        // baseline. Older pending turns still receive them as later evidence.
        const afterOpened = readQueuedLaterEffects();
        for (const id of authority.getPendingTurnIds()) {
          authority.observeQueuedEffects(id, afterOpened);
        }
        notifier?.flushSync();

        // Persistence is post-commit: open the deferral scope BEFORE the callback
        // runs, so speculative writes inside it queue instead of reaching storage.
        openCommitScope(transactionOwnerToken, transactionId, tree as object);
        lifecycleScopes.add(transactionId);

        descriptorOwnersBefore = new Set(realizationDescriptors.keys());
        releaseCapture = captureRuntime?.activateCapture();
        releaseEntityCapture = observeOpenEntityCapture(
          transactionId,
          captureBucket
        );
        // After the 'opened' listeners return, before the callback and before
        // any observer of its first write: see `reservePending`. Nothing from
        // here to the end of the callback's `finally` lets a throw escape.
        reservedTurnId = authority.reservePending(captureBucket);
      } catch (error) {
        // Lifecycle observation only: a throw before the reservation leaves no
        // handle, so the reader must not keep a pending record. (The owner's
        // own bookkeeping on this path is unchanged by this slice.)
        abandonLifecycleView(transactionId);
        throw error;
      }
      let primaryError: unknown;
      let primaryFailed = false;
      let cleanupError: unknown;
      let cleanupFailed = false;
      const executeTransaction = (): void => {
        try {
          withWriteContext(
            {
              ...(activeMeta ?? {}),
              transactionId,
              transactionOwner: transactionOwnerToken,
            },
            fn
          );
        } catch (error) {
          primaryFailed = true;
          primaryError = error;
        }
      };
      try {
        const locations = getLocationRuntime(tree.$);
        if (locations) locations.runInvalidationGroup(executeTransaction);
        else executeTransaction();
      } catch (error) {
        // The invalidation group settles its publishers AFTER the callback
        // returns, so a throw here with no callback failure is a post-callback
        // failure (recovery.callbackFailed stays false), not the callback's.
        if (!primaryFailed) {
          cleanupFailed = true;
          cleanupError = error;
        }
      } finally {
        try {
          try {
            releaseEntityCapture?.();
          } finally {
            releaseCapture?.();
          }
        } catch (error) {
          if (primaryFailed || cleanupFailed)
            reportCleanupFailure(
              'transaction capture release after failure',
              error
            );
          else {
            cleanupFailed = true;
            cleanupError = error;
          }
        }
      }

      // Until materialization the reservation is the minimum pending id. A
      // throw that stranded it would pin every later confirmed record and the
      // dependency ledger, and show older handles a later turn that can never
      // settle. Abandon it, with its capture bucket, before rethrowing.
      let pendingTurn: TransactionTurnRecord | undefined;
      let autoRollbackUnsafe = false;
      let releaseStagedDelivery: (() => void) | undefined;
      try {
        // Read before staging/flush: delivery intentionally drops net-equal ABA
        // notifications, but compensation may not erase that writer's authority.
        const callbackQueuedEvidence = readQueuedLaterEffects();
        for (const id of authority.getPendingTurnIds()) {
          // This turn's own reservation receives its callback evidence through
          // `callbackExternalEffects` at materialization, as before.
          if (id !== reservedTurnId)
            authority.observeQueuedEffects(id, callbackQueuedEvidence);
        }
        if (callbackQueuedEvidence.length) {
          callbackExternalEffects.set(transactionId, [
            ...(callbackExternalEffects.get(transactionId) ?? []),
            ...callbackQueuedEvidence,
          ]);
        }

        // TURN-FEED-0 'staged': the callback has returned, so this transaction's
        // contribution is complete and awaits a decision. A throwing callback is
        // never staged; its automatic compensation follows below.
        if (!primaryFailed) {
          // Recorded before the engine announcement (restoration stages its
          // entry inside it). Public delivery waits for materialization, so no
          // tooling callback runs between the callback and that staging.
          lifecycleView.phase = 'staged';
          releaseStagedDelivery = holdLifecycle();
          publishLifecycle({ kind: 'staged', transactionId });
          lifecycleChannel.announce({
            kind: 'staged',
            owner: transactionOwnerToken,
            id: transactionId,
          });
        }

        notifier?.flushSync();
        // Decided before materialize, which releases the window's write record.
        const openBucket = pendingTransactions.get(transactionId);
        // Only the post-callback rollback; a throwing callback's rollback
        // admission is unchanged from 9df8fbff.
        autoRollbackUnsafe =
          cleanupFailed &&
          !primaryFailed &&
          openBucket !== undefined &&
          writtenSinceBy(openBucket);
        pendingTurn = materializePendingTransaction(
          transactionId,
          reservedTurnId
        );
      } catch (error) {
        installedOperations.delete(transactionId);
        expectedDispositions.delete(transactionId);
        transactionOrderAdmissions.delete(transactionId);
        pendingTransactions.delete(transactionId);
        callbackExternalEffects.delete(transactionId);
        releaseWindowIfClosed();
        authority.discardPending(reservedTurnId);
        // No handle and no authority remain, so the reader must not keep
        // reporting a pending transaction. The engine announces no terminal
        // transition on this path, so neither does the reader; the sequence
        // still advances with the snapshot.
        abandonLifecycleView(transactionId);
        throw error;
      } finally {
        releaseStagedDelivery?.();
      }
      const pendingTurnId = pendingTurn?.id;
      if (pendingTurn) {
        inspectionTransactionByTurn.set(pendingTurn.id, transactionId);
        const keys = new Set((pendingTurn.__effects ?? []).map(captureKey));
        const writes = inspectionWrites.get(transactionId);
        for (const key of writes?.keys() ?? [])
          if (!keys.has(key)) writes?.delete(key);
        notifyListeners(pendingCreatedListeners, pendingTurn);
      } else {
        inspectionWrites.delete(transactionId);
      }
      releaseInspectionIfQuiet();
      let lifecycle: 'pending' | 'confirmed' | 'rejected' = 'pending';
      let settling = false;

      const handle = {
        [PENDING_TURN_ID]: pendingTurnId,
        confirm(): void {
          validateOperationDisposition(transactionId, pendingTurnId);
          const pendingTurn = authority.getPendingTurn(pendingTurnId);
          if (destroyed) throw new Error('Cannot settle a destroyed tree');
          if (settling)
            throw new Error('Transaction settlement is already in progress');
          if (lifecycle === 'confirmed') {
            return;
          }
          if (lifecycle === 'rejected') {
            throw new Error('Cannot confirm a rolled back transaction');
          }
          lifecycle = 'confirmed';
          installedOperations.delete(transactionId);
          expectedDispositions.delete(transactionId);
          transactionOrderAdmissions.delete(transactionId);
          // Lifecycle observation: recorded at the transition, before the engine
          // announcement lets restoration confirm its entry, so every reader it
          // notifies already sees this transaction settled. Public delivery
          // keeps its position after consequences.
          retireLifecycleView(transactionId);
          const releaseConfirmedDelivery = holdLifecycle();
          publishLifecycle({ kind: 'confirmed', transactionId });
          try {
            lifecycleChannel.announce({
              kind: 'confirmed',
              owner: transactionOwnerToken,
              id: transactionId,
            });
            try {
              if (pendingTurnId !== undefined) {
                const confirmedTurn = authority.confirmPending(pendingTurnId);
                const accepted = inspectionWrites.get(transactionId);
                if (accepted) {
                  let settled = inspectionWrites.get(undefined);
                  if (!settled)
                    inspectionWrites.set(undefined, (settled = new Map()));
                  for (const [key, write] of accepted) {
                    if ((settled.get(key)?.seq ?? -1) < write.seq)
                      settled.set(key, write);
                  }
                  inspectionWrites.delete(transactionId);
                }
                inspectionTransactionByTurn.delete(pendingTurnId);
                if (confirmedTurn) {
                  notifyListeners(pendingConfirmedListeners, confirmedTurn);
                }
              }
            } finally {
              if (pendingTurnId !== undefined) {
                pendingOrderDeltas.delete(pendingTurnId);
              }
              releaseInspectionIfQuiet();
              // The physical state this transaction authored is committed truth,
              // so its durable consequences run — last, so a throwing storage
              // backend cannot leave the turn unconfirmed, and in a `finally` so
              // a throwing confirmPending or listener cannot strand the scope.
              //
              // 'commit' even on that error path, deliberately: the writes were
              // physically realized during the callback and nothing compensates
              // them here (`lifecycle` is already 'confirmed', so a following
              // rollback() throws). Discarding would drop durable consequences
              // for state the tree is still showing.
              try {
                settleCommitScope(
                  transactionOwnerToken,
                  transactionId,
                  'commit'
                );
              } finally {
                // A throwing durable consequence must not strand the released
                // turn's descriptor details: the turn is already settled.
                forgetUnclaimedDescriptorSubjects(
                  pendingTurn?.restorationSubjectIds ?? [],
                  descriptorOwnersBefore,
                  pendingTurn?.__positionIds ?? []
                );
              }
            }
          } finally {
            releaseConfirmedDelivery?.();
          }
        },
        rollback(): void {
          validateOperationDisposition(transactionId, pendingTurnId);
          const pendingTurn = authority.getPendingTurn(pendingTurnId);
          if (destroyed) throw new Error('Cannot settle a destroyed tree');
          if (settling)
            throw new Error('Transaction settlement is already in progress');
          if (lifecycle === 'rejected') return;
          if (lifecycle === 'confirmed')
            throw new Error('Cannot rollback a confirmed transaction');
          const plan =
            pendingTurnId === undefined
              ? { compensation: [] }
              : authority.getPendingRollbackPlan(
                  pendingTurnId,
                  readQueuedLaterEffects(),
                  orderInterferenceFor(transactionId)
                );
          if ('conflict' in plan) {
            const refusal = createRollbackError(plan.conflict);
            // Refused before anything is reversed: authority stays pending.
            publishRefusal(transactionId, refusal);
            throw refusal;
          }
          const compensation = plan.compensation;
          const orderDeltas =
            pendingTurnId === undefined
              ? []
              : pendingOrderDeltas.get(pendingTurnId) ?? [];
          let installed = false;
          const completion = { selected: false, committed: false,deliveries:[] as Array<()=>void> };
          let observerFailed = false;
          let observerError: unknown;
          const clock =
            getPhysicalCommitClock(tree.$) ?? getPhysicalCommitClock(tree);
          const revision = clock?.revision();
          let releaseRolledBackDelivery: (() => void) | undefined;
          settling = true;
          try {
            const apply = () => {
              rollbackPendingEffectsThroughRealizationPort(
                pendingTurnId ?? transactionId,
                [...compensation].reverse(),
                pendingTurn?.__baselineValues ?? new Map(),
                orderDeltas,
                primaryFailed ? primaryError : undefined,
                transactionId,
                completion
              );
              installed = true;
            };
            try {
              const locations = getLocationRuntime(tree.$);
              let failed=false,first:unknown;
              try{if (locations) locations.runInvalidationGroup(apply);else apply();}catch(error){failed=true;first=error;}
              for(const deliver of completion.deliveries.splice(0))try{deliver();}catch(error){if(!failed){failed=true;first=error;}}
              if(failed)throw first;
            } catch (error) {
              // Physical commit precedes observer delivery. A delivery failure
              // must not leave a successfully compensated turn retryable.
              installed ||= completion.selected
                ? completion.committed
                : revision !== undefined && clock?.revision() !== revision;
              if (!installed) {
                const refusal =
                  error instanceof SignalTreeRollbackError
                    ? error
                    : createRollbackError({
                        kind: 'effect-validation-failed',
                        pendingTurnId: pendingTurnId ?? transactionId,
                        compensation,
                        errorMessage:
                          error instanceof Error
                            ? error.message
                            : 'Unknown rollback validation failure',
                        cause: error,
                        callbackError: primaryFailed ? primaryError : undefined,
                      });
                // Nothing installed: the turn and its scope stay pending.
                publishRefusal(transactionId, refusal);
                throw refusal;
              }
              observerFailed = true;
              observerError = error;
            }
            lifecycle = 'rejected';
            installedOperations.delete(transactionId);
            expectedDispositions.delete(transactionId);
            transactionOrderAdmissions.delete(transactionId);
            // Recorded at the transition (compensation installed), before the
            // engine announcement; delivered after consequences are discarded.
            retireLifecycleView(transactionId);
            releaseRolledBackDelivery = holdLifecycle();
            publishLifecycle({ kind: 'rolled-back', transactionId });
            inspectionWrites.delete(transactionId);
            if (pendingTurnId !== undefined)
              inspectionTransactionByTurn.delete(pendingTurnId);
            const discarded =
              pendingTurnId === undefined
                ? undefined
                : authority.discardPending(pendingTurnId);
            if (pendingTurnId !== undefined)
              pendingOrderDeltas.delete(pendingTurnId);
            releaseInspectionIfQuiet();
            lifecycleChannel.announce({
              kind: 'rolled-back',
              owner: transactionOwnerToken,
              id: transactionId,
            });
            try {
              if (discarded)
                notifyListeners(pendingDiscardedListeners, discarded);
            } finally {
              try {
                settleCommitScope(
                  transactionOwnerToken,
                  transactionId,
                  'discard'
                );
              } finally {
                forgetUnclaimedDescriptorSubjects(
                  pendingTurn?.restorationSubjectIds ?? [],
                  descriptorOwnersBefore,
                  pendingTurn?.__positionIds ?? []
                );
              }
            }
            if (observerFailed) throw applicationFailureCause(observerError);
          } finally {
            settling = false;
            releaseRolledBackDelivery?.();
          }
        },
      };
      // TX-OBSERVER-STRAND-0. A capture-release failure after a successful
      // callback threw here with the turn still pending and no handle to it,
      // so nothing could ever settle its commit scope and every later Link
      // consequence was held behind it. It now fails closed the same way a
      // throwing callback does. (Observers cannot throw here any more: the
      // notifier and the lifecycle listeners isolate them.)
      if (primaryFailed || cleanupFailed) {
        try {
          if (autoRollbackUnsafe) {
            // Refused before anything is reversed; the recovery handle below
            // leaves the decision with the caller.
            const refusal = createRollbackError({
              kind: 'effect-validation-failed',
              pendingTurnId: pendingTurnId ?? transactionId,
              compensation: [],
              errorMessage:
                'Transaction rollback refused: a location it wrote was written again before the transaction returned',
            });
            publishRefusal(transactionId, refusal);
            throw refusal;
          }
          handle.rollback();
        } catch (rollbackError) {
          if (lifecycle !== 'pending') {
            // 'rejected': the compensation installed and the turn retired; only its
            // delivery failed. The failure that required the rollback keeps
            // precedence, and the delivery error is reported.
            reportCleanupFailure(
              'rollback delivery after a failed transaction',
              rollbackError
            );
            throw primaryFailed ? primaryError : cleanupError;
          }
          if (!primaryFailed) {
            // The refusal is thrown; without this the failure that made the
            // rollback necessary would leave no trace at all.
            reportCleanupFailure(
              'a post-callback step whose rollback was then refused',
              cleanupError
            );
          }
          // RECOVERY-HANDLE-0. `transact()` has not returned, so a refused
          // compensation would otherwise strand a transaction that is still
          // pending and still settleable with no reference to it. Catching
          // inside the callback only helps prospectively.
          //
          // `lifecycle` is the exact discriminator: rollback() assigns
          // 'rejected' only AFTER compensation physically installs, so a
          // refusal arrives here still 'pending' while an observer failure
          // arrives 'rejected'. Attaching a handle to a settled turn would
          // offer authority that no longer exists.
          // `!destroyed` matters: rollback()'s first guard throws on a
          // destroyed tree BEFORE lifecycle can move, so the lifecycle test
          // alone would hand back a handle whose every method throws "Cannot
          // settle a destroyed tree". Offering unusable authority is the same
          // class of false claim this recovery exists to remove.
          if (
            lifecycle === 'pending' &&
            !destroyed &&
            typeof rollbackError === 'object' &&
            rollbackError !== null
          ) {
            Object.defineProperty(rollbackError, 'recovery', {
              value: {
                transaction: research.enroll(
                  decorateHandle(handle, pendingTurnId),
                  lifecycleRegistry?.id,
                  transactionId
                ),
                // Explicit: the callback may have thrown `undefined`.
                callbackFailed: primaryFailed,
                callbackError: primaryFailed ? primaryError : undefined,
              },
              enumerable: false,
              configurable: true,
              writable: true,
            });
          }
          throw rollbackError;
        }
        throw primaryFailed ? primaryError : cleanupError;
      }
      // The pending-turn symbol stays private to the decorator.
      return research.enroll(
        decorateHandle(handle, pendingTurnId),
        lifecycleRegistry?.id,
        transactionId
      );
    },
    getConfirmedTurnRecords: () => authority.getConfirmedTurnRecords(),
    setHistoryRetention: (retain: number) =>
      authority.setHistoryRetention(retain),
    getConfirmedRetention: () => authority.getConfirmedRetention(),
    describePendingTurn: inspectPendingTurn,
    getSourceAdmissionCountsForTesting: () => ({
      segments: sourceSegments.size,
      admissions: sourceAdmissions.size,
      dependencies: authority.getSourceDependencyCountForTesting(),
    }),
    getInspectionFootprintCountsForTesting: () => ({
      writers: inspectionWrites.size,
      footprints: [...inspectionWrites.values()].reduce(
        (count, writes) => count + writes.size,
        0
      ),
    }),
    getConfirmedTurnCount: () => authority.getConfirmedTurnCount(),
    getPendingTurnCount: () => authority.getPendingTurnCount(),
    getConfirmedTurnIds: () => authority.getConfirmedTurnIds(),
    getPendingTurnIds: () => authority.getPendingTurnIds(),
    onPendingCreated(listener: TransactionLifecycleListener): () => void {
      pendingCreatedListeners.add(listener);
      return () => pendingCreatedListeners.delete(listener);
    },
    onPendingConfirmed(listener: TransactionLifecycleListener): () => void {
      pendingConfirmedListeners.add(listener);
      return () => pendingConfirmedListeners.delete(listener);
    },
    onPendingDiscarded(listener: TransactionLifecycleListener): () => void {
      pendingDiscardedListeners.add(listener);
      return () => pendingDiscardedListeners.delete(listener);
    },
  };


  (tree as unknown as Record<PropertyKey, unknown>)[
    INTERNAL_TRANSACTION_RUNTIME
  ] = runtime;

  // TURN-FEED-0.2. The runtime OWNS the lifecycle channel, so it installs one on
  // the tree's canonical host here rather than letting the first `announce()`
  // conjure it wherever that call happens to be standing.
  installTransactionLifecycleChannel(tree as object);

  return runtime;
}

/**
 * PROPOSAL-0. Classify one proposed effect against the later work admitted
 * against its turn.
 *
 * Proven as `PROPOSAL-INSPECTION-0` (6 cases) before being written here. The
 * rule: a proposed effect is SUPERSEDED when later work replaced the exact
 * contribution it made — a scalar whose location was written again, or a
 * structural effect whose SUBJECT was removed. Everything else is CURRENT,
 * including a subject newer truth merely updated or renamed, and including a
 * path later reoccupied by a DIFFERENT subject.
 *
 * ⚠️ This is NOT the rollback plan. A rollback plan answers "what can I safely
 * compensate?"; this answers "which parts of what I proposed are still
 * represented in current truth?". They come apart: a later UPDATE of a
 * proposed row makes the rollback REFUSE while leaving the pending's
 * structural contribution entirely current, and a refused plan has no
 * compensation list to reason from at all.
 *
 * Subject identity decides the structural cases. Path coincidence must not:
 * a reused business key belongs to a different record.
 */
function classifyProposedEffect(
  effect: TurnEffect,
  laterEffects: readonly TurnEffect[]
): ChangeStatus {
  if (effect.kind === 'set') {
    const replaced = laterEffects.some(
      (later) =>
        later.position === effect.position &&
        ((later.kind === 'remove' &&
          effect.subject !== undefined &&
          later.subject === effect.subject) ||
          (later.kind === 'set' &&
            scalarRelation(later, effect) === 'same' &&
            (later.subject === undefined ||
              effect.subject === undefined ||
              later.subject === effect.subject)))
    );
    return replaced ? 'superseded' : 'current';
  }

  let present = true;
  for (const later of laterEffects) {
    if (later.ownerPath !== effect.ownerPath) {
      continue;
    }
    if (later.subject !== effect.subject) {
      continue;
    }
    present = later.kind !== 'remove';
  }
  return present ? 'current' : 'superseded';
}

/**
 * Optional evidence retention (L15).
 *
 * Correctness records are bounded by live obligation and are NOT configurable:
 * a confirmed turn is released once no older pending turn could still need it.
 * This asks for diagnostic history ON TOP of that, and it is opt-in because
 * the reader-visible policy may not change silently.
 */
export type TransactionsConfig = {
  history?: {
    /**
     * Most recent confirmed turns to retain as evidence beyond what
     * correctness requires. Omitted or 0 means correctness-only.
     */
    retain: number;
  };
};

export function transactions(
  config?: TransactionsConfig
): Enhancer<TransactionMethods> {
  const enhancerFn = <T>(
    tree: ISignalTree<T>
  ): ISignalTree<T> & TransactionMethods => {
    const runtime = getOrCreateInternalTransactionRuntime(tree);
    if (config?.history) {
      runtime.setHistoryRetention(config.history.retain);
    }

    // `transact`, not `transaction`: a verb beside `transact()` and the
    // handle's own `confirm()`/`rollback()`. The old spelling was REMOVED
    // outright in the 2026-09-22 breaking API reset rather than bridged — see
    // docs/research/api-breaking-reset-0.md.
    const host = tree as ISignalTree<T> & TransactionMethods;

    // ONE VERB, ONE HANDLE. `transact()` is the verb form of `transaction`,
    // the noun the glossary teaches as Everyday vocabulary; the old
    // `transaction()` spelling was REMOVED outright in the 2026-09-22 breaking
    // API reset rather than bridged — see docs/research/api-breaking-reset-0.md.
    //
    // The review projection that briefly lived behind a second verb is folded
    // in here, so `inspect()` is available to EVERY caller. Nothing about
    // inspection ever depended on how the turn was opened; gating it behind a
    // separate entry point was an arbitrary restriction, and the second
    // vocabulary it carried was a fourth naming level AGENTS.md does not
    // sanction. No second code path, no turn-opening-specific rule: `pending`
    // below is exactly what the runtime hands anyone.
    host.transact = runtime.transaction;

    (tree as unknown as Record<string, unknown>)['__transactions'] = {
      getConfirmedTurnCount: () => runtime.getConfirmedTurnCount(),
      getPendingTurnCount: () => runtime.getPendingTurnCount(),
      getConfirmedTurnIds: () => runtime.getConfirmedTurnIds(),
      getPendingTurnIds: () => runtime.getPendingTurnIds(),
    };

    return tree as ISignalTree<T> & TransactionMethods;
  };

  const meta: EnhancerMeta = {
    name: 'transactions',
    provides: ['transactions'],
    capabilities: ['causal-runtime'],
  };
  (enhancerFn as unknown as { metadata: EnhancerMeta }).metadata = meta;
  (enhancerFn as unknown as Record<symbol, EnhancerMeta>)[ENHANCER_META] = meta;

  // THE ONE BOUNDARY CAST, re-justified: `enhancerFn` reads the realized tree
  // so its parameter is `ISignalTree<T>`, while `Enhancer<TAdded>` takes the
  // neutral `EnhancerHost` and parameters are contravariant under
  // `strictFunctionTypes`. Body untouched.
  //
  // The per-tree runtime this enhancer keeps on a module-level Symbol side
  // channel is unaffected — it is keyed off the tree object, not off the
  // declared parameter type, so a signature change cannot reach it.
  return enhancerFn as unknown as Enhancer<TransactionMethods>;
}
