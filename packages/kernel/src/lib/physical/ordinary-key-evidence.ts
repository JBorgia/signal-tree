import type { StructuralEffect } from '../mutation-types';
import type { EntityPlacement } from './entity-placement-stage';

/** A key value is not a presence sentinel. Legacy malformed input can carry
 * null/undefined at runtime without granting authority to an absent subject. */
export function ordinaryAdmissionKey(
  effect: StructuralEffect | undefined,
  placement: EntityPlacement<string | number>
): string | number {
  if (effect) {
    const field = effect.kind === 'rekey' ? 'afterKey' : 'key';
    if (Object.prototype.hasOwnProperty.call(effect, field))
      return effect.kind === 'rekey' ? effect.afterKey : effect.key;
  }
  if (placement.present) return placement.key;
  throw new Error('Ordinary entity admission lacks a key');
}
