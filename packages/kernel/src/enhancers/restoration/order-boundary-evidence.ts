import type { CollectionOrderCapture } from '../../lib/internals/mutation-capture-runtime';
import type { StructuralPlacementEvidence } from '../../lib/internals/mutation-capture-runtime';
export type OrderBoundaryEvidence = {
  readonly before: unknown;
  readonly after: unknown;
  readonly records: readonly StructuralPlacementEvidence[];
};

/** Extend explicit order endpoints only through contiguous installed evidence.
 * Enclosing setAll/prepend captures already contain their membership frames:
 * matching frontier identities prevents replaying those frames twice. Admission
 * appends touched facts; the full order is materialized once at bucket drain.
 */
export function completeOrderCapture<
  T extends Omit<CollectionOrderCapture, 'meta'>
>(order: T, evidence: readonly OrderBoundaryEvidence[]): T {
  const byBefore = new Map(evidence.map((item) => [item.before, item]));
  const byAfter = new Map(evidence.map((item) => [item.after, item]));
  const prefix: OrderBoundaryEvidence[] = [];
  const suffix: OrderBoundaryEvidence[] = [];
  let before = order.beforeFrontier;
  let after = order.afterFrontier;
  const seen = new Set<OrderBoundaryEvidence>();
  for (
    let item = byAfter.get(before);
    item && !seen.has(item);
    item = byAfter.get(before)
  ) {
    seen.add(item);
    prefix.push(item);
    before = item.before;
  }
  seen.clear();
  for (
    let item = byBefore.get(after);
    item && !seen.has(item);
    item = byBefore.get(after)
  ) {
    seen.add(item);
    suffix.push(item);
    after = item.after;
  }
  return {
    ...order,
    beforeFrontier: before,
    afterFrontier: after,
    beforeSubjects: extend(order.beforeSubjects, prefix, true),
    afterSubjects: extend(order.afterSubjects, suffix, false),
  };
}

function extend(
  subjects: readonly number[],
  intervals: readonly OrderBoundaryEvidence[],
  inverse: boolean
): number[] {
  // Indexed list keeps N consecutive additions/removals linear, rather than
  // repeatedly copying or searching an expanding array at each admission.
  const nodes = new Map<number, { before?: number; after?: number }>();
  let head: number | undefined = subjects[0];
  subjects.forEach((subject, index) =>
    nodes.set(subject, {
      before: subjects[index - 1],
      after: subjects[index + 1],
    })
  );
  for (const interval of intervals) {
    // A frame records pre-install neighbors, not an ordering of inverse work.
    // Remove departing subjects first, then resolve the insertion dependency
    // graph. Caller order (e.g. removeMany A,C,B) is not placement authority.
    const pending = new Map<
      number,
      Exclude<StructuralPlacementEvidence, { kind: 'rekey' }>
    >();
    for (const record of interval.records) {
      if (record.kind === 'rekey') continue;
      const remove = inverse ? record.kind === 'add' : record.kind === 'remove';
      if (!remove) {
        if (nodes.has(record.subject) || pending.has(record.subject))
          throw new Error('Captured order boundary repeats a subject');
        pending.set(record.subject, record);
        continue;
      }
      const node = nodes.get(record.subject);
      if (!node) throw new Error('Captured order boundary has no subject');
      if (node.before === undefined) head = node.after;
      else nodes.get(node.before)!.after = node.after;
      if (node.after !== undefined) nodes.get(node.after)!.before = node.before;
      nodes.delete(record.subject);
    }
    const waiting = new Map<number, number[]>();
    const ready: number[] = [];
    for (const record of pending.values()) {
      let available = false;
      for (const anchor of [record.afterSubject, record.beforeSubject]) {
        if (anchor === undefined) continue;
        if (nodes.has(anchor)) available = true;
        else {
          let dependents = waiting.get(anchor);
          if (!dependents) waiting.set(anchor, (dependents = []));
          dependents.push(record.subject);
        }
      }
      if (available) ready.push(record.subject);
    }
    if (!nodes.size && pending.size) {
      // The frame can restore an entire chain into an empty collection. A
      // seed is safe only when every named neighbor is in this same frame.
      const seed = [...pending.values()].find((record) =>
        [record.beforeSubject, record.afterSubject].every(
          (anchor) => anchor === undefined || pending.has(anchor)
        )
      );
      if (seed) ready.push(seed.subject);
    }
    for (let index = 0; index < ready.length; index++) {
      const record = pending.get(ready[index]);
      if (!record) continue;
      const successor = record.afterSubject;
      const predecessor = record.beforeSubject;
      const after =
        successor !== undefined && nodes.has(successor)
          ? successor
          : predecessor !== undefined && nodes.has(predecessor)
          ? nodes.get(predecessor)!.after
          : undefined;
      if (
        nodes.size &&
        !(successor !== undefined && nodes.has(successor)) &&
        !(predecessor !== undefined && nodes.has(predecessor))
      )
        continue;
      const before =
        after === undefined
          ? predecessor !== undefined && nodes.has(predecessor)
            ? predecessor
            : undefined
          : nodes.get(after)!.before;
      nodes.set(record.subject, { before, after });
      if (before === undefined) head = record.subject;
      else nodes.get(before)!.after = record.subject;
      if (after !== undefined) nodes.get(after)!.before = record.subject;
      pending.delete(record.subject);
      for (const dependent of waiting.get(record.subject) ?? [])
        ready.push(dependent);
      waiting.delete(record.subject);
    }
    if (pending.size)
      throw new Error('Captured order boundary has no placement anchor');
  }
  const result: number[] = [];
  for (
    let subject = head;
    subject !== undefined;
    subject = nodes.get(subject)!.after
  )
    result.push(subject);
  return result;
}
