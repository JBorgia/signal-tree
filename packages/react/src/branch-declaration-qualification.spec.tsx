import {expect,it} from 'vitest';
import {link,signalTree,transactions,useSignalTree} from './index';
import {act,renderHook} from '@testing-library/react';
// PRIVATE experimental capability cast, NOT proposed/shipping facade typing.
type Receipt={read():Readonly<{state:string;basis?:string;reason?:string}>};
type Declared=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):Receipt};
function declared(c:ReturnType<typeof link>):Declared{expect(typeof Reflect.get(c,'declare')).toBe('function');return c as Declared;}
const drain=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
const step=async(work:()=>void)=>{await act(async()=>{work();await drain();});};
async function setup(){
 const tree=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const source=tree.$.pair;
 const owner=signalTree({z:0},{enhancers:[transactions()]});
 const sent:unknown[]=[];const c=declared(link(source,{set:value=>{sent.push(value);}}));
 const hook=renderHook(()=>useSignalTree(tree,$=>$.pair.x()));const ui=()=>hook.result.current;const unmount=()=>hook.unmount();
 return {tree,source,owner,sent,c,ui,unmount};
}
const value=(x:number)=>({x,y:0});
for(const owned of [false,true])for(const terminal of ['confirm','rollback'] as const)
it(`React branch equal whole ${owned?'actual-owner':'unowned'} / ${terminal}`,async()=>{
 const {tree,source,owner,sent,c,ui,unmount}=await setup();
 let receipt:Receipt|undefined;let release=()=>{ /* This fixture observes state and delivery separately; this callback intentionally does no work. */ };let notifications=0;
 let pending!:ReturnType<typeof owner.transact>;
 try{
  await step(()=>{pending=owned?tree.transact(()=>source.x(7)):owner.transact(()=>owner.$.z(7));if(!owned)source.x(7);});
  expect(source()).toEqual(value(7));expect(ui()).toBe(7);expect(sent).toEqual([]);
  const before=pending.inspect();release=source.x.subscribe(()=>{notifications++;});
  await step(()=>{receipt=c.declare({kind:'independent'},()=>source(value(7)));});
  expect(source()).toEqual(value(7));expect(ui()).toBe(7);expect(notifications).toBe(0);expect(pending.inspect()).toEqual(before);expect(owned?source.x():owner.$.z()).toBe(7);
  if(!receipt)throw Error('missing receipt');
  expect(Object.isFrozen(receipt)).toBe(true);expect(Object.isFrozen(receipt.read())).toBe(true);
  if(owned){expect(sent).toEqual([]);expect(receipt.read()).toEqual({state:'no-write'});}else{expect(sent).toEqual([value(7)]);expect(receipt.read().state).toBe('started');}
  const initialStatus=receipt.read();let settled=false;const wait=c.settled().then(()=>{settled=true;});await step(()=>{ /* This fixture observes state and delivery separately; this callback intentionally does no work. */ });expect(settled).toBe(!owned);
  await step(()=>pending[terminal]());
  const final=owned&&terminal==='rollback'?0:7;
  expect(source()).toEqual(value(final));expect(ui()).toBe(final);expect(sent).toEqual([value(final)]);expect(settled).toBe(true);await wait;
  expect(receipt.read().state).toBe(owned?'no-write':'started');expect(receipt.read()).toEqual(initialStatus);
  const terminalStatus=receipt.read();expect(Reflect.set(terminalStatus,'state','forged')).toBe(false);
  c.dispose();
  await step(()=>source.x(99));expect(ui()).toBe(99);
  await step(()=>{ /* This fixture observes state and delivery separately; this callback intentionally does no work. */ });expect(receipt.read()).toEqual(terminalStatus);expect(sent).toEqual([value(final)]);
 }finally{
  console.info('DECLARATION-QUALIFICATION',JSON.stringify({case:`React branch/${owned}/${terminal}`,sent,receipt:receipt?.read(),physical:source(),notifications}));
  release();c.dispose();unmount();tree.destroy();owner.destroy();
 }
});
it('React branch no-write receipt and declaration after disposal',async()=>{
 const {tree,source,owner,sent,c,unmount}=await setup();
 try{
  const receipt=c.declare({kind:'independent'},()=>{ /* This fixture observes state and delivery separately; this callback intentionally does no work. */ });expect(receipt.read()).toEqual({state:'no-write'});expect(Object.isFrozen(receipt)).toBe(true);expect(Object.isFrozen(receipt.read())).toBe(true);
  c.dispose();let calls=0;let thrown:unknown;
  try{c.declare({kind:'independent'},()=>{calls++;source(value(9));});}catch(e){thrown=e;}
  expect(thrown).toMatchObject({code:'SIGNALTREE_PUBLICATION_DECLARATION_INVALID',stage:'before-callback',reason:'disposed'});
  expect(calls).toBe(0);await step(()=>{ /* This fixture observes state and delivery separately; this callback intentionally does no work. */ });expect(source()).toEqual(value(0));expect(sent).toEqual([]);expect(receipt.read()).toEqual({state:'no-write'});
 }finally{c.dispose();unmount();tree.destroy();owner.destroy();}
});
it('React branch no-write receipt retains older pending work until disposal',async()=>{
 const {tree,source,owner,sent,c,unmount}=await setup();let receipt:Receipt|undefined;
 try{
  let pending!:ReturnType<typeof tree.transact>;await step(()=>{pending=tree.transact(()=>source.x(7));});const before=pending.inspect();
  await step(()=>{receipt=c.declare({kind:'independent'},()=>source(value(7)));});
  expect(sent).toEqual([]);if(!receipt)throw Error('missing receipt');expect(receipt.read()).toEqual({state:'no-write'});
  let settled=false;const wait=c.settled().then(()=>{settled=true;});await step(()=>{ /* This fixture observes state and delivery separately; this callback intentionally does no work. */ });expect(settled).toBe(false);
  c.dispose();await step(()=>{ /* This fixture observes state and delivery separately; this callback intentionally does no work. */ });expect(settled).toBe(true);await wait;expect(receipt.read()).toEqual({state:'no-write'});expect(pending.inspect()).toEqual(before);expect(source.x()).toBe(7);
  await step(()=>pending.rollback());expect(source()).toEqual(value(0));expect(sent).toEqual([]);expect(receipt.read()).toEqual({state:'no-write'});
 }finally{console.info('DECLARATION-QUALIFICATION',JSON.stringify({case:'React branch/no-write-dispose',sent,receipt:receipt?.read()}));c.dispose();unmount();tree.destroy();owner.destroy();}
});
it('React genuinely authored dependent branch receipt disposes while native UI stays current',async()=>{
 const tree=signalTree({pair:{x:0,y:0},z:0},{enhancers:[transactions()]});const sent:unknown[]=[];
 const c=link(tree.$.pair,{set:v=>{sent.push(v);}});const hook=renderHook(()=>useSignalTree(tree,$=>$.pair.x()));
 try{
  let p!:ReturnType<typeof tree.transact>;await step(()=>{p=tree.transact(()=>tree.$.z(7));});const before=p.inspect();
  let calls=0;let receipt:ReturnType<typeof c.declare>|undefined;
  await step(()=>{receipt=c.declare({kind:'dependent',owners:[p]},()=>{calls++;tree.$.pair({x:tree.$.z(),y:0});});});
  if(!receipt)throw Error('missing authored receipt');
  expect(calls).toBe(1);expect(tree.$()).toEqual({pair:value(7),z:7});expect(hook.result.current).toBe(7);expect(p.inspect()).toEqual(before);expect(sent).toEqual([]);
  const held=receipt.read();expect(held).toEqual({state:'held',reason:'pending-dependency'});expect(Object.isFrozen(receipt)).toBe(true);expect(Object.isFrozen(held)).toBe(true);
  let settled=false;const wait=c.settled().then(()=>{settled=true;});await step(()=>{ /* This fixture observes state and delivery separately; this callback intentionally does no work. */ });expect(settled).toBe(false);
  c.dispose();await step(()=>{ /* This fixture observes state and delivery separately; this callback intentionally does no work. */ });await wait;expect(settled).toBe(true);expect(receipt.read()).toEqual({state:'disposed'});expect(Object.isFrozen(receipt.read())).toBe(true);
  expect(held).toEqual({state:'held',reason:'pending-dependency'});expect(p.inspect()).toEqual(before);expect(tree.$()).toEqual({pair:value(7),z:7});expect(hook.result.current).toBe(7);expect(sent).toEqual([]);
  await step(()=>p.rollback());expect(tree.$()).toEqual({pair:value(7),z:0});expect(hook.result.current).toBe(7);expect(sent).toEqual([]);expect(receipt.read()).toEqual({state:'disposed'});
  await step(()=>tree.$.pair.x(9));expect(hook.result.current).toBe(9);await step(()=>{ /* This fixture observes state and delivery separately; this callback intentionally does no work. */ });expect(sent).toEqual([]);expect(receipt.read()).toEqual({state:'disposed'});
 }finally{c.dispose();hook.unmount();tree.destroy();}
});
