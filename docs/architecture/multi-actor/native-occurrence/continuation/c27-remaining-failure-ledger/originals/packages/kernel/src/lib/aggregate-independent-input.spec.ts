import { expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
type Receipt={read():Readonly<{state:string;reason?:string;basis?:string}>};
type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):Receipt};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<48;i++)await Promise.resolve();};
for(const mode of ['branch','root'] as const)for(const enrollment of ['before-pending','during-pending'] as const)
it(`connection-local ${mode} updater retains useful progress with second enrollment ${enrollment}`,async()=>{
 const owner=signalTree({z:0},{enhancers:[transactions()]});
 const t=signalTree({pair:{x:0,y:0},x:0,y:0},{enhancers:[transactions()]});
 const sent:unknown[]=[], otherSent:unknown[]=[];
 const c=link(mode==='branch'?t.$.pair:t.$,{set:value=>{sent.push(value);}}) as Experimental;
 let other:ReturnType<typeof link>|undefined;
 const enroll=()=>link(mode==='branch'?t.$.pair:t.$,{set:value=>{otherSent.push(value);}});
 if(enrollment==='before-pending')other=enroll();
 const p=owner.transact(()=>owner.$.z(7));
 if(enrollment==='during-pending')other=enroll();
 try{
  await flush();
  const before=p.inspect();
  let receipt:Receipt|undefined,error:unknown;
  try{receipt=c.declare({kind:'independent'},()=>{
   if(mode==='branch')t.$.pair(input=>({x:input.x+1,y:input.y}));
   else t.$(input=>({...input,x:input.x+1}));
  });}catch(e){error=e;}
  await flush();
  console.info('INPUT-ENROLLMENT',JSON.stringify({mode,enrollment,error:error?{name:(error as Error).name,message:(error as Error).message,code:Reflect.get(error as object,'code'),reason:Reflect.get(error as object,'reason')}:undefined,receipt:receipt?.read(),sent,otherSent,physical:mode==='branch'?t.$.pair():t.$(),pendingOwner:owner.$.z()}));
  expect(error).toBeUndefined();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({x:1,y:0});
  expect(receipt?.read()).toMatchObject({state:'started'});
  expect(otherSent).toEqual([]);
  expect(p.inspect()).toEqual(before);
  expect(owner.$.z()).toBe(7);
 }finally{c.dispose();other?.dispose();p.rollback();t.destroy();owner.destroy();}
});
