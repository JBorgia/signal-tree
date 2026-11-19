import {appendFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {entityMap,link,signalTree,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
import {getMutationCaptureRuntime} from './internals/mutation-capture-runtime';
type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):{read():unknown}};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
const clone=(value:unknown):unknown=>JSON.parse(JSON.stringify(value));
for(const observe of [false,true])for(const ownership of ['same','foreign'] as const)for(const route of ['collection','root','restore'] as const)it(`${ownership}/${route}/observe=${observe}`,async()=>{
 const tree=signalTree({branch:{rows:entityMap<{id:string;x:number},string>()},other:0},{enhancers:[transactions()]});
 const foreign=signalTree({z:0},{enhancers:[transactions()]});const rows=tree.$.branch.rows;
 rows.addOne({id:'a',x:0});await flush();
 const sent:unknown[]=[];const c=link(tree.$,{set:v=>{sent.push(v);}}) as Experimental;
 const runtime=getMutationCaptureRuntime(tree)!;const original=runtime.prepareEntityResponsibility;
 const captures:unknown[]=[];let phase='q';
 if(observe)runtime.prepareEntityResponsibility=capture=>{const result=original?.(capture);captures.push({phase,changes:clone(capture.changes),participation:capture.meta?.participation,transactionId:capture.meta?.transactionId,record:result?{writes:result.writes.length,adds:result.adds.length}:null});return result;};
 const q=ownership==='same'?tree.transact(()=>rows.updateOne('a',{x:7})):foreign.transact(()=>foreign.$.z(7));
 try{
  if(ownership==='foreign')rows.updateOne('a',{x:7});await flush();expect(rows.byIdOrFail('a').x()).toBe(7);expect(sent).toEqual([]);
  const before=clone(q.inspect());phase='omit';
  if(route==='restore'){c.declare({kind:'independent'},()=>tree.$({other:1} as never));await flush();expect(sent).toEqual([{other:1}]);}
  phase='equal';const receipt=c.declare({kind:'independent'},()=>{if(route==='collection')rows.setAll([{id:'a',x:7}]);else tree.$({branch:{rows:{all:[{id:'a',x:7}]}},other:2});});
  await flush();expect(rows.byIdOrFail('a').x()).toBe(7);
  const afterEqual={q:clone(q.inspect()),receipt:clone(receipt.read()),sent:clone(sent),value:rows.byIdOrFail('a').x()};
  phase='reject';let rejectionError:unknown;
  try{q.rollback();}catch(error){rejectionError=error instanceof Error?{name:error.name,message:error.message}:String(error);}
  await flush();
  appendFileSync('/private/tmp/st-footprint-discriminator-a/observations.jsonl',JSON.stringify({ownership,route,observe,before,afterEqual,afterReject:{q:clone(q.inspect()),receipt:clone(receipt.read()),sent:clone(sent),value:rows.byIdOrFail('a').x(),foreign:foreign.$.z(),rejectionError},captures})+'\n');
 }finally{runtime.prepareEntityResponsibility=original;q.confirm();c.dispose();tree.destroy();foreign.destroy();}
});
