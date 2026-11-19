import type { ReversalEffect, PositionId } from './causal-types';

/** Private lowering evidence. Authority effects are never rewritten into display facts. */
export interface OrdinaryRealization {
  readonly ordinary: readonly ReversalEffect[];
  readonly physical: readonly ReversalEffect[];
  readonly placement: ReadonlyMap<ReversalEffect, ReversalEffect>;
}
const evidence = new WeakMap<readonly ReversalEffect[], OrdinaryRealization>();
const placementEvidence = new WeakMap<ReversalEffect, ReversalEffect>();
export function ordinaryRealization(effects: readonly ReversalEffect[]): OrdinaryRealization | undefined {
  return evidence.get(effects);
}
export function realizationPlacement(effect: ReversalEffect): ReversalEffect | undefined {
  return placementEvidence.get(effect);
}

/** Sparse, ordered key join against the physical lifetime index, before validation. */
export function prepareOrdinaryRealization(
  ordinary: readonly ReversalEffect[],
  currentKey: (owner: PositionId, subject: number) => string | number | undefined
): OrdinaryRealization {
  const keys = new Map<PositionId, Map<number, string | number | undefined>>();
  const physical: ReversalEffect[] = [];
  const placement = new Map<ReversalEffect, ReversalEffect>();
  for (const effect of ordinary) {
    if (!effect.structural || typeof effect.subjectId !== 'number') {
      physical.push(effect);
      continue;
    }
    let owner = keys.get(effect.owner);
    if (!owner) keys.set(effect.owner, owner = new Map());
    const subject = effect.subjectId;
    const key = owner.has(subject) ? owner.get(subject) : currentKey(effect.owner, subject);
    if (effect.structural === 'remove') {
      owner.set(subject, undefined);
      if (key !== undefined) physical.push(Object.freeze({ ...effect, before: key }));
    } else if (effect.structural === 'add') {
      owner.set(subject, effect.after as string | number);
      if (key === undefined) physical.push(effect);
      else {
        const transfer: ReversalEffect = Object.freeze({ ...effect, structural: 'rekey', before: key });
        physical.push(transfer);
        placement.set(transfer, effect);
        placementEvidence.set(transfer, effect);
      }
    } else {
      if (key === undefined) throw new Error('Ordinary rekey lifetime has no physical realization');
      owner.set(subject, effect.after as string | number);
      physical.push(Object.freeze({ ...effect, before: key }));
    }
  }
  const result = Object.freeze({ ordinary, physical: Object.freeze(physical), placement });
  evidence.set(result.physical, result);
  return result;
}
