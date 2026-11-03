import type { WriteMetadata } from '../mutation-types';
import type { CommittedEntityMutation } from './mutation-capture-runtime';
import { withEntityOrdinaryChanges } from './entity-value-transition';
const SELECTED_ENTITY_DISPOSITION = Symbol('selected-entity-disposition');
type DispositionMetadata = WriteMetadata & {
  readonly [SELECTED_ENTITY_DISPOSITION]?: true;
};
/** Only an existing inverse authority handoff may mark selected source facts. */
export function withSelectedEntityDisposition(
  meta: WriteMetadata | undefined,
  changes: readonly CommittedEntityMutation[]
): WriteMetadata {
  const selected: DispositionMetadata = {
    ...meta,
    [SELECTED_ENTITY_DISPOSITION]: true,
  };
  return withEntityOrdinaryChanges(selected, changes);
}
export function hasSelectedEntityDisposition(
  meta: WriteMetadata | undefined
): boolean {
  return (
    (meta as DispositionMetadata | undefined)?.[SELECTED_ENTITY_DISPOSITION] ===
    true
  );
}
