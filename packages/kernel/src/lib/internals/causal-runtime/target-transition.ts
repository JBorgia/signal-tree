import type { PositionId, ReversalEffect } from './causal-types';

export type CollectionTargetSubject = {
  readonly subject: number;
  readonly key: string | number;
  readonly value: unknown;
};

export type CollectionTransitionSource = {
  readonly owner: PositionId;
  readonly subjects: readonly CollectionTargetSubject[];
  readonly order: readonly number[];
  readonly orderFrontier: unknown;
};

export type CollectionTransitionTarget = CollectionTransitionSource;

export type DeclarativeTransitionTarget = {
  readonly collections: ReadonlyMap<PositionId, CollectionTransitionTarget>;
  readonly scalars: ReadonlyMap<PositionId, unknown>;
};

export type PreparedCollectionTransitionTarget = {
  install(): void;
  publish(): void;
};

export type CollectionTransitionTargetBinding = {
  readonly owner: PositionId;
  readSource(): CollectionTransitionSource;
  prepareTarget(
    target: CollectionTransitionTarget
  ): PreparedCollectionTransitionTarget;
};

export type ScalarTransitionTargetBinding = {
  prepareTarget(
    target: ReadonlyMap<PositionId, unknown>
  ): PreparedCollectionTransitionTarget;
};

export function prepareDeclarativeTransitionInstallation(
  target: DeclarativeTransitionTarget,
  bindings: ReadonlyMap<PositionId, CollectionTransitionTargetBinding>,
  scalarBinding?: ScalarTransitionTargetBinding
): { install(): void } {
  const prepared: PreparedCollectionTransitionTarget[] = [];
  for (const [owner, collection] of target.collections) {
    const binding = bindings.get(owner);
    if (!binding || binding.owner !== owner) {
      throw new Error(
        `Declarative transition has no collection binding ${owner}`
      );
    }
    prepared.push(binding.prepareTarget(collection));
  }
  if (target.scalars.size > 0) {
    if (!scalarBinding) {
      throw new Error(
        'Declarative transition has scalar targets but no scalar binding'
      );
    }
    prepared.push(scalarBinding.prepareTarget(target.scalars));
  }

  return {
    install(): void {
      for (const collection of prepared) {
        collection.install();
      }
      for (const collection of prepared) {
        collection.publish();
      }
    },
  };
}

export type DeriveDeclarativeTransitionTargetOptions = {
  readonly collections: readonly CollectionTransitionSource[];
  readonly effects: readonly ReversalEffect[];
  readonly orderDeltas?: readonly CollectionOrderDelta[];
  readonly orderEndpoint?: 'before' | 'after';
  readonly orderEndpoints?: ReadonlyMap<PositionId, 'before' | 'after'>;
};

export type CollectionOrderParticipant = {
  readonly subject: number;
  readonly beforeRank?: number;
  readonly afterRank?: number;
};

export type CollectionOrderDelta = {
  readonly owner: PositionId;
  readonly beforeLength: number;
  readonly afterLength: number;
  readonly beforeFrontier: unknown;
  readonly afterFrontier: unknown;
  readonly participants: readonly CollectionOrderParticipant[];
};

export function requiresDeclarativeStructuralTarget(
  effects: readonly ReversalEffect[]
): boolean {
  const structural = effects.filter(
    (effect) => effect.structural !== undefined
  );
  const hasKeyHandoff = structural.some((vacating, vacatingIndex) => {
    const vacatedKey =
      vacating.structural === 'remove' || vacating.structural === 'rekey'
        ? vacating.before
        : undefined;
    if (vacatedKey === undefined) {
      return false;
    }
    return structural.some((occupying, occupyingIndex) => {
      if (vacatingIndex === occupyingIndex || vacating.owner !== occupying.owner) {
        return false;
      }
      const occupiedKey =
        occupying.structural === 'add' || occupying.structural === 'rekey'
          ? occupying.after
          : undefined;
      return occupiedKey !== undefined && Object.is(vacatedKey, occupiedKey);
    });
  });
  if (hasKeyHandoff) {
    return true;
  }

  const additions = structural.filter(
    (effect) => effect.structural === 'add' && typeof effect.subjectId === 'number'
  );
  if (additions.length < 2) {
    return false;
  }
  const addedSubjects = new Set(additions.map(({ subjectId }) => subjectId));
  return additions.some((effect) => {
    const context = effect.structuralContext;
    if (context?.kind !== 'add' && context?.kind !== 'remove') {
      return false;
    }
    return (
      (context.beforeSubject !== undefined &&
        !addedSubjects.has(context.beforeSubject)) ||
      (context.afterSubject !== undefined &&
        !addedSubjects.has(context.afterSubject))
    );
  });
}

