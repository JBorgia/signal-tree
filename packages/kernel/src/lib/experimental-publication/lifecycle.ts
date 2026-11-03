import type { PublicationState } from '../publication-declaration';
import { isTraversableNode } from '../internals/node-shape';
import type { TerminalRecordPlan } from '../internals/intrinsic-mutation';
// Private native experiment; no package export. Publication authority only.
export type Outcome = 'pending' | 'confirmed' | 'rolled-back' | 'abandoned';
export interface OwnerCell { readonly owner:number; readonly id:number; outcome:Outcome; readonly dependents:Set<Operation> }
type Source = {token:object; cells:Map<number,OwnerCell>};
const sources=new Map<number,Source>();
const authentic=new WeakMap<object,OwnerCell>();
const pending=new Set<OwnerCell>();
// Comparison-only chronology. Weak exact-cell keys never retain owner history.
let confirmationSerial=BigInt(0);
const firstConfirmation=new WeakMap<OwnerCell,bigint>();
export type ComparisonAdmission=Readonly<{cutoff:bigint;protectedOwners:readonly OwnerCell[]}>;
export function comparisonCutoff():bigint{return confirmationSerial;}
export function comparisonAdmission(cutoff:bigint,invocation:NativeRequirement):ComparisonAdmission {
 return Object.freeze({cutoff,protectedOwners:Object.freeze([...new Set([
  ...invocation.inputs.flatMap(input=>input.owners),
  ...invocation.frames.flatMap(frame=>[...frame.protectedOwners]),
 ])])});
}
/** Disposable views only: never use this predicate for source or operation cleanup. */
export function comparisonObligations(proof:Readonly<Proof>,admission:ComparisonAdmission):Proof {
 const protectedOwners=new Set(admission.protectedOwners);
 const eligible=new Set([...(proof.input??[]),...(proof.validation??[])].filter(cell=>{
  const confirmed=firstConfirmation.get(cell);
  return confirmed!==undefined&&confirmed<=admission.cutoff&&cell.outcome==='confirmed'&&!protectedOwners.has(cell);
 }));
 return currentObligations(proof,eligible);
}
const queuedConnections=new Set<object>();
let wakeQueued=false;
export function registerOwnerSource(owner:number,token:object):void {if(!sources.has(owner))sources.set(owner,{token,cells:new Map()});}
export function ownerToken(owner:number):object|undefined{return sources.get(owner)?.token;}
export function ownerCell(owner:number,id:number):OwnerCell|undefined{return sources.get(owner)?.cells.get(id);}
export function pendingOwners():readonly OwnerCell[]{return [...pending];}
function wake(channel:object):void{queuedConnections.add(channel);if(wakeQueued)return;wakeQueued=true;queueMicrotask(()=>{wakeQueued=false;const queued=[...queuedConnections];queuedConnections.clear();for(const key of queued){const c=connections.get(key);if(c){for(const op of c.ops.values())refresh(op);c.wake();}}});}
function ownerWake(cell:OwnerCell):void{for(const op of cell.dependents)wake(op.channel);}
// Exact-cell source retirement observers. They are neither recipient operations
// nor readiness observers, and never execute on the transition stack.
type OwnerTransitionObserver = { callback?: () => void; queued: boolean };
const ownerTransitionObservers = new WeakMap<OwnerCell, Set<OwnerTransitionObserver>>();
function queueOwnerObserver(observer: OwnerTransitionObserver): void {
 if (observer.queued || !observer.callback) return;
 observer.queued = true;
 queueMicrotask(() => { observer.queued = false; observer.callback?.(); });
}
function notifyOwnerTransition(cell: OwnerCell): void {
 for (const observer of ownerTransitionObservers.get(cell) ?? []) queueOwnerObserver(observer);
}
/** False for unavailable sources; disappearance never settles the captured cell. */
export function ownerCellCanTransition(cell: OwnerCell): boolean {
 return cell.outcome === 'pending' && sources.get(cell.owner)?.cells.get(cell.id) === cell;
}
export function onOwnerCellTransition(cell: OwnerCell, callback: () => void): () => void {
 const observers = ownerTransitionObservers.get(cell) ?? new Set<OwnerTransitionObserver>();
 if (!ownerTransitionObservers.has(cell)) ownerTransitionObservers.set(cell, observers);
 const observer: OwnerTransitionObserver = { callback, queued: false };
 observers.add(observer);
 // Covers a terminal/disappearance race between assessment and subscription.
 if (!ownerCellCanTransition(cell)) queueOwnerObserver(observer);
 let active = true;
 return () => {
  if (!active) return;
  active = false;
  observer.callback = undefined;
  observers.delete(observer);
  // This handle owns only its original observer set. A later registration may
  // have replaced the cell's index after this set became empty.
  if (!observers.size && ownerTransitionObservers.get(cell) === observers)
   ownerTransitionObservers.delete(cell);
 };
}

