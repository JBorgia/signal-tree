import {expect,it} from 'vitest';
import {batching,entityMap,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {interceptLocationWrites} from './internals/location-runtime';
import {getPathNotifier} from './path-notifier';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
for(const coalesced of [false,true])it(`registered projection interceptor preserves particular inverse continuation (coalesce=${coalesced})`,async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions(),batching()]});const rows=tree.$.rows;
 rows.addOne({id:'a',x:0});await flush();const leaf=rows.byIdOrFail('a').x;
 const binding=getEntityPublicationBinding(leaf)!;const baseline=binding.source.evidence()!.field(binding.subject!,'x','ordinary');
 const q=tree.transact(()=>rows.updateOne('a',{x:7}));await flush();let entered=0,nested:object|undefined;
 const off=interceptLocationWrites(leaf,(operation,proceed)=>{if(entered++===0){expect(operation.intent).toBe('replace');rows.updateOne('a',{x:99});nested=binding.source.evidence()!.field(binding.subject!,'x','ordinary');}if(coalesced)tree.coalesce(proceed);else proceed();});
 try{let failure:unknown;try{q.rollback();}catch(error){failure=error;}expect(failure).toMatchObject({code:'SIGNALTREE_ROLLBACK_FAILED',cause:{kind:'effect-validation-failed',cause:expect.any(Error)}});await flush();expect(entered).toBe(1);expect(nested).not.toBe(baseline);expect(leaf()).toBe(99);expect(binding.source.evidence()!.field(binding.subject!,'x','ordinary')).toBe(nested);expect(()=>q.confirm()).not.toThrow();}
 finally{off();tree.destroy();}
});

import {createNativeLocationRuntime} from './internals/native-location-realization';
import {replaceSelectedLocation,replaceLocation} from './internals/location-runtime';
import {observeIntrinsicMutations} from './internals/intrinsic-mutation';
import type {ObservationAdapter} from './internals/observation-adapter';
import type {ClaimedFieldEndpoint} from './internals/native-field-selection';
it('native carrier preserves before/write/after/observer order with call-local selection across getter reentry',()=>{
 const events:string[]=[];let value=7,armed=false,entered=false;
 const adapter:ObservationAdapter={createToken:()=>({observe(){ /* This adapter fixture does not schedule reactive work. */ },invalidate(){ /* This adapter fixture does not schedule reactive work. */ }}),runInvalidationGroup:run=>run(),createWritableProjection:<T>(compute:()=>T)=>{
   const cell=Object.assign(()=>compute(),{set:(_value:T)=>{ /* Destination values are intentionally discarded in this protocol fixture. */ },update:(_update:(current:T)=>T)=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ },asReadonly:()=>cell});
   return {cell,peek:compute};
 }};
 const runtime=createNativeLocationRuntime(adapter);
 const selected:ClaimedFieldEndpoint={source:{},subject:1,field:'x',endpoint:{present:true,value:0,requirement:{}}};
 const received:Array<ClaimedFieldEndpoint|undefined>=[];
 const location=runtime.createWritableProjection!(()=>{events.push('read');if(armed&&!entered){entered=true;replaceLocation(location,99);}return value;},(next,_intent,selection)=>{events.push(`write:${next}`);received.push(selection);value=next;});
 const off=observeIntrinsicMutations(location,()=>events.push('observer'));
 try{armed=true;replaceSelectedLocation(location,0,selected);expect(entered).toBe(true);expect(received).toEqual([undefined,selected]);expect(events).toEqual(['read','read','write:99','read','observer','write:0','read','observer']);expect(value).toBe(0);}
 finally{off?.();}
});