export function deriveDeclarativeTransitionTarget(
  options: DeriveDeclarativeTransitionTargetOptions
): DeclarativeTransitionTarget {
  const collections = new Map<
    PositionId,
    {
      subjects: Map<number, CollectionTargetSubject>;
      order: number[];
      sourceSubjects: Set<number>;
    }
  >();
  for (const source of options.collections) {
    if (collections.has(source.owner)) {
      throw new Error(`Duplicate collection transition owner ${source.owner}`);
    }
    assertUniqueSubjects(source.order);
    assertUniqueSubjects(source.subjects.map(({ subject }) => subject));
    const subjects = new Map(
      source.subjects.map((subject) => [subject.subject, { ...subject }])
    );
    assertCollectionOrderMatchesSubjects(source.order, subjects);
    collections.set(source.owner, {
      subjects,
      order: [...source.order],
      sourceSubjects: new Set(subjects.keys()),
    });
  }

  const scalars = new Map<PositionId, unknown>();
  for (const effect of options.effects) {
    if (effect.structural === undefined) {
      applyValueEffect(collections, scalars, effect);
      continue;
    }
    applyStructuralEffect(collections, effect);
  }

  const orderDeltas = new Map<PositionId, CollectionOrderDelta>();
  for (const delta of options.orderDeltas ?? []) {
    if (orderDeltas.has(delta.owner)) {
      throw new Error(
        `Duplicate collection order delta for owner ${delta.owner}`
      );
    }
    orderDeltas.set(delta.owner, delta);
  }

  const targets = new Map<PositionId, CollectionTransitionTarget>();
  for (const [owner, collection] of collections) {
    const delta = orderDeltas.get(owner);
    const orderEndpoint =
      options.orderEndpoints?.get(owner) ?? options.orderEndpoint ?? 'after';
    const order = delta
      ? applyCollectionOrderDelta(
          collection.order,
          delta,
          orderEndpoint,
          options.collections.find((source) => source.owner === owner)
            ?.orderFrontier
        )
      : deriveStructuralTargetOrder(
          collection.order,
          collection.subjects,
          options.effects.filter((effect) => effect.owner === owner)
        );
    assertCollectionOrderMatchesSubjects(order, collection.subjects);
    assertUniqueTargetKeys(collection.subjects);
    targets.set(owner, {
      owner,
      subjects: [...collection.subjects.values()].sort(
        (left, right) => left.subject - right.subject
      ),
      order,
      orderFrontier: delta
        ? orderEndpoint === 'before'
          ? delta.beforeFrontier
          : delta.afterFrontier
        : options.collections.find((source) => source.owner === owner)
            ?.orderFrontier === undefined ||
            sameSubjects(collection.sourceSubjects, collection.subjects)
          ? options.collections.find((source) => source.owner === owner)
              ?.orderFrontier
          : {},
    });
  }

  for (const owner of orderDeltas.keys()) {
    if (!targets.has(owner)) {
      throw new Error(`Collection order delta has no owner ${owner}`);
    }
  }

  return { collections: targets, scalars };
}

export function deriveCollectionOrderDelta(
  owner: PositionId,
  before: readonly number[],
  after: readonly number[],
  beforeFrontier: unknown,
  afterFrontier: unknown
): CollectionOrderDelta {
  assertUniqueSubjects(before);
  assertUniqueSubjects(after);

  const beforeRank = indexSubjects(before);
  const afterRank = indexSubjects(after);
  const commonBefore = before.filter((subject) => afterRank.has(subject));
  const commonAfter = after.filter((subject) => beforeRank.has(subject));
  const backbone = lexicographicallySmallestCommonSubsequence(
    commonBefore,
    commonAfter
  );
  const backboneSubjects = new Set(backbone);
  const participants = new Map<number, CollectionOrderParticipant>();

  for (const [subject, rank] of beforeRank) {
    if (!backboneSubjects.has(subject)) {
      participants.set(subject, { subject, beforeRank: rank });
    }
  }

  for (const [subject, rank] of afterRank) {
    if (backboneSubjects.has(subject)) {
      continue;
    }
    participants.set(subject, {
      ...participants.get(subject),
      subject,
      afterRank: rank,
    });
  }

  return {
    owner,
    beforeLength: before.length,
    afterLength: after.length,
    beforeFrontier,
    afterFrontier,
    participants: [...participants.values()].sort(
      (left, right) => left.subject - right.subject
    ),
  };
}