export function ownerTransition(owner:number,event:{kind:string;transactionId:number}):void{
 const source=sources.get(owner);if(!source)return;
 let cell=source.cells.get(event.transactionId);
 if(!cell){if(event.kind!=='opened'&&event.kind!=='staged')return;cell={owner,id:event.transactionId,outcome:'pending',dependents:new Set()};source.cells.set(cell.id,cell);}
 if(event.kind==='opened'||event.kind==='staged'){if(cell.outcome==='pending')pending.add(cell);return;}
 if(!['confirmed','rolled-back','abandoned'].includes(event.kind))return;
 const outcome=event.kind as Exclude<Outcome,'pending'>;
 if(cell.outcome!=='pending'&&cell.outcome!==outcome)throw Error('Terminal publication dependency outcome reversed');
 if(cell.outcome==='pending'&&outcome==='confirmed')firstConfirmation.set(cell,++confirmationSerial);
 cell.outcome=outcome;pending.delete(cell);
 // Synchronous normal/recovery handle enrollment can still obtain this cell.
 const retired=cell;queueMicrotask(()=>{if(source.cells.get(retired.id)===retired&&retired.outcome!=='pending')source.cells.delete(retired.id);});
 ownerWake(cell);notifyOwnerTransition(cell);
}
export function abandonOwnerSource(owner:number):void{
 const source=sources.get(owner);if(!source)return;
 // Unregister storage only. Native lifecycle alone determines terminal outcome.
 for(const cell of source.cells.values()){pending.delete(cell);ownerWake(cell);notifyOwnerTransition(cell);}
 source.cells.clear();sources.delete(owner);
}
export function enroll<T extends object>(handle:T,owner:number|undefined,id:number):T{
 if(owner!==undefined){const cell=ownerCell(owner,id);if(cell)authentic.set(handle,cell);}
 return handle;
}
type State = PublicationState;
type View = {value:State};
type Connection={report:(error:unknown)=>void;wake:()=>void;supported:boolean;ops:Map<object,Operation>;disposed:boolean};
type Horizon={frames:Set<Frame>;requirements:Set<NativeRequirement>;open:number};
type Frame={channel:object;connection:Connection;parents:readonly Frame[];horizon:Horizon;declaredOwners?:readonly OwnerCell[];owners:OwnerCell[];unknown:boolean;invalid:boolean;view:View;last?:object;ops:Set<Operation>;installedOwners:Set<OwnerCell>;protectedOwners:Set<OwnerCell>};
export type Proof={
 readonly owners:readonly OwnerCell[];
 /** D gates delivery; it is promoted to I only when a source input is consumed. */
 readonly destination?:readonly OwnerCell[];
 readonly input?:readonly OwnerCell[];
 readonly validation?:readonly OwnerCell[];
 readonly possible?:readonly OwnerCell[];
 /** Terminal role bits preserve rejected obligations without fake owner identities. */
 readonly terminalRejectedRoles?:number;
 /** Missing evidence for this exact input; consuming it acquires a new window. */
 readonly unavailableInput?:boolean;
 /** A fixed authorship window existed; terminal cleanup must not rebase it. */
 readonly historicalWindow?:boolean;
 readonly unknown:boolean;
 readonly invalid:boolean;
};
const uniqueOwners=(owners:readonly OwnerCell[]):readonly OwnerCell[]=>Object.freeze([...new Set(owners)]);
/** Combine reasons without normalizing inherited uncertainty against actual owners. */
export function combineProofs(parts:readonly (Readonly<Proof>|undefined)[]):Proof {
 return {owners:uniqueOwners(parts.flatMap(p=>p?.owners??[])),
  destination:uniqueOwners(parts.flatMap(p=>p?.destination??[])),
  input:uniqueOwners(parts.flatMap(p=>p?.input??[])),
  validation:uniqueOwners(parts.flatMap(p=>p?.validation??[])),
  possible:uniqueOwners(parts.flatMap(p=>p?.possible??[])),
  terminalRejectedRoles:parts.reduce((bits,p)=>bits|(p?.terminalRejectedRoles??0),0),
  unavailableInput:parts.some(p=>p?.unavailableInput===true),
  historicalWindow:parts.some(p=>p?.historicalWindow===true),
  unknown:parts.some(p=>!p||p.unknown),invalid:parts.some(p=>p?.invalid===true)};
}
/** Source-owned facts. Until horizon close only actual executing frames are held. */
export type NativeInput={readonly requirement:NativeRequirement;readonly owners:readonly OwnerCell[];readonly terminalRejectedRoles?:number};
export type NativeRequirement={
/** Preparation provenance, never inferred from a compacted unknown bit. */
readonly retirementOwnWindowOnly?: boolean;
readonly components?:readonly NativeRequirement[];proof?:Proof;inputs:readonly NativeInput[];frames:readonly Frame[];known:readonly OwnerCell[];unknown:boolean;possible:readonly OwnerCell[];captureWindow:boolean};
// Readiness is independent of proof presence: composite proofs are live views.
const unfinishedRequirements=new WeakSet<NativeRequirement>();
const unactivatedRequirements=new WeakSet<NativeRequirement>();
const requirementListeners=new WeakMap<NativeRequirement,Set<()=>void>>();
export function nativeRequirementReady(requirement:NativeRequirement):boolean {
 return !unfinishedRequirements.has(requirement)&&!unactivatedRequirements.has(requirement)&&(requirement.components??[]).every(nativeRequirementReady);
}
export function combineNativeRequirements(components:readonly NativeRequirement[]):NativeRequirement {
 const sources=Object.freeze([...new Set(components)]);
 return {components:sources,get proof(){return combineProofs(sources.map(nativeProof));},inputs:[],frames:[],known:[],unknown:false,possible:[],captureWindow:false};
}
/** Exact recursive retirement classification, separate from publication roles. */
export type FinalizedRetirement = Readonly<{ blocked:boolean; possible:readonly OwnerCell[] }>;
const finalizedRetirements=new WeakMap<NativeRequirement,FinalizedRetirement>();
const scalarComposites=new WeakSet<NativeRequirement>();
const normalizingScalars=new WeakSet<NativeRequirement>();
export function finalizedRetirement(requirement:NativeRequirement):FinalizedRetirement|undefined {
 return finalizedRetirements.get(requirement);
}
function retirementClassification(requirement:NativeRequirement):FinalizedRetirement {
 const saved=finalizedRetirements.get(requirement);if(saved)return saved;
 if(requirement.components){
  const parts=requirement.components.map(retirementClassification);
  return {blocked:parts.some(part=>part.blocked),possible:uniqueOwners(parts.flatMap(part=>part.possible))};
 }
 const p=nativeProof(requirement);
 if(p.invalid||p.unavailableInput||p.terminalRejectedRoles||p.owners.length||p.destination?.length||p.input?.length||p.validation?.length)return {blocked:true,possible:[]};
 if(!p.unknown&&!(p.possible?.length??0))return {blocked:false,possible:[]};
 if(!requirement.retirementOwnWindowOnly||!p.historicalWindow)return {blocked:true,possible:[]};
 return {blocked:false,possible:uniqueOwners(p.possible??[])};
}
function normalizeScalar(requirement:NativeRequirement):void {
 if(!scalarComposites.has(requirement)||!requirement.components||!nativeRequirementReady(requirement))return;
 // Compute both certificates while ancestry is intact. Preserve endpoint identity,
 // exact role cells, root provenance and live outcomes/source availability.
 const proof=nativeProof(requirement),retirement=retirementClassification(requirement);
 finalizedRetirements.set(requirement,Object.freeze(retirement));
 Object.defineProperty(requirement,'proof',{value:proof,writable:true,configurable:true,enumerable:true});
 Reflect.deleteProperty(requirement,'components');
}
/** Admission-local confirmed history, never a settlement-time filter. */
export type CurrentRelevance=ReadonlySet<OwnerCell>;
export function currentRelevance(prior:NativeRequirement,selected:NativeRequirement|undefined,invocation:NativeRequirement):CurrentRelevance {
 // P is the installed predecessor; S is a selected OLD contributor, never C.
 // Consumed historical requirements must also be closed at this admission.
 const historical=[...new Set([prior,...(selected?[selected]:[]),...invocation.inputs.map(input=>input.requirement)])];
 if(historical.some(requirement=>!nativeRequirementReady(requirement)))return new Set();
 const protectedOwners=new Set(invocation.inputs.flatMap(input=>input.owners));
 for(const frame of invocation.frames)for(const cell of frame.protectedOwners)protectedOwners.add(cell);
 // H (closed historical I/V) and V (current confirmed validation) share
 // relevance only after this closure test and the captured-pending lower bound.
 const parts=[...historical.map(nativeProof),nativeProof(invocation)];
 return new Set(parts.flatMap(part=>[...(part.input??[]),...(part.validation??[])])
  .filter(cell=>cell.outcome==='confirmed'&&!protectedOwners.has(cell)));
}
export function currentObligations(proof:Readonly<Proof>,relevance:CurrentRelevance|undefined):Proof {
 if(!relevance?.size)return proof;
 const classified=new Set([...(proof.destination??[]),...(proof.input??[]),...(proof.validation??[])]);
 const protectedOwners=new Set([...(proof.destination??[]),...(proof.possible??[]),...proof.owners.filter(cell=>!classified.has(cell))]);
 const keep=(cell:OwnerCell)=>!relevance.has(cell)||protectedOwners.has(cell);
 const input=Object.freeze((proof.input??[]).filter(keep)),validation=Object.freeze((proof.validation??[]).filter(keep));
 return {...proof,input,validation,owners:Object.freeze(proof.owners.filter(keep))};
}
function reconcileCurrentDependencies(op:Operation,proof:Readonly<Proof>,relevance:CurrentRelevance|undefined):void {
 if(!relevance?.size)return;
 const retained=new Set([...proof.owners,...(proof.possible??[])]);
 for(const cell of op.dependencies)if(relevance.has(cell)&&cell.outcome==='confirmed'&&!retained.has(cell)){
  op.dependencies.delete(cell);cell.dependents.delete(op);
 }
}
/** Scalar-only construction; never installs listeners during preparation. */
export function combineScalarNativeRequirements(parts:readonly NativeRequirement[],relevance?:CurrentRelevance):NativeRequirement {
 const requirement=combineNativeRequirements(parts);
 if(relevance?.size){
  const sources=requirement.components; // Frozen construction snapshot, released on normalization.
  if(!sources)throw new Error('Scalar composite has no construction snapshot');
  Object.defineProperty(requirement,'proof',{get:()=>currentObligations(combineProofs(sources.map(nativeProof)),sources.every(nativeRequirementReady)?relevance:undefined),configurable:true,enumerable:true});
 }
 scalarComposites.add(requirement);
 normalizeScalar(requirement);return requirement;
}
/** Called only by installed scalar native completion. Outstanding synchronous
 * completion/horizon work owns this finite registration, not Link or owner life.
 * Register before activation, which may notify a throwing listener. */
