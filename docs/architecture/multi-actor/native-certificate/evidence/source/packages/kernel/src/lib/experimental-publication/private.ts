import type { EntityContributorEdit } from '../internals/entity-egress-projection';
import { currentEntityPublicationInputs, getEntityPublicationBinding, type EntityPublicationEvidence } from '../internals/entity-publication';
import { isWritableLocation } from '../internals/location-runtime';
import { nodeStoreOf, isTraversableNode } from '../internals/node-shape';
import { getPositionRegistry, getNodeAddress } from '../internals/position-registry';
import { applyAtRelativePath, relativeSourceAddress } from '../internals/source-mutation';
import { getRetainedMembershipPath } from '../internals/member-membership';
import type { WriteMetadata } from '../mutation-types';
import { getActiveWriteContext } from '../write-context';
import { combineTerminalRecords, preparePublicationMutations, registerMembershipPublication, registerBranchPublicationInputs, registerNativePublicationFactory, registerPublicationSnapshots, type MembershipPublicationEdit, type IntrinsicMutation, type PreparedPublicationUnit } from '../internals/intrinsic-mutation';
import * as projection from './projection';
import * as lifecycle from './lifecycle';
export {stampSource,subscribeProjection,deliverEqual} from './projection';
export {enroll,SignalTreePublicationError} from './lifecycle';
type Cell=lifecycle.OwnerCell;
type Proof=Readonly<lifecycle.Proof>;
type Fact=Readonly<{revision:number;clean:boolean;blockers:readonly Cell[];unknown:boolean}>;
type Slot=Readonly<{branch:object;key:string;child:object;address?:readonly string[]}>;
type Presence=Readonly<{present:boolean;fact:Fact}>;
type Unit={collection?:{key:object;edits:readonly EntityContributorEdit[];acquired?:boolean};selected?:lifecycle.NativeRequirement;native?:lifecycle.NativeRequirement;coverageUnknown?:boolean;fact:Fact;previous?:Fact;payload:unknown;changed:boolean;inputs:readonly Fact[];field?:object;relative?:readonly string[];presence?:{slot:Slot;state:Presence;ordinary?:MembershipPublicationEdit['ordinary']};complete:boolean;resolve:()=>void;promise:Promise<void>};
type SlotTrie={children:Map<string,SlotTrie>;slots:Map<object,Slot>};
type FieldInfo={relative:readonly string[];address:readonly string[]};
type FieldTrie={children:Map<string,FieldTrie>;field?:object};
type Summary={rejected:Map<number,number>;unavailableInput:number;historicalWindow:number;owners:Map<Cell,number>;destination:Map<Cell,number>;input:Map<Cell,number>;validation:Map<Cell,number>;possible:Map<Cell,number>;unknown:number;invalid:number};
type CollectionSupport={payload:unknown;relative:readonly string[]|undefined;entries:Map<string,{requirement:lifecycle.NativeRequirement;proof:Proof}>;summary:Summary};
type Binding={watches:Map<object,()=>void>;collections:Map<object,CollectionSupport>;aggregate:boolean;initialized:Set<object>;valueInitialized:boolean;slotTrie:SlotTrie;fields:Map<object,FieldInfo>;fieldTrie:FieldTrie;fieldFacts:Map<object,Fact>;completedFields:Map<object,Fact>;summary:Summary;releases:(()=>void)[];owner:number;position:number;current?:Fact;valueFact:Fact;completedValueFact:Fact;valuePayload:unknown;baselineStructure:Fact;presence:Map<Slot,Presence>;completedPresence:Map<Slot,Presence>;source?:object;registry?:object;address?:readonly string[];pending:Set<Unit>;projected?:Readonly<{fact:Fact;payload:unknown;changed:boolean}>;release?:()=>void};
const bindings=new Map<object,Binding>();
const proofs=new WeakMap<Fact,Proof>();
const ownProofs=new WeakMap<Fact,Proof>();
const factRequirements=new WeakMap<Fact,lifecycle.NativeRequirement>();
const factChannels=new WeakMap<Fact,object>();
const noopPredecessors=new WeakMap<Fact,Fact|undefined>();
function effectivePredecessor(fact:Fact|undefined):Fact|undefined{while(fact&&noopPredecessors.has(fact))fact=noopPredecessors.get(fact);return fact;}
const facts=new WeakSet<object>();
const grants=new WeakMap<Fact,Set<object>>();
const callbacks=new Map<object,()=>void>();
const consumedIngress=new Set<object>();
let serial=0;let ingress:{channel:object;consumed:boolean;collections:Set<object>}|undefined;
export const stamp=Symbol('unused notification publication stamp');
export const receipts:unknown[]=[];export let enabled=true;
export function mode(value:boolean):void{enabled=value;}
export function register(owner:number,_source:unknown,token:object):void{lifecycle.registerOwnerSource(owner,token);}
export function unregister(owner:number|undefined):void{if(owner!==undefined)lifecycle.unregisterOwnerSource(owner);}
export function transition(owner:number|undefined,event:{kind:string;transactionId:number}):void{if(owner!==undefined)lifecycle.ownerTransition(owner,event);}
const sameOwners=(a:readonly Cell[]|undefined,b:readonly Cell[]|undefined):boolean=>(a??[]).length===(b??[]).length&&(a??[]).every(x=>(b??[]).includes(x));
const sameProof=(a:Proof|undefined,b:Proof|undefined):boolean=>!!a&&!!b&&a.unknown===b.unknown&&a.invalid===b.invalid&&!!a.unavailableInput===!!b.unavailableInput&&!!a.historicalWindow===!!b.historicalWindow&&(a.terminalRejectedRoles??0)===(b.terminalRejectedRoles??0)&&(['owners','destination','input','validation','possible'] as const).every(role=>sameOwners(a[role],b[role]));
type Trie={children:Map<string,Trie>;channels:Set<object>};
const tries=new WeakMap<object,Trie>();
let indexedBindings=0;
function slotFor(branch:object,key:string,child:object):Slot{return Object.freeze({branch,key,child,address:getNodeAddress(branch)?[...getNodeAddress(branch)!,key]:undefined});}
function removeIndex(registry:object,address:readonly string[],channel:object):void{const root=tries.get(registry);if(!root)return;const path:{parent:Trie;key:string;node:Trie}[]=[];let node=root;for(const key of address){const child=node.children.get(key);if(!child)return;path.push({parent:node,key,node:child});node=child;}node.channels.delete(channel);for(let i=path.length-1;i>=0;i--){const part=path[i];if(part.node.channels.size||part.node.children.size)break;part.parent.children.delete(part.key);}if(!root.channels.size&&!root.children.size)tries.delete(registry);}
function trieFor(registry:object,address:readonly string[],create:boolean):Trie|undefined{let node=tries.get(registry);if(!node&&create)tries.set(registry,node={children:new Map(),channels:new Set()});for(const key of address){let next=node?.children.get(key);if(!next&&create&&node)node.children.set(key,next={children:new Map(),channels:new Set()});node=next;}return node;}
function collect(node:Trie|undefined,result:object[]):void{if(!node)return;result.push(...node.channels);for(const child of node.children.values())collect(child,result);}
function reaches(child:object,suffix:readonly string[],source:object):boolean{let node:unknown=child;for(const key of suffix){if((typeof node!=='object'||node===null)&&typeof node!=='function')return false;const descriptor=Object.getOwnPropertyDescriptor(node,key);if(!descriptor||!('value'in descriptor))return false;node=descriptor.value;}return node===source;}
const combineProofs=lifecycle.combineProofs;
function adjust(summary:Summary,proof:Proof|undefined,direction:number):void {
 if(!proof){summary.unknown+=direction;return;}
 for(const bit of [1,2,4,8])if((proof.terminalRejectedRoles??0)&bit){const count=(summary.rejected.get(bit)??0)+direction;if(count)summary.rejected.set(bit,count);else summary.rejected.delete(bit);}
 if(proof.unavailableInput)summary.unavailableInput+=direction;if(proof.historicalWindow)summary.historicalWindow+=direction;
 if(proof.unknown)summary.unknown+=direction;if(proof.invalid)summary.invalid+=direction;
 for(const role of ['owners','destination','input','validation','possible'] as const){
  for(const owner of proof[role]??[]){const count=(summary[role].get(owner)??0)+direction;if(count)summary[role].set(owner,count);else summary[role].delete(owner);}
 }
}
function own(fact:Fact,channel:object):Proof|undefined{return ownProofs.get(fact)??lifecycle.proof(factChannels.get(fact)??channel,fact);}
function fieldAt(root:FieldTrie,path:readonly string[],create=false):FieldTrie|undefined{let node:FieldTrie|undefined=root;for(const key of path){let next:FieldTrie|undefined=node?.children.get(key);if(!next&&create&&node)node.children.set(key,next={children:new Map()});node=next;}return node;}
function fieldNodes(node:FieldTrie|undefined,out:object[]):void{if(!node)return;if(node.field)out.push(node.field);for(const child of node.children.values())fieldNodes(child,out);}
function slotNode(b:Binding,address:readonly string[],create=false):SlotTrie|undefined{let node:SlotTrie|undefined=b.slotTrie;for(const key of address){let next:SlotTrie|undefined=node?.children.get(key);if(!next&&create&&node)node.children.set(key,next={children:new Map(),slots:new Map()});node=next;}return node;}
function indexSlot(b:Binding,slot:Slot):void{if(slot.address)slotNode(b,slot.address,true)!.slots.set(slot.child,slot);}
function slotsAlong(b:Binding,address:readonly string[]):Slot[]{const result:Slot[]=[];let node:SlotTrie|undefined=b.slotTrie;const add=()=>{for(const slot of node?.slots.values()??[])if(b.presence.has(slot))result.push(slot);};add();for(const key of address){node=node?.children.get(key);if(!node)break;add();}return result;}

