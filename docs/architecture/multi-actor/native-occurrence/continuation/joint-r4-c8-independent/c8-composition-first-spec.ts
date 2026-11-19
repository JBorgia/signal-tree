import {expect,it,vi} from 'vitest';
import {signalTree,link} from '../index';
import {createTreeScalarLeafRuntime} from './internals/tree-scalar-leaf-runtime';
import {createNativeTreeScalarLeafRuntime} from './internals/native-tree-scalar-leaf-runtime';
import {ConstructionAllocation} from './internals/construction-allocation';
import {NEUTRAL_OBSERVATION_ADAPTER,type ObservationAdapter} from './internals/observation-adapter';
import type {WritableCell} from './internals/cell-runtime';
import {preparePublicationMutations} from './internals/intrinsic-mutation';
import {withWriteContext} from './write-context';
import {getPathNotifier} from './path-notifier';
import * as life from './experimental-publication/lifecycle';
const observation:ObservationAdapter={...NEUTRAL_OBSERVATION_ADAPTER,createWritableCell<T>(read:()=>T){return {cell:read as WritableCell<T>,peek:read,token:{observe(){},invalidate(){}}};}};
for(const native of [false,true])it(`adopted live slot retains leaf publication registration native=${native}`,()=>{
 const rt=native?createNativeTreeScalarLeafRuntime(undefined,observation):createTreeScalarLeafRuntime(undefined);
 const allocation=new ConstructionAllocation();const leaf=rt.createLeaf(0,Object.is,41,allocation);let prepared=0,completed=0;
 const stop=preparePublicationMutations(leaf,()=>{prepared++;return {record:{writes:[],adds:[]},completion:{}};},()=>{completed++;})!;
 try{
  expect(stop).toBeTypeOf('function');expect(rt.slotCount()).toBe(0);expect(leaf()).toBe(0);
  allocation.validate();allocation.install();expect(rt.resolveScalarLeaf(41)).toBe(leaf);expect(rt.slotCount()).toBe(1);
  for(const value of [7,9]){const frame=rt.beginFrame();frame.set(rt.resolveScalarSlot(41)!,value);frame.commit();expect(leaf()).toBe(value);}
  expect([prepared,completed]).toEqual([2,2]);
 }finally{stop();}
});
const tick=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
type Declared=ReturnType<typeof link>&{declare(input:{kind:'independent'},body:()=>void):unknown};
for(const inDeclaration of [false,true])it(`inspection enrollment leaves no ordinary delivery and later authored adoption is ready declaration=${inDeclaration}`,async()=>{
 const t=signalTree({rows:{} as Record<string,{n:number}>});const sent:unknown[]=[];const c=link(t.$.rows,{set:v=>{sent.push(v);}}) as Declared;
 const completed:life.NativeRequirement[]=[];const deliver=life.deliverNativeRequirementReady;
 const spy=vi.spyOn(life,'deliverNativeRequirementReady').mockImplementation(r=>{if(r)completed.push(r);deliver(r);});
 let off=()=>{};
 try{
  const inspect=()=>withWriteContext({participation:'inspection'},()=>t.$.rows({a:{n:9},hidden:{n:99}}));
  if(inDeclaration)c.declare({kind:'independent'},inspect);else inspect();await tick();
  expect(sent).toEqual([]);expect(t.$.rows()).toEqual({a:{n:9},hidden:{n:99}});expect(completed.length).toBeGreaterThan(0);
  const leaf=t.$.rows.a.n;const ready:number[]=[];const requirements:life.NativeRequirement[]=[];
  off=preparePublicationMutations(leaf,(_m,_i,native)=>{const r=(native as {requirement:life.NativeRequirement}).requirement;requirements.push(r);life.onNativeRequirementReady(r,()=>ready.push(leaf()));return undefined;},()=>{})!;
  c.declare({kind:'independent'},()=>leaf(2));await tick();
  expect(sent).toEqual([{a:{n:2}}]);expect(ready).toEqual([2]);expect(requirements).toHaveLength(1);expect(life.nativeRequirementReady(requirements[0])).toBe(true);
  c.declare({kind:'independent'},()=>leaf(3));await tick();expect(sent).toEqual([{a:{n:2}},{a:{n:3}}]);expect(ready).toEqual([2,3]);
 }finally{off();spy.mockRestore();c.dispose();t.destroy();}
});
it('membership readiness error retains installed enrollment and drains recipient completion',async()=>{
 const t=signalTree({rows:{} as Record<string,{n:number}>});const sent:unknown[]=[];const c=link(t.$.rows,{set:v=>{sent.push(v);}});
 const prepare=life.prepareNativeRequirement;const sentinel={tag:'independent-membership-ready'};const reads:unknown[]=[];let armed=true;
 const releases:Array<()=>void>=[];
 const spy=vi.spyOn(life,'prepareNativeRequirement').mockImplementation((...args)=>{const result=prepare(...args);releases.push(life.onNativeRequirementReady(result.requirement,()=>{reads.push(t.$.rows());if(armed){armed=false;throw sentinel;}}));return result;});
 try{
  let caught:unknown;try{t.$.rows({a:{n:1}});}catch(error){caught=error;}
  expect(caught).toBe(sentinel);expect(reads.length).toBeGreaterThan(0);for(const read of reads)expect(read).toEqual({a:{n:1}});
  expect(t.$.rows()).toEqual({a:{n:1}});await tick();expect(sent).toEqual([{a:{n:1}}]);
  t.$.rows.a.n(2);await tick();expect(sent).toEqual([{a:{n:1}},{a:{n:2}}]);
 }finally{spy.mockRestore();for(const release of releases)release();c.dispose();t.destroy();}
});