export function completeScalarNativeRequirement(requirement:NativeRequirement|undefined,activation:NativeRequirement|undefined):void {
 let failed=false,first:unknown;
 try{
  if(requirement&&scalarComposites.has(requirement)&&requirement.components&&!normalizingScalars.has(requirement)){
   normalizingScalars.add(requirement);
   onNativeRequirementReady(requirement,()=>{
    normalizingScalars.delete(requirement);normalizeScalar(requirement);
   });
  }
 }catch(error){failed=true;first=error;}
 try{deliverNativeRequirementReady(activation);}catch(error){if(!failed){failed=true;first=error;}}
 if(failed)throw first;
}
export function onNativeRequirementReady(requirement:NativeRequirement,callback:()=>void):()=>void {
 if(nativeRequirementReady(requirement)&&!unactivatedRequirements.has(requirement)){callback();return ()=>{/* Already ready; no subscription to release. */};}
 let active=true;
 const releases:(()=>void)[]=[];
 const release=()=>{active=false;for(const off of releases)off();releases.length=0;};
 const check=()=>{if(active&&nativeRequirementReady(requirement)&&!unactivatedRequirements.has(requirement)){release();callback();}};
 const visit=(part:NativeRequirement)=>{
  if(unfinishedRequirements.has(part)||unactivatedRequirements.has(part)){
   const listeners=requirementListeners.get(part)??new Set<()=>void>();if(!requirementListeners.has(part))requirementListeners.set(part,listeners);
   listeners.add(check);releases.push(()=>{listeners.delete(check);if(!listeners.size)requirementListeners.delete(part);});
  }
  for(const child of part.components??[])visit(child);
 };
 visit(requirement);return release;
}
function notifyRequirement(requirement:NativeRequirement):void {
 const callbacks=requirementListeners.get(requirement);requirementListeners.delete(requirement);
 let failed=false,first:unknown;
 for(const callback of [...callbacks??[]])try{callback();}catch(error){if(!failed){failed=true;first=error;}}
 if(failed)throw first;
}
/** Capture before user code: later confirmation cannot rewrite consumed input.
 * Keep the source requirement for uncertainty and unfinished validation; only
 * already-confirmed actual owners are discharged from this new consumption. */
