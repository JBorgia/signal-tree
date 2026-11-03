import {expect,it} from 'vitest';
import * as l from './experimental-publication/lifecycle';
import {installTerminalRecord} from './internals/intrinsic-mutation';
let serial=920000;
function source(){const owner=++serial;l.registerOwnerSource(owner,{});return {owner,open(id:number){l.ownerTransition(owner,{kind:'opened',transactionId:id});return l.ownerCell(owner,id)!;},end(id:number,kind:string){l.ownerTransition(owner,{kind,transactionId:id});},dispose(){l.abandonOwnerSource(owner);}};}
const proof=(cell:l.OwnerCell):l.Proof=>({owners:[cell],input:[cell],validation:[cell],unknown:false,invalid:false});
const admission=()=>l.comparisonAdmission(l.comparisonCutoff(),l.initialRequirement());
it('exact first confirmation is immutable across repeat, retirement and source disposal',async()=>{
 const s=source();try{
  const cell=s.open(1);s.end(1,'confirmed');const before=admission();
  s.end(1,'confirmed');expect(l.comparisonObligations(proof(cell),before).owners).toEqual([]);
  expect(()=>s.end(1,'rolled-back')).toThrow('Terminal publication dependency outcome reversed');
  expect(cell.outcome).toBe('confirmed');await Promise.resolve();s.end(1,'confirmed');s.dispose();
  expect(l.comparisonObligations(proof(cell),before).owners).toEqual([]);
  // The same numeric source/transaction ID is a different exact cell.
  l.registerOwnerSource(s.owner,{});const replacement=s.open(1);s.end(1,'confirmed');
  expect(replacement).not.toBe(cell);expect(l.comparisonObligations(proof(replacement),before).owners).toEqual([replacement]);
 }finally{s.dispose();}
});
it('post-cutoff confirmation and captured-pending input remain relevant',()=>{
 const s=source();try{
  const cell=s.open(1),before=admission(),raw=l.initialRequirement();
  raw.inputs=[{requirement:l.initialRequirement(),owners:[cell]}];s.end(1,'confirmed');
  const captured=l.comparisonAdmission(l.comparisonCutoff(),raw);
  raw.inputs=[];expect(Object.isFrozen(captured)).toBe(true);expect(Object.isFrozen(captured.protectedOwners)).toBe(true);
  expect(l.comparisonObligations(proof(cell),before).owners).toEqual([cell]);
  expect(l.comparisonObligations(proof(cell),captured).owners).toEqual([cell]);
  expect(l.comparisonObligations(proof(cell),admission()).owners).toEqual([]);
 }finally{s.dispose();}
});
it('all non-I/V roles and flags survive; issued proof is not changed',()=>{
 const s=source();try{
  const cell=s.open(1);s.end(1,'confirmed');const descriptor=admission();
  for(const extra of [{destination:[cell]},{possible:[cell]}]){
   const p={...proof(cell),...extra};expect(l.comparisonObligations(p,descriptor).owners).toEqual([cell]);
  }
  const unclassified={owners:[cell],unknown:false,invalid:false};expect(l.comparisonObligations(unclassified,descriptor).owners).toEqual([cell]);
  const p=Object.freeze({...proof(cell),unknown:true,invalid:true,unavailableInput:true,historicalWindow:true,terminalRejectedRoles:15});
  const reduced=l.comparisonObligations(p,descriptor);expect(reduced).toEqual({...p,owners:[],input:[],validation:[]});expect(p.owners).toEqual([cell]);expect(p.input).toEqual([cell]);
 }finally{s.dispose();}
});
it('rollback, abandonment, unavailable pending and unstamped confirmed cells never qualify',()=>{
 const s=source();try{
  const rolled=s.open(1),abandoned=s.open(2),pending=s.open(3);s.end(1,'rolled-back');s.end(2,'abandoned');s.dispose();
  const synthetic:l.OwnerCell={owner:0,id:0,outcome:'confirmed',dependents:new Set()};
  for(const cell of [rolled,abandoned,pending,synthetic])expect(l.comparisonObligations(proof(cell),admission()).owners).toEqual([cell]);
 }finally{s.dispose();}
});
it('operand completion requires activation and aggregate completion, not owner settlement',()=>{
 const s=source(),channel={},revision={};l.registerConnection(channel,{supported:true,report:()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ },wake:()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ }});
 try{
  const pending=s.open(1),prepared=l.prepareNativeRequirement([pending],false,[]),raw=prepared.requirement;
  const plan=l.prepareRevision(channel,revision,[pending],{},[],raw,true,raw);
  installTerminalRecord(prepared.record);l.finalizeNativeRequirement(raw);installTerminalRecord(plan);plan.finalize?.();
  expect(l.comparisonRevisionReady(channel,revision)).toBe(false);
  l.completeScalarNativeRequirement(raw,raw);expect(l.nativeRequirementReady(raw)).toBe(true);
  expect(l.comparisonRevisionReady(channel,revision)).toBe(false);
  l.projectRevision(channel,revision,l.nativeProof(raw),false);
  expect(pending.outcome).toBe('pending');expect(l.comparisonRevisionReady(channel,revision)).toBe(true);
 }finally{l.disposeConnection(channel);s.dispose();}
});
