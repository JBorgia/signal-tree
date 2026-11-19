// Prewritten P/O input-view controls for the entity integration.
import { expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import { withWriteContext } from './write-context';
type Receipt = { read(): Readonly<{state: string; reason?: string; basis?: string}> };
type Experimental = ReturnType<typeof link> & {declare(input: {kind: 'independent'}, work: () => unknown): Receipt};
const flush = async () => {getPathNotifier().flushSync(); for(let i=0;i<120;i++) await Promise.resolve();};
for(const port of ['field','row','root'] as const)
it(`inspection input is not certified by ordinary proof: ${port}`,async()=>{
 const source=signalTree({rows:entityMap<{id:string;n:number},string>()},{enhancers:[transactions()]});
 const target=signalTree({value:0});const late=signalTree({x:0},{enhancers:[transactions()]});
 source.$.rows.addOne({id:'a',n:1});await flush();
 const sent:number[]=[];const c=link(target.$.value,{set:value=>{sent.push(value);}}) as Experimental;
 try{
  const p=source.transact(()=>source.$.rows.updateOne('a',{n:7}));
  withWriteContext({participation:'inspection'},()=>source.$.rows.updateOne('a',{n:99}));
  await flush();
  let calls=0;
  const receipt=c.declare({kind:'independent'},()=>{
   const row=source.$.rows.byIdOrFail('a');
   const consume=(n:number)=>{calls++;expect(n).toBe(99);target.$.value(n);};
   if(port==='field')row.n(n=>{consume(n);return n;});
   else if(port==='row')row(value=>{consume(value.n);return value;});
   else source.$(value=>{
    const snapshot=value as unknown as {rows:{all:{id:string;n:number}[]}};
    expect(snapshot.rows.all).toEqual([{id:'a',n:99}]);consume(snapshot.rows.all[0].n);return value;
   });
  });
  expect(calls).toBe(1);expect(receipt.read()).toMatchObject({state:'conservative',reason:'unknown'});
  const q=late.transact(()=>late.$.x(9));const pendingQ=q.inspect();
  await flush();expect(sent).toEqual([]);
  p.confirm();await flush();expect(sent).toEqual([99]);
  expect(receipt.read()).toMatchObject({state:'started',basis:'surviving'});
  expect(q.inspect()).toEqual(pendingQ);await c.settled();
 }finally{c.dispose();target.destroy();source.destroy();late.destroy();}
});
