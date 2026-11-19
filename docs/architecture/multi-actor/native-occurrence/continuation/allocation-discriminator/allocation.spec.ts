import {expect,it} from 'vitest';
import {appendFileSync} from 'node:fs';
import {entityMap,link,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getPathNotifier} from './path-notifier';
import * as lifecycle from './experimental-publication/lifecycle';
import {resetAllocation,allocationSnapshot,AllocationMap,countedArray} from './allocation-diagnostic';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
type Receipt={read():Readonly<{state:string;basis?:string;reason?:string}>};
type Declared=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):Receipt};
for(const n of [32,128,1024])for(const mode of ['bare','held','foreign'] as const)it(`allocation ${mode} ${n}`,async()=>{
 resetAllocation();
 const tree=signalTree({rows:entityMap<{id:string;n:number},string>()});const rows=tree.$.rows;
 const binding=getEntityPublicationBinding(rows);if(!binding)throw Error('missing source');const source=binding.source;
 const output=process.env['ST_ALLOCATION_OUTPUT'];if(!output)throw Error('missing output');
 const snapshots:unknown[]=[];
 const mark=(phase:string)=>{const allocation=allocationSnapshot();const retained=source.inspect();if(phase!=='created')for(const k of ['rows','presence','placements','viewRows','visible','placementViews','mappings','mappingViews'])expect(typeof retained[k]).toBe('number');snapshots.push({phase,allocation,retained});resetAllocation();};
 let c:Declared|undefined,receipt:Receipt|undefined,saved:unknown,owner:ReturnType<typeof signalTree<{n:number}>>|undefined;
 let settle:(()=>void)|undefined;
 let held:ReturnType<typeof rows.byIdOrFail>|undefined;
 try{
  mark('created');rows.setAll(Array.from({length:n},(_,i)=>({id:String(i),n:0})));mark('populate-return');await flush();mark('populate-complete');
  expect(rows.count()).toBe(n);expect(source.inspect().presence).toBe(n);
  if(mode==='held'){
   held=rows.byIdOrFail('0');const sent:unknown[]=[];c=link(held.n,{set:v=>{sent.push(v);}}) as Declared;
   receipt=c.declare({kind:'independent'},()=>held!.n(7));await flush();expect(sent).toEqual([7]);saved={...receipt.read()};expect(saved).toMatchObject({state:'started',basis:'declared'});mark('held-receipt');
  }
  if(mode==='foreign'){
   owner=signalTree({n:0},{enhancers:[transactions()]});held=rows.byIdOrFail('0');const b=getEntityPublicationBinding(held)!;
   const q=owner.transact(()=>rows.setAll([{id:String(n-1),n:0}]));settle=()=>q.confirm();
   const fact=source.evidence()!.member(b.subject!,'ordinary') as lifecycle.NativeRequirement;
   expect(lifecycle.nativeProof(fact).possible?.some(o=>o.outcome==='pending')).toBe(true);
  }else rows.setAll([]);
  mark('remove-return');await flush();mark('remove-complete');expect(rows.count()).toBe(mode==='foreign'?1:0);
  if(held)expect(held()).toBeUndefined();
  if(mode==='foreign'){
   const sent:unknown[]=[];c=link(rows,{set:v=>{sent.push(v);}}) as Declared;
   receipt=c.declare({kind:'independent'},()=>rows.updateOne(String(n-1),{n:2}));await flush();expect(rows.byIdOrFail(String(n-1)).n()).toBe(2);expect(sent).toEqual([]);expect(receipt.read()).toMatchObject({state:'conservative',reason:'unknown'});expect(source.inspect().negativePresence).toBe(n-1);mark('foreign-useful-declared-edit');
   settle!();settle=undefined;await flush();mark('foreign-confirmed');
  }
  if(mode==='held'){expect(receipt!.read()).toEqual(saved);expect(Reflect.set(receipt!.read(),'state','forged')).toBe(false);}
  c?.dispose();await flush();mark('recipient-disposed');tree.destroy();await flush();mark('destroy-complete');
  if(mode==='held')expect(receipt!.read()).toEqual(saved);
 }finally{
  appendFileSync(output,JSON.stringify({n,mode,snapshots})+'\n');c?.dispose();settle?.();tree.destroy();owner?.destroy();
 }
});

it('diagnostic counter calibration preserves map contents and distinguishes copies from updates',()=>{
 resetAllocation();const a=new AllocationMap<string,number>('calibration',[['x',1],['y',2]]);a.set('x',3);a.set('z',4);
 expect([...a]).toEqual([['x',3],['y',2],['z',4]]);expect(countedArray('calibration-array',[1,2,3])).toEqual([1,2,3]);
 expect(allocationSnapshot()['calibration']).toEqual({containers:1,copiedEntries:2,sets:2,newEntries:3,arrays:0,arrayEntries:0});
 expect(allocationSnapshot()['calibration-array']).toEqual({containers:0,copiedEntries:0,sets:0,newEntries:0,arrays:1,arrayEntries:3});resetAllocation();
});
