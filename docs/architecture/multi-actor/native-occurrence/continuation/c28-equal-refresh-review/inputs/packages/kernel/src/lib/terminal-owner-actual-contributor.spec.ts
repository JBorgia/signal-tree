import {expect,it} from 'vitest';
import {link,signalTree,transactions,type PendingTransaction} from '../index';
type C=ReturnType<typeof link>&{declare(input:{kind:'independent'}|{kind:'dependent';owners:readonly PendingTransaction[]},work:()=>unknown):unknown};
const drain=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
for(const route of ['leaf','whole'] as const)for(const role of ['validation','consumed-input'] as const)it(`confirmed destination preserves actual q through NEW equal ${route}: ${role}`,async()=>{
 const t=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const other=signalTree({q:0},{enhancers:[transactions()]});const sent:unknown[]=[];
 const c=link(t.$.pair,{set:v=>{sent.push(v);}}) as C;let off=()=>{};
 try{
  const q=other.transact(()=>other.$.q(7));let p!:ReturnType<typeof t.transact>;
  c.declare({kind:'dependent',owners:[q]},()=>{p=t.transact(()=>{
   if(role==='validation')t.$.pair.x(7);
   else other.$(current=>{t.$.pair.x(current.q);return current;});
  });});
  await drain();expect(sent).toEqual([]);p.confirm();await drain();expect(sent).toEqual([]);
  const before=q.inspect();let calls=0,notices=0;off=t.$.pair.x.subscribe(()=>notices++);
  c.declare({kind:'independent'},()=>{calls++;if(route==='leaf')t.$.pair.x(7);else t.$.pair({x:7,y:0});});await drain();
  expect(calls).toBe(1);expect(notices).toBe(0);expect(q.inspect()).toEqual(before);expect(sent).toEqual([]);expect(t.$.pair()).toEqual({x:7,y:0});
  q.confirm();await drain();expect(sent).toEqual([{x:7,y:0}]);await c.settled();await drain();expect(sent).toEqual([{x:7,y:0}]);
 }finally{off();c.dispose();t.destroy();other.destroy();}
});
