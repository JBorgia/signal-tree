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
import { getLocationRuntime } from '../../lib/internals/location-runtime';

type TurnEffectBase = {
  position: number;
  ownerPath: string;
  path: string;
};

export type ScalarSetEffect = TurnEffectBase & {
  kind: 'set';
  subject?: number;
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
  transaction(fn: () => void): PendingTransaction;
  /** @internal Raw retained records; projected by `/internals`. */
  getConfirmedTurnRecords(): readonly TransactionTurnRecord[];
  /** @internal PROPOSAL-INSPECTION-0 raw material; unclassified. */
  describePendingTurn(
    turnId: number
  ):
    | { effects: readonly TurnEffect[]; laterEffects: readonly TurnEffect[] }
    | undefined;
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
  return `${ROLLBACK_ERROR_MESSAGE} [${
    (unhandled as { kind: string }).kind
  }]`;
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
    `${effect.position}\u0000${effect.path}\u0000${effect.subject ?? ''}`;
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
      if (laterEffect.path === effect.path) {
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
      if (
        laterEffect.path.startsWith(`${effect.path}.`) ||
        effect.path.startsWith(`${laterEffect.path}.`)
      ) {
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
        unsettled: boolean;
        conflictingTurnId?: number;
        conflictingEffect?: TurnEffect;
      } => {
    if (effect.kind === 'add' || effect.kind === 'rekey') {
      let erased = false;
      let erasedByOpenTransaction = false;
      for (const laterEntry of laterEffects) {
        const laterEffect = laterEntry.effect;
        if (laterEffect.ownerPath !== effect.ownerPath) {
          continue;
        }
        if (laterEffect.subject !== effect.subject) {
          continue;
        }
        erased = laterEffect.kind === 'remove';
        erasedByOpenTransaction = erased && laterEntry.unsettled === true;
      }
      // AN OPEN TRANSACTION CANNOT ERASE, only conflict — the same rule the
      // scalar path applies through `supersededScalarKeys`, stated here because
      // this is the STRUCTURAL path's own supersession and it had no equivalent.
      //
      // "Superseded" means this turn's contribution is already invisible, so
      // reversing it needs no compensation. A remove belonging to a STILL-OPEN
      // transaction has not established that: roll that transaction back and
      // the subject returns, at which point this add was skipped for a reason
      // that no longer holds. Falling through to the dependency test instead
      // yields a `later-pending-dependency` refusal, which is recoverable.
      if (erased && !erasedByOpenTransaction) {
        return { kind: 'superseded' };
      }
    }

    const dependency = hasSameSubjectDependency(effect);
    return dependency
      ? {
          kind: 'conflict',
          unsettled: dependency.unsettled,
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
        const overlap = classifyStructuralOverlap(effect);
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
    // The obligation set just changed; release what it no longer covers.
    this.releaseConfirmedBeyondObligation();
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
    if (this.confirmedTurns.length === 0) return;
    let minPending = Infinity;
    for (const id of this.pendingTurns.keys()) {
      if (id < minPending) minPending = id;
    }
    const required = (turn: TransactionTurnRecord) => turn.id > minPending;
    const before = this.confirmedTurns.length;
    if (this.historyRetain <= 0) {
      this.confirmedTurns = this.confirmedTurns.filter(required);
    } else {
      const keep = new Set<number>();
      for (const turn of this.confirmedTurns)
        if (required(turn)) keep.add(turn.id);
      for (const turn of this.confirmedTurns.slice(-this.historyRetain))
        keep.add(turn.id);
      this.confirmedTurns = this.confirmedTurns.filter((t) => keep.has(t.id));
    }
    if (this.confirmedTurns.length < before) this.evictedConfirmed = true;
  }

  confirmPending(turnId: number): TransactionTurnRecord | undefined {
    const turn = this.pendingTurns.get(turnId);
    if (!turn) {
      return undefined;
    }
    this.pendingTurns.delete(turnId);
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
    this.pendingOpenedAtSeq.delete(turnId);
    this.releasePendingClaims(turnId);
    this.releaseLedgerIfQuiet();
    // Discarding can raise min(pendingIds) and discharge the obligation.
    this.releaseConfirmedBeyondObligation();
    return cloneTurnRecord(turn);
  }

  hasConfirmedTurnAfter(turnId: number): boolean {
    return this.confirmedTurns.some((turn) => turn.id > turnId);
  }

  /**
   * PROPOSAL-INSPECTION-0. Raw material only: the pending turn's own effects
   * and the later effects admitted against it, with NO classification.
   *
   * Exposed because the classifier is not proven yet and must not be invented
   * in production first. A rollback plan answers "what can I safely
   * compensate?"; a review answers "which parts of what I proposed are still
   * represented in current truth?". Those questions overlap but are not the
   * same — a later UPDATE of a proposed row makes the rollback REFUSE while
   * leaving the proposal's structural contribution entirely current — so the
   * plan cannot be reused as the answer. This returns the inputs both
   * questions share and commits to neither.
   *
   * Reading only. No retained fact is added: both collections already exist
   * for the rollback path's own use.
   *
   * @internal
   */
  describePendingTurn(
    turnId: number
  ):
    | { effects: readonly TurnEffect[]; laterEffects: readonly TurnEffect[] }
    | undefined {
    const turn = this.pendingTurns.get(turnId);
    if (!turn) {
      return undefined;
    }
    const authoredLater = this.confirmedTurns
      .filter((t) => t.id > turnId)
      .flatMap((t) => t.__effects ?? []);
    const openedAt = this.pendingOpenedAtSeq.get(turnId) ?? 0;
    const observedLater = this.dependencyLedger
      .filter((entry) => entry.seq > openedAt)
      .map((entry) => entry.effect);
    return {
      effects: (turn.__effects ?? []).map(cloneTurnEffect),
      laterEffects: [...authoredLater, ...observedLater].map(cloneTurnEffect),
    };
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
        return `${effect.kind}\u0000${effect.path}\u0000${
          effect.position
        }\u0000${effect.subject ?? ''}`;
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

  const drainTransactionRollbackInput = (
    transactionId: number
  ): {
    effects: TurnEffect[];
    baselineValues: Map<number, unknown>;
    orderDeltas: CollectionOrderDelta[];
  } => {
    const bucket = pendingTransactions.get(transactionId);
    pendingTransactions.delete(transactionId);
    if (!bucket) {
      return { effects: [], baselineValues: new Map(), orderDeltas: [] };
    }
    const { effects, baselineValues, collectionOrders } =
      drainCaptureBucket(bucket);
    return {
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

    if (
      orderDeltas.length > 0 ||
      requiresDeclarativeStructuralTarget(effects.map(toRollbackEffect))
    ) {
      rollbackPendingTarget(effects, orderDeltas);
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
      let cleanupError: unknown;

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
          primaryError = error;
          notifier?.flushSync();
          const { effects, baselineValues, orderDeltas } =
            drainTransactionRollbackInput(transactionId);
          const rollbackSubjectIds = effects
            .map((effect) => effect.subject)
            .filter(
              (subjectId): subjectId is number => subjectId !== undefined
            );
          // Starts true: "nothing to reverse" is a rollback that succeeded
          // trivially, NOT a refusal. Only the port throwing means nothing was
          // compensated.
          let compensated = true;
          try {
            if (effects.length > 0 || orderDeltas.length > 0) {
              try {
                rollbackPendingEffectsThroughRealizationPort(
                  transactionId,
                  effects,
                  baselineValues,
                  orderDeltas,
                  error
                );
              } catch (refusal) {
                compensated = false;
                throw refusal;
              }
            }
          } finally {
            try {
              // Settle AFTER compensation, but UNCONDITIONALLY. Late, so consumers
              // released by this scope observe the RESTORED state rather than the
              // doomed one. In a `finally`, because compensation is fallible — it
              // throws SignalTreeRollbackError on a conservative refusal, which is
              // a supported fail-closed contract, not an edge case. Skipping the
              // settle there left the scope open forever, and since nothing can
              // ever settle it afterwards, autoSave was wedged for the life of the
              // tree: post-commit silently degraded to never-commit.
              //
              // The OUTCOME depends on whether compensation actually applied, which
              // a bare `finally` cannot see. Refused (or nothing to reverse) means
              // the authored effects are still the live authoritative state, so
              // their consequences must FLUSH; discarding them would make durable
              // truth disagree with live truth to honour a reversal that did not
              // happen. This is the same rule the plan-level door already applies.
              settleCommitScope(
                transactionOwnerToken,
                transactionId,
                compensated ? 'discard' : 'commit'
              );
              forgetUnclaimedDescriptorSubjects(
                rollbackSubjectIds,
                descriptorOwnersBefore
              );
            } finally {
              lifecycleChannel.announce({
                kind: 'rolled-back',
                owner: transactionOwnerToken,
                id: transactionId,
              });
            }
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
      } finally {
        try {
          releaseCapture?.();
        } catch (error) {
          if (primaryError !== undefined) {
            reportCleanupFailure(
              'transaction capture release after failure',
              error
            );
          } else {
            cleanupError = error;
          }
        }
      }

      if (primaryError !== undefined) {
        throw primaryError;
      }
      if (cleanupError !== undefined) {
        throw cleanupError;
      }

      // TURN-FEED-0 'staged': the callback has returned, so this transaction's
      // contribution is complete and awaits a decision.
      lifecycleChannel.announce({
        kind: 'staged',
        owner: transactionOwnerToken,
        id: transactionId,
      });

      notifier?.flushSync();
      const pendingTurn = materializePendingTransaction(transactionId);
      const pendingTurnId = pendingTurn?.id;
      if (pendingTurn) {
        notifyListeners(pendingCreatedListeners, pendingTurn);
      }
      let lifecycle: 'pending' | 'confirmed' | 'rejected' = 'pending';

      const handle = {
        [PENDING_TURN_ID]: pendingTurnId,
        confirm(): void {
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
              if (confirmedTurn) {
                notifyListeners(pendingConfirmedListeners, confirmedTurn);
              }
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
            settleCommitScope(transactionOwnerToken, transactionId, 'commit');
            forgetUnclaimedDescriptorSubjects(
              pendingTurn?.restorationSubjectIds ?? [],
              descriptorOwnersBefore
            );
          }
        },
        rollback(): void {
          if (lifecycle === 'rejected') {
            return;
          }
          if (lifecycle === 'confirmed') {
            throw new Error('Cannot rollback a confirmed transaction');
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
            settleCommitScope(transactionOwnerToken, transactionId, 'commit');
            throw createRollbackError(rollbackPlan.conflict);
          }

          const compensation = rollbackPlan.compensation;
          const orderDeltas =
            pendingTurnId === undefined
              ? []
              : pendingOrderDeltas.get(pendingTurnId) ?? [];

          // ── PHASE 1 — attempt, with the turn STILL PENDING. ───────────────
          if (compensation.length > 0 || orderDeltas.length > 0) {
            // Read, do not retire. `peekPending` exists for exactly this.
            const pendingRecord =
              pendingTurnId === undefined
                ? undefined
                : authority.peekPending(pendingTurnId);
            try {
              rollbackPendingEffectsThroughRealizationPort(
                pendingTurnId as number,
                [...compensation].reverse(),
                pendingRecord?.__baselineValues ?? new Map(),
                orderDeltas,
                undefined,
                transactionId
              );
            } catch (error) {
              // Refused. Same scope argument as the plan-level door above: the
              // authored writes are still live, so durable consequences commit
              // — and the turn stays pending, so the caller can retry or
              // confirm.
              settleCommitScope(transactionOwnerToken, transactionId, 'commit');
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

          // ── PHASE 2 — the reversal APPLIED. Now the turn may be retired. ──
          lifecycle = 'rejected';
          lifecycleChannel.announce({
            kind: 'rolled-back',
            owner: transactionOwnerToken,
            id: transactionId,
          });
          let discardedTurn: TransactionTurnRecord | undefined;
          if (pendingTurnId !== undefined) {
            discardedTurn = authority.discardPending(pendingTurnId);
            pendingOrderDeltas.delete(pendingTurnId);
          }
          try {
            // 'discard', unconditionally: reaching here means the baseline was
            // restored, so the speculative consequences describe state the tree
            // no longer shows. The old `compensated ? 'discard' : 'commit'`
            // ternary lived in a `finally` that also ran on the refusal path;
            // that path now returns above, so the condition it selected on can
            // no longer be false here.
            settleCommitScope(transactionOwnerToken, transactionId, 'discard');
          } finally {
            forgetUnclaimedDescriptorSubjects(
              discardedTurn?.restorationSubjectIds ?? [],
              descriptorOwnersBefore
            );
          }

          if (discardedTurn) {
            notifyListeners(pendingDiscardedListeners, discardedTurn);
          }
        },
      };
      // Cast, not a widened public type: PENDING_TURN_ID is module-private
      // and PendingTransaction must not grow a field for it.
      return handle as PendingTransaction;
    },
    getConfirmedTurnRecords: () => authority.getConfirmedTurnRecords(),
    describePendingTurn: (turnId: number) =>
      authority.describePendingTurn(turnId),
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
    console.error(
      `SignalTree: transactions() cleanup failed during ${step}.`,
      error
    );
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
        later.kind === 'set' &&
        later.position === effect.position &&
        later.path === effect.path &&
        (later.subject === undefined ||
          effect.subject === undefined ||
          later.subject === effect.subject)
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
