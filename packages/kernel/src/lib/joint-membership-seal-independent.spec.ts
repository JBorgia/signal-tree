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
for(const membership of [false,true])it(`scalar and collection seal after all sibling preparation; membership=${membership}`,()=>{
 const t=signalTree({profile:{a:0} as {a?:number},rows:entityMap<{id:number;n:number},number>()},{enhancers:[transactions()]});
 const foreign=signalTree({x:0},{enhancers:[transactions()]});let pending:ReturnType<typeof foreign.transact>|undefined;let a:life.NativeRequirement|undefined,row:life.NativeRequirement|undefined;
 t.$.rows.addOne({id:1,n:0});const register=getPathNotifier().subscribe('**',(_n,_p,_path,_owner,_origin,_subjects,_positions,meta)=>{plainBranchMembershipEffects(meta);});t.$.profile({});getPathNotifier().flushSync();t.$.profile({a:0});getPathNotifier().flushSync();register();const scalar=t.$.profile.a!;
 const offA=preparePublicationMutations(scalar,(_m,_i,n)=>{a=(n as {requirement:life.NativeRequirement}).requirement;return undefined;},()=>{})!;
 const offRow=getEntityPublicationBinding(t.$.rows)!.source.subscribe({prepare(_p,n){row=(n as {requirement:life.NativeRequirement}).requirement;pending=foreign.transact(()=>foreign.$.x(7));return undefined;},complete(){}});
 try{
  const plan=preparePointRealization(t,[{owner:getOwnedPositionIds(scalar)![0],before:0,after:1,...(membership?{plainBranchMembership:{before:true,after:true}}:{})},{owner:getOwnedPositionIds(t.$.rows)![0],subjectId:getEntityPublicationBinding(t.$.rows.byIdOrFail(1))!.subject!,subjectFieldSegments:['n'],before:0,after:1}]);
  expect(plan).toBeDefined();expect(a).toBeDefined();expect(row).toBeDefined();expect(pending).toBeDefined();
  const owner=getPositionRegistry(foreign.$)!.id;
  const scalarOwners=life.nativeProof(a!).possible?.map(c=>c.owner)??[],rowOwners=life.nativeProof(row!).possible?.map(c=>c.owner)??[];
  console.log(JSON.stringify({membership,owner,scalarOwners,rowOwners,a:scalar(),row:t.$.rows.byIdOrFail(1).n()}));
  expect(scalar()).toBe(0);expect(t.$.rows.byIdOrFail(1).n()).toBe(0);expect(rowOwners).toContain(owner);expect(scalarOwners).toContain(owner);
  plan!.install();plan!.publish();expect(scalar()).toBe(1);expect(t.$.rows.byIdOrFail(1).n()).toBe(1);
 }finally{offA();offRow();pending?.rollback();t.destroy();foreign.destroy();}
});
