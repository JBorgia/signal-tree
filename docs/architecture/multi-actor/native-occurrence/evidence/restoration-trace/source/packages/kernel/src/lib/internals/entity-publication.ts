import {trace} from '../restoration-trace';
import type { EntityProjectionSeedEntry } from './entity-projection-seed';
import type { WriteMetadata } from '../mutation-types';
import { combineTerminalRecords, installTerminalRecord, type PreparedPublicationUnit } from './intrinsic-mutation';
import type { StructuralEffect } from './source-mutation';

/** Source facts prepared with installation, never reconstructed from delivery. */
export interface EntityPublicationEdit {
  readonly subject: number;
  readonly before: unknown;
  readonly after: unknown;
  readonly fields: readonly string[] | null;
  readonly structural?: StructuralEffect;
}
export interface EntityPublicationStep {
  readonly ordinal: number;
  readonly authoredRemoval?: EntityPublicationEdit;
  readonly ordinary: readonly EntityPublicationEdit[];
  readonly physical?: readonly EntityPublicationEdit[];
}
/** Preserve authored tombstones even when source ordinary membership was absent. */
export function entityPublicationOrdinary(packet: EntityPublicationPacket): readonly EntityPublicationEdit[] {
  if (!packet.steps) return packet.ordinary;
  return packet.steps.flatMap(step => {
    const removal = step.authoredRemoval;
    return removal && !step.ordinary.some(edit => edit.subject === removal.subject && edit.structural?.kind === 'remove')
      ? [...step.ordinary, removal] : step.ordinary;
  });
}
export interface EntityPublicationPacket {
  readonly owner: number;
  readonly id: object;
  readonly inputs?: readonly object[];
  readonly seed?:readonly EntityProjectionSeedEntry<string|number,unknown>[];
  readonly meta: WriteMetadata | undefined;
  readonly physical: readonly EntityPublicationEdit[];
  readonly ordinary: readonly EntityPublicationEdit[];
  readonly steps?: readonly EntityPublicationStep[];
  readonly physicalOrder?: readonly number[];
  readonly ordinaryOrder?: readonly number[];
}
/** Opaque source-issued support; the reducer transports, never interprets, it. */
export interface EntityPublicationEvidence {
  exclusions?():readonly (readonly [number,object])[];
  member(subject:number, view:'physical'|'ordinary'): object;
  field(subject:number, key:string, view:'physical'|'ordinary'): object;
  placement(subject:number, view:'physical'|'ordinary'): object;
  keyMapping(subject:number, view:'physical'|'ordinary'): object;
  forEdit?(edit:EntityPublicationEdit):EntityPublicationEvidence;
}
export interface EntityPublicationParticipant {
  seedRequested?():boolean;
  prepare(packet: EntityPublicationPacket, native?: object): PreparedPublicationUnit | undefined;
  complete(completion: object): void;
  captureInput?(subject?: number, field?: string): object | undefined;
  retire?(subject: number): void;
  captureViews?(subject?: number,field?: string): readonly object[];
  evidence?():EntityPublicationEvidence;
  inspect?(): Readonly<Record<string,number>>;
}
let factory: ((source: EntityPublicationSource) => EntityPublicationParticipant) | undefined;
export function registerEntityPublicationFactory(value: NonNullable<typeof factory>): void {
  if (factory) throw new Error('Entity publication authority already registered');
  factory = value;
}
/** Native ownership lives with the collection even when there are no recipients. */
export class EntityPublicationSource {
  private native: EntityPublicationParticipant | undefined;
  private readonly recipients = new Set<EntityPublicationParticipant>();
  private recipientRevision = 0;
  private revisionToken:object={};
  revision():object { return this.revisionToken; }
  private nativeParticipant(): EntityPublicationParticipant | undefined {
    return this.native ??= factory?.(this);
  }
  subscribe(participant: EntityPublicationParticipant): () => void {
    this.nativeParticipant();
    this.recipients.add(participant);
    this.recipientRevision++;this.revisionToken={};
    return () => { if(this.recipients.delete(participant)){this.recipientRevision++;this.revisionToken={};} };
  }
  captureInput(subject?: number, field?: string): object | undefined {
    return this.nativeParticipant()?.captureInput?.(subject, field);
  }
  preparePoint(packet:EntityPublicationPacket):PreparedPublicationUnit|undefined {
    if(!pointPreparation)return this.prepare(packet);
    let group=pointPreparation.get(this);
    if(!group){
      const source=this;
      const state:PointPreparation={packets:[],source,unit:undefined,installed:false,finalized:false,completed:false};
      const completion={};pointCompletions.set(completion,()=>{if(!state.completed){state.completed=true;if(state.unit)source.complete(state.unit.completion);}});
      const gate={set(_key:unknown,_value:unknown){if(!state.installed){state.installed=true;if(state.unit)installTerminalRecord(state.unit.record);}}};
      group={state,publication:{record:{writes:[{map:gate,key:undefined,value:undefined}],adds:[]},completion,finalize:()=>{if(!state.finalized){state.finalized=true;state.unit?.finalize?.();}}}};
      pointPreparation.set(this,group);
    }
    group.state.packets.push(packet);return group.publication;
  }
  prepare(packet: EntityPublicationPacket): PreparedPublicationUnit | undefined {
    trace("entityPacket",{physical:packet.physical,ordinary:packet.ordinary,steps:packet.steps,physicalOrder:packet.physicalOrder,ordinaryOrder:packet.ordinaryOrder});
    const recipientRevision = this.recipientRevision,sourceRevision=this.revisionToken;
    const parts: { participant: EntityPublicationParticipant; unit: PreparedPublicationUnit }[] = [];
    const native = this.nativeParticipant();
    const nativeUnit = native?.prepare(packet);
    if (native && nativeUnit) parts.push({ participant: native, unit: nativeUnit });
    for (const participant of [...this.recipients]) {
      const unit = participant.prepare(packet, nativeUnit?.completion);
      if (unit) parts.push({ participant, unit });
    }
    if(sourceRevision!==this.revisionToken&&recipientRevision===this.recipientRevision)throw new Error("Entity publication source changed during preparation");
    if (recipientRevision !== this.recipientRevision) throw new Error('Entity publication recipients changed during preparation');
    if (!parts.length) return undefined;
    return {
      record: combineTerminalRecords(...parts.map(part => part.unit.record),{writes:[{map:{set:(_key:unknown,value:unknown)=>{this.revisionToken=value as object;}},key:undefined,value:{}}],adds:[]})!,
      completion: { parts },
      finalize: () => { for (const part of parts) part.unit.finalize?.(); },
    };
  }
  requestsSeed():boolean { return [...this.recipients].some(participant=>participant.seedRequested?.()); }
  evidence():EntityPublicationEvidence|undefined { return this.nativeParticipant()?.evidence?.(); }
  captureViews(subject?:number,field?:string): readonly object[] { return this.nativeParticipant()?.captureViews?.(subject,field)??[]; }
  inspect(): Readonly<Record<string,number>> { return {...(this.native?.inspect?.()??{}),recipients:this.recipients.size,native:this.native?1:0}; }
  retire(subject: number): void { this.native?.retire?.(subject); }
  complete(completion: object): void {
    const point=pointCompletions.get(completion);if(point){point();return;}
    const { parts } = completion as { parts: readonly {participant: EntityPublicationParticipant; unit: PreparedPublicationUnit}[] };
    let failed = false;
    let first: unknown;
    for (const part of parts) {
      try { part.participant.complete(part.unit.completion); }
      catch (error) { if (!failed) { failed = true; first = error; } }
    }
    if (failed) throw first;
  }
}
const ENTITY_PUBLICATION = Symbol('signaltree.entityPublication');
const anchors = new WeakMap<EntityPublicationSource, object>();
export function getEntityPublicationAnchor(source: EntityPublicationSource): object | undefined { return anchors.get(source); }
export interface EntityPublicationBinding {
  readonly source: EntityPublicationSource;
  readonly subject?: number;
  readonly field?: string;
}
export function defineEntityPublicationBinding(node: object, binding: EntityPublicationBinding): void {
  Object.defineProperty(node, ENTITY_PUBLICATION, { value: binding });
  if (binding.subject === undefined && binding.field === undefined) anchors.set(binding.source, node);
}
export function getEntityPublicationBinding(node: unknown): EntityPublicationBinding | undefined {
  return node !== null && (typeof node === 'object' || typeof node === 'function')
    ? (node as Record<symbol, EntityPublicationBinding | undefined>)[ENTITY_PUBLICATION]
    : undefined;
}

