// Native supplied entity input through the application facade; no arbitrary getter tracking.
import {expect,it} from 'vitest';
import {entityMap,link,signalTree,transactions} from '../index';
type Receipt={read():Readonly<{state:string;basis?:string}>};
type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'}|{kind:'dependent';owners:readonly object[]},work:()=>unknown):Receipt};
const flush=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
for(const mode of ['pending-independent','pending-dependent','confirmed'] as const)
it(`entity input ownership through facade, mode=${mode}`,async()=>{
 const confirmed=mode==='confirmed';
 const source=signalTree({rows:entityMap<{id:string;n:number},string>()},{enhancers:[transactions()]});
 const target=signalTree({value:0});const late=signalTree({x:0},{enhancers:[transactions()]});
 source.$.rows.addOne({id:'a',n:1});await flush();
 const sent:unknown[]=[];const c=link(target.$.value,{set:value=>{sent.push(value);}}) as Experimental;
 try{
  const p=source.transact(()=>source.$.rows.updateOne('a',{n:7}));
  if(confirmed){p.confirm();await flush();}
  const startLate=()=>late.transact(()=>{late.$.x.value=9;});
  let q=mode==='pending-independent'?undefined:startLate();
  let receipt:Receipt|undefined;let caught:unknown;let calls=0;
  try{receipt=c.declare(mode==='pending-dependent'?{kind:'dependent',owners:[p]}:{kind:'independent'},()=>{
   source.updateAndReport(input=>{
    calls++;const snapshot=input as unknown as {rows:{all:{id:string;n:number}[]}};
    expect(snapshot.rows.all).toEqual([{id:'a',n:7}]);
    const next=snapshot.rows.all[0].n+1;target.$.value.value=next;
    return {};
   });
  });}catch(error){caught=error;}
  if(mode==='pending-independent')expect(caught).toMatchObject({reason:'contradiction',stage:'after-callback'});else expect(caught).toBeUndefined();
  q??=startLate();const pendingQ=q.inspect();expect(calls).toBe(1);await flush();
  if(!confirmed){expect(sent).toEqual([]);if(mode==='pending-dependent')expect(receipt?.read().state).toBe('held');p.confirm();await flush();}
  expect(sent).toEqual([8]);if(mode!=='pending-independent')expect(receipt?.read()).toMatchObject({state:'started',basis:'declared'});
  expect(q.inspect()).toEqual(pendingQ);await c.settled();
 }finally{c.dispose();target.destroy();source.destroy();late.destroy();}
});
