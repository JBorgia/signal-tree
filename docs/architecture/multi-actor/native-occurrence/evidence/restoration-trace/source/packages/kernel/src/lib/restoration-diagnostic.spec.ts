import {appendFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {entityMap,link,signalTree,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):{read():{state:string}}};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
for(const mode of ['root-equal','root-changed','explicit-equal-after-root','setAll-equal-visible','root-equal-visible'] as const)it(mode,async()=>{
 const tree=signalTree({branch:{rows:entityMap<{id:string;x:number},string>()},other:0},{enhancers:[transactions()]});
 const foreign=signalTree({z:0},{enhancers:[transactions()]});const rows=tree.$.branch.rows;
 rows.addOne({id:'a',x:0});await flush();const sent:unknown[]=[];
 const c=link(tree.$,{set:v=>{sent.push(v);}}) as Experimental;
 const q=foreign.transact(()=>foreign.$.z(7));
 try{
  rows.updateOne('a',{x:7});await flush();expect(sent).toEqual([]);
  const hidden=!mode.endsWith('visible');
  if(hidden){c.declare({kind:'independent'},()=>tree.$({other:1} as never));await flush();expect(sent).toEqual([{other:1}]);}
  const x=mode==='root-changed'?8:7;
  const receipt=c.declare({kind:'independent'},()=>{
   if(mode==='setAll-equal-visible')rows.setAll([{id:'a',x}]);
   else tree.$({branch:{rows:{all:[{id:'a',x}]}},other:2});
   if(mode==='explicit-equal-after-root')rows.updateOne('a',{x:7});
  });await flush();
  // Read source snapshots only after the delivery observation; these are fixture reads, not runtime repairs.
  const beforeConfirm=JSON.parse(JSON.stringify(sent));const physical=tree.$();const row=rows.byId('a')?.();
  appendFileSync('/private/tmp/st-occurrence-restoration-trace/candidate-observations.jsonl',JSON.stringify({mode,beforeConfirm,physical,row,receipt:receipt.read()})+'\n');
  q.confirm();await flush();appendFileSync('/private/tmp/st-occurrence-restoration-trace/candidate-observations.jsonl',JSON.stringify({mode,afterConfirm:sent})+'\n');
  expect(row?.x).toBe(x);
 }finally{q.confirm();c.dispose();tree.destroy();foreign.destroy();}
});
