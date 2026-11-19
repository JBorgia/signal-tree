import type { EntityProjectionSeedEntry } from './entity-projection-seed';
import type { WriteMetadata } from '../mutation-types';
import { combineTerminalRecords, installTerminalRecord, type PreparedPublicationUnit } from './intrinsic-mutation';
import type { StructuralEffect } from './source-mutation';

/** Source facts prepared with installation, never reconstructed from delivery. */
export interface EntityPublicationEdit {
  readonly restoredFields?: ReadonlyMap<string,import('./native-field-selection').NativeFieldEndpoint>;
  readonly subject: number;
  readonly before: unknown;
  readonly after: unknown;
  readonly fields: readonly string[] | null;
  readonly structural?: StructuralEffect;
}
/** Source declaration only: never a certificate of native effect ownership. */
export type EntityAuthoredFootprint =
  | {readonly kind:'whole' | 'derive' | 'realization'}
  | {readonly kind:'fields';readonly fields:readonly string[]};
export interface EntityPublicationStep {
  readonly authoredFootprint?: EntityAuthoredFootprint;
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
  /** Final source-owned ordinary adjacency; does not edit values or membership. */
  readonly ordinaryPlacements?: readonly import('../physical/ordinary-restoration-placement').OrdinaryRestorationPlacement[];
  readonly prepareResponsibility?: (fields?:import('./native-field-selection').NativeFieldSelections)=>import('./intrinsic-mutation').TerminalRecordPlan|undefined;
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
/** Private ownership boundary: metadata is source-owned, row payloads and proof
 * objects are not. Weak marks avoid reprocessing queued point fragments; they
 * contain no values, certificates or revision authority and do not retain keys.
 */
class AdmissionMetadata {
  private readonly edits = new WeakSet<EntityPublicationEdit>();
  private readonly arrays = new WeakSet<readonly EntityPublicationEdit[]>();
  private readonly packets = new WeakSet<EntityPublicationPacket>();
  private edit(edit: EntityPublicationEdit): void {
    if (this.edits.has(edit)) return;
    // Native producers supply mutable shells. Copy shared metadata before locking
    // that same edit identity. A frozen shell cannot transfer ownership of
    // borrowed mutable metadata: require stability without mutating those aliases.
    if (!Object.isFrozen(edit)) {
      if (edit.fields && !Object.isFrozen(edit.fields)) Object.defineProperty(edit,'fields',{value:Object.freeze([...edit.fields]),enumerable:true});
      if (edit.structural) Object.defineProperty(edit,'structural',{value:Object.freeze({...edit.structural}),enumerable:true});
    } else {
      if (edit.fields && !Object.isFrozen(edit.fields) ||
          edit.structural && !Object.isFrozen(edit.structural))
        throw new Error('Frozen entity publication edit contains mutable admission metadata');
    }
    Object.freeze(edit);
    this.edits.add(edit);
  }
  private array(edits: readonly EntityPublicationEdit[]): readonly EntityPublicationEdit[] {
    if (this.arrays.has(edits)) return edits;
    for (const edit of edits) this.edit(edit);
    // These arrays are private source-issued membership, never user row payloads.
    // Transfer their ownership once instead of duplicating every admitted list.
    const result=Object.freeze(edits);
    this.arrays.add(result);
    return result;
  }
  prepare(packet:EntityPublicationPacket):EntityPublicationPacket {
    if(this.packets.has(packet))return packet;
    const steps=packet.steps?.map(step=>{
      if(step.authoredRemoval)this.edit(step.authoredRemoval);
      const footprint=step.authoredFootprint;
      return Object.freeze({...step,
        authoredFootprint:footprint?Object.freeze(footprint.kind==='fields'?{...footprint,fields:Object.freeze([...footprint.fields])}:{...footprint}):undefined,
        ordinary:this.array(step.ordinary),physical:step.physical?this.array(step.physical):undefined});
    });
    const result=Object.freeze({...packet,ordinary:this.array(packet.ordinary),physical:this.array(packet.physical),
      steps:steps?Object.freeze(steps):undefined,
      ordinaryOrder:packet.ordinaryOrder?Object.freeze([...packet.ordinaryOrder]):undefined,
      physicalOrder:packet.physicalOrder?Object.freeze([...packet.physicalOrder]):undefined});
    this.packets.add(result);
    return result;
  }
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
export interface EntityRetirementPlan {
  readonly ready: boolean;
  /** Source facts may be neutral or have only a discharged own window. */
  readonly canRetire: boolean;
  current(): boolean;
  onReady(callback: () => void): () => void;
  /** Only exact live cells whose settlement could make this snapshot releasable. */
  onSettlement?(callback: () => void): () => void;
}
type RetirementRequest = { eligible: () => boolean; release?: () => void; queued: boolean };
export interface EntityPublicationParticipant {
  seedRequested?():boolean;
  prepare(packet: EntityPublicationPacket, native?: object): PreparedPublicationUnit | undefined;
  complete(completion: object): void;
  captureInput?(subject?: number, field?: string): object | undefined;
  retire?(subject: number): void;
  prepareRetirement?(subject: number): EntityRetirementPlan;
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
  private readonly admission = new AdmissionMetadata();
  private native: EntityPublicationParticipant | undefined;
  private readonly recipients = new Set<EntityPublicationParticipant>();
  private recipientRevision = 0;
  private revisionToken:object={};
  // Distinct from ordinary staged installs: physical and ordinary plans may
  // intentionally install in sequence. Retirement invalidates every old reader.
  private retirementRevision: object = {};
  private readonly retirements = new Map<number, RetirementRequest>();
  private disposed = false;
  /** Called only for a successfully installed kernel forget-lifetime mutation. */
  requestRetirement(subject: number, eligible: () => boolean): void {
    if (this.disposed) return;
    this.cancelRetirement(subject);
    const request: RetirementRequest = { eligible, queued: false };
    this.retirements.set(subject, request);
    this.scheduleRetirement(subject, request);
  }
  private cancelRetirement(subject: number): void {
    const request = this.retirements.get(subject);
    this.retirements.delete(subject);
    request?.release?.();
  }
  private scheduleRetirement(subject: number, request: RetirementRequest): void {
    if (request.queued || this.disposed || this.retirements.get(subject) !== request) return;
    request.queued = true;
    // Readiness can notify during finalize, before installation. Only recheck
    // after the synchronous installed completion/reentry frontier has closed.
    queueMicrotask(() => {
      request.queued = false;
      if (this.disposed || this.retirements.get(subject) !== request) return;
      request.release?.(); request.release = undefined;
      if (!request.eligible()) { this.cancelRetirement(subject); return; }
      const revision = this.revisionToken;
      const plan = this.native?.prepareRetirement?.(subject);
      if (!plan) { this.cancelRetirement(subject); return; }
      if (!plan.ready) {
        request.release = plan.onReady(() => this.scheduleRetirement(subject, request));
        return;
      }
      // Readiness and owner settlement are separate lifetimes. A permanently
      // ineligible proof remains evidence, without retaining a dead request.
      if (!plan.canRetire) {
        if (plan.onSettlement) request.release = plan.onSettlement(() => this.scheduleRetirement(subject, request));
        else this.cancelRetirement(subject);
        return;
      }
      if (!request.eligible() || revision !== this.revisionToken || !plan.current()) {
        this.cancelRetirement(subject); return;
      }
      this.cancelRetirement(subject);
      this.retire(subject);
    });
  }
  dispose(): void {
    this.disposed = true;
    for (const subject of this.retirements.keys()) this.cancelRetirement(subject);
    this.revisionToken = {};
    this.retirementRevision = {};
  }
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
    // Refusal must not enroll a source or leave a phantom empty group behind.
    // Complete all admission work before publishing deferred bookkeeping.
    packet=this.admission.prepare(packet);
    let group=pointPreparation.get(this);
    if(!group){
      const source=this;
      const state:PointPreparation={packets:[],source,unit:undefined,installed:false,finalized:false,completed:false};
      const completion={};pointCompletions.set(completion,()=>{if(!state.completed){state.completed=true;if(state.unit)source.complete(state.unit.completion);}});
      const gate={set(_key:unknown,_value:unknown){if(!state.installed){state.installed=true;if(state.unit)installTerminalRecord(state.unit.record);}}};
      group={state,publication:{record:{writes:[{map:gate,key:undefined,value:undefined}],adds:[]},completion,validate:()=>state.unit?.validate?.(),finalize:()=>{if(!state.finalized){state.finalized=true;state.unit?.finalize?.();}}}};
      pointPreparation.set(this,group);
    }
    group.state.packets.push(packet);return group.publication;
  }
  prepare(packet: EntityPublicationPacket): PreparedPublicationUnit | undefined {
    const recipientRevision = this.recipientRevision,sourceRevision=this.revisionToken;
    const retirementRevision = this.retirementRevision;
    const parts: { participant: EntityPublicationParticipant; unit: PreparedPublicationUnit }[] = [];
    packet=this.admission.prepare(packet);
    const native = this.nativeParticipant();
    const nativeUnit = native?.prepare(packet);
    const fallbackRecord = native ? undefined : packet.prepareResponsibility?.();
    if (native && nativeUnit) parts.push({ participant: native, unit: nativeUnit });
    for (const participant of [...this.recipients]) {
      const unit = participant.prepare(packet, nativeUnit?.completion);
      if (unit) parts.push({ participant, unit });
    }
    if(sourceRevision!==this.revisionToken&&recipientRevision===this.recipientRevision)throw new Error("Entity publication source changed during preparation");
    if (recipientRevision !== this.recipientRevision) throw new Error('Entity publication recipients changed during preparation');
    if (!parts.length && !fallbackRecord) return undefined;
    const validate = () => {
      if (this.disposed || retirementRevision !== this.retirementRevision || recipientRevision !== this.recipientRevision || sourceRevision !== this.revisionToken)
        throw new Error('Entity publication source changed before installation');
    };
    return {
      validate,
      record: combineTerminalRecords(fallbackRecord,...parts.map(part => part.unit.record),{writes:[{map:{set:(_key:unknown,value:unknown)=>{this.revisionToken=value as object;}},key:undefined,value:{}}],adds:[]})!,
      completion: { parts },
      finalize: () => {
        validate();
        const beforeFinalize = this.revisionToken;
        for (const part of parts) part.unit.finalize?.();
        validate();
        if (beforeFinalize !== this.revisionToken)
          throw new Error('Entity publication source changed during finalization');
      },
    };
  }
  requestsSeed():boolean { return [...this.recipients].some(participant=>participant.seedRequested?.()); }
  evidence():EntityPublicationEvidence|undefined { return this.nativeParticipant()?.evidence?.(); }
  captureViews(subject?:number,field?:string): readonly object[] { return this.nativeParticipant()?.captureViews?.(subject,field)??[]; }
  inspect(): Readonly<Record<string,number>> { return {...(this.native?.inspect?.()??{}),recipients:this.recipients.size,native:this.native?1:0,retirementRequests:this.retirements.size}; }
  retire(subject: number): void { this.cancelRetirement(subject); this.native?.retire?.(subject); this.revisionToken = {}; this.retirementRevision = {}; }
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
  readonly replaceSelected?: (value: unknown, selection: import('./native-field-selection').ClaimedFieldEndpoint) => void;
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