export function applyCollectionOrderDelta(
  current: readonly number[],
  delta: CollectionOrderDelta,
  endpoint: 'before' | 'after',
  currentFrontier: unknown
): number[] {
  assertUniqueSubjects(current);

  const sourceEndpoint = endpoint === 'before' ? 'after' : 'before';
  const sourceLength =
    sourceEndpoint === 'before' ? delta.beforeLength : delta.afterLength;
  const sourceFrontier =
    sourceEndpoint === 'before' ? delta.beforeFrontier : delta.afterFrontier;
  if (current.length !== sourceLength || currentFrontier !== sourceFrontier) {
    throw frontierMismatch();
  }

  const currentRank = indexSubjects(current);
  for (const participant of delta.participants) {
    const expectedRank = rankAt(participant, sourceEndpoint);
    if (
      (expectedRank === undefined && currentRank.has(participant.subject)) ||
      (expectedRank !== undefined &&
        current[expectedRank] !== participant.subject)
    ) {
      throw frontierMismatch();
    }
  }

  const participantSubjects = new Set(
    delta.participants.map(({ subject }) => subject)
  );
  const backbone = current.filter(
    (subject) => !participantSubjects.has(subject)
  );
  const targetLength =
    endpoint === 'before' ? delta.beforeLength : delta.afterLength;
  const target: Array<number | undefined> = new Array(targetLength);

  for (const participant of delta.participants) {
    const rank = rankAt(participant, endpoint);
    if (rank === undefined) {
      continue;
    }
    if (rank < 0 || rank >= targetLength || target[rank] !== undefined) {
      throw frontierMismatch();
    }
    target[rank] = participant.subject;
  }

  let backboneIndex = 0;
  for (let rank = 0; rank < target.length; rank += 1) {
    if (target[rank] !== undefined) {
      continue;
    }
    const subject = backbone[backboneIndex];
    if (subject === undefined) {
      throw frontierMismatch();
    }
    target[rank] = subject;
    backboneIndex += 1;
  }

  if (backboneIndex !== backbone.length) {
    throw frontierMismatch();
  }

  return target as number[];
}

function lexicographicallySmallestCommonSubsequence(
  before: readonly number[],
  after: readonly number[]
): number[] {
  if (before.length === 0 || after.length === 0) {
    return [];
  }

  const afterRank = indexSubjects(after);
  const mappedRanks = before.map((subject) => afterRank.get(subject) as number);
  const suffixLengths = longestIncreasingSuffixLengths(mappedRanks);
  let maximumLength = 0;
  for (const length of suffixLengths) {
    maximumLength = Math.max(maximumLength, length);
  }
  const candidatesByLength = new Map<number, number[]>();

  for (let index = 0; index < before.length; index += 1) {
    const length = suffixLengths[index];
    const candidates = candidatesByLength.get(length) ?? [];
    candidates.push(index);
    candidatesByLength.set(length, candidates);
  }
  for (const candidates of candidatesByLength.values()) {
    candidates.sort((left, right) => before[left] - before[right]);
  }

  const result: number[] = [];
  let previousBeforeIndex = -1;
  let previousAfterRank = -1;
  for (let remaining = maximumLength; remaining > 0; remaining -= 1) {
    const candidates = candidatesByLength.get(remaining) ?? [];
    const selected = candidates.find(
      (index) =>
        index > previousBeforeIndex && mappedRanks[index] > previousAfterRank
    );
    if (selected === undefined) {
      throw new Error('Unable to derive a canonical collection order backbone');
    }
    result.push(before[selected]);
    previousBeforeIndex = selected;
    previousAfterRank = mappedRanks[selected];
  }

  return result;
}

