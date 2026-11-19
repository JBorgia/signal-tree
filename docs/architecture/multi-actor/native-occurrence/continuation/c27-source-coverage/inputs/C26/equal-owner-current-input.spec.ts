import {expect,it} from 'vitest';
import {link,signalTree,transactions,type PendingTransaction} from '../index';
type C=ReturnType<typeof link>&{declare(input:{kind:'independent'}|{kind:'dependent';owners:readonly PendingTransaction[]}|{kind:'unknown'},work:()=>unknown):{read():Readonly<{state:string;reason?:string}>}};
const drain=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
for(const mode of ['independent','dependent','unknown'] as const)it(`current ancestor input remains distinct from retained support: ${mode}`,async()=>{
 const t=signalTree({pair:{x:0,y:0},q:0},{enhancers:[transactions()]});const sent:unknown[]=[];const c=link(t.$.pair,{set:v=>{sent.push(v);}}) as C;
 try{
  const p=t.transact(()=>t.$.pair.x(7)),q=t.transact(()=>t.$.q(1));await drain();let calls=0;
  const invoke=()=>c.declare(mode==='dependent'?{kind:mode,owners:[p,q]}:{kind:mode},()=>t.$(current=>{calls++;return {...current,pair:{x:current.q===1?current.pair.x:0,y:current.pair.y}};}));
  if(mode==='independent')expect(invoke).toThrow('contradiction');else expect(invoke).not.toThrow();
  expect(calls).toBe(1);expect(t.$.pair()).toEqual({x:7,y:0});await drain();expect(sent).toEqual([]);
  p.confirm();await drain();expect(sent).toEqual([]);
  // New public updater consumes pair alone; q is no longer present as a root sibling input.
  let laterCalls=0;
  expect(()=>c.declare({kind:'independent'},()=>t.$.pair(current=>{laterCalls++;return {...current};}))).toThrow('contradiction');
  expect(laterCalls).toBe(1);await drain();expect(sent).toEqual([]);
  q.confirm();await drain();expect(sent).toEqual([{x:7,y:0}]);await c.settled();
 }finally{c.dispose();t.destroy();}
});
for(const failure of ['throw','contradiction'] as const)it(`nonmatching late recipient keeps admitted unfinished support after retained equality: ${failure}`,async()=>{
 const t=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const other=signalTree({q:0},{enhancers:[transactions()]});const sent:unknown[]=[];
 const anchor=link(t.$.pair,{set:()=>{/* Anchor has its own recipient. */}}) as C;let child:C|undefined;
 try{
  const q=other.transact(()=>other.$.q(1));const sentinel=Object.freeze({failure});let calls=0;
  let error:unknown;
  try{anchor.declare({kind:'independent'},()=>{
   calls++;t.$.pair.x(7);child=link(t.$.pair,{set:v=>{sent.push(v);}}) as C;
   // An equal retaining call in this still-open horizon cannot certify the preceding write.
   anchor.declare({kind:'independent'},()=>t.$.pair.x(7));
   expect(sent).toEqual([]);
   if(failure==='throw')throw sentinel;
   anchor.declare({kind:'dependent',owners:[q]},()=>t.$.pair.y(1));
  });}catch(e){error=e;}
  expect(calls).toBe(1);if(failure==='throw')expect(error).toBe(sentinel);else expect(error).toMatchObject({reason:'contradiction'});
  if(!child)throw Error('Late recipient missing');child.declare({kind:'independent'},()=>t.$.pair.y(8));await drain();expect(sent).toEqual([]);
  q.confirm();await drain();expect(sent).toEqual([{x:7,y:8}]);await child.settled();
 }finally{child?.dispose();anchor.dispose();t.destroy();other.destroy();}
});
