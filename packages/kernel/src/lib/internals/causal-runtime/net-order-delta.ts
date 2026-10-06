import type { PositionId } from './causal-types';
import {
  orderInsertions,
  type InsertionAnchors,
  type InsertionInput,
} from './insertion-order';
import {
  deriveCollectionOrderDelta,
  type CollectionOrderDelta,
} from './target-transition';

/**
 * ONE net order delta per turn and collection, whose endpoints are the turn's
 * own: the order before the turn's first operation on the collection and after
 * its last. A turn that combined an order change (setAll reordering survivors,
 * an overwriting prependMany moving a row) with adds or removes recorded the
 * order change's own endpoints, which were not the turn's, so its reversal
 * refused.
 *
 * Reconstructed from the order captures (in time order) and the turn's net row
 * changes, by the replay `insertion-order.ts` describes:
 *
 *   start  replay BACKWARD from the first capture's before order: re-insert
 *          rows the turn removed before it (removal anchors), delete rows the
 *          turn created before it
 *   end    replay FORWARD from the last capture's after order: insert rows the
 *          turn created after it (creation anchors, creation order), delete
 *          rows the turn removed after it
 *
 * "Before" and "after" a capture are read from membership: a row the turn
 * removed is missing from the capture's before order exactly when it was
 * removed before; a row it created is present exactly when it was created
 * before. Rows the turn created AND removed take part virtually (they can be
 * the recorded neighbour of another row); one that cannot be placed is left
 * out, since it is in neither endpoint.
 *
 * The frontiers come from the turn's first and last order-frontier
 * transitions on the collection, which only a per-operation publication can
 * tell (the capture's own frontiers are right only when no plain add or remove
 * came before the first capture or after the last).
 */
export type TurnOrderCapture = {
  readonly beforeSubjects: readonly number[];
  readonly afterSubjects: readonly number[];
  readonly beforeFrontier: unknown;
  readonly afterFrontier: unknown;
};

export type TurnRowChange = {
  readonly subject: number;
  readonly anchors?: InsertionAnchors;
};

export type TurnTransientRow = {
  readonly subject: number;
  readonly created?: InsertionAnchors;
  readonly removed?: InsertionAnchors;
};

export type TurnRows = {
  /** Created by the turn and present at its end; creation anchors. */
  readonly created: readonly TurnRowChange[];
  /** Present before the turn and removed by it; removal anchors. */
  readonly removed: readonly TurnRowChange[];
  /** Created and removed by the turn. */
  readonly transient: readonly TurnTransientRow[];
};

export function composeTurnOrderDelta(
  owner: PositionId,
  captures: readonly TurnOrderCapture[],
  rows: TurnRows,
  frontiers: { readonly start?: unknown; readonly end?: unknown } = {},
  explicit?: ReadonlySet<number>
): CollectionOrderDelta {
  const { start, end } = composeTurnOrderEndpoints(captures, rows);
  return deriveCollectionOrderDelta(
    owner,
    start,
    end,
    'start' in frontiers ? frontiers.start : captures[0].beforeFrontier,
    'end' in frontiers
      ? frontiers.end
      : captures[captures.length - 1].afterFrontier,
    explicit
  );
}

