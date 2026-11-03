import {prepareScalarSelection,restoredScalarSelection} from '../internals/native-scalar-selection';
import type {NativeFieldEndpoint} from '../internals/native-field-selection';
import { stampScalarNotification } from '../internals/scalar-publication-coverage';
import { RecipientOccurrences, type OccurrenceHandle } from './recipient-occurrence';
import type { EntityContributorEdit } from '../internals/entity-egress-projection';
import { currentEntityPublicationInputs, getEntityPublicationBinding, type EntityPublicationEvidence } from '../internals/entity-publication';
import { isWritableLocation } from '../internals/location-runtime';
import { nodeStoreOf, isTraversableNode } from '../internals/node-shape';
import { getPositionRegistry, getNodeAddress } from '../internals/position-registry';
import { applyAtRelativePath, relativeSourceAddress } from '../internals/source-mutation';
import { getRetainedMembershipPath } from '../internals/member-membership';
import type { WriteMetadata } from '../mutation-types';
import { getActiveWriteContext } from '../write-context';
import { combineTerminalRecords, stagePublicationMutations, preparePublicationMutations, registerMembershipPublication, registerBranchPublicationInputs, registerNativePublicationFactory, registerPublicationSnapshots, type MembershipPublicationEdit, type IntrinsicMutation, type PreparedPublicationUnit } from '../internals/intrinsic-mutation';
import * as projection from './projection';
import * as lifecycle from './lifecycle';
export {stampSource,subscribeProjection,deliverEqual} from './projection';
export {enroll,SignalTreePublicationError} from './lifecycle';
type Cell=lifecycle.OwnerCell;
type Proof=Readonly<lifecycle.Proof>;
type Fact=Readonly<{revision:number;clean:boolean;blockers:readonly Cell[];unknown:boolean}>;
type Slot=Readonly<{branch:object;key:string;child:object;address?:readonly string[]}>;
type Presence=Readonly<{present:boolean;fact:Fact}>;
type Unit={comparison?:lifecycle.ComparisonAdmission;relevance?:lifecycle.CurrentRelevance;collection?:{key:object;edits:readonly EntityContributorEdit[];acquired?:boolean};selected?:lifecycle.NativeRequirement;native?:lifecycle.NativeRequirement;invocation?:lifecycle.NativeRequirement;releaseInvocation?:()=>void;coverageUnknown?:boolean;fact:Fact;previous?:Fact;payload:unknown;changed:boolean;inputs:readonly Fact[];field?:object;relative?:readonly string[];presence?:{slot:Slot;state:Presence;ordinary?:MembershipPublicationEdit['ordinary']};complete:boolean;resolve:()=>void;promise:Promise<void>};
type SlotTrie={children:Map<string,SlotTrie>;slots:Map<object,Slot>};
type FieldInfo={relative:readonly string[];address:readonly string[]};
type FieldTrie={children:Map<string,FieldTrie>;field?:object};
type CollectionSupport={occurrence:OccurrenceHandle;payload:unknown;relative:readonly string[]|undefined;entries:Map<string,{requirement:lifecycle.NativeRequirement;proof:Proof}>};
type LegacyScalar={value:unknown;relative:readonly string[];revision:number};
type SelectedProjection=Readonly<{fact:Fact;payload:unknown;workEpoch:number}>;
type ProjectionReceipt=SelectedProjection & Readonly<{changed:boolean}>;
// Prepared Binding wrappers share this recipient-owned handoff state.
type DeliveryState={produced:number;taken:number;reducing:boolean;projected?:SelectedProjection};
const receiptOwners=new WeakMap<ProjectionReceipt,DeliveryState>();
function selectProjection(b:Binding,fact:Fact,payload:unknown,changed:boolean):void {
 if(changed)b.delivery.produced++;
 b.delivery.projected=Object.freeze({fact,payload,workEpoch:b.delivery.produced});
}
function selectedReceipt(channel:object):ProjectionReceipt|undefined {
 const live=bindings.get(channel),selected=live?.delivery.projected;
 if(!live||live.delivery.reducing||live.pending.size||!selected||selected.fact!==live.current)return;
 const receipt=Object.freeze({...selected,changed:selected.workEpoch>live.delivery.taken});
 receiptOwners.set(receipt,live.delivery);return receipt;
}
/** Transfer only the captured prefix after Link has adopted it without callbacks. */
export function acknowledgeProjection(channel:object,receipt:ProjectionReceipt):void {
 const delivery=bindings.get(channel)?.delivery;
 if(delivery&&receiptOwners.get(receipt)===delivery)delivery.taken=Math.max(delivery.taken,receipt.workEpoch);
}
type Binding={legacyScalars:LegacyScalar[];index:RecipientOccurrences;occurrences:Map<object,OccurrenceHandle>;collections:Map<object,CollectionSupport>;aggregate:boolean;initialized:Set<object>;valueInitialized:boolean;slotTrie:SlotTrie;fields:Map<object,FieldInfo>;fieldTrie:FieldTrie;fieldFacts:Map<object,Fact>;completedFields:Map<object,Fact>;releases:(()=>void)[];owner:number;position:number;current?:Fact;valueFact:Fact;completedValueFact:Fact;valuePayload:unknown;baselineStructure:Fact;presence:Map<Slot,Presence>;completedPresence:Map<Slot,Presence>;source?:object;registry?:object;address?:readonly string[];pending:Set<Unit>;delivery:DeliveryState;release?:()=>void};
const bindings=new Map<object,Binding>();
const proofs=new WeakMap<Fact,Proof>();
// Only the exact completed aggregate version qualifies. Later replacements do
// not inherit this witness; no historical Fact graph or closure epoch is needed.
const reducedComparisonProofs=new WeakSet<Proof>();
const ownProofs=new WeakMap<Fact,Proof>();
const factRequirements=new WeakMap<Fact,lifecycle.NativeRequirement>();
const factChannels=new WeakMap<Fact,object>();
const noopPredecessors=new WeakMap<Fact,Fact|undefined>();
function effectivePredecessor(fact:Fact|undefined):Fact|undefined{while(fact&&noopPredecessors.has(fact))fact=noopPredecessors.get(fact);return fact;}
const facts=new WeakSet<object>();
const scalarFacts=new WeakSet<object>();
const grants=new WeakMap<Fact,Set<object>>();
const callbacks=new Map<object,()=>void>();
const consumedIngress=new Set<object>();
let serial=0;let ingress:{channel:object;consumed:boolean;collections:Set<object>}|undefined;
export const enabled=true;
export function register(owner:number,_source:unknown,token:object):void{lifecycle.registerOwnerSource(owner,token);}
export function unregister(owner:number|undefined):void{if(owner!==undefined)lifecycle.unregisterOwnerSource(owner);}
export function transition(owner:number|undefined,event:{kind:string;transactionId:number}):void{if(owner!==undefined)lifecycle.ownerTransition(owner,event);}
const sameOwners=(a:readonly Cell[]|undefined,b:readonly Cell[]|undefined):boolean=>(a??[]).length===(b??[]).length&&(a??[]).every(x=>(b??[]).includes(x));
const sameProof=(a:Proof|undefined,b:Proof|undefined):boolean=>!!a&&!!b&&a.unknown===b.unknown&&a.invalid===b.invalid&&!!a.unavailableInput===!!b.unavailableInput&&!!a.historicalWindow===!!b.historicalWindow&&(a.terminalRejectedRoles??0)===(b.terminalRejectedRoles??0)&&(['owners','destination','input','validation','possible'] as const).every(role=>sameOwners(a[role],b[role]));
type Trie={children:Map<string,Trie>;channels:Set<object>};
const tries=new WeakMap<object,Trie>();
function slotFor(branch:object,key:string,child:object):Slot{return Object.freeze({branch,key,child,address:getNodeAddress(branch)?[...getNodeAddress(branch)!,key]:undefined});}
function removeIndex(registry:object,address:readonly string[],channel:object):void{const root=tries.get(registry);if(!root)return;const path:{parent:Trie;key:string;node:Trie}[]=[];let node=root;for(const key of address){const child=node.children.get(key);if(!child)return;path.push({parent:node,key,node:child});node=child;}node.channels.delete(channel);for(let i=path.length-1;i>=0;i--){const part=path[i];if(part.node.channels.size||part.node.children.size)break;part.parent.children.delete(part.key);}if(!root.channels.size&&!root.children.size)tries.delete(registry);}
function trieFor(registry:object,address:readonly string[],create:boolean):Trie|undefined{let node=tries.get(registry);if(!node&&create)tries.set(registry,node={children:new Map(),channels:new Set()});for(const key of address){let next=node?.children.get(key);if(!next&&create&&node)node.children.set(key,next={children:new Map(),channels:new Set()});node=next;}return node;}
function collect(node:Trie|undefined,result:object[]):void{if(!node)return;result.push(...node.channels);for(const child of node.children.values())collect(child,result);}
function reaches(child:object,suffix:readonly string[],source:object):boolean{let node:unknown=child;for(const key of suffix){if(!isTraversableNode(node))return false;const descriptor=Object.getOwnPropertyDescriptor(node,key);if(!descriptor||!('value'in descriptor))return false;node=descriptor.value;}return node===source;}
const combineProofs=lifecycle.combineProofs;
function fieldAt(root:FieldTrie,path:readonly string[],create=false):FieldTrie|undefined{let node:FieldTrie|undefined=root;for(const key of path){let next:FieldTrie|undefined=node?.children.get(key);if(!next&&create&&node)node.children.set(key,next={children:new Map()});node=next;}return node;}
function fieldNodes(node:FieldTrie|undefined,out:object[]):void{if(!node)return;if(node.field)out.push(node.field);for(const child of node.children.values())fieldNodes(child,out);}
function slotNode(b:Binding,address:readonly string[],create=false):SlotTrie|undefined{let node:SlotTrie|undefined=b.slotTrie;for(const key of address){let next:SlotTrie|undefined=node?.children.get(key);if(!next&&create&&node)node.children.set(key,next={children:new Map(),slots:new Map()});node=next;}return node;}
function indexSlot(b:Binding,slot:Slot):void{if(slot.address)slotNode(b,slot.address,true)!.slots.set(slot.child,slot);}
function slotsAlong(b:Binding,address:readonly string[]):Slot[]{const result:Slot[]=[];let node:SlotTrie|undefined=b.slotTrie;const add=()=>{for(const slot of node?.slots.values()??[])if(b.presence.has(slot))result.push(slot);};add();for(const key of address){node=node?.children.get(key);if(!node)break;add();}return result;}

