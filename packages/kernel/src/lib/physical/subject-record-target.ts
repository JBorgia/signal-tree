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

declare const preparedSubjectUpdatesBrand: unique symbol;

export type PreparedSubjectUpdates<E extends Record<string, unknown>> =
  readonly PreparedSubjectUpdate<E>[] & {
    readonly [preparedSubjectUpdatesBrand]: true;
  };

export type PhysicalSubjectRecord<E extends Record<string, unknown>> = {
  readonly revision: number;
  readonly value: E;
};

export type PhysicalSubjectSlots<E extends Record<string, unknown>> = {
  readonly slotBySubject: ReadonlyMap<number, number>;
  readonly subjects: readonly number[];
  readonly revisions: readonly number[];
  readonly values: readonly E[];
};

export function composePreparedSubjectUpdates<
  E extends Record<string, unknown>
>(
  structural: readonly StructuralSubjectContribution[],
  values: readonly ValueSubjectContribution<E>[]
): PreparedSubjectUpdates<E> {
  const updates = new Map<number, PreparedSubjectUpdate<E>>();

  for (const contribution of structural) {
    assertSubjectId(contribution.subjectId);
    assertRevision(contribution.revision);
    if (updates.has(contribution.subjectId)) {
      throw new Error(
        `Duplicate structural contribution for SubjectId ${String(
          contribution.subjectId
        )}`
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
    if (contribution.value === undefined) {
      throw new Error(
        `Invalid prepared value for SubjectId ${String(contribution.subjectId)}`
      );
    }
    if (valueSubjects.has(contribution.subjectId)) {
      throw new Error(
        `Duplicate value contribution for SubjectId ${String(
          contribution.subjectId
        )}`
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
  ) as PreparedSubjectUpdates<E>;
}

export function preparePhysicalSubjectTarget<E extends Record<string, unknown>>(
  current: ReadonlyMap<number, PhysicalSubjectRecord<E>>,
  updates: PreparedSubjectUpdates<E>
): ReadonlyMap<number, PhysicalSubjectRecord<E>> {
  const prepared: Array<readonly [number, PhysicalSubjectRecord<E>]> = [];
  for (const update of updates) {
    const currentRecord = current.get(update.subjectId);
    const revision = update.revision ?? currentRecord?.revision;
    const value = update.value ?? currentRecord?.value;
    if (revision === undefined || value === undefined) {
      throw new Error(
        `New SubjectId ${String(
          update.subjectId
        )} requires revision and value contributions`
      );
    }
    prepared.push([update.subjectId, Object.freeze({ revision, value })]);
  }

  const target = new Map(current);
  for (const [subjectId, record] of prepared) {
    target.set(subjectId, record);
  }
  return target;
}

export function preparePhysicalSubjectSlotTarget<
  E extends Record<string, unknown>
>(
  current: PhysicalSubjectSlots<E>,
  updates: PreparedSubjectUpdates<E>
): PhysicalSubjectSlots<E> {
  const prepared: Array<{
    readonly subjectId: number;
    readonly slot: number;
    readonly revision: number;
    readonly value: E;
  }> = [];
  let nextSlot = current.subjects.length;

  for (const update of updates) {
    const existingSlot = current.slotBySubject.get(update.subjectId);
    const revision =
      update.revision ??
      (existingSlot === undefined
        ? undefined
        : current.revisions[existingSlot]);
    const value =
      update.value ??
      (existingSlot === undefined ? undefined : current.values[existingSlot]);
    if (revision === undefined || value === undefined) {
      throw new Error(
        `New SubjectId ${String(
          update.subjectId
        )} requires revision and value contributions`
      );
    }

    prepared.push({
      subjectId: update.subjectId,
      slot: existingSlot ?? nextSlot++,
      revision,
      value,
    });
  }

  const slotBySubject = new Map(current.slotBySubject);
  const subjects = [...current.subjects];
  const revisions = [...current.revisions];
  const values = [...current.values];
  for (const update of prepared) {
    slotBySubject.set(update.subjectId, update.slot);
    subjects[update.slot] = update.subjectId;
    revisions[update.slot] = update.revision;
    values[update.slot] = update.value;
  }

  return Object.freeze({
    slotBySubject,
    subjects: Object.freeze(subjects),
    revisions: Object.freeze(revisions),
    values: Object.freeze(values),
  });
}

export function assertPhysicalSubjectSlots<E extends Record<string, unknown>>(
  slots: PhysicalSubjectSlots<E>
): void {
  if (
    slots.subjects.length !== slots.revisions.length ||
    slots.subjects.length !== slots.values.length ||
    slots.slotBySubject.size !== slots.subjects.length
  ) {
    throw new Error('Physical subject slot columns are inconsistent');
  }
  for (let slot = 0; slot < slots.subjects.length; slot += 1) {
    const subjectId = slots.subjects[slot];
    assertSubjectId(subjectId);
    assertRevision(slots.revisions[slot]);
    if (slots.values[slot] === undefined) {
      throw new Error(
        `Physical subject slot ${String(slot)} is missing its value`
      );
    }
    if (slots.slotBySubject.get(subjectId) !== slot) {
      throw new Error(
        `Physical SubjectId ${String(subjectId)} does not address slot ${String(
          slot
        )}`
      );
    }
  }
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
