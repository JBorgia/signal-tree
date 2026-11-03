import {expect,it} from 'vitest';
import {link,signalTree,transactions} from '../index';
type Receipt={read():Readonly<{state:string}>};
type Declared=ReturnType<typeof link>&{declare(input:{kind:'independent'}|{kind:'dependent';owners:readonly unknown[]},work:()=>unknown):Receipt};
const drain=async()=>{for(let n=0;n<120;n++)await Promise.resolve();};
for(const route of ['leaf','whole'] as const)for(const outcome of ['confirm','rollback'] as const){
 it(`preserves actual owner through equal ${route}, then ${outcome}`,async()=>{
  const t=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const sent:unknown[]=[];
  const c=link(t.$.pair,{set:v=>{sent.push(v);}}) as Declared;let off=()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ };
  try{
   const p=t.transact(()=>t.$.pair.x(7));await drain();expect(sent).toEqual([]);const before=p.inspect();let notices=0;off=t.$.pair.x.subscribe(()=>notices++);
   c.declare({kind:'independent'},()=>route==='leaf'?t.$.pair.x(7):t.$.pair({x:7,y:0}));await drain();
   expect(sent).toEqual([]);expect(p.inspect()).toEqual(before);expect(notices).toBe(0);expect(t.$.pair.x()).toBe(7);
   p[outcome]();await drain();const value=outcome==='confirm'?7:0;
   expect(t.$.pair()).toEqual({x:value,y:0});expect(sent).toEqual([{x:value,y:0}]);await c.settled();
  }finally{off();c.dispose();t.destroy();}
 });
 it(`refreshes unowned possible support through equal ${route}, foreign ${outcome}`,async()=>{
  const t=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const other=signalTree({z:0},{enhancers:[transactions()]});const sent:unknown[]=[];
  const c=link(t.$.pair,{set:v=>{sent.push(v);}}) as Declared;
  try{
   const p=other.transact(()=>other.$.z(7));t.$.pair.x(7);await drain();expect(sent).toEqual([]);const before=p.inspect();
   c.declare({kind:'independent'},()=>route==='leaf'?t.$.pair.x(7):t.$.pair({x:7,y:0}));await drain();
   expect(sent).toEqual([{x:7,y:0}]);expect(p.inspect()).toEqual(before);await c.settled();
   p[outcome]();await drain();expect(sent).toEqual([{x:7,y:0}]);expect(t.$.pair.x()).toBe(7);
  }finally{c.dispose();t.destroy();other.destroy();}
 });
}
for(const route of ['leaf','whole'] as const)it(`preserves inherited input obligation on equal owned ${route}`,async()=>{
 const t=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const other=signalTree({z:0},{enhancers:[transactions()]});const sent:unknown[]=[];
 const c=link(t.$.pair,{set:v=>{sent.push(v);}}) as Declared;
 try{
  const q=other.transact(()=>other.$.z(7));let p!:ReturnType<typeof t.transact>;
  c.declare({kind:'dependent',owners:[q]},()=>{p=t.transact(()=>t.$.pair.x(other.$.z()));});await drain();expect(sent).toEqual([]);
  c.declare({kind:'independent'},()=>route==='leaf'?t.$.pair.x(7):t.$.pair({x:7,y:0}));await drain();expect(sent).toEqual([]);
  p.confirm();await drain();expect(sent).toEqual([]);expect(t.$.pair.x()).toBe(7);
  q.confirm();await drain();expect(sent).toEqual([{x:7,y:0}]);await c.settled();
 }finally{c.dispose();t.destroy();other.destroy();}
});
it('equal declaration inside unrelated transaction does not acquire destination ownership',async()=>{
 const t=signalTree({pair:{x:0,y:0},z:0},{enhancers:[transactions()]});const other=signalTree({q:0},{enhancers:[transactions()]});const sent:unknown[]=[];
 const c=link(t.$.pair,{set:v=>{sent.push(v);}}) as Declared;
 try{
  const q=other.transact(()=>other.$.q(1));t.$.pair.x(7);await drain();expect(sent).toEqual([]);
  const p=t.transact(()=>{t.$.z(1);c.declare({kind:'independent'},()=>t.$.pair.x(7));});await drain();
  expect(sent).toEqual([{x:7,y:0}]);expect(t.$.z()).toBe(1);expect(other.$.q()).toBe(1);
  p.rollback();await drain();expect(t.$.pair.x()).toBe(7);expect(t.$.z()).toBe(0);expect(sent).toEqual([{x:7,y:0}]);
  q.rollback();await drain();expect(sent).toEqual([{x:7,y:0}]);await c.settled();
 }finally{c.dispose();t.destroy();other.destroy();}
});
it('net-zero destination does not inherit a surviving sibling transaction claim',async()=>{
 const t=signalTree({pair:{x:0,y:0},z:0},{enhancers:[transactions()]});const sent:unknown[]=[];
 const c=link(t.$.pair,{set:v=>{sent.push(v);}}) as Declared;
 try{
  const p=t.transact(()=>{t.$.z(1);t.$.pair.x(7);t.$.pair.x(0);});await drain();expect(t.$.pair.x()).toBe(0);expect(sent).toEqual([]);
  c.declare({kind:'independent'},()=>t.$.pair.x(0));await drain();expect(sent).toEqual([{x:0,y:0}]);expect(t.$.z()).toBe(1);
  p.rollback();await drain();expect(t.$.z()).toBe(0);expect(t.$.pair.x()).toBe(0);expect(sent).toEqual([{x:0,y:0}]);await c.settled();
 }finally{c.dispose();t.destroy();}
});
it('newer net-zero write leaves the older destination owner intact',async()=>{
 const t=signalTree({pair:{x:0,y:0},z:0},{enhancers:[transactions()]});const sent:unknown[]=[];
 const c=link(t.$.pair,{set:v=>{sent.push(v);}}) as Declared;
 try{
  const p=t.transact(()=>t.$.pair.x(7));const q=t.transact(()=>{t.$.z(1);t.$.pair.x(9);t.$.pair.x(7);});await drain();expect(sent).toEqual([]);
  q.confirm();await drain();expect(sent).toEqual([]);
  c.declare({kind:'independent'},()=>t.$.pair.x(7));await drain();expect(sent).toEqual([]);
  p.rollback();await drain();expect(t.$.pair.x()).toBe(0);expect(t.$.z()).toBe(1);expect(sent).toEqual([{x:0,y:0}]);await c.settled();
 }finally{c.dispose();t.destroy();}
});
