import type { ConfirmedReversalPlan, ReversalResult, TurnId } from './causal-types';
import type { CausalEffect } from './causal-types';
import type { RealizationContext } from './realization-context';
import type { TurnStore } from './turn-store';

export type ConfirmedReversalPlanningResult =
  | { readonly ok: true; readonly plan: ConfirmedReversalPlan }
  | {
      readonly ok: false;
      readonly refusal: Extract<Extract<ReversalResult, { readonly ok: false }>['refusal'], { kind: 'turn-evicted' }>;
    };

export interface PlanConfirmedReversalOptions {
  readonly turnId: TurnId;
  readonly store: Pick<TurnStore, 'getTurn'>;
  readonly realizationContext?: RealizationContext;
}

export function planConfirmedReversal(
  options: PlanConfirmedReversalOptions
): ConfirmedReversalPlanningResult {
  const turn = options.store.getTurn(options.turnId);
  if (!turn) {
    return { ok: false, refusal: { kind: 'turn-evicted' } };
  }

  return {
    ok: true,
    plan: {
      turnId: turn.id,
      effects: createReversalEffects(turn, options.realizationContext),
    },
  };
}

function createReversalEffects(
  turn: NonNullable<ReturnType<Pick<TurnStore, 'getTurn'>['getTurn']>>,
  realizationContext?: RealizationContext
): ConfirmedReversalPlan['effects'] {
  if (!realizationContext) {
    return [...turn.effects]
      .reverse()
      .map((effect) => ({
        owner: effect.owner,
        before: effect.after,
        after: effect.before,
        subjectId: effect.subjectId,
        path: (effect as CausalEffect & { path?: string }).path,
        ownerPath: (effect as CausalEffect & { ownerPath?: string }).ownerPath,
        structural: deriveUndoStructural(effect.structural),
        structuralContext: effect.structuralContext,
      }));
  }

  const firstEffectIndexByOwner = new Map<number, number>();
  turn.effects.forEach((effect, index) => {
    if (!firstEffectIndexByOwner.has(effect.owner)) {
      firstEffectIndexByOwner.set(effect.owner, index);
    }
  });
  const currentByOwner = new Map<number, unknown>();

  return [...turn.effects].reverse().map((effect) => {
    const originalIndex = turn.effects.indexOf(effect);
    const structural = deriveUndoStructural(effect.structural);
    const before = effect.structural !== undefined
      ? deriveStructuralUndoBefore(effect)
      : currentByOwner.has(effect.owner)
        ? currentByOwner.get(effect.owner)
        : realizationContext.getCurrentValue(effect.owner);
    const after = effect.structural !== undefined
      ? deriveStructuralUndoAfter(effect)
      : firstEffectIndexByOwner.get(effect.owner) === originalIndex
        ? realizationContext.getValueWithoutConfirmedTurn(turn.id, effect.owner)
        : effect.before;

    const reversedEffect = {
      owner: effect.owner,
      before,
      after,
      subjectId: effect.subjectId,
      path: (effect as CausalEffect & { path?: string }).path,
      ownerPath: (effect as CausalEffect & { ownerPath?: string }).ownerPath,
      structural,
      structuralContext: effect.structuralContext,
    };

    seedCurrentBoundary(currentByOwner, reversedEffect);

    return reversedEffect;
  });
}

function deriveUndoStructural(
  structural: NonNullable<ReturnType<Pick<TurnStore, 'getTurn'>['getTurn']>>['effects'][number]['structural']
): NonNullable<ReturnType<Pick<TurnStore, 'getTurn'>['getTurn']>>['effects'][number]['structural'] {
  switch (structural) {
    case 'add':
      return 'remove';
    case 'remove':
      return 'add';
    case 'rekey':
      return 'rekey';
    default:
      return undefined;
  }
}

function deriveStructuralUndoBefore(
  effect: NonNullable<ReturnType<Pick<TurnStore, 'getTurn'>['getTurn']>>['effects'][number]
): unknown {
  switch (effect.structural) {
    case 'add':
    case 'remove':
      return effect.after;
    case 'rekey':
      return effect.after;
    default:
      return effect.before;
  }
}

function deriveStructuralUndoAfter(
  effect: NonNullable<ReturnType<Pick<TurnStore, 'getTurn'>['getTurn']>>['effects'][number]
): unknown {
  switch (effect.structural) {
    case 'add':
    case 'remove':
      return effect.before;
    case 'rekey':
      return effect.before;
    default:
      return effect.after;
  }
}

function seedCurrentBoundary(
  currentByOwner: Map<number, unknown>,
  effect: ConfirmedReversalPlan['effects'][number]
): void {
  currentByOwner.set(effect.owner, effect.after);

}
