from pathlib import Path
r=Path(__file__).parent/'candidate/packages/kernel/src/lib'
p=r/'internals/causal-runtime/tree-realization-adapter.ts';s=p.read_text();start=s.index('/**\n * Orders a frame\'s restores');end=s.index('\nfunction getStructuralAddEffect',start)
helper=s[start:end];helper=helper.replace('function orderRestoresForPlacement<\n  T extends ReversalEffect & { subjectId: number }','export function orderRestoresForPlacement<\n  T extends { owner: unknown; subjectId: number }')
(r/'physical/order-restores-for-placement.ts').write_text("const rowScope = (owner: unknown, subject: unknown): string =>\n  `${String(owner)}\\u0000${String(subject)}`;\n\n"+helper+'\n')
s=s[:start]+s[end:];s="import { orderRestoresForPlacement } from '../../physical/order-restores-for-placement';\n"+s;p.write_text(s)
(r/'physical/ordinary-restoration-placement.ts').write_text('''import { EntityPlacementStage } from './entity-placement-stage';
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
''')
p=r/'entity-signal.ts';s=p.read_text();s="import { resolveOrdinaryRestorationPlacement, type OrdinaryRestorationPlacement } from './physical/ordinary-restoration-placement';\n"+s
start=s.index('  function prepareOrdinaryRealization(');end=s.index('  function prepareOrdinaryTopology(',start);part=s[start:end]
part=part.replace('    const staged = new Map<number, Presence>();','    const episodes = new Map<number, OrdinaryRestorationPlacement>();\n    const staged = new Map<number, Presence>();')
part=part.replace("      if (context?.kind === 'remove') {\n        placement.remove(subject);","      if (context?.kind === 'remove') {\n        episodes.delete(subject);\n        placement.remove(subject);")
part=part.replace("      } else if (context?.kind === 'add') {\n        const value", "      } else if (context?.kind === 'add') {\n        // Replace the last surviving episode without moving any value operation.\n        episodes.delete(subject);\n        episodes.set(subject, { subject, beforeSubject: context.beforeSubject, afterSubject: context.afterSubject });\n        const value")
part=part.replace('    if (ordinaryOrder) placement.orderDomain(ordinaryOrder);','    const ordinaryPlacements = resolveOrdinaryRestorationPlacement(placement, episodes);\n    if (ordinaryOrder) placement.orderDomain(ordinaryOrder);')
part=part.replace('      undefined,ordinaryEndpoints?.after\n','      undefined,ordinaryEndpoints?.after,false,undefined,undefined,undefined,ordinaryPlacements\n')
s=s[:start]+part+s[end:]
s=s.replace('capture?:import(\'./internals/mutation-capture-runtime\').CommittedEntityCapture) {','capture?:import(\'./internals/mutation-capture-runtime\').CommittedEntityCapture,ordinaryPlacements?:readonly OrdinaryRestorationPlacement[]) {')
s=s.replace('({id,owner:ownerId??-1,meta:ambientMeta(),prepareResponsibility:', '({id,owner:ownerId??-1,ordinaryPlacements,meta:ambientMeta(),prepareResponsibility:')
p.write_text(s)
p=r/'internals/entity-publication.ts';s=p.read_text();s=s.replace('export interface EntityPublicationPacket {','export interface EntityPublicationPacket {\n  /** Final source-owned ordinary adjacency; does not edit values or membership. */\n  readonly ordinaryPlacements?: readonly import(\'../physical/ordinary-restoration-placement\').OrdinaryRestorationPlacement[];');p.write_text(s)
p=r/'internals/entity-egress-projection.ts';s=p.read_text();s=s.replace('  /** Apply one notification.', '''  /** Reposition already eligible lifetimes using final source ordinary facts. */
  relocate(placements: NonNullable<EntityPublicationPacket['ordinaryPlacements']>, evidence?: EntityPublicationEvidence): boolean;
  /** Apply one notification.''')
s=s.replace('packet.physicalOrder !== undefined || packet.ordinaryOrder !== undefined;', 'packet.physicalOrder !== undefined || packet.ordinaryOrder !== undefined || !!packet.ordinaryPlacements?.length;')
s=s.replace('      if (packet.ordinaryOrder) changed = draft.reorder', '      if (packet.ordinaryPlacements?.length) changed = draft.relocate(packet.ordinaryPlacements, evidence) || changed;\n      if (packet.ordinaryOrder) changed = draft.reorder')
s=s.replace('    reseed(entries) {', '''    relocate(placements, evidence) {
      const moving = new Set(placements.filter(value => isEligible(value.subject)).map(value => value.subject));
      if (!moving.size) return false;
      const before = order;
      order = order.filter(subject => !moving.has(subject));
      for (const value of placements) {
        if (!moving.has(value.subject)) continue;
        const after = value.afterSubject === undefined ? -1 : order.indexOf(value.afterSubject);
        const previous = value.beforeSubject === undefined ? -1 : order.indexOf(value.beforeSubject);
        const at = after >= 0 ? after : previous >= 0 ? previous + 1 : order.length;
        order.splice(at, 0, value.subject);
        if (evidence) contributors.set(slot(value.subject, 'p'), evidence.placement(value.subject, 'ordinary'));
      }
      return before.some((subject, index) => subject !== order[index]);
    },

    reseed(entries) {''');p.write_text(s)
