import type { WriteMetadata } from '../mutation-types';
// Source identity only. Installed-unit admission lives at the native source;
// notification metadata and diagnostic paths never grant publication authority.
type Identity={supported:boolean;subject?:number;field?:string};
type Binding={owner:number;position:number;identity:Identity};
const bindings=new Map<object,Binding>();
export function bindSource(channel:object,owner:number,position:number,identity:Identity):void{bindings.set(channel,{owner,position,identity:Object.freeze({...identity})});}
export function supported(channel:object):boolean{return bindings.get(channel)?.identity.supported===true;}
export function stampSource(meta:WriteMetadata|undefined,_subjects:readonly number[]|undefined,_fields:readonly string[]|null|undefined,_value:unknown,_prev:unknown):WriteMetadata{return {...meta};}
export function subscribeProjection(notifier:{subscribe(pattern:string,handler:(...args:any[])=>void):()=>void;subscribeProjection?(handler:(...args:any[])=>void):()=>void},_channel:object,handler:(...args:any[])=>void):()=>void{return notifier.subscribeProjection?notifier.subscribeProjection(handler):notifier.subscribe('**',handler);}
// Equal setters complete their private installed work without a synthetic event.
export function deliverEqual(_entry:unknown):void{}
export function releaseSource(channel:object):void{bindings.delete(channel);}
export function projectionCounts(){return {bindings:bindings.size,equalListeners:0,projectionLatest:0,projectionCompleted:0,projectionPayloads:0,projectionQueued:0};}
