import {expect,it} from 'vitest';
import {link,signalTree,transactions} from '../index';
import * as l from './experimental-publication/lifecycle';
import {installTerminalRecord} from './internals/intrinsic-mutation';
const drain=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
for(const activationFirst of [true,false])it(`source and recipient projection wait for both barriers: activationFirst=${activationFirst}`,()=>{
 const tree=signalTree({x:0},{enhancers:[transactions()]});const a=tree.transact(()=>tree.$.x(1));a.confirm();
 const channel={};l.registerConnection(channel,{supported:true,report:()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ },wake:()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ }});
 let raw!:l.NativeRequirement,source!:l.NativeRequirement,cell!:l.OwnerCell;const revision={};
 try{
  l.runDeclaration(channel,{kind:'dependent',owners:[a]},()=>{
   const prepared=l.prepareNativeRequirement([],false,[]);raw=prepared.requirement;cell=l.nativeProof(raw).validation![0];
   expect(cell.outcome).toBe('confirmed');const mask=new Set([cell]);
   source=l.combineScalarNativeRequirements([raw],mask);
   expect.soft(l.nativeProof(source).validation).toContain(cell);
   const plan=l.prepareRevision(channel,revision,[],{},[],source,true,raw,mask);
   installTerminalRecord(prepared.record);l.finalizeNativeRequirement(raw);installTerminalRecord(plan);plan.finalize?.();
   if(activationFirst)l.completeScalarNativeRequirement(source,raw);
   expect(l.nativeRequirementReady(source)).toBe(false);
   const projected=l.projectRevision(channel,revision,l.nativeProof(source),true);
   expect.soft(projected.validation).toContain(cell);
  });
  if(!activationFirst){
   expect(l.nativeRequirementReady(source)).toBe(false);
   expect.soft(l.nativeProof(source).validation).toContain(cell);
   expect.soft(l.proof(channel,revision)?.validation).toContain(cell);
   l.completeScalarNativeRequirement(source,raw);
  }
  expect(l.nativeRequirementReady(source)).toBe(true);expect(source.components).toBeUndefined();
  expect(l.nativeProof(raw).validation).toContain(cell); // issued/raw validation never rewritten
  expect(l.nativeProof(source).validation??[]).not.toContain(cell);
  expect(l.finalizedRetirement(source)?.blocked).toBe(true); // original explicit role still blocks retirement
  const projected=l.projectRevision(channel,revision,l.nativeProof(source),false);
  expect(projected.validation??[]).not.toContain(cell);
 }finally{l.disposeConnection(channel);tree.destroy();}
});
it('projected source preserves invalidity and exact readiness sentinel after cleanup',()=>{
 const tree=signalTree({x:0},{enhancers:[transactions()]});const a=tree.transact(()=>tree.$.x(1));a.confirm();
 const channel={};l.registerConnection(channel,{supported:true,report:()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ },wake:()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ }});const sentinel=new Error('R2 readiness sentinel');
 let source!:l.NativeRequirement,raw!:l.NativeRequirement;let later=0,caught:unknown;
 try{
  l.runDeclaration(channel,{kind:'dependent',owners:[a]},()=>{
   const prepared=l.prepareNativeRequirement([],false,[]);raw=prepared.requirement;const cell=l.nativeProof(raw).validation![0];
   source=l.combineScalarNativeRequirements([raw],new Set([cell]));installTerminalRecord(prepared.record);l.finalizeNativeRequirement(raw);
  });
  l.onNativeRequirementReady(raw,()=>{throw sentinel;});l.onNativeRequirementReady(raw,()=>later++);
  try{l.completeScalarNativeRequirement(source,raw);}catch(error){caught=error;}
  expect(caught).toBe(sentinel);expect(later).toBe(1);expect(source.components).toBeUndefined();expect(l.finalizedRetirement(source)?.blocked).toBe(true);
  expect(l.nativeProof(raw).validation).toHaveLength(1);expect(l.nativeProof(source).validation??[]).toHaveLength(0);
 }finally{l.disposeConnection(channel);tree.destroy();}
});
it('genuine open historical contributor holds; closed fresh admission can be no-write',async()=>{
 const tree=signalTree({pair:{x:0,y:0},q:0},{enhancers:[transactions()]});const sent:unknown[]=[];const c=link(tree.$.pair,{set:v=>{sent.push(v);}});
 try{
  const p=tree.transact(()=>tree.$.pair.x(7)),q=tree.transact(()=>tree.$.q(1));const before=p.inspect();let callbacks=0;
  const earlier=c.declare({kind:'dependent',owners:[p,q]},()=>{
   tree.$(v=>{callbacks++;return {...v,pair:{...v.pair}};});q.confirm();
   // The first installation is still inside this raw validation horizon.
   tree.$.pair(v=>{callbacks++;return {...v};});expect(sent).toEqual([]);
  });await drain();expect(sent).toEqual([]);expect(p.inspect()).toEqual(before);
  const fresh=c.declare({kind:'dependent',owners:[p,q]},()=>tree.$.pair(v=>{callbacks++;return {...v};}));await drain();
  expect.soft(fresh.read()).toEqual({state:'no-write'});expect.soft(earlier.read().state).not.toBe('superseded');expect(sent).toEqual([]);expect(callbacks).toBe(3);
  p.confirm();await drain();await c.settled();await drain();expect(sent).toEqual([{x:7,y:0}]);expect.soft(earlier.read()).toEqual({state:'started',basis:'surviving'});expect.soft(fresh.read()).toEqual({state:'no-write'});
 }finally{c.dispose();tree.destroy();}
});