function presenceForField(b:Binding,address:readonly string[]):Presence[]{return slotsAlong(b,address).map(slot=>b.presence.get(slot)!).filter(Boolean);}
function pathValue(value:unknown,path:readonly string[]):{present:boolean;value:unknown}{for(const key of path){if(value===null||typeof value!=='object'||!Object.prototype.hasOwnProperty.call(value,key))return {present:false,value:undefined};value=(value as Record<string,unknown>)[key];}return {present:true,value};}
function maskPayload(b:Binding):unknown{let result=b.valuePayload;for(const [slot,state]of b.completedPresence){if(state.present||!slot.address)continue;const relative=relativeSourceAddress(b.address??[],slot.address);if(!relative?.length)continue;const omit=(value:unknown,depth:number):unknown=>{if(value===null||typeof value!=='object')return value;const row={...value};const key=relative[depth];if(depth===relative.length-1)delete(row as Record<string,unknown>)[key];else if(Object.prototype.hasOwnProperty.call(row,key))Object.defineProperty(row,key,{value:omit((row as Record<string,unknown>)[key],depth+1),enumerable:true,configurable:true,writable:true});return row;};result=omit(result,0);}return result;}

type InputEvidence={facts:readonly Fact[];recipientDomainUnknown:boolean};
type BranchInput={recipients:ReadonlyMap<object,InputEvidence>;native:readonly lifecycle.NativeInput[]};
const branchInputs:BranchInput[]=[];
// One current requirement per native value identity, independent of subscribers.
// No payload/history is retained; weak keys release facts with their native source.
const nativeValues=new WeakMap<object,NativeFieldEndpoint>();
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
// Fresh updater containers use current source support. An opaque payload still
// contributes its issued evidence in addition to its current leaf/location.
// Snapshot registration keeps the historical supplied-object path (default).
function suppliedViews(node:object,supplied?:unknown,currentSource=false):NativeView[]{
 const entity=getEntityPublicationBinding(node);
 if(entity)return [...entity.source.captureViews(entity.subject,entity.field)] as NativeView[];
 if(!currentSource&&supplied!==null&&typeof supplied==='object'){
  const certificate=snapshotViews.get(supplied);if(certificate)return [...certificate];
 }
 const own:NativeView[]=[];
 for(const edge of getRetainedMembershipPath(node)){const view=memberViews.get(edge.child);if(view)own.push(view);if(!edge.present)return own;}
 if(isWritableLocation(node)){
  const view=nativeViews.get(node);if(view)own.push(view);
  if(currentSource&&supplied!==null&&typeof supplied==='object')own.push(...(snapshotViews.get(supplied)??[]));
  return own;
 }
 const storage=nodeStoreOf(node)??node;
 own.push(...(negativeViews.get(storage)?.values()??[]));
 for(const key of Object.keys(storage)){
  const descriptor=Object.getOwnPropertyDescriptor(storage,key);if(!descriptor||!('value'in descriptor)||!isTraversableNode(descriptor.value))continue;
  const value=supplied!==null&&typeof supplied==='object'?(supplied as Record<string,unknown>)[key]:undefined;
  own.push(...suppliedViews(descriptor.value,value,currentSource));
 }
 return own;
}
registerPublicationSnapshots((node,value)=>{snapshotViews.set(value,Object.freeze(suppliedViews(node,value)));});
function nativeInputs(node:object,supplied?:unknown,currentSource=false):lifecycle.NativeInput[]{
 const entity=getEntityPublicationBinding(node);
 if(entity){const captured=entity.source.captureInput(entity.subject,entity.field) as {native?:readonly lifecycle.NativeInput[]}|undefined;return [...(captured?.native??[])];}
 const views=suppliedViews(node,supplied,currentSource);
 // A singleton cannot duplicate support: retain capture timing and a fresh result,
 // without allocating the intermediate requirement array, Set and deduped array.
 if(views.length===1)return [lifecycle.captureNativeInput(views[0].requirement)];
 return [...new Set(views.map(view=>view.requirement))].map(lifecycle.captureNativeInput);
}
function nativeAuthorship(node:object):{known:Cell[];unknown:boolean}{
 const meta=getActiveWriteContext();const owner=getPositionRegistry(node)?.id;const id=meta?.transactionId;
 const cell=owner!==undefined&&typeof id==='number'?lifecycle.ownerCell(owner,id):undefined;
 return {known:cell?[cell]:[],unknown:meta?.origin!==undefined||(id!==undefined&&(!cell||meta?.transactionOwner!==lifecycle.ownerToken(owner!)))};
}
registerNativePublicationFactory(node=>{
 const initial=lifecycle.initialRequirement();nativeValues.set(node,{present:true,value:undefined,requirement:initial});nativeViews.set(node,{requirement:initial});
 return {
  captureInput:()=>({native:Object.freeze(nativeInputs(node))}),
  prepare:(mutation,input)=>{
   if(getActiveWriteContext()?.participation==='inspection'){
    return {record:{writes:mutation.changed?[{map:nativeViews,key:node,value:{requirement:unavailableInput()}}]:[],adds:[]},completion:{}};
   }
   if(!mutation.changed&&!lifecycle.isValidating()&&!branchInputs.length&&!restoredScalarSelection(node)){
    if(!mutation.physicalChanged)return;
    // Physical inspection return is not new ordinary authorship. Replace only
    // the current view; older snapshot certificates keep their old view object.
    const selected=nativeValues.get(node)!,priorView=nativeViews.get(node),priorRequirement=priorView?.requirement;
    return {record:{writes:[{map:nativeViews,key:node,value:{requirement:selected.requirement as lifecycle.NativeRequirement}}],adds:[]},completion:{requirement:selected.requirement},validate:()=>{if(nativeValues.get(node)!==selected||nativeViews.get(node)!==priorView||priorView?.requirement!==priorRequirement)throw new Error('Scalar physical view changed before installation');}};
   }
   const comparisonCutoff=lifecycle.comparisonCutoff();
   const predecessor=nativeValues.get(node)!;
   const existingView=nativeViews.get(node), physicalRequirement=existingView?.requirement;
   const authored=mutation.changed?nativeAuthorship(node):{known:[],unknown:false};
   const consumed=mutation.intent==='derive'?(input as {native?:readonly lifecycle.NativeInput[]}|undefined)?.native??[]:[];
   let prepared=lifecycle.prepareNativeRequirement(authored.known,authored.unknown,[...consumed,...branchInputs.flatMap(scope=>scope.native),...currentEntityPublicationInputs().flatMap(input=>(input as {native?:readonly lifecycle.NativeInput[]}).native??[])]);
   const proposed:NativeFieldEndpoint=Object.freeze({present:true,value:mutation.after,requirement:prepared.requirement});
   const restoration=restoredScalarSelection(node);
   const literal=mutation.intent==='replace'&&branchInputs.length===0&&currentEntityPublicationInputs().length===0;
   const registry=getPositionRegistry(node);
   const priorProof=lifecycle.nativeProof(predecessor.requirement as lifecycle.NativeRequirement);
   // The endpoint binding identifies the selected claim. Its exact owner cell
   // supplies outcome; absence is not confirmation and W is never actual input.
   const boundOwner=predecessor.owner===undefined?undefined:priorProof.destination?.find(cell=>cell.owner===registry?.id&&cell.id===predecessor.owner);
   const allowConfirmedRefresh=!mutation.changed&&literal&&boundOwner?.outcome==='confirmed'&&priorProof.owners.every(cell=>cell.outcome==='confirmed')&&!(priorProof.terminalRejectedRoles??0);
   const selection=restoration?{endpoint:restoration}:prepareScalarSelection(registry,node,mutation,predecessor,proposed,allowConfirmedRefresh);
   const retained=selection?.endpoint??(!mutation.changed&&predecessor.owner!==undefined&&!allowConfirmedRefresh?predecessor:proposed);
   // Selection is not consumption. Keep every role of the selected predecessor.
   const admitted=retained.requirement===prepared.requirement;
   if(!admitted)prepared=lifecycle.prepareNativeRequirement([],authored.unknown,[...consumed,...branchInputs.flatMap(scope=>scope.native),...currentEntityPublicationInputs().flatMap(input=>(input as {native?:readonly lifecycle.NativeInput[]}).native??[])]);
   // Only an independently supplied retaining literal has no newly consumed input.
   // Keep derived/branch/entity input evidence on the established admission path.
   const exact=!!restoration||!admitted&&literal&&retained.owner!==undefined;
   const relevance=exact?undefined:lifecycle.currentRelevance(predecessor.requirement as lifecycle.NativeRequirement,admitted?undefined:retained.requirement as lifecycle.NativeRequirement,prepared.requirement);
   const requirement=exact?retained.requirement as lifecycle.NativeRequirement:admitted&&!relevance?.size?prepared.requirement:lifecycle.combineScalarNativeRequirements(admitted?[prepared.requirement]:[retained.requirement as lifecycle.NativeRequirement,prepared.requirement],relevance);
   const endpoint=requirement===retained.requirement?retained:Object.freeze({...retained,requirement});
   const view=mutation.changed||mutation.physicalChanged||!existingView||existingView.requirement!==requirement?{requirement}:existingView;
   return {record:combineTerminalRecords(prepared.record,selection?.record,{writes:[{map:nativeValues,key:node,value:endpoint},{map:nativeViews,key:node,value:view}],adds:[]})!,completion:{requirement,activation:prepared.requirement,relevance,comparison:lifecycle.comparisonAdmission(comparisonCutoff,prepared.requirement)},finalize:()=>lifecycle.finalizeNativeRequirement(prepared.requirement),validate:()=>{if(nativeValues.get(node)!==predecessor||nativeViews.get(node)!==existingView||existingView?.requirement!==physicalRequirement)throw new Error('Scalar publication selection changed before installation');}};
  },
  complete:(completion)=>{const unit=completion as {activation?:lifecycle.NativeRequirement;requirement?:lifecycle.NativeRequirement};lifecycle.completeScalarNativeRequirement(unit.requirement,unit.activation??unit.requirement);},
 };
});
function beginBranchInput(node:object,supplied?:unknown):object|undefined{
 const registry=getPositionRegistry(node),address=getNodeAddress(node);const recipients=new Map<object,InputEvidence>();
 if(registry&&address){const keys:object[]=[];let trie=tries.get(registry);if(trie){keys.push(...trie.channels);for(const part of address){trie=trie.children.get(part);if(!trie)break;keys.push(...trie.channels);}collect(trie,keys);}
  for(const key of new Set(keys)){const b=bindings.get(key);if(!b?.address)continue;const within=relativeSourceAddress(b.address,address);const encloses=relativeSourceAddress(address,b.address);if(within===undefined&&encloses===undefined)continue;const captured:Fact[]=[];let covered=false;
   if(b.aggregate){if(within!==undefined)covered=true;const fields:object[]=[];fieldNodes(fieldAt(b.fieldTrie,within??[]),fields);captured.push(b.baselineStructure);for(const field of fields){const info=b.fields.get(field)!;const states=presenceForField(b,info.address);const absent=states.filter(state=>!state.present);captured.push(...(absent.length?absent.map(state=>state.fact):[b.fieldFacts.get(field)!,...states.map(state=>state.fact)]));}}
   else captured.push(...((captureValueInput(key) as {facts:readonly Fact[]}|undefined)?.facts??[]));
   recipients.set(key,{facts:Object.freeze([...new Set(captured)]),recipientDomainUnknown:!covered});
  }
 }
 const input:BranchInput={recipients,native:Object.freeze(nativeInputs(node,supplied,true))};branchInputs.push(input);return input;
}
function endBranchInput(token:object):void{if(branchInputs.at(-1)!==token)throw new Error('Branch publication input scope mismatch');branchInputs.pop();}
function requirementOf(proof:Proof):lifecycle.NativeRequirement {
 return {proof,inputs:[],frames:[],known:[],unknown:false,possible:[],captureWindow:false};
}
function installFact(b:Binding,node:object,key:unknown,fact:Fact,requirement:lifecycle.NativeRequirement):void {
 const occurrence=b.occurrences.get(node);if(!occurrence)throw Error('Support has no enrolled occurrence');
 factRequirements.set(fact,requirement);
 b.index.replace(occurrence,key,requirement,proof=>{ownProofs.set(fact,proof);proofs.set(fact,proof);});
}
function collectionSelected(b:Binding,collection:CollectionSupport):boolean {
 return b.index.exposed(collection.occurrence);
}
function setCollectionEntry(_channel:object,b:Binding,collection:CollectionSupport,key:string,requirement?:lifecycle.NativeRequirement):void {
 b.index.replace(collection.occurrence,key,requirement);
 if(requirement)collection.entries.set(key,{requirement,proof:lifecycle.nativeProof(requirement)});else collection.entries.delete(key);
}
function projectionSupport(b:Binding):{proof:Proof;present:boolean}{
 const source=b.source&&b.occurrences.get(b.source);
 return {proof:b.index.proof(),present:!source||b.index.exposed(source)};
}
/** Detached descendant plans; registrations become live only with source installation. */
function prepareDescendantEnrollment(channel:object,b:Binding,edit:MembershipPublicationEdit,requirement:lifecycle.NativeRequirement,inspection:boolean) {
 const occurrences=edit.preparedOccurrences;
 if(!occurrences?.length||!b.aggregate)return undefined;
 const fresh=occurrences.filter(value=>!b.occurrences.has(value.source));
 if(!fresh.length)return undefined;
 const fields=fresh.flatMap(value=>{
  const node=value.source;if(!isWritableLocation(node)||getEntityPublicationBinding(node))return [];
  const address=getNodeAddress(node),relative=address&&relativeSourceAddress(b.address??[],address);
  if(!address||relative===undefined)throw Error('Prepared field has no recipient address');
  const fact:Fact=Object.freeze({revision:++serial,clean:false,blockers:[],unknown:false});facts.add(fact);
  const registration=stagePublicationMutations(node,(m,input,native)=>prepareScalar(channel,m,input,node,native),completeScalar,()=>captureValueInput(channel,node));
  return [{node,address,relative,fact,registration}];
 });
 const install={set(){
  for(const field of fields){b.fields.set(field.node,{address:field.address,relative:field.relative});
   b.fieldFacts.set(field.node,field.fact);b.completedFields.set(field.node,field.fact);fieldAt(b.fieldTrie,field.relative,true)!.field=field.node;
   field.registration.install();b.releases.push(field.registration.release);
  }
 }};
 return {record:{writes:[{map:install,key:undefined,value:undefined}],adds:[]},validate:()=>{
  if(bindings.get(channel)?.index!==b.index||bindings.get(channel)?.current!==b.current)throw Error('Dynamic recipient changed during preparation');
 },activate:()=>{
  if(bindings.get(channel)?.index!==b.index)return;
  // Enrollment callbacks write internal proof tables only. No unit is complete yet.
  for(const occurrence of fresh){const handle=b.index.enrollCaptured(occurrence);b.occurrences.set(occurrence.source,handle);}
  for(const field of fields){installFact(b,field.node,'value',field.fact,requirement);if(!inspection)b.initialized.add(field.node);}
  if(inspection){
   const handle=b.occurrences.get(edit.child);if(handle)b.index.setPresence(handle,false,lifecycle.initialRequirement());
   const slot=slotNode(b,[...edit.address,edit.key])?.slots.get(edit.child);
   if(slot){const state={present:false,fact:b.baselineStructure};b.presence.set(slot,state);b.completedPresence.set(slot,state);}
  }
 }};
}
function prepareMembership(edit:MembershipPublicationEdit):PreparedPublicationUnit|undefined{
 const meta=getActiveWriteContext();
 const domainKey=nodeStoreOf(edit.branch)??edit.branch;
 const physicalView={requirement:unavailableInput()};
 const viewDomain=negativeViews.get(domainKey)??new Map<object,NativeView>();
 const viewWrites=[{map:memberViews,key:edit.child,value:physicalView},{map:negativeViews,key:domainKey,value:viewDomain},...(!edit.present?[{map:viewDomain,key:edit.child,value:physicalView}]:[])];
 const inspection=meta?.participation==='inspection';
 const authored=nativeAuthorship(edit.child);const native=lifecycle.prepareNativeRequirement(authored.known,authored.unknown,branchInputs.flatMap(scope=>scope.native));
 const address=[...edit.address,edit.key],found:object[]=[];let cursor=tries.get(edit.registry);if(cursor)found.push(...cursor.channels);for(const key of address){cursor=cursor?.children.get(key);if(!cursor)break;found.push(...cursor.channels);}collect(trieFor(edit.registry,address,false),found);const channels=[...new Set(found)];
 if(!inspection)physicalView.requirement=native.requirement;
 const domain=nativeNegativeDomains.get(domainKey)??new Map<object,lifecycle.NativeRequirement>();
 const records=[combineTerminalRecords(native.record,{writes:[...viewWrites,{map:nativeMembers,key:edit.child,value:native.requirement},{map:nativeNegativeDomains,key:domainKey,value:domain},...(!edit.present?[{map:domain,key:edit.child,value:native.requirement}]:[])],deletes:edit.present?[{map:domain,key:edit.child},{map:viewDomain,key:edit.child}]:[],adds:[]})!];const parts:{channel:object;unit:Unit}[]=[];const finalizeRecipients:(()=>void)[]=[];const enrollments:NonNullable<ReturnType<typeof prepareDescendantEnrollment>>[]=[];
 for(const channel of channels){const b=bindings.get(channel);if(!b?.source||!b.address)continue;const inside=relativeSourceAddress(b.address,address);if(inside!==undefined){if(!b.aggregate&&(inside.length!==0||edit.child!==b.source))continue;}else if(!reaches(edit.child,b.address.slice(address.length),b.source))continue;
  const enrollment=prepareDescendantEnrollment(channel,b,edit,inspection?unavailableInput():native.requirement,inspection);
  if(enrollment){enrollments.push(enrollment);records.push(enrollment.record);finalizeRecipients.push(enrollment.validate);}
  if(inspection)continue;
  const indexed=slotNode(b,address);if(!indexed&&!enrollment)continue;const slot=indexed?.slots.get(edit.child)??slotFor(edit.branch,edit.key,edit.child);const previous=b.current;
  const attributed=meta?.transactionId;const known=typeof attributed==='number'?lifecycle.ownerCell(b.owner,attributed):undefined;
  const valid=attributed===undefined||!!known&&meta?.transactionOwner===lifecycle.ownerToken(b.owner);
  const uncertainty:lifecycle.RecipientUncertainty={invalidAttribution:!valid,unobservedOrigin:meta?.origin!==undefined};
  const unknown=!!(uncertainty.invalidAttribution||uncertainty.unobservedOrigin);
  const fact:Fact=Object.freeze({revision:++serial,clean:false,blockers:Object.freeze([]),unknown});facts.add(fact);
  let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});const state=Object.freeze({present:edit.present,fact});
  const unit:Unit={native:native.requirement,coverageUnknown:unknown,fact,previous,payload:undefined,changed:(edit.ordinary?.before.present??b.presence.get(slot)?.present??true)!==edit.present,inputs:[],presence:{slot,state,ordinary:edit.ordinary},complete:false,resolve,promise};
  const record=lifecycle.prepareRevision(channel,fact,known?[known]:[],uncertainty,fact.blockers,native.requirement);
  if(record.finalize)finalizeRecipients.push(record.finalize);
  records.push(combineTerminalRecords(record,{writes:[{map:bindings,key:channel,value:{...b,current:fact}},{map:b.presence,key:slot,value:state},{map:{set(){indexSlot(b,slot);}},key:edit.child,value:slot}],adds:[{set:b.pending,value:unit}]})!);parts.push({channel,unit});
 }
 const record=combineTerminalRecords(...(inspection?[{writes:viewWrites,deletes:edit.present?[{map:viewDomain,key:edit.child}]:[],adds:[]},...enrollments.map(value=>value.record)]:records));return record?{record,completion:{parts,enrollments,native:native.requirement},finalize:()=>{lifecycle.finalizeNativeRequirement(native.requirement);for(const finalize of finalizeRecipients)finalize();}}:undefined;
}
function completeMembership(completion:object):void{
 const state=completion as {parts:{channel:object;unit:Unit}[];enrollments?:{activate():void}[];native:lifecycle.NativeRequirement};
 let failed=false,first:unknown;const run=(work:()=>void)=>{try{work();}catch(error){if(!failed){failed=true;first=error;}}};
 for(const enrollment of state.enrollments??[])run(()=>enrollment.activate());
 state.enrollments=undefined;
 run(()=>lifecycle.deliverNativeRequirementReady(state.native));
 for(const part of state.parts)run(()=>completeScalar(part));
 if(failed)throw first;
}
function ready(channel:object,b:Binding):void{
 if(b.delivery.reducing)return;
 b.delivery.reducing=true;
 try{
 for(const unit of b.pending){
  if(!unit.complete)break;
  if(unit.invocation&&!lifecycle.nativeRequirementReady(unit.invocation))break;
  if(unit.relevance?.size&&unit.native&&!lifecycle.nativeRequirementReady(unit.native))break;
  unit.releaseInvocation?.();unit.releaseInvocation=undefined;
  const proof=proofs.get(unit.fact)??lifecycle.proof(channel,unit.fact);
  if(!proof)break; // The captured horizon has not finalized; no mutable stack lookup.
  const authoredRequirement=lifecycle.combineNativeRequirements([requirementOf(lifecycle.currentObligations(proof,unit.relevance)),...(unit.native?[unit.native]:[])]);
  const authoredProof=lifecycle.nativeProof(authoredRequirement);ownProofs.set(unit.fact,authoredProof);
  if(unit.collection){
   const collection=b.collections.get(unit.collection.key);
   if(collection){for(const edit of unit.collection.edits){
     setCollectionEntry(channel,b,collection,edit.key,edit.after as lifecycle.NativeRequirement|undefined);
   }
   collection.payload=unit.payload;
   if(collectionSelected(b,collection))b.valuePayload=collection.relative?applyAtRelativePath(b.valuePayload,collection.relative,{all:unit.payload}):unit.payload;}
  }else if(unit.presence){
   const slot=unit.presence.slot;const occurrence=b.occurrences.get(slot.child);
   if(!occurrence)throw Error('Membership support has no enrolled occurrence');
   b.completedPresence.set(slot,unit.presence.state);
   b.index.setPresence(occurrence,unit.presence.state.present,authoredRequirement);
   const ownCollection=b.source&&b.collections.get(b.source);
   if(ownCollection&&collectionSelected(b,ownCollection))b.valuePayload=ownCollection.payload;
   const relative=slot.address&&relativeSourceAddress(b.address??[],slot.address),after=unit.presence.ordinary?.after;
   // Direct collection recipients already selected their natural row array above.
   // Membership snapshots use the containing branch's {all: ...} representation;
   // applying one at relative [] would overwrite that source-owned array.
   if(!ownCollection&&after?.present&&relative!==undefined){
    // The source supplied this ordinary selection before completion. Its value
    // does not come from a later physical read or notification reseed.
    b.valuePayload=applyAtRelativePath(b.valuePayload,relative,after.value);
    for(const collection of b.collections.values())if(collection.relative&&relativeSourceAddress(relative,collection.relative)!==undefined&&collectionSelected(b,collection)){
     b.valuePayload=applyAtRelativePath(b.valuePayload,collection.relative,{all:collection.payload});
    }
   }else if(!ownCollection&&after?.present&&!b.aggregate&&!b.valueInitialized&&slot.address&&b.address){
    const below=relativeSourceAddress(slot.address,b.address),supplied=below&&pathValue(after.value,below);
    if(supplied?.present){b.valuePayload=supplied.value;b.valueInitialized=true;}
   }
  }else if(unit.field){
   installFact(b,unit.field,'value',unit.fact,authoredRequirement);
   b.completedFields.set(unit.field,unit.fact);b.initialized.add(unit.field);b.valuePayload=applyAtRelativePath(b.valuePayload,unit.relative??[],unit.payload);
  }else{
   if(b.source)installFact(b,b.source,'value',unit.fact,unit.selected?lifecycle.combineNativeRequirements([authoredRequirement,unit.selected]):authoredRequirement);
   b.completedValueFact=unit.fact;b.valuePayload=unit.payload;
  }
  const support=projectionSupport(b);const effective=unit.selected?combineProofs([support.proof,lifecycle.nativeProof(unit.selected)]):support.proof;
  const stored=lifecycle.projectRevision(channel,unit.fact,effective,b.index.unresolved()!==0);
  proofs.set(unit.fact,stored);
  const reduced=b.index.unresolved()===0&&lifecycle.comparisonRevisionReady(channel,unit.fact)&&
   (!unit.native||lifecycle.nativeRequirementReady(unit.native))&&
   (!unit.selected||lifecycle.nativeRequirementReady(unit.selected));
  if(reduced)reducedComparisonProofs.add(stored);
  const prior=unit.previous&&proofs.get(unit.previous);
  const comparison=unit.comparison&&reduced&&prior&&reducedComparisonProofs.has(prior)?unit.comparison:undefined;
  const noop=!unit.changed&&unit.fact.clean===(unit.previous?.clean??false)&&sameProof(prior&&(comparison?lifecycle.comparisonObligations(prior,comparison):lifecycle.currentObligations(prior,unit.relevance)),comparison?lifecycle.comparisonObligations(effective,comparison):lifecycle.currentObligations(effective,unit.relevance));
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
   selectProjection(b,unit.fact,support.present?(b.aggregate?maskPayload(b):b.valuePayload):(b.source&&b.collections.has(b.source)?[]:undefined),unit.changed);
  }
  unit.comparison=undefined;unit.relevance=undefined;unit.payload=undefined;b.pending.delete(unit);unit.resolve();
 }
 if(!b.pending.size)drainLegacyScalars(channel,b);
 }finally{b.delivery.reducing=false;}
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
 const previous=(mutation.publicationPredecessors?.has(channel)?mutation.publicationPredecessors.get(channel):b.current) as Fact|undefined;
 const ownInput=mutation.intent==='derive'?(input as {facts?:readonly Fact[]}|undefined)?.facts:undefined;
 const scopes=branchInputs.map(scope=>scope.recipients.get(channel)??{facts:[],recipientDomainUnknown:false});const captured=ownInput||scopes.length?Object.freeze([...new Set([...(ownInput??[]),...scopes.flatMap(scope=>scope.facts)])]):undefined;
 const native=(nativeUnit as {requirement?:lifecycle.NativeRequirement}|undefined)?.requirement;
 const nativeKnown=native?lifecycle.nativeProof(native).destination??[]:known?[known]:[];
 // Preserve the distinct admission causes: only domain mismatch is recipient-only.
 const uncertainty:lifecycle.RecipientUncertainty=clean?{}:{
  invalidAttribution:!valid,unobservedOrigin:meta?.origin!==undefined,
  uncapturedUpdaterInput:mutation.intent==='derive'&&!ownInput,
  recipientDomain:scopes.some(scope=>scope.recipientDomainUnknown),
 };
 const unknown=!!(uncertainty.invalidAttribution||uncertainty.unobservedOrigin||uncertainty.uncapturedUpdaterInput||uncertainty.recipientDomain);
 const fact:Fact=Object.freeze({revision:++serial,clean,blockers:Object.freeze([]),unknown});facts.add(fact);factChannels.set(fact,channel);scalarFacts.add(fact);mutation.publicationPredecessors?.set(channel,fact);
 let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});
 const relevance=(nativeUnit as {relevance?:lifecycle.CurrentRelevance}|undefined)?.relevance;
 const comparison=(nativeUnit as {comparison?:lifecycle.ComparisonAdmission}|undefined)?.comparison;
 const unit:Unit={comparison,relevance,native,invocation:(nativeUnit as {activation?:lifecycle.NativeRequirement}|undefined)?.activation,coverageUnknown:unknown,fact,previous,payload:mutation.after,changed:mutation.changed,inputs:captured??[],field,relative:field?b.fields.get(field)?.relative:undefined,complete:false,resolve,promise};
 const plan=lifecycle.prepareRevision(channel,fact,nativeKnown,uncertainty,fact.blockers,native,b.aggregate,(nativeUnit as {activation?:lifecycle.NativeRequirement}|undefined)?.activation??native,relevance);
 const edits:import('../internals/intrinsic-mutation').TerminalRecordPlan['writes'][number][]=[{map:bindings,key:channel,value:{...b,current:fact,...(!field?{valueFact:fact}:{})}}];if(field)edits.push({map:b.fieldFacts,key:field,value:fact});
 const terminalEdits={writes:edits,adds:[{set:b.pending,value:unit},...(clean&&ingress?[{set:consumedIngress,value:ingress}]:[])]};
 return {record:combineTerminalRecords(plan,terminalEdits)!,completion:{channel,unit,cleanIngress:clean?ingress:undefined},finalize:plan.finalize,coveredRecipients:[channel]};
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
export function registerCollectionProjection(channel:object,key:object,relative:readonly string[]|undefined,initial:ReadonlyMap<string,object>,payload?:unknown):void {
 const b=bindings.get(channel);if(!b)return;
 const occurrence=b.index.enroll(key);b.occurrences.set(key,occurrence);
 const support:CollectionSupport={occurrence,payload:payload??pathValue(b.valuePayload,relative??[]).value,relative,entries:new Map()};
 for(const [slot,reference]of initial)setCollectionEntry(channel,b,support,slot,reference as lifecycle.NativeRequirement);
 b.collections.set(key,support);
}
export function completeSourceProjection(completion:object):void { completeScalar(completion); }
function completeScalar(completion:object):void{
 const {channel,unit,cleanIngress}=completion as {channel:object;unit:Unit;cleanIngress?:{consumed:boolean}};
 if(!bindings.get(channel)?.pending.has(unit))return;
 if(cleanIngress)cleanIngress.consumed=true;
 unit.complete=true;
 if(unit.invocation&&!lifecycle.nativeRequirementReady(unit.invocation))unit.releaseInvocation=lifecycle.onNativeRequirementReady(unit.invocation,()=>wakeChannel(channel));
 wakeChannel(channel);
}
export function bindSource(channel:object,owner:number,position:number,identity:Parameters<typeof projection.bindSource>[3],report:(error:unknown)=>void=()=>{/* No reporter was supplied. */},source?:object,context?:{registry:object;address:readonly string[];value:unknown;aggregate?:boolean;presence:readonly {parent:object;key:string;child:object;present:boolean}[]}):void{
 projection.bindSource(channel,owner,position,identity);
 lifecycle.registerConnection(channel,{supported:identity.supported,report,wake:()=>{const b=bindings.get(channel);if(b)ready(channel,b);callbacks.get(channel)?.();}});
 const baseline:Fact=Object.freeze({revision:++serial,clean:false,blockers:[],unknown:false});facts.add(baseline);
 const baselineProof={owners:[],unknown:baseline.unknown,invalid:false};proofs.set(baseline,baselineProof);ownProofs.set(baseline,baselineProof);
 const nativeFact=(requirement:lifecycle.NativeRequirement|undefined):Fact=>{
  if(!requirement)return baseline;
  const fact=Object.freeze({...baseline,revision:++serial});const proof=lifecycle.nativeProof(requirement);
  proofs.set(fact,proof);ownProofs.set(fact,proof);factRequirements.set(fact,requirement);return fact;
 };
 const index=new RecipientOccurrences(()=>{
  if(bindings.get(channel)?.index!==index)return;
  const current=bindings.get(channel)!;
  if(current.delivery.projected&&current.current===current.delivery.projected.fact){
   const support=projectionSupport(current);
   proofs.set(current.current,lifecycle.projectRevision(channel,current.current,support.proof,index.unresolved()!==0));
  }
  wakeChannel(channel);
 },edge=>nativeMembers.get(edge.child)??lifecycle.initialRequirement(),(edge,occurrence,requirement)=>{
  const slot=slotNode(binding,edge.address)?.slots.get(edge.child)??slotFor(edge.parent,edge.key,edge.child),fact=nativeFact(requirement);
  const state={present:edge.present,fact};binding.occurrences.set(edge.child,occurrence);
  if(!binding.presence.has(slot))binding.presence.set(slot,state);if(!binding.completedPresence.has(slot))binding.completedPresence.set(slot,state);indexSlot(binding,slot);
  return proof=>{ownProofs.set(fact,proof);proofs.set(fact,proof);};
 });
 const binding:Binding={delivery:{produced:0,taken:0,reducing:false},legacyScalars:[],index,occurrences:new Map(),collections:new Map(),aggregate:context?.aggregate===true,initialized:new Set(),valueInitialized:true,slotTrie:{children:new Map(),slots:new Map()},fields:new Map(),fieldTrie:{children:new Map()},fieldFacts:new Map(),completedFields:new Map(),releases:[],owner,position,current:baseline,valueFact:baseline,completedValueFact:baseline,valuePayload:context?.value,baselineStructure:baseline,presence:new Map(),completedPresence:new Map(),source,registry:context?.registry,address:context?.address,pending:new Set()};bindings.set(channel,binding);
 if(identity.supported&&source){
  const enroll=(node:object)=>{const occurrence=index.enroll(node);binding.occurrences.set(node,occurrence);return occurrence;};
  enroll(source);
  if(binding.aggregate){
   const seen=new Set<object>();const visit=(candidate:unknown):void=>{
    if(!isTraversableNode(candidate)||seen.has(candidate))return;seen.add(candidate);
    // Every native occurrence enrolls ancestry before its payload adapter branches.
    enroll(candidate);
    if(getEntityPublicationBinding(candidate))return;
    if(isWritableLocation(candidate)){
     const address=getNodeAddress(candidate),relative=address&&context?relativeSourceAddress(context.address,address):undefined;if(!address||relative===undefined)throw Error('Enrolled field has no relative address');
     binding.fields.set(candidate,{address,relative});if(pathValue(binding.valuePayload,relative).present)binding.initialized.add(candidate);
     const requirement=(nativeValues.get(candidate)?.requirement as lifecycle.NativeRequirement|undefined)??lifecycle.initialRequirement(),fact=nativeFact(requirement);
     binding.fieldFacts.set(candidate,fact);binding.completedFields.set(candidate,fact);fieldAt(binding.fieldTrie,relative,true)!.field=candidate;
     installFact(binding,candidate,'value',fact,requirement);
     const release=preparePublicationMutations(candidate,(m,input,native)=>prepareScalar(channel,m,input,candidate,native),completeScalar,()=>captureValueInput(channel,candidate));if(release)binding.releases.push(release);return;
    }
    const storage=nodeStoreOf(candidate)??candidate;
    for(const key of Object.getOwnPropertyNames(storage)){
     const descriptor=Object.getOwnPropertyDescriptor(storage,key);if(descriptor&&'value'in descriptor&&isTraversableNode(descriptor.value)&&(getNodeAddress(descriptor.value)||getEntityPublicationBinding(descriptor.value)))visit(descriptor.value);
    }
   };visit(source);
  }else{
   const requirement=(nativeValues.get(source)?.requirement as lifecycle.NativeRequirement|undefined)??lifecycle.initialRequirement(),fact=nativeFact(requirement);binding.valueFact=fact;binding.completedValueFact=fact;installFact(binding,source,'value',fact,requirement);
   binding.release=preparePublicationMutations(source,(m,input,native)=>prepareScalar(channel,m,input,undefined,native),completeScalar,()=>captureValueInput(channel));
  }
 }
 if(identity.supported&&context&&source){trieFor(context.registry,context.address,true)!.channels.add(channel);}
}
export function onEligibility(_owner:number,cb:()=>void,channel:object):()=>void{callbacks.set(channel,cb);return()=>{callbacks.delete(channel);};}
export function acquire(channel:object,work:()=>void):void{const prev=ingress;ingress={channel,consumed:false,collections:new Set()};try{work();}finally{if(ingress)consumedIngress.delete(ingress);ingress=prev;}}
/** Notification metadata no longer admits publication responsibility. */
export function annotate(meta:WriteMetadata|undefined,_owner:number|undefined,_positions:number[]|undefined,_authored:boolean,_payload:unknown):WriteMetadata{return stampScalarNotification(meta,_payload,serial);}
export function evidence(_meta:unknown):Fact|undefined{return undefined;}
export function complete(_meta:unknown):void{/* Notification metadata does not complete publication responsibility. */}
function decision(fact:Fact|undefined,channel:object):{early:boolean;pending:boolean}{
 if(!fact)return {early:false,pending:false};
 const p=proofs.get(fact);if(!p)return {early:false,pending:true};
 return {early:lifecycle.hasDeclaration(channel,fact)&&!p.invalid&&!p.unknown&&!p.terminalRejectedRoles&&p.owners.every(x=>x.outcome==='confirmed'),pending:[...p.owners,...(p.possible??[])].some(x=>x.outcome==='pending'||x.outcome==='abandoned')};
}
export function pendingDecision(fact:Fact|undefined,channel:object):boolean{return (bindings.get(channel)?.pending.size??0)>0||(bindings.get(channel)?.index.unresolved()??0)>0||decision(fact,channel).pending;}
export function allowed(fact:Fact|undefined,_owner:number,_position:number,channel:object):boolean{
 return !enabled||!lifecycle.isValidating()&&!!fact&&bindings.get(channel)?.current===fact&&!bindings.get(channel)?.pending.size&&!bindings.get(channel)?.index.unresolved()&&(fact.clean||decision(fact,channel).early||grants.get(fact)?.has(channel)===true);
}
type Request={claimant:unknown;key:object;run:()=>void};
export function admit(original:(r:Request)=>void,fact:Fact|undefined,_owner:number,_position:number,channel:object,r:Request):boolean{
 if(!enabled){original(r);return true;}
 if(!bindings.has(channel))throw new Error("Enabled publication source has no binding");
 if(!fact)return false;
 if(lifecycle.isValidating()||bindings.get(channel)?.pending.size||bindings.get(channel)?.index.unresolved())return false;
 const d=decision(fact,channel);
 if(fact&&(fact.clean||d.early)&&bindings.get(channel)?.current===fact){r.run();return true;}
 if(d.pending||fact?.blockers.some(x=>x.outcome==='pending'))return false;
 original({...r,run:()=>{if(fact){let set=grants.get(fact);if(!set)grants.set(fact,set=new Set());set.add(channel);}r.run();}});return true;
}
export function started(fact:Fact|undefined,channel:object):void{if(fact)lifecycle.started(channel,fact,grants.get(fact)?.has(channel)?'surviving':'declared');}
export function dispose(channel:object,_other:object):void{const b=bindings.get(channel);b?.release?.();for(const release of b?.releases??[])release();b?.index.dispose();if(b?.registry&&b.address&&projection.supported(channel)){removeIndex(b.registry,b.address,channel);}if(b)b.legacyScalars.length=0;for(const unit of b?.pending??[]){unit.comparison=undefined;unit.releaseInvocation?.();unit.releaseInvocation=undefined;unit.payload=undefined;unit.resolve();}bindings.delete(channel);lifecycle.disposeConnection(channel);callbacks.delete(channel);projection.releaseSource(channel);}
export function diagnostics(){return {...lifecycle.diagnostics(),...projection.projectionCounts(),listeners:callbacks.size,latest:bindings.size};}
export function declare(channel:object,_owner:number,_position:number,input:unknown,work:()=>unknown,_disposed:()=>boolean){return lifecycle.runDeclaration(channel,input,work);}
/** An unmigrated native projection carries explicit unknown support only.
 * It can use the existing conservative gate, never an active declaration or
 * an older installed unit's permission. Prepared source units reduce separately.
 */
