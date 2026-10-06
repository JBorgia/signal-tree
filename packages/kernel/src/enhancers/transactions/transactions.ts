import type { FieldPresence } from '../../lib/internals/causal-runtime/causal-types';
import type { ToolingTree } from '../../lib/internals/tooling-tree';
import {
  applyInInvalidationGroup,
  applicationFailureCause,
  wasAppliedBeforeFailure,
} from '../../lib/internals/causal-runtime/post-application-failure';
import { holdEntityMembershipDelivery } from '../../lib/internals/entity-membership-view';
import {
  installTransactionLifecycleObservation,
  type PendingTransactionView,
  type TransactionRefusalReason,
} from '../../lib/internals/transaction-lifecycle-view';
import {
  preparePlainBranchMembers,
  plainBranchMembershipEffects,
  plainBranchMembershipChange,
  composePlainBranchMemberEffect,
  plainBranchMemberEffectIsNoop,
  type PlainBranchMemberPresence,
} from '../../lib/internals/plain-branch-membership';
import { flushDeferredTreeWrites } from '../../lib/internals/deferred-write-scope';
import {
  getOrCreateSubjectRestorationClaims,
  getSubjectRestorationClaims,
} from '../../lib/internals/subject-restoration-claims';
import type {
  Enhancer,
  EnhancerMeta,
  ISignalTree,
  WriteMetadata,
} from '../../lib/types';
import type {
  TransactionsConfig,
  PendingTransaction,
  TransactionMethods,
} from './transactions.types';

import {
  getWriteParticipation,
  isInspectionWrite,
} from '../../lib/write-participation';
import { ENHANCER_META, SignalTreeRollbackError } from '../../lib/types';
import {
  openCommitScope,
  settleCommitScope,
} from '../../lib/internals/commit-consequence';
import { AppliedTurnProjection } from '../../lib/internals/causal-runtime/applied-turn-projection';
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
  defineTreeRealizationDescriptors,
  defineTreeRealizationPort,
  forgetSubjectsInTreeRealizationDescriptors,
  getTreeRealizationDescriptors,
  getTreeRealizationPort,
  rememberTreeRealizationDescriptor,
} from '../../lib/internals/causal-runtime/tree-realization-adapter';
import { TurnStore } from '../../lib/internals/causal-runtime/turn-store';
import { interceptLeafSignals } from '../../lib/internals/intercept-leaf-signals';
import {
  getMutationCaptureRuntime,
  type CollectionOrderCapture,
} from '../../lib/internals/mutation-capture-runtime';
import { getOwnedPositionIds } from '../../lib/internals/owned-mutation';
import { getPositionRegistry } from '../../lib/internals/position-registry';
import { reportContainedObserverError } from '../../lib/internals/error-reporter';
import { getPathNotifier } from '../../lib/path-notifier';
import { isTraversableNode } from '../../lib/utils';
import {
  getActiveWriteContext,
  withWriteContext,
} from '../../lib/write-context';
import { visitTree } from '../../lib/internals/visit-tree';
import { getTreeScalarSlotRuntime } from '../../lib/internals/tree-scalar-slot-port';
import { getLocationRuntime } from '../../lib/internals/location-runtime';

type TurnEffectBase = {
  position: number;
  ownerPath: string;
  path: string;
};

export type ScalarSetEffect = TurnEffectBase & {
  kind: 'set';
  subject?: number;
  /** Exact keys within this entity lifetime, independent of its current key. */
  fieldSegments?: readonly string[];
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
  /**
   * H4/H5/H6 — THE SUPERSEDER'S OWN SETTLEMENT STATE.
   *
   * A later effect used to arrive with no provenance, and the plan builder
   * treated every one of them as ESTABLISHED: a later `replace` at the same
   * location meant the older contribution was already invisible, so reversing
   * it needed no compensation. That is true of a CONFIRMED later write. It is
   * false of one belonging to a transaction that is itself still pending,
   * because that write may yet be rolled back — and when it is, the location
   * falls back to a before-image that records what the slot HELD (the older
   * transaction's speculative value), not who owns it now. Measured: rolling
   * back P1 then P2 resurrected P1's y=1, a value P1 had already given up.
   *
   * Repairing that properly means per-location ownership rather than per-turn
   * before-images, which is the 16.0 model and deliberately not a patch. Here
   * the flag only makes the plan builder REFUSE instead of guessing.
   */
  unsettled?: boolean;
};

/** The payload both dependency refusals carry; the `kind` is added per member. */
type PendingRollbackDependencyDetail = {
  pendingTurnId: number;
  pendingEffect: TurnEffect;
  conflictingTurnId?: number;
  conflictingEffect?: TurnEffect;
};

/**
 * `later-confirmed-dependency` — settled later work depends on state this
 * rollback would invalidate. `later-pending-dependency` — the later work is
 * ANOTHER OPEN TRANSACTION, so neither reversing nor skipping can be proven
 * safe. Separate kinds because the second is not a claim about confirmed state
 * and must not borrow a name that says it is.
 *
 * Two MEMBERS rather than one member with two `kind` values, so that testing
 * both kinds narrows the union to `never` and `explainRollbackFailure` can
 * prove it handles every one.
 */
export type PendingRollbackDependencyConflict =
  | (PendingRollbackDependencyDetail & {
      kind: 'later-confirmed-dependency';
    })
  | (PendingRollbackDependencyDetail & { kind: 'later-pending-dependency' });

/** Build the right member from the superseder's settlement state. */
const dependencyConflict = (
  unsettled: boolean,
  detail: PendingRollbackDependencyDetail
): PendingRollbackDependencyConflict =>
  unsettled
    ? { kind: 'later-pending-dependency', ...detail }
    : { kind: 'later-confirmed-dependency', ...detail };

type PendingRollbackPlan =
  | { compensation: TurnEffect[] }
  | { conflict: PendingRollbackDependencyConflict };

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

type CaptureBucket = {
  /** Committed entity touches visible before delayed replay capture arrives. */
  entityFootprints: PendingEffectMap;
  /**
   * TX-AUTO-ROLLBACK-0: window sequence of this bucket's last write per
   * location key (see windowKeys).
   */
  ownWriteSeq: Map<string, number>;
  subjectIds: Set<number>;
  positionIds: Set<number>;
  baselineValues: Map<number, unknown>;
  effects: PendingEffectMap;
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
  transaction(fn: () => void): PendingTransaction;
  /** @internal Raw retained records; projected by `/internals`. */
  getConfirmedTurnRecords(): readonly TransactionTurnRecord[];
  /** L15: opt-in evidence retention beyond the correctness obligation. */
  setHistoryRetention(retain: number): void;
  /** Explicit retention metadata; never inferred from ids. */
  getConfirmedRetention(): {
    truncated: boolean;
    firstAvailableTurnId?: number;
  };
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
  // Narrowed on the UNIQUE kind first, so that the two dependency kinds below
  // can each be tested and still leave `never` for the exhaustiveness check.
  if (cause.kind === 'effect-validation-failed') {
    return (
      `${ROLLBACK_ERROR_MESSAGE}: compensating turn ${cause.pendingTurnId} ` +
      `failed validation — ${cause.errorMessage} [effect-validation-failed]`
    );
  }
  if (cause.kind === 'later-pending-dependency') {
    const at =
      cause.conflictingTurnId === undefined
        ? 'another open transaction'
        : `open transaction ${cause.conflictingTurnId}`;
    return (
      `${ROLLBACK_ERROR_MESSAGE}: ${at} overlaps turn ${cause.pendingTurnId}, ` +
      `so reversing it cannot be proven safe while both are unsettled — ` +
      `settle the newer transaction first [later-pending-dependency]`
    );
  }
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
  // Exhaustive. A new refusal kind is a COMPILE error here rather than a
  // silently generic sentence — the legibility this function exists for is
  // only worth anything if it cannot quietly stop applying.
  const unhandled: never = cause;
  return `${ROLLBACK_ERROR_MESSAGE} [${(unhandled as { kind: string }).kind}]`;
};

const createRollbackError = (
  cause: RollbackFailureCause
): SignalTreeRollbackError =>
  new SignalTreeRollbackError(explainRollbackFailure(cause), { cause });

