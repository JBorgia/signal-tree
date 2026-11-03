import type { TerminalRecordPlan } from './intrinsic-mutation';
import { entityPublicationOrdinary, type EntityPublicationPacket, type EntityPublicationEvidence } from './entity-publication';
import type { EntityProjectionSeedEntry } from './entity-projection-seed';
import {
  createEntityTopology,
  type EntityTopology,
  type StructuralEffect,
} from './source-mutation';

/**
 * ONE CONSUMER'S EGRESS-ELIGIBLE VIEW OF AN ENTITY COLLECTION.
 *
 * This holds AUTHORITY — which lifetimes this relationship may publish, in what
 * order, with which rows. It deliberately holds no source knowledge: how a
 * structural effect changes local topology, and where a subject sits relative
 * to others, belong to `source-mutation.ts`, which the serialization consumer
 * will share. Authority is never shared.
 *
 * The division that makes inspection safe:
 *
 *   LOCAL topology (source-mutation)   advanced by EVERY event, inspection
 *                                      included. Current, never historical.
 *   ELIGIBLE authority (here)          advanced only by authored work, plus the
 *                                      minimum adoption an authored operation
 *                                      needs to be representable.
 *
 * TRAVERSE, DON'T PROMOTE. Adopting a subject that only inspection created asks
 * the topology where it sits once non-eligible subjects are projected away.
 * `isEligible` is passed in as the predicate: the topology never learns what
 * authority means.
 *
 * ADOPTION IS SEMANTIC-MINIMUM, NOT ANY-TOUCH. An authored UPDATE of an
 * inspection-created subject adopts it, because the update cannot otherwise be
 * represented. An authored REMOVE of one does not — "still absent" already
 * represents it externally.
 */

type Key = string | number;

/** Undefined evidence cannot authorize adopting a captured whole row. */
export function projectEntityFields(
  previous: unknown,
  row: unknown,
  fields: readonly string[] | null | undefined
): unknown {
  if (fields === null) return row;
  if (!fields?.length || !row || typeof row !== 'object') return previous;
  const next = { ...(previous as Record<string, unknown>) };
  for (const key of fields) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      Object.defineProperty(next, key, {
        value: (row as Record<string, unknown>)[key],
        enumerable: true,
        configurable: true,
        writable: true,
      });
    } else delete next[key];
  }
  return next;
}

export type EntityContributorEdit={readonly key:string;readonly before?:object;readonly after?:object};
export type EntityEgressProjection = {
  support():ReadonlyMap<string,object>;
  prepareSeed(seed:readonly EntityProjectionSeedEntry<Key,unknown>[],evidence:EntityPublicationEvidence):ReturnType<EntityEgressProjection['prepare']>;
  /** Prepare eligible changes without touching the installed relationship. */
  prepare(packet: EntityPublicationPacket, evidence?:EntityPublicationEvidence): {readonly record: TerminalRecordPlan; readonly value: readonly unknown[]; readonly changed: boolean; readonly supportEdits:readonly EntityContributorEdit[]};
  /** The complete eligible `Row[]`, in eligible order. */
  value(): readonly unknown[];
  /** Advance local order; only authored order may advance eligible authority. */
  reorder(
    afterSubjects: readonly number[],
    inspection: boolean,
    ordinary?: boolean,
    evidence?:EntityPublicationEvidence
  ): boolean;
  /** Reposition already eligible lifetimes using final source ordinary facts. */
  relocate(placements: NonNullable<EntityPublicationPacket['ordinaryPlacements']>, evidence?: EntityPublicationEvidence): boolean;
  /** Apply one notification. Returns true if eligible authority advanced. */
  apply(
    subjectId: number | undefined,
    row: unknown,
    effect: StructuralEffect | undefined,
    inspection: boolean,
    fields?: readonly string[] | null,
    ordinary?: boolean,
    evidence?:EntityPublicationEvidence
  ): boolean;
  /** Inbound external truth replaces authority and topology alike. */
  reseed(seed: readonly EntityProjectionSeedEntry<Key, unknown>[]): void;
};

