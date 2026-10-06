import type { PositionId, ReversalEffect } from './causal-types';
import { appendAll } from '../utilities/append-all';

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
  /** The turn of each scalar's last write, when the effects carry turns. */
  readonly scalarTurns?: ReadonlyMap<PositionId, number>;
  readonly plainBranchMembers?: ReadonlyMap<
    PositionId,
    PlainBranchMemberTransitionTarget
  >;
};

export type PreparedCollectionTransitionTarget = {
  install(): void;
  publish(): void;
};

export type CollectionTransitionTargetBinding = {
  readonly owner: PositionId;
  readonly ownerPath: string;
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

export type PlainBranchMemberTransitionTarget = {
  readonly present: boolean;
  readonly value: unknown;
  /** `ReversalEffect.turn` of the member's last write. */
  readonly turn?: number;
};

export type PlainBranchMemberTransitionTargetBinding = {
  prepareTarget(
    target: ReadonlyMap<PositionId, PlainBranchMemberTransitionTarget>
  ): PreparedCollectionTransitionTarget & {
    /** Per state location a member value set, the turn that set it. */
    readonly staged?: ReadonlyMap<PositionId, number>;
  };
};

export function prepareDeclarativeTransitionInstallation(
  target: DeclarativeTransitionTarget,
  bindings: ReadonlyMap<PositionId, CollectionTransitionTargetBinding>,
  scalarBinding?: ScalarTransitionTargetBinding,
  memberBinding?: PlainBranchMemberTransitionTargetBinding
): { install(): void } {
  const prepared: PreparedCollectionTransitionTarget[] = [];
  // ⚠️ MEMBERS FIRST, as the per-effect path installs them
  // (`applyAtomically`): a member target carries a whole branch value, and
  // the scalar and collection targets for locations under it are more
  // specific. Installed after them, a re-added member's value overwrote the
  // reversal's own scalar targets: a jump back across an omission and a
  // re-add came back with the omitted turn's values (v16 8g; found by the
  // v15 port review, j5/j2).
  let scalars = target.scalars;
  if (target.plainBranchMembers?.size) {
    if (!memberBinding)
      throw new Error(
        'Declarative transition has member targets but no member binding'
      );
    const members = memberBinding.prepareTarget(target.plainBranchMembers);
    prepared.push(members);
    scalars = withoutSupersededScalars(
      target.scalars,
      target.scalarTurns,
      members.staged
    );
  }
  for (const [owner, collection] of target.collections) {
    const binding = bindings.get(owner);
    if (!binding || binding.owner !== owner) {
      throw new Error(
        `Declarative transition has no collection binding ${owner}`
      );
    }
    prepared.push(binding.prepareTarget(collection));
  }
  if (scalars.size > 0) {
    if (!scalarBinding) {
      throw new Error(
        'Declarative transition has scalar targets but no scalar binding'
      );
    }
    prepared.push(scalarBinding.prepareTarget(scalars));
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

/**
 * ⚠️ A value target that a LATER turn's member write superseded is not a
 * target. Members install first, so a scalar target installed after them wins:
 * right for a value its own turn left there (a turn records one net effect
 * per location, and a member's value can be older than it), wrong for a value
 * an earlier turn left, which the later member write replaced. A jump back
 * past a path re-add came back with the re-added value instead of the one the
 * omission's reversal restores (v16 8g, generated jump-vs-undo histories).
 */
export function withoutSupersededScalars(
  scalars: ReadonlyMap<PositionId, unknown>,
  scalarTurns: ReadonlyMap<PositionId, number> | undefined,
  staged: ReadonlyMap<PositionId, number> | undefined
): ReadonlyMap<PositionId, unknown> {
  if (!scalarTurns?.size || !staged?.size) return scalars;
  let kept: Map<PositionId, unknown> | undefined;
  for (const [owner, turn] of scalarTurns) {
    const stagedTurn = staged.get(owner);
    if (stagedTurn === undefined || stagedTurn <= turn) continue;
    kept ??= new Map(scalars);
    kept.delete(owner);
  }
  return kept ?? scalars;
}

/**
 * A collection whose order this transition cannot reconstruct. Raised before
 * anything is installed, so the caller can refuse with nothing changed. The
 * message stays the underlying failure's; `reason` says it for a reader
 * (v16 8g). v15 15.4.x reconstructs these orders (`6b6badc7`, `7fdcb36d`,
 * `faa9b1f7`, `d33138f6`); the carry list names which shape needs which.
 */
export class CollectionOrderConflict extends Error {
  constructor(
    readonly owner: PositionId,
    readonly reason: string,
    failure: Error
  ) {
    super(failure.message);
    this.name = 'CollectionOrderConflict';
  }
}

const ORDER_FAILURES: ReadonlyArray<readonly [string, string]> = [
  [
    'frontier does not match the transition endpoint',
    'the order change being reversed no longer applies to its current order',
  ],
  [
    'no live placement anchor',
    "a restored row's recorded neighbours are no longer in it",
  ],
  [
    'Collection order does not match active SubjectIds',
    'its reconstructed order and its rows disagree',
  ],
  ['contains an anchor cycle', "its rows' recorded neighbours form a cycle"],
  [
    'contains contradictory anchors',
    "its rows' recorded neighbours contradict each other",
  ],
];

/** Tag a known order failure with its collection; anything else passes. */
function asOrderConflict(owner: PositionId, failure: unknown): unknown {
  if (!(failure instanceof Error) || failure instanceof CollectionOrderConflict)
    return failure;
  const known = ORDER_FAILURES.find(([message]) =>
    failure.message.includes(message)
  );
  return known
    ? new CollectionOrderConflict(owner, known[1], failure)
    : failure;
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
  effects: readonly ReversalEffect[],
  readSource?: (owner: PositionId) => CollectionTransitionSource | undefined
): boolean {
  const structural = effects.filter(
    (effect) => effect.structural !== undefined
  );
  // Occupying effects indexed by owner and key, not a scan per vacating effect:
  // the pairwise search was O(n^2) in a replacement's structural effects.
  // Map keys compare by SameValueZero, so each hit is re-checked with
  // Object.is, the comparison this rule has always used (+0 and -0 differ).
  const occupiedKeyOf = (effect: ReversalEffect): unknown =>
    effect.structural === 'add' || effect.structural === 'rekey'
      ? effect.after
      : undefined;
  const occupying = new Map<PositionId, Map<unknown, number[]>>();
  structural.forEach((effect, index) => {
    const key = occupiedKeyOf(effect);
    if (key === undefined) return;
    let byKey = occupying.get(effect.owner);
    if (!byKey) occupying.set(effect.owner, (byKey = new Map()));
    const indices = byKey.get(key);
    if (indices) indices.push(index);
    else byKey.set(key, [index]);
  });
  const hasKeyHandoff = structural.some((vacating, vacatingIndex) => {
    const vacatedKey =
      vacating.structural === 'remove' || vacating.structural === 'rekey'
        ? vacating.before
        : undefined;
    if (vacatedKey === undefined) {
      return false;
    }
    const candidates = occupying.get(vacating.owner)?.get(vacatedKey);
    return (
      candidates?.some(
        (occupyingIndex) =>
          occupyingIndex !== vacatingIndex &&
          Object.is(vacatedKey, occupiedKeyOf(structural[occupyingIndex]))
      ) ?? false
    );
  });
  if (hasKeyHandoff) {
    return true;
  }

  const additions = structural.filter(
    (effect) =>
      effect.structural === 'add' && typeof effect.subjectId === 'number'
  );
  if (additions.length < 2) {
    const addition = additions[0];
    const context = addition?.structuralContext;
    // Callers can supply current owner-qualified truth. If a singleton's
    // recorded anchors are gone, require the same complete-target proof as
    // multiple restores instead of admitting the physical tail fallback.
    // Surviving anchors retain the existing physical placement behavior.
    if (
      readSource &&
      (context?.kind === 'remove' || context?.kind === 'add') &&
      (context.beforeSubject !== undefined ||
        context.afterSubject !== undefined)
    ) {
      const source = readSource(addition.owner);
      return ![context.beforeSubject, context.afterSubject].some(
        (anchor) => anchor !== undefined && source?.order.includes(anchor)
      );
    }
    return false;
  }
  // ⚠️ PER TURN. Physical placement resolves an addition's anchors as each
  // addition lands, which holds for the additions one turn recorded together.
  // A jump crossing turns concatenates them: an anchor another turn added is
  // not one this placement can rely on, so the complete target decides (a jump
  // forward over a re-add and a `setAll` came back in the wrong order; v16 8g,
  // generated jump-vs-redo histories).
  const addedSubjects = new Map<
    PositionId,
    Map<number | undefined, Set<number>>
  >();
  for (const addition of additions) {
    if (typeof addition.subjectId !== 'number') continue;
    let turns = addedSubjects.get(addition.owner);
    if (!turns) addedSubjects.set(addition.owner, (turns = new Map()));
    let subjects = turns.get(addition.turn);
    if (!subjects) turns.set(addition.turn, (subjects = new Set()));
    subjects.add(addition.subjectId);
  }
  return additions.some((effect) => {
    const context = effect.structuralContext;
    if (context?.kind !== 'add' && context?.kind !== 'remove') {
      return false;
    }
    const subjects = addedSubjects.get(effect.owner)?.get(effect.turn);
    return (
      (context.beforeSubject !== undefined &&
        !subjects?.has(context.beforeSubject)) ||
      (context.afterSubject !== undefined &&
        !subjects?.has(context.afterSubject))
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
    try {
      assertCollectionOrderMatchesSubjects(source.order, subjects);
    } catch (failure) {
      throw asOrderConflict(source.owner, failure);
    }
    collections.set(source.owner, {
      subjects,
      order: [...source.order],
      sourceSubjects: new Set(subjects.keys()),
    });
  }

  const scalars = new Map<PositionId, unknown>();
  const scalarTurns = new Map<PositionId, number>();
  const plainBranchMembers = new Map<
    PositionId,
    PlainBranchMemberTransitionTarget
  >();
  for (const effect of options.effects) {
    if (effect.plainBranchMembership) {
      // ⚠️ LAST-WRITE ORDER. Members are staged in this map's order, and a
      // branch member's value decides the presence of every member under it,
      // so the later staging wins. A Map keeps a key where it was FIRST set:
      // a jump that hid `h` (reversing a later turn), then re-added `g`
      // without it, then re-added `h` staged `h` before `g`, and `g` hid it
      // again (v16 8g, generated jump-vs-undo histories). Re-inserting keeps
      // the sequence the undo chain applies.
      plainBranchMembers.delete(effect.owner);
      plainBranchMembers.set(effect.owner, {
        present: effect.plainBranchMembership.after,
        value: effect.after,
        ...(effect.turn === undefined ? {} : { turn: effect.turn }),
      });
      continue;
    }
    if (effect.structural === undefined) {
      applyValueEffect(collections, scalars, effect);
      if (typeof effect.subjectId !== 'number' && effect.turn !== undefined)
        scalarTurns.set(effect.owner, effect.turn);
      continue;
    }
    try {
      applyStructuralEffect(collections, effect);
    } catch (failure) {
      throw asOrderConflict(effect.owner, failure);
    }
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
    let order: number[];
    try {
      order = delta
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
    } catch (failure) {
      throw asOrderConflict(owner, failure);
    }
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

  return {
    collections: targets,
    scalars,
    ...(scalarTurns.size ? { scalarTurns } : {}),
    ...(plainBranchMembers.size ? { plainBranchMembers } : {}),
  };
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
  if (effects.some((effect) => effect.turn !== undefined))
    return replayStructuralOrderByTurn(sourceOrder, subjects, effects);
  const order = sourceOrder.filter((subject) => subjects.has(subject));
  const additions = effects.filter(
    (effect) =>
      effect.structural === 'add' &&
      typeof effect.subjectId === 'number' &&
      subjects.has(effect.subjectId)
  );
  placeAdditions(order, additions);
  return order;
}

/**
 * ⚠️ A JUMP'S ORDER IS REPLAYED TURN BY TURN. An addition's anchors are its
 * neighbours when its own turn recorded it; across turns they may be added by
 * another turn, or removed by a later one. Each turn removes what it removed
 * and places what it added against the order the earlier turns left, as the
 * undo and redo chain does; the result keeps the target's subjects (v16 8g).
 */
function replayStructuralOrderByTurn(
  sourceOrder: readonly number[],
  subjects: ReadonlyMap<number, CollectionTargetSubject>,
  effects: readonly ReversalEffect[]
): number[] {
  const order = [...sourceOrder];
  const turns = new Map<number | undefined, ReversalEffect[]>();
  for (const effect of effects) {
    if (
      (effect.structural !== 'add' && effect.structural !== 'remove') ||
      typeof effect.subjectId !== 'number'
    )
      continue;
    let turn = turns.get(effect.turn);
    if (!turn) turns.set(effect.turn, (turn = []));
    turn.push(effect);
  }
  for (const turn of turns.values()) {
    for (const effect of turn) {
      const index = order.indexOf(effect.subjectId as number);
      if (index >= 0) order.splice(index, 1);
    }
    placeAdditions(
      order,
      turn.filter((effect) => effect.structural === 'add')
    );
  }
  return order.filter((subject) => subjects.has(subject));
}

/** Place additions by their recorded anchors, mutating `order`. */
function placeAdditions(
  order: number[],
  additions: readonly ReversalEffect[]
): void {
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
        context.afterSubject !== undefined &&
        order.includes(context.afterSubject);
      if (beforeLive || afterLive) {
        return true;
      }
      const hasNoAnchors =
        context.beforeSubject === undefined &&
        context.afterSubject === undefined;
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
      if (order.length === 0) {
        appendAll(order, derivePendingAnchorOrder(pending));
        pending.length = 0;
        continue;
      }
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
      throw new Error(
        'Collection structural target contains contradictory anchors'
      );
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
    throw new Error(
      'Collection structural target has no live placement anchor'
    );
  }
}

function derivePendingAnchorOrder(
  effects: readonly ReversalEffect[]
): number[] {
  const subjects = effects.map((effect) => effect.subjectId as number);
  const subjectSet = new Set(subjects);
  const outgoing = new Map(
    subjects.map((subject) => [subject, new Set<number>()])
  );
  const indegree = new Map(subjects.map((subject) => [subject, 0]));
  const addEdge = (before: number, after: number): void => {
    const edges = outgoing.get(before);
    if (!edges || edges.has(after)) {
      return;
    }
    edges.add(after);
    indegree.set(after, (indegree.get(after) ?? 0) + 1);
  };

  for (const effect of effects) {
    const subject = effect.subjectId as number;
    const context = effect.structuralContext;
    if (context?.kind !== 'add' && context?.kind !== 'remove') {
      continue;
    }
    if (
      context.beforeSubject !== undefined &&
      subjectSet.has(context.beforeSubject)
    ) {
      addEdge(context.beforeSubject, subject);
    }
    if (
      context.afterSubject !== undefined &&
      subjectSet.has(context.afterSubject)
    ) {
      addEdge(subject, context.afterSubject);
    }
  }

  const sourceRank = new Map(
    subjects.map((subject, index) => [subject, index])
  );
  const ready = subjects.filter((subject) => indegree.get(subject) === 0);
  const result: number[] = [];
  while (ready.length > 0) {
    ready.sort(
      (left, right) =>
        (sourceRank.get(left) ?? 0) - (sourceRank.get(right) ?? 0)
    );
    const subject = ready.shift() as number;
    result.push(subject);
    for (const after of outgoing.get(subject) ?? []) {
      const nextIndegree = (indegree.get(after) ?? 0) - 1;
      indegree.set(after, nextIndegree);
      if (nextIndegree === 0) {
        ready.push(after);
      }
    }
  }
  if (result.length !== subjects.length) {
    throw new Error('Collection structural target contains an anchor cycle');
  }
  return result;
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
  const fieldPath =
    effect.subjectFieldSegments ??
    deriveSubjectFieldPath(effect.path, effect.ownerPath);
  collection.subjects.set(effect.subjectId, {
    ...subject,
    value:
      fieldPath.length === 0
        ? effect.after
        : effect.fieldPresence?.after === false
        ? removeValueAtPath(subject.value, fieldPath)
        : setValueAtPath(subject.value, fieldPath, effect.after),
  });
}

/** Drop an absent target field without changing sibling keys. */
function removeValueAtPath(value: unknown, path: readonly string[]): unknown {
  if (path.length === 0 || !isRecord(value)) return value;
  const [head, ...rest] = path;
  if (!Object.prototype.hasOwnProperty.call(value, head)) return value;
  if (rest.length === 0) {
    const { [head]: _removed, ...remaining } = value;
    return remaining;
  }
  return { ...value, [head]: removeValueAtPath(value[head], rest) };
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