function descendantSlots(node:SlotTrie|undefined,out:Slot[]):void{if(!node)return;out.push(...node.slots.values());for(const child of node.children.values())descendantSlots(child,out);}
function presenceForField(b:Binding,address:readonly string[]):Presence[]{return slotsAlong(b,address).map(slot=>b.presence.get(slot)!).filter(Boolean);}
function exposed(b:Binding,address:readonly string[],except?:Slot):boolean{return slotsAlong(b,address).every(slot=>slot===except||b.completedPresence.get(slot)?.present!==false);}
function internalSlot(b:Binding,slot:Slot):boolean{return !!slot.address&&relativeSourceAddress(b.address??[],slot.address)!==undefined;}
function pathValue(value:unknown,path:readonly string[]):{present:boolean;value:unknown}{for(const key of path){if(value===null||typeof value!=='object'||!Object.prototype.hasOwnProperty.call(value,key))return {present:false,value:undefined};value=(value as Record<string,unknown>)[key];}return {present:true,value};}
function maskPayload(b:Binding):unknown{let result=b.valuePayload;for(const [slot,state]of b.completedPresence){if(state.present||!slot.address)continue;const relative=relativeSourceAddress(b.address??[],slot.address);if(!relative?.length)continue;const omit=(value:unknown,depth:number):unknown=>{if(value===null||typeof value!=='object')return value;const row={...value};const key=relative[depth];if(depth===relative.length-1)delete(row as Record<string,unknown>)[key];else if(Object.prototype.hasOwnProperty.call(row,key))Object.defineProperty(row,key,{value:omit((row as Record<string,unknown>)[key],depth+1),enumerable:true,configurable:true,writable:true});return row;};result=omit(result,0);}return result;}

