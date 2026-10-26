import type { WriteMetadata } from '../mutation-types';
// Private identity layer. Payload is supplied ONLY after native Link projection.
export const envelope=Symbol('native source identity');
type Meta=WriteMetadata & { readonly [envelope]?:unknown };
type Identity={supported:boolean;subject?:number;field?:string};
type Binding={owner:number;position:number;identity:Identity;latest?:object;queue:object[];completions:WeakMap<object,object>;completed?:object;projected?:Readonly<{fact:object;payload:unknown}>};
const bindings=new Map<object,Binding>();
const equals=new Map<object,(...args:any[])=>void>();
export function bindSource(channel:object,owner:number,position:number,identity:Identity):void{bindings.set(channel,{owner,position,queue:[],completions:new WeakMap(),identity:Object.freeze({...identity})});}
export function supported(channel:object):boolean{return bindings.get(channel)?.identity.supported===true;}
export function stampSource(meta:Meta|undefined,subjects:readonly number[]|undefined,fields:readonly string[]|null|undefined,value:unknown,prev:unknown):Meta{
 return {...meta,[envelope]:Object.freeze({subject:subjects?.[0],fields:fields===null?null:fields&&Object.freeze([...fields]),ping:value===undefined&&prev===undefined})};
}
export function matchingChannels(owner:number|undefined,positions:number[]|undefined,meta:Meta|undefined):object[]{
 const e=meta?.[envelope] as {subject?:number;fields?:readonly string[]|null;ping:boolean}|undefined;
 if(meta?.participation==='inspection'||!e||e.ping)return [];
 const effect=meta?.structuralEffect as {kind?:string}|undefined;
 return [...bindings].filter(([,b])=>{
  if(!b.identity.supported||b.owner!==owner||b.position!==positions?.[0])return false;
  if(b.identity.subject===undefined)return e.subject===undefined;
  if(e.subject!==b.identity.subject||effect?.kind==='rekey')return false;
  return effect?.kind==='remove'||effect?.kind==='add'||e.fields===null||!!e.fields?.includes(b.identity.field!);
 }).map(([channel])=>channel);
}
export function admitted(channel:object,fact:object):void{const b=bindings.get(channel);if(b){b.latest=fact;b.queue.push(fact);}}
export function isLatest(channel:object,fact:object|undefined):boolean{return fact!==undefined&&bindings.get(channel)?.latest===fact;}
export function completeSource(event:object|undefined):void{
 if(!event)return;const revision=(event as {revision:number}).revision;
 for(const [channel,b]of bindings){let consumed=0;for(const f of b.queue){if((f as {revision:number}).revision>revision)break;b.completed=f;consumed++;}if(consumed)b.queue.splice(0,consumed);if(b.completed)b.completions.set(event,b.completed);}
}
export function project(channel:object,event:object|undefined,payload:unknown):object|undefined{const b=bindings.get(channel);const fact=event&&b?.completions.get(event);if(b?.identity.supported&&fact){b.projected=Object.freeze({fact,payload});return fact;}return undefined;}
export function refreshSource(channel:object):Readonly<{fact:object;payload:unknown}>|undefined{const b=bindings.get(channel);return b?.projected&&b.projected.fact===b.latest?b.projected:undefined;}
export function subscribeProjection(notifier:{subscribe(pattern:string,handler:(...args:any[])=>void):()=>void},channel:object,handler:(...args:any[])=>void):()=>void{
 const off=notifier.subscribe('**',handler);if(supported(channel))equals.set(channel,handler);return()=>{off();equals.delete(channel);};
}
export function deliverEqual(entry:any):void{for(const [channel,handler]of [...equals]){const b=bindings.get(channel);if(b?.owner===(entry.ownerId??entry.meta?.ownerId))handler(entry.newValue,entry.oldValue,entry.path,entry.ownerPath,entry.origin,entry.subjectIds,entry.positionIds,entry.meta,entry.declaredScopes,entry.ownerId,entry.subjectFieldFootprint);}}
export function releaseSource(channel:object):void{bindings.delete(channel);equals.delete(channel);}
export function projectionCounts(){let projectionLatest=0,projectionCompleted=0,projectionPayloads=0,projectionQueued=0;for(const b of bindings.values()){projectionLatest+=Number(b.latest!==undefined);projectionCompleted+=Number(b.completed!==undefined);projectionPayloads+=Number(b.projected!==undefined);projectionQueued+=b.queue.length;}return {bindings:bindings.size,equalListeners:equals.size,projectionLatest,projectionCompleted,projectionPayloads,projectionQueued};}