function cloneTurnEffect(effect: TurnEffect): TurnEffect {
  return { ...effect };
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

function buildPendingRollbackPlan(
  pendingTurn: TransactionTurnRecord | undefined,
  laterEffects: LaterAppliedEffect[]
): PendingRollbackPlan {
  if (!pendingTurn) {
    return { compensation: [] };
  }

  const pendingEffects = pendingTurn.__effects ?? [];
  const makeScalarKey = (effect: ScalarSetEffect): string =>
    JSON.stringify([
      effect.position,
      effect.subject,
      effect.fieldSegments ?? effect.path,
    ]);
  // SETTLED superseders only — the ONE place an open transaction is denied
  // supersession, deliberately.
  //
  // An unsettled superseder may itself be rolled back, and when it is, the
  // location it "superseded" is restored from a before-image naming THIS turn's
  // speculative value — see `LaterAppliedEffect.unsettled`. Missing that key
  // makes the path-equal branch below fall through to a conflict instead of
  // skipping compensation, which is the refusal H4/H5/H6 require.
  //
  // ⚠️ An early `if (laterEntry.unsettled) return conflictWith(laterEntry)` in
  // that branch produces the same refusals and was written first. It is NOT
  // kept: it is correct only because the loop visits every later entry, so an
  // added `break` or a reordering would silently restore the defect. Honesty
  // belongs in the SET, where it holds however the loop is rewritten. Measured
  // — each guard alone passes H1..H9; with both removed H6 fails.
  const supersededScalarKeys = new Set(
    laterEffects
      .filter((entry) => !entry.unsettled)
      .map(({ effect }) => effect)
      .filter((effect): effect is ScalarSetEffect => effect.kind === 'set')
      .map(makeScalarKey)
  );

  const classifyLaterOverlap = (
    effect: ScalarSetEffect
  ):
    | { kind: 'none' }
    | { kind: 'superseded' }
    | {
        kind: 'conflict';
        unsettled: boolean;
        conflictingTurnId?: number;
        conflictingEffect?: TurnEffect;
      } => {
    let superseded = false;
    const conflictWith = (laterEntry: LaterAppliedEffect) =>
      ({
        kind: 'conflict',
        unsettled: laterEntry.unsettled === true,
        conflictingTurnId: laterEntry.turnId,
        conflictingEffect: laterEntry.effect,
      } as const);
    for (const laterEntry of laterEffects) {
      const laterEffect = laterEntry.effect;
      if (laterEffect.position !== effect.position) {
        continue;
      }
      if (
        laterEffect.subject !== undefined &&
        effect.subject !== undefined &&
        laterEffect.subject !== effect.subject
      ) {
        continue;
      }
      const fields = effect.fieldSegments;
      const laterFields =
        laterEffect.kind === 'set' ? laterEffect.fieldSegments : undefined;
      const sameField =
        fields && laterFields
          ? fields.length === laterFields.length &&
            fields.every((key, index) => key === laterFields[index])
          : laterEffect.path === effect.path;
      if (sameField) {
        if (laterEffect.kind !== 'set') {
          return conflictWith(laterEntry);
        }
        if (laterEffect.mutationIntent === 'replace') {
          if (supersededScalarKeys.has(makeScalarKey(effect))) {
            superseded = true;
            continue;
          }
        }
        return conflictWith(laterEntry);
      }
      const overlaps =
        fields && laterFields
          ? fields
              .slice(0, Math.min(fields.length, laterFields.length))
              .every((key, index) => key === laterFields[index])
          : laterEffect.path.startsWith(`${effect.path}.`) ||
            effect.path.startsWith(`${laterEffect.path}.`);
      if (overlaps) {
        return conflictWith(laterEntry);
      }
    }
    return superseded ? { kind: 'superseded' } : { kind: 'none' };
  };

  const hasSameSubjectDependency = (
    effect: CollectionAddEffect | CollectionRemoveEffect | CollectionRekeyEffect
  ):
    | {
        unsettled: boolean;
        conflictingTurnId?: number;
        conflictingEffect?: TurnEffect;
      }
    | undefined => {
    for (const laterEntry of laterEffects) {
      const laterEffect = laterEntry.effect;
      if (laterEffect.ownerPath !== effect.ownerPath) {
        continue;
      }
      const found = () => ({
        unsettled: laterEntry.unsettled === true,
        conflictingTurnId: laterEntry.turnId,
        conflictingEffect: laterEffect,
      });
      if (laterEffect.kind === 'set') {
        if (laterEffect.subject === effect.subject && effect.kind !== 'rekey') {
          return found();
        }
        continue;
      }
      if (laterEffect.subject === effect.subject) {
        return found();
      }
    }
    return undefined;
  };

  /**
   * PROPOSAL-REJECTION-0 disposition PR-A and REKEY-SUPERSESSION-0, ported
   * from main for 15.4.2. The axis is SUPERSESSION vs DEPENDENCY, not scalar
   * vs structural.
   *
   * `hasSameSubjectDependency` is a presence test: any later effect on the
   * subject refuses. That is right when newer truth RESTS ON the structure this
   * turn created. It is wrong when newer truth ERASED it: a later remove of a
   * subject this turn added, or retargeted by rekey, has already performed the
   * compensation the rollback would issue. Refusing then strands the turn's
   * unrelated speculative values (`proposal-rejection-0.spec.ts` cases 11, 12,
   * 13 and 16; `rekey-supersession-0.spec.ts` cases 2 and 3).
   *
   * Only the final later effect for the subject decides. Stable entity
   * lifetime makes a removed subject unreferenceable, so a re-add of the same
   * business key is a different subject and never reaches this scan.
   *
   * SETTLED erasers only, as for scalars above: an open turn's remove may still
   * roll back and re-add the subject exactly as this turn proposed it, so it
   * stays a dependency (`later-pending-dependency`; settle the newer turn
   * first). `structural-supersession-unsettled.spec.ts` pins both orders.
   *
   * A pending `remove` is deliberately excluded: compensating it re-adds the
   * subject, and a later re-add by another writer is newer truth that re-add
   * would clobber.
   */
  const isErasedBySettledWork = (
    effect: CollectionAddEffect | CollectionRekeyEffect | ScalarSetEffect
  ): boolean => {
    let erased = false;
    for (const laterEntry of laterEffects) {
      const laterEffect = laterEntry.effect;
      if (laterEffect.ownerPath !== effect.ownerPath) {
        continue;
      }
      if (laterEffect.subject !== effect.subject) {
        continue;
      }
      erased = laterEffect.kind === 'remove' && laterEntry.unsettled !== true;
    }
    return erased;
  };

  const compensation: TurnEffect[] = [];
  for (let i = pendingEffects.length - 1; i >= 0; i--) {
    const effect = pendingEffects[i];
    switch (effect.kind) {
      case 'set': {
        // 15.4.4: the same supersession for a FIELD write to a row that
        // settled later work removed (only the final later effect for the
        // subject decides, as above). The row is gone, so there is nothing to
        // restore; the rest of the turn reverses. classifyLaterOverlap read the
        // removal's path as a parent of the field and refused
        // (later-confirmed-dependency), stranding the turn's other writes.
        // An unsettled removal, or later work that edited the row and kept
        // it, still reaches it and still refuses.
        if (effect.subject !== undefined && isErasedBySettledWork(effect)) {
          continue;
        }
        const overlap = classifyLaterOverlap(effect);
        if (overlap.kind === 'conflict') {
          return {
            conflict: dependencyConflict(overlap.unsettled, {
              pendingTurnId: pendingTurn.id,
              pendingEffect: effect,
              conflictingTurnId: overlap.conflictingTurnId,
              conflictingEffect: overlap.conflictingEffect,
            }),
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
        if (effect.kind !== 'remove' && isErasedBySettledWork(effect)) {
          continue;
        }
        const dependency = hasSameSubjectDependency(effect);
        if (dependency) {
          return {
            conflict: dependencyConflict(dependency.unsettled, {
              pendingTurnId: pendingTurn.id,
              pendingEffect: effect,
              conflictingTurnId: dependency.conflictingTurnId,
              conflictingEffect: dependency.conflictingEffect,
            }),
          };
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
  /** L15: evidence retained beyond correctness. 0 = correctness-only. */
  private historyRetain = 0;
  /** Set once a record has actually been dropped. Never inferred from ids. */
  private evictedConfirmed = false;
  private pendingTurns = new Map<number, TransactionTurnRecord>();
  // How many pending turns wrote each position. Kept in step with
  // `pendingTurns` during materialization and settlement, so asking whether a
  // settlement may forget a descriptor is O(1) rather than a rebuild of every
  // pending turn's positions (which made settling P overlapping turns O(P^2)).
  private readonly pendingPositionCounts = new Map<number, number>();
  private nextTurnId = 1;

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
      undefined
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

  /**
   * Record a settled ordinary turn. Returns nothing: no caller reads the
   * record, and the clone this used to return was built and dropped per flush.
   */
  recordConfirmed(
    subjectIds?: number[],
    positionIds?: number[],
    effects?: TurnEffect[]
  ): void {
    if (
      this.pendingTurns.size === 0 &&
      this.historyRetain === 0 &&
      this.confirmedTurns.length === 0
    ) {
      // Match building and immediately evicting a nonempty ordinary record,
      // including the sequence and reader's explicit truncation evidence.
      // Capture/drain and descriptor cleanup still run in the caller.
      if (
        (subjectIds?.length ?? 0) > 0 ||
        (positionIds?.length ?? 0) > 0 ||
        (effects?.length ?? 0) > 0
      ) {
        this.nextTurnId++;
        this.evictedConfirmed = true;
      }
      return;
    }
    const turn = this.buildTurn(subjectIds, positionIds, effects);
    if (!turn) {
      return;
    }
    this.insertConfirmed(turn);
    // The obligation set just changed; release what it no longer covers.
    this.releaseConfirmedBeyondObligation();
  }

  reservePending(bucket: CaptureBucket): number {
    // Reserve before observers can reenter. Otherwise their confirmed writes
    // can be evicted with no pending obligation, their external writes never
    // enter the dependency ledger, and their transactions receive older ids.
    const id = this.nextTurnId++;
    this.pendingTurns.set(id, {
      id,
      // Earlier handles can be settled by an observer before this callback's
      // handle exists. Their dependency check must see the writes already
      // captured here, not an empty placeholder. Materialization replaces
      // this view with the completed record; it owns no second effect ledger.
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
      this.ledgerSeq = 0;
      this.pendingOpenedAtSeq.clear();
    }
  }

  setHistoryRetention(retain: number): void {
    this.historyRetain = Number.isFinite(retain) && retain > 0 ? retain : 0;
    this.releaseConfirmedBeyondObligation();
  }

  /** Explicit retention metadata for the reader; never inferred from ids. */
  getConfirmedRetention(): {
    truncated: boolean;
    firstAvailableTurnId?: number;
  } {
    return {
      truncated: this.evictedConfirmed,
      firstAvailableTurnId: this.confirmedTurns[0]?.id,
    };
  }

  /**
   * L15: correctness retention follows live responsibility.
   *
   * `getPendingRollbackPlan` is the only correctness consumer of this ledger
   * and selects `confirmedTurns.filter(t => t.id > turnId)`. Ids are monotonic,
   * so a confirmed turn can only ever be needed by a pending turn OLDER than
   * itself; once none remains it can never appear in a future plan.
   *
   * Derived, not a cap. `historyRetain` is a separate, explicitly requested
   * evidence facility layered on top.
   */
  private releaseConfirmedBeyondObligation(): void {
    const turns = this.confirmedTurns;
    if (turns.length === 0) return;
    let minPending = Infinity;
    for (const id of this.pendingTurns.keys()) {
      if (id < minPending) minPending = id;
    }
    // `insertConfirmed` keeps the ledger sorted by id, so the required turns
    // (`id > minPending`) are a suffix and so are the `historyRetain` newest:
    // what survives is the longer suffix. Trimming the front replaces a whole
    // filter per record, which made every flush under a pending turn O(ledger).
    let start = 0;
    while (start < turns.length && turns[start].id <= minPending) start++;
    if (this.historyRetain > 0) {
      // Exactly `slice(-historyRetain)`, which truncates the count: a
      // fractional retain below 1 is `slice(-0)` and keeps everything.
      const newest = Math.trunc(this.historyRetain);
      start =
        newest === 0 ? 0 : Math.min(start, Math.max(0, turns.length - newest));
    }
    if (start > 0) {
      this.confirmedTurns = turns.slice(start);
      this.evictedConfirmed = true;
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
    // SETTLED. Confirmation discards rollback state rather than becoming
    // permanent history — those are different product concepts. A tree that
    // also has `restoration()` has already claimed these subjects through its
    // own capture of the same writes, so the subject is not left unowned by
    // the handoff.
    this.releasePendingClaims(turnId);
    this.insertConfirmed(turn);
    // The obligation set just changed; release what it no longer covers.
    this.releaseConfirmedBeyondObligation();
    this.releaseLedgerIfQuiet();
    return cloneTurnRecord(turn);
  }

  /**
   * Read a pending turn without retiring it.
   *
   * Compensation needs the turn's `__baselineValues` and claim set, and used
   * to get them from `discardPending`'s return value — which forced the retire
   * to happen BEFORE the attempt, and so made a refused attempt unrecoverable.
   * Reading and retiring are now separate acts.
   */
  peekPending(turnId: number): TransactionTurnRecord | undefined {
    const turn = this.pendingTurns.get(turnId);
    return turn ? cloneTurnRecord(turn) : undefined;
  }

  discardPending(turnId: number): TransactionTurnRecord | undefined {
    const turn = this.pendingTurns.get(turnId);
    if (!turn) {
      return undefined;
    }
    this.pendingTurns.delete(turnId);
    this.countPendingPositions(turn, -1);
    this.pendingOpenedAtSeq.delete(turnId);
    this.releasePendingClaims(turnId);
    this.releaseLedgerIfQuiet();
    // Discarding can raise min(pendingIds) and discharge the obligation.
    this.releaseConfirmedBeyondObligation();
    return cloneTurnRecord(turn);
  }

  getPendingRollbackPlan(turnId: number): PendingRollbackPlan {
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
      .map((entry) => ({ turnId, effect: entry.effect }));

    // H4/H5/H6 — OTHER OPEN TRANSACTIONS ARE LATER WORK TOO.
    //
    // This selector was `confirmedTurns` plus realizations, so a SECOND OPEN
    // TRANSACTION was invisible to the first one's rollback plan: it is not
    // confirmed, and its writes are authored rather than realized, so neither
    // source carried it. The plan therefore reversed straight through it.
    // Measured on 15.2.1 — P1 writes x=1,y=1; P2 writes y=2,z=2; `p1.rollback()`
    // reported 'ok' and left {x:0, y:0, z:2}, silently destroying P2's y=2. A
    // following `p2.confirm()` then committed a transaction missing one of the
    // two fields it wrote.
    //
    // Ids are monotonic and a callback runs synchronously at creation, so
    // `id > turnId` is exactly "opened after this one".
    const pendingLater: LaterAppliedEffect[] = [];
    for (const [otherId, otherTurn] of this.pendingTurns) {
      if (otherId <= turnId) continue;
      for (const effect of otherTurn.__effects ?? []) {
        pendingLater.push({ turnId: otherId, effect, unsettled: true });
      }
    }

    return buildPendingRollbackPlan(this.pendingTurns.get(turnId), [
      ...authoredLater,
      ...observedLater,
      ...pendingLater,
    ]);
  }

  getConfirmedTurnCount(): number {
    return this.confirmedTurns.length;
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

  private insertConfirmed(turn: TransactionTurnRecord): void {
    // Ordinary records always carry the newest id; only a confirmed pending
    // turn can land in the middle.
    const last = this.confirmedTurns[this.confirmedTurns.length - 1];
    if (!last || last.id < turn.id) {
      this.confirmedTurns.push(turn);
      return;
    }
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
    subjectIds: new Set<number>(),
    positionIds: new Set<number>(),
    baselineValues: new Map(),
    effects: new Map(),
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
export function peekInternalTransactionRuntime<T, TAccum = unknown>(
  tree: ToolingTree<T, TAccum>
): InternalTransactionRuntime | undefined {
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
      // Releases the claim; deliberately does NOT drive the reclamation sink.
      // Settlement can land before the notifier flush that lets `restoration()`
      // claim the same subjects, and reclaiming in that gap is the
      // premature-reclamation hazard `never-claimed-retirement.spec.ts` pins.
      // Reclamation happens at the history eviction boundary, which is late
      // enough that every capture has run.
      getOrCreateSubjectRestorationClaims(tree)?.release(
        `transaction:${turnId}`
      );
    }
  );
  // These records are the handle settlement state, including empty transactions.
  // Observation projects them; it does not maintain a second pending ledger.
  type TransactionState = PendingTransactionView & {
    status: 'pending' | 'confirmed' | 'rejected';
    phase: 'opened' | 'staged';
    consequencesReleased: boolean;
    /** True only while rollback() is applying compensation. */
    compensating?: boolean;
  };
  const activeTransactions = new Map<number, TransactionState>();
  const publishLifecycle = installTransactionLifecycleObservation(tree, () =>
    [...activeTransactions.values()].map(
      ({ transactionId, phase, consequencesReleased }) => ({
        transactionId,
        phase,
        consequencesReleased,
      })
    )
  );
  const refusalReason = (error: unknown): TransactionRefusalReason => {
    const cause = (error as { cause?: { kind?: unknown } } | undefined)?.cause;
    switch (cause?.kind) {
      case 'later-confirmed-dependency':
      case 'later-pending-dependency':
      case 'structural-drift':
        return cause.kind;
      default:
        return 'effect-validation-failed';
    }
  };
  const transactionOwnerToken = {};
  let nextTransactionId = 1;
  const isRestoring = false;
  let selfDirty = false;
  let unsubscribeFlush: (() => void) | null = null;
  let unsubscribeNotifications: (() => void) | null = null;
  let unsubscribeReset: (() => void) | null = null;
  let unsubscribeCollectionOrders: (() => void) | null = null;
  let restoreLeafInterceptors: (() => void) | null = null;
  const pendingCapture = createCaptureBucket();
  const pendingTransactions = new Map<number, CaptureBucket>();
  const pendingOrderDeltas = new Map<number, CollectionOrderDelta[]>();
  const pendingCreatedListeners = new Set<TransactionLifecycleListener>();
  const pendingConfirmedListeners = new Set<TransactionLifecycleListener>();
  const pendingDiscardedListeners = new Set<TransactionLifecycleListener>();
  const treeWrapper = tree as unknown as object;
  const stateRoot = tree.$ as unknown as object;
  // Defined on the root at construction, before any enhancer runs, and never
  // replaced; reading it once here keeps a symbol lookup off every capture.
  const positionRegistry = getPositionRegistry(tree.$);
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
      tree: tree as unknown as ISignalTree<object>,
      descriptors: realizationDescriptors,
    });
  defineTreeRealizationPort(treeWrapper, realizationPort);
  defineTreeRealizationPort(stateRoot, realizationPort);

  // TX-AUTO-ROLLBACK-0. The rollback after a failure that happens AFTER the
  // callback returned (the invalidation group closing, the capture failing
  // to release) runs while transaction() is still in progress, when observers
  // have already had a chance to write the same locations: a location
  // subscriber or framework effect at the group close, an observeWrites
  // subscriber in the flush, a transaction one of them opened. Restoring this
  // transaction's before-image over such a write would destroy it, so that
  // rollback refuses when a later write touched one of its locations. The
  // throwing-callback path uses the same refusal: callback failure cannot
  // authorize erasing another writer. Surviving writes are committed.
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
  // (Forgetting retired SUBJECTS below still visits every descriptor when a
  // settlement retires any; that step is unchanged.)
  const forgetUnclaimedDescriptorSubjects = (
    subjectIds: readonly number[],
    descriptorOwnersBefore?: ReadonlySet<number>,
    ownPositions: readonly number[] = []
  ): void => {
    const claims = getSubjectRestorationClaims(tree);
    const unclaimed = [...new Set(subjectIds)].filter((subjectId) => {
      if (claims?.isClaimed(subjectId)) return false;
      // An open callback has captured reversal inputs before materialization
      // registers its pending claims. A reentrant ordinary flush can finish
      // in that interval; its confirmed record does not end the open capture.
      for (const bucket of pendingTransactions.values()) {
        if (bucket.subjectIds.has(subjectId)) return false;
      }
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
    subjectIds: number[];
    positionIds: number[];
    baselineValues: Map<number, unknown>;
    effects: TurnEffect[];
    collectionOrders: Array<Omit<CollectionOrderCapture, 'meta'>>;
  } => {
    bucket.ownWriteSeq.clear();
    const subjectIds = Array.from(bucket.subjectIds).sort((a, b) => a - b);
    bucket.subjectIds.clear();
    const positionIds = Array.from(bucket.positionIds).sort((a, b) => a - b);
    bucket.positionIds.clear();
    const baselineValues = new Map(bucket.baselineValues);
    bucket.baselineValues.clear();
    const effects = Array.from(bucket.effects.values()).map(cloneTurnEffect);
    bucket.effects.clear();
    bucket.entityFootprints.clear();
    // The bucket copied both subject lists when it captured them and is cleared
    // here, so the drained entries are already exclusively owned.
    const collectionOrders = Array.from(bucket.collectionOrders.values());
    bucket.collectionOrders.clear();
    return {
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
          effect.fieldSegments ?? effect.path,
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

  const enqueueEffect = (
    bucket: CaptureBucket,
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
        // Created and destroyed inside one transaction: no net structural
        // effect, so rollback must do nothing for this subject.
        if (existing.kind === 'add' && effect.kind === 'remove') {
          effectMap.delete(key);
          return;
        }

        // Renamed then removed: rollback has to restore the ORIGINAL key. P0-B.
        if (existing.kind === 'rekey' && effect.kind === 'remove') {
          const composed = { ...effect, key: existing.beforeKey };
          rememberBaselineValue(bucket, composed);
          effectMap.set(key, composed);
          return;
        }

        // Created then renamed: one creation, under the final key.
        if (existing.kind === 'add' && effect.kind === 'rekey') {
          existing.key = effect.afterKey;
          return;
        }

        // Renamed twice: original to final; a round trip is no rename.
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
    const membershipEffects = plainBranchMembershipEffects(meta);
    if (membershipEffects) {
      for (const effect of membershipEffects) {
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

    // Payload shape is not topology: a registered terminal slot owns the
    // whole value. Only branch/subject values need field decomposition.
    if (
      isPlainRecord(next) &&
      isPlainRecord(prev) &&
      !(
        !subjectIds?.length &&
        positionIds?.[0] !== undefined &&
        (getTreeScalarSlotRuntime(tree) ??
          getTreeScalarSlotRuntime(tree.$))?.resolveScalarSlot(positionIds[0]) !==
          undefined
      )
    ) {
      const position = positionIds?.[0];
      const subject = subjectIds?.[0];
      if (position === undefined) {
        return;
      }
      const captureFields = (
        previous: Record<string, unknown>,
        current: Record<string, unknown>,
        segments: readonly string[]
      ): void => {
        for (const key of new Set([
          ...Object.keys(previous),
          ...Object.keys(current),
        ])) {
          const before = previous[key];
          const after = current[key];
          const beforePresent = Object.prototype.hasOwnProperty.call(
            previous,
            key
          );
          const afterPresent = Object.prototype.hasOwnProperty.call(
            current,
            key
          );
          if (before === after && beforePresent === afterPresent) continue;
          const fieldSegments = [...segments, key];
          if (
            subject !== undefined &&
            isPlainRecord(before) &&
            isPlainRecord(after)
          ) {
            captureFields(before, after, fieldSegments);
            continue;
          }
          enqueueEffect(bucket, effectMap, {
            kind: 'set',
            path: `${path}.${fieldSegments.join('.')}`,
            ownerPath: ownerPath ?? path,
            position,
            subject,
            fieldSegments: subject === undefined ? undefined : fieldSegments,
            ...(subject !== undefined && !(beforePresent && afterPresent)
              ? {
                  fieldPresence: {
                    before: beforePresent,
                    after: afterPresent,
                  },
                }
              : {}),
            before,
            after,
            mutationIntent: meta?.mutationIntent,
          });
        }
      };
      captureFields(prev, next, []);
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
      fieldSegments: subjectIds?.length ? [] : undefined,
      before: prev,
      after: next,
      mutationIntent: meta?.mutationIntent,
    });
  };

  // Replay remains captured through the normal notifier. This transient view
  // serves only admission while a callback is open: an older handle may be
  // rolled back after entity storage committed but before any notifier listener
  // has seen it. It is discarded with the capture bucket on materialization.
  const observeOpenEntityCapture = (
    transactionId: number,
    bucket: CaptureBucket
  ): (() => void) | undefined =>
    getMutationCaptureRuntime(tree)?.subscribeCommittedEntity?.((capture) => {
      if (
        isRestoring ||
        capture.meta?.origin === 'transaction-rollback' ||
        capture.meta?.origin === 'restoration' ||
        isInspectionWrite(capture.meta) ||
        getWriteParticipation(capture.meta) === 'realized'
      )
        return;
      if (resolveTransactionId(capture.meta) !== transactionId) return;
      for (const change of capture.changes) {
        bucket.subjectIds.add(change.subject);
        if (change.structural) {
          const effect: ScalarSetEffect = {
            kind: 'set',
            position: capture.owner,
            ownerPath: capture.ownerPath,
            path: capture.ownerPath,
            subject: change.subject,
            fieldSegments: [],
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
            capture.meta,
            capture.ownerPath,
            [change.subject],
            [capture.owner]
          );
        }
      }
    });

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
    const members = plainBranchMembershipEffects(meta);
    if (members) {
      for (const effect of members) {
        bucket.positionIds.add(effect.position);
        if (pendingTransactions.size > 0) {
          for (const key of windowKeys([effect.position], undefined)) {
            bucket.ownWriteSeq.set(key, windowWriteSeq);
          }
        }
        enqueueEffect(bucket, bucket.effects, effect);
      }
      return;
    }
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
      registry: positionRegistry,
    });
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

  const recordConfirmedBucket = (
    bucket: CaptureBucket,
    reservedId?: number
  ): void => {
    const { subjectIds, positionIds, effects } = drainCaptureBucket(bucket);
    const subjects = subjectIds.length > 0 ? subjectIds : undefined;
    const positions = positionIds.length > 0 ? positionIds : undefined;
    const capturedEffects = effects.length > 0 ? effects : undefined;
    if (reservedId === undefined) {
      authority.recordConfirmed(subjects, positions, capturedEffects);
    } else if (
      authority.createPending(reservedId, subjects, positions, capturedEffects)
    ) {
      authority.confirmPending(reservedId);
    }
    // Subject addresses serve pending rollback and retained undo/redo claims.
    // Confirmed effects only classify dependencies; retaining their ledger is
    // not a reason to retain these addresses. If restoration's flush runs
    // later, it reinstalls its captured descriptor inputs when admitting the
    // history entry. Only forget unclaimed subjects here: outer position
    // shells still route notifications, and physical reclamation has a
    // separate eligibility boundary.
    forgetUnclaimedDescriptorSubjects(subjectIds);
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

  unsubscribeCollectionOrders =
    getMutationCaptureRuntime(tree)?.subscribeCollectionOrder?.((capture) => {
      const transactionId = resolveTransactionId(capture.meta);
      if (transactionId === undefined) {
        return;
      }
      const bucket = getTransactionBucket(transactionId);
      const existing = bucket.collectionOrders.get(capture.owner);
      bucket.collectionOrders.set(capture.owner, {
        owner: capture.owner,
        ownerPath: capture.ownerPath,
        beforeSubjects: existing?.beforeSubjects ?? [...capture.beforeSubjects],
        afterSubjects: [...capture.afterSubjects],
        beforeFrontier: existing?.beforeFrontier ?? capture.beforeFrontier,
        afterFrontier: capture.afterFrontier,
      });
      bucket.positionIds.add(capture.owner);
    }) ?? null;

  const materializePendingTransaction = (
    transactionId: number,
    reservedId: number
  ): TransactionTurnRecord | undefined => {
    const bucket = pendingTransactions.get(transactionId);
    if (!bucket) {
      pendingTransactions.delete(transactionId);
      releaseWindowIfClosed();
      authority.discardPending(reservedId);
      return undefined;
    }
    // Read the capture WITHOUT clearing it, and retire it only once the
    // pending turn exists. 15.4.3 deleted it first: a throw in this step left
    // abortOpenTransaction nothing to compensate or record, so the write stayed
    // live and unrecorded, and an earlier transaction's rollback reversed
    // through it.
    const subjectIds = [...bucket.subjectIds].sort((a, b) => a - b);
    const positionIds = [...bucket.positionIds].sort((a, b) => a - b);
    const effects = [...bucket.effects.values()].map(cloneTurnEffect);
    const baselineValues = new Map(bucket.baselineValues);
    const orderDeltas = [...bucket.collectionOrders.values()].map((order) =>
      deriveCollectionOrderDelta(
        order.owner,
        order.beforeSubjects,
        order.afterSubjects,
        order.beforeFrontier,
        order.afterFrontier
      )
    );
    const pending = authority.createPending(
      reservedId,
      subjectIds.length > 0 ? subjectIds : undefined,
      positionIds.length > 0 ? positionIds : undefined,
      effects.length > 0 ? effects : undefined,
      baselineValues.size > 0 ? baselineValues : undefined
    );
    drainCaptureBucket(bucket);
    pendingTransactions.delete(transactionId);
    releaseWindowIfClosed();
    if (pending && orderDeltas.length > 0) {
      pendingOrderDeltas.set(pending.id, orderDeltas);
    }
    return pending;
  };

  const prepareTransactionRollbackInput = (
    transactionId: number
  ): {
    captured: boolean;
    positionIds: number[];
    effects: TurnEffect[];
    baselineValues: Map<number, unknown>;
    orderDeltas: CollectionOrderDelta[];
  } => {
    const bucket = pendingTransactions.get(transactionId);
    if (!bucket) {
      return {
        captured: false,
        positionIds: [],
        effects: [],
        baselineValues: new Map(),
        orderDeltas: [],
      };
    }
    // Keep the capture until compensation succeeds or refusal is committed.
    // Draining it before validation loses the only ledger input on refusal.
    const positionIds = [...bucket.positionIds];
    const effects = [...bucket.effects.values()].map(cloneTurnEffect);
    const baselineValues = new Map(bucket.baselineValues);
    const collectionOrders = [...bucket.collectionOrders.values()];
    return {
      captured: true,
      positionIds,
      effects,
      baselineValues,
      orderDeltas: collectionOrders.map((order) =>
        deriveCollectionOrderDelta(
          order.owner,
          order.beforeSubjects,
          order.afterSubjects,
          order.beforeFrontier,
          order.afterFrontier
        )
      ),
    };
  };

  const toCausalEffect = (effect: TurnEffect): CausalEffect => {
    switch (effect.kind) {
      case 'set':
        return {
          owner: effect.position as CausalPositionId,
          before: effect.before,
          after: effect.after,
          subjectId: effect.subject,
          fieldSegments: effect.fieldSegments,
          plainBranchMembership: effect.plainBranchMembership,
          fieldPresence: effect.fieldPresence,
          path: effect.path,
          ownerPath: effect.ownerPath,
        };
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
    return {
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
    };
  };

  const rollbackPendingTarget = (
    effects: TurnEffect[],
    orderDeltas: CollectionOrderDelta[]
  ): void => {
    // Field reversals follow their row's re-add. In capture order they reached
    // a removed row first and update-then-remove refused ("Value effect has no
    // active subject") whenever this declarative path was taken.
    const reversalEffects = placeFieldReversalsWhileRowsExist(
      effects.map(toRollbackEffect)
    );
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
      const binding = bindings.get(owner);
      if (!binding) {
        throw new Error(
          `Transaction rollback has no collection binding ${owner}`
        );
      }
      return binding.readSource();
    });
    const target = deriveDeclarativeTransitionTarget({
      collections,
      effects: reversalEffects,
      orderDeltas,
      orderEndpoint: 'before',
    });
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
                      'Transaction scalar published before installation'
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
          preparePlainBranchMembers(tree.$ as object, members),
      }
    );
    const apply = () => prepared.install();
    // Membership listeners run once every target is installed and published.
    const releaseMembership = holdEntityMembershipDelivery(tree.$ as object);
    try {
      applyInInvalidationGroup(tree.$ as object, apply);
    } finally {
      releaseMembership();
    }
  };

  const rollbackPendingEffectsThroughRealizationPort = (
    transactionId: number,
    effects: TurnEffect[],
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
    owningTransactionId: number = transactionId
  ): void => {
    if (effects.length === 0 && orderDeltas.length === 0) {
      return;
    }

    if (
      orderDeltas.length > 0 ||
      requiresDeclarativeStructuralTarget(effects.map(toRollbackEffect))
    ) {
      withWriteContext(
        {
          origin: 'transaction-rollback',
          transactionId: owningTransactionId,
          ownerId: getPositionRegistry(tree.$)?.id,
        },
        () => rollbackPendingTarget(effects, orderDeltas)
      );
      return;
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
    const result = withWriteContext(
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
      () =>
        rollbackPendingTurnAt({
          authority: authorityPosition,
          turnId: transactionId,
          store,
          topology: positionRegistry,
          port: realizationPort,
          realizationContext,
        })
    );
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
  };

  try {
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
              // ...and never a COMPENSATION. Removing a contribution is the
              // opposite of depending on it, so admitting a rollback's own
              // realized writes here had the ledger assert a dependency that
              // does not exist — and one rollback then made every EARLIER
              // transaction permanently unreversible.
              //
              // This already bit. It needed two open transactions, because the
              // rolled-back turn was retired before its compensation ran, so
              // with only one open the count check below skipped this path by
              // accident. With two, `compensation-provenance.spec.ts` pinned
              // the resulting refusal as "CURRENT BEHAVIOUR ... not as
              // desired". That test now asserts the correct restore instead.
              //
              // Restoration's recorder was taught to read this same `origin`
              // for this same reason — see that spec's header. The ledger was
              // the second consumer and had not been. Same shape as the
              // `origin === 'restoration'` decline above.
              if (origin === 'transaction-rollback') {
                return;
              }
              // Skipped entirely when nothing is pending, so a tree with no open
              // transaction pays nothing for this.
              if (authority.getPendingTurnCount() > 0) {
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
                authority.observeLaterEffects(
                  drainCaptureBucket(probe).effects
                );
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
  } catch {
    // fall through without capture support
  }

  const runtime: InternalTransactionRuntime = {
    transaction(fn: () => void): PendingTransaction {
      const activeMeta = getActiveWriteContext();
      const notifier = getPathNotifier();
      const captureRuntime = getMutationCaptureRuntime(tree);
      if (typeof activeMeta?.transactionId === 'number') {
        throw new Error('Nested transaction is not supported');
      }

      flushDeferredTreeWrites(tree.$ as object);
      notifier?.flushSync();
      const transactionId = nextTransactionId++;
      const captureBucket = createCaptureBucket();
      pendingTransactions.set(transactionId, captureBucket);
      const transactionState: TransactionState = {
        transactionId,
        status: 'pending',
        phase: 'opened',
        consequencesReleased: false,
      };
      activeTransactions.set(transactionId, transactionState);
      const settleScope = (outcome: 'commit' | 'discard'): void => {
        // settleCommitScope removes the scope before invoking consequences.
        transactionState.consequencesReleased = true;
        settleCommitScope(transactionOwnerToken, transactionId, outcome);
      };

      // TURN-FEED-0. Announced BEFORE the callback runs, because an observer has
      // to know the transaction is open in order to treat the writes inside it
      // as speculative. Announcing after would be announcing too late.
      const lifecycleChannel = getTransactionLifecycleChannel(tree as object);
      lifecycleChannel.announce({
        kind: 'opened',
        owner: transactionOwnerToken,
        id: transactionId,
      });

      publishLifecycle({ kind: 'opened', transactionId });

      // opened listeners can queue ordinary predecessors as well as complete
      // transactions. Drain their writes before assigning this callback order.
      flushDeferredTreeWrites(tree.$ as object);
      notifier?.flushSync();

      // Persistence is post-commit: open the deferral scope BEFORE the callback
      // runs, so speculative writes inside it queue instead of reaching storage.
      openCommitScope(transactionOwnerToken, transactionId, tree as object);

      // opened listeners may author a complete predecessor transaction. No
      // contribution of this callback exists yet. Reserve after those listeners
      // return, but before the callback and any observer of its first write.
      const reservedTurnId = authority.reservePending(captureBucket);
      const descriptorOwnersBefore = new Set(realizationDescriptors.keys());
      const releaseCapture = captureRuntime?.activateCapture();
      const releaseEntityCapture = observeOpenEntityCapture(
        transactionId,
        captureBucket
      );
      // Flags, not `error !== undefined`: a callback may `throw undefined`.
      let primaryFailed = false;
      let primaryError: unknown;
      // A refused rollback of a failed callback is thrown out of the group and
      // must keep precedence over the callback's own error, as before.
      let abortRefused = false;
      let postCallbackFailed = false;
      let postCallbackError: unknown;

      // Reverse this open transaction's writes and terminate it. Shared by a
      // throwing callback and by a failure after the callback returned; only
      // the former is reported to a refusal as the callback's error.
      const abortOpenTransaction = (
        cause: unknown,
        callbackFailed: boolean
      ): void => {
        // Starts false and becomes true only once compensation has actually
        // applied. "Nothing to reverse" is a rollback that succeeded trivially,
        // NOT a refusal -- but only while the capture is still here to say
        // there was nothing. A refusal, or a failure before compensation
        // (flush, drain), means the authored effects are still live.
        let compensated = false;
        let committedInstead = false;
        let abortReason: TransactionRefusalReason = 'effect-validation-failed';
        let rollbackSubjectIds: number[] = [];
        let rollbackPositionIds: number[] = [];
        try {
          notifier?.flushSync();
          const bucket = pendingTransactions.get(transactionId);
          if (bucket && writtenSinceBy(bucket)) {
            // Refused, as a rollback that cannot be proven safe always is:
            // nothing is reversed and the writes stay as the tree shows them.
            // They are recorded as committed, so the ledger (an earlier
            // transaction's rollback) and restoration see what the tree holds.
            const effects = [...bucket.effects.values()];
            throw createRollbackError({
              kind: 'effect-validation-failed',
              pendingTurnId: transactionId,
              compensation: effects,
              errorMessage:
                'Transaction rollback refused: a location it wrote was written again before the transaction returned',
              callbackError: callbackFailed ? cause : undefined,
            });
          }
          const {
            captured,
            positionIds,
            effects,
            baselineValues,
            orderDeltas,
          } = prepareTransactionRollbackInput(transactionId);
          rollbackPositionIds = positionIds;
          rollbackSubjectIds = effects
            .map((effect) => effect.subject)
            .filter(
              (subjectId): subjectId is number => subjectId !== undefined
            );
          if (effects.length > 0 || orderDeltas.length > 0) {
            rollbackPendingEffectsThroughRealizationPort(
              transactionId,
              effects,
              baselineValues,
              orderDeltas,
              callbackFailed ? cause : undefined
            );
          }
          compensated = captured;
        } catch (error) {
          abortReason = refusalReason(error);
          throw error;
        } finally {
          // v15 containment: no recovery handle is returned by this path.
          // If compensation refused, the surviving writes become committed.
          // Preserve ledger input until that outcome is known, including when
          // refusal came from realization rather than the later-write guard.
          const surviving = pendingTransactions.get(transactionId);
          try {
            if (!compensated && surviving) {
              recordConfirmedBucket(surviving, reservedTurnId);
              committedInstead = true;
            }
          } finally {
            pendingTransactions.delete(transactionId);
            authority.discardPending(reservedTurnId);
            transactionState.status = compensated ? 'rejected' : 'confirmed';
            activeTransactions.delete(transactionId);
            releaseWindowIfClosed();
            // Recorded at retirement, before restoration hears the outcome,
            // and delivered after consequences as before. settleScope() below
            // always runs and releases consequences first, so the refusal is
            // true by the time any listener receives it.
            const releaseAbortDelivery = publishLifecycle.hold();
            if (!compensated) {
              publishLifecycle({
                kind: 'refused',
                transactionId,
                reason: abortReason,
                pendingRetained: false,
                consequencesReleased: true,
              });
            }
            publishLifecycle({
              kind: compensated ? 'rolled-back' : 'confirmed',
              transactionId,
            });
            try {
              // Restoration must observe the same terminal outcome BEFORE
              // committed consequences inspect history or perform another write.
              if (committedInstead) {
                lifecycleChannel.announce({
                  kind: 'staged',
                  owner: transactionOwnerToken,
                  id: transactionId,
                });
                lifecycleChannel.announce({
                  kind: 'confirmed',
                  owner: transactionOwnerToken,
                  id: transactionId,
                });
              } else {
                lifecycleChannel.announce({
                  kind: 'rolled-back',
                  owner: transactionOwnerToken,
                  id: transactionId,
                });
              }
            } finally {
              // Close the scope even on refusal. v15 has no recovery handle
              // on this path, so leaving it open would hold Link indefinitely.
              try {
                settleScope(compensated ? 'discard' : 'commit');
              } catch (error) {
                // The refusal/callback error remains primary. Consequences
                // have already been attempted and the scope is closed.
                reportCleanupFailure(
                  'consequences after automatic transaction abort',
                  error
                );
              } finally {
                releaseAbortDelivery();
                if (compensated) {
                  forgetUnclaimedDescriptorSubjects(
                    rollbackSubjectIds,
                    descriptorOwnersBefore,
                    rollbackPositionIds
                  );
                }
              }
            }
          }
        }
      };

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
          try {
            abortOpenTransaction(error, true);
          } catch (refusal) {
            abortRefused = true;
            throw refusal;
          }
        }
      };

      try {
        const locationRuntime = getLocationRuntime(tree.$);
        if (locationRuntime) {
          locationRuntime.runInvalidationGroup(executeTransaction);
        } else {
          executeTransaction();
        }
      } catch (error) {
        // The invalidation group settles its publishers AFTER the callback
        // returns, so a subscribed derived whose compute throws lands here.
        // It used to escape before any handling below, leaving the writes
        // applied with no handle and the commit scope open. A failed callback
        // has already been rolled back and keeps precedence, unless that
        // rollback was refused: then the group rethrows the refusal, unchanged.
        if (abortRefused) {
          throw error;
        }
        if (primaryFailed) {
          reportCleanupFailure(
            'transaction invalidation group after failure',
            error
          );
        } else {
          postCallbackFailed = true;
          postCallbackError = error;
        }
      } finally {
        try {
          try {
            releaseEntityCapture?.();
          } finally {
            releaseCapture?.();
          }
        } catch (error) {
          if (primaryFailed || postCallbackFailed) {
            reportCleanupFailure(
              primaryFailed
                ? 'transaction capture release after failure'
                : 'transaction capture release after a post-callback failure',
              error
            );
          } else {
            postCallbackFailed = true;
            postCallbackError = error;
          }
        }
      }

      if (primaryFailed) {
        throw primaryError;
      }

      // TX-OBSERVER-STRAND-0. The callback returned, so its writes are applied.
      // From here `transaction()` returns a handle, or attempts compensation
      // and throws. Refusal commits surviving writes; the scope settles.
      // A throw here used to
      // leave them applied with no handle, strand the capture bucket, and hold
      // every later Link consequence behind a scope nothing could settle.
      // Observers can no longer throw here (the notifier and the lifecycle
      // listeners isolate them); this covers what is left: the invalidation
      // group's epilogue, a failing capture release, and the steps below.
      //
      // Two limits, both inherent to 15.x. If the rollback is REFUSED, the
      // refusal is thrown and the writes stay (15.x has no recovery handle).
      // If materialize itself fails after taking the capture, nothing is left
      // to reverse, and the scope commits so consequences match the live tree.
      let pendingTurn: TransactionTurnRecord | undefined;
      let releaseStagedDelivery: (() => void) | undefined;
      try {
        try {
          if (postCallbackFailed) {
            throw postCallbackError;
          }

          // The staged transition is recorded before the engine announcement:
          // restoration stages its pending entry inside that announcement, and a
          // reader it notifies must see this phase under its own sequence. Public
          // delivery stays held until after materialization, as before, so no
          // tooling callback runs between the callback and restoration staging.
          transactionState.phase = 'staged';
          releaseStagedDelivery = publishLifecycle.hold();
          publishLifecycle({ kind: 'staged', transactionId });

          // TURN-FEED-0 'staged': the callback has returned, so this transaction's
          // contribution is complete and awaits a decision.
          lifecycleChannel.announce({
            kind: 'staged',
            owner: transactionOwnerToken,
            id: transactionId,
          });

          notifier?.flushSync();
          pendingTurn = materializePendingTransaction(
            transactionId,
            reservedTurnId
          );
        } catch (failure) {
          // The rollback runs inside an invalidation group, like the callback's
          // own, so compensation reaches location-runtime consumers when the
          // group closes. A consumer that throws there is a delivery failure
          // after the rollback applied, not a rollback that failed.
          let rolledBack = false;
          const rollBack = (): void => {
            abortOpenTransaction(failure, false);
            rolledBack = true;
          };
          try {
            const locationRuntime = getLocationRuntime(tree.$);
            if (locationRuntime) {
              locationRuntime.runInvalidationGroup(rollBack);
            } else {
              rollBack();
            }
          } catch (error) {
            if (!rolledBack) {
              // Refused. The refusal is thrown; without this the failure that
              // made the rollback necessary would leave no trace at all.
              reportCleanupFailure(
                'a post-callback step whose rollback was then refused',
                failure
              );
              throw error;
            }
            reportCleanupFailure(
              'rollback delivery after a post-callback failure',
              error
            );
          }
          throw failure;
        }
      } finally {
        // On failure the automatic rollback's own transitions queue behind
        // 'staged' and are delivered together, after compensation.
        releaseStagedDelivery?.();
      }
      const pendingTurnId = pendingTurn?.id;
      if (pendingTurn) {
        notifyListeners(pendingCreatedListeners, pendingTurn);
      }

      return {
        confirm(): void {
          if (transactionState.status === 'confirmed') {
            return;
          }
          if (transactionState.status === 'rejected') {
            throw new Error('Cannot confirm a rolled back transaction');
          }
          // A subscriber of the compensation writes runs while the turn is
          // still pending. Confirming there committed a transaction whose
          // writes were being reversed: restoration kept the entry and a later
          // redo re-applied it.
          if (transactionState.compensating) {
            throw new Error(
              'Cannot confirm a transaction while its rollback is being applied'
            );
          }
          transactionState.status = 'confirmed';
          // Settle, then announce. Restoration confirms its entry inside the
          // announcement and publishes history there, so the settlement
          // authority and the reader must already say confirmed. Staged capture
          // already claimed the subjects, and releasing the transaction claim
          // does not drive reclamation, so confirming first strands nothing.
          const releaseConfirmedDelivery = publishLifecycle.hold();
          try {
            let confirmedTurn: TransactionTurnRecord | undefined;
            try {
              if (pendingTurnId !== undefined) {
                confirmedTurn = authority.confirmPending(pendingTurnId);
              }
            } finally {
              activeTransactions.delete(transactionId);
              publishLifecycle({ kind: 'confirmed', transactionId });
              lifecycleChannel.announce({
                kind: 'confirmed',
                owner: transactionOwnerToken,
                id: transactionId,
              });
            }
            if (confirmedTurn) {
              notifyListeners(pendingConfirmedListeners, confirmedTurn);
            }
          } finally {
            if (pendingTurnId !== undefined) {
              pendingOrderDeltas.delete(pendingTurnId);
            }
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
              settleScope('commit');
            } finally {
              // Public delivery keeps its position after consequences.
              releaseConfirmedDelivery();
              forgetUnclaimedDescriptorSubjects(
                pendingTurn?.restorationSubjectIds ?? [],
                descriptorOwnersBefore,
                pendingTurn?.__positionIds ?? []
              );
            }
          }
        },
        rollback(): void {
          if (transactionState.status === 'rejected') {
            return;
          }
          if (transactionState.status === 'confirmed') {
            throw new Error('Cannot rollback a confirmed transaction');
          }
          if (transactionState.compensating) {
            throw new Error(
              'Cannot roll back a transaction while its rollback is being applied'
            );
          }

          // ══ H1/H3 — DECIDE, THEN SETTLE. ═════════════════════════════════
          //
          // This method used to retire first and compensate second: it set
          // `lifecycle = 'rejected'`, announced 'rolled-back', called
          // `discardPending`, and only THEN attempted the reversal. When the
          // attempt refused, the throw left a transaction that had already
          // surrendered its settlement authority while every write it authored
          // was still live in the tree. Measured on 15.2.1, R6 scenario:
          //
          //     outcome  effect-validation-failed   (correctly refused)
          //     pending  1 -> 0                     (turn retired anyway)
          //     state    unchanged                  (nothing was reversed)
          //     retry    'ok'                       (reversing nothing)
          //
          // `confirmedCount` also fell by one, because discarding raised
          // min(pendingIds) and discharged the L15 obligation — a FAILED
          // rollback destroyed retained evidence it was still responsible for.
          //
          // Everything below the PHASE 2 banner is now reached only once the
          // compensation has actually applied. A refusal changes nothing the
          // reader can observe, which is what makes the retry in H3 mean
          // something and what lets an overlapping refusal in H4 leave both
          // transactions intact.
          // ═════════════════════════════════════════════════════════════════

          const rollbackPlan =
            pendingTurnId !== undefined
              ? authority.getPendingRollbackPlan(pendingTurnId)
              : { compensation: [] };
          if ('conflict' in rollbackPlan) {
            // The SECOND refusal door. 1f94f74a wrapped only the
            // effect-validation refusal thrown from compensation; this
            // PLAN-level refusal escaped before any settle, leaking the scope
            // and killing persistence() for the life of the tree. It is not an
            // edge case — it is the shipped, tested "application refetch
            // fallback" pattern, which catches this error, compensates by hand
            // and never confirms.
            //
            // Settled as 'commit', not 'discard': nothing was compensated, so
            // every write this transaction authored is still live in the tree
            // and IS the committed truth a reader sees. Discarding would drop
            // durable consequences for state the tree is still showing, which
            // is the tree/storage divergence this whole boundary exists to
            // prevent. Same argument confirm() already uses for the equivalent
            // situation.
            //
            // The scope settles; the TURN does not. Those were conflated.
            // `settleCommitScope` is idempotent, so a later confirm() or a
            // retried rollback() on this still-pending turn is safe.
            try {
              settleScope('commit');
            } finally {
              publishLifecycle({
                kind: 'refused',
                transactionId,
                reason: rollbackPlan.conflict.kind,
                pendingRetained: activeTransactions.has(transactionId),
                consequencesReleased: true,
              });
            }
            throw createRollbackError(rollbackPlan.conflict);
          }

          const compensation = rollbackPlan.compensation;
          const orderDeltas =
            pendingTurnId === undefined
              ? []
              : pendingOrderDeltas.get(pendingTurnId) ?? [];

          // ── PHASE 1 — attempt, with the turn STILL PENDING. ───────────────
          // A consumer that throws after compensation was installed is a
          // delivery failure, not a refusal: the reversal happened, so the turn
          // retires below and the consumer's error is rethrown afterwards.
          let deliveryFailure: { error: unknown } | undefined;
          if (compensation.length > 0 || orderDeltas.length > 0) {
            // Read, do not retire. `peekPending` exists for exactly this.
            const pendingRecord =
              pendingTurnId === undefined
                ? undefined
                : authority.peekPending(pendingTurnId);
            try {
              transactionState.compensating = true;
              try {
                rollbackPendingEffectsThroughRealizationPort(
                  pendingTurnId as number,
                  [...compensation].reverse(),
                  pendingRecord?.__baselineValues ?? new Map(),
                  orderDeltas,
                  undefined,
                  transactionId
                );
              } finally {
                transactionState.compensating = false;
              }
            } catch (error) {
              if (wasAppliedBeforeFailure(error)) {
                deliveryFailure = { error };
              } else {
                // Refused. Same scope argument as the plan-level door above: the
                // authored writes are still live, so durable consequences commit
                // — and the turn stays pending, so the caller can retry or
                // confirm.
                try {
                  settleScope('commit');
                } finally {
                  publishLifecycle({
                    kind: 'refused',
                    transactionId,
                    reason: refusalReason(error),
                    pendingRetained: activeTransactions.has(transactionId),
                    consequencesReleased: true,
                  });
                }
                // ⚠️ DO NOT RE-WRAP AN ALREADY-RENDERED ROLLBACK REFUSAL. A
                // refusal thrown deeper is a SignalTreeRollbackError whose
                // message already names its kind; stuffing that message into
                // `errorMessage` and wrapping again produced a DOUBLED
                // sentence — prefix, reason, prefix, reason, and two `[kind]`
                // tags. The constant message hid this for as long as it existed:
                // both layers rendered identically, so the duplication was
                // invisible until the reason became legible.
                //
                // Rethrowing preserves the INNERMOST, most specific refusal,
                // which is the whole point of making the reason legible. Same
                // error type, same refusal, same cause chain.
                if (error instanceof SignalTreeRollbackError) throw error;
                throw createRollbackError({
                  kind: 'effect-validation-failed',
                  pendingTurnId: pendingTurnId as number,
                  compensation,
                  errorMessage:
                    error instanceof Error
                      ? error.message
                      : 'Unknown rollback validation failure',
                  cause: error,
                });
              }
            }
          }

          // ── PHASE 2 — the reversal APPLIED. Now the turn may be retired. ──
          transactionState.status = 'rejected';
          // Retire, then announce, as confirm() does: restoration discards its
          // staged entry inside the announcement, and what it publishes there
          // must not see this transaction still pending.
          const releaseRolledBackDelivery = publishLifecycle.hold();
          let discardedTurn: TransactionTurnRecord | undefined;
          try {
            try {
              if (pendingTurnId !== undefined) {
                discardedTurn = authority.discardPending(pendingTurnId);
                pendingOrderDeltas.delete(pendingTurnId);
              }
            } finally {
              activeTransactions.delete(transactionId);
              publishLifecycle({ kind: 'rolled-back', transactionId });
              lifecycleChannel.announce({
                kind: 'rolled-back',
                owner: transactionOwnerToken,
                id: transactionId,
              });
            }
            // 'discard', unconditionally: reaching here means the baseline was
            // restored, so the speculative consequences describe state the tree
            // no longer shows. The old `compensated ? 'discard' : 'commit'`
            // ternary lived in a `finally` that also ran on the refusal path;
            // that path now returns above, so the condition it selected on can
            // no longer be false here.
            settleScope('discard');
          } finally {
            releaseRolledBackDelivery();
            forgetUnclaimedDescriptorSubjects(
              discardedTurn?.restorationSubjectIds ?? [],
              descriptorOwnersBefore,
              discardedTurn?.__positionIds ?? []
            );
          }

          if (discardedTurn) {
            notifyListeners(pendingDiscardedListeners, discardedTurn);
          }
          if (deliveryFailure) throw applicationFailureCause(deliveryFailure.error);
        },
      };
    },
    getConfirmedTurnRecords: () => authority.getConfirmedTurnRecords(),
    setHistoryRetention: (retain: number) =>
      authority.setHistoryRetention(retain),
    getConfirmedRetention: () => authority.getConfirmedRetention(),
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

  const reportCleanupFailure = (step: string, error: unknown): void => {
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
  };

  if (typeof tree.registerCleanup === 'function') {
    tree.registerCleanup(() => {
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
      activeTransactions.clear();
    });
  }

  (tree as unknown as Record<PropertyKey, unknown>)[
    INTERNAL_TRANSACTION_RUNTIME
  ] = runtime;

  // TURN-FEED-0.2. The runtime OWNS the lifecycle channel, so it installs one on
  // the tree's canonical host here rather than letting the first `announce()`
  // conjure it wherever that call happens to be standing.
  installTransactionLifecycleChannel(tree as object);

  return runtime;
}

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

    (tree as ISignalTree<T> & TransactionMethods).transaction =
      runtime.transaction;

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
