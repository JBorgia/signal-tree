import {expect,it} from 'vitest';
import {appendFileSync} from 'node:fs';
import {signalTree,transactions,link} from '../source/packages/kernel/src/index';
import {__reviewSelectedRequirement} from '../source/packages/kernel/src/lib/experimental-publication/private';
type Declared=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):{read():{state:string}}};
const drain=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
for(const route of ['leaf','whole'] as const)for(const count of [64,256])it(`${route} ${count} equal declarations retain fixed responsibilities`,async()=>{
 const t=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const sent:unknown[]=[];const c=link(t.$.pair,{set:v=>{sent.push(v);}}) as Declared;let off=()=>{};
 try{
  const p=t.transact(()=>t.$.pair.x(7));await drain();const before=p.inspect();expect(sent).toEqual([]);
  let notices=0;off=t.$.pair.x.subscribe(()=>notices++);const initial=__reviewSelectedRequirement(t.$.pair.x);
  for(let i=0;i<count;i++){c.declare({kind:'independent'},()=>route==='leaf'?t.$.pair.x(7):t.$.pair({x:7,y:0}));await drain();expect(sent).toEqual([]);}
  expect(t.$.pair()).toEqual({x:7,y:0});expect(p.inspect()).toEqual(before);expect(notices).toBe(0);
  const after=__reviewSelectedRequirement(t.$.pair.x);expect(after.ready).toBe(true);expect(after.destination).toBe(initial.destination);expect(after.owners).toBe(initial.owners);
  let settled=false;const wait=c.settled().then(()=>{settled=true;});await drain();expect(settled).toBe(false);
  if(route==='leaf')p.confirm();else p.rollback();await drain();await wait;
  const value=route==='leaf'?7:0;expect(t.$.pair()).toEqual({x:value,y:0});expect(sent).toEqual([{x:value,y:0}]);expect(settled).toBe(true);
  const terminal=__reviewSelectedRequirement(t.$.pair.x);await drain();expect(sent).toHaveLength(1);
  c.dispose();t.$.pair.x(99);await drain();expect(sent).toHaveLength(1);
  appendFileSync('/private/tmp/st-c24-equal-owner-retention-independent/COUNTS.jsonl',JSON.stringify({route,count,initial,after,terminal,publicAssertionsPassed:true})+'\n');
 }finally{off();c.dispose();t.destroy();}
},30000);
