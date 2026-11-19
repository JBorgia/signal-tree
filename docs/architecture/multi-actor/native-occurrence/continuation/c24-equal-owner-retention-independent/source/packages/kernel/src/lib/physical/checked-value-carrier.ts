import {
  emptyPhysicalValueStorage,
  type PhysicalValueHandle,
  type PhysicalValueStorage,
  preparePhysicalValueAllocations,
  preparePhysicalValueStorageRelease,
  resolvePhysicalValue,
} from './physical-value-pool';
import type { PreparedSubjectUpdates } from './subject-record-target';

export type CheckedStructuralRecord = {
  readonly revision: number;
  readonly valueHandle?: PhysicalValueHandle;
};

export class CheckedValueCarrier<E extends Record<string, unknown>> {
  readonly #records: ReadonlyMap<number, CheckedStructuralRecord>;
  readonly #storage: PhysicalValueStorage<E>;

  constructor(
    records: ReadonlyMap<number, CheckedStructuralRecord> = new Map(),
    storage: PhysicalValueStorage<E> = emptyPhysicalValueStorage<E>()
  ) {
    this.#records = new Map(records);
    this.#storage = storage;
    Object.freeze(this);
  }

  recordForSubject(subjectId: number): CheckedStructuralRecord | undefined {
    return this.#records.get(subjectId);
  }

  valueForSubject(subjectId: number): E | undefined {
    const handle = this.#records.get(subjectId)?.valueHandle;
    return handle === undefined
      ? undefined
      : resolvePhysicalValue(this.#storage, handle);
  }

  structuralSubjectCount(): number {
    return this.#records.size;
  }

  valueSubjectCount(): number {
    let count = 0;
    for (const record of this.#records.values()) {
      if (record.valueHandle !== undefined) {
        count += 1;
      }
    }
    return count;
  }

  valueCapacity(): number {
    return this.#storage.subjects.length;
  }

  prepare(updates: PreparedSubjectUpdates<E>): CheckedValueCarrier<E> {
    const allocations = updates
      .filter(
        (update): update is typeof update & { readonly value: E } =>
          update.value !== undefined
      )
      .map((update) => ({
        subjectId: update.subjectId,
        value: update.value,
        currentHandle: this.#records.get(update.subjectId)?.valueHandle,
      }));
    const preparedValues = preparePhysicalValueAllocations(
      this.#storage,
      allocations
    );
    const handlesBySubject = new Map(
      preparedValues.handles.map((handle) => [handle.subjectId, handle])
    );
    const records = new Map(this.#records);

    for (const update of updates) {
      const current = this.#records.get(update.subjectId);
      const revision = update.revision ?? current?.revision;
      const valueHandle =
        handlesBySubject.get(update.subjectId) ?? current?.valueHandle;
      if (
        revision === undefined ||
        (current === undefined && valueHandle === undefined)
      ) {
        throw new Error(
          `New SubjectId ${String(
            update.subjectId
          )} requires revision and value contributions`
        );
      }
      records.set(update.subjectId, Object.freeze({ revision, valueHandle }));
    }

    return new CheckedValueCarrier(records, preparedValues.storage);
  }

  prepareValueRelease(subjectIds: readonly number[]): CheckedValueCarrier<E> {
    const handles = this.requireDistinctRecords(subjectIds).map(
      ({ record }) => {
        if (record.valueHandle === undefined) {
          throw new Error('Subject has no physical value backing');
        }
        return record.valueHandle;
      }
    );
    const storage = preparePhysicalValueStorageRelease(this.#storage, handles);
    const records = new Map(this.#records);
    for (const { subjectId, record } of this.requireDistinctRecords(
      subjectIds
    )) {
      records.set(subjectId, Object.freeze({ revision: record.revision }));
    }
    return new CheckedValueCarrier(records, storage);
  }

  prepareTerminalForget(subjectIds: readonly number[]): CheckedValueCarrier<E> {
    const subjects = this.requireDistinctRecords(subjectIds);
    const handles = subjects.flatMap(({ record }) =>
      record.valueHandle === undefined ? [] : [record.valueHandle]
    );
    const storage = preparePhysicalValueStorageRelease(this.#storage, handles);
    const records = new Map(this.#records);
    for (const { subjectId } of subjects) {
      records.delete(subjectId);
    }
    return new CheckedValueCarrier(records, storage);
  }

  private requireDistinctRecords(subjectIds: readonly number[]): Array<{
    readonly subjectId: number;
    readonly record: CheckedStructuralRecord;
  }> {
    const seenSubjects = new Set<number>();
    return subjectIds.map((subjectId) => {
      if (seenSubjects.has(subjectId)) {
        throw new Error(`Duplicate physical SubjectId ${String(subjectId)}`);
      }
      seenSubjects.add(subjectId);
      const record = this.#records.get(subjectId);
      if (record === undefined) {
        throw new Error(
          `Physical SubjectId ${String(subjectId)} has no structural record`
        );
      }
      return { subjectId, record };
    });
  }
}
