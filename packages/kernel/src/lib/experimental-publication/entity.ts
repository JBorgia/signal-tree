import type {NativeFieldEndpoint,NativeFieldSelections} from '../internals/native-field-selection';
import { getActiveWriteContext } from '../write-context';
import { combineTerminalRecords, type TerminalRecordPlan } from '../internals/intrinsic-mutation';
import { entityPublicationOrdinary, currentEntityPublicationInputs, type EntityPublicationParticipant, type EntityPublicationEvidence, type EntityPublicationEdit, type EntityPublicationPacket } from '../internals/entity-publication';
import * as lifecycle from './lifecycle';
import { currentNativePublicationInputs } from './private';

type Requirement = lifecycle.NativeRequirement;
type Lookup<V>=Pick<ReadonlyMap<number,V>,'get'>;
const overlay=<V>(base:Lookup<V>,next:Lookup<V>,removed?:ReadonlySet<number>):Lookup<V>=>({get:key=>next.get(key)??(removed?.has(key)?undefined:base.get(key))});
type View = {requirement:Requirement; present?:boolean};
type FieldFact = {readonly ordinary?:NativeFieldEndpoint;readonly physical?:View};
type RowFacts = {readonly cells:Map<string,FieldFact>;ordinary:boolean;physical:boolean;ordinaryKeys:string[];physicalKeys:string[];revision:object};
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
  const rows=new Map<number,RowFacts>();
  const members=new Map<number,Member>();
  const placements=new Map<number,Requirement>();
  const visible=new Map<number,View>();
  const placementViews=new Map<number,View>();
  const mappings=new Map<number,Requirement>();
  const mappingViews=new Map<number,View>();
  const escaped=new WeakSet<RowFacts>();
  const preparing=new WeakSet<RowFacts>();
  const exposeCompletion=new WeakMap<object,()=>void>();
  const missing=unavailable();
  const cloneRow=(row:RowFacts|undefined):RowFacts=>{
    const ordinaryKeys=row?.ordinaryKeys.slice()??[];
    const physicalKeys=row&&row.physicalKeys!==row.ordinaryKeys?row.physicalKeys.slice():ordinaryKeys;
    return {cells:new Map(row?.cells),ordinary:row?.ordinary??false,physical:row?.physical??false,ordinaryKeys,physicalKeys,revision:{}};
  };
  const setFact=(row:RowFacts,key:string,fact:FieldFact):void=>{
    const previous=row.cells.get(key),ordinary=!!fact.ordinary&&!previous?.ordinary,physical=!!fact.physical&&!previous?.physical;
    if(row.ordinaryKeys===row.physicalKeys&&ordinary!==physical){
      if(ordinary)row.ordinaryKeys=row.ordinaryKeys.slice();else row.physicalKeys=row.physicalKeys.slice();
    }
    if(ordinary)row.ordinaryKeys.push(key);
    if(physical&&(!ordinary||row.physicalKeys!==row.ordinaryKeys))row.physicalKeys.push(key);
    row.cells.set(key,fact);
  };
  const ordinaryField=(row:RowFacts|undefined,key:string):NativeFieldEndpoint|undefined=>row?.ordinary?row.cells.get(key)?.ordinary:undefined;
  const physicalField=(row:RowFacts|undefined,key:string):View|undefined=>row?.physical?row.cells.get(key)?.physical:undefined;
  const physicalImage=(row:RowFacts):Map<string,View>=>{
    const image=new Map<string,View>();
    for(const key of row.physicalKeys){const view=row.cells.get(key)?.physical;if(view)image.set(key,view);}
    return image;
  };
  const sideKeys=(row:RowFacts,side:'ordinary'|'physical'):readonly string[]=>side==='ordinary'?row.ordinaryKeys:row.physicalKeys;
  const evidence=(ordinaryRows:Lookup<RowFacts>=rows,physicalRows:Lookup<RowFacts>=rows,ordinaryMembers:Lookup<Member>=members,physicalMembers:Lookup<View>=visible,ordinaryPlacements:Lookup<Requirement>=placements,physicalPlacements:Lookup<View>=placementViews,ordinaryMappings:Lookup<Requirement>=mappings,physicalMappings:Lookup<View>=mappingViews):EntityPublicationEvidence=>({
    member:(id,view)=>view==='ordinary'?ordinaryMembers.get(id)?.requirement??missing:physicalMembers.get(id)?.requirement??missing,
    field:(id,key,view)=>view==='ordinary'?(ordinaryField(ordinaryRows.get(id),key)?.requirement as Requirement|undefined)??missing:physicalField(physicalRows.get(id),key)?.requirement??missing,
    placement:(id,view)=>view==='ordinary'?ordinaryPlacements.get(id)??missing:physicalPlacements.get(id)?.requirement??missing,
    keyMapping:(id,view)=>view==='ordinary'?ordinaryMappings.get(id)??missing:physicalMappings.get(id)?.requirement??missing,
  });
  let acquisitions=0,retirements=0,inputVisits=0;
  const physicalViews=(subject?:number,field?:string):View[]=>{
    if(subject!==undefined){
      const member=visible.get(subject),row=rows.get(subject);
      if(member?.present===false)return [member];
      if(!row?.physical)return [member??{requirement:unavailable()}];
      if(field!==undefined){inputVisits++;return [...(member?[member]:[]),physicalField(row,field)??{requirement:lifecycle.initialRequirement()}];}
      const result:View[]=member?[member]:[];
      for(const key of row.physicalKeys){const view=physicalField(row,key);if(view){inputVisits++;result.push(view);}}
      return result;
    }
    const result:View[]=[...visible.values(),...placementViews.values()];
    for(const [id,row]of rows)if(row.physical&&visible.get(id)?.present!==false)
      for(const key of row.physicalKeys){const view=physicalField(row,key);if(view)result.push(view);}
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
  const support=(fieldRows:Lookup<RowFacts>,nextMembers:Lookup<Member>,nextPlacements:ReadonlyMap<number,Requirement>,removed:ReadonlySet<number>,subjects:()=>readonly number[],subject?:number,field?:string):Requirement=>{
    const sources:Requirement[]=[];
    const selected=subject===undefined?subjects():[subject];
    if(subject===undefined){const order=new Map(placements);for(const id of removed)order.delete(id);for(const [id,value]of nextPlacements)order.set(id,value);sources.push(...order.values());}
    for(const id of selected){
      const member=nextMembers.get(id)??members.get(id);if(member)sources.push(member.requirement);
      if(member?.present===false)continue;
      const row=fieldRows.get(id);
      if(!row?.ordinary)continue;
      if(field!==undefined){const endpoint=ordinaryField(row,field);if(endpoint)sources.push(endpoint.requirement as Requirement);}
      else for(const key of row.ordinaryKeys){const endpoint=ordinaryField(row,key);if(endpoint)sources.push(endpoint.requirement as Requirement);}
    }
    // Transport D/I/W unchanged; actual native consumption alone maps D→I.
    return lifecycle.combineNativeRequirements(sources);
  };
  const participant:EntityPublicationParticipant={
    captureViews:physicalViews,
    evidence:()=>({...evidence(),exclusions:()=>{
      const result=new Map<number,object>();
      for(const [id,member]of members)if(!member.present)result.set(id,member.requirement);
      for(const [id,view]of visible)if(view.present===false)result.set(id,view.requirement);
      return [...result];
    }}),
    captureInput(subject,field){return {native:Object.freeze([...new Set(physicalViews(subject,field).map(view=>view.requirement))].map(lifecycle.captureNativeInput))};},
    inspect(){
      let ordinaryRows=0,ordinaryFields=0,physicalRows=0,physicalFields=0,negativeViewFields=0;
      for(const row of rows.values()){
        if(row.ordinary)ordinaryRows++;if(row.physical)physicalRows++;
        for(const fact of row.cells.values()){
          if(row.ordinary&&fact.ordinary)ordinaryFields++;
          if(row.physical&&fact.physical){physicalFields++;if(fact.physical.present===false)negativeViewFields++;}
        }
      }
      return {rows:ordinaryRows,fields:ordinaryFields,presence:members.size,negativePresence:[...members.values()].filter(member=>!member.present).length,placements:placements.size,viewRows:physicalRows,viewFields:physicalFields,negativeViewFields,visible:visible.size,negativeVisible:[...visible.values()].filter(view=>view.present===false).length,placementViews:placementViews.size,mappings:mappings.size,mappingViews:mappingViews.size,preparedFieldEdits:acquisitions,retireCalls:retirements,inputFactVisits:inputVisits};
    },
    expose(completion){exposeCompletion.get(completion)?.();},
    preparePoint(packet){
      const edit=packet.ordinary[0],physical=packet.physical[0],steps=packet.steps;
      if(packet.meta?.participation==='inspection'||packet.prepareResponsibility||packet.ordinary.length!==1||packet.physical.length!==1||
        !edit||!physical||edit.subject!==physical.subject||edit.structural||physical.structural||edit.restoredFields||
        edit.fields?.length!==1||physical.fields?.length!==1||edit.fields[0]!==physical.fields[0]||
        !Object.isFrozen(edit.fields)||!Object.isFrozen(physical.fields)||packet.ordinaryOrder||packet.physicalOrder||
        steps?.length!==1||steps[0].authoredRemoval||steps[0].ordinary.length!==1||steps[0].ordinary[0]!==edit||
        steps[0].physical?.length!==1||steps[0].physical[0]!==physical)return undefined;
      const base=rows.get(edit.subject);
      if(!base?.ordinary||!base.physical)return undefined;
      // An outer point preparation's base must remain unchanged across a getter's
      // reentrant installation, just as the generic preparation's copied row does.
      const alreadyPreparing=preparing.has(base);
      const mustCopy=alreadyPreparing||escaped.has(base);
      if(!alreadyPreparing)preparing.add(base);
      try{
        const {prepared,requirement}=nativeRequirement(packet,false);
        if(!prepared)throw new Error('Authored point has no native requirement');
        const key=edit.fields[0];
        // Retain generic physical-pass/proposal/equality read order. The before
        // value may be an accessor and may reenter source preparation.
        own(physical.after,key);
        const endpoint=Object.freeze({present:own(edit.after,key),value:fieldValue(edit.after,key),requirement});
        const previous=physicalField(base,key);
        const same=!!previous&&own(physical.before,key)===own(physical.after,key)&&Object.is(fieldValue(physical.before,key),fieldValue(physical.after,key));
        const view=same?previous:{requirement,present:own(physical.after??edit.after,key)};
        const fact:FieldFact={ordinary:endpoint,physical:view};
        acquisitions++;
        // Generic per-edit selection performs this presence read after the
        // ordinary overlay too; retain callback/trap order even before exposure.
        const selectedPresent=own(physical.after??edit.after,key);
        let target=mustCopy||escaped.has(base)?cloneRow(base):base;
        const revision={};
        const member=members.get(edit.subject),placement=placements.get(edit.subject);
        const ordinaryKey=mappings.get(edit.subject)??missing,physicalKey=mappingViews.get(edit.subject)?.requirement??missing;
        let sealed=false,selected:EntityPublicationEvidence|undefined,selectedSupport:((subject?:number,field?:string)=>Requirement)|undefined;
        const seal=()=>{
          if(sealed)return;sealed=true;
          if(target===base)target=cloneRow(base);
          setFact(target,key,fact);
          escaped.add(base);escaped.add(target);
          const pointRow=target;
          const pointRows:Lookup<RowFacts>={get:id=>id===edit.subject?pointRow:rows.get(id)};
          const physicalRow=physicalImage(pointRow);
          // Selected per-edit physical support is a captured requirement, not
          // the source's deliberately mutable equal-value physical View cell.
          physicalRow.set(key,{requirement,present:selectedPresent});
          const facts=evidence(pointRows,pointRows);
          selected=facts;
          const perEdit:EntityPublicationEvidence={
            member:(id,kind)=>id===edit.subject&&kind==='ordinary'?(member?.requirement??missing):evidence().member(id,kind),
            field:(id,field,kind)=>id===edit.subject?(kind==='ordinary'?(ordinaryField(pointRow,field)?.requirement as Requirement|undefined)??missing:physicalRow.get(field)?.requirement??missing):evidence().field(id,field,kind),
            placement:(id,kind)=>id===edit.subject&&kind==='ordinary'?(placement??missing):evidence().placement(id,kind),
            keyMapping:(id,kind)=>id===edit.subject?(kind==='ordinary'?ordinaryKey:physicalKey):evidence().keyMapping(id,kind),
          };
          facts.forEdit=requested=>requested===edit?perEdit:facts;
          const noMembers:Lookup<Member>={get:()=>undefined};
          const noPlacements=new Map<number,Requirement>(),removed=new Set<number>();
          selectedSupport=(subject,field)=>support(pointRows,noMembers,noPlacements,removed,()=>[...new Set([...members.keys(),...rows.keys(),edit.subject])],subject,field);
        };
        const completion={requirement,
          get facts(){seal();if(!selected)throw new Error('Missing sealed point evidence');return selected;},
          get support(){seal();if(!selectedSupport)throw new Error('Missing sealed point support');return selectedSupport;},
        };
        exposeCompletion.set(completion,seal);
        const pointWrite={map:{set(){
          if(same&&previous)previous.requirement=requirement;
          setFact(target,key,fact);target.revision=revision;
          rows.set(edit.subject,target);
        }},key:undefined,value:undefined};
        return {
          // The requirement currently contributes frame adds only. Preserve any
          // future primitive writes rather than silently discarding them.
          record:{deletes:prepared.record.deletes,writes:prepared.record.writes.length?[...prepared.record.writes,pointWrite]:[pointWrite],adds:prepared.record.adds},
          completion,
          finalize:()=>lifecycle.finalizeNativeRequirement(requirement),
        };
      }finally{if(!alreadyPreparing)preparing.delete(base);}
    },
    prepare(packet){
      const inspection=packet.meta?.participation==='inspection';
      const {prepared,requirement}=nativeRequirement(packet,inspection);
      const ordinaryEdits=entityPublicationOrdinary(packet);
      const singleton=ordinaryEdits.length===1?ordinaryEdits[0]:undefined;
      const lastOrdinaryBySubject=singleton?undefined:new Map<number,EntityPublicationEdit>();
      const repeatedSubjects=singleton?undefined:new Set<number>();
      if(lastOrdinaryBySubject&&repeatedSubjects)for(const edit of ordinaryEdits){
        if(lastOrdinaryBySubject.has(edit.subject))repeatedSubjects.add(edit.subject);
        lastOrdinaryBySubject.set(edit.subject,edit);
      }
      const selectedFields=new Map<number,Map<string,NativeFieldEndpoint>>();
      const beforeField=(subject:number,key:string):NativeFieldEndpoint=>ordinaryField(rows.get(subject),key)??Object.freeze({present:false,value:undefined,requirement:members.get(subject)?.requirement??missing});
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
      const nextRows=new Map<number,RowFacts>();
      const ordinaryTouched=new Set<number>(),physicalTouched=new Set<number>();
      const nextMembers=new Map<number,Member>();
      const nextPlacements=new Map<number,Requirement>();
      const removed=new Set<number>();
      const nextMappings=new Map<number,Requirement>(),nextMappingViews=new Map<number,View>();
      const physicalMembers=new Map<number,View>(),physicalPlacements=new Map<number,View>();
      const paired=new Map<EntityPublicationEdit,EntityPublicationEdit>();
      if(packet.steps)for(const step of packet.steps)pairPhysicalUnit(paired,step.ordinary,step.physical,step.authoredRemoval);
      else pairPhysicalUnit(paired,packet.ordinary,packet.physical);
      const physicalAt=new Map<EntityPublicationEdit,Map<string,View>>();
      const selectedAt=new Map<EntityPublicationEdit,EntityPublicationEvidence>();
      const rowFacts=(id:number,side:'ordinary'|'physical'):RowFacts=>{
        let row=nextRows.get(id);
        if(!row)nextRows.set(id,row=cloneRow(rows.get(id)));
        else if(side==='ordinary'&&!ordinaryTouched.has(id)){
          // The physical pass can run payload traps. Ordinary support is first
          // acquired only now, matching the former independent rowFields copy.
          for(const key of row.ordinaryKeys){const fact=row.cells.get(key);if(fact?.physical)row.cells.set(key,{physical:fact.physical});else row.cells.delete(key);}
          const current=rows.get(id);
          row.ordinaryKeys=current?.ordinaryKeys.slice()??[];
          row.ordinary=current?.ordinary??false;
          for(const key of row.ordinaryKeys){const ordinary=current?.cells.get(key)?.ordinary;row.cells.set(key,{ordinary,physical:row.cells.get(key)?.physical});}
        }
        if(side==='ordinary')ordinaryTouched.add(id);else physicalTouched.add(id);
        return row;
      };
      for(const edit of packet.physical){
        if(edit.structural?.kind==='remove'){
          physicalMembers.set(edit.subject,{requirement,present:false});
          writes.push({map:visible,key:edit.subject,value:{requirement,present:false}});
          deletes.push({map:placementViews,key:edit.subject});continue;
        }
        if(edit.structural?.kind==='rekey'){nextMappingViews.set(edit.subject,{requirement});continue;}
        const row=rowFacts(edit.subject,'physical');row.physical=true;
        const keys=edit.fields===null?[...new Set([...sideKeys(row,'physical'),...Object.keys(edit.after??{})])]:edit.fields;
        for(const key of keys)setFact(row,key,{ordinary:row.cells.get(key)?.ordinary,physical:{requirement,present:own(edit.after,key)}});
        physicalAt.set(edit,physicalImage(row));
        if(edit.structural?.kind==='add'){nextMappingViews.set(edit.subject,{requirement});physicalMembers.set(edit.subject,{requirement,present:true});physicalPlacements.set(edit.subject,{requirement});}
        if(edit.structural?.kind==='add')writes.push({map:visible,key:edit.subject,value:{requirement,present:true}},{map:placementViews,key:edit.subject,value:{requirement}});
      }
      if(packet.physicalOrder)for(const subject of packet.physicalOrder){physicalPlacements.set(subject,{requirement});writes.push({map:placementViews,key:subject,value:{requirement}});}
      for(const edit of ordinaryEdits){
        if(edit.structural?.kind==='remove'){
          removed.add(edit.subject);nextRows.delete(edit.subject);ordinaryTouched.delete(edit.subject);physicalTouched.delete(edit.subject);
          nextMembers.set(edit.subject,{present:false,requirement});
          writes.push({map:visible,key:edit.subject,value:{requirement,present:false}});
          deletes.push({map:rows,key:edit.subject},{map:placements,key:edit.subject},{map:placementViews,key:edit.subject});continue;
        }
        if(edit.structural?.kind==='rekey'){nextMappings.set(edit.subject,requirement);continue;}
        removed.delete(edit.subject);
        const row=rowFacts(edit.subject,'ordinary');row.ordinary=true;row.physical=true;physicalTouched.add(edit.subject);
        if(edit.structural?.kind==='add'){
          nextMembers.set(edit.subject,{present:true,requirement});nextPlacements.set(edit.subject,requirement);nextMappings.set(edit.subject,requirement);
          writes.push({map:visible,key:edit.subject,value:{requirement,present:true}},{map:placementViews,key:edit.subject,value:{requirement}});
        }
        const keys=edit.fields===null?[...new Set([...sideKeys(row,'ordinary'),...Object.keys(edit.after??{})])]:edit.fields;
        const physical=paired.get(edit);
        for(const key of keys){
          const endpoint=chosen(edit,key),fieldRequirement=endpoint.requirement as Requirement;
          const previous=physicalField(rows.get(edit.subject),key);
          const same=!!previous&&!!physical&&own(physical.before,key)===own(physical.after,key)&&Object.is(fieldValue(physical.before,key),fieldValue(physical.after,key));
          if(same){
            setFact(row,key,{ordinary:endpoint,physical:previous});
            writes.push({map:{set(_key:unknown,value:unknown){previous.requirement=value as Requirement;}},key:undefined,value:fieldRequirement});
          }else setFact(row,key,{ordinary:endpoint,physical:{requirement:fieldRequirement,present:own(physical?.after??edit.after,key)}});
          acquisitions++;
        }
        const ordinaryRow=!repeatedSubjects?.has(edit.subject)?row:cloneRow(row);
        const physicalRow=new Map(physical&&physicalAt.get(physical)||physicalImage(row));
        for(const key of keys){const endpoint=ordinaryField(row,key);if(!endpoint)throw new Error('Missing prepared field endpoint');physicalRow.set(key,{requirement:endpoint.requirement as Requirement,present:own(physical?.after??edit.after,key)});}
        const member=nextMembers.get(edit.subject)??members.get(edit.subject),placement=nextPlacements.get(edit.subject)??placements.get(edit.subject);
        const ordinaryKey=nextMappings.get(edit.subject)??mappings.get(edit.subject)??missing,physicalKey=nextMappingViews.get(edit.subject)?.requirement??mappingViews.get(edit.subject)?.requirement??missing;
        selectedAt.set(edit,{
          member:(id,kind)=>id===edit.subject&&kind==='ordinary'?(member?.requirement??missing):evidence().member(id,kind),
          field:(id,key,kind)=>id===edit.subject?(kind==='ordinary'?(ordinaryField(ordinaryRow,key)?.requirement as Requirement|undefined)??missing:physicalRow.get(key)?.requirement??missing):evidence().field(id,key,kind),
          placement:(id,kind)=>id===edit.subject&&kind==='ordinary'?(placement??missing):evidence().placement(id,kind),
          keyMapping:(id,kind)=>id===edit.subject?(kind==='ordinary'?ordinaryKey:physicalKey):evidence().keyMapping(id,kind),
        });
      }
      if(packet.ordinaryOrder)for(const subject of packet.ordinaryOrder)nextPlacements.set(subject,requirement);
      for(const [key,value]of nextRows)if(!removed.has(key)){
        // Equal key orders can share one immutable sequence. Divergent sides
        // retain their own order; point installation forks it before extension.
        if(value.ordinaryKeys.length===value.physicalKeys.length&&value.ordinaryKeys.every((field,index)=>field===value.physicalKeys[index]))value.ordinaryKeys=value.physicalKeys;
        writes.push({map:rows,key,value});
      }
      for(const [key,value]of nextMembers)writes.push({map:members,key,value});
      for(const [key,value]of nextPlacements)writes.push({map:placements,key,value});
      for(const [key,value]of nextMappings)if(value!==mappings.get(key))writes.push({map:mappings,key,value});
      for(const [key,value]of nextMappingViews)if(value!==mappingViews.get(key))writes.push({map:mappingViews,key,value});
      const ordinaryRows:Lookup<RowFacts>={get:id=>removed.has(id)?undefined:ordinaryTouched.has(id)?nextRows.get(id):rows.get(id)};
      const physicalRows:Lookup<RowFacts>={get:id=>removed.has(id)?undefined:physicalTouched.has(id)?nextRows.get(id):rows.get(id)};
      const selected=evidence(ordinaryRows,physicalRows,overlay(members,nextMembers),overlay(visible,physicalMembers),overlay(placements,nextPlacements,removed),overlay(placementViews,physicalPlacements,removed),overlay(mappings,nextMappings),overlay(mappingViews,nextMappingViews));
      selected.forEdit=edit=>selectedAt.get(edit)??selected;
      const selectedSupport=(subject?:number,field?:string)=>support(ordinaryRows,nextMembers,nextPlacements,removed,()=>[...new Set([...members.keys(),...rows.keys(),...(singleton?[singleton.subject]:lastOrdinaryBySubject?.keys()??[])])],subject,field);
      const completion=inspection?{}:{requirement,support:selectedSupport,facts:selected};
      exposeCompletion.set(completion,()=>{for(const row of nextRows.values())escaped.add(row);});
      return {record:combineTerminalRecords(responsibility,prepared?.record,{writes,deletes,adds:[]}),completion,finalize:()=>{
        if(prepared)lifecycle.finalizeNativeRequirement(requirement);
      }};
    },
    complete(completion){lifecycle.deliverNativeRequirementReady((completion as {requirement?:Requirement}).requirement);},
    prepareRetirement(subject){
      const row=rows.get(subject),revision=row?.revision;
      const snapshots=[row,members.get(subject),placements.get(subject),visible.get(subject),placementViews.get(subject),mappings.get(subject),mappingViews.get(subject)] as const;
      const requirements=new Set<Requirement>();
      if(row?.ordinary)for(const key of row.ordinaryKeys){const endpoint=ordinaryField(row,key);if(endpoint)requirements.add(endpoint.requirement as Requirement);}
      if(snapshots[1])requirements.add(snapshots[1].requirement);
      if(snapshots[2])requirements.add(snapshots[2]);
      if(row?.physical)for(const key of row.physicalKeys){const view=physicalField(row,key);if(view)requirements.add(view.requirement);}
      if(snapshots[3])requirements.add(snapshots[3].requirement);
      if(snapshots[4])requirements.add(snapshots[4].requirement);
      if(snapshots[5])requirements.add(snapshots[5]);
      if(snapshots[6])requirements.add(snapshots[6].requirement);
      const ready=[...requirements].every(lifecycle.nativeRequirementReady);
      const waiting=new Set<lifecycle.OwnerCell>();
      const releasable=(requirement:Requirement):boolean=>{
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
        if(requirement.components)return requirement.components.every(releasable);
        const proof=lifecycle.nativeProof(requirement);
        if(proof.invalid||proof.unavailableInput||proof.terminalRejectedRoles||proof.owners.length||(proof.destination?.length??0)||(proof.input?.length??0)||(proof.validation?.length??0))return false;
        if(!proof.unknown&&!(proof.possible?.length??0))return true;
        if(!requirement.retirementOwnWindowOnly||!proof.historicalWindow)return false;
        for(const cell of proof.possible??[]){
          if(cell.outcome==='confirmed'||cell.outcome==='rolled-back')continue;
          if(!lifecycle.ownerCellCanTransition(cell))return false;
          waiting.add(cell);
        }
        return true;
      };
      const canRelease=ready&&[...requirements].every(releasable);
      const canRetire=canRelease&&waiting.size===0;
      return {ready,canRetire,
        onSettlement:canRelease&&waiting.size?(callback:()=>void)=>{
          const releases=[...waiting].map(cell=>lifecycle.onOwnerCellTransition(cell,callback));
          return()=>{for(const release of releases)release();};
        }:undefined,
        current:()=>snapshots[0]===rows.get(subject)&&revision===rows.get(subject)?.revision&&snapshots[1]===members.get(subject)&&snapshots[2]===placements.get(subject)&&snapshots[3]===visible.get(subject)&&snapshots[4]===placementViews.get(subject)&&snapshots[5]===mappings.get(subject)&&snapshots[6]===mappingViews.get(subject),
        onReady(callback){
          const releases=[...requirements].filter(requirement=>!lifecycle.nativeRequirementReady(requirement)).map(requirement=>lifecycle.onNativeRequirementReady(requirement,callback));
          return()=>{for(const release of releases)release();};
        },
      };
    },
    retire(subject){rows.delete(subject);members.delete(subject);placements.delete(subject);visible.delete(subject);placementViews.delete(subject);mappings.delete(subject);mappingViews.delete(subject);retirements++;},
  };
  return participant;
};