// Observation uncertainty cannot replace installed native or recipient support.
// Reuse one wrapper per selected requirement; repeated notifications add no depth.
const observationRequirements=new WeakMap<lifecycle.NativeRequirement,lifecycle.NativeRequirement>();
const observationWrapped=new WeakSet<lifecycle.NativeRequirement>();
const observationUnknown=requirementOf({owners:[],unknown:true,invalid:false});
function observationRequirement(selected:lifecycle.NativeRequirement):lifecycle.NativeRequirement {
 if(observationWrapped.has(selected))return selected;
 let wrapped=observationRequirements.get(selected);
 if(!wrapped){wrapped=lifecycle.combineNativeRequirements([selected,observationUnknown]);observationRequirements.set(selected,wrapped);observationWrapped.add(wrapped);}
 return wrapped;
}
export function project(channel:object,_meta:unknown,payload:unknown,relative?:readonly string[]):Fact|undefined{
 const b=bindings.get(channel);if(!b||b.pending.size)return undefined;
 const makeFact=():Fact=>{const fact:Fact=Object.freeze({revision:++serial,clean:false,blockers:Object.freeze([]),unknown:true});facts.add(fact);return fact;};
 const replaceContribution=(node:object,previous:Fact|undefined):Fact=>{
  const selected=previous&&factRequirements.get(previous);
  if(!selected)throw Error('Observed scalar has no selected publication requirement');
  const contribution=makeFact();installFact(b,node,'value',contribution,observationRequirement(selected));return contribution;
 };
 if(b.aggregate){
  const field=relative&&fieldAt(b.fieldTrie,relative)?.field;
  if(relative?.length&&!field)throw Error('Observed scalar has no enrolled publication field');
  const fields=field?[field]:[...b.completedFields.keys()];
  for(const node of fields){const contribution=replaceContribution(node,b.completedFields.get(node));b.completedFields.set(node,contribution);b.fieldFacts.set(node,contribution);}
 }else if(b.source){const contribution=replaceContribution(b.source,b.completedValueFact);b.valueFact=contribution;b.completedValueFact=contribution;}
 // The outgoing aggregate has its own fact; contributor readiness callbacks
 // must never overwrite its proof with just the final field's requirement.
 const fact=makeFact(),support=projectionSupport(b);
 const proof=combineProofs([support.proof,lifecycle.nativeProof(observationUnknown)]);
 proofs.set(fact,proof);ownProofs.set(fact,proof);
 lifecycle.observeRevision(channel,fact,proof,b.index.unresolved()!==0);
 b.valuePayload=payload;
 if(b.current)lifecycle.supersede(channel,b.current);
 b.current=fact;selectProjection(b,fact,support.present?(b.aggregate?maskPayload(b):payload):undefined,true);
 return fact;
}
export function refreshSource(channel:object):ProjectionReceipt|undefined{const b=bindings.get(channel);if(b)ready(channel,b);return selectedReceipt(channel);}
export function pendingWork(channel:object):readonly Promise<void>[]{return [...(bindings.get(channel)?.pending??[])].map(x=>x.promise);}

