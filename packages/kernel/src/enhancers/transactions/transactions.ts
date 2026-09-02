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
import type { PendingTransaction, TransactionMethods } from './transactions.types';

import { getWriteParticipation, isInspectionWrite } from '../../lib/write-participation';
import {
  ENHANCER_META,
  SignalTreeRollbackError,
} from '../../lib/types';
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
import { getActiveWriteContext, withWriteContext } from '../../lib/write-context';
import { visitTree } from '../../lib/internals/visit-tree';
import { getTreeScalarSlotRuntime } from '../../lib/internals/tree-scalar-slot-port';
import { getTreeRealization } from '../../lib/internals/tree-realization';

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
  transaction(fn: () => void): PendingTransaction;
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
export const explainRollbackFailure = (
  cause: RollbackFailureCause
): string => {
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
      if (laterEffect.path === effect.path) {
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
        laterEffect.path.startsWith(`${effect.path}.`) ||
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
        const dependency = hasSameSubjectDependency(effect);
        if (dependency) {
          return {
            conflict: {
              kind: 'later-confirmed-dependency',
              pendingTurnId: pendingTurn.id,
              pendingEffect: effect,
              conflictingTurnId: dependency.conflictingTurnId,
              conflictingEffect: dependency.conflictingEffect,
            },
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
    this.releasePendingClaims(turnId);
    this.releaseLedgerIfQuiet();
    return cloneTurnRecord(turn);
  }

  hasConfirmedTurnAfter(turnId: number): boolean {
    return this.confirmedTurns.some((turn) => turn.id > turnId);
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

    return buildPendingRollbackPlan(this.pendingTurns.get(turnId), [
      ...authoredLater,
      ...observedLater,
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
    restorationSubjectIds: turn.restorationSubjectIds ? [...turn.restorationSubjectIds] : undefined,
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

export function getOrCreateInternalTransactionRuntime<T>(
  tree: ISignalTree<T>
): InternalTransactionRuntime {
  const existing = (
    tree as unknown as Record<PropertyKey, unknown>
  )[INTERNAL_TRANSACTION_RUNTIME] as InternalTransactionRuntime | undefined;
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
        return `${effect.kind}\u0000${effect.path}\u0000${effect.position}\u0000${effect.subject ?? ''}`;
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
      ? buildTurnEffectFromStructural(meta, ownerPath, path, positionIds, subjectIds)
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

  const recordConfirmedBucket = (bucket: CaptureBucket): TransactionTurnRecord | undefined => {
    const { subjectIds, positionIds, effects } =
      drainCaptureBucket(bucket);
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

  const resolveTransactionId = (
    meta?: { transactionId?: unknown; transactionOwner?: unknown }
  ): number | undefined =>
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
        } as CausalEffect;
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
        } as CausalEffect;
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
        } as CausalEffect;
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
        } as CausalEffect;
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
        node as { __prepareTransitionTarget?: CollectionTransitionTargetBinding }
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
        throw new Error(`Transaction rollback has no collection binding ${owner}`);
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
                  throw new Error(`Transaction rollback has no scalar slot ${owner}`);
                }
                frame.set(slot, value);
              }
              let result: ReturnType<typeof frame.commit> | undefined;
              return {
                install(): void {
                  result = frame.commit({ advanceRevision: false, publish: false });
                },
                publish(): void {
                  if (!result) {
                    throw new Error('Transaction scalar published before installation');
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
    const scalarRealization = getTreeRealization(tree.$)?.scalarLeaf;
    if (scalarRealization) {
      scalarRealization.runInvalidationGroup(apply);
    } else {
      apply();
    }
  };

  const rollbackPendingEffectsThroughRealizationPort = (
    transactionId: number,
    effects: TurnEffect[],
    baselineValues: ReadonlyMap<number, unknown>,
    orderDeltas: CollectionOrderDelta[] = [],
    callbackError?: unknown
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
        errorMessage: 'Transaction rollback requires tree realization infrastructure',
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
        transactionId,
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
          (next, prev, path, ownerPath, origin, subjectIds, positionIds, meta) => {
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
                authority.observeLaterEffects(drainCaptureBucket(probe).effects);
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
            effectiveMeta
          ,
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
          .filter((subjectId): subjectId is number => subjectId !== undefined);
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
      } finally {
        try {
          releaseCapture?.();
        } catch (error) {
          if (primaryError !== undefined) {
            reportCleanupFailure('transaction capture release after failure', error);
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

      return {
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
            settleCommitScope(transactionOwnerToken, transactionId, 'commit');
            throw createRollbackError(rollbackPlan.conflict);
          }

          lifecycle = 'rejected';
          lifecycleChannel.announce({
            kind: 'rolled-back',
            owner: transactionOwnerToken,
            id: transactionId,
          });
          let discardedTurn: TransactionTurnRecord | undefined;
          if (pendingTurnId !== undefined) {
            discardedTurn = authority.discardPending(pendingTurnId);
          }

          const compensation = rollbackPlan.compensation;
          const orderDeltas =
            pendingTurnId === undefined
              ? []
              : pendingOrderDeltas.get(pendingTurnId) ?? [];
          if (pendingTurnId !== undefined) {
            pendingOrderDeltas.delete(pendingTurnId);
          }
          // Starts true: "nothing to reverse" is a rollback that succeeded
          // trivially, NOT a refusal.
          let compensated = true;
          try {
            if (compensation.length > 0 || orderDeltas.length > 0) {
              try {
                rollbackPendingEffectsThroughRealizationPort(
                  pendingTurnId as number,
                  [...compensation].reverse(),
                  discardedTurn?.__baselineValues ?? new Map(),
                  orderDeltas
                );
              } catch (error) {
                compensated = false;
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
          } finally {
            // Late so consumers observe restored state, unconditional so a
            // refused compensation cannot strand the scope. `lifecycle` is
            // already 'rejected' at this point, so no later confirm() or
            // rollback() could ever settle it — skipping here wedged autoSave
            // permanently.
            //
            // Outcome tracks whether compensation APPLIED. A refusal reverses
            // nothing, so the authored effects remain live truth and flush; a
            // successful compensation restored the baseline, so they are
            // discarded. See the thrown-callback path for the full note.
            settleCommitScope(
              transactionOwnerToken,
              transactionId,
              compensated ? 'discard' : 'commit'
            );
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
    },
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

  (tree as unknown as Record<PropertyKey, unknown>)[INTERNAL_TRANSACTION_RUNTIME] =
    runtime;

  // TURN-FEED-0.2. The runtime OWNS the lifecycle channel, so it installs one on
  // the tree's canonical host here rather than letting the first `announce()`
  // conjure it wherever that call happens to be standing.
  installTransactionLifecycleChannel(tree as object);

  return runtime;
}

export function transactions(): Enhancer<TransactionMethods> {
  const enhancerFn = <T>(
    tree: ISignalTree<T>
  ): ISignalTree<T> & TransactionMethods => {
    const runtime = getOrCreateInternalTransactionRuntime(tree);

    (tree as ISignalTree<T> & TransactionMethods).transaction = runtime.transaction;

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
