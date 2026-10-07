import type { PositionId, ReversalEffect } from './causal-types';
import { orderInsertions, type InsertionInput } from './insertion-order';

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
  readonly plainBranchMembers?: ReadonlyMap<
    PositionId,
    PlainBranchMemberTransitionTarget
  >;
};

export type PreparedCollectionTransitionTarget = {
  install(): void;
  /** Invalidate installed views before any target callbacks; the caller groups delivery. */
  preparePublication?(): void;
  publish(): void;
};

export type CollectionTransitionTargetBinding = {
  readonly owner: PositionId;
  readonly ownerPath: string;
  readSource(): CollectionTransitionSource;
  /**
   * The collection's order frontier, read without walking the rows; with a
   * token, installs it first. A reversal that restores exactly the order a
   * recorded token identified reinstates that token.
   */
  orderFrontier?(token?: object): unknown;
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
};

export type PlainBranchMemberTransitionTargetBinding = {
  prepareTarget(
    target: ReadonlyMap<PositionId, PlainBranchMemberTransitionTarget>
  ): PreparedCollectionTransitionTarget;
};
export function prepareDeclarativeTransitionInstallation(
  target: DeclarativeTransitionTarget,
  bindings: ReadonlyMap<PositionId, CollectionTransitionTargetBinding>,
  scalarBinding?: ScalarTransitionTargetBinding,
  memberBinding?: PlainBranchMemberTransitionTargetBinding
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
  // Members before scalars, as `applyAtomically` installs them, so a value
  // write lands on its member's image rather than under it: installed after
  // the scalars, `g`'s earlier image overwrote a jump's `h.y: 10` with 0 (v15
  // port review, item 1). A write an earlier turn of the same reversal made
  // below a member a later turn sets is dropped before this
  // (`supersedeAcrossTurns` in restoration).
  if (target.plainBranchMembers?.size) {
    if (!memberBinding) {
      throw new Error(
        'Declarative transition has member targets but no member binding'
      );
    }
    prepared.push(memberBinding.prepareTarget(target.plainBranchMembers));
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
        collection.preparePublication?.();
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
  /** Rows held out of each collection's order while it reverses. */
  readonly held?: ReadonlyMap<PositionId, readonly HeldRow[]>;
  /**
   * Never refuse on order: an order delta that does not fit keeps the rows'
   * order, and a row with no live anchor goes last. Only for reads that must
   * not throw (the history walk's states are then approximate in order);
   * a reversal refuses instead.
   */
  readonly lenient?: boolean;
  /**
   * Order-frontier tokens to reinstate on collections this transition
   * reverses without an order delta (invariant 3 in
   * causal-runtime-contract.md): where the source is still at `from`, the
   * target order is exactly the one `to` identified, so it gets `to` back
   * rather than a fresh token. Owners named here are targets even with no
   * effect of their own.
   */
  readonly frontierSteps?: readonly FrontierStep[];
};

/**
 * A reversal's order-frontier move on one collection: from the token the
 * reversed turns left to the one they started from (`to` undefined: they do
 * not chain, so nothing is reinstated).
 */
export type FrontierStep = {
  readonly owner: number;
  readonly from: unknown;
  to: unknown;
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
  /**
   * The turn's order on this collection could not be composed (contradictory
   * records): the change is kept with its frontiers, and reversing it
   * refuses rather than guess (`unrecordedOrderDelta`).
   */
  readonly unrecorded?: true;
};

/**
 * A row the reversed records never knew: a rejected transaction removed it
 * before they were recorded, and the rollback put it back. While they
 * reverse, it is held out of the order (their effects and deltas apply
 * exactly as recorded) and put back next to the rows it was attached to
 * when the rollback restored it: after `left`, else before `right`, else
 * at the front when it had no left neighbour, else at the end. A function
 * of the other rows' order, so undo, redo and jumpTo round-trip exactly.
 */
export type HeldRow = {
  readonly subject: number;
  readonly left?: number;
  readonly right?: number;
};

/** An order change whose orders are unknown: it refuses to reverse. */
export function unrecordedOrderDelta(
  owner: PositionId,
  beforeFrontier: unknown,
  afterFrontier: unknown
): CollectionOrderDelta {
  return {
    owner,
    beforeLength: 0,
    afterLength: 0,
    beforeFrontier,
    afterFrontier,
    participants: [],
    unrecorded: true,
  };
}

export function unrecordedOrderChange(owner?: PositionId): Error {
  const error = new Error(
    'collection order change was not recorded, so it cannot be reversed'
  );
  if (owner !== undefined) {
    orderRefusals.set(error, { owner, kind: 'unrecorded' });
  }
  return error;
}

export function requiresDeclarativeStructuralTarget(
  effects: readonly ReversalEffect[]
): boolean {
  const structural = effects.filter(
    (effect) => effect.structural !== undefined
  );
  // Occupying effects indexed by owner and key, not a scan per vacating effect:
  // the pairwise search was O(n^2), ~1.7 s of an 8k-row replacement's undo.
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
    return false;
  }
  // Neighbours are subjects of the SAME collection; lifetimes repeat across
  // collections, so a bare lifetime set would treat another collection's
  // addition as this one's neighbour.
  //
  // ⚠️ AND OF THE SAME TURN. Physical placement resolves an addition's
  // anchors as each addition lands, which holds for the additions one turn
  // recorded together. A jump crossing turns concatenates them: an anchor
  // another turn added is not one this placement can rely on, so the
  // complete target decides (a jump forward over a re-add and a `setAll`
  // came back `d,e,a,b` for `a,b,d,e`; v16 8g, cause 5).
  //
  // ⚠️ AND ADDED BEFORE IT. Each addition lands in sequence, so an anchor
  // the sequence adds later is not there yet: redo of `addOne(e);
  // setAll([b, c, d, e])` on an empty collection placed b and c, anchored on
  // c and d, behind e and gave `d,e,b,c` (15.4.3 and since; found by the
  // jump fuzz's multi-write turns).
  const addedSubjects = new Map<string, Map<unknown, number>>();
  const turnOf = (effect: ReversalEffect) => `${effect.owner}:${effect.turn}`;
  additions.forEach((effect, at) => {
    let subjects = addedSubjects.get(turnOf(effect));
    if (!subjects) addedSubjects.set(turnOf(effect), (subjects = new Map()));
    subjects.set(effect.subjectId, at);
  });
  return additions.some((effect, at) => {
    const context = effect.structuralContext;
    if (context?.kind !== 'add' && context?.kind !== 'remove') {
      return false;
    }
    const added = addedSubjects.get(turnOf(effect));
    const placed = (anchor: number | undefined) =>
      anchor === undefined || (added?.get(anchor) ?? at) < at;
    return !placed(context.beforeSubject) || !placed(context.afterSubject);
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
      held: readonly HeldRow[];
    }
  >();
  const frontierSteps = new Map(
    (options.frontierSteps ?? []).map((step) => [step.owner, step])
  );
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
    const held = (options.held?.get(source.owner) ?? []).filter(({ subject }) =>
      subjects.has(subject)
    );
    const heldSubjects = new Set(held.map(({ subject }) => subject));
    collections.set(source.owner, {
      subjects,
      order: source.order.filter((subject) => !heldSubjects.has(subject)),
      sourceSubjects: new Set(subjects.keys()),
      held,
    });
  }

  const scalars = new Map<PositionId, unknown>();
  const plainBranchMembers = new Map<
    PositionId,
    PlainBranchMemberTransitionTarget
  >();
  // Insertions first, deletions last (insertion-order.ts): a row this
  // transition both inserts and deletes (a ghost) is inserted before it is
  // deleted whatever order the caller listed them in.
  const deletions: ReversalEffect[] = [];
  // Lenient (a read): an effect the source contradicts (its row is not where
  // the record says, or not there) is skipped rather than refused.
  const tolerant = (apply: () => void): void => {
    if (!options.lenient) return apply();
    try {
      apply();
    } catch {
      /* contradicted by the source: skipped in a read */
    }
  };
  for (const effect of options.effects) {
    if (effect.plainBranchMembership) {
      plainBranchMembers.set(effect.owner, {
        present: effect.plainBranchMembership.after,
        value: effect.after,
      });
      continue;
    }
    if (effect.structural === undefined) {
      tolerant(() => applyValueEffect(collections, scalars, effect));
      continue;
    }
    if (effect.structural === 'remove') {
      deletions.push(effect);
      continue;
    }
    tolerant(() => applyStructuralEffect(collections, effect));
  }
  for (const effect of deletions) {
    tolerant(() => applyStructuralEffect(collections, effect));
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
    const sourceFrontier = options.collections.find(
      (source) => source.owner === owner
    )?.orderFrontier;
    const step = frontierSteps.get(owner);
    const orderEndpoint =
      options.orderEndpoints?.get(owner) ?? options.orderEndpoint ?? 'after';
    const structural = () =>
      deriveStructuralTargetOrder(
        collection.order,
        withoutHeld(collection.subjects, collection.held),
        options.effects.filter((effect) => effect.owner === owner),
        options.lenient
      );
    let applied = delta;
    let derived: number[];
    if (!delta) derived = structural();
    else {
      try {
        derived = applyCollectionOrderDelta(
          collection.order,
          delta,
          orderEndpoint,
          sourceFrontier
        );
      } catch (error) {
        if (!options.lenient) throw error;
        applied = undefined;
        derived = structural();
      }
    }
    let order = withHeldRows(derived, collection.held);
    if (options.lenient) {
      // Rows the order lost or gained by a skipped effect: the subjects
      // decide, in the order's sequence, the rest last.
      const listed = new Set(order);
      order = [
        ...order.filter((subject) => collection.subjects.has(subject)),
        ...[...collection.subjects.keys()].filter(
          (subject) => !listed.has(subject)
        ),
      ];
    } else {
      assertCollectionOrderMatchesSubjects(order, collection.subjects);
      assertUniqueTargetKeys(collection.subjects);
    }
    targets.set(owner, {
      owner,
      subjects: [...collection.subjects.values()].sort(
        (left, right) => left.subject - right.subject
      ),
      order,
      orderFrontier: applied
        ? orderEndpoint === 'before'
          ? applied.beforeFrontier
          : applied.afterFrontier
        : delta
        ? {}
        : step?.to !== undefined && sourceFrontier === step.from
        ? step.to
        : sourceFrontier === undefined ||
          sameSubjects(collection.sourceSubjects, collection.subjects)
        ? sourceFrontier
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
    ...(plainBranchMembers.size ? { plainBranchMembers } : {}),
  };
}

function withoutHeld(
  subjects: ReadonlyMap<number, CollectionTargetSubject>,
  held: readonly HeldRow[]
): ReadonlyMap<number, CollectionTargetSubject> {
  if (held.length === 0) return subjects;
  const kept = new Map(subjects);
  for (const { subject } of held) kept.delete(subject);
  return kept;
}

/** `order` with the held rows put back by their attachments (see HeldRow). */
function withHeldRows(order: number[], held: readonly HeldRow[]): number[] {
  if (held.length === 0) return order;
  const result = [...order];
  for (const row of held) {
    const left = row.left === undefined ? -1 : result.indexOf(row.left);
    const right = row.right === undefined ? -1 : result.indexOf(row.right);
    const at =
      left >= 0
        ? left + 1
        : right >= 0
        ? right
        : row.left === undefined
        ? 0
        : result.length;
    result.splice(at, 0, row.subject);
  }
  return result;
}

/**
 * `explicit`: rows that must be participants (ranks recorded at both ends)
 * rather than left implicit in the backbone, so a later rebase can remove them
 * exactly (`withoutDeltaSubjects`): rows a still-pending transaction created,
 * which its rejection takes away.
 */
export function deriveCollectionOrderDelta(
  owner: PositionId,
  before: readonly number[],
  after: readonly number[],
  beforeFrontier: unknown,
  afterFrontier: unknown,
  explicit?: ReadonlySet<number>
): CollectionOrderDelta {
  assertUniqueSubjects(before);
  assertUniqueSubjects(after);

  const beforeRank = indexSubjects(before);
  const afterRank = indexSubjects(after);
  const common = (subject: number, other: Map<number, number>) =>
    other.has(subject) && !explicit?.has(subject);
  const commonBefore = before.filter((subject) => common(subject, afterRank));
  const commonAfter = after.filter((subject) => common(subject, beforeRank));
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

/**
 * The delta with `drop`ped rows taken out of both ends, as if they had never
 * existed: their ranks go, later ranks shift down, lengths shrink;
 * `undefined` when nothing is left to reorder. Only participants can be
 * dropped exactly (a backbone row's position is implicit), so rows that may
 * be dropped must be derived `explicit`.
 */
export function withoutDeltaSubjects(
  delta: CollectionOrderDelta,
  drop: (subject: number) => boolean
): CollectionOrderDelta | undefined {
  const dropped = delta.participants.filter(({ subject }) => drop(subject));
  if (dropped.length === 0) return delta;
  const removedBefore = dropped
    .map(({ beforeRank }) => beforeRank)
    .filter((rank): rank is number => rank !== undefined)
    .sort((left, right) => left - right);
  const removedAfter = dropped
    .map(({ afterRank }) => afterRank)
    .filter((rank): rank is number => rank !== undefined)
    .sort((left, right) => left - right);
  const shift = (rank: number | undefined, removed: readonly number[]) => {
    if (rank === undefined) return undefined;
    let below = 0;
    while (below < removed.length && removed[below] < rank) below += 1;
    return rank - below;
  };
  const participants = delta.participants
    .filter(({ subject }) => !drop(subject))
    .map((participant) => ({
      subject: participant.subject,
      ...(participant.beforeRank === undefined
        ? {}
        : { beforeRank: shift(participant.beforeRank, removedBefore) }),
      ...(participant.afterRank === undefined
        ? {}
        : { afterRank: shift(participant.afterRank, removedAfter) }),
    }));
  const beforeLength = delta.beforeLength - removedBefore.length;
  const afterLength = delta.afterLength - removedAfter.length;
  if (participants.length === 0 && beforeLength === afterLength) {
    return undefined;
  }
  return { ...delta, beforeLength, afterLength, participants };
}

export function applyCollectionOrderDelta(
  current: readonly number[],
  delta: CollectionOrderDelta,
  endpoint: 'before' | 'after',
  currentFrontier: unknown
): number[] {
  if (delta.unrecorded) throw unrecordedOrderChange(delta.owner);
  assertUniqueSubjects(current);

  const sourceEndpoint = endpoint === 'before' ? 'after' : 'before';
  const sourceLength =
    sourceEndpoint === 'before' ? delta.beforeLength : delta.afterLength;
  const sourceFrontier =
    sourceEndpoint === 'before' ? delta.beforeFrontier : delta.afterFrontier;
  if (current.length !== sourceLength || currentFrontier !== sourceFrontier) {
    throw frontierMismatch(delta.owner);
  }

  const currentRank = indexSubjects(current);
  for (const participant of delta.participants) {
    const expectedRank = rankAt(participant, sourceEndpoint);
    if (
      (expectedRank === undefined && currentRank.has(participant.subject)) ||
      (expectedRank !== undefined &&
        current[expectedRank] !== participant.subject)
    ) {
      throw frontierMismatch(delta.owner);
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
      throw frontierMismatch(delta.owner);
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
      throw frontierMismatch(delta.owner);
    }
    target[rank] = subject;
    backboneIndex += 1;
  }

  if (backboneIndex !== backbone.length) {
    throw frontierMismatch(delta.owner);
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

/**
 * The collection's target order: the replay `orderInsertions` describes, on a
 * linked list of the source order (every row present now, including rows this
 * transition deletes), keeping only the target's members at the end. Rows the
 * transition both inserts and deletes (a row a turn created and removed,
 * recorded so its neighbours can be placed) take part virtually. Linear in
 * rows plus effects: the array scan it replaced was quadratic (redo of a
 * 40k-row addMany took 40 s).
 */
function deriveStructuralTargetOrder(
  sourceOrder: readonly number[],
  subjects: ReadonlyMap<number, CollectionTargetSubject>,
  effects: readonly ReversalEffect[],
  lenient = false
): number[] {
  const next = new Map<number, number | undefined>();
  const previous = new Map<number, number | undefined>();
  let head: number | undefined;
  let tail: number | undefined;
  for (const subject of sourceOrder) {
    previous.set(subject, tail);
    next.set(subject, undefined);
    if (tail === undefined) head = subject;
    else next.set(tail, subject);
    tail = subject;
  }
  const link = (
    subject: number,
    before: number | undefined,
    after: number | undefined
  ): void => {
    previous.set(subject, before);
    next.set(subject, after);
    if (before === undefined) head = subject;
    else next.set(before, subject);
    if (after === undefined) tail = subject;
    else previous.set(after, subject);
  };

  const inputs: InsertionInput<number>[] = [];
  const seen = new Set<number>();
  for (const effect of effects) {
    if (effect.structural !== 'add' || typeof effect.subjectId !== 'number') {
      continue;
    }
    const subject = effect.subjectId;
    if (seen.has(subject) || next.has(subject)) continue;
    seen.add(subject);
    const context = effect.structuralContext;
    inputs.push({
      item: subject,
      subject,
      anchors:
        context?.kind === 'add' || context?.kind === 'remove'
          ? {
              beforeSubject: context.beforeSubject,
              afterSubject: context.afterSubject,
            }
          : undefined,
      creation: context?.kind !== 'remove',
    });
  }
  orderInsertions(
    inputs,
    (subject) => next.has(subject),
    (input, placement) => {
      switch (placement.kind) {
        case 'front':
          link(input.subject, undefined, head);
          return;
        case 'after':
          link(input.subject, placement.subject, next.get(placement.subject));
          return;
        case 'before':
          link(
            input.subject,
            previous.get(placement.subject),
            placement.subject
          );
          return;
        case 'end':
          link(input.subject, tail, undefined);
          return;
      }
    },
    lenient
  );

  const order: number[] = [];
  for (let at = head; at !== undefined; at = next.get(at)) {
    if (subjects.has(at)) order.push(at);
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
  const fieldPath =
    effect.fieldSegments ??
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

/** Absent at the target endpoint: drop the key instead of storing undefined. */
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

/**
 * The collection an order delta refused on, and why: a reversal reports it
 * legibly (restoration's ST1034).
 */
const orderRefusals = new WeakMap<
  Error,
  { owner: PositionId; kind: 'mismatch' | 'unrecorded' }
>();
export function orderRefusalOf(
  error: unknown
): { owner: PositionId; kind: 'mismatch' | 'unrecorded' } | undefined {
  return error instanceof Error ? orderRefusals.get(error) : undefined;
}

function frontierMismatch(owner?: PositionId): Error {
  const error = new Error(
    'collection order frontier does not match the transition endpoint'
  );
  if (owner !== undefined) {
    orderRefusals.set(error, { owner, kind: 'mismatch' });
  }
  return error;
}
