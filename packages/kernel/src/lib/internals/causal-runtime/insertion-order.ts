/**
 * The order in which a reversal re-inserts rows, and where each one goes.
 *
 * Forward collection operations never reorder surviving rows (an order change
 * is recorded separately, as an order delta), so reversing a turn is a replay
 * on the rows present now, INSERTIONS FIRST and deletions last:
 *
 *   undo / rollback  re-insert the rows the turn removed, each beside the
 *                    neighbours it had when it was removed; then delete the
 *                    rows the turn created
 *   redo             insert the rows the turn created, in creation order
 *                    (subject ids are allocated in creation order), each
 *                    beside the neighbours it had when it was created; then
 *                    delete the rows the turn removed
 *
 * Rows still present that the same reversal deletes stay present while the
 * insertions run, so an anchor removed by the same transition still places
 * its neighbour (redo of `prependMany x; removeMany a, e` anchors x to a).
 *
 * Placement: right after the left anchor; at the front when there was no left
 * neighbour; right before the right anchor when only that is present.
 *
 * Restores replay later removals first. Removal anchors come in two shapes:
 *
 *   one at a time   `removeOne(w); removeOne(r)` with w between y and r: w's
 *                   right anchor is r (r was still there), so r goes first
 *   all at once     `clear()` or `removeMany`: each row's anchors are its
 *                   neighbours in the same pre-batch state, so adjacent rows
 *                   name EACH OTHER (r.right is s and s.left is r)
 *
 * Mutually named rows were removed together, so they form a RUN, placed as one
 * block: after the run's outer left anchor, its rows in order. Between runs
 * an anchor always points to a row removed at the same time or later, and a
 * same-time neighbour would be mutual, i.e. the same run; so "a run waits for
 * the runs its outer anchors are in" is acyclic, and any order that respects
 * it re-inserts later removals first. Linear in rows.
 *
 * An anchor that is neither present nor waiting is unresolvable: the row's
 * place is genuinely unknown, so this refuses rather than guess.
 */
export type InsertionAnchors = {
  readonly beforeSubject?: number;
  readonly afterSubject?: number;
};

export type InsertionPlacement =
  | { readonly kind: 'front' }
  | { readonly kind: 'after'; readonly subject: number }
  | { readonly kind: 'before'; readonly subject: number };

export type InsertionInput<T> = {
  readonly item: T;
  readonly subject: number;
  readonly anchors: InsertionAnchors | undefined;
  /** Creation (redo) anchors rather than removal (undo) anchors. */
  readonly creation: boolean;
};

export function unresolvableAnchor(): Error {
  return new Error('Collection structural target has no live placement anchor');
}

/**
 * Orders `inputs` and decides each placement. `isPresent(subject)` answers
 * for rows present before any insertion; a row this call places becomes
 * present for the rows after it. Calls `place` in order.
 */
export function orderInsertions<T>(
  inputs: readonly InsertionInput<T>[],
  isPresent: (subject: number) => boolean,
  place: (input: InsertionInput<T>, placement: InsertionPlacement) => void
): void {
  const placed = new Set<number>();
  const present = (subject: number) =>
    placed.has(subject) || isPresent(subject);
  const placeOne = (input: InsertionInput<T>): void => {
    const { beforeSubject, afterSubject } = input.anchors ?? {};
    let placement: InsertionPlacement;
    if (beforeSubject === undefined) {
      placement =
        input.creation && afterSubject !== undefined && present(afterSubject)
          ? { kind: 'before', subject: afterSubject }
          : { kind: 'front' };
    } else if (present(beforeSubject)) {
      placement = { kind: 'after', subject: beforeSubject };
    } else if (afterSubject !== undefined && present(afterSubject)) {
      placement = { kind: 'before', subject: afterSubject };
    } else {
      throw unresolvableAnchor();
    }
    placed.add(input.subject);
    place(input, placement);
  };

  // Creations: in creation order; their anchors existed when they were made.
  const creations = inputs
    .filter((input) => input.creation)
    .sort((left, right) => left.subject - right.subject);
  const restores = inputs.filter((input) => !input.creation);

  if (restores.length > 0) {
    const waiting = new Map<number, InsertionInput<T>>();
    for (const input of restores) {
      if (!waiting.has(input.subject)) waiting.set(input.subject, input);
    }
    const leftOf = (input: InsertionInput<T>) => input.anchors?.beforeSubject;
    const rightOf = (input: InsertionInput<T>) => input.anchors?.afterSubject;
    const mutualWithLeft = (input: InsertionInput<T>): boolean => {
      const left = leftOf(input);
      const neighbour = left === undefined ? undefined : waiting.get(left);
      return neighbour !== undefined && rightOf(neighbour) === input.subject;
    };
    type Run = {
      readonly rows: InsertionInput<T>[];
      blockers: number;
      readonly dependents: Run[];
    };
    const runs: Run[] = [];
    const runOf = new Map<number, Run>();
    for (const input of waiting.values()) {
      if (mutualWithLeft(input)) continue;
      const run: Run = { rows: [input], blockers: 0, dependents: [] };
      runOf.set(input.subject, run);
      for (let current = input; ; ) {
        const right = rightOf(current);
        const neighbour = right === undefined ? undefined : waiting.get(right);
        if (
          !neighbour ||
          leftOf(neighbour) !== current.subject ||
          runOf.has(neighbour.subject)
        ) {
          break;
        }
        run.rows.push(neighbour);
        runOf.set(neighbour.subject, run);
        current = neighbour;
      }
      runs.push(run);
    }
    if (runOf.size !== waiting.size) {
      // Every row of a mutual cycle names its left neighbour mutually: no run
      // start exists. Contradictory records.
      throw new Error('Collection structural target contains an anchor cycle');
    }
    for (const run of runs) {
      const outer = [
        leftOf(run.rows[0]),
        rightOf(run.rows[run.rows.length - 1]),
      ];
      const blocking = new Set<Run>();
      for (const anchor of outer) {
        const other = anchor === undefined ? undefined : runOf.get(anchor);
        if (other && other !== run) blocking.add(other);
      }
      run.blockers = blocking.size;
      for (const other of blocking) other.dependents.push(run);
    }
    const ready = runs.filter((run) => run.blockers === 0);
    let placedRuns = 0;
    for (let at = 0; at < ready.length; at += 1) {
      const run = ready[at];
      // A run that was at the front (no left neighbour) but had a right one
      // goes in right to left, each row before its right neighbour: placed
      // left to right, its first row's right anchor was not in yet, and the
      // adapter's commit-time placement appended it at the END (`removeMany(
      // [b, a]); clear()` undid to [b, c, d, e, a]). Same result on a list.
      const frontRun =
        run.rows.length > 1 &&
        leftOf(run.rows[0]) === undefined &&
        rightOf(run.rows[run.rows.length - 1]) !== undefined;
      if (frontRun) {
        for (let index = run.rows.length - 1; index >= 0; index -= 1) {
          placeOne(run.rows[index]);
        }
      } else {
        for (const row of run.rows) placeOne(row);
      }
      placedRuns += 1;
      for (const dependent of run.dependents) {
        dependent.blockers -= 1;
        if (dependent.blockers === 0) ready.push(dependent);
      }
    }
    if (placedRuns !== runs.length) {
      throw new Error('Collection structural target contains an anchor cycle');
    }
  }

  for (const input of creations) {
    if (placed.has(input.subject)) continue;
    placeOne(input);
  }
}
