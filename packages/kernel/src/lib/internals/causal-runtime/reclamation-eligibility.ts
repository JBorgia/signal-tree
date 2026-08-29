import type { AppliedTurnProjection } from './applied-turn-projection';
import type { CausalEffect, StructuralEffectKind, TurnId } from './causal-types';
import type { TurnStore } from './turn-store';

type EligibilityTurnState = 'pending' | 'confirmed-applied' | 'confirmed-redoable';

export interface ReclamationEligibilityBlocker {
  readonly kind: 'confirmed-restore-path' | 'pending-reference';
  readonly turnId: TurnId;
  readonly state: EligibilityTurnState;
  readonly structural?: StructuralEffectKind;
}

export interface ReclamationEligibility {
  readonly eligible: boolean;
  readonly blockers: readonly ReclamationEligibilityBlocker[];
}

export interface ReclamationEligibilityOptions {
  readonly subjectId: unknown;
  readonly store: Pick<TurnStore, 'getTurns' | 'getPendingTurns'>;
  readonly appliedTurns: Pick<AppliedTurnProjection, 'getAppliedTurnIds' | 'getRedoTurnIds'>;
}

export function assessReclamationEligibility(
  options: ReclamationEligibilityOptions
): ReclamationEligibility {
  const blockers: ReclamationEligibilityBlocker[] = [];
  const appliedTurnIds = new Set(options.appliedTurns.getAppliedTurnIds());
  const redoTurnIds = new Set(options.appliedTurns.getRedoTurnIds());

  for (const turn of options.store.getPendingTurns()) {
    const effect = findSubjectEffect(turn.effects, options.subjectId);
    if (!effect) {
      continue;
    }

    blockers.push({
      kind: 'pending-reference',
      turnId: turn.id,
      state: 'pending',
      structural: effect.structural,
    });
  }

  for (const turn of options.store.getTurns()) {
    const effect = findSubjectEffect(turn.effects, options.subjectId);
    if (!effect) {
      continue;
    }

    if (appliedTurnIds.has(turn.id) && effect.structural === 'remove') {
      blockers.push({
        kind: 'confirmed-restore-path',
        turnId: turn.id,
        state: 'confirmed-applied',
        structural: effect.structural,
      });
      continue;
    }

    if (redoTurnIds.has(turn.id) && effect.structural === 'add') {
      blockers.push({
        kind: 'confirmed-restore-path',
        turnId: turn.id,
        state: 'confirmed-redoable',
        structural: effect.structural,
      });
    }
  }

  return {
    eligible: blockers.length === 0,
    blockers,
  };
}

function findSubjectEffect(
  effects: readonly CausalEffect[],
  subjectId: unknown
): CausalEffect | undefined {
  return effects.find((effect) => effect.subjectId === subjectId);
}
