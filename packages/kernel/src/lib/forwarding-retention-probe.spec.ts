import {it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {entityMap,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {interceptLocationWrites,type LocationWriteOperation} from './internals/location-runtime';
import {getPathNotifier} from './path-notifier';
// eslint-disable-next-line @nx/enforce-module-boundaries -- White-box regression exercises private kernel/realization coordination.
import {collect} from '../../../../tools/lib/heap-quiescence.mjs';
type Holder={outer?:()=>void;inner?:()=>void;value?:object;valueRef?:WeakRef<object>;positive?:object};
const innerCapture=(box:Holder,scenario:string,error:Error,holdValue:boolean)=>(operation:LocationWriteOperation<{n:number}[]>,proceed:()=>void)=>{
 box.inner=proceed;
 if(operation.intent!=='replace')throw new Error('not replacement');
 box.valueRef=new WeakRef(operation.value);
 if(holdValue)box.value=operation.value;
 if(scenario==='skip')return;
 if(scenario==='caught')throw error;
 proceed();
};
const outerCapture=(box:Holder,scenario:string)=>(_operation:unknown,proceed:()=>void)=>{
 box.outer=proceed;
 if(scenario==='caught'){try{proceed();}catch{/* Dispatch still must report the inner failure. */}}
 else proceed();
};
const turn=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
async function setup(scenario:string,arm:string){
 const box:Holder={positive:{positive:true}};
 const tree=signalTree({rows:entityMap<{id:string;x:{n:number}[]},string>()},{enhancers:[transactions()]});
 const rows=tree.$.rows;rows.addOne({id:'a',x:[{n:0}]});await flush();
 const row=rows.byIdOrFail('a'),leaf=row.x,binding=getEntityPublicationBinding(leaf)!;
 const requirement=binding.source.evidence()!.field(binding.subject!,'x','ordinary');
 const q=tree.transact(()=>rows.updateOne('a',{x:[{n:7}]}));await flush();
 const sentinel=Object.assign(new Error('receiver-bearing caught error'),{receiver:tree});
 const offInner=interceptLocationWrites(leaf,innerCapture(box,scenario,sentinel,arm==='hold-value'));
 const offOuter=interceptLocationWrites(leaf,outerCapture(box,scenario));
 let failed=false;
 try{q.rollback();}catch(error){
  failed=true;expect(error).toMatchObject({code:'SIGNALTREE_ROLLBACK_FAILED',cause:{kind:'effect-validation-failed'}});
  if(scenario==='caught')expect((error as {cause:{cause:unknown}}).cause.cause).toBe(sentinel);
 }
 expect(failed).toBe(scenario!=='success');expect(leaf()[0].n).toBe(scenario==='success'?0:7);
 expect(box.outer).toBeTypeOf('function');expect(box.inner).toBeTypeOf('function');
 offOuter();offInner();if(failed){q.rollback();expect(leaf()[0].n).toBe(0);}
 tree.destroy();await flush();
 const refs={tree:new WeakRef(tree),row:new WeakRef(row),leaf:new WeakRef(leaf),publicationBinding:new WeakRef(binding),nativePublicationSource:new WeakRef(binding.source),transaction:new WeakRef(q),baselineRequirement:new WeakRef(requirement),failure:new WeakRef(sentinel),operationValue:box.valueRef!,negative:new WeakRef({negative:true}),positive:new WeakRef(box.positive!)};
 box.valueRef=undefined;
 if(arm!=='hold-proceed'){box.outer=undefined;box.inner=undefined;}
 return {box,refs};
}
function snapshot(refs:Record<string,WeakRef<object>>){return Object.fromEntries(Object.entries(refs).map(([key,ref])=>[key,ref.deref()!==undefined]));}
async function sample(refs:Record<string,WeakRef<object>>){const rounds:Record<string,boolean>[]=[];for(let i=0;i<12;i++){await turn();collect();rounds.push(snapshot(refs));}return rounds;}
it('closed success skip and caught-failure callbacks release sampled receivers and errors',async()=>{
 expect(typeof globalThis.gc).toBe('function');
 const arm=process.env['ST_GC_ARM']!,scenario=process.env['ST_GC_SCENARIO']!;
 if(!['hold-proceed','drop-proceed','hold-value'].includes(arm)||!['success','skip','caught'].includes(scenario))throw new Error('invalid probe mode');
 const {box,refs}=await setup(scenario,arm);const held=await sample(refs);const errors:string[]=[];
 for(const proceed of [box.outer,box.inner])if(proceed){try{proceed();}catch(error){errors.push(String(error));}}
 box.outer=undefined;box.inner=undefined;box.value=undefined;box.positive=undefined;
 const released=await sample(refs);
 writeFileSync(process.env['ST_GC_OUTPUT']!,JSON.stringify({arm,scenario,node:process.version,held,released,errors},null,2));
 expect(held.every(row=>row.positive)).toBe(true);expect(held.at(-1)?.negative).toBe(false);
 if(arm==='hold-proceed'){expect(errors).toHaveLength(2);for(const error of errors)expect(error).toMatch(/cannot replay|closed|consumed/);}
 for(const key of Object.keys(refs)){
  if(key!=='positive'&&!(arm==='hold-value'&&key==='operationValue'))expect(held.at(-1)?.[key],key).toBe(false);
  expect(released.at(-1)?.[key],`${key} after release`).toBe(false);
 }
 if(arm==='hold-value')expect(held.every(row=>row.operationValue)).toBe(true);
});
