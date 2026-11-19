import { EntityPlacementStage } from './entity-placement-stage';
import { orderRestoresForPlacement } from './order-restores-for-placement';

/** One final surviving add episode; payload execution stays in its original order. */
export interface OrdinaryRestorationPlacement {
  readonly subject: number;
  readonly beforeSubject?: number;
  readonly afterSubject?: number;
}

/** Resolve only affected restores against final ordinary membership, never display. */
export function resolveOrdinaryRestorationPlacement<K>(
  placement: EntityPlacementStage<K>,
  episodes: ReadonlyMap<number, OrdinaryRestorationPlacement>
): readonly OrdinaryRestorationPlacement[] {
  const restores = [...episodes.values()].flatMap(episode => {
    const final = placement.read(episode.subject);
    return final.present ? [{ ...episode, key: final.key, owner: 0, subjectId: episode.subject }] : [];
  });
  if (!restores.length) return [];
  // Provisional inserts must not count as surviving anchors. Keep final keys.
  for (const restore of restores) placement.remove(restore.subject);
  const ordered = orderRestoresForPlacement(restores, value => value,
    (_restore, subject) => placement.read(subject).present);
  for (const restore of ordered)
    placement.insert(restore.subject, restore.key, restore.beforeSubject, restore.afterSubject);
  // Consumers receive final adjacency, in the same dependency resolution order.
  return Object.freeze(ordered.map(restore => {
    const final = placement.read(restore.subject);
    if (!final.present) throw new Error('Resolved ordinary restore is absent');
    return Object.freeze({ subject: restore.subject,
      beforeSubject: final.beforeSubject, afterSubject: final.afterSubject });
  }));
}