const inputScopes: object[] = [];
export function withEntityPublicationInput<T>(source: EntityPublicationSource, subject: number | undefined, field: string | undefined, body: () => T): T {
  const input = source.captureInput(subject,field);
  if (input) inputScopes.push(input);
  try { return body(); } finally { if (input) inputScopes.pop(); }
}
export function currentEntityPublicationInputs(): readonly object[] { return inputScopes; }
const INSTALLED_UNIT = Symbol('entity-installed-publication');
export function withEntityPublicationUnit(meta: WriteMetadata | undefined, id: object): WriteMetadata {
  const result: WriteMetadata & {[INSTALLED_UNIT]:object} = {...meta,[INSTALLED_UNIT]:id};
  return result;
}
export function entityPublicationUnit(meta: WriteMetadata | undefined): object | undefined {
  return (meta as (WriteMetadata & {[INSTALLED_UNIT]?:object}) | undefined)?.[INSTALLED_UNIT];
}

export function withEntityBoundPublicationInput<T>(node: object, body: () => T): T {
  const binding=getEntityPublicationBinding(node);
  return binding?withEntityPublicationInput(binding.source,binding.subject,binding.field,body):body();
}

const preparedChanges = new WeakMap<object,object>();
export function markEntityPublicationFacts(facts: object, unit: object): void { preparedChanges.set(facts,unit); }
export function entityPublicationFactsUnit(facts: object): object | undefined { return preparedChanges.get(facts); }

interface PointPreparation {packets:EntityPublicationPacket[];source:EntityPublicationSource;unit:PreparedPublicationUnit|undefined;installed:boolean;finalized:boolean;completed:boolean}
interface PointGroup {state:PointPreparation;publication:PreparedPublicationUnit}
let pointPreparation:Map<EntityPublicationSource,PointGroup>|undefined;
const pointCompletions=new WeakMap<object,()=>void>();
/** Preserve per-lifetime native plans while preparing their one collection unit. */
export function withEntityPointPublicationPreparation<T>(body:()=>T):T {
  const previous=pointPreparation,groups=new Map<EntityPublicationSource,PointGroup>();
  pointPreparation=groups;let result:T;
  try{result=body();}finally{pointPreparation=previous;}
  for(const {state}of groups.values()){
    const first=state.packets[0]!;
    state.unit=state.source.prepare({...first,physical:state.packets.flatMap(packet=>packet.physical),ordinary:state.packets.flatMap(packet=>packet.ordinary),steps:state.packets.flatMap(packet=>packet.steps??packet.ordinary.map((edit,ordinal)=>({ordinal,ordinary:[edit]})))});
    state.packets=[];
  }
  return result;
}
