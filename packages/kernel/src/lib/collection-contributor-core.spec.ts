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
it('bare point preparation does not enumerate unrelated source maps',async()=>{
 const work:number[]=[];
 for(const size of [16,256]){
  const tree=make();tree.$.branch.rows.setAll(Array.from({length:size},(_,i)=>({id:String(i),x:0,y:0})));await flush();
  const row=tree.$.branch.rows.byIdOrFail('0');
  const entries=Map.prototype.entries,values=Map.prototype.values,iterator=Map.prototype[Symbol.iterator];
  let visited=0;
  const measured=(original:typeof entries)=>(function*(this:Map<unknown,unknown>){for(const item of original.call(this)){visited++;yield item;}}) as typeof entries;
  try{
   Map.prototype.entries=measured(entries);Map.prototype[Symbol.iterator]=measured(iterator);
   Map.prototype.values=(function*(this:Map<unknown,unknown>){for(const item of values.call(this)){visited++;yield item;}}) as typeof values;
   row.x(5);
  }finally{Map.prototype.entries=entries;Map.prototype.values=values;Map.prototype[Symbol.iterator]=iterator;}
  try{expect(row.x()).toBe(5);work.push(visited);}finally{tree.destroy();}
 }
 expect(work[0]).toBeGreaterThan(0);expect(work[1]).toBe(work[0]);
});
it('connection seed retains a pending native absence excluded from its positive rows',async()=>{
 const tree=make();const foreign=signalTree({x:0},{enhancers:[transactions()]});
 tree.$.branch.rows.setAll([{id:'a',x:0,y:0},{id:'removed',x:1,y:1}]);await flush();
 const q=foreign.transact(()=>foreign.$.x(7));tree.$.branch.rows.removeOne('removed');await flush();
 const sent:unknown[]=[];const c=link(tree.$.branch.rows,{set:v=>{sent.push(v);}}) as Experimental;
 try{
  const receipt=c.declare({kind:'independent'},()=>tree.$.branch.rows.updateOne('a',{y:8}));await flush();expect(sent).toEqual([]);
  q.confirm();await flush();expect(sent).toEqual([[{id:'a',x:0,y:8}]]);expect(receipt.read().state).toBe('started');await c.settled();
 }finally{c.dispose();tree.destroy();foreign.destroy();}
});
for(const equal of [false,true])it(`incoming ${equal?'equal':'full'} replacement has local support and does not certify another recipient`,async()=>{
 const tree=make();tree.$.branch.rows.addOne({id:'a',x:0,y:0});await flush();
 type Rows=Array<{id:string;x:number;y:number}>;
 let incoming!:(value:Rows)=>void;const sent:unknown[]=[],peerSent:unknown[]=[];
 const c=link(tree.$.branch.rows,{set:v=>{sent.push(v);},subscribe:next=>{incoming=next;return()=>undefined;}}) as Experimental;
 const peer=link(tree.$.branch.rows,{set:v=>{peerSent.push(v);}});
 try{
  const q=tree.transact(()=>tree.$.branch.rows.updateOne('a',{x:7}));await flush();
  const x=equal?7:10,y=equal?0:11;incoming([{id:'a',x,y}]);await flush();
  expect(sent).toEqual([]);expect(peerSent).toEqual([]);
  const before=q.inspect();const receipt=c.declare({kind:'independent'},()=>tree.$.branch.rows.updateOne('a',{y:8}));await flush();
  expect(sent).toEqual([[{id:'a',x,y:8}]]);expect(receipt.read()).toMatchObject({state:'started',basis:'declared'});
  expect(peerSent).toEqual([]);expect(q.inspect()).toEqual(before);
  q.confirm();await flush();expect(peerSent).toEqual([[{id:'a',x,y:8}]]);expect(sent).toHaveLength(1);await Promise.all([c.settled(),peer.settled()]);
 }finally{c.dispose();peer.dispose();tree.destroy();}
});
it('incoming completion cannot reseed over callback-authored newer collection truth',async()=>{
 const tree=make();tree.$.branch.rows.addOne({id:'a',x:0,y:0});await flush();
 let incoming!:(value:Array<{id:string;x:number;y:number}>)=>void;const sent:unknown[]=[];
 const c=link(tree.$.branch.rows,{set:v=>{sent.push(v);},subscribe:next=>{incoming=next;return()=>undefined;}}) as Experimental;
 let entered=false;
 const off=tree.$.branch.rows.tap({onUpdate:()=>{if(!entered){entered=true;tree.$.branch.rows.updateOne('a',{y:77});}}});
 try{
  incoming([{id:'a',x:5,y:6}]);await flush();expect(entered).toBe(true);
  expect(tree.$.branch.rows.all()).toEqual([{id:'a',x:5,y:77}]);expect(sent).toEqual([[{id:'a',x:5,y:77}]]);
  off();c.declare({kind:'independent'},()=>tree.$.branch.rows.updateOne('a',{x:8}));await flush();
  expect(sent.at(-1)).toEqual([{id:'a',x:8,y:77}]);await c.settled();
 }finally{off();c.dispose();tree.destroy();}
});
it('equal authored support replacement releases collection without a public value event',async()=>{
 const tree=make();const foreign=signalTree({x:0},{enhancers:[transactions()]});tree.$.branch.rows.addOne({id:'a',x:0,y:0});await flush();
 const sent:unknown[]=[];const c=link(tree.$.branch.rows,{set:v=>{sent.push(v);}}) as Experimental;
 try{
  const q=foreign.transact(()=>foreign.$.x(7));c.declare({kind:'dependent',owners:[q]},()=>tree.$.branch.rows.updateOne('a',{x:7}));await flush();expect(sent).toEqual([]);
  const before=q.inspect();const receipt=c.declare({kind:'independent'},()=>tree.$.branch.rows.updateOne('a',{x:7}));await flush();
  expect(sent).toEqual([[{id:'a',x:7,y:0}]]);expect(receipt.read()).toMatchObject({state:'started',basis:'declared'});expect(q.inspect()).toEqual(before);await c.settled();
 }finally{c.dispose();tree.destroy();foreign.destroy();}
});
it('native wider updater uses tree-local surviving fallback without declaring unknown recipient coverage clean',async()=>{
 const owner=signalTree({z:0},{enhancers:[transactions()]});const tree=signalTree({pair:{x:0,y:0},x:0,y:0,z:0,w:0},{enhancers:[transactions()]});
 const sent:unknown[]=[];const c=link(tree.$.pair,{set:v=>{sent.push(v);}}) as Experimental;
 try{
  const p=owner.transact(()=>owner.$.z(7));const before=p.inspect();
  const receipt=c.declare({kind:'independent'},()=>tree.$(input=>({...input,pair:{x:input.x+1,y:input.pair.y}})));
  await flush();expect(tree.$.pair()).toEqual({x:1,y:0});expect(sent).toEqual([{x:1,y:0}]);
  expect(receipt.read()).toMatchObject({state:'started',basis:'surviving'});expect(p.inspect()).toEqual(before);await c.settled();
 }finally{c.dispose();tree.destroy();owner.destroy();}
});
