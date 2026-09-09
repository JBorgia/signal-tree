import {
  type StudioEffect,
  type StudioTreeId,
  type StudioTurn,
} from '@signal-tree/studio-query';

import {
  type KernelConfirmedTurn,
  type KernelTurnEffect,
} from './kernel-contract';

function toStudioEffect(effect: KernelTurnEffect): StudioEffect {
  const base = {
    owner: effect.position,
    path: effect.path,
    ownerPath: effect.ownerPath,
    before: effect.before,
    after: effect.after,
    subjectId: effect.subject,
  };

  // 'set' is a scalar write and carries no structural transition. The other
  // three ARE the transition, and the kind is the fact — not something to be
  // inferred later from the shape of before/after.
  return effect.kind === 'set' ? base : { ...base, structural: effect.kind };
}

/**
 * Kernel record -> session record.
 *
 * ⚠️ `disposition` IS ALWAYS `'committed'` HERE, because the reader is a window
 * onto CONFIRMED turns only. Do not widen this by inference: a turn is not
 * `pending` because it is absent from this list, and claiming a disposition
 * that was not observed is a fabricated fact. `pending`/`discarded` arrive with
 * S1P, from a source that actually observes them.
 */
export function toStudioTurn(
  treeId: StudioTreeId,
  turn: KernelConfirmedTurn
): StudioTurn {
  return {
    treeId,
    id: turn.id,
    disposition: 'committed',
    participants: [...turn.positions],
    effects: turn.effects.map(toStudioEffect),
  };
}
