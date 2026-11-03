import {expect,it} from 'vitest';
import {signalTree,entityMap,transactions} from '../index';
import {preparePointRealization} from './internals/causal-runtime/tree-realization-adapter';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {preparePublicationMutations} from './internals/intrinsic-mutation';
import {getOwnedPositionIds} from './internals/owned-mutation';
import {getPositionRegistry} from './internals/position-registry';
import {getPathNotifier} from './path-notifier';
import {plainBranchMembershipEffects} from './internals/plain-branch-membership';
import * as life from './experimental-publication/lifecycle';
const fixture=()=>{
 const t=signalTree({other:0,profile:{a:0} as {a?:number},rows:entityMap<{id:number;n:number},number>()},{enhancers:[transactions()]});
 t.$.rows.addOne({id:1,n:0});const off=getPathNotifier().subscribe('**',(_n,_p,_path,_owner,_origin,_subjects,_positions,meta)=>{plainBranchMembershipEffects(meta);});t.$.profile({});getPathNotifier().flushSync();t.$.profile({a:0});getPathNotifier().flushSync();off();return t;
};
for(const structural of [false,true])for(const mode of ['complete','prepare-failure','late-enroll','member-replaced'] as const)it(`membership joins operation phase structural=${structural} mode=${mode}`,()=>{
 const t=fixture(),foreign=signalTree({x:0},{enhancers:[transactions()]});const a=t.$.profile.a!;let pending:ReturnType<typeof foreign.transact>|undefined;const requirements:life.NativeRequirement[]=[];const seen:unknown[]=[];const sentinel={tag:'later-source-prepare'};let releaseLate=()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ };const original=Object.getOwnPropertyDescriptor(t.$.profile,'a')!;
 const capture=(_m:unknown,_i:unknown,n:object|undefined)=>{requirements.push((n as {requirement:life.NativeRequirement}).requirement);return undefined;};
 const offA=preparePublicationMutations(a,capture,()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ })!;
 const offRows=getEntityPublicationBinding(t.$.rows)!.source.subscribe({prepare(_p,n){requirements.push((n as {requirement:life.NativeRequirement}).requirement);pending??=foreign.transact(()=>foreign.$.x(7));if(mode==='prepare-failure')throw sentinel;return {record:{writes:[],adds:[]},completion:{}};},complete(){seen.push([a(),t.$.rows.all()]);}});
 const owner=getOwnedPositionIds(t.$.rows)![0],subjectId=getEntityPublicationBinding(t.$.rows.byIdOrFail(1))!.subject!;
 const effects=[{owner:getOwnedPositionIds(a)![0],before:0,after:1,plainBranchMembership:{before:true,after:true}},...(structural?[{owner,subjectId,before:1,after:2,structural:'rekey' as const}]:[{owner,subjectId,subjectFieldSegments:['n'],before:0,after:1}])];
 try{
  let caught:unknown;let plan:ReturnType<typeof preparePointRealization>;try{plan=preparePointRealization(t,effects);}catch(error){caught=error;}
  expect(foreign.$.x()).toBe(7);expect(pending).toBeDefined();
  if(mode==='prepare-failure'){expect(caught).toBe(sentinel);expect(a()).toBe(0);expect(t.$.rows.ids()).toEqual([1]);expect(t.$.rows.byIdOrFail(1).n()).toBe(0);expect(seen).toEqual([]);expect(requirements.every(r=>!life.nativeRequirementReady(r))).toBe(true);return;}
  expect(caught).toBeUndefined();expect(plan).toBeDefined();const foreignOwner=getPositionRegistry(foreign.$)!.id;expect(requirements.length).toBeGreaterThan(1);for(const requirement of requirements){expect(life.nativeProof(requirement).possible?.map(c=>c.owner)).toContain(foreignOwner);expect(life.nativeRequirementReady(requirement)).toBe(false);}
  if(mode==='late-enroll')releaseLate=preparePublicationMutations(a,()=>undefined,()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ })!;
  if(mode==='member-replaced')Object.defineProperty(t.$.profile,'a',{...original,value:t.$.other});
  if(mode!=='complete'){expect(()=>plan!.install()).toThrow(mode==='late-enroll'?'Scalar publication enrollment changed before installation':'Plain branch target location changed before installation');expect(a()).toBe(0);expect(t.$.rows.ids()).toEqual([1]);expect(t.$.rows.byIdOrFail(1).n()).toBe(0);expect(seen).toEqual([]);if(mode==='member-replaced')expect(t.$.profile.a).toBe(t.$.other);return;}
  plan!.install();expect(requirements.every(r=>!life.nativeRequirementReady(r))).toBe(true);expect(seen).toEqual([]);plan!.publish();expect(a()).toBe(1);expect(t.$.rows.ids()).toEqual([structural?2:1]);expect(seen.length).toBeGreaterThan(0);for(const value of seen)expect(value).toEqual([1,[{id:1,n:structural?0:1}]]);expect(requirements.every(life.nativeRequirementReady)).toBe(true);
 }finally{Object.defineProperty(t.$.profile,'a',original);releaseLate();offA();offRows();pending?.rollback();t.destroy();foreign.destroy();}
});
it('membership scalar finalization refuses same-tree preparation reentry while retaining nested work',()=>{
 const t=fixture();const a=t.$.profile.a!;let entered=false;const off=getEntityPublicationBinding(t.$.rows)!.source.subscribe({prepare(){if(!entered){entered=true;t.$.other(777);}return undefined;},complete(){ /* This participant has no completion side effect. */ }});
 try{expect(()=>preparePointRealization(t,[{owner:getOwnedPositionIds(a)![0],before:0,after:1,plainBranchMembership:{before:true,after:true}},{owner:getOwnedPositionIds(t.$.rows)![0],subjectId:getEntityPublicationBinding(t.$.rows.byIdOrFail(1))!.subject!,subjectFieldSegments:['n'],before:0,after:1}])).toThrow('Reentrant scalar finalization');expect(entered).toBe(true);expect(t.$.other()).toBe(777);expect(a()).toBe(0);expect(t.$.rows.byIdOrFail(1).n()).toBe(0);}finally{off();t.destroy();}
});
