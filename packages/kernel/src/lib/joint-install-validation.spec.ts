import {expect,it} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getOwnedPositionIds} from './internals/owned-mutation';
import {preparePointRealization} from './internals/causal-runtime/tree-realization-adapter';
import {preparePublicationMutations} from './internals/intrinsic-mutation';
import * as life from './experimental-publication/lifecycle';
for(const reverse of [false,true])for(const change of ['enroll','release','retire'] as const)it(`all source validation precedes stores ${change} reverse=${reverse}`,()=>{
 const t=signalTree({scalar:0,left:entityMap<{id:number;n:number},number>(),right:entityMap<{id:number;n:number},number>()},{enhancers:[transactions()]});let off=()=>{};
 try{
  const nodes=reverse?[t.$.right,t.$.left]:[t.$.left,t.$.right];for(const n of nodes)n.addOne({id:1,n:0});
  const source=getEntityPublicationBinding(nodes[1])!.source;let completed=0;
  const participant={prepare(){return {record:{writes:[],adds:[]},completion:{}};},complete(){completed++;}};
  if(change==='release')off=source.subscribe(participant);
  const effects=[{owner:getOwnedPositionIds(t.$.scalar)![0],before:0,after:1},...nodes.map(node=>({owner:getOwnedPositionIds(node)![0],subjectId:getEntityPublicationBinding(node.byIdOrFail(1))!.subject!,subjectFieldSegments:['n'],before:0,after:1}))];
  const plan=preparePointRealization(t,effects);expect(plan).toBeDefined();
  if(change==='enroll')off=source.subscribe(participant);else if(change==='release')off();else source.retire(getEntityPublicationBinding(nodes[1].byIdOrFail(1))!.subject!);
  expect(()=>plan!.install()).toThrow('Entity publication source changed before installation');
  expect(t.$.scalar()).toBe(0);expect(nodes.map(n=>n.byIdOrFail(1).n())).toEqual([0,0]);expect(completed).toBe(0);
 }finally{off();t.destroy();}
});
it('scalar recipient enrollment invalidates the whole prepared mixed unit before stores',()=>{
 const t=signalTree({x:0,rows:entityMap<{id:number;n:number},number>()},{enhancers:[transactions()]});let off=()=>{};
 try{t.$.rows.addOne({id:1,n:0});const plan=preparePointRealization(t,[{owner:getOwnedPositionIds(t.$.rows)![0],subjectId:getEntityPublicationBinding(t.$.rows.byIdOrFail(1))!.subject!,subjectFieldSegments:['n'],before:0,after:1},{owner:getOwnedPositionIds(t.$.x)![0],before:0,after:1}]);expect(plan).toBeDefined();off=preparePublicationMutations(t.$.x,()=>undefined,()=>{})!;expect(()=>plan!.install()).toThrow('Scalar publication enrollment changed before installation');expect(t.$.x()).toBe(0);expect(t.$.rows.byIdOrFail(1).n()).toBe(0);}finally{off();t.destroy();}
});
it('validation does not resample a later foreign possible owner or deliver readiness',()=>{
 const t=signalTree({rows:entityMap<{id:number;n:number},number>()},{enhancers:[transactions()]});const foreign=signalTree({x:0},{enhancers:[transactions()]});let pending:ReturnType<typeof foreign.transact>|undefined;let off=()=>{};let requirement:life.NativeRequirement|undefined;let ready=0;
 try{t.$.rows.addOne({id:1,n:0});off=getEntityPublicationBinding(t.$.rows)!.source.subscribe({prepare(_p,native){requirement=(native as {requirement:life.NativeRequirement}).requirement;life.onNativeRequirementReady(requirement,()=>ready++);return undefined;},complete(){}});const plan=preparePointRealization(t,[{owner:getOwnedPositionIds(t.$.rows)![0],subjectId:getEntityPublicationBinding(t.$.rows.byIdOrFail(1))!.subject!,subjectFieldSegments:['n'],before:0,after:1}]);expect(plan).toBeDefined();expect(requirement).toBeDefined();const before=life.nativeProof(requirement!).possible;expect(before?.length??0).toBe(0);pending=foreign.transact(()=>foreign.$.x(7));plan!.install();expect(life.nativeProof(requirement!).possible).toBe(before);expect(ready).toBe(0);plan!.publish();expect(ready).toBe(1);expect(t.$.rows.byIdOrFail(1).n()).toBe(1);expect(foreign.$.x()).toBe(7);}finally{off();pending?.rollback();t.destroy();foreign.destroy();}
});
