import { expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
type Receipt = {read(): Readonly<{state:string;reason?:string;basis?:string}>};
type Experimental = ReturnType<typeof link> & {declare(input:{kind:'independent'}, work:()=>unknown):Receipt};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<48;i++)await Promise.resolve();};
it('native ancestor updater cannot publish pending sibling input through a descendant relationship',async()=>{
 const t=signalTree({x:0,pair:{x:0,y:0}},{enhancers:[transactions()]});
 const sent:unknown[]=[];
 const c=link(t.$.pair,{set:value=>{sent.push(value);}}) as Experimental;
 const p=t.transact(()=>t.$.x(7));
 try{
  await flush();const ownership=p.inspect();
  const receipt=c.declare({kind:'independent'},()=>t.$(input=>({...input,pair:{x:input.x,y:input.pair.y}})));
  await flush();
  console.info('NATIVE-INPUT',JSON.stringify({sent,receipt:receipt.read(),rootX:t.$.x(),pair:t.$.pair(),ownershipSame:JSON.stringify(p.inspect())===JSON.stringify(ownership)}));
  expect(t.$.pair()).toEqual({x:7,y:0});
  expect(t.$.x()).toBe(7);
  expect(p.inspect()).toEqual(ownership);
  expect(sent).toEqual([]);
  expect(receipt.read()).toMatchObject({state:'conservative',reason:'unknown'});
 }finally{c.dispose();p.rollback();t.destroy();}
});