type InputEvidence={facts:readonly Fact[];unknown:boolean};
type BranchInput={recipients:ReadonlyMap<object,InputEvidence>;native:readonly lifecycle.NativeInput[]};
const branchInputs:BranchInput[]=[];
// One current requirement per native value identity, independent of subscribers.
// No payload/history is retained; weak keys release facts with their native source.
const nativeValues=new WeakMap<object,lifecycle.NativeRequirement>();
const nativeMembers=new WeakMap<object,lifecycle.NativeRequirement>();
const nativeNegativeDomains=new WeakMap<object,Map<object,lifecycle.NativeRequirement>>();
// A physical view identity holds only its support, never a second copy of values.
// Equal-value support updates replace this cell's requirement; changing physical
// views creates a new cell, so a cached snapshot cannot borrow current proof.
type NativeView={requirement:lifecycle.NativeRequirement};
const nativeViews=new WeakMap<object,NativeView>();
const memberViews=new WeakMap<object,NativeView>();
const negativeViews=new WeakMap<object,Map<object,NativeView>>();
const snapshotViews=new WeakMap<object,readonly NativeView[]>();
const unavailableInput=lifecycle.unavailableRequirement;
function suppliedViews(node:object,supplied?:unknown):NativeView[]{
 const entity=getEntityPublicationBinding(node);
 if(entity)return [...entity.source.captureViews(entity.subject,entity.field)] as NativeView[];
 if(supplied!==null&&typeof supplied==='object'){
  const certificate=snapshotViews.get(supplied);if(certificate)return [...certificate];
 }
 const own:NativeView[]=[];
 for(const edge of getRetainedMembershipPath(node)){const view=memberViews.get(edge.child);if(view)own.push(view);if(!edge.present)return own;}
 if(isWritableLocation(node)){const view=nativeViews.get(node);if(view)own.push(view);return own;}
 const storage=nodeStoreOf(node)??node;
 own.push(...(negativeViews.get(storage)?.values()??[]));
 for(const key of Object.keys(storage)){
  const descriptor=Object.getOwnPropertyDescriptor(storage,key);if(!descriptor||!('value'in descriptor)||!isTraversableNode(descriptor.value))continue;
  const value=supplied!==null&&typeof supplied==='object'?(supplied as Record<string,unknown>)[key]:undefined;
  own.push(...suppliedViews(descriptor.value,value));
 }
 return own;
}
registerPublicationSnapshots((node,value)=>{snapshotViews.set(value,Object.freeze(suppliedViews(node,value)));});
function nativeInputs(node:object,supplied?:unknown):lifecycle.NativeInput[]{
 const entity=getEntityPublicationBinding(node);
 if(entity){const captured=entity.source.captureInput(entity.subject,entity.field) as {native?:readonly lifecycle.NativeInput[]}|undefined;return [...(captured?.native??[])];}
 return [...new Set(suppliedViews(node,supplied).map(view=>view.requirement))].map(lifecycle.captureNativeInput);
}
function nativeAuthorship(node:object):{known:Cell[];unknown:boolean}{
 const meta=getActiveWriteContext();const owner=getPositionRegistry(node)?.id;const id=meta?.transactionId;
 const cell=owner!==undefined&&typeof id==='number'?lifecycle.ownerCell(owner,id):undefined;
 return {known:cell?[cell]:[],unknown:meta?.origin!==undefined||(id!==undefined&&(!cell||meta?.transactionOwner!==lifecycle.ownerToken(owner!)))};
}
registerNativePublicationFactory(node=>{
 const initial=lifecycle.initialRequirement();nativeValues.set(node,initial);nativeViews.set(node,{requirement:initial});
 return {
  captureInput:()=>({native:Object.freeze(nativeInputs(node))}),
  prepare:(mutation,input)=>{
   if(getActiveWriteContext()?.participation==='inspection'){
    return {record:{writes:mutation.changed?[{map:nativeViews,key:node,value:{requirement:unavailableInput()}}]:[],adds:[]},completion:{}};
   }
   if(!mutation.changed&&!lifecycle.isValidating()&&!branchInputs.length)return;
   const authored=nativeAuthorship(node);
   const consumed=mutation.intent==='derive'?(input as {native?:readonly lifecycle.NativeInput[]}|undefined)?.native??[]:[];
   const prepared=lifecycle.prepareNativeRequirement(authored.known,authored.unknown,[...consumed,...branchInputs.flatMap(scope=>scope.native),...currentEntityPublicationInputs().flatMap(input=>(input as {native?:readonly lifecycle.NativeInput[]}).native??[])]);
   const existingView=nativeViews.get(node);
   const view=mutation.changed||!existingView?{requirement:prepared.requirement}:existingView;
   return {record:combineTerminalRecords(prepared.record,{writes:[{map:nativeValues,key:node,value:prepared.requirement},{map:nativeViews,key:node,value:view},...(!mutation.changed&&existingView?[{map:{set:(_key:unknown,value:unknown)=>{existingView.requirement=value as lifecycle.NativeRequirement;}},key:node,value:prepared.requirement}]:[])],adds:[]})!,completion:{requirement:prepared.requirement},finalize:()=>lifecycle.finalizeNativeRequirement(prepared.requirement)};
  },
  complete:()=>{},
 };
});
function beginBranchInput(node:object,supplied?:unknown):object|undefined{
 const registry=getPositionRegistry(node),address=getNodeAddress(node);const recipients=new Map<object,InputEvidence>();
 if(registry&&address){const keys:object[]=[];let trie=tries.get(registry);if(trie){keys.push(...trie.channels);for(const part of address){trie=trie.children.get(part);if(!trie)break;keys.push(...trie.channels);}collect(trie,keys);}
  for(const key of new Set(keys)){const b=bindings.get(key);if(!b?.address)continue;const within=relativeSourceAddress(b.address,address);const encloses=relativeSourceAddress(address,b.address);if(within===undefined&&encloses===undefined)continue;const captured:Fact[]=[];let covered=false;
   if(b.aggregate){if(within!==undefined)covered=true;const fields:object[]=[];fieldNodes(fieldAt(b.fieldTrie,within??[]),fields);captured.push(b.baselineStructure);for(const field of fields){const info=b.fields.get(field)!;const states=presenceForField(b,info.address);const absent=states.filter(state=>!state.present);captured.push(...(absent.length?absent.map(state=>state.fact):[b.fieldFacts.get(field)!,...states.map(state=>state.fact)]));}}
   else captured.push(...((captureValueInput(key) as {facts:readonly Fact[]}|undefined)?.facts??[]));
   recipients.set(key,{facts:Object.freeze([...new Set(captured)]),unknown:!covered});
  }
 }
 const input:BranchInput={recipients,native:Object.freeze(nativeInputs(node,supplied))};branchInputs.push(input);return input;
}
function endBranchInput(token:object):void{if(branchInputs.at(-1)!==token)throw new Error('Branch publication input scope mismatch');branchInputs.pop();}
const emptySummary=():Summary=>({rejected:new Map(),owners:new Map(),destination:new Map(),input:new Map(),validation:new Map(),possible:new Map(),unknown:0,invalid:0,unavailableInput:0,historicalWindow:0});
const summaryProof=(summary:Summary):Proof=>({terminalRejectedRoles:[...summary.rejected.keys()].reduce((all,bit)=>all|bit,0),owners:[...summary.owners.keys()],destination:[...summary.destination.keys()],input:[...summary.input.keys()],validation:[...summary.validation.keys()],possible:[...summary.possible.keys()],unknown:summary.unknown>0,invalid:summary.invalid>0,unavailableInput:summary.unavailableInput>0,historicalWindow:summary.historicalWindow>0});
function rebuildEnrollmentSummary(channel:object,b:Binding):void {
 b.summary=emptySummary();
 for(const [field,fact]of b.completedFields)if(exposed(b,b.fields.get(field)!.address))adjust(b.summary,own(fact,channel),1);
 for(const [slot,state]of b.completedPresence)if(internalSlot(b,slot)&&exposed(b,slot.address!,slot))adjust(b.summary,own(state.fact,channel),1);
}
function watchFact(channel:object,b:Binding,fact:Fact):void {
 const requirement=factRequirements.get(fact);if(!requirement||lifecycle.nativeRequirementReady(requirement)||b.watches.has(fact))return;
 const off=lifecycle.onNativeRequirementReady(requirement,()=>{
  b.watches.delete(fact);if(bindings.get(channel)?.watches!==b.watches)return;
  const proof=lifecycle.nativeProof(requirement);ownProofs.set(fact,proof);proofs.set(fact,proof);
  rebuildEnrollmentSummary(channel,bindings.get(channel)!);wakeChannel(channel);
 });b.watches.set(fact,off);
}
function collectionSelected(b:Binding,collection:CollectionSupport):boolean {
 const relative=collection.relative??[];
 return exposed(b,[...(b.address??[]),...relative])&&(!relative.length||pathValue(b.valuePayload,relative).present);
}
function setCollectionEntry(channel:object,b:Binding,collection:CollectionSupport,key:string,requirement?:lifecycle.NativeRequirement):void {
 const old=collection.entries.get(key);if(old){b.watches.get(old)?.();b.watches.delete(old);adjust(collection.summary,old.proof,-1);}
 if(!requirement){collection.entries.delete(key);return;}
 const entry={requirement,proof:lifecycle.nativeProof(requirement)};collection.entries.set(key,entry);adjust(collection.summary,entry.proof,1);
 if(!lifecycle.nativeRequirementReady(requirement)){
  const off=lifecycle.onNativeRequirementReady(requirement,()=>{
   b.watches.delete(entry);if(bindings.get(channel)?.watches!==b.watches||collection.entries.get(key)!==entry)return;
   adjust(collection.summary,entry.proof,-1);entry.proof=lifecycle.nativeProof(requirement);adjust(collection.summary,entry.proof,1);wakeChannel(channel);
  });b.watches.set(entry,off);
 }
}
function selectedReady(b:Binding):boolean {
 const ready=(fact:Fact)=>{const requirement=factRequirements.get(fact);return !requirement||lifecycle.nativeRequirementReady(requirement);};
 for(const [slot,state]of b.completedPresence)if(exposed(b,slot.address??[],slot)&&!ready(state.fact))return false;
 for(const [field,fact]of b.completedFields)if(exposed(b,b.fields.get(field)!.address)&&!ready(fact))return false;
 if(!b.aggregate&&!ready(b.completedValueFact))return false;
 for(const collection of b.collections.values())if(collectionSelected(b,collection))for(const entry of collection.entries.values())if(!lifecycle.nativeRequirementReady(entry.requirement))return false;
 return true;
}
function projectionSupport(b:Binding):{proof:Proof;present:boolean}{if(b.aggregate){const base=combineProofs([summaryProof(b.summary),...[...b.collections.values()].filter(value=>collectionSelected(b,value)).map(value=>summaryProof(value.summary))]);const parent=slotsAlong(b,b.address??[]).map(slot=>b.completedPresence.get(slot)).filter((state):state is Presence=>state!==undefined);const absent=parent.filter(state=>!state.present);return {proof:absent.length?combineProofs(absent.map(state=>ownProofs.get(state.fact)??proofs.get(state.fact))):combineProofs([base,ownProofs.get(b.baselineStructure)??proofs.get(b.baselineStructure),...parent.map(state=>ownProofs.get(state.fact)??proofs.get(state.fact))]),present:absent.length===0};}const absent=[...b.completedPresence.values()].filter(state=>!state.present);const contributing=absent.length?absent.map(state=>state.fact):[b.baselineStructure,b.completedValueFact,...[...b.completedPresence.values()].map(state=>state.fact)];return {proof:combineProofs(contributing.map(fact=>ownProofs.get(fact)??proofs.get(fact))),present:absent.length===0};}
function prepareMembership(edit:MembershipPublicationEdit):PreparedPublicationUnit|undefined{
 const meta=getActiveWriteContext();
 const domainKey=nodeStoreOf(edit.branch)??edit.branch;
 const physicalView={requirement:unavailableInput()};
 const viewDomain=negativeViews.get(domainKey)??new Map<object,NativeView>();
 const viewWrites=[{map:memberViews,key:edit.child,value:physicalView},{map:negativeViews,key:domainKey,value:viewDomain},...(!edit.present?[{map:viewDomain,key:edit.child,value:physicalView}]:[])];
 if(meta?.participation==='inspection')return {record:{writes:viewWrites,deletes:edit.present?[{map:viewDomain,key:edit.child}]:[],adds:[]},completion:{parts:[]}};
 const authored=nativeAuthorship(edit.child);const native=lifecycle.prepareNativeRequirement(authored.known,authored.unknown,branchInputs.flatMap(scope=>scope.native));
 const address=[...edit.address,edit.key],found:object[]=[];let cursor=tries.get(edit.registry);if(cursor)found.push(...cursor.channels);for(const key of address){cursor=cursor?.children.get(key);if(!cursor)break;found.push(...cursor.channels);}collect(trieFor(edit.registry,address,false),found);const channels=[...new Set(found)];
 physicalView.requirement=native.requirement;
 const domain=nativeNegativeDomains.get(domainKey)??new Map<object,lifecycle.NativeRequirement>();
 const records=[combineTerminalRecords(native.record,{writes:[...viewWrites,{map:nativeMembers,key:edit.child,value:native.requirement},{map:nativeNegativeDomains,key:domainKey,value:domain},...(!edit.present?[{map:domain,key:edit.child,value:native.requirement}]:[])],deletes:edit.present?[{map:domain,key:edit.child},{map:viewDomain,key:edit.child}]:[],adds:[]})!];const parts:{channel:object;unit:Unit}[]=[];
 for(const channel of channels){const b=bindings.get(channel);if(!b?.source||!b.address)continue;const inside=relativeSourceAddress(b.address,address);if(inside!==undefined){if(!b.aggregate&&(inside.length!==0||edit.child!==b.source))continue;}else if(!reaches(edit.child,b.address.slice(address.length),b.source))continue;
  const indexed=slotNode(b,address);if(!indexed)continue;const slot=indexed.slots.get(edit.child)??slotFor(edit.branch,edit.key,edit.child);const previous=b.current;
  const attributed=meta?.transactionId;const known=typeof attributed==='number'?lifecycle.ownerCell(b.owner,attributed):undefined;
  const valid=attributed===undefined||!!known&&meta?.transactionOwner===lifecycle.ownerToken(b.owner);
  const unknown=!valid||meta?.origin!==undefined;
  const fact:Fact=Object.freeze({revision:++serial,clean:false,blockers:Object.freeze([]),unknown});facts.add(fact);
  let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});const state=Object.freeze({present:edit.present,fact});
  const unit:Unit={native:native.requirement,coverageUnknown:unknown,fact,previous,payload:undefined,changed:(b.presence.get(slot)?.present??true)!==edit.present,inputs:[],presence:{slot,state,ordinary:edit.ordinary},complete:false,resolve,promise};
  const record=lifecycle.prepareRevision(channel,fact,known?[known]:[],unknown,fact.blockers,native.requirement);
  records.push(combineTerminalRecords(record,{writes:[{map:bindings,key:channel,value:{...b,current:fact}},{map:b.presence,key:slot,value:state},{map:indexed.slots,key:edit.child,value:slot}],adds:[{set:b.pending,value:unit}]})!);parts.push({channel,unit});
 }
 const record=combineTerminalRecords(...records);return record?{record,completion:{parts},finalize:()=>lifecycle.finalizeNativeRequirement(native.requirement)}:undefined;
}
function completeMembership(completion:object):void{for(const {channel,unit}of(completion as {parts:{channel:object;unit:Unit}[]}).parts)completeScalar({channel,unit});}
function ready(channel:object,b:Binding):void{
 for(const unit of b.pending){
  if(!unit.complete||!selectedReady(b)||unit.selected&&!lifecycle.nativeRequirementReady(unit.selected))break;
  const proof=proofs.get(unit.fact)??lifecycle.proof(channel,unit.fact);
  if(!proof)break; // The captured horizon has not finalized; no mutable stack lookup.
  const authoredProof=combineProofs([proof,...(unit.native?[lifecycle.nativeProof(unit.native)]:[])]);ownProofs.set(unit.fact,authoredProof);
  if(unit.collection){
   const collection=b.collections.get(unit.collection.key);
   if(collection){for(const edit of unit.collection.edits){
     setCollectionEntry(channel,b,collection,edit.key,edit.after as lifecycle.NativeRequirement|undefined);
   }
   collection.payload=unit.payload;
   if(collectionSelected(b,collection))b.valuePayload=collection.relative?applyAtRelativePath(b.valuePayload,collection.relative,{all:unit.payload}):unit.payload;}
  }else if(unit.presence){
   const slot=unit.presence.slot;const relative=slot.address&&relativeSourceAddress(b.address??[],slot.address);const affected:object[]=[];if(b.aggregate&&relative!==undefined)fieldNodes(fieldAt(b.fieldTrie,relative),affected);
   for(const field of affected){const info=b.fields.get(field)!;if(exposed(b,info.address))adjust(b.summary,own(b.completedFields.get(field)!,channel),-1);}
   const affectedSlots:Slot[]=[];if(b.aggregate&&slot.address)descendantSlots(slotNode(b,slot.address),affectedSlots);
   for(const dependent of affectedSlots){const old=b.completedPresence.get(dependent);if(old&&internalSlot(b,dependent)&&exposed(b,dependent.address!,dependent))adjust(b.summary,own(old.fact,channel),-1);}
   b.completedPresence.set(slot,unit.presence.state);
   const after=unit.presence.ordinary?.after;
   if(after?.present&&relative!==undefined){
    for(const collection of b.collections.values()){
     if(collection.relative&&relativeSourceAddress(relative,collection.relative)!==undefined&&exposed(b,[...(b.address??[]),...collection.relative])){
      const below=relativeSourceAddress(relative,collection.relative)!;
      if(pathValue(after.value,below).present)b.valuePayload=applyAtRelativePath(b.valuePayload,collection.relative,{all:collection.payload});
     }
    }
   }
   if(after?.present&&slot.address){
    if(b.aggregate&&relative!==undefined){for(const field of affected){if(b.initialized.has(field))continue;const info=b.fields.get(field)!;const below=relativeSourceAddress(slot.address,info.address);const supplied=below&&pathValue(after.value,below);if(supplied?.present){b.valuePayload=applyAtRelativePath(b.valuePayload,info.relative,supplied.value);b.initialized.add(field);}}}
    else if(!b.aggregate&&!b.valueInitialized&&b.address){const below=relativeSourceAddress(slot.address,b.address);const supplied=below&&pathValue(after.value,below);if(supplied?.present){b.valuePayload=supplied.value;b.valueInitialized=true;}}
   }

   for(const dependent of affectedSlots){const current=b.completedPresence.get(dependent);if(current&&internalSlot(b,dependent)&&exposed(b,dependent.address!,dependent))adjust(b.summary,own(current.fact,channel),1);}
   for(const field of affected){const info=b.fields.get(field)!;if(exposed(b,info.address))adjust(b.summary,own(b.completedFields.get(field)!,channel),1);}
  }else if(unit.field){
   const previous=b.completedFields.get(unit.field);if(exposed(b,b.fields.get(unit.field)!.address)){if(previous)adjust(b.summary,own(previous,channel),-1);adjust(b.summary,authoredProof,1);}
   b.completedFields.set(unit.field,unit.fact);b.initialized.add(unit.field);b.valuePayload=applyAtRelativePath(b.valuePayload,unit.relative??[],unit.payload);
  }else{b.completedValueFact=unit.fact;b.valuePayload=unit.payload;}
  const support=projectionSupport(b);const effective=unit.selected?combineProofs([support.proof,lifecycle.nativeProof(unit.selected)]):support.proof;
  proofs.set(unit.fact,effective);lifecycle.projectRevision(channel,unit.fact,effective);
  const prior=unit.previous&&proofs.get(unit.previous);
  const noop=!unit.changed&&unit.fact.clean===(unit.previous?.clean??false)&&sameProof(prior,effective);
  if(noop){
   lifecycle.noWrite(channel,unit.fact);
   const predecessor=effectivePredecessor(unit.previous);noopPredecessors.set(unit.fact,predecessor);
   // A nested/newer installation must never be overwritten by this completion.
   if(b.current===unit.fact)b.current=predecessor;
  }else{
   lifecycle.keepRevision(channel,unit.fact);
   // Reduce installed units in order even when a later tentative equal setter
   // is already current. That setter may collapse to this exact revision.
   const predecessor=effectivePredecessor(unit.previous);
   if(predecessor)lifecycle.supersede(channel,predecessor);
   b.projected=Object.freeze({fact:unit.fact,changed:unit.changed,payload:support.present?(b.aggregate?maskPayload(b):b.valuePayload):undefined});
  }
  unit.payload=undefined;b.pending.delete(unit);unit.resolve();
 }
}
function wakeChannel(channel:object):void{queueMicrotask(()=>{const b=bindings.get(channel);if(b)ready(channel,b);callbacks.get(channel)?.();});}
function captureValueInput(channel:object,field?:object):object|undefined{const b=bindings.get(channel);if(!b)return;const info=field&&b.fields.get(field);const states=info?presenceForField(b,info.address):[...b.presence.values()];const absent=states.filter(state=>!state.present);return {facts:Object.freeze(absent.length?absent.map(state=>state.fact):[b.baselineStructure,field?b.fieldFacts.get(field)!:b.valueFact,...states.map(state=>state.fact)])};}
function prepareScalar(channel:object,mutation:IntrinsicMutation<unknown>,input?:object,field?:object,nativeUnit?:object):PreparedPublicationUnit|undefined{
 const b=bindings.get(channel);if(!b)return;
 const meta=getActiveWriteContext();if(meta?.participation==='inspection')return;
 const clean=!!ingress&&!consumedIngress.has(ingress)&&ingress.channel===channel;
 const attributed=meta?.transactionId;
 const known=typeof attributed==='number'?lifecycle.ownerCell(b.owner,attributed):undefined;
 const valid=attributed===undefined||!!known&&meta?.transactionOwner===lifecycle.ownerToken(b.owner);
 const previous=b.current;
 const ownInput=mutation.intent==='derive'?(input as {facts?:readonly Fact[]}|undefined)?.facts:undefined;
 const scopes=branchInputs.map(scope=>scope.recipients.get(channel)??{facts:[],unknown:false});const captured=ownInput||scopes.length?Object.freeze([...new Set([...(ownInput??[]),...scopes.flatMap(scope=>scope.facts)])]):undefined;
 const native=(nativeUnit as {requirement?:lifecycle.NativeRequirement}|undefined)?.requirement;
 const nativeKnown=native?lifecycle.nativeProof(native).destination??[]:known?[known]:[];
 const unknown=!clean&&(!valid||meta?.origin!==undefined||(mutation.intent==='derive'&&!ownInput)||scopes.some(scope=>scope.unknown));
 const fact:Fact=Object.freeze({revision:++serial,clean,blockers:Object.freeze([]),unknown});facts.add(fact);factChannels.set(fact,channel);
 let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});
 const unit:Unit={native,coverageUnknown:unknown,fact,previous,payload:mutation.after,changed:mutation.changed,inputs:captured??[],field,relative:field?b.fields.get(field)?.relative:undefined,complete:false,resolve,promise};
 const plan=lifecycle.prepareRevision(channel,fact,nativeKnown,unknown,fact.blockers,native,b.aggregate);
 const edits:import('../internals/intrinsic-mutation').TerminalRecordPlan['writes'][number][]=[{map:bindings,key:channel,value:{...b,current:fact,...(!field?{valueFact:fact}:{})}}];if(field)edits.push({map:b.fieldFacts,key:field,value:fact});
 const terminalEdits={writes:edits,adds:[{set:b.pending,value:unit},...(clean&&ingress?[{set:consumedIngress,value:ingress}]:[])]};
 return {record:combineTerminalRecords(plan,terminalEdits)!,completion:{channel,unit,cleanIngress:clean?ingress:undefined}};
}
export function acquiringCollection(channel:object,source:object):boolean {
 const binding=bindings.get(channel);return !!ingress&&!!binding&&ingress.channel===channel&&!ingress.collections.has(source);
}
/** The acquisition certifies its own relationship baseline, not native input evidence. */
export function acquiredEntityEvidence():EntityPublicationEvidence {
 const permission=lifecycle.initialRequirement();return {member:()=>permission,field:()=>permission,placement:()=>permission,keyMapping:()=>permission};
}
export function currentNativePublicationInputs(): readonly lifecycle.NativeInput[] { return branchInputs.flatMap(scope=>scope.native); }
/** Entity sources use the same receipt, validation and delivery lifecycle. */
export function registerSourceProjectionField(channel:object,field:object,relative:readonly string[]):void {
 const b=bindings.get(channel);if(!b||b.fields.has(field))return;
 const address=[...(b.address??[]),...relative];
 b.fields.set(field,{address,relative});b.fieldFacts.set(field,b.baselineStructure);b.completedFields.set(field,b.baselineStructure);b.initialized.add(field);
 fieldAt(b.fieldTrie,relative,true)!.field=field;
 if(exposed(b,address))adjust(b.summary,own(b.baselineStructure,channel),1);
}
export function prepareSourceProjection(channel:object,mutation:IntrinsicMutation<unknown>,requirement:lifecycle.NativeRequirement,field?:object,collection?:{key:object;edits:readonly EntityContributorEdit[];acquired?:boolean},selected?:lifecycle.NativeRequirement):PreparedPublicationUnit|undefined {
 const prepared=prepareScalar(channel,mutation,undefined,field,{requirement});
 if(prepared){const unit=(prepared.completion as {unit:Unit}).unit;unit.collection=collection;unit.selected=selected;
  if(collection?.acquired&&ingress)return {...prepared,record:combineTerminalRecords(prepared.record,{writes:[],adds:[{set:ingress.collections,value:collection.key}]})!};
 }
 return prepared;
}
/** Seed permission belongs only to this relationship, never to native reads. */
export function baselineEntityEvidence(source:EntityPublicationEvidence|undefined,owner:number):EntityPublicationEvidence|undefined {
 if(!source)return undefined;
 const cache=new Map<object,object>();
 const baseline=(reference:object):object=>{let value=cache.get(reference);if(value)return value;
  const requirement=reference as lifecycle.NativeRequirement,proof=lifecycle.nativeProof(requirement);
  const safe=lifecycle.nativeRequirementReady(requirement)&&!proof.invalid&&!proof.terminalRejectedRoles&&proof.owners.every(cell=>cell.outcome==='confirmed')&&(proof.possible??[]).every(cell=>cell.outcome==='confirmed'||cell.outcome==='rolled-back')&&!lifecycle.pendingOwners().some(cell=>cell.owner===owner);
  value=safe?lifecycle.initialRequirement():requirement;cache.set(reference,value);return value;
 };
 return {exclusions:()=>source.exclusions?.().map(([id,fact])=>[id,baseline(fact)] as const)??[],member:(id,view)=>baseline(source.member(id,view)),field:(id,key,view)=>baseline(source.field(id,key,view)),placement:(id,view)=>baseline(source.placement(id,view)),keyMapping:(id,view)=>baseline(source.keyMapping(id,view))};
}
export function registerCollectionProjection(channel:object,key:object,relative:readonly string[]|undefined,initial:ReadonlyMap<string,object>,payload:unknown):void {
 const b=bindings.get(channel);if(!b)return;
 const support:CollectionSupport={payload,relative,entries:new Map(),summary:emptySummary()};
 for(const [slot,reference]of initial)setCollectionEntry(channel,b,support,slot,reference as lifecycle.NativeRequirement);
 b.collections.set(key,support);
}
export function completeSourceProjection(completion:object):void { completeScalar(completion); }
function completeScalar(completion:object):void{
 const {channel,unit,cleanIngress}=completion as {channel:object;unit:Unit;cleanIngress?:{consumed:boolean}};
 if(!bindings.get(channel)?.pending.has(unit))return;
 if(cleanIngress)cleanIngress.consumed=true;
 unit.complete=true;wakeChannel(channel);
}
export function bindSource(channel:object,owner:number,position:number,identity:Parameters<typeof projection.bindSource>[3],report:(error:unknown)=>void=()=>{},source?:object,context?:{registry:object;address:readonly string[];value:unknown;aggregate?:boolean;presence:readonly {parent:object;key:string;child:object;present:boolean}[]}):void{
 projection.bindSource(channel,owner,position,identity);
 lifecycle.registerConnection(channel,{supported:identity.supported,report,wake:()=>{const b=bindings.get(channel);if(b)ready(channel,b);callbacks.get(channel)?.();}});
 const baseline:Fact=Object.freeze({revision:++serial,clean:false,blockers:[],unknown:false});facts.add(baseline);
 const baselineProof={owners:[],unknown:baseline.unknown,invalid:false};proofs.set(baseline,baselineProof);ownProofs.set(baseline,baselineProof);
 const nativeFact=(requirement:lifecycle.NativeRequirement|undefined):Fact=>{
  if(!requirement)return baseline;
  const fact=Object.freeze({...baseline,revision:++serial});const proof=lifecycle.nativeProof(requirement);
  proofs.set(fact,proof);ownProofs.set(fact,proof);factRequirements.set(fact,requirement);return fact;
 };
 const presence=new Map<Slot,Presence>();for(const entry of context?.presence??[])presence.set(slotFor(entry.parent,entry.key,entry.child),{present:entry.present,fact:nativeFact(nativeMembers.get(entry.child))});
 const binding:Binding={watches:new Map(),collections:new Map(),aggregate:context?.aggregate===true,initialized:new Set(),valueInitialized:[...presence.values()].every(state=>state.present),slotTrie:{children:new Map(),slots:new Map()},fields:new Map(),fieldTrie:{children:new Map()},fieldFacts:new Map(),completedFields:new Map(),summary:emptySummary(),releases:[],owner,position,current:baseline,valueFact:baseline,completedValueFact:baseline,valuePayload:context?.value,baselineStructure:baseline,presence,completedPresence:new Map(presence),source,registry:context?.registry,address:context?.address,pending:new Set()};bindings.set(channel,binding);for(const slot of presence.keys())indexSlot(binding,slot);if(context)slotNode(binding,context.address,true);
 if(identity.supported&&source){
  // Membership has native identity even when it predates every recipient.
  // Seed only this source's retained paths; never infer from another binding.
  const enrollMembership=(candidate:object):void=>{
   for(const entry of getRetainedMembershipPath(candidate)){
    const requirement=nativeMembers.get(entry.child);if(!requirement)continue;
    const address=getNodeAddress(entry.parent);if(!address)continue;
    const memberAddress=[...address,entry.key];const indexed=slotNode(binding,memberAddress,true)!;
    if(indexed.slots.has(entry.child))continue;
    const slot=slotFor(entry.parent,entry.key,entry.child);const state={present:entry.present,fact:nativeFact(requirement)};
    indexed.slots.set(entry.child,slot);binding.presence.set(slot,state);binding.completedPresence.set(slot,state);
    if(internalSlot(binding,slot)&&exposed(binding,memberAddress,slot))adjust(binding.summary,own(state.fact,channel),1);
   }
  };
  if(binding.aggregate){
   const seen=new Set<object>();const visit=(candidate:unknown):void=>{if(!isTraversableNode(candidate)||seen.has(candidate))return;seen.add(candidate);enrollMembership(candidate);if(getEntityPublicationBinding(candidate))return;if(isWritableLocation(candidate)){const address=getNodeAddress(candidate);const relative=address&&context?relativeSourceAddress(context.address,address):undefined;if(!address||relative===undefined)return;slotNode(binding,address,true);binding.fields.set(candidate,{address,relative});if(pathValue(binding.valuePayload,relative).present)binding.initialized.add(candidate);const requirement=nativeValues.get(candidate);const nativeProof=requirement&&lifecycle.nativeProof(requirement);const fieldFact=nativeProof?Object.freeze({...baseline,revision:++serial}):baseline;if(nativeProof){proofs.set(fieldFact,nativeProof);ownProofs.set(fieldFact,nativeProof);factRequirements.set(fieldFact,requirement!);}binding.fieldFacts.set(candidate,fieldFact);binding.completedFields.set(candidate,fieldFact);fieldAt(binding.fieldTrie,relative,true)!.field=candidate;if(exposed(binding,address))adjust(binding.summary,nativeProof??baselineProof,1);const release=preparePublicationMutations(candidate,(m,input,native)=>prepareScalar(channel,m,input,candidate,native),completeScalar,()=>captureValueInput(channel,candidate));if(release)binding.releases.push(release);return;}const storage=nodeStoreOf(candidate)??candidate;for(const key of Object.getOwnPropertyNames(storage)){const descriptor=Object.getOwnPropertyDescriptor(storage,key);if(descriptor&&'value'in descriptor&&isTraversableNode(descriptor.value))visit(descriptor.value);}};visit(source);
  }else {const requirement=nativeValues.get(source);if(requirement){const nativeProof=lifecycle.nativeProof(requirement);const fieldFact=Object.freeze({...baseline,revision:++serial});proofs.set(fieldFact,nativeProof);ownProofs.set(fieldFact,nativeProof);factRequirements.set(fieldFact,requirement);binding.valueFact=fieldFact;binding.completedValueFact=fieldFact;}binding.release=preparePublicationMutations(source,(m,input,native)=>prepareScalar(channel,m,input,undefined,native),completeScalar,()=>captureValueInput(channel));}
 }
 for(const fact of new Set([binding.completedValueFact,...binding.completedFields.values(),...[...binding.completedPresence.values()].map(state=>state.fact)]))watchFact(channel,binding,fact);
 if(identity.supported&&context&&source){trieFor(context.registry,context.address,true)!.channels.add(channel);indexedBindings++;}
}
export function onEligibility(_owner:number,cb:()=>void,channel:object):()=>void{callbacks.set(channel,cb);return()=>{callbacks.delete(channel);};}
export function acquire(channel:object,work:()=>void):void{const prev=ingress;ingress={channel,consumed:false,collections:new Set()};try{work();}finally{if(ingress)consumedIngress.delete(ingress);ingress=prev;}}
/** Notification metadata no longer admits publication responsibility. */
export function annotate(meta:WriteMetadata|undefined,_owner:number|undefined,_positions:number[]|undefined,_authored:boolean,_payload:unknown):WriteMetadata{return {...meta};}
export function evidence(_meta:unknown):Fact|undefined{return undefined;}
export function complete(_meta:unknown):void{}
export function refresh():undefined{return undefined;}
function decision(fact:Fact|undefined,channel:object):{early:boolean;pending:boolean}{
 if(!fact)return {early:false,pending:false};
 const p=proofs.get(fact);if(!p)return {early:false,pending:true};
 return {early:!p.invalid&&!p.unknown&&!p.terminalRejectedRoles&&p.owners.every(x=>x.outcome==='confirmed'),pending:[...p.owners,...(p.possible??[])].some(x=>x.outcome==='pending'||x.outcome==='abandoned')};
}
export function pendingDecision(fact:Fact|undefined,channel:object):boolean{return (bindings.get(channel)?.pending.size??0)>0||decision(fact,channel).pending;}
export function allowed(fact:Fact|undefined,_owner:number,_position:number,channel:object):boolean{
 return !enabled||!lifecycle.isValidating()&&!!fact&&bindings.get(channel)?.current===fact&&!bindings.get(channel)?.pending.size&&(fact.clean||decision(fact,channel).early||grants.get(fact)?.has(channel)===true);
}
type Request={claimant:unknown;key:object;run:()=>void};
export function admit(original:(r:Request)=>void,fact:Fact|undefined,_owner:number,_position:number,channel:object,r:Request):boolean{
 if(!enabled){original(r);return true;}
 if(!bindings.has(channel))throw new Error("Enabled publication source has no binding");
 if(!fact)return false;
 if(lifecycle.isValidating()||bindings.get(channel)?.pending.size)return false;
 const d=decision(fact,channel);
 if(fact&&(fact.clean||d.early)&&bindings.get(channel)?.current===fact){r.run();return true;}
 if(d.pending||fact?.blockers.some(x=>x.outcome==='pending'))return false;
 original({...r,run:()=>{if(fact){let set=grants.get(fact);if(!set)grants.set(fact,set=new Set());set.add(channel);}r.run();}});return true;
}
export function started(fact:Fact|undefined,channel:object):void{if(fact)lifecycle.started(channel,fact,grants.get(fact)?.has(channel)?'surviving':'declared');}
export function dispose(channel:object,_other:object):void{const b=bindings.get(channel);b?.release?.();for(const release of b?.releases??[])release();for(const release of b?.watches.values()??[])release();if(b?.registry&&b.address&&projection.supported(channel)){removeIndex(b.registry,b.address,channel);--indexedBindings;}for(const unit of b?.pending??[]){unit.payload=undefined;unit.resolve();}bindings.delete(channel);lifecycle.disposeConnection(channel);callbacks.delete(channel);projection.releaseSource(channel);}
export function heldCount():number{return lifecycle.diagnostics().operations;}
export function diagnostics(){return {...lifecycle.diagnostics(),...projection.projectionCounts(),listeners:callbacks.size,latest:bindings.size};}
export function declare(channel:object,_owner:number,_position:number,input:unknown,work:()=>unknown,_disposed:()=>boolean){return lifecycle.runDeclaration(channel,input,work);}
/** An unmigrated native projection carries explicit unknown support only.
 * It can use the existing conservative gate, never an active declaration or
 * an older installed unit's permission. Prepared source units reduce separately.
 */
