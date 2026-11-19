import {expect,it} from 'vitest';
import {signalTree,link,transactions} from '../index';
import {preparePublicationMutations} from './internals/intrinsic-mutation';
import * as life from './experimental-publication/lifecycle';
import {getPathNotifier} from './path-notifier';
it('ordinary public setter activates installed requirement and delivers without declaration',async()=>{
 const t=signalTree({n:0},{enhancers:[transactions()]});const sent:number[]=[];const seen:number[]=[];const requirements:life.NativeRequirement[]=[];
 const c=link(t.$.n,{set:v=>{sent.push(v);}});
 const off=preparePublicationMutations(t.$.n,(_m,_input,native)=>{
  const r=(native as {requirement:life.NativeRequirement}).requirement;
  expect(r).toBeDefined();expect(life.nativeRequirementReady(r)).toBe(false);requirements.push(r);
  life.onNativeRequirementReady(r,()=>seen.push(t.$.n()));return undefined;
 },()=>{});
 expect(off).toBeTypeOf('function');
 try{
  t.$.n(1);expect(requirements).toHaveLength(1);expect(seen).toEqual([1]);expect(life.nativeRequirementReady(requirements[0])).toBe(true);
  getPathNotifier().flushSync();for(let i=0;i<20;i++)await Promise.resolve();await c.settled();expect(sent).toEqual([1]);
 }finally{off!();c.dispose();t.destroy();}
});