/** The turn's own start and end orders on the collection (see above). */
export function composeTurnOrderEndpoints(
  captures: readonly TurnOrderCapture[],
  rows: TurnRows
): { start: number[]; end: number[] } {
  if (captures.length === 0) {
    throw new Error('A turn order delta needs at least one order capture');
  }
  const first = captures[0];
  const last = captures[captures.length - 1];
  const firstBefore = new Set(first.beforeSubjects);
  const lastAfter = new Set(last.afterSubjects);
  const transientSubjects = new Set(
    rows.transient.map(({ subject }) => subject)
  );

  const start = replay(
    first.beforeSubjects,
    [
      ...rows.removed
        .filter(({ subject }) => !firstBefore.has(subject))
        .map(({ subject, anchors }) => real(subject, anchors, false)),
      ...rows.transient.map(({ subject, removed }) =>
        virtual(subject, removed, false)
      ),
    ],
    new Set([
      ...rows.created.map(({ subject }) => subject),
      ...transientSubjects,
    ])
  );
  const end = replay(
    last.afterSubjects,
    [
      ...rows.created
        .filter(({ subject }) => !lastAfter.has(subject))
        .map(({ subject, anchors }) => real(subject, anchors, true)),
      ...rows.transient.map(({ subject, created }) =>
        virtual(subject, created, true)
      ),
    ],
    new Set([
      ...rows.removed.map(({ subject }) => subject),
      ...transientSubjects,
    ])
  );
  return { start, end };
}

type Insertion = InsertionInput<boolean>; // item: whether the row is virtual

const real = (
  subject: number,
  anchors: InsertionAnchors | undefined,
  creation: boolean
): Insertion => ({ item: false, subject, anchors, creation });
const virtual = (
  subject: number,
  anchors: InsertionAnchors | undefined,
  creation: boolean
): Insertion => ({ item: true, subject, anchors, creation });

/** Insert, then delete: the target's members in their target order. */
function replay(
  base: readonly number[],
  insertions: readonly Insertion[],
  deleted: ReadonlySet<number>
): number[] {
  const next = new Map<number, number | undefined>();
  const previous = new Map<number, number | undefined>();
  let head: number | undefined;
  let tail: number | undefined;
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
  for (const subject of base) link(subject, tail, undefined);

  // Virtual rows that cannot be placed are left out (they are in neither
  // endpoint); a real row that needed one is then genuinely unresolvable.
  // A virtual row is placeable when it was at the front, or an anchor of it
  // is present, a real row, or placeable itself: rows waiting on an anchor
  // are released when it becomes placeable (linear; a repeated scan to a
  // fixpoint was quadratic in a chain of transient rows, 16k rows in 22 s).
  const present = new Set(base);
  const placeable = new Set<number>();
  const candidates = insertions.filter(({ subject }) => !present.has(subject));
  const realRows = new Set(
    candidates.filter(({ item }) => !item).map(({ subject }) => subject)
  );
  const resolvable = (anchor: number | undefined) =>
    anchor !== undefined &&
    (present.has(anchor) || placeable.has(anchor) || realRows.has(anchor));
  const waitingOn = new Map<number, number[]>();
  const release: number[] = [];
  for (const input of candidates) {
    if (!input.item) continue;
    const { beforeSubject, afterSubject } = input.anchors ?? {};
    if (
      beforeSubject === undefined ||
      resolvable(beforeSubject) ||
      resolvable(afterSubject)
    ) {
      release.push(input.subject);
      continue;
    }
    for (const anchor of [beforeSubject, afterSubject]) {
      if (anchor === undefined) continue;
      const waiting = waitingOn.get(anchor);
      if (waiting) waiting.push(input.subject);
      else waitingOn.set(anchor, [input.subject]);
    }
  }
  while (release.length > 0) {
    const subject = release.pop() as number;
    if (placeable.has(subject)) continue;
    placeable.add(subject);
    const waiting = waitingOn.get(subject);
    if (waiting) {
      waitingOn.delete(subject);
      for (const dependent of waiting) release.push(dependent);
    }
  }
  orderInsertions(
    candidates.filter((input) => !input.item || placeable.has(input.subject)),
    (subject) => next.has(subject),
    (input, placement) => {
      if (placement.kind === 'front') link(input.subject, undefined, head);
      else if (placement.kind === 'after')
        link(input.subject, placement.subject, next.get(placement.subject));
      else
        link(input.subject, previous.get(placement.subject), placement.subject);
    }
  );
  const order: number[] = [];
  for (let at = head; at !== undefined; at = next.get(at)) {
    if (!deleted.has(at)) order.push(at);
  }
  return order;
}
