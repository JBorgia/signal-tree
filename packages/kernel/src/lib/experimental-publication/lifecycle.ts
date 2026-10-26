// Private native experiment; no package export. Publication authority only.
export type Outcome = 'pending' | 'confirmed' | 'rolled-back' | 'abandoned';
export interface OwnerCell { readonly owner:number; readonly id:number; outcome:Outcome }
type Source = {token:object; cells:Map<number,OwnerCell>};
const sources=new Map<number,Source>();
const authentic=new WeakMap<object,OwnerCell>();
const pending=new Set<OwnerCell>();
let wakeQueued=false;
export function registerOwnerSource(owner:number,token:object):void {if(!sources.has(owner))sources.set(owner,{token,cells:new Map()});}
export function ownerToken(owner:number):object|undefined{return sources.get(owner)?.token;}
export function ownerCell(owner:number,id:number):OwnerCell|undefined{return sources.get(owner)?.cells.get(id);}
export function pendingOwners():readonly OwnerCell[]{return [...pending];}
function wake():void{if(wakeQueued)return;wakeQueued=true;queueMicrotask(()=>{wakeQueued=false;refreshAll();for(const c of [...connections.values()])c.wake();});}
export function ownerTransition(owner:number,event:{kind:string;transactionId:number}):void{
 const source=sources.get(owner);if(!source)return;
 let cell=source.cells.get(event.transactionId);
 if(!cell){if(event.kind!=='opened'&&event.kind!=='staged')return;cell={owner,id:event.transactionId,outcome:'pending'};source.cells.set(cell.id,cell);}
 if(event.kind==='opened'||event.kind==='staged'){if(cell.outcome==='pending')pending.add(cell);return;}
 if(!['confirmed','rolled-back','abandoned'].includes(event.kind))return;
 const outcome=event.kind as Exclude<Outcome,'pending'>;
 if(cell.outcome!=='pending'&&cell.outcome!==outcome)throw Error('Terminal publication dependency outcome reversed');
 cell.outcome=outcome;pending.delete(cell);
 // Synchronous normal/recovery handle enrollment can still obtain this cell.
 const retired=cell;queueMicrotask(()=>{if(source.cells.get(retired.id)===retired&&retired.outcome!=='pending')source.cells.delete(retired.id);});
 wake();
}
export function abandonOwnerSource(owner:number):void{
 const source=sources.get(owner);if(!source)return;
 // Unregister storage only. Native lifecycle alone determines terminal outcome.
 for(const cell of source.cells.values())pending.delete(cell);
 source.cells.clear();sources.delete(owner);wake();
}
export function enroll<T extends object>(handle:T,owner:number|undefined,id:number):T{
 if(owner!==undefined){const cell=ownerCell(owner,id);if(cell)authentic.set(handle,cell);}
 return handle;
}
type State = Readonly<{state:string;reason?:string;basis?:string}>;
type View = {value:State};
type Connection={report:(error:unknown)=>void;wake:()=>void;supported:boolean;ops:Map<object,Operation>;disposed:boolean};
type Horizon={frames:Set<Frame>;open:number};
type Frame={channel:object;connection:Connection;parents:readonly Frame[];horizon:Horizon;owners:OwnerCell[];unknown:boolean;invalid:boolean;view:View;last?:object;ops:Set<Operation>};
type Proof={owners:readonly OwnerCell[];unknown:boolean;invalid:boolean};
type Operation={revision:object;frames:Set<Frame>;proof?:Proof;views:Set<View>;started:boolean;surviving:boolean};
const connections=new Map<object,Connection>();
const stack:Frame[]=[];
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
function effective(frame:Frame):Proof{const all=[...frame.parents,frame];return {owners:[...new Set(all.flatMap(f=>f.owners))],unknown:all.some(f=>f.unknown),invalid:all.some(f=>f.invalid)};}
function setOperationState(op:Operation,value:State):void{for(const view of op.views)state(view,value);}
function refresh(op:Operation):void{
 if(op.started)return;
 if(op.frames.size){for(const view of op.views)state(view,{state:'validating'});return;}
 const p=op.proof;if(!p)return;
 if(p.invalid||p.unknown){setOperationState(op,{state:'conservative',reason:p.invalid?'invalid-declaration':'unknown'});return;}
 if(p.owners.some(x=>x.outcome==='rolled-back'||x.outcome==='abandoned')){setOperationState(op,{state:'conservative',reason:'rejected-dependency'});return;}
 setOperationState(op,p.owners.some(x=>x.outcome==='pending')?{state:'held',reason:'pending-dependency'}:{state:'eligible',basis:'declared'});
}
function refreshAll():void {for(const c of connections.values())for(const op of c.ops.values())refresh(op);}
export function attachRevision(channel:object,revision:object,known:readonly OwnerCell[],unknown=false):void{
 const c=connections.get(channel);if(!c||c.disposed)return;
 const matches=stack.filter(f=>f.channel===channel);if(matches.length===0)return;
 const inherited=stack.flatMap(f=>f.owners);
 if(known.some(owner=>!inherited.includes(owner)))for(const f of stack)f.invalid=true;
 let op=c.ops.get(revision);
 if(!op){op={revision,frames:new Set(),views:new Set(),started:false,surviving:false};c.ops.set(revision,op);}
 for(const f of matches){
  if(f.last&&f.last!==revision){const old=c.ops.get(f.last);if(old){old.views.delete(f.view);if(!old.views.size)c.ops.delete(f.last);}}
  f.last=revision;f.unknown ||= unknown||stack.some(x=>x.unknown);
  for(const owner of [...inherited,...known])if(!f.owners.includes(owner))f.owners.push(owner);
  op.frames.add(f);op.views.add(f.view);f.ops.add(op);
 }
}
export function decision(channel:object,revision:object):{early:boolean;pending:boolean}{
 const op=connections.get(channel)?.ops.get(revision);if(!op)return {early:false,pending:false};
 if(op.frames.size)return {early:false,pending:true};
 const p=op.proof!;return {early:!p.invalid&&!p.unknown&&p.owners.every(x=>x.outcome==='confirmed'),pending:p.owners.some(x=>x.outcome==='pending')};
}
export function started(channel:object,revision:object,basis:'declared'|'surviving'='declared'):void{
 const op=connections.get(channel)?.ops.get(revision);if(!op)return;
 op.started=true;op.surviving=basis==='surviving';setOperationState(op,{state:'started',basis});
 op.proof=undefined;op.frames.clear();op.views.clear();connections.get(channel)?.ops.delete(revision);
}
export function supersede(channel:object,revision:object):void{
 const c=connections.get(channel),op=c?.ops.get(revision);if(!op)return;
 if(!op.started)setOperationState(op,{state:'superseded'});
 c!.ops.delete(revision);
}
export function disposeConnection(channel:object):void{
 const c=connections.get(channel);if(!c)return;c.disposed=true;
 for(const op of c.ops.values())if(!op.started)setOperationState(op,{state:'disposed'});
 c.ops.clear();connections.delete(channel);
}
function finish(h:Horizon):void{
 const operations=new Set<Operation>();
 for(const f of h.frames){
  if(!f.last)state(f.view,{state:f.connection.disposed?'disposed':'no-write'});
  for(const op of f.ops)operations.add(op);
 }
 for(const op of operations){
  const proofs=[...op.frames].map(effective);
  op.proof={owners:[...new Set(proofs.flatMap(p=>p.owners))],unknown:proofs.some(p=>p.unknown),invalid:proofs.some(p=>p.invalid)};
  op.frames.clear();refresh(op);
 }
 for(const f of h.frames)f.ops.clear();
 h.frames.clear();
}
export function runDeclaration(channel:object,input:unknown,work:()=>unknown):{read():State}{
 const c=connections.get(channel);if(!c||c.disposed)throw new SignalTreePublicationError('before-callback','disposed');
 if(!c.supported)throw new SignalTreePublicationError('before-callback','unsupported-source');
 const view:View={value:Object.freeze({state:'validating'})};
 // This closure captures only a detached status cell, never connection/frame.
 const receipt=makeReceipt(view);
 const h=stack.at(-1)?.horizon??{frames:new Set<Frame>(),open:0};
 const frame:Frame={channel,connection:c,parents:[...stack],horizon:h,owners:[],unknown:true,invalid:false,view,ops:new Set()};
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
  frame.owners=[...new Set([...frame.owners,...owners])];// Input-validation writes cannot become independent retroactively.
  frame.unknown=kind==='unknown'||frame.ops.size>0;
  stage='after-callback';let result:unknown;
  try{result=work();}catch(error){thrown=true;primary=error;}
  if(result!==null&&(typeof result==='object'||typeof result==='function'))if(typeof(result as {then?:unknown}).then==='function')throw new SignalTreePublicationError(stage,'async-callback');
  if(frame.invalid)throw new SignalTreePublicationError(stage,'contradiction');
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
 }finally{stack.pop();h.open--;if(h.open===0)finish(h);wake();}
}
function makeReceipt(view:View):{read():State}{return Object.freeze({read:()=>view.value});}
export function diagnostics(){let cells=0,operations=0;for(const s of sources.values())cells+=s.cells.size;for(const c of connections.values())operations+=c.ops.size;return {sources:sources.size,pendingOwners:pending.size,ownerCells:cells,connections:connections.size,operations,activeFrames:stack.length};}
// Destruction releases registry ownership without inventing a settlement result.
export const unregisterOwnerSource=abandonOwnerSource;
export function isValidating():boolean{return stack.length!==0;}
