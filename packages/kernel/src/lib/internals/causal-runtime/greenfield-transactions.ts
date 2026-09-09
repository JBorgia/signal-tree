import type { StructuralEffect } from '../../types';

import type { AppliedTurnProjection } from './applied-turn-projection';
import type { CausalTurn, PositionId, ReversalResult, TurnId } from './causal-types';
import { confirmPendingTurnAt } from './pending-confirmation';
import type { RollbackPendingResult } from './pending-rollback';
import type { TurnStore } from './turn-store';

export interface ExplicitTransactionEffect {
  readonly owner: PositionId;
  readonly before: unknown;
  readonly after: unknown;
  readonly subjectId?: unknown;
  readonly structural?: 'add' | 'remove' | 'rekey';
  readonly structuralContext?: StructuralEffect;
}

export type GreenfieldTransactionLifecycle =
  | 'open'
  | 'sealed'
  | 'confirmed'
  | 'aborted';

export interface GreenfieldTransactionDraft {
  capture(effect: ExplicitTransactionEffect): void;
  seal(): CausalTurn;
  confirm(): ReversalResult<{ readonly kind: 'turn-evicted' }>;
  abort(): RollbackPendingResult;
  getLifecycle(): GreenfieldTransactionLifecycle;
}

export interface CreateGreenfieldTransactionDraftOptions {
  readonly turnId: TurnId;
  readonly store: Pick<TurnStore, 'admitPending'> & Pick<
    TurnStore,
    'prepareConfirmPendingTurn' | 'commitPreparedConfirmPending'
  >;
  readonly appliedTurns: Pick<
    AppliedTurnProjection,
    'prepareAdmitConfirmedTurn' | 'commitPreparedAdmitConfirmed'
  >;
  readonly abortPendingTurn?: (turnId: TurnId) => RollbackPendingResult;
}

type DraftState = GreenfieldTransactionLifecycle;

class DefaultGreenfieldTransactionDraft implements GreenfieldTransactionDraft {
  private state: DraftState = 'open';
  private readonly capturedEffects: ExplicitTransactionEffect[] = [];
  private sealedTurn?: CausalTurn;

  constructor(private readonly options: CreateGreenfieldTransactionDraftOptions) {}

  capture(effect: ExplicitTransactionEffect): void {
    this.assertState('open');
    this.capturedEffects.push({
      owner: effect.owner,
      before: effect.before,
      after: effect.after,
      subjectId: effect.subjectId,
      structural: effect.structural,
      structuralContext: effect.structuralContext,
    });
  }

  seal(): CausalTurn {
    this.assertState('open');

    const effects = normalizeDraftEffects(this.capturedEffects);

    this.sealedTurn = this.options.store.admitPending({
      id: this.options.turnId,
      // DEAD-CHAIN BOUNDARY — see normalizeDraftEffects' doc. These effects
      // carry no address, so they are not complete CausalEffects.
      effects: effects as unknown as CausalTurn['effects'],
    });
    this.state = 'sealed';
    return this.sealedTurn;
  }

  confirm(): ReversalResult<{ readonly kind: 'turn-evicted' }> {
    this.assertState('sealed');

    const result = confirmPendingTurnAt({
      turnId: this.options.turnId,
      store: this.options.store,
      appliedTurns: this.options.appliedTurns,
    });
    if (result.ok) {
      this.state = 'confirmed';
      this.sealedTurn = undefined;
    }

    return result;
  }

  abort(): RollbackPendingResult {
    this.assertState('sealed');

    if (!this.options.abortPendingTurn) {
      throw new Error('Greenfield transaction abort is not configured');
    }

    const result = this.options.abortPendingTurn(this.options.turnId);
    if (result.ok) {
      this.state = 'aborted';
      this.sealedTurn = undefined;
    }

    return result;
  }

  getLifecycle(): GreenfieldTransactionLifecycle {
    return this.state;
  }

  private assertState(expected: DraftState): void {
    if (this.state !== expected) {
      throw new Error(
        `Greenfield transaction draft must be ${expected} before this operation`
      );
    }
  }
}

export function createGreenfieldTransactionDraft(
  options: CreateGreenfieldTransactionDraftOptions
): GreenfieldTransactionDraft {
  return new DefaultGreenfieldTransactionDraft(options);
}

/**
 * ⚠️ DEAD CHAIN. This module and `transaction-capture-bridge.ts` have NO
 * non-spec importer; the live transaction path is
 * `enhancers/transactions/transactions.ts`. Scheduled for deletion or revival
 * as its own change — see the Studio §23 "dead causal-runtime chains" item.
 *
 * `CausalEffect.path`/`ownerPath` became REQUIRED on 2026-09-09 because every
 * LIVE producer sets them. This chain's `ExplicitTransactionEffect` carries no
 * address, so it cannot produce a complete `CausalEffect` — which is the type
 * correctly reporting that this path never did. Its internals are therefore
 * typed as the address-less effect they actually are, and the single
 * `admitPending` boundary carries one explicit cast rather than fabricating
 * empty addresses into the data (which would let this chain's specs pass on
 * invented values).
 */
function normalizeDraftEffects(
  effects: readonly ExplicitTransactionEffect[]
): readonly ExplicitTransactionEffect[] {
  const normalizedEffects: ExplicitTransactionEffect[] = [];
  const scalarIndexByOwner = new Map<PositionId, number>();

  for (const effect of effects) {
    if (shouldPreserveAuthoredEffect(effect)) {
      normalizedEffects.push(copyEffect(effect));
      continue;
    }

    const existingIndex = scalarIndexByOwner.get(effect.owner);
    if (existingIndex === undefined) {
      scalarIndexByOwner.set(effect.owner, normalizedEffects.length);
      normalizedEffects.push(copyEffect(effect));
      continue;
    }

    const existingEffect = normalizedEffects[existingIndex];
    normalizedEffects[existingIndex] = {
      owner: existingEffect.owner,
      before: existingEffect.before,
      after: effect.after,
    };
  }

  return normalizedEffects.filter((effect) => !Object.is(effect.before, effect.after));
}

function shouldPreserveAuthoredEffect(effect: ExplicitTransactionEffect): boolean {
  return (
    effect.subjectId !== undefined ||
    effect.structural !== undefined ||
    effect.structuralContext !== undefined
  );
}

function copyEffect(
  effect: ExplicitTransactionEffect
): ExplicitTransactionEffect {
  return {
    owner: effect.owner,
    before: effect.before,
    after: effect.after,
    subjectId: effect.subjectId,
    structural: effect.structural,
    structuralContext: effect.structuralContext,
  };
}
