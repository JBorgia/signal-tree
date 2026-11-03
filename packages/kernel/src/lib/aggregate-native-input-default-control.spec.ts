import { expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<48;i++)await Promise.resolve();};
it('default connection holds native ancestor updater result while same-tree input owner remains pending',async()=>{
 const t=signalTree({x:0,pair:{x:0,y:0}},{enhancers:[transactions()]});
 const sent:unknown[]=[];const c=link(t.$.pair,{set:value=>{sent.push(value);}});
 const p=t.transact(()=>t.$.x(7));
 try{
  await flush();const ownership=p.inspect();
  t.$(input=>({...input,pair:{x:input.x,y:input.pair.y}}));
  await flush();
  expect(t.$.pair()).toEqual({x:7,y:0});
  expect(t.$.x()).toBe(7);
  expect(p.inspect()).toEqual(ownership);
  expect(sent).toEqual([]);
 }finally{c.dispose();p.rollback();t.destroy();}
});
