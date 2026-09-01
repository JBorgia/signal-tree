import { recordProductionSubstrateStat } from '../internals/production-substrate-stats';

export class EntityValueStore<E extends Record<string, unknown>> {
  private retainedEntities = new Map<number, E>();

  backingForSubject(subjectId: number): E | undefined {
    return this.retainedEntities.get(subjectId);
  }

  retainSubjectValue(subjectId: number, entity: E): void {
    recordProductionSubstrateStat('valueStoreWrites');
    this.retainedEntities.set(subjectId, entity);
  }

  prepareTargetValues(
    subjects: readonly { readonly subjectId: number; readonly value: E }[]
  ): Map<number, E> {
    const target = new Map(this.retainedEntities);
    for (const subject of subjects) {
      target.set(subject.subjectId, subject.value);
    }
    return target;
  }

  installPreparedTargetValues(target: Map<number, E>): void {
    this.retainedEntities = target;
  }

  hasRetainedValueBacking(subjectId: number): boolean {
    return this.retainedEntities.has(subjectId);
  }

  retireSubjectValue(subjectId: number): boolean {
    return this.retainedEntities.delete(subjectId);
  }

  clear(): void {
    this.retainedEntities.clear();
  }
}
