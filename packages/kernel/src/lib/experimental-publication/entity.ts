import type {NativeFieldEndpoint,NativeFieldSelections} from '../internals/native-field-selection';
import { getActiveWriteContext } from '../write-context';
import { combineTerminalRecords, type TerminalRecordPlan } from '../internals/intrinsic-mutation';
import { entityPublicationOrdinary, currentEntityPublicationInputs, type EntityPublicationParticipant, type EntityPublicationEvidence, type EntityPublicationEdit, type EntityPublicationPacket } from '../internals/entity-publication';
import * as lifecycle from './lifecycle';
import { currentNativePublicationInputs } from './private';
import { PackedFieldRow } from './packed-field-row';
import { ExactSubjectRuns } from '../internals/exact-subject-runs';

type Requirement = lifecycle.NativeRequirement;
type Lookup<V>=Pick<ReadonlyMap<number,V>,'get'>;
const overlay=<V>(base:Lookup<V>,next:Lookup<V>,removed?:ReadonlySet<number>):Lookup<V>=>({get:key=>next.get(key)??(removed?.has(key)?undefined:base.get(key))});
type View = {requirement:Requirement; present?:boolean};
type FieldRow<T extends object> = Map<string,T> | PackedFieldRow<T>;
type Member = {readonly present:boolean;readonly requirement:Requirement};
type RetiredFacts = {member:Member;visible:View;placement:View;mapping:Requirement;mappingView:View};
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
  const fields=new Map<number,FieldRow<NativeFieldEndpoint>>();
  const members=new Map<number,Member>();
  const placements=new Map<number,Requirement>();
  const views=new Map<number,FieldRow<View>>();
  const visible=new Map<number,View>();
  const placementViews=new Map<number,View>();
  const mappings=new Map<number,Requirement>();
  const mappingViews=new Map<number,View>();
  // Only installed, irreversibly forgotten lifetimes enter this optional index.
  // Exact requirement references survive; this does not normalize owner proof.
  let retired:ExactSubjectRuns<RetiredFacts>|undefined;
  const memberAt=(id:number)=>members.get(id)??retired?.get(id)?.member;
  const visibleAt=(id:number)=>visible.get(id)??retired?.get(id)?.visible;
  const placementAt=(id:number)=>placementViews.get(id)??retired?.get(id)?.placement;
  const mappingAt=(id:number)=>mappings.get(id)??retired?.get(id)?.mapping;
  const mappingViewAt=(id:number)=>mappingViews.get(id)??retired?.get(id)?.mappingView;
  const sameRetired=(a:RetiredFacts,b:RetiredFacts)=>a.member.requirement===b.member.requirement&&a.visible.requirement===b.visible.requirement&&a.placement.requirement===b.placement.requirement&&a.mapping===b.mapping&&a.mappingView.requirement===b.mappingView.requirement;
  // Only escaped/preparing maps copy on point installation. Retirement tokens
  // are allocated lazily for captured maps, never for every populated row.
  const escaped=new WeakSet<object>(),preparing=new WeakSet<object>();
  const retirementRevisions=new WeakMap<object,object>();
  const exposeCompletion=new WeakMap<object,()=>void>();
  const retirementRevision=(row:object|undefined):object|undefined=>{
    if(!row)return undefined;
    let revision=retirementRevisions.get(row);
    if(!revision)retirementRevisions.set(row,revision={});
    escaped.add(row);return revision;
  };
  const missing=unavailable();
  const evidence=(ordinaryFields:Lookup<FieldRow<NativeFieldEndpoint>>=fields,physicalFields:Lookup<FieldRow<View>>=views,ordinaryMembers?:Lookup<Member>,physicalMembers?:Lookup<View>,ordinaryPlacements:Lookup<Requirement>=placements,physicalPlacements?:Lookup<View>,ordinaryMappings?:Lookup<Requirement>,physicalMappings?:Lookup<View>):EntityPublicationEvidence=>({
    member:(id,view)=>view==='ordinary'?(ordinaryMembers?ordinaryMembers.get(id):memberAt(id))?.requirement??missing:(physicalMembers?physicalMembers.get(id):visibleAt(id))?.requirement??missing,
    field:(id,key,view)=>view==='ordinary'?(ordinaryFields.get(id)?.get(key)?.requirement as Requirement|undefined)??missing:physicalFields.get(id)?.get(key)?.requirement??missing,
    placement:(id,view)=>view==='ordinary'?ordinaryPlacements.get(id)??missing:(physicalPlacements?physicalPlacements.get(id):placementAt(id))?.requirement??missing,
    keyMapping:(id,view)=>view==='ordinary'?(ordinaryMappings?ordinaryMappings.get(id):mappingAt(id))??missing:(physicalMappings?physicalMappings.get(id):mappingViewAt(id))?.requirement??missing,
  });
  let acquisitions=0,retirements=0,inputVisits=0;
  const physicalViews=(subject?:number,field?:string):View[]=>{
    if(subject!==undefined){
      const member=visibleAt(subject),row=views.get(subject);
      if(member?.present===false)return [member];
      if(!row)return [member??{requirement:unavailable()}];
      inputVisits+=field===undefined?row.size:1;
      return [...(member?[member]:[]),...(field===undefined?row.values():[row.get(field)??{requirement:lifecycle.initialRequirement()}])];
    }
    const result:View[]=[...visible.values(),...placementViews.values()];
    for(const [,fact]of retired?.entries()??[])result.push(fact.visible,fact.placement);
    for(const [id,row]of views)if(visibleAt(id)?.present!==false)result.push(...row.values());
    inputVisits+=result.length;return result;
  };
  const nativeRequirement=(packet:EntityPublicationPacket,inspection:boolean)=>{
    const meta=getActiveWriteContext()??packet.meta,id=meta?.transactionId;
    const owner=typeof id==='number'?lifecycle.ownerCell(packet.owner,id):undefined;
    const valid=id===undefined||!!owner&&meta?.transactionOwner===lifecycle.ownerToken(packet.owner);
    const inputs=[...currentNativePublicationInputs(),...currentEntityPublicationInputs().flatMap(input=>(input as {native?:readonly lifecycle.NativeInput[]}).native??[])];
    const prepared=inspection?undefined:lifecycle.prepareNativeRequirement(owner?[owner]:[],!valid||meta?.origin!==undefined,inputs);
    return {prepared,requirement:prepared?.requirement??unavailable()};
  };
  const participant:EntityPublicationParticipant={
    captureViews:physicalViews,
    evidence:()=>({...evidence(),exclusions:()=>{
      const result=new Map<number,object>();
      for(const [id,member]of members)if(!member.present)result.set(id,member.requirement);
      for(const [id,view]of visible)if(view.present===false)result.set(id,view.requirement);
      for(const [id,fact]of retired?.entries()??[])result.set(id,fact.visible.requirement);
      return [...result];
    }}),
    captureInput(subject,field){return {native:Object.freeze([...new Set(physicalViews(subject,field).map(view=>view.requirement))].map(lifecycle.captureNativeInput))};},
    inspect(){return {rows:fields.size,fields:[...fields.values()].reduce((n,row)=>n+row.size,0),presence:members.size+(retired?.size??0),negativePresence:[...members.values()].filter(member=>!member.present).length+(retired?.size??0),placements:placements.size,viewRows:views.size,viewFields:[...views.values()].reduce((n,row)=>n+row.size,0),negativeViewFields:[...views.values()].reduce((n,row)=>n+[...row.values()].filter(view=>view.present===false).length,0),visible:visible.size+(retired?.size??0),negativeVisible:[...visible.values()].filter(view=>view.present===false).length+(retired?.size??0),placementViews:placementViews.size+(retired?.size??0),mappings:mappings.size+(retired?.size??0),mappingViews:mappingViews.size+(retired?.size??0),packedSubjects:retired?.size??0,packedRuns:retired?.runCount??0,unpackedSubjectFacets:members.size+visible.size+placementViews.size+mappings.size+mappingViews.size,preparedFieldEdits:acquisitions,retireCalls:retirements,inputFactVisits:inputVisits};},
    expose(completion){exposeCompletion.get(completion)?.();},
    preparePoint(packet){
      const edit=packet.ordinary[0],physical=packet.physical[0],steps=packet.steps;
      if(packet.meta?.participation==='inspection'||packet.prepareResponsibility||packet.ordinary.length!==1||packet.physical.length!==1||
        !edit||!physical||edit.subject!==physical.subject||edit.structural||physical.structural||edit.restoredFields||
        edit.fields?.length!==1||physical.fields?.length!==1||edit.fields[0]!==physical.fields[0]||
        !Object.isFrozen(edit.fields)||!Object.isFrozen(physical.fields)||packet.ordinaryOrder||packet.physicalOrder||
        steps?.length!==1||steps[0].authoredRemoval||steps[0].ordinary.length!==1||steps[0].ordinary[0]!==edit||
        steps[0].physical?.length!==1||steps[0].physical[0]!==physical)return undefined;
      const baseFields=fields.get(edit.subject),baseViews=views.get(edit.subject);
      if(!baseFields||!baseViews)return undefined;
      // An outer point preparation's base must remain unchanged across a getter's
      // reentrant installation, just as the generic preparation's copied row does.
      const fieldsPreparing=preparing.has(baseFields),viewsPreparing=preparing.has(baseViews);
      const copyFields=fieldsPreparing||escaped.has(baseFields),copyViews=viewsPreparing||escaped.has(baseViews);
      if(!fieldsPreparing)preparing.add(baseFields);if(!viewsPreparing)preparing.add(baseViews);
      try{
        const {prepared,requirement}=nativeRequirement(packet,false);
        if(!prepared)throw new Error('Authored point has no native requirement');
        const key=edit.fields[0];
        // Retain generic physical-pass/proposal/equality read order. The before
        // value may be an accessor and may reenter source preparation.
        own(physical.after,key);
        const endpoint=Object.freeze({present:own(edit.after,key),value:fieldValue(edit.after,key),requirement});
        const previous=baseViews.get(key);
        const same=!!previous&&own(physical.before,key)===own(physical.after,key)&&Object.is(fieldValue(physical.before,key),fieldValue(physical.after,key));
        const view=same?previous:{requirement,present:own(physical.after??edit.after,key)};
        acquisitions++;
        // Generic per-edit selection performs this presence read after the
        // ordinary overlay too; retain callback/trap order even before exposure.
        const selectedPresent=own(physical.after??edit.after,key);
        let targetFields=copyFields||escaped.has(baseFields)||
          baseFields instanceof PackedFieldRow&&!baseFields.canSet(key)?new Map(baseFields):baseFields;
        let targetViews=copyViews||escaped.has(baseViews)||
          baseViews instanceof PackedFieldRow&&!baseViews.canSet(key)?new Map(baseViews):baseViews;
        const revision={};
        const member=memberAt(edit.subject),placement=placements.get(edit.subject);
        const ordinaryKey=mappingAt(edit.subject)??missing,physicalKey=mappingViewAt(edit.subject)?.requirement??missing;
        let sealed=false,selected:EntityPublicationEvidence|undefined,selectedSupport:((subject?:number,field?:string)=>Requirement)|undefined;
        const seal=()=>{
          if(sealed)return;sealed=true;
          if(targetFields===baseFields)targetFields=new Map(baseFields);
          if(targetViews===baseViews)targetViews=new Map(baseViews);
          targetFields.set(key,endpoint);targetViews.set(key,view);
          escaped.add(baseFields);escaped.add(baseViews);escaped.add(targetFields);escaped.add(targetViews);
          const pointFields=targetFields,pointViews=targetViews;
          const ordinaryRows:Lookup<FieldRow<NativeFieldEndpoint>>={get:id=>id===edit.subject?pointFields:fields.get(id)};
          const physicalRows:Lookup<FieldRow<View>>={get:id=>id===edit.subject?pointViews:views.get(id)};
          const physicalRow=new Map(pointViews);
          // Selected per-edit physical support is a captured requirement, not
          // the source's deliberately mutable equal-value physical View cell.
          physicalRow.set(key,{requirement,present:selectedPresent});
          const facts=evidence(ordinaryRows,physicalRows);
          selected=facts;
          const perEdit:EntityPublicationEvidence={
            member:(id,kind)=>id===edit.subject&&kind==='ordinary'?(member?.requirement??missing):evidence().member(id,kind),
            field:(id,field,kind)=>id===edit.subject?(kind==='ordinary'?(pointFields.get(field)?.requirement as Requirement|undefined)??missing:physicalRow.get(field)?.requirement??missing):evidence().field(id,field,kind),
            placement:(id,kind)=>id===edit.subject&&kind==='ordinary'?(placement??missing):evidence().placement(id,kind),
            keyMapping:(id,kind)=>id===edit.subject?(kind==='ordinary'?ordinaryKey:physicalKey):evidence().keyMapping(id,kind),
          };
          facts.forEdit=requested=>requested===edit?perEdit:facts;
          selectedSupport=(subject,field)=>{
            const sources:Requirement[]=[];
            const selected=subject===undefined?[...new Set([...members.keys(),...(retired?.keys()??[]),...fields.keys(),edit.subject])]:[subject];
            if(subject===undefined)sources.push(...placements.values());
            for(const id of selected){
              const currentMember=memberAt(id);if(currentMember)sources.push(currentMember.requirement);
              if(currentMember?.present===false)continue;
              const row=ordinaryRows.get(id);
              if(field!==undefined){const value=row?.get(field);if(value)sources.push(value.requirement as Requirement);}
              else if(row)sources.push(...[...row.values()].map(value=>value.requirement as Requirement));
            }
            return lifecycle.combineNativeRequirements(sources);
          };
        };
        const completion={requirement,
          get facts(){seal();if(!selected)throw new Error('Missing sealed point evidence');return selected;},
          get support(){seal();if(!selectedSupport)throw new Error('Missing sealed point support');return selectedSupport;},
        };
        exposeCompletion.set(completion,seal);
        const pointWrite={map:{set(){
          if(same&&previous)previous.requirement=requirement;
          targetFields.set(key,endpoint);targetViews.set(key,view);
          // A retirement plan can be captured after this point was prepared.
          // Refresh only already-enrolled maps using the precomputed token;
          // terminal installation performs no copying or field traversal.
          if(retirementRevisions.has(targetFields))retirementRevisions.set(targetFields,revision);
          if(retirementRevisions.has(targetViews))retirementRevisions.set(targetViews,revision);
          fields.set(edit.subject,targetFields);views.set(edit.subject,targetViews);
        }},key:undefined,value:undefined};
        return {
          // The requirement currently contributes frame adds only. Preserve any
          // future primitive writes rather than silently discarding them.
          record:{deletes:prepared.record.deletes,writes:prepared.record.writes.length?[...prepared.record.writes,pointWrite]:[pointWrite],adds:prepared.record.adds},
          completion,
          finalize:()=>lifecycle.finalizeNativeRequirement(requirement),
        };
      }finally{if(!fieldsPreparing)preparing.delete(baseFields);if(!viewsPreparing)preparing.delete(baseViews);}
    },
    prepare(packet){
      const inspection=packet.meta?.participation==='inspection';
      const {prepared,requirement}=nativeRequirement(packet,inspection);
      // This source-owned prepared packet has one ordered admitted sequence.
      // Keep duplicates/tombstones in that sequence; only proposal lookup uses
      // the last subject occurrence, exactly as the former reverse/find did.
      // The index belongs to this preparation, never a source or observer cache.
      // Admission owns stable metadata; reuse point membership directly.
      // The stepped helper builds exactly one ordered sequence.
      const ordinaryEdits=entityPublicationOrdinary(packet);
      const singleton=ordinaryEdits.length===1?ordinaryEdits[0]:undefined;
      const lastOrdinaryBySubject=singleton?undefined:new Map<number,EntityPublicationEdit>();
      const repeatedSubjects=singleton?undefined:new Set<number>();
      if(lastOrdinaryBySubject&&repeatedSubjects)for(const edit of ordinaryEdits){
        if(lastOrdinaryBySubject.has(edit.subject))repeatedSubjects.add(edit.subject);
        lastOrdinaryBySubject.set(edit.subject,edit);
      }
      const selectedFields=new Map<number,Map<string,NativeFieldEndpoint>>();
      const beforeField=(subject:number,key:string):NativeFieldEndpoint=>fields.get(subject)?.get(key)??Object.freeze({present:false,value:undefined,requirement:memberAt(subject)?.requirement??missing});
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
        const ordinaryRow=!repeatedSubjects?.has(edit.subject)?row:new Map(row),physicalRow=new Map(physical&&physicalAt.get(physical)||view);
        for(const key of keys){const endpoint=row.get(key);if(!endpoint)throw new Error('Missing prepared field endpoint');physicalRow.set(key,{requirement:endpoint.requirement as Requirement,present:own(physical?.after??edit.after,key)});}
        const member=nextMembers.get(edit.subject)??memberAt(edit.subject),placement=nextPlacements.get(edit.subject)??placements.get(edit.subject);
        const ordinaryKey=nextMappings.get(edit.subject)??mappingAt(edit.subject)??missing,physicalKey=nextMappingViews.get(edit.subject)?.requirement??mappingViewAt(edit.subject)?.requirement??missing;
        selectedAt.set(edit,{
          member:(id,kind)=>id===edit.subject&&kind==='ordinary'?(member?.requirement??missing):evidence().member(id,kind),
          field:(id,key,kind)=>id===edit.subject?(kind==='ordinary'?(ordinaryRow.get(key)?.requirement as Requirement|undefined)??missing:physicalRow.get(key)?.requirement??missing):evidence().field(id,key,kind),
          placement:(id,kind)=>id===edit.subject&&kind==='ordinary'?(placement??missing):evidence().placement(id,kind),
          keyMapping:(id,kind)=>id===edit.subject?(kind==='ordinary'?ordinaryKey:physicalKey):evidence().keyMapping(id,kind),
        });
      }
      if(packet.ordinaryOrder)for(const subject of packet.ordinaryOrder)nextPlacements.set(subject,requirement);
      // Only new, narrow rows are packed. The detached prepared evidence keeps
      // its Maps, so exposed readers cannot acquire the mutable installed row.
      const pack = <T extends object>(subject: number, row: Map<string,T>) =>
        row.size > 0 && row.size <= 3 && !fields.has(subject) && !views.has(subject) &&
        nextMembers.get(subject)?.present === true
          ? new PackedFieldRow(row)
          : row;
      for(const [key,value]of nextFields)if(!removed.has(key))writes.push({map:fields,key,value:pack(key,value)});
      for(const [key,value]of nextViews)if(!removed.has(key))writes.push({map:views,key,value:pack(key,value)});
      for(const [key,value]of nextMembers)writes.push({map:members,key,value});
      for(const [key,value]of nextPlacements)writes.push({map:placements,key,value});
      for(const [key,value]of nextMappings)if(value!==mappingAt(key))writes.push({map:mappings,key,value});
      for(const [key,value]of nextMappingViews)if(value!==mappingViewAt(key))writes.push({map:mappingViews,key,value});
      const selected=evidence(overlay(fields,nextFields,removed),overlay(views,nextViews,removed),overlay({get:memberAt},nextMembers),overlay({get:visibleAt},physicalMembers),overlay(placements,nextPlacements,removed),overlay({get:placementAt},physicalPlacements,removed),overlay({get:mappingAt},nextMappings),overlay({get:mappingViewAt},nextMappingViews));
      selected.forEdit=edit=>selectedAt.get(edit)??selected;
      const support=(subject?:number,field?:string):Requirement=>{
        const sources:Requirement[]=[];
        const selected=subject===undefined?[...new Set([...members.keys(),...(retired?.keys()??[]),...fields.keys(),...(singleton?[singleton.subject]:lastOrdinaryBySubject?.keys()??[])])]:[subject];
        if(subject===undefined){const order=new Map(placements);for(const id of removed)order.delete(id);for(const [id,value]of nextPlacements)order.set(id,value);sources.push(...order.values());}
        for(const id of selected){
          const member=nextMembers.get(id)??memberAt(id);if(member)sources.push(member.requirement);
          if(member?.present===false)continue;
          const row=nextFields.get(id)??fields.get(id);
          if(field!==undefined){const value=row?.get(field);if(value)sources.push(value.requirement as Requirement);}
          else if(row)sources.push(...[...row.values()].map(value=>value.requirement as Requirement));
        }
        // Transport D/I/W unchanged; actual native consumption alone maps D→I.
        return lifecycle.combineNativeRequirements(sources);
      };
      const completion=inspection?{}:{requirement,support,facts:selected};
      exposeCompletion.set(completion,()=>{
        for(const row of nextFields.values())escaped.add(row);
        for(const row of nextViews.values())escaped.add(row);
      });
      return {record:combineTerminalRecords(responsibility,prepared?.record,{writes,deletes,adds:[]}),completion,finalize:()=>{
        if(prepared)lifecycle.finalizeNativeRequirement(requirement);
      }};
    },
    complete(completion){lifecycle.deliverNativeRequirementReady((completion as {requirement?:Requirement}).requirement);},
    prepareRetirement(subject){
      // Snapshot only this exact subject. Missing entries contribute no evidence.
      const snapshots = [fields.get(subject), memberAt(subject), placements.get(subject), views.get(subject), visibleAt(subject), placementAt(subject), mappingAt(subject), mappingViewAt(subject)] as const;
      // Identity detects ordinary COW. Conditional tokens also detect a point
      // prepared before this plan that subsequently installs into the same map.
      const fieldRevision=retirementRevision(snapshots[0]),viewRevision=retirementRevision(snapshots[3]);
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
      // A blocked proof is still required evidence. Pack exact identical facts
      // only after the source verifies the installed-forget authority/currentness.
      // Own-window requests keep their existing terminal-deletion subscription.
      const member=snapshots[1],visibleFact=snapshots[4],placement=snapshots[5],mapping=snapshots[6],mappingView=snapshots[7];
      const packable=Number.isSafeInteger(subject)&&subject>=0&&ready&&!canRelease&&!retired?.get(subject)&&!snapshots[0]&&!snapshots[2]&&!snapshots[3]&&member?.present===false&&visibleFact?.present===false&&!!placement&&!!mapping&&!!mappingView;
      return { ready, canRetire,
        compact:packable?()=>{
          const fact:RetiredFacts={member,visible:visibleFact,placement,mapping,mappingView};
          if(!(retired??=new ExactSubjectRuns(sameRetired)).tryAppend(subject,fact))return false;
          members.delete(subject);visible.delete(subject);placementViews.delete(subject);mappings.delete(subject);mappingViews.delete(subject);
          return true;
        }:undefined,
        onSettlement: canRelease && waiting.size ? (callback: () => void) => {
          const releases = [...waiting].map(cell => lifecycle.onOwnerCellTransition(cell, callback));
          return () => { for (const release of releases) release(); };
        } : undefined,
        current: () => snapshots[0] === fields.get(subject) && fieldRevision === (snapshots[0]&&retirementRevisions.get(snapshots[0])) &&
          viewRevision === (snapshots[3]&&retirementRevisions.get(snapshots[3])) && snapshots[1] === memberAt(subject) &&
          snapshots[2] === placements.get(subject) && snapshots[3] === views.get(subject) &&
          snapshots[4] === visibleAt(subject) && snapshots[5] === placementAt(subject) &&
          snapshots[6] === mappingAt(subject) && snapshots[7] === mappingViewAt(subject),
        onReady(callback){
          const releases = [...requirements].filter(requirement => !lifecycle.nativeRequirementReady(requirement))
            .map(requirement => lifecycle.onNativeRequirementReady(requirement, callback));
          return () => { for (const release of releases) release(); };
        },
      };
    },
    retire(subject){retired?.delete(subject);fields.delete(subject);members.delete(subject);placements.delete(subject);views.delete(subject);visible.delete(subject);placementViews.delete(subject);mappings.delete(subject);mappingViews.delete(subject);retirements++;},
  };
  return participant;
};
