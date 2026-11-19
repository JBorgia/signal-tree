import {expect,it} from 'vitest';
import {entityMap,link,signalTree,transactions} from '/private/tmp/st-c23-row-react-declaration-qualification/candidate/packages/kernel/src/index';
// PRIVATE experimental capability cast, NOT proposed/shipping facade typing.
type Receipt={read():Readonly<{state:string;basis?:string;reason?:string}>};
type Declared=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):Receipt};
function declared(c:ReturnType<typeof link>):Declared{expect(typeof Reflect.get(c,'declare')).toBe('function');return c as Declared;}
const drain=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
const step=async(work:()=>void)=>{work();await drain();};
async function setup(){
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});await step(()=>tree.$.rows.addOne({id:'a',x:0}));const source=tree.$.rows.byIdOrFail('a');
 const owner=signalTree({z:0},{enhancers:[transactions()]});
 const sent:unknown[]=[];const c=declared(link(source,{set:value=>{sent.push(value);}}));
 const ui=()=>source.x();const unmount=()=>{};
 return {tree,source,owner,sent,c,ui,unmount};
}
const value=(x:number)=>({id:'a',x});
for(const owned of [true])for(const terminal of ['rollback'] as const)
it(`direct row equal whole ${owned?'actual-owner':'unowned'} / ${terminal}`,async()=>{
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
  expect(receipt.read().state).toBe('superseded');if(!owned)expect(receipt.read()).toEqual(initialStatus);
  const terminalStatus=receipt.read();expect(Reflect.set(terminalStatus,'state','forged')).toBe(false);
  c.dispose();
  await step(()=>{tree.$.rows.removeOne('a');tree.$.rows.addOne({id:'a',x:99});});expect(tree.$.rows.byIdOrFail('a')).not.toBe(source);expect(source()).toBeUndefined();
  await step(()=>{});expect(receipt.read()).toEqual(terminalStatus);expect(sent).toEqual([value(final)]);
 }finally{
  console.info('DECLARATION-QUALIFICATION',JSON.stringify({case:`direct row/${owned}/${terminal}`,sent,receipt:receipt?.read(),physical:source(),notifications}));
  release();c.dispose();unmount();tree.destroy();owner.destroy();
 }
});
