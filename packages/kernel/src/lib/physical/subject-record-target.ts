export type StructuralSubjectContribution = {
  readonly subjectId: number;
  readonly revision: number;
};

export type ValueSubjectContribution<E extends Record<string, unknown>> = {
  readonly subjectId: number;
  readonly value: E;
};

export type PreparedSubjectUpdate<E extends Record<string, unknown>> = {
  readonly subjectId: number;
  readonly revision?: number;
  readonly value?: E;
};

export type PhysicalSubjectRecord<E extends Record<string, unknown>> = {
  readonly revision: number;
  readonly value: E;
};

export function composePreparedSubjectUpdates<E extends Record<string, unknown>>(
  structural: readonly StructuralSubjectContribution[],
  values: readonly ValueSubjectContribution<E>[]
): readonly PreparedSubjectUpdate<E>[] {
  const updates = new Map<number, PreparedSubjectUpdate<E>>();

  for (const contribution of structural) {
    assertSubjectId(contribution.subjectId);
    assertRevision(contribution.revision);
    if (updates.has(contribution.subjectId)) {
      throw new Error(
        `Duplicate structural contribution for SubjectId ${String(contribution.subjectId)}`
      );
    }
    updates.set(contribution.subjectId, {
      subjectId: contribution.subjectId,
      revision: contribution.revision,
    });
  }

  const valueSubjects = new Set<number>();
  for (const contribution of values) {
    assertSubjectId(contribution.subjectId);
    if (valueSubjects.has(contribution.subjectId)) {
      throw new Error(
        `Duplicate value contribution for SubjectId ${String(contribution.subjectId)}`
      );
    }
    valueSubjects.add(contribution.subjectId);

    const current = updates.get(contribution.subjectId);
    updates.set(contribution.subjectId, {
      ...current,
      subjectId: contribution.subjectId,
      value: contribution.value,
    });
  }

  return Object.freeze(
    [...updates.values()]
      .sort((left, right) => left.subjectId - right.subjectId)
      .map((update) => Object.freeze(update))
  );
}

export function preparePhysicalSubjectTarget<E extends Record<string, unknown>>(
  current: ReadonlyMap<number, PhysicalSubjectRecord<E>>,
  updates: readonly PreparedSubjectUpdate<E>[]
): ReadonlyMap<number, PhysicalSubjectRecord<E>> {
  const seenSubjects = new Set<number>();
  const prepared: Array<readonly [number, PhysicalSubjectRecord<E>]> = [];
  for (const update of updates) {
    assertSubjectId(update.subjectId);
    if (seenSubjects.has(update.subjectId)) {
      throw new Error(
        `Duplicate physical update for SubjectId ${String(update.subjectId)}`
      );
    }
    seenSubjects.add(update.subjectId);

    if (update.revision !== undefined) {
      assertRevision(update.revision);
    }
    const currentRecord = current.get(update.subjectId);
    const revision = update.revision ?? currentRecord?.revision;
    const value = update.value ?? currentRecord?.value;
    if (revision === undefined || value === undefined) {
      throw new Error(
        `New SubjectId ${String(update.subjectId)} requires revision and value contributions`
      );
    }
    prepared.push([
      update.subjectId,
      Object.freeze({ revision, value }),
    ]);
  }

  const target = new Map(current);
  for (const [subjectId, record] of prepared) {
    target.set(subjectId, record);
  }
  return target;
}

function assertSubjectId(subjectId: number): void {
  if (!Number.isSafeInteger(subjectId) || subjectId <= 0) {
    throw new Error(`Invalid SubjectId ${String(subjectId)}`);
  }
}

function assertRevision(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error(`Invalid subject revision ${String(revision)}`);
  }
}
