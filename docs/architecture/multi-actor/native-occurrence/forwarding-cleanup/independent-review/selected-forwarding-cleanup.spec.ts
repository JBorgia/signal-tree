import {expect,it} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';
import {interceptLocationWrites} from './internals/location-runtime';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getPathNotifier} from './path-notifier';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};

for(const mode of ['success','skip','before','after','caught','caught-undefined','replace-error','reenter'] as const)
it(`two saved forwarding edges preserve ${mode} dispatch semantics`,async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});
 const rows=tree.$.rows;rows.addOne({id:'a',x:0});await flush();const leaf=rows.byIdOrFail('a').x;
 const binding=getEntityPublicationBinding(leaf)!;const q=tree.transact(()=>rows.updateOne('a',{x:7}));await flush();
 const authored=binding.source.evidence()!.field(binding.subject!,'x','ordinary');
 const sentinel=mode==='caught-undefined'?undefined:new Error('inner sentinel'),replacement=new Error('outer replacement');
 let outer:(()=>void)|undefined,inner:(()=>void)|undefined,calls=0,duplicate:unknown;
 const offInner=interceptLocationWrites(leaf,(_op,proceed)=>{
  inner=proceed;calls++;
  if(mode==='skip')return;
  if(mode==='before'||mode==='caught'||mode==='caught-undefined'||mode==='replace-error')throw sentinel;
  if(mode==='reenter'){try{outer!();}catch(error){duplicate=error;}}
  proceed();if(mode==='after')throw sentinel;
 });
 const offOuter=interceptLocationWrites(leaf,(_op,proceed)=>{
  outer=proceed;
  if(mode==='caught'||mode==='caught-undefined'||mode==='replace-error'){
   try{proceed();}catch(error){expect(error).toBe(sentinel);}
   if(mode==='replace-error')throw replacement;
  }else proceed();
 });
 try{
  let failed=false,error:unknown;try{q.rollback();}catch(e){failed=true;error=e;}
  expect(calls).toBe(1);expect(inner).toBeTypeOf('function');expect(outer).toBeTypeOf('function');
  if(mode==='success'||mode==='reenter'){expect(failed).toBe(false);expect(leaf()).toBe(0);}
  else{
   expect(failed).toBe(true);expect(error).toMatchObject({code:'SIGNALTREE_ROLLBACK_FAILED',cause:{kind:'effect-validation-failed'}});
   if(mode!=='skip')expect((error as {cause:{cause:unknown}}).cause.cause).toBe(mode==='replace-error'?replacement:sentinel);
   expect(leaf()).toBe(7);expect(binding.source.evidence()!.field(binding.subject!,'x','ordinary')).toBe(authored);
  }
  if(mode==='reenter')expect(duplicate).toBeInstanceOf(Error);
  offOuter();offInner();
  for(const proceed of [outer!,inner!])expect(proceed).toThrow(/cannot replay|closed|consumed/);
  if(mode!=='success'&&mode!=='reenter'){q.rollback();expect(leaf()).toBe(0);}
  rows.updateOne('a',{x:13});expect(leaf()).toBe(13);
  for(const proceed of [outer!,inner!])expect(proceed).toThrow(/cannot replay|closed|consumed/);
  expect(leaf()).toBe(13);
 }finally{offOuter();offInner();tree.destroy();}
});

it('ordinary public saved proceed retains ordinary immediate write behavior',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()});tree.$.rows.addOne({id:'a',x:0});await flush();
 const leaf=tree.$.rows.byIdOrFail('a').x;let saved:(()=>void)|undefined;
 const off=interceptLocationWrites(leaf,(_operation,proceed)=>{saved=proceed;});
 try{leaf(7);expect(leaf()).toBe(0);expect(saved).toBeTypeOf('function');saved!();expect(leaf()).toBe(7);off();leaf(9);expect(leaf()).toBe(9);}
 finally{off();tree.destroy();}
});