export function project(channel:object,_meta:unknown,payload:unknown,relative?:readonly string[]):Fact|undefined{
 const b=bindings.get(channel);if(!b||b.pending.size)return undefined;
 const fact:Fact=Object.freeze({revision:++serial,clean:false,blockers:Object.freeze([]),unknown:true});facts.add(fact);
 const unknownProof={owners:[],unknown:true,invalid:false};proofs.set(fact,unknownProof);ownProofs.set(fact,unknownProof);if(b.aggregate){const field=relative&&fieldAt(b.fieldTrie,relative)?.field;if(field){const previous=b.completedFields.get(field);if(previous)adjust(b.summary,own(previous,channel),-1);adjust(b.summary,unknownProof,1);b.completedFields.set(field,fact);b.fieldFacts.set(field,fact);}else{for(const [node,previous]of b.completedFields){adjust(b.summary,own(previous,channel),-1);adjust(b.summary,unknownProof,1);b.completedFields.set(node,fact);b.fieldFacts.set(node,fact);}}}b.valuePayload=payload;b.valueFact=fact;b.completedValueFact=fact;
 if(b.current)lifecycle.supersede(channel,b.current);
 b.current=fact;b.projected=Object.freeze({fact,payload,changed:true});
 return fact;
}
export function refreshSource(channel:object):Readonly<{fact:Fact;payload:unknown;changed:boolean}>|undefined{const b=bindings.get(channel);if(b)ready(channel,b);return b?.projected&&b.projected.fact===b.current?b.projected:undefined;}
export function pendingWork(channel:object):readonly Promise<void>[]{return [...(bindings.get(channel)?.pending??[])].map(x=>x.promise);}

// Native scope admission is independent of recipient registration and disposal.
registerMembershipPublication(prepareMembership,completeMembership);
registerBranchPublicationInputs(beginBranchInput,endBranchInput);
