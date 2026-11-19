import { expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
type Receipt = {read():Readonly<{state:string;reason?:string;basis?:string}>};
type Experimental = ReturnType<typeof link> & {declare(input:{kind:'independent'},work:()=>unknown):Receipt};
const flush = async () => {getPathNotifier().flushSync();for(let i=0;i<48;i++)await Promise.resolve();};
const variants = ['none','before-pending','during-pending','dispose-before','dispose-in-updater','enroll-in-updater','dispose-in-validation','dispose-after-declaration'] as const;
for(const mode of ['branch','root'] as const)for(const variant of variants)
it(`enrollment invariance ${mode}: ${variant}`,async()=>{
 const owner=signalTree({z:0},{enhancers:[transactions()]});
 const t=signalTree({pair:{x:0,y:0},x:0,y:0},{enhancers:[transactions()]});
 const sent:unknown[]=[],otherSent:unknown[]=[];
 const source=mode==='branch'?t.$.pair:t.$;
 const c=link(source,{set:v=>{sent.push(v);}}) as Experimental;
 let other:ReturnType<typeof link>|undefined;
 const enroll=()=>{other=link(source,{set:v=>{otherSent.push(v);}});};
 if(variant==='before-pending')enroll();
 const p=owner.transact(()=>owner.$.z(7));
 if(['during-pending','dispose-before','dispose-in-updater','dispose-in-validation','dispose-after-declaration'].includes(variant))enroll();
 if(variant==='dispose-before')other?.dispose();
 try{
  await flush();const before=p.inspect();
  const inside=()=>{if(variant==='dispose-in-updater')other?.dispose();if(variant==='enroll-in-updater')enroll();};
  const receipt=c.declare({kind:'independent'},()=>{
   if(mode==='branch')t.$.pair(input=>{inside();return {x:input.x+1,y:input.y};});
   else t.$(input=>{inside();return {...input,x:input.x+1};});
   if(variant==='dispose-in-validation')return {get then(){other?.dispose();return undefined;}};
   return undefined;
  });
  if(variant==='dispose-after-declaration')other?.dispose();
  await flush();
  expect(mode==='branch'?t.$.pair.x():t.$.x()).toBe(1);
  expect(sent).toHaveLength(1);expect(sent[0]).toMatchObject({x:1,y:0});
  expect(receipt.read()).toMatchObject({state:'started',basis:'declared'});
  expect(otherSent).toEqual([]);expect(p.inspect()).toEqual(before);expect(owner.$.z()).toBe(7);
 }finally{c.dispose();other?.dispose();p.rollback();t.destroy();owner.destroy();}
});