export function captureNativeInput(requirement:NativeRequirement):NativeInput {
 const proof=nativeProof(requirement);
 return Object.freeze({requirement,owners:Object.freeze(proof.owners.filter(owner=>owner.outcome!=='confirmed')),terminalRejectedRoles:proof.terminalRejectedRoles??0});
}
export function nativeProof(requirement: NativeRequirement): Proof {
 const p=requirement.proof;if(p)return p;
 const inputs=requirement.inputs.map(input=>nativeProof(input.requirement));
 const validation=requirement.frames.map(effective);
 // Every actual source obligation, including its destination authorship,
 // becomes an input lower bound at this consumption boundary. W stays W.
 const input=uniqueOwners(requirement.inputs.flatMap(input=>input.owners));
 const declared=uniqueOwners(validation.flatMap(p=>p.owners));
 const ownWindow=requirement.captureWindow||requirement.frames.some(frameInvalid)
  ?requirement.possible:[];
 return {destination:requirement.known,input,validation:declared,
  owners:uniqueOwners([...requirement.known,...input,...declared]),
  possible:uniqueOwners([...ownWindow,...inputs.flatMap(p=>p.possible??[])]),
  // Authorship consumes unavailable input into this installation's fixed W.
  // Selecting/combining a contributor does not pass through this boundary.
  terminalRejectedRoles:requirement.inputs.some(input=>(input.terminalRejectedRoles??0)!==0)?2:0,
  unavailableInput:false,
  historicalWindow:requirement.captureWindow||inputs.some(p=>p.historicalWindow===true),
  unknown:requirement.unknown||ownWindow.length>0||inputs.some(p=>p.unknown)||validation.some(p=>p.unknown),
  invalid:inputs.some(p=>p.invalid)||validation.some(p=>p.invalid)};
}
export function initialRequirement():NativeRequirement{return {proof:{owners:[],unknown:false,invalid:false},inputs:[],frames:[],known:[],unknown:false,possible:[],captureWindow:false};}
/** An exact physical input whose ordinary authorship cannot be certified. */
export function unavailableRequirement():NativeRequirement {
 return {proof:{owners:[],unknown:true,invalid:false,unavailableInput:true},inputs:[],frames:[],known:[],unknown:true,possible:[],captureWindow:false};
}
export function prepareNativeRequirement(known:readonly OwnerCell[], unknown:boolean, inputs:readonly NativeInput[]):{requirement:NativeRequirement;record:TerminalRecordPlan}{
 const active=[...stack];
 // Input completeness, not destination ownership, decides whether W applies.
 const captureWindow=active.length===0||active.some(f=>f.declaredOwners===undefined)
  ||inputs.some(input=>nativeProof(input.requirement).unavailableInput===true);
 const requirement:NativeRequirement={retirementOwnWindowOnly:!unknown&&known.length===0&&inputs.length===0&&active.length===0,known:Object.freeze([...known]),unknown,inputs:Object.freeze([...inputs]),frames:active,possible:[],captureWindow};
 unfinishedRequirements.add(requirement);unactivatedRequirements.add(requirement);
 // No frame consumes preliminary evidence; finalization still samples foreign owners.
 const adds:TerminalRecordPlan['adds'][number][]=[];
 if(active.length){
 const evidence=nativeProof(requirement);
 for(const frame of active){
  for(const owner of inputs.flatMap(input=>input.owners))adds.push({set:frame.protectedOwners,value:owner});
  for(const owner of [...(evidence.input??[]),...(evidence.validation??[])])adds.push({set:frame.installedOwners,value:owner});
  const declaredOwners=frame.declaredOwners;
  if(declaredOwners!==undefined&&((evidence.terminalRejectedRoles??0)!==0||[...(evidence.input??[]),...(evidence.validation??[])].some(owner=>!declaredOwners.includes(owner))))adds.push({set:invalidFrames,value:frame});
  if(evidence.unknown)adds.push({set:unknownFrames,value:frame});
 }
 }
 const h=active.at(-1)?.horizon;
 if(h)adds.push({set:h.requirements,value:requirement});
 // Pure window finalization occurs after all callback-capable preparers, before installation.
 return {requirement,record:{writes:[],adds}};
}
export function finalizeNativeRequirement(requirement:NativeRequirement):void {
 // Normalize ONLY this installation's newly acquired candidate window. An
 // inherited W with the same identity as D/I/V remains in the input proof.
 const actualInputs=new Set(requirement.inputs.flatMap(input=>input.owners));
 const destination=new Set(requirement.known);
 requirement.possible=Object.freeze([...pending].filter(owner=>!destination.has(owner)&&!actualInputs.has(owner)));
 // Source inputs are immutable snapshots; only the not-yet-installed unit's own window is refreshed.
 if(requirement.frames.length===0){requirement.proof=nativeProof(requirement);requirement.inputs=[];requirement.known=[];unfinishedRequirements.delete(requirement);}
}
/** Installed completion delivers readiness; sealing itself never calls subscribers. */
export function deliverNativeRequirementReady(requirement:NativeRequirement|undefined):void {
 if(!requirement||!unactivatedRequirements.delete(requirement))return;
 if(nativeRequirementReady(requirement))notifyRequirement(requirement);
}
type Operation={relevance?:CurrentRelevance;invocation?:NativeRequirement;declared:boolean;recipientWindow:readonly OwnerCell[];incomplete:boolean;projectionPending:boolean;native?:NativeRequirement;coverageUnknown:boolean;channel:object;dependencies:Set<OwnerCell>;revision:object;frames:Set<Frame>;proof?:Proof;views:Set<View>;started:boolean;surviving:boolean;noopFallbacks:Map<View,Operation>};
const connections=new Map<object,Connection>();
const stack:Frame[]=[];
const installedLast=new Map<Frame,object>();
const unknownFrames=new Set<Frame>();
const invalidFrames=new Set<Frame>();
const frameOwners=(f:Frame):readonly OwnerCell[]=>[...new Set([...f.owners,...f.installedOwners])];
const frameUnknown=(f:Frame):boolean=>f.unknown||unknownFrames.has(f);
const frameInvalid=(f:Frame):boolean=>f.invalid||invalidFrames.has(f);
const frameLast=(f:Frame):object|undefined=>installedLast.get(f)??f.last;

