import { describe, expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import { withWriteContext } from './write-context';
import { hasPublicationPreparation } from './internals/intrinsic-mutation';

type Receipt = { read(): Readonly<{state:string;reason?:string;basis?:string}> };
type Declaration = {kind:'independent'} | {kind:'dependent';owners:readonly object[]};
type Experimental = ReturnType<typeof link> & {declare(input:Declaration,work:()=>unknown):Receipt};
const flush = async () => {getPathNotifier().flushSync();for(let i=0;i<48;i++)await Promise.resolve();};
const make = () => signalTree({pair:{x:0,y:0},x:0,y:0,z:0,w:0},{enhancers:[transactions()]});
const experimental = (c:ReturnType<typeof link>) => c as Experimental;
const caught = (work:()=>unknown) => {try{work();}catch(error){return error;}return undefined;};

// Private experimental surface only. No production Link type/export widening.
describe('authorized existing-key branch/root installed publication',()=>{
 it.each(['branch','root'] as const)('G1/G8 %s: untouched owned x holds independent y; confirmation wakes live proof after old receipt superseded',async mode=>{
  const t=make();const x=mode==='root'?t.$.x:t.$.pair.x;const y=mode==='root'?t.$.y:t.$.pair.y;
  const sent:unknown[]=[];const c=experimental(link(mode==='root'?t.$:t.$.pair,{set:v=>{sent.push(v);}}));
  const p=t.transact(()=>x(7));let off:()=>void=()=>undefined;
  try{
   await flush();const ownership=p.inspect();const events:unknown[]=[];
   off=getPathNotifier().subscribe(mode==='root'?'x':'pair.x',v=>{events.push(v);});
   const xr=c.declare({kind:'dependent',owners:[p]},()=>x(7));await flush();
   expect(events).toEqual([]);expect(p.inspect()).toEqual(ownership);expect(xr.read()).toMatchObject({state:'held'});
   const yr=c.declare({kind:'independent'},()=>y(8));await flush();
   expect(sent).toEqual([]);expect(yr.read()).toMatchObject({state:'held'});expect(xr.read()).toMatchObject({state:'superseded'});
   p.confirm();await flush();expect(sent).toHaveLength(1);expect(sent[0]).toMatchObject({x:7,y:8});
   expect(yr.read()).toMatchObject({state:'started'});expect(xr.read()).toMatchObject({state:'superseded'});
   await c.settled();
  }finally{off();c.dispose();t.destroy();}
 });

 it.each(['branch','root'] as const)('G2 %s: reject native owned x without erasing ordinary y or sending stale x7',async mode=>{
  const t=make();const x=mode==='root'?t.$.x:t.$.pair.x;const y=mode==='root'?t.$.y:t.$.pair.y;
  const sent:unknown[]=[];const c=experimental(link(mode==='root'?t.$:t.$.pair,{set:v=>{sent.push(v);}}));
  const p=t.transact(()=>x(7));
  try{
   await flush();const ownership=p.inspect();c.declare({kind:'dependent',owners:[p]},()=>x(7));await flush();expect(p.inspect()).toEqual(ownership);
   c.declare({kind:'independent'},()=>y(8));await flush();expect(sent).toEqual([]);
   p.rollback();await flush();expect(x()).toBe(0);expect(y()).toBe(8);expect(sent).toHaveLength(1);expect(sent[0]).toMatchObject({x:0,y:8});
   await c.settled();
  }finally{c.dispose();t.destroy();}
 });

 it.each(['branch','root'] as const)('G4 %s: fresh complete literal replacement progresses without confirming p',async mode=>{
  const t=make();const x=mode==='root'?t.$.x:t.$.pair.x;const y=mode==='root'?t.$.y:t.$.pair.y;
  const sent:unknown[]=[];const c=experimental(link(mode==='root'?t.$:t.$.pair,{set:v=>{sent.push(v);}}));
  const p=t.transact(()=>x(7));
  try{
   await flush();const old=c.declare({kind:'dependent',owners:[p]},()=>x(7));c.declare({kind:'independent'},()=>y(8));await flush();expect(sent).toEqual([]);
   const fresh=c.declare({kind:'independent'},()=>{
    if(mode==='root')t.$({pair:{x:0,y:0},x:2,y:3,z:0,w:0});else t.$.pair({x:2,y:3});
   });
   await flush();expect(sent).toHaveLength(1);expect(sent[0]).toMatchObject({x:2,y:3});expect(fresh.read()).toMatchObject({state:'started'});expect(old.read()).toMatchObject({state:'superseded'});
   expect(()=>p.inspect()).not.toThrow();p.confirm();await flush();expect(sent).toHaveLength(1);await c.settled();
  }finally{c.dispose();t.destroy();}
 });

 it('G3 branch: rejected publication dependency leaves ordinary copy; fresh equal complete replacement progresses while q pending',async()=>{
  const t=make();const sent:unknown[]=[];const c=experimental(link(t.$.pair,{set:v=>{sent.push(v);}}));const p=t.transact(()=>t.$.z(7));
  const q=t.transact(()=>t.$.w(9));let off:()=>void=()=>undefined;
  try{
   const old=c.declare({kind:'dependent',owners:[p]},()=>t.$.pair.x(t.$.z()));await flush();expect(sent).toEqual([]);
   p.rollback();await flush();expect(t.$.pair.x()).toBe(7);expect(t.$.z()).toBe(0);expect(t.$.w()).toBe(9);expect(sent).toEqual([]);
   const events:unknown[]=[];off=getPathNotifier().subscribe('pair.x',v=>{events.push(v);});
   const fresh=c.declare({kind:'independent'},()=>t.$.pair({x:7,y:0}));await flush();
   expect(events).toEqual([]);expect(sent).toEqual([{x:7,y:0}]);expect(fresh.read()).toMatchObject({state:'started'});expect(old.read()).toMatchObject({state:'superseded'});
   expect(t.$.w()).toBe(9);q.rollback();await flush();expect(t.$.pair.x()).toBe(7);await c.settled();
  }finally{off();c.dispose();t.destroy();}
 });

 it.each(['branch','root'] as const)('%s updater captures actual consumed pending input before callback overwrites it',async mode=>{
  const t=make();const x=mode==='root'?t.$.x:t.$.pair.x;const sent:unknown[]=[];
  const c=experimental(link(mode==='root'?t.$:t.$.pair,{set:v=>{sent.push(v);}}));const p=t.transact(()=>t.$.z(7));
  try{
   c.declare({kind:'dependent',owners:[p]},()=>x(t.$.z()));await flush();expect(sent).toEqual([]);
   const error=caught(()=>c.declare({kind:'independent'},()=>{
    if(mode==='root')t.$(input=>{x(2);return {...input,x:input.x,y:3};});
    else t.$.pair(input=>{x(2);return {x:input.x,y:3};});
   }));
   expect(error).toMatchObject({code:'SIGNALTREE_PUBLICATION_DECLARATION_INVALID',stage:'after-callback',reason:'contradiction'});
   await flush();expect(x()).toBe(7);expect(sent).toEqual([]);p.confirm();
  }finally{c.dispose();t.destroy();}
 });
 it('equal branch replacement with equal support is no-write and disposal unarms the source',async()=>{
  const t=make();const sent:unknown[]=[];const c=experimental(link(t.$.pair,{set:v=>{sent.push(v);}}));
  try{
   const first=c.declare({kind:'independent'},()=>t.$.pair({x:2,y:3}));await flush();expect(sent).toEqual([{x:2,y:3}]);
   const receipt=c.declare({kind:'independent'},()=>t.$.pair({x:2,y:3}));await flush();
   expect(receipt.read()).toMatchObject({state:'no-write'});expect(first.read()).toMatchObject({state:'started'});expect(sent).toHaveLength(1);
   expect(hasPublicationPreparation(t.$.pair.x)).toBe(true);c.dispose();expect(hasPublicationPreparation(t.$.pair.x)).toBe(false);
   t.$.pair({x:2,y:3});expect(t.$.pair()).toEqual({x:2,y:3});
  }finally{c.dispose();t.destroy();}
 });
 it('disposing the last connection during a native branch updater closes its captured input scope',async()=>{
  const t=make();const c=experimental(link(t.$.pair,{set:()=>{ /* Destination values are intentionally discarded in this protocol fixture. */ }}));
  try{
   t.$.pair(input=>{c.dispose();return input;});
   const sent:unknown[]=[];const next=experimental(link(t.$.pair,{set:v=>{sent.push(v);}}));
   try{next.declare({kind:'independent'},()=>t.$.pair.x(4));await flush();expect(sent).toEqual([{x:4,y:0}]);await next.settled();}finally{next.dispose();}
  }finally{c.dispose();t.destroy();}
 });

 it.each(['branch','root'] as const)('G6 %s: omission masks held field proof, inspection does not overwrite retained component, ordinary re-add restores support',async mode=>{
  const owner=signalTree({z:0},{enhancers:[transactions()]});
  const t=signalTree({a:{x:7,y:0} as {x?:number;y:number}},{enhancers:[transactions()]});const x=t.$.a.x!;
  const sent:unknown[]=[];const c=experimental(link(mode==='root'?t.$:t.$.a,{set:v=>{sent.push(v);}}));const p=owner.transact(()=>owner.$.z(7));
  const shape=(value:unknown)=>mode==='root'?{a:value}:value;
  try{
   c.declare({kind:'dependent',owners:[p]},()=>x(7));await flush();expect(sent).toEqual([]);
   const omitted=c.declare({kind:'independent'},()=>t.$.a({y:8}));await flush();expect(sent).toEqual([shape({y:8})]);expect(omitted.read()).toMatchObject({state:'started'});
   withWriteContext({participation:'inspection'},()=>x(99));await flush();expect(x()).toBe(99);expect(sent).toHaveLength(1);
   c.declare({kind:'independent'},()=>t.$.a.y(9));await flush();expect(sent).toEqual([shape({y:8}),shape({y:9})]);
   const readded=c.declare({kind:'dependent',owners:[p]},()=>x(7));await flush();expect(sent).toHaveLength(2);expect(readded.read()).toMatchObject({state:'held'});
   p.confirm();await flush();expect(sent).toEqual([shape({y:8}),shape({y:9}),shape({x:7,y:9})]);expect(readded.read()).toMatchObject({state:'started'});await c.settled();
  }finally{c.dispose();t.destroy();owner.destroy();}
 });
 it('G6 cold absent enrollment consumes prepared ordinary after-image on presence-only rollback',async()=>{
  const t=signalTree({a:{x:7,y:0} as {x?:number;y:number}},{enhancers:[transactions()]});
  const p=t.transact(()=>t.$.a({y:0}));const sent:unknown[]=[];const c=experimental(link(t.$.a,{set:v=>{sent.push(v);}}));
  try{await flush();expect(sent).toEqual([]);p.rollback();await flush();expect(t.$.a()).toEqual({x:7,y:0});expect(sent).toEqual([{x:7,y:0}]);await c.settled();}
  finally{c.dispose();t.destroy();}
 });

 it('ancestor updater argument wider than descendant recipient stays unknown rather than borrowing sibling input proof',async()=>{
  const owner=signalTree({z:0},{enhancers:[transactions()]});const t=make();const sent:unknown[]=[];
  const c=experimental(link(t.$.pair,{set:v=>{sent.push(v);}}));const p=owner.transact(()=>owner.$.z(7));
  try{
   const receipt=c.declare({kind:'independent'},()=>t.$(input=>({...input,pair:{x:input.x+1,y:input.pair.y}})));
   // Historical hold oracle corrected by 75c645eb's explicit recipient-only exception.
   const admission = receipt.read();
   expect('basis' in admission ? admission.basis : undefined).not.toBe('declared');
   await flush();expect(t.$.pair()).toEqual({x:1,y:0});expect(sent).toEqual([{x:1,y:0}]);
   expect(receipt.read()).toMatchObject({state:'started',basis:'surviving'});
   expect(owner.$.z()).toBe(7);p.rollback();await flush();expect(sent).toEqual([{x:1,y:0}]);await c.settled();
  }finally{c.dispose();t.destroy();owner.destroy();}
 });

});