function applyStructuralEffect(
  collections: Map<
    PositionId,
    { subjects: Map<number, CollectionTargetSubject>; order: number[] }
  >,
  effect: ReversalEffect
): void {
  const collection = collections.get(effect.owner);
  if (!collection || typeof effect.subjectId !== 'number') {
    throw new Error(
      `Structural effect has no collection target ${effect.owner}`
    );
  }

  const subject = effect.subjectId;
  if (effect.structural === 'add') {
    if (collection.subjects.has(subject)) {
      throw new Error(
        `Subject ${subject} is already active in owner ${effect.owner}`
      );
    }
    const key = effect.after;
    if (typeof key !== 'string' && typeof key !== 'number') {
      throw new Error(`Restored subject ${subject} has no target key`);
    }
    collection.subjects.set(subject, {
      subject,
      key,
      value: structuralValue(effect),
    });
    return;
  }

  const existing = collection.subjects.get(subject);
  if (!existing) {
    throw new Error(
      `Subject ${subject} is not active in owner ${effect.owner}`
    );
  }
  if (effect.structural === 'remove') {
    if (existing.key !== effect.before) {
      throw new Error(`Subject ${subject} is not at its expected source key`);
    }
    collection.subjects.delete(subject);
    return;
  }

  if (existing.key !== effect.before) {
    throw new Error(`Subject ${subject} is not at its expected source key`);
  }
  const key = effect.after;
  if (typeof key !== 'string' && typeof key !== 'number') {
    throw new Error(`Rekeyed subject ${subject} has no target key`);
  }
  collection.subjects.set(subject, { ...existing, key });
}

function deriveStructuralTargetOrder(
  sourceOrder: readonly number[],
  subjects: ReadonlyMap<number, CollectionTargetSubject>,
  effects: readonly ReversalEffect[]
): number[] {
  const order = sourceOrder.filter((subject) => subjects.has(subject));
  const additions = effects.filter(
    (effect) =>
      effect.structural === 'add' &&
      typeof effect.subjectId === 'number' &&
      subjects.has(effect.subjectId)
  );
  const pending = [...additions];

  while (pending.length > 0) {
    const pendingSubjects = new Set(
      pending.map((effect) => effect.subjectId as number)
    );
    const readyIndex = pending.findIndex((effect) => {
      const context = effect.structuralContext;
      if (context?.kind !== 'add' && context?.kind !== 'remove') {
        return true;
      }
      const beforeLive =
        context.beforeSubject !== undefined &&
        order.includes(context.beforeSubject);
      const afterLive =
        context.afterSubject !== undefined && order.includes(context.afterSubject);
      if (beforeLive || afterLive) {
        return true;
      }
      const hasNoAnchors =
        context.beforeSubject === undefined && context.afterSubject === undefined;
      if (hasNoAnchors) {
        return true;
      }
      const anchorMayBecomeLive =
        (context.beforeSubject !== undefined &&
          pendingSubjects.has(context.beforeSubject)) ||
        (context.afterSubject !== undefined &&
          pendingSubjects.has(context.afterSubject));
      return !anchorMayBecomeLive;
    });
    if (readyIndex < 0) {
      throw new Error('Collection structural target contains an anchor cycle');
    }
    const effect = pending.splice(readyIndex, 1)[0];
    const subject = effect.subjectId as number;
    const context = effect.structuralContext;
    const beforeSubject =
      context?.kind === 'add' || context?.kind === 'remove'
        ? context.beforeSubject
        : undefined;
    const afterSubject =
      context?.kind === 'add' || context?.kind === 'remove'
        ? context.afterSubject
        : undefined;
    const afterIndex =
      afterSubject === undefined ? -1 : order.indexOf(afterSubject);
    const beforeIndex =
      beforeSubject === undefined ? -1 : order.indexOf(beforeSubject);
    if (beforeIndex >= 0 && afterIndex >= 0 && beforeIndex >= afterIndex) {
      throw new Error('Collection structural target contains contradictory anchors');
    }
    if (afterIndex >= 0) {
      order.splice(afterIndex, 0, subject);
      continue;
    }
    if (beforeIndex >= 0) {
      order.splice(beforeIndex + 1, 0, subject);
      continue;
    }
    if (beforeSubject === undefined && afterSubject === undefined) {
      order.push(subject);
      continue;
    }
    throw new Error('Collection structural target has no live placement anchor');
  }

  return order;
}

