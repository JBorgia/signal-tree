from pathlib import Path
p=Path(__file__).resolve().parent
common='''import {expect,it} from 'vitest';
IMPORTS
// PRIVATE experimental capability cast, NOT proposed/shipping facade typing.
type Receipt={read():Readonly<{state:string;basis?:string;reason?:string}>};
type Declared=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):Receipt};
function declared(c:ReturnType<typeof link>):Declared{expect(typeof Reflect.get(c,'declare')).toBe('function');return c as Declared;}
const drain=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
STEP
async function setup(){
 SETUP
 const owner=signalTree({z:0},{enhancers:[transactions()]});
 const sent:unknown[]=[];const c=declared(link(source,{set:value=>{sent.push(value);}}));
 MOUNT
 return {tree,source,owner,sent,c,ui,unmount};
}
const value=(x:number)=>VALUE;
for(const owned of [false,true])for(const terminal of ['confirm','rollback'] as const)
it(`LABEL equal whole ${owned?'actual-owner':'unowned'} / ${terminal}`,async()=>{
 const {tree,source,owner,sent,c,ui,unmount}=await setup();
 let receipt:Receipt|undefined;let release=()=>{};let notifications=0;
 let pending!:ReturnType<typeof owner.transact>;
 try{
  await step(()=>{pending=owned?tree.transact(()=>source.x(7)):owner.transact(()=>owner.$.z(7));if(!owned)source.x(7);});
  expect(source()).toEqual(value(7));expect(ui()).toBe(7);expect(sent).toEqual([]);
  const before=pending.inspect();release=source.x.subscribe(()=>{notifications++;});
  await step(()=>{receipt=c.declare({kind:'independent'},()=>source(value(7)));});
  expect(source()).toEqual(value(7));expect(ui()).toBe(7);expect(notifications).toBe(0);expect(pending.inspect()).toEqual(before);expect(owned?source.x():owner.$.z()).toBe(7);
  if(!receipt)throw Error('missing receipt');
  expect(Object.isFrozen(receipt)).toBe(true);expect(Object.isFrozen(receipt.read())).toBe(true);
  if(owned){expect(sent).toEqual([]);expect(['held','conservative']).toContain(receipt.read().state);}else{expect(sent).toEqual([value(7)]);expect(receipt.read().state).toBe('started');}
  const initialStatus=receipt.read();let settled=false;const wait=c.settled().then(()=>{settled=true;});await step(()=>{});expect(settled).toBe(!owned);
  await step(()=>pending[terminal]());
  const final=owned&&terminal==='rollback'?0:7;
  expect(source()).toEqual(value(final));expect(ui()).toBe(final);expect(sent).toEqual([value(final)]);expect(settled).toBe(true);await wait;
  expect(receipt.read().state).toBe('started');if(!owned)expect(receipt.read()).toEqual(initialStatus);
  const terminalStatus=receipt.read();expect(Reflect.set(terminalStatus,'state','forged')).toBe(false);
  c.dispose();
  LIFETIME
  await step(()=>{});expect(receipt.read()).toEqual(terminalStatus);expect(sent).toEqual([value(final)]);
 }finally{
  console.info('DECLARATION-QUALIFICATION',JSON.stringify({case:`LABEL/${owned}/${terminal}`,sent,receipt:receipt?.read(),physical:source(),notifications}));
  release();c.dispose();unmount();tree.destroy();owner.destroy();
 }
});
it('LABEL no-write receipt and declaration after disposal',async()=>{
 const {tree,source,owner,sent,c,unmount}=await setup();
 try{
  const receipt=c.declare({kind:'independent'},()=>{});expect(receipt.read()).toEqual({state:'no-write'});expect(Object.isFrozen(receipt)).toBe(true);expect(Object.isFrozen(receipt.read())).toBe(true);
  c.dispose();let calls=0;let thrown:unknown;
  try{c.declare({kind:'independent'},()=>{calls++;source(value(9));});}catch(e){thrown=e;}
  expect(thrown).toMatchObject({code:'SIGNALTREE_PUBLICATION_DECLARATION_INVALID',stage:'before-callback',reason:'disposed'});
  expect(calls).toBe(0);await step(()=>{});expect(source()).toEqual(value(0));expect(sent).toEqual([]);expect(receipt.read()).toEqual({state:'no-write'});
 }finally{c.dispose();unmount();tree.destroy();owner.destroy();}
});
it('LABEL disposed held receipt releases waiter without settling owner',async()=>{
 const {tree,source,owner,sent,c,unmount}=await setup();let receipt:Receipt|undefined;
 try{
  let pending!:ReturnType<typeof tree.transact>;await step(()=>{pending=tree.transact(()=>source.x(7));});const before=pending.inspect();
  await step(()=>{receipt=c.declare({kind:'independent'},()=>source(value(7)));});
  expect(sent).toEqual([]);if(!receipt)throw Error('missing receipt');expect(['held','conservative']).toContain(receipt.read().state);
  let settled=false;const wait=c.settled().then(()=>{settled=true;});await step(()=>{});expect(settled).toBe(false);
  c.dispose();await step(()=>{});expect(settled).toBe(true);await wait;expect(receipt.read()).toEqual({state:'disposed'});expect(pending.inspect()).toEqual(before);expect(source.x()).toBe(7);
  await step(()=>pending.rollback());expect(source()).toEqual(value(0));expect(sent).toEqual([]);expect(receipt.read()).toEqual({state:'disposed'});
 }finally{console.info('DECLARATION-QUALIFICATION',JSON.stringify({case:'LABEL/held-dispose',sent,receipt:receipt?.read()}));c.dispose();unmount();tree.destroy();owner.destroy();}
});
'''
variants={
'kernel':dict(IMPORTS="import {entityMap,link,signalTree,transactions} from '../index';",STEP='const step=async(work:()=>void)=>{work();await drain();};',SETUP="const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});await step(()=>tree.$.rows.addOne({id:'a',x:0}));const source=tree.$.rows.byIdOrFail('a');",MOUNT='const ui=()=>source.x();const unmount=()=>{};',VALUE="({id:'a',x})",LABEL='direct row',LIFETIME="await step(()=>{tree.$.rows.removeOne('a');tree.$.rows.addOne({id:'a',x:99});});expect(tree.$.rows.byIdOrFail('a')).not.toBe(source);expect(source()).toBeUndefined();"),
'react':dict(IMPORTS="import {link,signalTree,transactions,useSignalTree} from './index';\nimport {act,renderHook} from '@testing-library/react';",STEP='const step=async(work:()=>void)=>{await act(async()=>{work();await drain();});};',SETUP='const tree=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const source=tree.$.pair;',MOUNT='const hook=renderHook(()=>useSignalTree(tree,$=>$.pair.x()));const ui=()=>hook.result.current;const unmount=()=>hook.unmount();',VALUE='({x,y:0})',LABEL='React branch',LIFETIME='await step(()=>source.x(99));expect(ui()).toBe(99);')}
for target,parts in variants.items():
 text=common
 for k,v in parts.items():text=text.replace(k,v)
 file=p/'candidate'/('packages/kernel/src/lib/direct-row-declaration-qualification.spec.ts' if target=='kernel' else 'packages/react/src/branch-declaration-qualification.spec.tsx')
 file.write_text(text)