export function createEntityEgressProjection(
  seed: readonly EntityProjectionSeedEntry<Key, unknown>[],
  preparedTopology?: EntityTopology,
  seedEvidence?:EntityPublicationEvidence,
  inheritedSupport?:ReadonlyMap<string,object>
): EntityEgressProjection & {state(): {order:number[];rows:Map<number,unknown>;keys:Map<number,Key>;topology:EntityTopology}} {
  let topology: EntityTopology = preparedTopology ?? createEntityTopology(seed);

  let order: number[] = [];
  const rows = new Map<number, unknown>();
  const keyOf = new Map<number, Key>();

  function load(entries: readonly EntityProjectionSeedEntry<Key, unknown>[]) {
    order = [];
    rows.clear();
    keyOf.clear();
    for (const e of entries) {
      order.push(e.subjectId);
      rows.set(e.subjectId, e.row);
      keyOf.set(e.subjectId, e.key);
    }
  }
  load(seed);
  const contributors=new Map<string,object>(inheritedSupport);
  const slot=(subject:number,dimension:string)=>`${subject}:${dimension}`;
  const setField=(subject:number,key:string,fact:object)=>contributors.set(slot(subject,`f:${key}`),fact);
  const seedSupport=(entries:readonly EntityProjectionSeedEntry<Key,unknown>[],facts:EntityPublicationEvidence)=>{
    const present=new Set(entries.map(entry=>entry.subjectId));
    for(const [subject,fact]of facts.exclusions?.()??[])if(!present.has(subject))contributors.set(slot(subject,'m'),fact);
    for(const entry of entries){
      contributors.set(slot(entry.subjectId,'m'),facts.member(entry.subjectId,'physical'));
      contributors.set(slot(entry.subjectId,'p'),facts.placement(entry.subjectId,'physical'));
      for(const key of Object.keys(entry.row??{}))setField(entry.subjectId,key,facts.field(entry.subjectId,key,'physical'));
    }
  };
  if(!inheritedSupport&&seedEvidence)seedSupport(seed,seedEvidence);
  const removeSupport=(subject:number)=>{for(const key of [...contributors.keys()])if(key.startsWith(`${subject}:`))contributors.delete(key);};
  const editsFrom=(after:ReadonlyMap<string,object>):EntityContributorEdit[]=>{
    const edits:EntityContributorEdit[]=[];
    for(const [key,before]of contributors)if(after.get(key)!==before)edits.push({key,before,after:after.get(key)});
    for(const [key,value]of after)if(!contributors.has(key))edits.push({key,after:value});
    return edits;
  };

  const isEligible = (s: number) => rows.has(s);

  function place(subject: number, effect?: StructuralEffect) {
    if (order.includes(subject)) return;
    if (effect?.kind === 'add') {
      if (
        effect.afterSubject !== undefined &&
        isEligible(effect.afterSubject)
      ) {
        order.splice(order.indexOf(effect.afterSubject), 0, subject);
        return;
      }
      if (
        effect.beforeSubject !== undefined &&
        isEligible(effect.beforeSubject)
      ) {
        order.splice(order.indexOf(effect.beforeSubject) + 1, 0, subject);
        return;
      }
    }
    const at = topology.placement(subject, isEligible);
    if (at === 'end') return void order.push(subject);
    if ('after' in at)
      return void order.splice(order.indexOf(at.after) + 1, 0, subject);
    order.splice(order.indexOf(at.before), 0, subject);
  }

  function remove(subject: number) {
    const i = order.indexOf(subject);
    if (i !== -1) order.splice(i, 1);
    rows.delete(subject);
    keyOf.delete(subject);
  }

  /**
   * An authored add needs its address. If an eligible subject still holds that
   * address but is gone from local topology, its removal was an inspection
   * change this authored operation depends on — promote exactly that. Two live
   * subjects at one address is a collection the library itself refuses.
   */
  function reconcileAddress(key: Key | undefined, incoming: number) {
    if (key === undefined) return;
    for (const [subject, held] of keyOf) {
      if (held !== key || subject === incoming) continue;
      if (!topology.has(subject)) remove(subject);
      return;
    }
  }

  return {
    support:()=>contributors,
    prepareSeed(seed,evidence){
      const prepared=createEntityEgressProjection(seed,undefined,evidence);
      const state=prepared.state(),supportEdits=editsFrom(prepared.support());
      const install={set(_key:unknown,_value:unknown){
        order=state.order;rows.clear();for(const [key,value]of state.rows)rows.set(key,value);
        keyOf.clear();for(const [key,value]of state.keys)keyOf.set(key,value);topology=state.topology;
        contributors.clear();for(const [key,value]of prepared.support())contributors.set(key,value);
      }};
      return {record:{writes:[{map:install,key:undefined,value:undefined}],adds:[]},value:prepared.value(),changed:true,supportEdits};
    },
    prepare(packet,evidence) {
      const structural = packet.physical.some(edit => edit.structural !== undefined) ||
        entityPublicationOrdinary(packet).some(edit => edit.structural !== undefined || !rows.has(edit.subject)) ||
        packet.physicalOrder !== undefined || packet.ordinaryOrder !== undefined || !!packet.ordinaryPlacements?.length;
      if (!structural) {
        // Existing-row point writes prepare only touched rows. Rendering a
        // subscribed collection's complete output is separate, requested work.
        const touched = new Map<number, unknown>();
        let changed = false;
        const supportEdits:EntityContributorEdit[]=[];
        for (const edit of entityPublicationOrdinary(packet)) {
          const before = touched.has(edit.subject) ? touched.get(edit.subject) : rows.get(edit.subject);
          const after = projectEntityFields(before, edit.after, edit.fields);
          if (after !== before) { touched.set(edit.subject, after); changed = true; }
          if(evidence){const facts=evidence.forEdit?.(edit)??evidence;const keys=edit.fields??[...new Set([...Object.keys(before??{}),...Object.keys(after??{})])];
            for(const key of keys){const address=slot(edit.subject,`f:${key}`);supportEdits.push({key:address,before:contributors.get(address),after:facts.field(edit.subject,key,'ordinary')});}
          }
        }
        return {
          record: {writes: [...[...touched].map(([key,value]) => ({map:rows,key,value})),...supportEdits.map(edit=>({map:contributors,key:edit.key,value:edit.after}))], adds: []},
          value: order.map(subject => touched.has(subject) ? touched.get(subject) : rows.get(subject)),
          changed,supportEdits,
        };
      }
      // Structural operations already request placement interpretation. Its
      // private draft retains the relationship's latent inspection topology,
      // rather than reseeding authority from the source's physical rows.
      const draft = createEntityEgressProjection(order.map(subjectId => {const key=keyOf.get(subjectId);if(key===undefined)throw new Error('Topology key missing');return {subjectId,key,row:rows.get(subjectId)};}), topology.fork(),undefined,contributors);
      for (const edit of packet.physical)
        if (edit.structural) draft.apply(edit.subject,edit.after,edit.structural,true,edit.fields);
      if (packet.physicalOrder) draft.reorder(packet.physicalOrder,true);
      let changed = false;
      for (const edit of entityPublicationOrdinary(packet))
        changed = draft.apply(edit.subject,edit.after,edit.structural,false,edit.fields,true,evidence?.forEdit?.(edit)??evidence) || changed;
      if (packet.ordinaryPlacements?.length) changed = draft.relocate(packet.ordinaryPlacements, evidence) || changed;
      if (packet.ordinaryOrder) changed = draft.reorder(packet.ordinaryOrder,false,true,evidence) || changed;
      const prepared = draft.state();
      const install = {set(_key:unknown,_value:unknown) {
        order = prepared.order;
        rows.clear(); for (const [key,value] of prepared.rows) rows.set(key,value);
        keyOf.clear(); for (const [key,value] of prepared.keys) keyOf.set(key,value);
        topology = prepared.topology;
        contributors.clear();for(const [key,value]of draft.support())contributors.set(key,value);
      }};
      return {record:{writes:[{map:install,key:undefined,value:undefined}],adds:[]},value:draft.value(),changed,supportEdits:editsFrom(draft.support())};
    },
    state: () => ({order,rows,keys:keyOf,topology}),
    value: () => order.map((s) => rows.get(s)),

    reorder(afterSubjects, inspection, ordinary = false,evidence) {
      if (!ordinary) topology.reorder(afterSubjects);
      if (inspection) return false;
      const present = new Set(afterSubjects);
      const eligible = afterSubjects.filter(isEligible);
      if(evidence)for(const subject of eligible)contributors.set(slot(subject,'p'),evidence.placement(subject,'ordinary'));
      let cursor = 0;
      let changed = false;
      // Inspection may have removed a still-eligible lifetime. Reordering the
      // live subset does not authorize deleting or adopting any lifetime.
      order = order.map((subject) => {
        if (!present.has(subject)) return subject;
        const next = eligible[cursor++];
        if (next !== subject) changed = true;
        return next;
      });
      return changed;
    },

    relocate(placements, evidence) {
      const moving = new Set(placements.filter(value => isEligible(value.subject)).map(value => value.subject));
      if (!moving.size) return false;
      const before = new Map([...moving].map(subject => [subject, order.indexOf(subject)]));
      for (const subject of moving) {
        const at = order.indexOf(subject);
        if (at >= 0) order.splice(at, 1);
      }
      for (const value of placements) {
        if (!moving.has(value.subject)) continue;
        const after = value.afterSubject === undefined ? -1 : order.indexOf(value.afterSubject);
        const previous = value.beforeSubject === undefined ? -1 : order.indexOf(value.beforeSubject);
        const at = after >= 0 ? after : previous >= 0 ? previous + 1 : order.length;
        order.splice(at, 0, value.subject);
        if (evidence) contributors.set(slot(value.subject, 'p'), evidence.placement(value.subject, 'ordinary'));
      }
      return [...before].some(([subject, index]) => order.indexOf(subject) !== index);
    },

    reseed(entries) {
      topology = createEntityTopology(entries);
      load(entries);
    },

    apply(subjectId, row, effect, inspection, fields, ordinary = false,evidence) {
      // Local topology tracks reality, whoever wrote it.
      if (effect && !ordinary) topology.observe(effect);

      // Inspection stops here. It has said where things now sit; it has not
      // acquired the right to publish anything.
      if (inspection) return false;

      if (effect?.kind === 'add') {
        if(evidence){
          for(const [old,key]of keyOf)if(old!==effect.subject&&key===effect.key&&!topology.has(old)){removeSupport(old);contributors.set(slot(old,'m'),evidence.member(old,'physical'));contributors.set(slot(effect.subject,'k'),evidence.keyMapping(effect.subject,'ordinary'));}
          removeSupport(effect.subject);
          contributors.set(slot(effect.subject,'m'),evidence.member(effect.subject,'ordinary'));
          contributors.set(slot(effect.subject,'p'),evidence.placement(effect.subject,'ordinary'));
          for(const key of Object.keys(effect.value??{}))setField(effect.subject,key,evidence.field(effect.subject,key,'ordinary'));
        }
        reconcileAddress(effect.key, effect.subject);
        place(effect.subject, ordinary ? effect : undefined);
        rows.set(effect.subject, effect.value);
        if (effect.key !== undefined) keyOf.set(effect.subject, effect.key);
        return true;
      }

      if (effect?.kind === 'remove') {
        if (!isEligible(effect.subject)){if(evidence&&contributors.has(slot(effect.subject,'m')))contributors.set(slot(effect.subject,'m'),evidence.member(effect.subject,'ordinary'));return false;}
        removeSupport(effect.subject);if(evidence)contributors.set(slot(effect.subject,'m'),evidence.member(effect.subject,'ordinary'));
        remove(effect.subject);
        return true;
      }

      if (effect?.kind === 'rekey') {
        // Address moves; lifetime, payload and order do not. A collection key
        // is not part of the `Row[]` this relationship publishes.
        if (!isEligible(effect.subject)) return false;
        if(evidence&&contributors.has(slot(effect.subject,'k')))contributors.set(slot(effect.subject,'k'),evidence.keyMapping(effect.subject,'ordinary'));
        if (effect.afterKey !== undefined)
          keyOf.set(effect.subject, effect.afterKey);
        return true;
      }

      if (subjectId === undefined) return false;
      if (isEligible(subjectId)) {
        const previous = rows.get(subjectId);
        const next = projectEntityFields(previous, row, fields);
        if(evidence&&fields!==undefined)for(const key of fields??[...new Set([...Object.keys(previous??{}),...Object.keys(row??{})])])setField(subjectId,key,evidence.field(subjectId,key,'ordinary'));
        if (next === previous) return false;
        rows.set(subjectId, next);
        return true;
      }
      if (fields === undefined) return false;
      if (!isEligible(subjectId)) {
        if (!topology.has(subjectId)) return false;
        const k = topology.keyOf(subjectId);
        if(evidence){
          contributors.set(slot(subjectId,'m'),evidence.member(subjectId,'physical'));
          contributors.set(slot(subjectId,'p'),evidence.placement(subjectId,'physical'));
          contributors.set(slot(subjectId,'k'),evidence.keyMapping(subjectId,'physical'));
          for(const key of Object.keys(row??{}))setField(subjectId,key,evidence.field(subjectId,key,fields===null||fields?.includes(key)?'ordinary':'physical'));
          for(const [old,key]of keyOf)if(old!==subjectId&&key===k&&!topology.has(old)){removeSupport(old);contributors.set(slot(old,'m'),evidence.member(old,'physical'));}
        }
        reconcileAddress(k, subjectId);
        place(subjectId);
        if (k !== undefined) keyOf.set(subjectId, k);
      }
      rows.set(subjectId, row);
      return true;
    },
  };
}
