import type { TerminalRecordPlan } from '../internals/intrinsic-mutation';
// Private native experiment; no package export. Publication authority only.
export type Outcome = 'pending' | 'confirmed' | 'rolled-back' | 'abandoned';
export interface OwnerCell { readonly owner:number; readonly id:number; outcome:Outcome; readonly dependents:Set<Operation> }
type Source = {token:object; cells:Map<number,OwnerCell>};
const sources=new Map<number,Source>();
const authentic=new WeakMap<object,OwnerCell>();
const pending=new Set<OwnerCell>();
const queuedConnections=new Set<object>();
let wakeQueued=false;
export function registerOwnerSource(owner:number,token:object):void {if(!sources.has(owner))sources.set(owner,{token,cells:new Map()});}
export function ownerToken(owner:number):object|undefined{return sources.get(owner)?.token;}
export function ownerCell(owner:number,id:number):OwnerCell|undefined{return sources.get(owner)?.cells.get(id);}
export function pendingOwners():readonly OwnerCell[]{return [...pending];}
function wake(channel:object):void{queuedConnections.add(channel);if(wakeQueued)return;wakeQueued=true;queueMicrotask(()=>{wakeQueued=false;const queued=[...queuedConnections];queuedConnections.clear();for(const key of queued){const c=connections.get(key);if(c){for(const op of c.ops.values())refresh(op);c.wake();}}});}
function ownerWake(cell:OwnerCell):void{for(const op of cell.dependents)wake(op.channel);}
export function ownerTransition(owner:number,event:{kind:string;transactionId:number}):void{
 const source=sources.get(owner);if(!source)return;
 let cell=source.cells.get(event.transactionId);
 if(!cell){if(event.kind!=='opened'&&event.kind!=='staged')return;cell={owner,id:event.transactionId,outcome:'pending',dependents:new Set()};source.cells.set(cell.id,cell);}
 if(event.kind==='opened'||event.kind==='staged'){if(cell.outcome==='pending')pending.add(cell);return;}
 if(!['confirmed','rolled-back','abandoned'].includes(event.kind))return;
 const outcome=event.kind as Exclude<Outcome,'pending'>;
 if(cell.outcome!=='pending'&&cell.outcome!==outcome)throw Error('Terminal publication dependency outcome reversed');
 cell.outcome=outcome;pending.delete(cell);
 // Synchronous normal/recovery handle enrollment can still obtain this cell.
 const retired=cell;queueMicrotask(()=>{if(source.cells.get(retired.id)===retired&&retired.outcome!=='pending')source.cells.delete(retired.id);});
 ownerWake(cell);
}
export function abandonOwnerSource(owner:number):void{
 const source=sources.get(owner);if(!source)return;
 // Unregister storage only. Native lifecycle alone determines terminal outcome.
 for(const cell of source.cells.values()){pending.delete(cell);ownerWake(cell);}
 source.cells.clear();sources.delete(owner);
}
export function enroll<T extends object>(handle:T,owner:number|undefined,id:number):T{
 if(owner!==undefined){const cell=ownerCell(owner,id);if(cell)authentic.set(handle,cell);}
 return handle;
}
type State = Readonly<{state:string;reason?:string;basis?:string}>;
type View = {value:State};
type Connection={report:(error:unknown)=>void;wake:()=>void;supported:boolean;ops:Map<object,Operation>;disposed:boolean};
type Horizon={frames:Set<Frame>;requirements:Set<NativeRequirement>;open:number};
type Frame={channel:object;connection:Connection;parents:readonly Frame[];horizon:Horizon;declaredOwners?:readonly OwnerCell[];owners:OwnerCell[];unknown:boolean;invalid:boolean;view:View;last?:object;ops:Set<Operation>;installedOwners:Set<OwnerCell>};
export type Proof={owners:readonly OwnerCell[];possible?:readonly OwnerCell[];unknown:boolean;invalid:boolean};
/** Source-owned facts. Until horizon close only actual executing frames are held. */
export type NativeRequirement={proof?:Proof;inputs:readonly NativeRequirement[];frames:readonly Frame[];known:readonly OwnerCell[];unknown:boolean;possible:readonly OwnerCell[];captureWindow:boolean};
export function nativeProof(requirement: NativeRequirement): Proof {
 const p=requirement.proof;if(p)return p;
 const parts=[...requirement.inputs.map(nativeProof),...requirement.frames.map(effective)];
 return {owners:[...new Set([...requirement.known,...parts.flatMap(p=>p.owners)])],possible:[...new Set([...requirement.possible,...parts.flatMap(p=>p.possible??[])])],unknown:requirement.unknown||requirement.possible.length>0||parts.some(p=>p.unknown),invalid:parts.some(p=>p.invalid)};
}
export function initialRequirement():NativeRequirement{return {proof:{owners:[],unknown:false,invalid:false},inputs:[],frames:[],known:[],unknown:false,possible:[],captureWindow:false};}
export function prepareNativeRequirement(known:readonly OwnerCell[], unknown:boolean, inputs:readonly NativeRequirement[]):{requirement:NativeRequirement;record:TerminalRecordPlan}{
 const active=[...stack];
 // Authentic transaction authorship already has a known owner. Possible-origin
 // windows cover unscoped ordinary writes, not a duplicate of that owner proof.
 const captureWindow=known.length===0&&(active.length===0||active.some(f=>f.declaredOwners===undefined));
 const requirement:NativeRequirement={known:Object.freeze([...known]),unknown,inputs:Object.freeze([...inputs]),frames:active,possible:[],captureWindow};
 const evidence=nativeProof(requirement);
 const adds:TerminalRecordPlan['adds'][number][]=[];
 for(const frame of active){
  for(const owner of evidence.owners)adds.push({set:frame.installedOwners,value:owner});
  if(frame.declaredOwners!==undefined&&evidence.owners.some(owner=>!frame.declaredOwners!.includes(owner)))adds.push({set:invalidFrames,value:frame});
  if(evidence.unknown)adds.push({set:unknownFrames,value:frame});
 }
 const h=active.at(-1)?.horizon;
 if(h)adds.push({set:h.requirements,value:requirement});
 // Pure window finalization occurs after all callback-capable preparers, before installation.
 return {requirement,record:{writes:[],adds}};
}
export function finalizeNativeRequirement(requirement:NativeRequirement):void {
 if(requirement.captureWindow)requirement.possible=Object.freeze([...pending]);
 // Source inputs are immutable snapshots; only the not-yet-installed unit's own window is refreshed.
 if(requirement.frames.length===0){requirement.proof=nativeProof(requirement);requirement.inputs=[];requirement.known=[];}
}
type Operation={native?:NativeRequirement;coverageUnknown:boolean;channel:object;dependencies:Set<OwnerCell>;revision:object;frames:Set<Frame>;proof?:Proof;views:Set<View>;started:boolean;surviving:boolean;noopFallbacks:Map<View,Operation>};
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
 constructor(readonly stage:'before-callback'|'after-callback',readonly reason:string,options?:{cause?:unknown}){super(`Declaration invalid: ${reason}; writes may remain`);if(options && 'cause' in options)Object.defineProperty(this,'cause',{value:options.cause,writable:true,configurable:true});}
}
export function registerConnection(channel:object,options:{report:(error:unknown)=>void;wake:()=>void;supported:boolean}):void{
 if(connections.has(channel))throw Error('Publication connection already registered');
 connections.set(channel,{...options,ops:new Map(),disposed:false});
}
function state(view:View,value:State):void {if(['started','superseded','disposed','no-write'].includes(view.value.state))return;view.value=Object.freeze(value);}
function effective(frame:Frame):Proof{const all=[...frame.parents,frame];return {owners:[...new Set(all.flatMap(frameOwners))],unknown:all.some(frameUnknown),invalid:all.some(frameInvalid)};}
function setOperationState(op:Operation,value:State):void{for(const view of op.views)state(view,value);}
function refresh(op:Operation):void{
 if(op.started)return;
 if(op.frames.size){for(const view of op.views)state(view,{state:'validating'});return;}
 const p=op.proof;if(!p)return;
 if(p.invalid||p.unknown){setOperationState(op,{state:'conservative',reason:p.invalid?'invalid-declaration':'unknown'});return;}
 if(p.owners.some(x=>x.outcome==='rolled-back'||x.outcome==='abandoned')){setOperationState(op,{state:'conservative',reason:'rejected-dependency'});return;}
 setOperationState(op,p.owners.some(x=>x.outcome==='pending')?{state:'held',reason:'pending-dependency'}:{state:'eligible',basis:'declared'});
}
/** Snapshot declaration responsibility before native installation, never at delivery. */
export function prepareRevision(channel:object,revision:object,known:readonly OwnerCell[],unknown=false,blockers:readonly OwnerCell[]=[],native?:NativeRequirement):TerminalRecordPlan {
 const c=connections.get(channel);
 const writes:TerminalRecordPlan['writes'][number][]=[];
 const adds:TerminalRecordPlan['adds'][number][]=[];
 const deletes:NonNullable<TerminalRecordPlan['deletes']>[number][]=[];
 if(!c||c.disposed)return {writes,adds};
 const active=[...stack];
 const matches=active.filter(f=>f.channel===channel);
 const required=[...new Set([...active.flatMap(frameOwners),...known])];
 const op:Operation={native,coverageUnknown:unknown,channel,dependencies:new Set([...required,...blockers]),revision,frames:new Set(),views:new Set(),started:false,surviving:false,noopFallbacks:new Map()};
 if(matches.length===0)op.proof={owners:Object.freeze([...known]),unknown:true,invalid:false};
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
 return {writes,adds,deletes};
}
/** Old notification admission is deliberately not a declaration authority. */
export function attachRevision(_channel:object,_revision:object,_known:readonly OwnerCell[],_unknown=false):void {}
export function proof(channel:object,revision:object):Readonly<Proof>|undefined {
 const op=connections.get(channel)?.ops.get(revision);
 if(!op||op.frames.size)return undefined;
 return op.proof;
}
export function noWrite(channel:object,revision:object):void {
 const c=connections.get(channel),op=c?.ops.get(revision);if(!op)return;
 for(const view of op.views){
  let fallback=op.noopFallbacks.get(view);
  while(fallback&&!c!.ops.has(fallback.revision))fallback=fallback.noopFallbacks.get(view);
  if(fallback){fallback.views.add(view);refresh(fallback);}else state(view,{state:'no-write'});
 }
 op.views.clear();retire(op);c!.ops.delete(revision);
}
/** A meaningful revision no longer needs tentative receipt predecessors. */
export function keepRevision(channel:object,revision:object):void{connections.get(channel)?.ops.get(revision)?.noopFallbacks.clear();}
export function decision(channel:object,revision:object):{early:boolean;pending:boolean}{
 const op=connections.get(channel)?.ops.get(revision);if(!op)return {early:false,pending:false};
 if(op.frames.size)return {early:false,pending:true};
 const p=op.proof!;return {early:!p.invalid&&!p.unknown&&p.owners.every(x=>x.outcome==='confirmed'),pending:[...p.owners,...(p.possible??[])].some(x=>x.outcome==='pending'||x.outcome==='abandoned')};
}
function retire(op:Operation):void{for(const cell of op.dependencies)cell.dependents.delete(op);}
export function started(channel:object,revision:object,basis:'declared'|'surviving'='declared'):void{
 const op=connections.get(channel)?.ops.get(revision);if(!op)return;
 op.started=true;op.surviving=basis==='surviving';setOperationState(op,{state:'started',basis});
 retire(op);op.noopFallbacks.clear();op.proof=undefined;op.frames.clear();op.views.clear();connections.get(channel)?.ops.delete(revision);
}
export function supersede(channel:object,revision:object):void{
 const c=connections.get(channel),op=c?.ops.get(revision);if(!op)return;
 if(!op.started)setOperationState(op,{state:'superseded'});
 retire(op);c!.ops.delete(revision);
}
export function disposeConnection(channel:object):void{
 const c=connections.get(channel);if(!c)return;c.disposed=true;
 for(const op of c.ops.values()){if(!op.started)setOperationState(op,{state:'disposed'});retire(op);}
 c.ops.clear();connections.delete(channel);
}
function finish(h:Horizon):void{
 for(const requirement of h.requirements){requirement.proof=nativeProof(requirement);}
 for(const requirement of h.requirements){requirement.inputs=[];requirement.frames=[];requirement.known=[];}
 h.requirements.clear();
 const operations=new Set<Operation>();
 for(const f of h.frames){
  if(!frameLast(f))state(f.view,{state:f.connection.disposed?'disposed':'no-write'});
  for(const op of f.ops)operations.add(op);
 }
 for(const op of operations){
  const proofs=[...op.frames].map(effective);if(op.native)proofs.push(nativeProof(op.native));
  op.proof={owners:[...new Set(proofs.flatMap(p=>p.owners))],possible:[...new Set(proofs.flatMap(p=>p.possible??[]))],unknown:op.coverageUnknown||proofs.some(p=>p.unknown),invalid:proofs.some(p=>p.invalid)};
  for(const cell of [...op.proof.owners,...(op.proof.possible??[])]){op.dependencies.add(cell);cell.dependents.add(op);}
  op.frames.clear();refresh(op);wake(op.channel);
 }
 for(const f of h.frames){f.ops.clear();f.installedOwners.clear();installedLast.delete(f);unknownFrames.delete(f);invalidFrames.delete(f);}
 h.frames.clear();
}
export function runDeclaration(channel:object,input:unknown,work:()=>unknown):{read():State}{
 const c=connections.get(channel);if(!c||c.disposed)throw new SignalTreePublicationError('before-callback','disposed');
 if(!c.supported)throw new SignalTreePublicationError('before-callback','unsupported-source');
 const view:View={value:Object.freeze({state:'validating'})};
 // This closure captures only a detached status cell, never connection/frame.
 const receipt=makeReceipt(view);
 const h=stack.at(-1)?.horizon??{frames:new Set<Frame>(),requirements:new Set<NativeRequirement>(),open:0};
 const frame:Frame={channel,connection:c,parents:[...stack],horizon:h,owners:[],unknown:true,invalid:false,view,ops:new Set(),installedOwners:new Set()};
 h.frames.add(frame);h.open++;stack.push(frame);
 let stage:'before-callback'|'after-callback'='before-callback';let thrown=false;let primary:unknown;
 try{
  if(!input||typeof input!=='object'||typeof work!=='function')throw new SignalTreePublicationError(stage,'malformed');
  const d=input as {kind?:unknown;owners?:unknown};const kind=d.kind;
  if(kind!=='independent'&&kind!=='dependent'&&kind!=='unknown')throw new SignalTreePublicationError(stage,'malformed');
  const owners:OwnerCell[]=[];
  if(kind==='dependent'){
   const list=d.owners;if(!Array.isArray(list))throw new SignalTreePublicationError(stage,'malformed');
   for(const handle of list){const cell=handle&&typeof handle==='object'?authentic.get(handle):undefined;if(!cell||cell.outcome==='rolled-back'||cell.outcome==='abandoned')throw new SignalTreePublicationError(stage,'unavailable-owner');owners.push(cell);}
  }
  frame.declaredOwners=kind==='unknown'?undefined:Object.freeze([...new Set(owners)]);
  frame.owners=[...new Set([...frame.owners,...owners])];// Input-validation writes cannot become independent retroactively.
  frame.unknown=kind==='unknown'||frame.ops.size>0;
  stage='after-callback';let result:unknown;
  try{result=work();}catch(error){thrown=true;primary=error;}
  if(result!==null&&(typeof result==='object'||typeof result==='function'))if(typeof(result as {then?:unknown}).then==='function')throw new SignalTreePublicationError(stage,'async-callback');
  if(frameInvalid(frame))throw new SignalTreePublicationError(stage,'contradiction');
  if(thrown)throw primary;
  return receipt;
 }catch(error){
  for(const f of stack)f.invalid=true;
  if(thrown){
   if(error!==primary&&!reporting){reporting=true;try{c.report(error);}catch{/* reporting cannot replace primary */}finally{reporting=false;}}
   throw primary;
  }
  if(error instanceof SignalTreePublicationError)throw error;
  throw new SignalTreePublicationError(stage,'validation-threw',{cause:error});
 }finally{stack.pop();h.open--;if(h.open===0)finish(h);wake(channel);}
}
function makeReceipt(view:View):{read():State}{return Object.freeze({read:()=>view.value});}
export function diagnostics(){let cells=0,operations=0;for(const s of sources.values())cells+=s.cells.size;for(const c of connections.values())operations+=c.ops.size;return {sources:sources.size,pendingOwners:pending.size,ownerCells:cells,connections:connections.size,operations,activeFrames:stack.length};}
// Destruction releases registry ownership without inventing a settlement result.
export const unregisterOwnerSource=abandonOwnerSource;
export function isValidating():boolean{return stack.length!==0;}

export function completeDeclarationContext(channel:object):boolean{return stack.some(f=>f.channel===channel)&&stack.every(f=>f.declaredOwners!==undefined&&!frameUnknown(f));}

export function projectRevision(channel:object,revision:object,proof:Readonly<Proof>):void{const op=connections.get(channel)?.ops.get(revision);if(op){op.proof=proof;for(const cell of [...proof.owners,...(proof.possible??[])]){op.dependencies.add(cell);cell.dependents.add(op);}refresh(op);}}