let reporting=false;
export class SignalTreePublicationError extends Error{
 readonly code='SIGNALTREE_PUBLICATION_DECLARATION_INVALID';
 constructor(readonly stage:'before-callback'|'after-callback',readonly reason:'malformed'|'unavailable-owner'|'contradiction'|'async-callback'|'validation-threw'|'disposed'|'unsupported-source',options?:{cause?:unknown}){super(`Declaration invalid: ${reason}; writes may remain`);if(options && 'cause' in options)Object.defineProperty(this,'cause',{value:options.cause,writable:true,configurable:true});}
}
export function registerConnection(channel:object,options:{report:(error:unknown)=>void;wake:()=>void;supported:boolean}):void{
 if(connections.has(channel))throw Error('Publication connection already registered');
 connections.set(channel,{...options,ops:new Map(),disposed:false});
}
function state(view:View,value:State):void {if(['started','superseded','disposed','no-write'].includes(view.value.state))return;view.value=Object.freeze(value);}
function effective(frame:Frame):Proof{const all=[...frame.parents,frame];const validation=uniqueOwners(all.flatMap(frameOwners));return {owners:validation,validation,unknown:all.some(frameUnknown),invalid:all.some(frameInvalid)};}
function setOperationState(op:Operation,value:State):void{for(const view of op.views)state(view,value);}
// Prospective relevance cannot weaken an operation before raw validation and
// native activation finish. No listener or deferred reclassification is created.
function projectionReady(op:Operation):boolean {
 return !op.relevance?.size||(!op.frames.size&&(!op.invocation||nativeRequirementReady(op.invocation))&&(!op.native||nativeRequirementReady(op.native)));
}
function refresh(op:Operation):void{
 if(op.started)return;
 if(op.frames.size||op.projectionPending||!projectionReady(op)){for(const view of op.views)state(view,{state:'validating'});return;}
 const p=op.proof;if(!p)return;
 if(p.invalid||p.unknown){setOperationState(op,{state:'conservative',reason:p.invalid?'invalid-declaration':'unknown'});return;}
 if((p.terminalRejectedRoles??0)!==0||p.owners.some(x=>x.outcome==='rolled-back'||x.outcome==='abandoned')){setOperationState(op,{state:'conservative',reason:'rejected-dependency'});return;}
 setOperationState(op,p.owners.some(x=>x.outcome==='pending')?{state:'held',reason:'pending-dependency'}:{state:'eligible',basis:'declared'});
}
/** Preparation-site causes; recipient domain uncertainty is not unobserved authorship. */
export type RecipientUncertainty=Readonly<{
 unobservedOrigin?:boolean;
 invalidAttribution?:boolean;
 uncapturedUpdaterInput?:boolean;
 recipientDomain?:boolean;
}>;
/** Snapshot declaration responsibility before native installation, never at delivery. */
export function prepareRevision(channel:object,revision:object,known:readonly OwnerCell[],uncertainty:RecipientUncertainty={},blockers:readonly OwnerCell[]=[],native?:NativeRequirement,projectionPending=false,invocation:NativeRequirement|undefined=native,relevance?:CurrentRelevance):TerminalRecordPlan & {finalize?:()=>void} {
 const c=connections.get(channel);
 const writes:TerminalRecordPlan['writes'][number][]=[];
 const adds:TerminalRecordPlan['adds'][number][]=[];
 const deletes:NonNullable<TerminalRecordPlan['deletes']>[number][]=[];
 if(!c||c.disposed)return {writes,adds};
 const unknown=!!(uncertainty.unobservedOrigin||uncertainty.invalidAttribution||uncertainty.uncapturedUpdaterInput||uncertainty.recipientDomain);
 const unobservedAuthorship=!!(uncertainty.unobservedOrigin||uncertainty.invalidAttribution||uncertainty.uncapturedUpdaterInput);
 const active=[...stack];
 const matches=active.filter(f=>f.channel===channel);
 const nativeEvidence=native?nativeProof(native):undefined;
 // Selected source support remains output debt; only actual invocation input
 // and validation evidence participates in this declaration's assertion.
 const invocationEvidence=invocation?nativeProof(invocation):undefined;
 const required=uniqueOwners([...active.flatMap(frameOwners),...(invocationEvidence?.input??[]),...(invocationEvidence?.validation??[])]);
 // Native support is source evidence, not this recipient's declaration permission.
 // Without a native requirement retain the conservative enrollment window.
 const op:Operation={relevance,invocation:relevance?.size?invocation:undefined,declared:matches.length!==0,recipientWindow:[],incomplete:(!native&&matches.length===0)||unobservedAuthorship||active.some(frame=>frame.declaredOwners===undefined),projectionPending,native,coverageUnknown:unknown,channel,dependencies:new Set([...known,...required,...(nativeEvidence?.owners??[]),...(nativeEvidence?.possible??[]),...blockers]),revision,frames:new Set(),views:new Set(),started:false,surviving:false,noopFallbacks:new Map()};
 if(matches.length===0)op.proof={owners:Object.freeze([...known]),destination:Object.freeze([...known]),unknown:unknown||!native,invalid:false};
 writes.push({map:c.ops,key:revision,value:op});
 for(const cell of op.dependencies)adds.push({set:cell.dependents,value:op});
 for(const frame of active){
  const declared=frame.declaredOwners;
  if(declared!==undefined&&required.some(owner=>!declared.includes(owner)))adds.push({set:invalidFrames,value:frame});
 }
 for(const f of active){
  const matching=matches.includes(f);
  const previous=frameLast(f);const old=previous&&f.connection.ops.get(previous);
  if(matching&&old){deletes.push({map:old.views,key:f.view});if(f.ops.has(old))op.noopFallbacks.set(f.view,old);}
  for(const cell of required)adds.push({set:f.installedOwners,value:cell});
  // Recipient coverage is never installed into the shared execution frame.
  if(active.some(frameUnknown))adds.push({set:unknownFrames,value:f});
  if(matching)writes.push({map:installedLast,key:f,value:revision});
  if(matching)adds.push({set:op.frames,value:f},{set:op.views,value:f.view},{set:f.ops,value:op});
 }
 let finalized=false;
 return {writes,adds,deletes,finalize:()=>{
  if(finalized||!op.incomplete)return;
  finalized=true;
  // This binding's fixed authorship window is separate from source-native D/I/V.
  // Finalization runs after callback-capable preparers, before record installation.
  const actualInputs=new Set(native?nativeProof(native).input??[]:[]);
  const destination=new Set(known);
  op.recipientWindow=Object.freeze([...pending].filter(owner=>!destination.has(owner)&&!actualInputs.has(owner)));
  if(op.proof)op.proof=recipientProof(op,op.proof);
 }};
}
/** Keep binding-local incompleteness across every projection recomposition. */
function recipientProof(op:Operation,proof:Readonly<Proof>):Proof {
 if(!op.incomplete)return proof;
 return {...proof,unknown:true,historicalWindow:true,
  possible:uniqueOwners([...(proof.possible??[]),...op.recipientWindow])};
}
export function proof(channel:object,revision:object):Readonly<Proof>|undefined {
 const op=connections.get(channel)?.ops.get(revision);
 if(!op||op.frames.size)return undefined;
 return op.proof;
}
/** Only a matching declaration may use declared early admission. */
export function hasDeclaration(channel:object,revision:object):boolean {
 return connections.get(channel)?.ops.get(revision)?.declared===true;
}
/** Operand completion, not owner settlement. No mutation or permission grant. */
export function comparisonRevisionReady(channel:object,revision:object):boolean {
 const op=connections.get(channel)?.ops.get(revision);
 return !!op&&!op.frames.size&&!op.projectionPending&&projectionReady(op)&&
  (!op.native||nativeRequirementReady(op.native));
}
export function noWrite(channel:object,revision:object):void {
 const c=connections.get(channel),op=c?.ops.get(revision);if(!c||!op)return;
 for(const view of op.views){
  let fallback=op.noopFallbacks.get(view);
  while(fallback&&!c.ops.has(fallback.revision))fallback=fallback.noopFallbacks.get(view);
  if(fallback){fallback.views.add(view);refresh(fallback);}else state(view,{state:'no-write'});
 }
 op.views.clear();retire(op);c.ops.delete(revision);
}
/** A meaningful revision no longer needs tentative receipt predecessors. */
export function keepRevision(channel:object,revision:object):void{connections.get(channel)?.ops.get(revision)?.noopFallbacks.clear();}
export function decision(channel:object,revision:object):{early:boolean;pending:boolean}{
 const op=connections.get(channel)?.ops.get(revision);if(!op)return {early:false,pending:false};
 if(op.frames.size||op.projectionPending||!projectionReady(op))return {early:false,pending:true};
 const p=op.proof;if(!p)throw new Error('Ready publication has no proof');return {early:!p.invalid&&!p.unknown&&!(p.terminalRejectedRoles??0)&&p.owners.every(x=>x.outcome==='confirmed'),pending:[...p.owners,...(p.possible??[])].some(x=>x.outcome==='pending'||x.outcome==='abandoned')};
}
function retire(op:Operation):void{for(const cell of op.dependencies)cell.dependents.delete(op);}
export function started(channel:object,revision:object,basis:'declared'|'surviving'='declared'):void{
 const op=connections.get(channel)?.ops.get(revision);if(!op)return;
 op.started=true;op.surviving=basis==='surviving';setOperationState(op,{state:'started',basis});
 retire(op);op.noopFallbacks.clear();op.proof=undefined;op.frames.clear();op.views.clear();connections.get(channel)?.ops.delete(revision);
}
export function supersede(channel:object,revision:object):void{
 const c=connections.get(channel),op=c?.ops.get(revision);if(!c||!op)return;
 if(!op.started)setOperationState(op,{state:'superseded'});
 retire(op);c.ops.delete(revision);
}
export function disposeConnection(channel:object):void{
 const c=connections.get(channel);if(!c)return;c.disposed=true;
 for(const op of c.ops.values()){if(!op.started)setOperationState(op,{state:'disposed'});retire(op);}
 c.ops.clear();connections.delete(channel);
}
function finish(h:Horizon):void{
 const deliveries=[...h.requirements];
 for(const requirement of h.requirements){requirement.proof=nativeProof(requirement);}
 for(const requirement of h.requirements){requirement.inputs=[];requirement.frames=[];requirement.known=[];}
 // All sources close before any recipient recomposes its selected support.
 for(const requirement of h.requirements)unfinishedRequirements.delete(requirement);

 h.requirements.clear();
 const operations=new Set<Operation>();
 for(const f of h.frames){
  if(!frameLast(f))state(f.view,{state:f.connection.disposed?'disposed':'no-write'});
  for(const op of f.ops)operations.add(op);
 }
 for(const op of operations){
  const proofs=[...op.frames].map(effective);if(op.native)proofs.push(nativeProof(op.native));
  const raw=recipientProof(op,{...combineProofs(proofs),unknown:op.coverageUnknown||proofs.some(p=>p.unknown)});
  op.frames.clear();
  const relevance=projectionReady(op)?op.relevance:undefined;
  op.proof=currentObligations(raw,relevance);
  reconcileCurrentDependencies(op,op.proof,relevance);
  for(const cell of [...op.proof.owners,...(op.proof.possible??[])]){op.dependencies.add(cell);cell.dependents.add(op);}
  refresh(op);wake(op.channel);
 }
 for(const f of h.frames){f.ops.clear();f.installedOwners.clear();installedLast.delete(f);unknownFrames.delete(f);invalidFrames.delete(f);}
 h.frames.clear();
 let failed=false,first:unknown;
 for(const requirement of deliveries)if(nativeRequirementReady(requirement))try{notifyRequirement(requirement);}catch(error){if(!failed){failed=true;first=error;}}
 if(failed)throw first;
}
export function runDeclaration(channel:object,input:unknown,work:()=>unknown):{read():State}{
 const c=connections.get(channel);if(!c||c.disposed)throw new SignalTreePublicationError('before-callback','disposed');
 if(!c.supported)throw new SignalTreePublicationError('before-callback','unsupported-source');
 const view:View={value:Object.freeze({state:'validating'})};
 // This closure captures only a detached status cell, never connection/frame.
 const receipt=makeReceipt(view);
 const h=stack.at(-1)?.horizon??{frames:new Set<Frame>(),requirements:new Set<NativeRequirement>(),open:0};
 const frame:Frame={channel,connection:c,parents:[...stack],horizon:h,owners:[],unknown:true,invalid:false,view,ops:new Set(),installedOwners:new Set(),protectedOwners:new Set()};
 h.frames.add(frame);h.open++;stack.push(frame);
 let stage:'before-callback'|'after-callback'='before-callback';let thrown=false;let primary:unknown;let exitingError=false;let completionFailed=false;let completionError:unknown;
 try{
  if(!isTraversableNode(input)||typeof input==='function'||typeof work!=='function')throw new SignalTreePublicationError(stage,'malformed');
  const d=input as {kind?:unknown;owners?:unknown};const kind=d.kind;
  if(kind!=='independent'&&kind!=='dependent'&&kind!=='unknown')throw new SignalTreePublicationError(stage,'malformed');
  const owners:OwnerCell[]=[];
  if(kind==='dependent'){
   const list=d.owners;if(!Array.isArray(list))throw new SignalTreePublicationError(stage,'malformed');
   for(const handle of list){const cell=handle&&typeof handle==='object'?authentic.get(handle):undefined;if(!cell||cell.outcome==='rolled-back'||cell.outcome==='abandoned')throw new SignalTreePublicationError(stage,'unavailable-owner');owners.push(cell);}
  }
  frame.declaredOwners=kind==='unknown'?undefined:Object.freeze([...new Set(owners)]);
  for(const cell of owners)if(cell.outcome!=='confirmed')frame.protectedOwners.add(cell);
  frame.owners=[...new Set([...frame.owners,...owners])];// Input-validation writes cannot become independent retroactively.
  frame.unknown=kind==='unknown'||frame.ops.size>0;
  stage='after-callback';let result:unknown;
  try{result=work();}catch(error){thrown=true;primary=error;}
  if(isTraversableNode(result))if(typeof(result as {then?:unknown}).then==='function')throw new SignalTreePublicationError(stage,'async-callback');
  if(frameInvalid(frame))throw new SignalTreePublicationError(stage,'contradiction');
  if(thrown)throw primary;
 }catch(error){
  exitingError=true;
  for(const f of stack)f.invalid=true;
  if(thrown){
   if(error!==primary&&!reporting){reporting=true;try{c.report(error);}catch{/* reporting cannot replace primary */}finally{reporting=false;}}
   throw primary;
  }
  if(error instanceof SignalTreePublicationError)throw error;
  throw new SignalTreePublicationError(stage,'validation-threw',{cause:error});
 }finally{
  stack.pop();h.open--;
  try{if(h.open===0)finish(h);}catch(error){
   if(!exitingError){completionFailed=true;completionError=error;}
   else if(!reporting){reporting=true;try{c.report(error);}catch{/* completion reporting cannot replace the primary */}finally{reporting=false;}}
  }finally{wake(channel);}
 }
 if(completionFailed)throw completionError;
 return receipt;
}
function makeReceipt(view:View):{read():State}{return Object.freeze({read:()=>view.value});}
export function diagnostics(){let cells=0,operations=0;for(const s of sources.values())cells+=s.cells.size;for(const c of connections.values())operations+=c.ops.size;return {sources:sources.size,pendingOwners:pending.size,ownerCells:cells,connections:connections.size,operations,activeFrames:stack.length};}
// Destruction releases registry ownership without inventing a settlement result.
export const unregisterOwnerSource=abandonOwnerSource;
export function isValidating():boolean{return stack.length!==0;}


