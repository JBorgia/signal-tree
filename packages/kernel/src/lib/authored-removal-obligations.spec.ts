import { expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { withWriteContext } from './write-context';
import { getPathNotifier } from './path-notifier';
type Receipt = { read(): Readonly<{state: string; reason?: string; basis?: string}> };
type Experimental = ReturnType<typeof link> & { declare(input: {kind:'independent'}, work:()=>unknown): Receipt };
const flush = async () => { getPathNotifier().flushSync(); for(let i=0;i<120;i++) await Promise.resolve(); };
const scalar = () => signalTree({x:0}, {enhancers:[transactions()]});
const entity = () => signalTree({rows:entityMap<{id:string;n:number},string>()}, {enhancers:[transactions()]});
const seed = async (tree:ReturnType<typeof entity>) => {
 tree.$.rows.addOne({id:'a',n:1});
 withWriteContext({participation:'inspection'},()=>tree.$.rows.addOne({id:'x',n:9}));
 await flush();
};
for (const first of ['destination','input'] as const)
it(`O-neutral removal preserves destination and possible-input roles: ${first} first`,async()=>{
 const tree=entity(); const foreign=scalar(); const late=scalar(); await seed(tree);
 const sent:unknown[]=[]; const c=link(tree.$.rows,{set:value=>{sent.push(value);}});
 try {
  const q=foreign.transact(()=>foreign.$.x(7));
  const p=tree.transact(()=>tree.$.rows.removeOne('x'));
  const r=late.transact(()=>late.$.x(9)); const pendingR=r.inspect();
  await flush(); expect(sent).toEqual([]);
  if(first==='destination')p.confirm();else q.confirm();
  await flush();expect(sent).toEqual([]);
  if(first==='destination')q.confirm();else p.confirm();
  await flush();expect(sent).toEqual([[{id:'a',n:1}]]);
  expect(r.inspect()).toEqual(pendingR); await c.settled();
 } finally {c.dispose();tree.destroy();foreign.destroy();late.destroy();}
});
it('qualified O-neutral removal progresses after destination confirmation with unrelated owner pending',async()=>{
 const tree=entity();const foreign=scalar();await seed(tree);
 const sent:unknown[]=[];const c=link(tree.$.rows,{set:value=>{sent.push(value);}}) as Experimental;
 try{
  const q=foreign.transact(()=>foreign.$.x(7));const pendingQ=q.inspect();let receipt:Receipt|undefined;
  const p=tree.transact(()=>{receipt=c.declare({kind:'independent'},()=>tree.$.rows.removeOne('x'));});
  await flush();expect(sent).toEqual([]);expect(receipt?.read()).toMatchObject({state:'held'});
  p.confirm();await flush();expect(sent).toEqual([[{id:'a',n:1}]]);
  expect(receipt?.read()).toMatchObject({state:'started',basis:'declared'});
  expect(q.inspect()).toEqual(pendingQ);await c.settled();
 }finally{c.dispose();tree.destroy();foreign.destroy();}
});
for(const disposition of ['confirm','reject'] as const)
it(`source absence after O-neutral removal retains its authored window without recipients: ${disposition}`,async()=>{
 const source=signalTree({rows:entityMap<{id:string;n:number},string>()});
 const foreign=scalar();const late=scalar();const target=signalTree({value:-1});
 withWriteContext({participation:'inspection'},()=>source.$.rows.addOne({id:'x',n:9}));await flush();
 const sent:unknown[]=[];const c=link(target.$.value,{set:value=>{sent.push(value);}}) as Experimental;
 try{
  const q=foreign.transact(()=>foreign.$.x(7));source.$.rows.removeOne('x');await flush();
  const r=late.transact(()=>late.$.x(9));const pendingR=r.inspect();
  const receipt=c.declare({kind:'independent'},()=>source.updateAndReport(input=>{
   const snapshot=input as unknown as {rows:{all:unknown[]}};
   expect(snapshot.rows.all).toEqual([]);target.$.value(snapshot.rows.all.length);return {};
  }));
  expect(receipt.read()).toMatchObject({state:'conservative',reason:'unknown'});
  await flush();expect(sent).toEqual([]);
  if(disposition==='confirm')q.confirm();else q.rollback();
  await flush();expect(sent).toEqual([0]);expect(receipt.read()).toMatchObject({state:'started',basis:'surviving'});
  expect(r.inspect()).toEqual(pendingR);await c.settled();
 }finally{c.dispose();source.destroy();target.destroy();foreign.destroy();late.destroy();}
});
