import {expect,it} from 'vitest';
import {entityMap,link,signalTree,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):{read():{state:string}}};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
for(const mode of ['root-equal','root-changed','explicit-equal-hidden','setAll-equal-visible','root-equal-visible'] as const)it(mode,async()=>{
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
   if(mode==='explicit-equal-hidden')rows.updateOne('a',{x:7});
   if(mode==='setAll-equal-visible')rows.setAll([{id:'a',x}]);
   else tree.$({branch:{rows:{all:[{id:'a',x}]}},other:2});
  });await flush();
  // Read source snapshots only after the delivery observation; these are fixture reads, not runtime repairs.
  const beforeConfirm=JSON.parse(JSON.stringify(sent));const physical=tree.$();const row=rows.byId('a')?.();
  console.log('DIAGNOSTIC '+JSON.stringify({mode,beforeConfirm,physical,row,receipt:receipt.read()}));
  q.confirm();await flush();console.log('DIAGNOSTIC '+JSON.stringify({mode,afterConfirm:sent}));
  expect(row?.x).toBe(x);
 }finally{q.confirm();c.dispose();tree.destroy();foreign.destroy();}
});
