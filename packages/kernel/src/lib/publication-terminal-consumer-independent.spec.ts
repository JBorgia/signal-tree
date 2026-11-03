import { signalTree, entityMap } from '../index';
import { getPositionRegistry } from './internals/position-registry';
import { expect, it } from 'vitest';
import { installTerminalRecord } from './internals/intrinsic-mutation';
import * as lifecycle from './experimental-publication/lifecycle';
import * as publication from './experimental-publication/private';
import { compactTerminalProof, REJECTED_INPUT } from './experimental-publication/proof-retirement';
const requirement=(proof:Readonly<lifecycle.Proof>):lifecycle.NativeRequirement=>({proof,inputs:[],frames:[],known:[],unknown:false,possible:[],captureWindow:false});
const rejected=():lifecycle.NativeRequirement=>{
 const owner:lifecycle.OwnerCell={owner:981234,id:1,outcome:'rolled-back',dependents:new Set()};
 return requirement(compactTerminalProof({owners:[owner],input:[owner],unknown:false,invalid:false}));
};
it('private delivery cannot early-admit a compacted terminal rejected source proof',()=>{
 const tree=signalTree({x:0});const channel={}; publication.bindSource(channel,981234,1,{supported:true},()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ },tree.$.x,{registry:getPositionRegistry(tree.$.x)!,address:['x'],value:0,presence:[]});
 try{
  const unit=publication.prepareSourceProjection(channel,{intent:'replace',before:0,after:7,changed:true},rejected());
  if(!unit)throw Error('Missing prepared source unit');unit.finalize?.();installTerminalRecord(unit.record);publication.completeSourceProjection(unit.completion);
  const projected=publication.refreshSource(channel);if(!projected)throw Error('Missing projected revision');
  expect(lifecycle.proof(channel,projected.fact)?.terminalRejectedRoles).toBe(REJECTED_INPUT);
  expect(lifecycle.decision(channel,projected.fact).early).toBe(false);
  expect(publication.allowed(projected.fact,981234,1,channel)).toBe(false);
  let fallback=0,early=0;
  publication.admit(()=>{fallback++;},projected.fact,981234,1,channel,{claimant:{},key:{},run:()=>{early++;}});
  expect({fallback,early}).toEqual({fallback:1,early:0});
 }finally{publication.dispose(channel,{});tree.destroy();}
});
it('aggregate summary retains terminal input evidence from an untouched collection contributor',()=>{
 const tree=signalTree({rows:entityMap<{id:string},string>()});const channel={},registry=getPositionRegistry(tree.$.rows)!,collection=tree.$.rows;
 publication.bindSource(channel,981235,1,{supported:true},()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ },collection,{registry,address:['rows'],value:[],aggregate:true,presence:[]});
 try{
  publication.registerCollectionProjection(channel,collection,undefined,new Map<string,object>([['field:old',rejected()]]));
  const unit=publication.prepareSourceProjection(channel,{intent:'replace',before:[],after:[7],changed:true},lifecycle.initialRequirement(),undefined,{key:collection,edits:[]});
  if(!unit)throw Error('Missing prepared aggregate source');unit.finalize?.();installTerminalRecord(unit.record);publication.completeSourceProjection(unit.completion);
  const projected=publication.refreshSource(channel);if(!projected)throw Error('Missing aggregate projected revision');
  expect(lifecycle.proof(channel,projected.fact)?.terminalRejectedRoles).toBe(REJECTED_INPUT);
  expect(lifecycle.decision(channel,projected.fact).early).toBe(false);
  expect(publication.allowed(projected.fact,981235,1,channel)).toBe(false);
 }finally{publication.dispose(channel,{});tree.destroy();}
});
