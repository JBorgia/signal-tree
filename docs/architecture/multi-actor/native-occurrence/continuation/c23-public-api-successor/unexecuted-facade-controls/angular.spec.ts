import { expect, it } from 'vitest';
import { link, signalTree, SignalTreePublicationError, type PublicationReceipt, type PublicationState } from '../index';
import { SignalTreePublicationError as KernelError } from '../../../kernel/src/index';
const flush=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
it('public declaration surface and error identity agree with the kernel',async()=>{
 const tree=signalTree({x:0});const sent:number[]=[];const c=link(tree.$.x,{set:value=>{sent.push(value);}});
 try{
  expect(SignalTreePublicationError).toBe(KernelError);
  expect(Object.keys(c).sort()).toEqual(['declare','dispose','retrieve','settled']);
  const receipt:PublicationReceipt=c.declare({kind:'independent'},()=>{tree.$.x.set(1);});await flush();await c.settled();
  const state:PublicationState=receipt.read();expect(state).toEqual({state:'started',basis:'declared'});expect(sent).toEqual([1]);
  c.dispose();let calls=0;expect(()=>c.declare({kind:'independent'},()=>{calls++;})).toThrow(SignalTreePublicationError);expect(calls).toBe(0);
 }finally{c.dispose();tree.destroy();}
});
