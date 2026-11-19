import {appendFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {leaf,link,signalTree,transactions} from '../index';
import {__historyRoots,__historySnapshot,__historyBeginCapture,__historyEndCapture} from './experimental-publication/private';
import {nativeProof,type NativeRequirement} from './experimental-publication/lifecycle';
const drain=async()=>{for(let i=0;i<160;i++)await Promise.resolve();};
it('cached issued snapshot stays old; new leaf and branch captures select current certificates',async()=>{
 const t=signalTree({pair:{x:0,y:0},q:0},{enhancers:[transactions()]});const sent:unknown[]=[];const c=link(t.$.pair,{set:v=>{sent.push(v);}});let holder:ReturnType<typeof signalTree>|undefined;
 try{
  const p=t.transact(()=>t.$.pair.x(7)),q=t.transact(()=>t.$.q(1));
  c.declare({kind:'dependent',owners:[p,q]},()=>t.$(v=>({...v,pair:{...v.pair}})));q.confirm();await drain();
  const saved=t.$.pair(),oldViews=__historySnapshot(saved)!,oldRequirements=oldViews.map(view=>view.requirement);
  const oldSource=__historyRoots(t.$.pair.x).endpoint!.requirement as NativeRequirement;
  const oldOwners=[...nativeProof(oldSource).owners];
  c.declare({kind:'dependent',owners:[p]},()=>t.$.pair(v=>({...v})));await drain();
  const cached=t.$.pair(),current=__historyRoots(t.$.pair.x).endpoint!.requirement as NativeRequirement;
  expect(current).not.toBe(oldSource);expect(nativeProof(current).owners).toHaveLength(1);
  expect(nativeProof(oldSource).owners).toEqual(oldOwners);
  expect(__historySnapshot(saved)).toBe(oldViews);expect(oldViews.map(view=>view.requirement)).toEqual(oldRequirements);
  const h=signalTree({input:leaf(saved)});holder=h;
  __historyBeginCapture();c.declare({kind:'dependent',owners:[p]},()=>h.$(v=>{expect(v.input).toBe(saved);return {};}));
  const supplied=__historyEndCapture();expect(supplied.some(event=>event.inputs.some(input=>input.requirement===oldSource))).toBe(true);
  const beforeLeaf=__historyRoots(t.$.pair.x).endpoint!.requirement;
  __historyBeginCapture();c.declare({kind:'dependent',owners:[p]},()=>t.$.pair.x(v=>v));const direct=__historyEndCapture();
  expect(direct.some(event=>event.inputs.some(input=>input.requirement===beforeLeaf))).toBe(true);
  await drain();const beforeBranch=__historyRoots(t.$.pair.x).endpoint!.requirement;
  __historyBeginCapture();c.declare({kind:'dependent',owners:[p]},()=>t.$.pair(v=>({...v})));const branch=__historyEndCapture();
  expect(branch.some(event=>event.inputs.some(input=>input.requirement===beforeBranch))).toBe(true);
  expect(__historySnapshot(saved)).toBe(oldViews);expect(oldViews.map(view=>view.requirement)).toEqual(oldRequirements);
  const out=process.env['ST_READER_OUTPUT'];if(!out)throw Error('Reader output required');
  appendFileSync(out,JSON.stringify({sameCachedObject:cached===saved,oldViewsUnchanged:true,oldOwners:oldOwners.length,currentOwners:nativeProof(current).owners.length,suppliedUsesOld:true,directUsesCurrent:true,branchUsesCurrent:true,branchReusedCachedObject:branch.some(event=>event.supplied===cached)})+'\n');
  await drain();expect(sent).toEqual([]);p.confirm();await drain();expect(sent).toEqual([{x:7,y:0}]);await c.settled();await drain();expect(sent).toEqual([{x:7,y:0}]);
 }finally{__historyEndCapture();holder?.destroy();c.dispose();t.destroy();}
});
