import { expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';

type Receipt={read():Readonly<{state:string;basis?:string}>};
type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'}|{kind:'dependent';owners:readonly object[]},work:()=>unknown):Receipt};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
const make=()=>signalTree({branch:{rows:entityMap<{id:string;x:number;y:number},string>()}},{enhancers:[transactions()]});
for(const nested of [false,true])it(`retained q holds immediate independent sibling receipt and later sends (${nested?'nested':'collection'})`,async()=>{
 const tree=make();const foreign=signalTree({x:0},{enhancers:[transactions()]});
 tree.$.branch.rows.addOne({id:'a',x:0,y:0});await flush();
 const sent:unknown[]=[];const endpoint={set:(v:unknown)=>{sent.push(v);}};
 const c=(nested?link(tree.$.branch as never,endpoint as never):link(tree.$.branch.rows,endpoint)) as Experimental;
 try{
  const q=foreign.transact(()=>foreign.$.x(7));
  const prior=c.declare({kind:'dependent',owners:[q]},()=>tree.$.branch.rows.updateOne('a',{x:7}));await flush();
  expect(sent).toEqual([]);
  const current=c.declare({kind:'independent'},()=>tree.$.branch.rows.updateOne('a',{y:8}));
  expect(['held','validating']).toContain(current.read().state);
  await flush();expect(sent).toEqual([]);expect(current.read().state).toBe('held');expect(prior.read().state).toBe('superseded');
  q.confirm();await flush();
  expect(sent).toEqual([nested?{rows:{all:[{id:'a',x:7,y:8}]}}:[{id:'a',x:7,y:8}]]);
  expect(current.read()).toMatchObject({state:'started'});await c.settled();
 }finally{c.dispose();tree.destroy();foreign.destroy();}
});
it('pending native seed remains a contributor after independent sibling edit',async()=>{
 const tree=make();tree.$.branch.rows.addOne({id:'a',x:0,y:0});await flush();
 const q=tree.transact(()=>tree.$.branch.rows.updateOne('a',{x:7}));
 const sent:unknown[]=[];const c=link(tree.$.branch.rows,{set:v=>{sent.push(v);}}) as Experimental;
 try{
  const receipt=c.declare({kind:'independent'},()=>tree.$.branch.rows.updateOne('a',{y:8}));await flush();expect(sent).toEqual([]);
  q.confirm();await flush();expect(sent).toEqual([[{id:'a',x:7,y:8}]]);expect(receipt.read().state).toBe('started');await c.settled();
 }finally{c.dispose();tree.destroy();}
});
it('pure order under independent declaration completes a receipt with useful ordered payload',async()=>{
 const tree=make();const foreign=signalTree({x:0},{enhancers:[transactions()]});
 const a={id:'a',x:1,y:2},b={id:'b',x:3,y:4};tree.$.branch.rows.setAll([a,b]);await flush();
 const sent:unknown[]=[];const c=link(tree.$.branch.rows,{set:v=>{sent.push(v);}}) as Experimental;
 try{
  const q=foreign.transact(()=>foreign.$.x(9));const before=q.inspect();
  const receipt=c.declare({kind:'independent'},()=>tree.$.branch.rows.setAll([b,a]));await flush();
  expect(sent).toEqual([[b,a]]);expect(receipt.read().state).toBe('started');expect(q.inspect()).toEqual(before);await c.settled();
 }finally{c.dispose();tree.destroy();foreign.destroy();}
});
