import type {
  ActiveNode,
  PreparedStructuralTarget,
  StructuralTargetSubject,
  SubjectLifetimeRecord,
} from './structural-store';

/** Detached planning; the StructuralStore retains installation authority. */
export function prepareStructuralTarget<K extends string | number>(
  sourceStates: ReadonlyMap<number, Readonly<SubjectLifetimeRecord<K>>>,
  sourceRevisions: ReadonlyMap<number, number>,
  subjects: readonly StructuralTargetSubject<K>[],
  order: readonly number[],
  orderFrontier: unknown
): PreparedStructuralTarget<K> {
  const subjectIds = new Map<K, number>();
  const targetBySubject = new Map<number, StructuralTargetSubject<K>>();
  for (const subject of subjects) {
    if (targetBySubject.has(subject.subjectId) || subjectIds.has(subject.key)) {
      throw new Error('Structural target contains duplicate identity or key');
    }
    const current = sourceStates.get(subject.subjectId);
    if (!current || (!current.active && !current.restoreAllowed)) {
      throw new Error(
        `Subject ${subject.subjectId} cannot enter the structural target`
      );
    }
    targetBySubject.set(subject.subjectId, subject);
    subjectIds.set(subject.key, subject.subjectId);
  }
  if (
    order.length !== targetBySubject.size ||
    new Set(order).size !== order.length ||
    order.some((subjectId) => !targetBySubject.has(subjectId))
  ) {
    throw new Error(
      'Structural target order does not match its active subjects'
    );
  }

  const subjectStates = new Map(sourceStates);
  const subjectRevisions = new Map(sourceRevisions);
  for (const [subjectId, current] of sourceStates) {
    const target = targetBySubject.get(subjectId);
    if (!target) {
      if (current.active) {
        subjectStates.set(subjectId, {
          active: false,
          restoreAllowed: current.restoreAllowed,
        });
        subjectRevisions.set(
          subjectId,
          (sourceRevisions.get(subjectId) ?? 0) + 1
        );
      }
      continue;
    }
    if (!current.active || current.key !== target.key) {
      subjectRevisions.set(
        subjectId,
        (sourceRevisions.get(subjectId) ?? 0) + 1
      );
    }
    subjectStates.set(subjectId, {
      active: true,
      key: target.key,
      restoreAllowed: current.restoreAllowed,
    });
  }

  const activeNodesByKey = new Map<K, ActiveNode<K>>();
  const activeNodesBySubject = new Map<number, ActiveNode<K>>();
  let activeHead: ActiveNode<K> | undefined;
  let activeTail: ActiveNode<K> | undefined;
  for (const subjectId of order) {
    const target = targetBySubject.get(subjectId) as StructuralTargetSubject<K>;
    const node: ActiveNode<K> = {
      key: target.key,
      subjectId,
      prev: activeTail,
      next: undefined,
    };
    if (activeTail) {
      activeTail.next = node;
    } else {
      activeHead = node;
    }
    activeTail = node;
    activeNodesByKey.set(node.key, node);
    activeNodesBySubject.set(node.subjectId, node);
  }

  return {
    subjectIds,
    subjectStates,
    subjectRevisions,
    activeNodesByKey,
    activeNodesBySubject,
    activeHead,
    activeTail,
    activeCount: order.length,
    orderFrontier,
  };
}
