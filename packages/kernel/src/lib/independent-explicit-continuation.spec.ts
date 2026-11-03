import {expect,it} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {interceptLocationWrites} from './internals/location-runtime';
import {getPathNotifier} from './path-notifier';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};

for(const failFirst of [false,true])it(`selected continuation cannot replay after its invocation closes (first throws=${failFirst})`,async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});
 const rows=tree.$.rows;rows.addOne({id:'a',x:0});await flush();
 const leaf=rows.byIdOrFail('a').x,b=getEntityPublicationBinding(leaf)!;
 const evidence=()=>b.source.evidence()!.field(b.subject!,'x','ordinary');
 const baseline=evidence();const q=tree.transact(()=>rows.updateOne('a',{x:7}));await flush();
 let saved:(()=>void)|undefined;const sentinel=new Error('interceptor refuses first attempt');
 const off=interceptLocationWrites(leaf,(_operation,proceed)=>{saved=proceed;if(failFirst)throw sentinel;proceed();});
 try{
  if(failFirst){expect(()=>q.rollback()).toThrow(/interceptor refuses first attempt/);expect(leaf()).toBe(7);off();q.rollback();}
  else{q.rollback();off();}
  expect(saved).toBeTypeOf('function');expect(leaf()).toBe(0);expect(evidence()).toBe(baseline);
  rows.updateOne('a',{x:13});await flush();const later=evidence();expect(later).not.toBe(baseline);
  let lateError:unknown;try{saved!();}catch(e){lateError=e;}
  console.log('STALE-CONTINUATION',{failFirst,value:leaf(),baselineRestored:evidence()===baseline,error:lateError===undefined?undefined:String(lateError)});
  expect(leaf()).toBe(13);expect(evidence()).toBe(later);
 }finally{off();tree.destroy();}
});

it('double proceed cannot reuse the same selected endpoint within one interceptor invocation',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});
 const rows=tree.$.rows;rows.addOne({id:'a',x:0});await flush();const leaf=rows.byIdOrFail('a').x;
 const b=getEntityPublicationBinding(leaf)!,baseline=b.source.evidence()!.field(b.subject!,'x','ordinary');
 const q=tree.transact(()=>rows.updateOne('a',{x:7}));await flush();let secondValue:unknown,secondBaseline=false;
 const off=interceptLocationWrites(leaf,(_op,proceed)=>{proceed();rows.updateOne('a',{x:19});try{proceed();}catch{ /* Expected refusal is checked by the following state assertions. */ }secondValue=leaf();secondBaseline=b.source.evidence()!.field(b.subject!,'x','ordinary')===baseline;});
 try{try{q.rollback();}catch{ /* Expected refusal is checked by the following state assertions. */ }console.log('DOUBLE-PROCEED',{secondValue,secondBaseline});expect(secondValue).toBe(19);expect(secondBaseline).toBe(false);}
 finally{off();tree.destroy();}
});
