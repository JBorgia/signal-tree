import { expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import * as lifecycle from './experimental-publication/lifecycle';
import { installTerminalRecord } from './internals/intrinsic-mutation';

type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):{read():{state:string}}};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};

it('composite readiness follows parent finalization without a recipient operation',()=>{
 const channel={};lifecycle.registerConnection(channel,{supported:true,report:()=>{},wake:()=>{}});
 let requirement!:lifecycle.NativeRequirement, composite!:lifecycle.NativeRequirement;
 const seen:boolean[]=[];const sentinel=new Error('parent');
 try{
  expect(()=>lifecycle.runDeclaration(channel,{kind:'independent'},()=>{
   const prepared=lifecycle.prepareNativeRequirement([],false,[]);requirement=prepared.requirement;
   installTerminalRecord(prepared.record);lifecycle.finalizeNativeRequirement(requirement);lifecycle.deliverNativeRequirementReady(requirement);
   composite=lifecycle.combineNativeRequirements([requirement,lifecycle.initialRequirement()]);
   expect(lifecycle.nativeRequirementReady(composite)).toBe(false);
   lifecycle.onNativeRequirementReady(composite,()=>seen.push(lifecycle.nativeProof(composite).invalid));
   throw sentinel;
  })).toThrow(sentinel);
  expect(lifecycle.nativeRequirementReady(composite)).toBe(true);expect(seen).toEqual([true]);
 }finally{lifecycle.disposeConnection(channel);}
});

it('released readiness listener does not run at close',()=>{
 const channel={};lifecycle.registerConnection(channel,{supported:true,report:()=>{},wake:()=>{}});let calls=0;
 try{lifecycle.runDeclaration(channel,{kind:'independent'},()=>{
  const p=lifecycle.prepareNativeRequirement([],false,[]);installTerminalRecord(p.record);lifecycle.finalizeNativeRequirement(p.requirement);
  lifecycle.onNativeRequirementReady(p.requirement,()=>calls++)();
  lifecycle.deliverNativeRequirementReady(p.requirement);
  expect(lifecycle.nativeRequirementReady(p.requirement)).toBe(false);
 });expect(calls).toBe(0);}finally{lifecycle.disposeConnection(channel);}
});

for(const membership of [false,true])it(`enrollment retains parent invalidation for ${membership?'membership':'scalar'} support`,async()=>{
 const tree=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});
 const foreign=signalTree({z:0},{enhancers:[transactions()]});const parent=link(tree.$.pair,{set:()=>{}}) as Experimental;
 const sent:unknown[]=[];let child:Experimental|undefined;const q=foreign.transact(()=>foreign.$.z(7));
 try{
  expect(()=>parent.declare({kind:'independent'},()=>{
   if(membership)tree.$.pair({y:0} as {x:number;y:number});else tree.$.pair.x(7);
   child=link(tree.$.pair,{set:v=>{sent.push(v);}}) as Experimental;
   throw new Error('parent invalid');
  })).toThrow('parent invalid');
  child!.declare({kind:'independent'},()=>tree.$.pair.y(8));await flush();expect(sent).toEqual([]);
  q.confirm();await flush();expect(sent).toEqual([membership?{y:8}:{x:7,y:8}]);
 }finally{child?.dispose();parent.dispose();tree.destroy();foreign.destroy();}
});

it('omission then restored retained collection selects matching payload and support',async()=>{
 const initial={branch:{rows:entityMap<{id:string;x:number},string>()},other:0};
 // Runtime branch omission is exercised through the existing internal cast boundary.
 const tree=signalTree(initial,{enhancers:[transactions()]});
 const foreign=signalTree({z:0},{enhancers:[transactions()]});const rows=tree.$.branch!.rows;
 rows.addOne({id:'a',x:0});await flush();const sent:unknown[]=[];const c=link(tree.$ as never,{set:(v:unknown)=>{sent.push(v);}} as never) as Experimental;
 const q=foreign.transact(()=>foreign.$.z(7));
 try{
  rows.updateOne('a',{x:7});await flush();expect(sent).toEqual([]);
  c.declare({kind:'independent'},()=>tree.$({other:1} as never));await flush();expect(sent).toEqual([{other:1}]);
  c.declare({kind:'independent'},()=>tree.$({branch:{rows:{all:[{id:'a',x:7}]}},other:2} as never));await flush();
  expect(sent.at(-1)).toEqual({branch:{rows:{all:[{id:'a',x:7}]}},other:2});
 }finally{q.confirm();c.dispose();tree.destroy();foreign.destroy();}
});