/** A notification selects existing support, never a declaration or a new window.
 * Track its exact dependencies through the same wake/retire/dispose lifecycle. */
export function observeRevision(channel:object,revision:object,proof:Readonly<Proof>,projectionPending:boolean):void {
 const c=connections.get(channel);if(!c||c.disposed)return;
 if(c.ops.has(revision))throw Error('Observed revision already registered');
 const op:Operation={declared:false,recipientWindow:[],incomplete:false,projectionPending,coverageUnknown:false,channel,dependencies:new Set(),revision,frames:new Set(),views:new Set(),started:false,surviving:false,noopFallbacks:new Map(),proof};
 c.ops.set(revision,op);projectRevision(channel,revision,proof,projectionPending);
}
export function projectRevision(channel:object,revision:object,proof:Readonly<Proof>,projectionPending=false):Readonly<Proof>{
 const op=connections.get(channel)?.ops.get(revision);if(!op)return proof;
 const ready=projectionReady(op),relevance=ready?op.relevance:undefined;
 const selected=currentObligations(recipientProof(op,proof),relevance);
 reconcileCurrentDependencies(op,selected,relevance);
 if(ready){op.relevance=undefined;op.invocation=undefined;}
 op.projectionPending=projectionPending;op.proof=selected;
 for(const cell of [...selected.owners,...(selected.possible??[])]){op.dependencies.add(cell);cell.dependents.add(op);}
 refresh(op);return selected;
}

