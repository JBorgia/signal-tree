import {expect,it} from 'vitest';
import {entityMap,link,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import * as life from './experimental-publication/lifecycle';
import {getPathNotifier} from './path-notifier';
type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):unknown};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
for(const mode of ['equal','inverse','netzero'] as const)it(`native handoff ${mode} preserves q destination until its actual rejection`,async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});const rows=tree.$.rows;rows.addOne({id:'a',x:0});await flush();
 const row=rows.byIdOrFail('a'),binding=getEntityPublicationBinding(row)!;const source=binding.source;
 const req=()=>source.evidence()!.field(binding.subject!,'x','ordinary') as life.NativeRequirement;
 const sent:unknown[]=[];const c=link(rows,{set:v=>{sent.push(v);}}) as Experimental;
 const q=tree.transact(()=>rows.updateOne('a',{x:7}));await flush();const qRequirement=req();const qDestination=life.nativeProof(qRequirement).destination;
 let r:typeof q|undefined;
 try{
  if(mode==='equal')c.declare({kind:'independent'},()=>rows.updateOne('a',{x:7}));
  else {r=tree.transact(()=>{rows.updateOne('a',{x:11});if(mode==='netzero')rows.updateOne('a',{x:7});});r.rollback();}
  await flush();expect(row.x()).toBe(7);expect(life.nativeProof(req()).destination).toEqual(qDestination);expect(sent).toEqual([]);
  q.rollback();await flush();expect(row.x()).toBe(0);expect(life.nativeProof(req()).destination??[]).toEqual([]);expect(sent.at(-1)).toEqual([{id:'a',x:0}]);
 }finally{c.dispose();tree.destroy();}
});
it('foreign possible-window equal declaration can replace support without creating a native owner',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});const foreign=signalTree({z:0},{enhancers:[transactions()]});const rows=tree.$.rows;rows.addOne({id:'a',x:0});await flush();
 const sent:unknown[]=[];const c=link(rows,{set:v=>{sent.push(v);}}) as Experimental;const q=foreign.transact(()=>foreign.$.z(7));
 try{rows.updateOne('a',{x:7});await flush();expect(sent).toEqual([]);c.declare({kind:'independent'},()=>rows.updateOne('a',{x:7}));await flush();expect(sent.at(-1)).toEqual([{id:'a',x:7}]);q.rollback();expect(rows.byIdOrFail('a').x()).toBe(7);}finally{c.dispose();tree.destroy();foreign.destroy();}
});