function applyValueEffect(
  collections: Map<
    PositionId,
    { subjects: Map<number, CollectionTargetSubject>; order: number[] }
  >,
  scalars: Map<PositionId, unknown>,
  effect: ReversalEffect
): void {
  if (typeof effect.subjectId !== 'number') {
    scalars.set(effect.owner, effect.after);
    return;
  }

  const collection = collections.get(effect.owner);
  const subject = collection?.subjects.get(effect.subjectId);
  if (!collection || !subject) {
    throw new Error(
      `Value effect has no active subject ${String(
        effect.subjectId
      )} in owner ${effect.owner}`
    );
  }
  const fieldPath = deriveSubjectFieldPath(effect.path, effect.ownerPath);
  collection.subjects.set(effect.subjectId, {
    ...subject,
    value:
      fieldPath.length === 0
        ? effect.after
        : setValueAtPath(subject.value, fieldPath, effect.after),
  });
}

function deriveSubjectFieldPath(
  path: string | undefined,
  ownerPath: string | undefined
): string[] {
  if (
    !path ||
    !ownerPath ||
    path === ownerPath ||
    !path.startsWith(`${ownerPath}.`)
  ) {
    throw new Error('Subject value effect has no collection-relative address');
  }
  const relative = path.slice(ownerPath.length + 1);
  const [, ...fieldPath] = relative.split('.');
  return fieldPath;
}

function structuralValue(effect: ReversalEffect): unknown {
  const context = effect.structuralContext;
  return context?.kind === 'add' || context?.kind === 'remove'
    ? context.value
    : undefined;
}

function setValueAtPath(
  value: unknown,
  path: readonly string[],
  replacement: unknown
): unknown {
  if (path.length === 0) {
    return replacement;
  }
  const [head, ...rest] = path;
  const record = isRecord(value) ? value : {};
  return {
    ...record,
    [head]: setValueAtPath(record[head], rest, replacement),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertCollectionOrderMatchesSubjects(
  order: readonly number[],
  subjects: ReadonlyMap<number, CollectionTargetSubject>
): void {
  if (
    order.length !== subjects.size ||
    order.some((subject) => !subjects.has(subject))
  ) {
    throw new Error('Collection order does not match active SubjectIds');
  }
}

function assertUniqueTargetKeys(
  subjects: ReadonlyMap<number, CollectionTargetSubject>
): void {
  const keys = [...subjects.values()].map(({ key }) => key);
  if (new Set(keys).size !== keys.length) {
    throw new Error('Collection transition target contains duplicate keys');
  }
}

function longestIncreasingSuffixLengths(values: readonly number[]): number[] {
  const tree = new FenwickMaximum(values.length);
  const lengths = new Array<number>(values.length);

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const reversedRank = values.length - values[index];
    const length = 1 + tree.query(reversedRank - 1);
    lengths[index] = length;
    tree.update(reversedRank, length);
  }

  return lengths;
}

class FenwickMaximum {
  private readonly values: number[];

  constructor(size: number) {
    this.values = new Array(size + 1).fill(0) as number[];
  }

  update(index: number, value: number): void {
    for (
      let cursor = index;
      cursor < this.values.length;
      cursor += cursor & -cursor
    ) {
      this.values[cursor] = Math.max(this.values[cursor], value);
    }
  }

  query(index: number): number {
    let maximum = 0;
    for (let cursor = index; cursor > 0; cursor -= cursor & -cursor) {
      maximum = Math.max(maximum, this.values[cursor]);
    }
    return maximum;
  }
}

function indexSubjects(subjects: readonly number[]): Map<number, number> {
  return new Map(subjects.map((subject, rank) => [subject, rank]));
}

function assertUniqueSubjects(subjects: readonly number[]): void {
  if (
    subjects.some((subject) => !Number.isSafeInteger(subject) || subject <= 0)
  ) {
    throw new Error('Collection order contains an invalid SubjectId');
  }
  if (new Set(subjects).size !== subjects.length) {
    throw new Error('Collection order contains duplicate SubjectIds');
  }
}

function sameSubjects(
  left: ReadonlySet<number>,
  right: ReadonlyMap<number, CollectionTargetSubject>
): boolean {
  return (
    left.size === right.size && [...left].every((subject) => right.has(subject))
  );
}

function rankAt(
  participant: CollectionOrderParticipant,
  endpoint: 'before' | 'after'
): number | undefined {
  return endpoint === 'before' ? participant.beforeRank : participant.afterRank;
}

function frontierMismatch(): Error {
  return new Error(
    'collection order frontier does not match the transition endpoint'
  );
}
