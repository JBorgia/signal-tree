import type {NativeFieldEndpoint,NativeFieldSelections} from '../internals/native-field-selection';
import { getActiveWriteContext } from '../write-context';
import { combineTerminalRecords, type TerminalRecordPlan } from '../internals/intrinsic-mutation';
import { entityPublicationOrdinary, currentEntityPublicationInputs, type EntityPublicationParticipant, type EntityPublicationEvidence, type EntityPublicationEdit } from '../internals/entity-publication';
import * as lifecycle from './lifecycle';
import { currentNativePublicationInputs } from './private';

type Requirement = lifecycle.NativeRequirement;
type Lookup<V>=Pick<ReadonlyMap<number,V>,'get'>;
const overlay=<V>(base:Lookup<V>,next:Lookup<V>,removed?:ReadonlySet<number>):Lookup<V>=>({get:key=>next.get(key)??(removed?.has(key)?undefined:base.get(key))});
type View = {requirement:Requirement; present?:boolean};
type Member = {readonly present:boolean;readonly requirement:Requirement};
const unavailable = lifecycle.unavailableRequirement;
const own = (row:unknown,key:string):boolean=>row!==null&&typeof row==='object'&&Object.prototype.hasOwnProperty.call(row,key);
const fieldValue = (row:unknown,key:string):unknown=>own(row,key)?(row as Record<string,unknown>)[key]:undefined;

/** Pair only within one admitted unit. Metadata is source-owned and stable;
 * payloads are never read here. Keep the first physical occurrence (Array.find),
 * independently of the last-ordinary proposal lookup below. */
function pairPhysicalUnit(
  paired: Map<EntityPublicationEdit, EntityPublicationEdit>,
  ordinary: readonly EntityPublicationEdit[],
  physical: readonly EntityPublicationEdit[] | undefined,
  authoredRemoval?: EntityPublicationEdit
): void {
  if (!physical?.length || (!ordinary.length && !authoredRemoval)) return;
  // Point units need no extra map, array, or lookup closure.
  if (physical.length === 1) {
    const first = physical[0];
    for (const edit of ordinary)
      if (first.subject === edit.subject) paired.set(edit, first);
    if (authoredRemoval && first.subject === authoredRemoval.subject)
      paired.set(authoredRemoval, first);
    return;
  }
  const singleton = ordinary.length === 1 && !authoredRemoval
    ? ordinary[0] : ordinary.length === 0 ? authoredRemoval : undefined;
  if (singleton) {
    const first = physical.find(edit => edit.subject === singleton.subject);
    if (first) paired.set(singleton, first);
    return;
  }
  const firstBySubject = new Map<number, EntityPublicationEdit>();
  for (const edit of physical) {
    // Map uses SameValueZero; the old strict equality never matched NaN.
    if (edit.subject === edit.subject && !firstBySubject.has(edit.subject))
      firstBySubject.set(edit.subject, edit);
  }
  for (const edit of ordinary) {
    const first = firstBySubject.get(edit.subject);
    if (first) paired.set(edit, first);
  }
  if (authoredRemoval) {
    const first = firstBySubject.get(authoredRemoval.subject);
    if (first) paired.set(authoredRemoval, first);
  }
}

