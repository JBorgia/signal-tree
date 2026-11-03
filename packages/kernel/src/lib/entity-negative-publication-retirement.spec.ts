// Prewritten retirement discriminator: lack of restoration authority does not
// discharge another tree's live publication obligation.
import {expect,it} from 'vitest';
import {entityMap,link,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getPathNotifier} from './path-notifier';
type Receipt={read():Readonly<{state:string;reason?:string;basis?:string}>};
type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):Receipt};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
for(const disposition of ['confirm','reject'] as const)
it(`bare negative membership retains captured foreign obligation until ${disposition}`,async()=>{
 const source=signalTree({rows:entityMap<{id:string;n:number},string>()});
 const owner=signalTree({x:0},{enhancers:[transactions()]});
 const late=signalTree({x:0},{enhancers:[transactions()]});const target=signalTree({value:-1});
 source.$.rows.addOne({id:'a',n:1});await flush();const held=source.$.rows.byIdOrFail('a');
 const sent:unknown[]=[];const c=link(target.$.value,{set:value=>{sent.push(value);}}) as Experimental;
 try{
  const q=owner.transact(()=>owner.$.x(7));source.$.rows.removeOne('a');await flush();
  const sourceBinding=getEntityPublicationBinding(source.$.rows);if(!sourceBinding)throw Error('Missing native source evidence');
  expect(sourceBinding.source.inspect()['negativePresence']).toBeGreaterThan(0);
  const r=late.transact(()=>late.$.x(9));const pendingR=r.inspect();
  const receipt=c.declare({kind:'independent'},()=>{
   source.updateAndReport(input=>{
    const snapshot=input as unknown as {rows:{all:unknown[]}};
    expect(snapshot.rows.all).toEqual([]);target.$.value(snapshot.rows.all.length);return {};
   });
  });
  expect(receipt.read()).toMatchObject({state:'conservative',reason:'unknown'});
  await flush();expect(sent).toEqual([]);expect(held()).toBeUndefined();
  if(disposition==='confirm')q.confirm();else q.rollback();
  await flush();expect(sent).toEqual([0]);expect(receipt.read()).toMatchObject({state:'started',basis:'surviving'});
  expect(r.inspect()).toEqual(pendingR);expect(source.$.rows.all()).toEqual([]);await c.settled();
  expect(sourceBinding.source.inspect()['negativePresence']).toBe(0);
 }finally{c.dispose();target.destroy();source.destroy();owner.destroy();late.destroy();}
});
