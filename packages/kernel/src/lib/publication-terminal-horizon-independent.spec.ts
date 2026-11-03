import {expect,it} from 'vitest';
import {link,signalTree,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
type Receipt={read():Readonly<{state:string;reason?:string;basis?:string}>};
type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'}|{kind:'dependent';owners:readonly object[]},work:()=>unknown):Receipt};
const make=()=>signalTree({x:0},{enhancers:[transactions()]});
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<48;i++)await Promise.resolve();};
it('confirmed input survives a second consumption after intermediate recipient disposal',async()=>{
 const owner=make(),middle=make(),target=make(),late=make();const sent:number[]=[];
 const first=link(middle.$.x,{set:()=>{/* The intermediate endpoint is not the observed output. */}}) as Experimental;
 const c=link(target.$.x,{set:v=>{sent.push(v);}}) as Experimental;
 try{
  const p=owner.transact(()=>owner.$.x(7));
  const original=first.declare({kind:'dependent',owners:[p]},()=>owner.updateAndReport(input=>{middle.$.x(input.x+1);return {};}));
  await flush();expect(middle.$.x()).toBe(8);expect(original.read()).toMatchObject({state:'held'});
  p.confirm();await flush();expect(original.read()).toMatchObject({state:'started',basis:'declared'});first.dispose();
  const q=late.transact(()=>late.$.x(11));const pendingQ=q.inspect();
  const receipt=c.declare({kind:'independent'},()=>middle.updateAndReport(input=>{target.$.x(input.x+1);return {};}));
  await flush();expect(sent).toEqual([9]);expect(receipt.read()).toMatchObject({state:'started',basis:'declared'});
  expect(original.read()).toMatchObject({state:'started',basis:'declared'});expect(q.inspect()).toEqual(pendingQ);await c.settled();
 }finally{first.dispose();c.dispose();owner.destroy();middle.destroy();target.destroy();late.destroy();}
});
it('later source horizon validation failure reaches an already consumed native input',async()=>{
 const source=make(),target=make(),late=make();const sent:number[]=[];
 const first=link(source.$.x,{set:()=>{/* The intermediate endpoint is not the observed output. */}}) as Experimental;
 const c=link(target.$.x,{set:v=>{sent.push(v);}}) as Experimental;
 let receipt:Receipt|undefined;
 try{
  const q=late.transact(()=>late.$.x(11));const pendingQ=q.inspect();
  expect(()=>first.declare({kind:'independent'},()=>{
   source.$.x(7);
   receipt=c.declare({kind:'independent'},()=>source.updateAndReport(input=>{target.$.x(input.x+1);return {};}));
   expect(receipt.read()).toMatchObject({state:'validating'});
   return {get then(){throw new Error('source horizon fails after native consumption');}};
  })).toThrow(expect.objectContaining({stage:'after-callback',reason:'validation-threw'}));
  expect(source.$.x()).toBe(7);expect(target.$.x()).toBe(8);
  expect(receipt?.read()).toMatchObject({state:'conservative',reason:'invalid-declaration'});
  await flush();expect(sent).toEqual([]);expect(q.inspect()).toEqual(pendingQ);
  q.confirm();await flush();expect(sent).toEqual([8]);expect(receipt?.read()).toMatchObject({state:'started',basis:'surviving'});await c.settled();
 }finally{first.dispose();c.dispose();source.destroy();target.destroy();late.destroy();}
});
