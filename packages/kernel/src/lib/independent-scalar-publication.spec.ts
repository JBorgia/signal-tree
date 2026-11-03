import { expect, it, vi } from 'vitest';
import { signalTree, transactions } from '../index';
import { preparePublicationMutations } from './internals/intrinsic-mutation';
import { getTreeScalarSlotRuntime } from './internals/tree-scalar-slot-port';
import { getOwnedPositionIds } from './internals/owned-mutation';
import { getPositionRegistry } from './internals/position-registry';
import { nativeProof, type NativeRequirement } from './experimental-publication/lifecycle';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

for(const openerFirst of [false,true]) it(`final scalar frame window includes callback-opened owner openerFirst=${openerFirst}`,()=>{
 const tree=signalTree({a:0,b:0},{enhancers:[transactions()]});
 const foreign=signalTree({x:0},{enhancers:[transactions()]});
 const requirements:NativeRequirement[]=[];
 let pending:ReturnType<typeof foreign.transact>|undefined;
 const offA=preparePublicationMutations(tree.$.a,(_m,_input,native)=>{
  requirements.push((native as {requirement:NativeRequirement}).requirement);return undefined;
 },()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ });
 const offB=preparePublicationMutations(tree.$.b,(_m,_input,native)=>{
  requirements.push((native as {requirement:NativeRequirement}).requirement);
  pending=foreign.transact(()=>foreign.$.x(7));return undefined;
 },()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ });
 try {
  const runtime=getTreeScalarSlotRuntime(tree.$)!;
  const frame=runtime.beginFrame();
  for(const leaf of (openerFirst?[tree.$.b,tree.$.a]:[tree.$.a,tree.$.b])) frame.set(runtime.resolveScalarSlot(getOwnedPositionIds(leaf)![0])!,leaf===tree.$.a?1:2);
  const install=frame.prepareCommit!({publish:false});
  expect(tree.$()).toEqual({a:0,b:0});expect(foreign.$.x()).toBe(7);
  const result=install();runtime.publishPrepared(result);
  expect(tree.$()).toEqual({a:1,b:2});expect(requirements).toHaveLength(2);
  const proof=requirements.map(nativeProof);
  const owner=getPositionRegistry(foreign.$)!.id;
  const observations=proof.map(p=>({unknown:p.unknown,possible:p.possible?.map(o=>({owner:o.owner,id:o.id,outcome:o.outcome}))}));
  if(process.env['ST_PREPARED_REVIEW_OUTPUT'])writeFileSync(join(process.env['ST_PREPARED_REVIEW_OUTPUT'],`sibling-window-${openerFirst}.json`),JSON.stringify({owner,observations},null,2)+'\n');
  // Both facts are from one frame whose stores installed after the new owner.
  expect(proof[1].possible?.some(o=>o.owner===owner)).toBe(true);
  expect(proof[0].possible?.some(o=>o.owner===owner)).toBe(true);
 } finally {offA?.();offB?.();pending?.rollback();tree.destroy();foreign.destroy();}
});

import { createNativeTreeScalarLeafRuntime } from './internals/native-tree-scalar-leaf-runtime';
import { onTreeError } from './internals/error-reporter';
import type { ObservationAdapter } from './internals/observation-adapter';
it('invalidation sentinel stays primary, both completions drain and secondary sentinel is reported exactly',()=>{
 const primary={tag:'invalidation'},secondary={tag:'completion'};
 const events:string[]=[];const reports:unknown[]=[];
 const token=()=>({observe(){ /* This adapter fixture does not schedule reactive work. */ },invalidate(){throw primary;}});
 const adapter:ObservationAdapter={createToken:token,runInvalidationGroup:run=>run(),createWritableCell:<T>(read:()=>T)=>({cell:Object.assign(read,{set(_v:T){ /* Destination values are intentionally discarded in this protocol fixture. */ },update(_f:(v:T)=>T){ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ },asReadonly:()=>read}),peek:read,token:token()})};
 const runtime=createNativeTreeScalarLeafRuntime(undefined,adapter),a=runtime.createLeaf(0,Object.is),b=runtime.createLeaf(0,Object.is);
 const unit=()=>({record:{writes:[],adds:[]},completion:{}});
 const offA=preparePublicationMutations(a,unit,()=>{events.push('a');throw secondary;})!;
 const offB=preparePublicationMutations(b,unit,()=>{events.push('b');})!;
 const offError=onTreeError(event=>reports.push(event.error));
 const consoleError=vi.spyOn(console,'error').mockImplementation((...args)=>reports.push(...args));
 try{
  const frame=runtime.beginFrame();frame.set(0,1);frame.set(1,2);
  let caught:unknown;try{frame.commit();}catch(error){caught=error;}
  expect(caught).toBe(primary);expect(reports).toContain(secondary);expect(events).toEqual(['a','b']);expect([a(),b()]).toEqual([1,2]);
 }finally{offA();offB();offError();consoleError.mockRestore();}
});
