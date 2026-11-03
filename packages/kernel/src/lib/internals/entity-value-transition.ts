import { entityPublicationFactsUnit, withEntityPublicationUnit } from './entity-publication';
import type { WriteMetadata } from '../mutation-types';

/** Existing-lifetime prepared evidence; physical display is not ordinary authority. */
export interface EntityValueTransition<E = unknown> {
  readonly publicationUnit?: object;
  readonly ordinaryChanges?: readonly import('./mutation-capture-runtime').CommittedEntityMutation[];
  readonly subject: number;
  readonly physicalBefore: E | undefined;
  readonly physicalAfter: E;
  readonly ordinaryBefore: E | undefined;
  readonly ordinaryAfter: E;
  readonly retainDivergence: boolean;
}
const ENTITY_VALUE_TRANSITION = Symbol('entity-value-transition');
type TransitionMetadata = WriteMetadata & {
  readonly [ENTITY_VALUE_TRANSITION]?: EntityValueTransition;
};
export function entityValueTransition(
  meta: WriteMetadata | undefined
): EntityValueTransition | undefined {
  return (meta as TransitionMetadata | undefined)?.[ENTITY_VALUE_TRANSITION];
}
export function withEntityValueTransition(
  meta: WriteMetadata | undefined,
  transition: EntityValueTransition | undefined
): WriteMetadata | undefined {
  return transition
    ? ({ ...meta, [ENTITY_VALUE_TRANSITION]: transition } as TransitionMetadata)
    : meta;
}
export function mergeEntityValueTransition(
  left: WriteMetadata | undefined,
  right: WriteMetadata | undefined,
  merged: WriteMetadata | undefined
): WriteMetadata | undefined {
  const a = entityValueTransition(left);
  const b = entityValueTransition(right);
  const leftChanges=getEntityOrdinaryChanges(left), rightChanges=getEntityOrdinaryChanges(right);
  if(leftChanges !== undefined || rightChanges !== undefined)
    merged=withEntityOrdinaryChanges(merged,[...(leftChanges ?? []),...(rightChanges ?? [])]);
  if (!a || !b || a.subject !== b.subject) return merged;
  return withEntityValueTransition(
    merged,
    Object.freeze({
      ...b,
      physicalBefore: a.physicalBefore,
      ordinaryBefore: a.ordinaryBefore,
    })
  );
}

/** Authority consumers select ordinary facts; native subscribers keep physical tuples. */
export function ordinaryEntityEntry<
  T extends {
    readonly meta?: WriteMetadata;
    readonly newValue: unknown;
    readonly oldValue: unknown;
  }
>(entry: T): T {
  const transition = entityValueTransition(entry.meta);
  return transition
    ? {
        ...entry,
        newValue: transition.ordinaryAfter,
        oldValue: transition.ordinaryBefore,
      }
    : entry;
}

/** Ordered realized facts, distinct from the complete physical display target. */
export type EntityRealizationEdit =
  | { readonly kind: 'row'; readonly value: unknown }
  | {
      readonly kind: 'field';
      readonly selection?: import('./native-field-selection').NativeFieldEndpoint;
      readonly field: string;
      readonly present: boolean;
      readonly value: unknown;
    };

const ENTITY_ORDINARY_CHANGES = Symbol('entity-ordinary-changes');
type OrdinaryChange = import('./mutation-capture-runtime').CommittedEntityMutation;
type OrdinaryChangesMetadata = WriteMetadata & {readonly [ENTITY_ORDINARY_CHANGES]?: readonly OrdinaryChange[]};
export function getEntityOrdinaryChanges(meta: WriteMetadata | undefined): readonly OrdinaryChange[] | undefined {
  return (meta as OrdinaryChangesMetadata | undefined)?.[ENTITY_ORDINARY_CHANGES] ?? entityValueTransition(meta)?.ordinaryChanges;
}
export function withEntityOrdinaryChanges(meta: WriteMetadata | undefined, changes: readonly OrdinaryChange[]): WriteMetadata {
  const result={...meta,[ENTITY_ORDINARY_CHANGES]:changes} as OrdinaryChangesMetadata;
  const unit=entityPublicationFactsUnit(changes);
  return unit?withEntityPublicationUnit(result,unit):result;
}
export function withoutEntityOrdinaryChanges(meta: WriteMetadata | undefined): WriteMetadata | undefined {
  if(!meta) return meta;
  const copy={...meta} as OrdinaryChangesMetadata;
  delete (copy as { [ENTITY_ORDINARY_CHANGES]?: readonly OrdinaryChange[] })[ENTITY_ORDINARY_CHANGES];
  delete (copy as { [ENTITY_VALUE_TRANSITION]?: EntityValueTransition })[ENTITY_VALUE_TRANSITION];
  return copy;
}
