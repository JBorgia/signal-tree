import { expect, it } from 'vitest';
import { signalTree, transactions } from '../index';
import { preparePublicationMutations } from './internals/intrinsic-mutation';
import { getTreeScalarSlotRuntime } from './internals/tree-scalar-slot-port';
import { getOwnedPositionIds } from './internals/owned-mutation';
import { getPositionRegistry } from './internals/position-registry';
import { nativeProof, type NativeRequirement } from './experimental-publication/lifecycle';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

it('final scalar frame window includes owner opened by later sibling preparation',()=>{
 const tree=signalTree({a:0,b:0},{enhancers:[transactions()]});
 const foreign=signalTree({x:0},{enhancers:[transactions()]});
 const requirements:NativeRequirement[]=[];
 let pending:ReturnType<typeof foreign.transact>|undefined;
 const offA=preparePublicationMutations(tree.$.a,(_m,_input,native)=>{
  requirements.push((native as {requirement:NativeRequirement}).requirement);return undefined;
 },()=>{});
 const offB=preparePublicationMutations(tree.$.b,(_m,_input,native)=>{
  requirements.push((native as {requirement:NativeRequirement}).requirement);
  pending=foreign.transact(()=>foreign.$.x(7));return undefined;
 },()=>{});
 try {
  const runtime=getTreeScalarSlotRuntime(tree.$)!;
  const frame=runtime.beginFrame();
  frame.set(runtime.resolveScalarSlot(getOwnedPositionIds(tree.$.a)![0])!,1);
  frame.set(runtime.resolveScalarSlot(getOwnedPositionIds(tree.$.b)![0])!,2);
  const install=frame.prepareCommit!({publish:false});
  expect(tree.$()).toEqual({a:0,b:0});expect(foreign.$.x()).toBe(7);
  const result=install();runtime.publishPrepared(result);
  expect(tree.$()).toEqual({a:1,b:2});expect(requirements).toHaveLength(2);
  const proof=requirements.map(nativeProof);
  const owner=getPositionRegistry(foreign.$)!.id;
  const observations=proof.map(p=>({unknown:p.unknown,possible:p.possible?.map(o=>({owner:o.owner,id:o.id,outcome:o.outcome}))}));
  if(process.env['ST_PREPARED_REVIEW_OUTPUT'])writeFileSync(join(process.env['ST_PREPARED_REVIEW_OUTPUT'],'sibling-window.json'),JSON.stringify({owner,observations},null,2)+'\n');
  // Both facts are from one frame whose stores installed after the new owner.
  expect(proof[1].possible?.some(o=>o.owner===owner)).toBe(true);
  expect(proof[0].possible?.some(o=>o.owner===owner)).toBe(true);
 } finally {offA?.();offB?.();pending?.rollback();tree.destroy();foreign.destroy();}
});
