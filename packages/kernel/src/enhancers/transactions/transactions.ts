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
  PendingTransaction,
  Proposal,
  ProposalAcceptance,
  ProposalInspection,
  ProposalStatus,
  TransactionMethods,
} from './transactions.types';

import {
  getWriteParticipation,
  isInspectionWrite,
} from '../../lib/write-participation';
import { ENHANCER_META, SignalTreeRollbackError } from '../../lib/types';
import {
  cancelCommitScopes,
  openCommitScope,
  settleCommitScope,
} from '../../lib/internals/commit-consequence';
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
import { rollbackPendingTurnAt } from '../../lib/internals/causal-runtime/pending-rollback';
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
import { getPathNotifier } from '../../lib/path-notifier';
import { isTraversableNode } from '../../lib/utils';
import {
  getActiveWriteContext,
  withWriteContext,
} from '../../lib/write-context';
import { visitTree } from '../../lib/internals/visit-tree';
import { getTreeScalarSlotRuntime } from '../../lib/internals/tree-scalar-slot-port';
import { getPhysicalCommitClock } from '../../lib/internals/physical-commit-clock';
import { getLocationRuntime } from '../../lib/internals/location-runtime';

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
  ownerPaths: Set<string>;
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
  /** @internal Count-only retention probe; no state or writer identities escape. */
  getInspectionFootprintCountsForTesting(): {
    writers: number;
    footprints: number;
  };
  transaction(fn: () => void): PendingTransaction;
  /** @internal Raw retained records; projected by `/internals`. */
  getConfirmedTurnRecords(): readonly TransactionTurnRecord[];
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
 * PROPOSAL-0. Carries the pending turn id from `transaction()` to `proposal()`
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
      effect.subjectFieldSegments ?? effect.path,
    ]);
  const supersededScalarKeys = new Set(
    laterEffects
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
        conflictingTurnId?: number;
        conflictingEffect?: TurnEffect;
      } => {
    let superseded = false;
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
          if (supersededScalarKeys.has(makeScalarKey(effect))) {
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
  private pendingTurns = new Map<number, TransactionTurnRecord>();
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
    baselineValues?: ReadonlyMap<number, unknown>
  ): TransactionTurnRecord | undefined {
    if (
      (subjectIds?.length ?? 0) === 0 &&
      (positionIds?.length ?? 0) === 0 &&
      (effects?.length ?? 0) === 0
    ) {
      return undefined;
    }

    return {
      id: this.nextTurnId++,
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
    return cloneTurnRecord(turn);
  }

  createPending(
    subjectIds?: number[],
    positionIds?: number[],
    effects?: TurnEffect[],
    baselineValues?: ReadonlyMap<number, unknown>
  ): TransactionTurnRecord | undefined {
    const turn = this.buildTurn(
      subjectIds,
      positionIds,
      effects,
      baselineValues
    );
    if (!turn) {
      return undefined;
    }
    this.pendingTurns.set(turn.id, turn);
    this.pendingOpenedAtSeq.set(turn.id, this.ledgerSeq);
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

  confirmPending(turnId: number): TransactionTurnRecord | undefined {
    const turn = this.pendingTurns.get(turnId);
    if (!turn) {
      return undefined;
    }
    this.pendingTurns.delete(turnId);
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
    return cloneTurnRecord(turn);
  }

  discardPending(turnId: number): TransactionTurnRecord | undefined {
    const turn = this.pendingTurns.get(turnId);
    if (!turn) {
      return undefined;
    }
    this.pendingTurns.delete(turnId);
    this.pendingOpenedAtSeq.delete(turnId);
    this.queuedEvidence.delete(turnId);
    this.releasePendingClaims(turnId);
    this.releaseLedgerIfQuiet();
    return cloneTurnRecord(turn);
  }

  hasConfirmedTurnAfter(turnId: number): boolean {
    return this.confirmedTurns.some((turn) => turn.id > turnId);
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
    queued: readonly TurnEffect[] = []
  ): PendingRollbackPlan {
    this.observeQueuedEffects(turnId, queued);
    const pending = this.pendingTurns.get(turnId);
    const retained = this.queuedEvidence.get(turnId);
    // A later pending replacement is not settled authority. Reversing its
    // baseline would make its own later rollback resurrect rejected state.
    for (const later of this.pendingTurns.values()) {
      if (later.id <= turnId) continue;
      for (const effect of pending?.__effects ?? []) {
        const overlap = later.__effects?.find(
          (candidate) =>
            candidate.position === effect.position &&
            (candidate.subject === undefined ||
              effect.subject === undefined ||
              candidate.subject === effect.subject) &&
            (candidate.kind === 'set' && effect.kind === 'set'
              ? scalarRelation(candidate, effect) !== 'disjoint'
              : candidate.path === effect.path ||
                candidate.path.startsWith(`${effect.path}.`) ||
                effect.path.startsWith(`${candidate.path}.`))
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
      .map((entry) => ({ turnId, effect: entry.effect }));

    return buildPendingRollbackPlan(this.pendingTurns.get(turnId), [
      ...authoredLater,
      ...observedLater,
      ...[...(retained?.values() ?? [])].map((effect) => ({ turnId, effect })),
    ]);
  }

  releaseConfirmedTurnsOnDestroy(): void {
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
    ownerPaths: new Set<string>(),
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
export function peekInternalTransactionRuntime<T>(
  tree: ISignalTree<T>
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
  const pendingCapture = createCaptureBucket();
  const pendingTransactions = new Map<number, CaptureBucket>();
  // External writes can arrive while the callback is still collecting, before
  // it has a turn id. Keep that evidence under the transaction id until admission.
  const callbackExternalEffects = new Map<number, TurnEffect[]>();
  // Inspection owns local mutation chronology, not conservative rollback evidence.
  // Keep only the latest footprint per location/writer while a proposal is open.
  type InspectionWrite = { seq: number; effect: TurnEffect };
  let inspectionSeq = 0;
  let inspectionUnavailable = false;
  const inspectionWrites = new Map<
    number | undefined,
    Map<string, InspectionWrite>
  >();
  const inspectionTransactionByTurn = new Map<number, number>();
  const releaseInspectionIfQuiet = (): void => {
    if (authority.getPendingTurnCount() || pendingTransactions.size) return;
    inspectionWrites.clear();
    inspectionTransactionByTurn.clear();
    inspectionSeq = 0;
    inspectionUnavailable = false;
  };
  const pendingOrderDeltas = new Map<number, CollectionOrderDelta[]>();
  const pendingCreatedListeners = new Set<TransactionLifecycleListener>();
  const pendingConfirmedListeners = new Set<TransactionLifecycleListener>();
  const pendingDiscardedListeners = new Set<TransactionLifecycleListener>();
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
      tree: tree as unknown as ISignalTree<object>,
      descriptors: realizationDescriptors,
    });
  defineTreeRealizationPort(treeWrapper, realizationPort);
  defineTreeRealizationPort(stateRoot, realizationPort);

  const forgetUnclaimedDescriptorSubjects = (
    subjectIds: readonly number[],
    descriptorOwnersBefore: ReadonlySet<number>
  ): void => {
    const claims = getSubjectRestorationClaims(tree);
    const unclaimed = [...new Set(subjectIds)].filter(
      (subjectId) => !claims?.isClaimed(subjectId)
    );
    forgetSubjectsInTreeRealizationDescriptors(
      realizationDescriptors,
      unclaimed
    );
    for (const [owner, descriptor] of realizationDescriptors) {
      if (descriptorOwnersBefore.has(owner)) {
        continue;
      }
      if (
        (descriptor.subjectDescriptors?.size ?? 0) === 0 &&
        (descriptor.structuralEffects?.size ?? 0) === 0 &&
        (descriptor.structuralEffectBySubject?.size ?? 0) === 0
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
      listener(payload);
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
    const subjectIds = Array.from(bucket.subjectIds).sort((a, b) => a - b);
    bucket.subjectIds.clear();
    const positionIds = Array.from(bucket.positionIds).sort((a, b) => a - b);
    bucket.positionIds.clear();
    const baselineValues = new Map(bucket.baselineValues);
    bucket.baselineValues.clear();
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

  const enqueueEffect = (
    bucket: CaptureBucket,
    effectMap: PendingEffectMap,
    effect: TurnEffect
  ): void => {
    const key = effectKey(effect);
    const existing = effectMap.get(key);
    if (existing) {
      if (existing.kind === 'set' && effect.kind === 'set') {
        existing.after = effect.after;
        existing.mutationIntent = combineScalarMutationIntent(
          existing.mutationIntent,
          effect.mutationIntent
        );
        if (existing.before === existing.after) {
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
    rememberBaselineValue(bucket, effect);
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

    if (isPlainRecord(next) && isPlainRecord(prev)) {
      const position = positionIds?.[0];
      const subject = subjectIds?.[0];
      if (position === undefined) {
        return;
      }
      const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
      for (const key of keys) {
        const before = prev[key];
        const after = next[key];
        if (before === after) {
          continue;
        }
        enqueueEffect(bucket, effectMap, {
          kind: 'set',
          path: `${path}.${key}`,
          ownerPath: ownerPath ?? path,
          position,
          subject,
          subjectFieldSegments: subject === undefined ? undefined : [key],
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
        'SignalTree: proposal inspection unavailable because mutation chronology capture failed.'
      );
    const turn = authority.getPendingTurn(turnId);
    if (!turn) return undefined;
    const effects = turn.__effects ?? [];
    const transactionId = inspectionTransactionByTurn.get(turnId);
    const own = inspectionWrites.get(transactionId);
    const later = new Set<InspectionWrite>();
    for (const effect of effects) {
      const authored = own?.get(effectKey(effect));
      if (!authored) {
        inspectionUnavailable = true;
        throw new Error(
          'SignalTree: proposal inspection unavailable because an authored contribution has no mutation chronology.'
        );
      }
      for (const [writer, writes] of inspectionWrites) {
        if (writer === transactionId) continue;
        for (const candidate of writes.values()) {
          if (candidate.seq <= authored.seq) continue;
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
    rememberTreeRealizationDescriptor({
      descriptors: realizationDescriptors,
      path,
      ownerPath,
      positionIds: resolvedPositionIds,
      subjectIds,
      meta,
      registry: getPositionRegistry(tree.$),
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
    bucket: CaptureBucket
  ): TransactionTurnRecord | undefined => {
    const { subjectIds, positionIds, effects } = drainCaptureBucket(bucket);
    return authority.recordConfirmed(
      subjectIds.length > 0 ? subjectIds : undefined,
      positionIds.length > 0 ? positionIds : undefined,
      effects.length > 0 ? effects : undefined
    );
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
      bucket.ownerPaths.add(capture.ownerPath);
      bucket.positionIds.add(capture.owner);
    }) ?? null;

  const materializePendingTransaction = (
    transactionId: number
  ): TransactionTurnRecord | undefined => {
    const bucket = pendingTransactions.get(transactionId);
    pendingTransactions.delete(transactionId);
    if (!bucket) {
      return undefined;
    }
    const {
      subjectIds,
      positionIds,
      effects,
      baselineValues,
      collectionOrders,
    } = drainCaptureBucket(bucket);
    const pending = authority.createPending(
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
            order.afterFrontier
          )
        )
      );
    }
    return pending;
  };

  const toCausalEffect = (effect: TurnEffect): CausalEffect => {
    switch (effect.kind) {
      case 'set':
        return {
          owner: effect.position as CausalPositionId,
          before: effect.before,
          after: effect.after,
          subjectId: effect.subject,
          subjectFieldSegments: effect.subjectFieldSegments,
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
    const reversalEffects = effects.map(toRollbackEffect);
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
      scalarBinding
    );
    const apply = () => prepared.install();
    const locations = getLocationRuntime(tree.$);
    if (locations) {
      locations.runInvalidationGroup(apply);
    } else {
      apply();
    }
  };

  const applyRollbackCompensation = (
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
      () => {
        if (
          orderDeltas.length > 0 ||
          requiresDeclarativeStructuralTarget(
            effects.map(toRollbackEffect),
            (owner) => {
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
            }
          )
        ) {
          rollbackPendingTarget(effects, orderDeltas);
          return { ok: true as const };
        }
        return rollbackPendingTurnAt({
          authority: authorityPosition,
          turnId: transactionId,
          store,
          topology: positionRegistry,
          port: realizationPort,
          realizationContext,
        });
      }
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
    owningTransactionId: number = transactionId
  ): void => {
    applyRollbackCompensation(
      transactionId,
      effects,
      baselineValues,
      orderDeltas,
      callbackError,
      owningTransactionId
    );
    markOwnerInvalidatedFrom(tree.$ as object);
  };

  try {
    const notifier = getPathNotifier();
    if (notifier) {
      const treeOwnerId = getPositionRegistry(tree.$)?.id;
      if (treeOwnerId !== undefined) {
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
            captureEffects(
              probe,
              probe.effects,
              entry.path,
              entry.newValue,
              entry.oldValue,
              meta,
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
              writes.set(effectKey(effect), { seq, effect: footprint });
            }
          } catch (error) {
            // The write already happened; never report a confident status after
            // losing its chronology. The notifier isolates and reports the error.
            inspectionUnavailable = true;
            throw error;
          }
        });
      }

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

  const readQueuedLaterEffects = (): TurnEffect[] => {
    const ownerId = getPositionRegistry(tree.$)?.id;
    return (getPathNotifier()?.readPending() ?? []).flatMap<TurnEffect>(
      (entry) => {
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
      }
    );
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
      const descriptorOwnersBefore = new Set(realizationDescriptors.keys());
      pendingTransactions.set(transactionId, createCaptureBucket());

      // TURN-FEED-0. Announced BEFORE the callback runs, because an observer has
      // to know the transaction is open in order to treat the writes inside it
      // as speculative. Announcing after would be announcing too late.
      const lifecycleChannel = getTransactionLifecycleChannel(tree as object);
      lifecycleChannel.announce({
        kind: 'opened',
        owner: transactionOwnerToken,
        id: transactionId,
      });

      // Persistence is post-commit: open the deferral scope BEFORE the callback
      // runs, so speculative writes inside it queue instead of reaching storage.
      openCommitScope(transactionOwnerToken, transactionId, tree as object);

      const releaseCapture = captureRuntime?.activateCapture();
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
        if (!primaryFailed) {
          primaryFailed = true;
          primaryError = error;
        }
      } finally {
        try {
          releaseCapture?.();
        } catch (error) {
          if (primaryFailed)
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

      // Read before staging/flush: delivery intentionally drops net-equal ABA
      // notifications, but compensation may not erase that writer's authority.
      const callbackQueuedEvidence = readQueuedLaterEffects();
      for (const id of authority.getPendingTurnIds()) {
        authority.observeQueuedEffects(id, callbackQueuedEvidence);
      }
      if (callbackQueuedEvidence.length) {
        callbackExternalEffects.set(transactionId, [
          ...(callbackExternalEffects.get(transactionId) ?? []),
          ...callbackQueuedEvidence,
        ]);
      }

      // TURN-FEED-0 'staged': the callback has returned, so this transaction's
      // contribution is complete and awaits a decision.
      if (!primaryFailed)
        lifecycleChannel.announce({
          kind: 'staged',
          owner: transactionOwnerToken,
          id: transactionId,
        });

      notifier?.flushSync();
      const pendingTurn = materializePendingTransaction(transactionId);
      const pendingTurnId = pendingTurn?.id;
      if (pendingTurn) {
        inspectionTransactionByTurn.set(pendingTurn.id, transactionId);
        const keys = new Set((pendingTurn.__effects ?? []).map(effectKey));
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
            settleCommitScope(transactionOwnerToken, transactionId, 'commit');
            forgetUnclaimedDescriptorSubjects(
              pendingTurn?.restorationSubjectIds ?? [],
              descriptorOwnersBefore
            );
          }
        },
        rollback(): void {
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
                  readQueuedLaterEffects()
                );
          if ('conflict' in plan) throw createRollbackError(plan.conflict);
          const compensation = plan.compensation;
          const orderDeltas =
            pendingTurnId === undefined
              ? []
              : pendingOrderDeltas.get(pendingTurnId) ?? [];
          let installed = false;
          let observerFailed = false;
          let observerError: unknown;
          const clock =
            getPhysicalCommitClock(tree.$) ?? getPhysicalCommitClock(tree);
          const revision = clock?.revision();
          settling = true;
          try {
            const apply = () => {
              rollbackPendingEffectsThroughRealizationPort(
                pendingTurnId ?? transactionId,
                [...compensation].reverse(),
                pendingTurn?.__baselineValues ?? new Map(),
                orderDeltas,
                primaryFailed ? primaryError : undefined,
                transactionId
              );
              installed = true;
            };
            try {
              const locations = getLocationRuntime(tree.$);
              if (locations) locations.runInvalidationGroup(apply);
              else apply();
            } catch (error) {
              // Physical commit precedes observer delivery. A delivery failure
              // must not leave a successfully compensated turn retryable.
              installed ||=
                revision !== undefined && clock?.revision() !== revision;
              if (!installed) {
                if (error instanceof SignalTreeRollbackError) throw error;
                throw createRollbackError({
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
              }
              observerFailed = true;
              observerError = error;
            }
            lifecycle = 'rejected';
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
                  descriptorOwnersBefore
                );
              }
            }
            if (observerFailed) throw observerError;
          } finally {
            settling = false;
          }
        },
      };
      if (primaryFailed) {
        try {
          handle.rollback();
        } catch (rollbackError) {
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
          if (
            lifecycle === 'pending' &&
            typeof rollbackError === 'object' &&
            rollbackError !== null
          ) {
            Object.defineProperty(rollbackError, 'recovery', {
              value: {
                transaction: handle as PendingTransaction,
                // Explicit: the callback may have thrown `undefined`.
                callbackFailed: true,
                callbackError: primaryError,
              },
              enumerable: false,
              configurable: true,
              writable: true,
            });
          }
          throw rollbackError;
        }
        throw primaryError;
      }
      if (cleanupFailed) throw cleanupError;
      // The pending-turn symbol remains private to the Proposal facade.
      return handle as PendingTransaction;
    },
    getConfirmedTurnRecords: () => authority.getConfirmedTurnRecords(),
    describePendingTurn: inspectPendingTurn,
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

  const reportCleanupFailure = (step: string, error: unknown): void => {
    console.error(
      `SignalTree: transactions() cleanup failed during ${step}.`,
      error
    );
  };

  if (typeof tree.registerCleanup === 'function') {
    tree.registerCleanup(() => {
      destroyed = true;
      authority.releaseConfirmedTurnsOnDestroy();
      cancelCommitScopes(transactionOwnerToken);
      for (const id of authority.getPendingTurnIds()) {
        const discarded = authority.discardPending(id);
        forgetUnclaimedDescriptorSubjects(
          discarded?.restorationSubjectIds ?? [],
          new Set()
        );
      }
      pendingTransactions.clear();
      callbackExternalEffects.clear();
      inspectionWrites.clear();
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
 * proposed row makes the rollback REFUSE while leaving the proposal's
 * structural contribution entirely current, and a refused plan has no
 * compensation list to reason from at all.
 *
 * Subject identity decides the structural cases. Path coincidence must not:
 * a reused business key belongs to a different record.
 */
function classifyProposedEffect(
  effect: TurnEffect,
  laterEffects: readonly TurnEffect[]
): ProposalStatus {
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

export function transactions(): Enhancer<TransactionMethods> {
  const enhancerFn = <T>(
    tree: ISignalTree<T>
  ): ISignalTree<T> & TransactionMethods => {
    const runtime = getOrCreateInternalTransactionRuntime(tree);

    // `transact`, not `transaction`: a verb beside `propose()` and the
    // handle's own `confirm()`/`rollback()`. The old spelling was REMOVED
    // outright in the 2026-09-22 breaking API reset rather than bridged — see
    // docs/research/api-breaking-reset-0.md.
    const host = tree as ISignalTree<T> & TransactionMethods;
    host.transact = runtime.transaction;

    // PROPOSAL-0. Naming and a review projection over the SAME turn — no
    // second code path, no proposal-only rule. `pending` here is exactly what
    // `transaction()` hands any other caller.
    host.propose = (fn: () => void): Proposal => {
      const pending = runtime.transaction(fn);
      const turnId = (pending as unknown as Record<PropertyKey, unknown>)[
        PENDING_TURN_ID
      ] as number | undefined;

      let settled: ProposalInspection | undefined;

      const read = (): ProposalInspection => {
        if (turnId === undefined) {
          return { changes: [] };
        }
        const raw = runtime.describePendingTurn(turnId);
        if (!raw) {
          return { changes: [] };
        }
        return {
          changes: raw.effects.map((effect) => ({
            path: effect.path,
            status: classifyProposedEffect(effect, raw.laterEffects),
          })),
        };
      };

      return {
        inspect(): ProposalInspection {
          // After settlement the turn is no longer pending, so the inspection
          // as of that settlement is what there is to report.
          return settled ?? read();
        },
        accept(): ProposalAcceptance {
          // Snapshot BEFORE confirming: this is the race inspect() alone
          // cannot close, and after confirm the pending turn is gone.
          const atSettlement = settled ?? read();
          pending.confirm();
          settled = atSettlement;
          return atSettlement;
        },
        reject(): void {
          const atSettlement = settled ?? read();
          // Throws on a conservative refusal. Deliberately not caught: the
          // caller must see a reversal that could not be applied.
          pending.rollback();
          settled = atSettlement;
        },
      };
    };

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