/** Only current support identities; values and placement remain native kernel truth. */
export const createEntityPublicationParticipant: () => EntityPublicationParticipant = () => {
  const fields=new Map<number,Map<string,NativeFieldEndpoint>>();
  const members=new Map<number,Member>();
  const placements=new Map<number,Requirement>();
  const views=new Map<number,Map<string,View>>();
  const visible=new Map<number,View>();
  const placementViews=new Map<number,View>();
  const mappings=new Map<number,Requirement>();
  const mappingViews=new Map<number,View>();
  const missing=unavailable();
  const evidence=(ordinaryFields:Lookup<Map<string,NativeFieldEndpoint>>=fields,physicalFields:Lookup<Map<string,View>>=views,ordinaryMembers:Lookup<Member>=members,physicalMembers:Lookup<View>=visible,ordinaryPlacements:Lookup<Requirement>=placements,physicalPlacements:Lookup<View>=placementViews,ordinaryMappings:Lookup<Requirement>=mappings,physicalMappings:Lookup<View>=mappingViews):EntityPublicationEvidence=>({
    member:(id,view)=>view==='ordinary'?ordinaryMembers.get(id)?.requirement??missing:physicalMembers.get(id)?.requirement??missing,
    field:(id,key,view)=>view==='ordinary'?(ordinaryFields.get(id)?.get(key)?.requirement as Requirement|undefined)??missing:physicalFields.get(id)?.get(key)?.requirement??missing,
    placement:(id,view)=>view==='ordinary'?ordinaryPlacements.get(id)??missing:physicalPlacements.get(id)?.requirement??missing,
    keyMapping:(id,view)=>view==='ordinary'?ordinaryMappings.get(id)??missing:physicalMappings.get(id)?.requirement??missing,
  });
  let acquisitions=0,retirements=0,inputVisits=0;
  const physicalViews=(subject?:number,field?:string):View[]=>{
    if(subject!==undefined){
      const member=visible.get(subject),row=views.get(subject);
      if(member?.present===false)return [member];
      if(!row)return [member??{requirement:unavailable()}];
      inputVisits+=field===undefined?row.size:1;
      return [...(member?[member]:[]),...(field===undefined?row.values():[row.get(field)??{requirement:lifecycle.initialRequirement()}])];
    }
    const result:View[]=[...visible.values(),...placementViews.values()];
    for(const [id,row]of views)if(visible.get(id)?.present!==false)result.push(...row.values());
    inputVisits+=result.length;return result;
  };
  return {
    captureViews:physicalViews,
    evidence:()=>({...evidence(),exclusions:()=>{
      const result=new Map<number,object>();
      for(const [id,member]of members)if(!member.present)result.set(id,member.requirement);
      for(const [id,view]of visible)if(view.present===false)result.set(id,view.requirement);
      return [...result];
    }}),
    captureInput(subject,field){return {native:Object.freeze([...new Set(physicalViews(subject,field).map(view=>view.requirement))].map(lifecycle.captureNativeInput))};},
    inspect(){return {rows:fields.size,fields:[...fields.values()].reduce((n,row)=>n+row.size,0),presence:members.size,negativePresence:[...members.values()].filter(member=>!member.present).length,placements:placements.size,viewRows:views.size,viewFields:[...views.values()].reduce((n,row)=>n+row.size,0),negativeViewFields:[...views.values()].reduce((n,row)=>n+[...row.values()].filter(view=>view.present===false).length,0),visible:visible.size,negativeVisible:[...visible.values()].filter(view=>view.present===false).length,placementViews:placementViews.size,mappings:mappings.size,mappingViews:mappingViews.size,preparedFieldEdits:acquisitions,retireCalls:retirements,inputFactVisits:inputVisits};},
    prepare(packet){
      const inspection=packet.meta?.participation==='inspection';
      const meta=getActiveWriteContext()??packet.meta,id=meta?.transactionId;
      const owner=typeof id==='number'?lifecycle.ownerCell(packet.owner,id):undefined;
      const valid=id===undefined||!!owner&&meta?.transactionOwner===lifecycle.ownerToken(packet.owner);
      const inputs=[...currentNativePublicationInputs(),...currentEntityPublicationInputs().flatMap(input=>(input as {native?:readonly lifecycle.NativeInput[]}).native??[])];
      const prepared=inspection?undefined:lifecycle.prepareNativeRequirement(owner?[owner]:[],!valid||meta?.origin!==undefined,inputs);
      const requirement=prepared?.requirement??unavailable();
      // This source-owned prepared packet has one ordered admitted sequence.
      // Keep duplicates/tombstones in that sequence; only proposal lookup uses
      // the last subject occurrence, exactly as the former reverse/find did.
      // The index belongs to this preparation, never a source or observer cache.
      // Admission owns stable metadata; reuse point membership directly.
      // The stepped helper builds exactly one ordered sequence.
      const ordinaryEdits=entityPublicationOrdinary(packet);
      const singleton=ordinaryEdits.length===1?ordinaryEdits[0]:undefined;
      const lastOrdinaryBySubject=singleton?undefined:new Map<number,EntityPublicationEdit>();
      const repeatedSubjects=new Set<number>();
      if(lastOrdinaryBySubject)for(const edit of ordinaryEdits){
        if(lastOrdinaryBySubject.has(edit.subject))repeatedSubjects.add(edit.subject);
        lastOrdinaryBySubject.set(edit.subject,edit);
      }
      const selectedFields=new Map<number,Map<string,NativeFieldEndpoint>>();
      const beforeField=(subject:number,key:string):NativeFieldEndpoint=>fields.get(subject)?.get(key)??Object.freeze({present:false,value:undefined,requirement:members.get(subject)?.requirement??missing});
      const proposal=(subject:number,key:string):NativeFieldEndpoint=>{
        const edit=singleton?.subject===subject?singleton:lastOrdinaryBySubject?.get(subject);
        if(!edit)throw new Error('Missing admitted field publication');
        return Object.freeze({present:own(edit.after,key),value:fieldValue(edit.after,key),requirement});
      };
      const selections:NativeFieldSelections={before:beforeField,proposed:proposal,choose(subject,key,value){
        let row=selectedFields.get(subject);if(!row)selectedFields.set(subject,row=new Map());row.set(key,value);
      }};
      const responsibility=packet.prepareResponsibility?.(selections);
      const chosen=(edit:EntityPublicationEdit,key:string):NativeFieldEndpoint=>edit.restoredFields?.get(key)??selectedFields.get(edit.subject)?.get(key)??proposal(edit.subject,key);
      const writes:TerminalRecordPlan['writes'][number][]=[];
      const deletes:NonNullable<TerminalRecordPlan['deletes']>[number][]=[];
      const nextFields=new Map<number,Map<string,NativeFieldEndpoint>>();
      const nextViews=new Map<number,Map<string,View>>();
      const nextMembers=new Map<number,Member>();
      const nextPlacements=new Map<number,Requirement>();
      const removed=new Set<number>();
      const nextMappings=new Map<number,Requirement>(),nextMappingViews=new Map<number,View>();
      const physicalMembers=new Map<number,View>(),physicalPlacements=new Map<number,View>();
      const paired=new Map<EntityPublicationEdit,EntityPublicationEdit>();
      if (packet.steps) {
        for (const step of packet.steps)
          pairPhysicalUnit(paired, step.ordinary, step.physical, step.authoredRemoval);
      } else {
        // No steps is one unit; an explicit empty steps list has no fallback.
        pairPhysicalUnit(paired, packet.ordinary, packet.physical);
      }
      const physicalAt=new Map<EntityPublicationEdit,Map<string,View>>();
      const selectedAt=new Map<EntityPublicationEdit,EntityPublicationEvidence>();
      const rowFields=(id:number):Map<string,NativeFieldEndpoint>=>{let row=nextFields.get(id);if(!row)nextFields.set(id,row=new Map(fields.get(id)));return row;};
      const rowViews=(id:number):Map<string,View>=>{let row=nextViews.get(id);if(!row)nextViews.set(id,row=new Map(views.get(id)));return row;};
      // Physical support is distinct from ordinary eligibility. Inspection
      // changes only the physical certificate, including negative membership.
      for(const edit of packet.physical){
        if(edit.structural?.kind==='remove'){
          physicalMembers.set(edit.subject,{requirement,present:false});
          writes.push({map:visible,key:edit.subject,value:{requirement,present:false}});
          deletes.push({map:placementViews,key:edit.subject});continue;
        }
        if(edit.structural?.kind==='rekey'){nextMappingViews.set(edit.subject,{requirement});continue;}
        const row=rowViews(edit.subject);
        const keys=edit.fields===null?[...new Set([...row.keys(),...Object.keys(edit.after??{})])]:edit.fields;
        for(const key of keys)row.set(key,{requirement,present:own(edit.after,key)});
        physicalAt.set(edit,new Map(row));
        if(edit.structural?.kind==='add'){nextMappingViews.set(edit.subject,{requirement});physicalMembers.set(edit.subject,{requirement,present:true});physicalPlacements.set(edit.subject,{requirement});}
        if(edit.structural?.kind==='add')writes.push({map:visible,key:edit.subject,value:{requirement,present:true}},{map:placementViews,key:edit.subject,value:{requirement}});
      }
      if(packet.physicalOrder)for(const subject of packet.physicalOrder){physicalPlacements.set(subject,{requirement});writes.push({map:placementViews,key:subject,value:{requirement}});}
      for(const edit of ordinaryEdits){
        if(edit.structural?.kind==='remove'){
          removed.add(edit.subject);nextFields.delete(edit.subject);nextViews.delete(edit.subject);
          nextMembers.set(edit.subject,{present:false,requirement});
          writes.push({map:visible,key:edit.subject,value:{requirement,present:false}});
          deletes.push({map:fields,key:edit.subject},{map:views,key:edit.subject},{map:placements,key:edit.subject},{map:placementViews,key:edit.subject});continue;
        }
        if(edit.structural?.kind==='rekey'){nextMappings.set(edit.subject,requirement);continue;}
        removed.delete(edit.subject);
        const row=rowFields(edit.subject),view=rowViews(edit.subject);
        if(edit.structural?.kind==='add'){
          nextMembers.set(edit.subject,{present:true,requirement});nextPlacements.set(edit.subject,requirement);nextMappings.set(edit.subject,requirement);
          writes.push({map:visible,key:edit.subject,value:{requirement,present:true}},{map:placementViews,key:edit.subject,value:{requirement}});
        }
        const keys=edit.fields===null?[...new Set([...row.keys(),...Object.keys(edit.after??{})])]:edit.fields;
        const physical=paired.get(edit);
        for(const key of keys){
          const endpoint=chosen(edit,key),fieldRequirement=endpoint.requirement as Requirement;
          row.set(key,endpoint);
          const previous=views.get(edit.subject)?.get(key);
          const same=!!previous&&!!physical&&own(physical.before,key)===own(physical.after,key)&&Object.is(fieldValue(physical.before,key),fieldValue(physical.after,key));
          if(same){
            view.set(key,previous);
            writes.push({map:{set(_key:unknown,value:unknown){previous.requirement=value as Requirement;}},key:undefined,value:fieldRequirement});
          }else view.set(key,{requirement:fieldRequirement,present:own(physical?.after??edit.after,key)});
          acquisitions++;
        }
        // A unique subject's prepared row is final within this admitted sequence.
        // Later units clone installed rows; repeated subjects retain per-edit images.
        const ordinaryRow=!repeatedSubjects.has(edit.subject)?row:new Map(row),physicalRow=new Map(physical&&physicalAt.get(physical)||view);
        for(const key of keys){const endpoint=row.get(key);if(!endpoint)throw new Error('Missing prepared field endpoint');physicalRow.set(key,{requirement:endpoint.requirement as Requirement,present:own(physical?.after??edit.after,key)});}
        const member=nextMembers.get(edit.subject)??members.get(edit.subject),placement=nextPlacements.get(edit.subject)??placements.get(edit.subject);
        const ordinaryKey=nextMappings.get(edit.subject)??mappings.get(edit.subject)??missing,physicalKey=nextMappingViews.get(edit.subject)?.requirement??mappingViews.get(edit.subject)?.requirement??missing;
        selectedAt.set(edit,{
          member:(id,kind)=>id===edit.subject&&kind==='ordinary'?(member?.requirement??missing):evidence().member(id,kind),
          field:(id,key,kind)=>id===edit.subject?(kind==='ordinary'?(ordinaryRow.get(key)?.requirement as Requirement|undefined)??missing:physicalRow.get(key)?.requirement??missing):evidence().field(id,key,kind),
          placement:(id,kind)=>id===edit.subject&&kind==='ordinary'?(placement??missing):evidence().placement(id,kind),
          keyMapping:(id,kind)=>id===edit.subject?(kind==='ordinary'?ordinaryKey:physicalKey):evidence().keyMapping(id,kind),
        });
      }
      if(packet.ordinaryOrder)for(const subject of packet.ordinaryOrder)nextPlacements.set(subject,requirement);
      for(const [key,value]of nextFields)if(!removed.has(key))writes.push({map:fields,key,value});
      for(const [key,value]of nextViews)if(!removed.has(key))writes.push({map:views,key,value});
      for(const [key,value]of nextMembers)writes.push({map:members,key,value});
      for(const [key,value]of nextPlacements)writes.push({map:placements,key,value});
      for(const [key,value]of nextMappings)if(value!==mappings.get(key))writes.push({map:mappings,key,value});
      for(const [key,value]of nextMappingViews)if(value!==mappingViews.get(key))writes.push({map:mappingViews,key,value});
      const selected=evidence(overlay(fields,nextFields,removed),overlay(views,nextViews,removed),overlay(members,nextMembers),overlay(visible,physicalMembers),overlay(placements,nextPlacements,removed),overlay(placementViews,physicalPlacements,removed),overlay(mappings,nextMappings),overlay(mappingViews,nextMappingViews));
      selected.forEdit=edit=>selectedAt.get(edit)??selected;
      const support=(subject?:number,field?:string):Requirement=>{
        const sources:Requirement[]=[];
        const selected=subject===undefined?[...new Set([...members.keys(),...fields.keys(),...(singleton?[singleton.subject]:lastOrdinaryBySubject?.keys()??[])])]:[subject];
        if(subject===undefined){const order=new Map(placements);for(const id of removed)order.delete(id);for(const [id,value]of nextPlacements)order.set(id,value);sources.push(...order.values());}
        for(const id of selected){
          const member=nextMembers.get(id)??members.get(id);if(member)sources.push(member.requirement);
          if(member?.present===false)continue;
          const row=nextFields.get(id)??fields.get(id);
          if(field!==undefined){const value=row?.get(field);if(value)sources.push(value.requirement as Requirement);}
          else if(row)sources.push(...[...row.values()].map(value=>value.requirement as Requirement));
        }
        // Transport D/I/W unchanged; actual native consumption alone maps D→I.
        return lifecycle.combineNativeRequirements(sources);
      };
      return {record:combineTerminalRecords(responsibility,prepared?.record,{writes,deletes,adds:[]}),completion:inspection?{}:{requirement,support,facts:selected},finalize:()=>{
        if(prepared)lifecycle.finalizeNativeRequirement(requirement);
      }};
    },
    complete(completion){lifecycle.deliverNativeRequirementReady((completion as {requirement?:Requirement}).requirement);},
    prepareRetirement(subject){
      // Snapshot only this exact subject. Missing entries contribute no evidence.
      const snapshots = [fields.get(subject), members.get(subject), placements.get(subject), views.get(subject), visible.get(subject), placementViews.get(subject), mappings.get(subject), mappingViews.get(subject)] as const;
      const requirements = new Set<Requirement>();
      for (const endpoint of snapshots[0]?.values() ?? []) requirements.add(endpoint.requirement as Requirement);
      if (snapshots[1]) requirements.add(snapshots[1].requirement);
      if (snapshots[2]) requirements.add(snapshots[2]);
      for (const view of snapshots[3]?.values() ?? []) requirements.add(view.requirement);
      if (snapshots[4]) requirements.add(snapshots[4].requirement);
      if (snapshots[5]) requirements.add(snapshots[5].requirement);
      if (snapshots[6]) requirements.add(snapshots[6]);
      if (snapshots[7]) requirements.add(snapshots[7].requirement);
      const ready = [...requirements].every(lifecycle.nativeRequirementReady);
      const waiting = new Set<lifecycle.OwnerCell>();
      const releasable = (requirement: Requirement): boolean => {
        // Scalar-normalized aliases preserve the exact recursive classification.
        // Entity composites themselves remain unchanged and unenrolled.
        const finalized=lifecycle.finalizedRetirement(requirement);
        if(finalized){
          if(finalized.blocked)return false;
          for(const cell of finalized.possible){
            if(cell.outcome==='confirmed'||cell.outcome==='rolled-back')continue;
            if(!lifecycle.ownerCellCanTransition(cell))return false;
            waiting.add(cell);
          }
          return true;
        }
        // A composite is eligible only when every constituent independently is.
        if (requirement.components) return requirement.components.every(releasable);
        const proof = lifecycle.nativeProof(requirement);
        if (proof.invalid || proof.unavailableInput || proof.terminalRejectedRoles ||
            proof.owners.length || (proof.destination?.length ?? 0) ||
            (proof.input?.length ?? 0) || (proof.validation?.length ?? 0)) return false;
        if (!proof.unknown && !(proof.possible?.length ?? 0)) return true;
        // Do not erase arbitrary unknown input/origin/validation. Only the
        // source's own window, classified before those facts could be cleared.
        if (!requirement.retirementOwnWindowOnly || !proof.historicalWindow) return false;
        for (const cell of proof.possible ?? []) {
          if (cell.outcome === 'confirmed' || cell.outcome === 'rolled-back') continue;
          if (!lifecycle.ownerCellCanTransition(cell)) return false;
          waiting.add(cell);
        }
        return true;
      };
      const canRelease = ready && [...requirements].every(releasable);
      const canRetire = canRelease && waiting.size === 0;
      return { ready, canRetire,
        onSettlement: canRelease && waiting.size ? (callback: () => void) => {
          const releases = [...waiting].map(cell => lifecycle.onOwnerCellTransition(cell, callback));
          return () => { for (const release of releases) release(); };
        } : undefined,
        current: () => snapshots[0] === fields.get(subject) && snapshots[1] === members.get(subject) &&
          snapshots[2] === placements.get(subject) && snapshots[3] === views.get(subject) &&
          snapshots[4] === visible.get(subject) && snapshots[5] === placementViews.get(subject) &&
          snapshots[6] === mappings.get(subject) && snapshots[7] === mappingViews.get(subject),
        onReady(callback){
          const releases = [...requirements].filter(requirement => !lifecycle.nativeRequirementReady(requirement))
            .map(requirement => lifecycle.onNativeRequirementReady(requirement, callback));
          return () => { for (const release of releases) release(); };
        },
      };
    },
    retire(subject){fields.delete(subject);members.delete(subject);placements.delete(subject);views.delete(subject);visible.delete(subject);placementViews.delete(subject);mappings.delete(subject);mappingViews.delete(subject);retirements++;},
  };
};
