import { expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
type Receipt = { read(): Readonly<{state:string;reason?:string;basis?:string}> };
type Experimental = ReturnType<typeof link> & {
 declare(input:{kind:'independent'}|{kind:'dependent';owners:readonly object[]},work:()=>unknown):Receipt;
};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<48;i++)await Promise.resolve();};
for(const claim of ['independent','dependent'] as const)
it(`native omitted-member updater input retains its authored dependency: ${claim}`,async()=>{
 const owner=signalTree({z:0},{enhancers:[transactions()]});
 const source=signalTree({pair:{x:7,y:0} as {x?:number;y:number}});
 const target=signalTree({value:-1});
 const old=link(source.$.pair,{set:()=>{}}) as Experimental;
 const sent:unknown[]=[];
 const c=link(target.$.value,{set:value=>{sent.push(value);}}) as Experimental;
 const p=owner.transact(()=>owner.$.z(7));
 try{
  old.declare({kind:'dependent',owners:[p]},()=>source.$.pair({y:0}));
  await flush();expect(source.$.pair()).toEqual({y:0});old.dispose();
  let error:unknown;let receipt:Receipt|undefined;
  try{
   receipt=c.declare(claim==='independent'?{kind:claim}:{kind:claim,owners:[p]},()=>{
    source.$.pair(input=>{target.$.value(Object.prototype.hasOwnProperty.call(input,'x')?1:0);return input;});
   });
  }catch(e){error=e;}
  await flush();
  console.info('OMISSION-INPUT',JSON.stringify({claim,error:error instanceof Error?{message:error.message,stage:(error as {stage?:unknown}).stage,reason:(error as {reason?:unknown}).reason}:error,sent,target:target.$.value(),receipt:receipt?.read(),source:source.$.pair()}));
  expect(target.$.value()).toBe(0);
  expect(sent).toEqual([]);
  if(claim==='independent')expect(error).toMatchObject({stage:'after-callback',reason:'contradiction'});
  else{
   expect(error).toBeUndefined();expect(receipt?.read()).toMatchObject({state:'held',reason:'pending-dependency'});
   p.confirm();await flush();expect(sent).toEqual([0]);
  }
 }finally{old.dispose();c.dispose();owner.destroy();source.destroy();target.destroy();}
});