// Native scope admission is independent of recipient registration and disposal.
registerMembershipPublication(prepareMembership,completeMembership);
registerBranchPublicationInputs(beginBranchInput,endBranchInput);

/** A later installed fact for this exact source contribution supersedes an
 * older legacy ping. Aggregate/current revisions and sibling writes do not. */
export function scalarContributionIsCurrent(channel:object,relative:readonly string[],observedRevision:number):boolean {
 const b=bindings.get(channel);if(!b)return false;
 const field=b.aggregate?fieldAt(b.fieldTrie,relative)?.field:undefined;
 const fact=b.aggregate?(field?b.fieldFacts.get(field):undefined):b.valueFact;
 return !fact || !scalarFacts.has(fact) || fact.revision<=observedRevision;
}

/** Uncovered scalar observations retain their own payload and source position.
 * Completion, not a fresh physical read, supplies the recipient base. */
function drainLegacyScalars(channel:object,b:Binding):void {
 for(const contribution of b.legacyScalars.splice(0)){
  if(!scalarContributionIsCurrent(channel,contribution.relative,contribution.revision))continue;
  project(channel,undefined,applyAtRelativePath(b.valuePayload,contribution.relative,contribution.value),contribution.relative);
 }
}
export function projectScalarContribution(channel:object,value:unknown,relative:readonly string[],revision:number):ProjectionReceipt|undefined {
 const b=bindings.get(channel);if(!b)return;
 b.legacyScalars.push({value,relative,revision});
 ready(channel,b);
 return selectedReceipt(channel);
}

