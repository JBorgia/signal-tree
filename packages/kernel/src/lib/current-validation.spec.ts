import {expect,it} from 'vitest';
import {link,signalTree,transactions} from '../index';
const drain=async()=>{for(let i=0;i<160;i++)await Promise.resolve();};
it('confirmed validator remains part of nested declaration completeness',async()=>{
 const t=signalTree({pair:{x:0,y:0},q:0},{enhancers:[transactions()]});const sent:unknown[]=[];const c=link(t.$.pair,{set:v=>{sent.push(v);}});
 try{const p=t.transact(()=>t.$.pair.x(7)),q=t.transact(()=>t.$.q(1));q.confirm();await drain();let calls=0;
  expect(()=>c.declare({kind:'dependent',owners:[p]},()=>c.declare({kind:'dependent',owners:[p,q]},()=>{t.$.pair(v=>{calls++;return {...v};});}))).toThrow('contradiction');
  expect(calls).toBe(1);await drain();expect(sent).toEqual([]);p.confirm();await drain();expect(sent).toEqual([{x:7,y:0}]);await c.settled();
 }finally{c.dispose();t.destroy();}
});
it('input captured pending then confirmed by updater remains fresh validation',async()=>{
 const t=signalTree({pair:{x:0,y:0},q:0},{enhancers:[transactions()]});const sent:unknown[]=[];const c=link(t.$.pair,{set:v=>{sent.push(v);}});
 try{const p=t.transact(()=>t.$.pair.x(7)),q=t.transact(()=>t.$.q(1));await drain();let calls=0;
  expect(()=>c.declare({kind:'dependent',owners:[p]},()=>t.$(v=>{calls++;q.confirm();return {...v,pair:{...v.pair}};}))).toThrow('contradiction');
  expect(calls).toBe(1);await drain();expect(sent).toEqual([]);p.confirm();await drain();expect(sent).toEqual([{x:7,y:0}]);await c.settled();
 }finally{c.dispose();t.destroy();}
});
it('validator pending at declaration entry does not become cleanup after confirmation',async()=>{
 const t=signalTree({pair:{x:0,y:0},q:0},{enhancers:[transactions()]});const sent:unknown[]=[];const c=link(t.$.pair,{set:v=>{sent.push(v);}});
 try{const p=t.transact(()=>t.$.pair.x(7)),q=t.transact(()=>t.$.q(1));await drain();
  const receipt=c.declare({kind:'dependent',owners:[p,q]},()=>{q.confirm();t.$.pair(v=>({...v}));});await drain();
  expect(receipt.read().state).not.toBe('no-write');expect(sent).toEqual([]);p.confirm();await drain();expect(sent).toEqual([{x:7,y:0}]);await c.settled();
 }finally{c.dispose();t.destroy();}
});
