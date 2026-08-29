import type { AppliedTurnProjection } from './applied-turn-projection';
import type { CausalTurn, ReversalResult, TurnId } from './causal-types';
import type { RealizationContextSource } from './realization-context';
import type { TurnStore } from './turn-store';

// Hints are conservative invalidations at a quiescent boundary, not eligibility
// decisions. Fresh maintenance may still discover the subject remains blocked.
export interface PendingConfirmationMaintenanceHint {
  readonly forgottenConfirmedTurnIds: readonly TurnId[];
  readonly invalidatedRedoTurnIds: readonly TurnId[];
  readonly settledPendingSubjectReference: boolean;
}

export interface ConfirmPendingTurnAtOptions {
  readonly turnId: TurnId;
  readonly store: Pick<
    TurnStore,
    'prepareConfirmPendingTurn' | 'commitPreparedConfirmPending'
  >;
  readonly appliedTurns: Pick<
    AppliedTurnProjection,
    'prepareAdmitConfirmedTurn' | 'commitPreparedAdmitConfirmed'
  >;
  readonly retentionObserver?: Pick<RealizationContextSource, 'consumeForgottenConfirmedTurns'>;
  readonly onMaintenanceMayBeUseful?: (
    hint: PendingConfirmationMaintenanceHint
  ) => void;
  readonly reportMaintenanceObserverError?: (
    error: unknown,
    hint: PendingConfirmationMaintenanceHint
  ) => void;
}

export function confirmPendingTurnAt(
  options: ConfirmPendingTurnAtOptions
): ReversalResult<{ readonly kind: 'turn-evicted' }> {
  const prepared = options.store.prepareConfirmPendingTurn(options.turnId);
  if (!prepared.ok) {
    return {
      ok: false,
      refusal: { kind: 'turn-evicted' },
    };
  }

  const preparedAppliedTurnProjection = options.appliedTurns.prepareAdmitConfirmedTurn({
    turnId: prepared.transition.turnId,
    participants: prepared.transition.pendingTurn.participants,
  });

  const invalidatedRedoTurnIds = options.appliedTurns.commitPreparedAdmitConfirmed(
    preparedAppliedTurnProjection
  );

  const confirmedTurn = options.store.commitPreparedConfirmPending(
    prepared.transition
  );

  const forgottenTurns = options.retentionObserver?.consumeForgottenConfirmedTurns() ?? [];
  const maintenanceHint = deriveMaintenanceHint(
    prepared.transition.pendingTurn,
    forgottenTurns,
    invalidatedRedoTurnIds
  );
  if (maintenanceHint && options.onMaintenanceMayBeUseful) {
    try {
      options.onMaintenanceMayBeUseful(maintenanceHint);
    } catch (error) {
      if (options.reportMaintenanceObserverError) {
        options.reportMaintenanceObserverError(error, maintenanceHint);
      } else {
        queueMicrotask(() => {
          throw normalizeError(error);
        });
      }
    }
  }

  return {
    ok: true,
    turnId: confirmedTurn.id,
  };
}

function deriveMaintenanceHint(
  pendingTurn: CausalTurn,
  forgottenTurns: readonly { readonly id: TurnId }[],
  invalidatedRedoTurnIds: readonly TurnId[]
): PendingConfirmationMaintenanceHint | undefined {
  const settledPendingSubjectReference = pendingTurn.effects.some(
    (effect) => effect.subjectId !== undefined
  );

  if (
    forgottenTurns.length === 0 &&
    invalidatedRedoTurnIds.length === 0 &&
    !settledPendingSubjectReference
  ) {
    return undefined;
  }

  return {
    forgottenConfirmedTurnIds: forgottenTurns.map(({ id }) => id),
    invalidatedRedoTurnIds: [...invalidatedRedoTurnIds],
    settledPendingSubjectReference,
  };
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
