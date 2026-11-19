import {appendFileSync} from 'node:fs';
const ids=new WeakMap<object,number>();let serial=0,seq=0;
export function traceId(value:object|undefined):number|undefined {if(!value)return;let id=ids.get(value);if(!id)ids.set(value,id=++serial);return id;}
export function traceProof(p: {unknown?:boolean;invalid?:boolean;owners?:readonly object[];possible?:readonly object[];destination?:readonly object[];input?:readonly object[]}|undefined):unknown {if(!p)return;return {unknown:p.unknown,invalid:p.invalid,...Object.fromEntries((['owners','possible','destination','input'] as const).map(k=>[k,p[k]?.map(c=>({id:traceId(c),outcome:(c as {outcome?:unknown}).outcome}))]))};}
export function traceReq(r:object|undefined):unknown {return r?{id:traceId(r),proof:traceProof((r as {proof?:Parameters<typeof traceProof>[0]}).proof)}:undefined;}
export function trace(event:string,data:unknown):void {appendFileSync('/private/tmp/st-occurrence-restoration-trace/events.jsonl',JSON.stringify({seq:++seq,event,data})+'\n');}
