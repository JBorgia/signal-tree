import { EntityValueStore } from './entity-value-store';
import {
  type AcquiredSubjectHandle,
  type ResolvedSubjectHandle,
  StructuralStore,
} from './structural-store';

export type ResolvedEntityHandle<
  K extends string | number,
  E extends Record<string, unknown>,
> =
  | (Extract<ResolvedSubjectHandle<K>, { state: 'active' }> & {
      value: E;
    })
  | Exclude<ResolvedSubjectHandle<K>, { state: 'active' }>
  | {
      state: 'missing-value';
      subjectId: number;
      key: K;
      revision: number;
    };

export function resolveEntityHandle<
  K extends string | number,
  E extends Record<string, unknown>,
>(
  structuralStore: StructuralStore<K>,
  valueStore: EntityValueStore<E>,
  handle: AcquiredSubjectHandle
): ResolvedEntityHandle<K, E> {
  const subject = structuralStore.resolveSubjectHandle(handle);

  if (subject.state !== 'active') {
    return subject;
  }

  const value = valueStore.backingForSubject(subject.subjectId);
  return value === undefined
    ? {
        state: 'missing-value',
        subjectId: subject.subjectId,
        key: subject.key,
        revision: subject.revision,
      }
    : {
        ...subject,
        value,
      };
}