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
  // Final adjacency can differ from the anchor requests used to place them.
  // Resolve its replay order too: a later insertion may become an earlier
  // restore's successor, so the original resolution order is not sufficient.
  const final = ordered.map(restore => {
    const row = placement.read(restore.subject);
    if (!row.present) throw new Error('Resolved ordinary restore is absent');
    return { owner: 0, subjectId: restore.subject, subject: restore.subject,
      beforeSubject: row.beforeSubject, afterSubject: row.afterSubject };
  });
  const moving = new Set(final.map(value => value.subject));
  const replay = orderRestoresForPlacement(final, value => value,
    (_restore, subject) => !moving.has(subject) && placement.read(subject).present);
  return Object.freeze(replay.map(value => Object.freeze({ subject: value.subject,
    beforeSubject: value.beforeSubject, afterSubject: value.afterSubject })));
}
