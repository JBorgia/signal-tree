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
  // Approved 247cfec7 contradiction contract: installed writes remain, no receipt returns.
  let error:unknown;let returned=false;
  try{c.declare({kind:'independent'},()=>t.$(input=>({...input,pair:{x:input.x,y:input.pair.y}})));returned=true;}catch(e){error=e;}
  expect(returned).toBe(false);
  expect(error).toMatchObject({code:'SIGNALTREE_PUBLICATION_DECLARATION_INVALID',stage:'after-callback',reason:'contradiction'});
  await flush();
  expect(t.$.pair()).toEqual({x:7,y:0});
  expect(t.$.x()).toBe(7);
  expect(p.inspect()).toEqual(ownership);
  expect(sent).toEqual([]);
 }finally{c.dispose();p.rollback();t.destroy();}
});
