import {expect,it} from 'vitest';
import {link,signalTree,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<48;i++)await Promise.resolve();};
type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):{read():Readonly<{state:string;reason?:string;basis?:string}>}};
const make=()=>signalTree({x:0},{enhancers:[transactions()]});
for(const route of ['scalar','branch'] as const)it(`confirmed destination proof is settled native input: ${route}`,async()=>{
 const source=make(),target=make(),late=make();const sent:number[]=[];
 const c=link((route==='scalar'?source:target).$.x,{set:v=>{sent.push(v);}}) as Experimental;
 try{
  const p=source.transact(()=>source.$.x(7));p.confirm();await flush();sent.length=0;
  const q=late.transact(()=>late.$.x(9));const pendingQ=q.inspect();
  const work=()=>{if(route==='scalar')source.$.x(v=>v+1);else source.updateAndReport(input=>{target.$.x(input.x+1);return {};});};
  let receipt:ReturnType<typeof c.declare>|undefined;
  expect(()=>{receipt=c.declare({kind:'independent'},work);}).not.toThrow();
  await flush();expect((route==='scalar'?source:target).$.x()).toBe(8);expect(sent).toEqual([8]);
  expect(receipt?.read()).toMatchObject({state:'started',basis:'declared'});expect(q.inspect()).toEqual(pendingQ);await c.settled();
 }finally{c.dispose();source.destroy();target.destroy();late.destroy();}
});
