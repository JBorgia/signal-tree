import { expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import * as life from './experimental-publication/lifecycle';
import { installTerminalRecord } from './internals/intrinsic-mutation';
import { RecipientOccurrences } from './experimental-publication/recipient-occurrence';

type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'}|{kind:'dependent';owners:readonly object[]},work:()=>unknown):{read():{state:string}}};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
const asLink=(source:object,sent:unknown[])=>link(source as never,{set:(v:unknown)=>{sent.push(v);}} as never) as Experimental;

it('omission prunes selected nested support but not q consumed into surviving y',async()=>{
 const tree=signalTree({branch:{x:0},y:0},{enhancers:[transactions()]});
 const owner=signalTree({z:0},{enhancers:[transactions()]});const sent:unknown[]=[];const c=asLink(tree.$,sent);
 const q=owner.transact(()=>owner.$.z(7));
 try{
  c.declare({kind:'dependent',owners:[q]},()=>tree.$.branch.x(7));await flush();expect(sent).toEqual([]);
  c.declare({kind:'dependent',owners:[q]},()=>tree.$(value=>({y:value.branch.x} as typeof value)));await flush();
  expect(tree.$()).toEqual({y:7});expect(sent).toEqual([]);
  q.confirm();await flush();expect(sent).toEqual([{y:7}]);
 }finally{c.dispose();tree.destroy();owner.destroy();}
});

it('the same omission with independent replacement y does not acquire q',async()=>{
 const tree=signalTree({branch:{x:0},y:0},{enhancers:[transactions()]});const owner=signalTree({z:0},{enhancers:[transactions()]});
 const sent:unknown[]=[];const c=asLink(tree.$,sent);const q=owner.transact(()=>owner.$.z(7));
 try{
  c.declare({kind:'dependent',owners:[q]},()=>tree.$.branch.x(7));await flush();
  const before=q.inspect();c.declare({kind:'independent'},()=>tree.$({y:7} as never));await flush();expect(sent).toEqual([{y:7}]);expect(q.inspect()).toEqual(before);
 }finally{c.dispose();tree.destroy();owner.destroy();}
});

it('exact replacement cancels only its old slot and disposal cancels remaining slots',()=>{
 const tree=signalTree({a:0,b:0});const channel={};let wakes=0;
 const index=new RecipientOccurrences(()=>wakes++,()=>life.initialRequirement());
 life.registerConnection(channel,{supported:true,report:()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ },wake:()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ }});
 try{
  const a=index.enroll(tree.$.a),b=index.enroll(tree.$.b);
  life.runDeclaration(channel,{kind:'independent'},()=>{
   const p=life.prepareNativeRequirement([],false,[]);installTerminalRecord(p.record);life.finalizeNativeRequirement(p.requirement);life.deliverNativeRequirementReady(p.requirement);
   index.replace(a,'value',p.requirement);index.replace(b,'value',p.requirement);
   expect(index.unresolved()).toBe(2);
   index.replace(a,'value',life.initialRequirement());expect(index.unresolved()).toBe(1);
   expect(index.inspect().subscriptions).toBe(1);
  });
  expect(index.unresolved()).toBe(0);expect(index.inspect().finalized).toBe(1);expect(wakes).toBe(1);
  life.runDeclaration(channel,{kind:'independent'},()=>{
   const p=life.prepareNativeRequirement([],false,[]);installTerminalRecord(p.record);life.finalizeNativeRequirement(p.requirement);life.deliverNativeRequirementReady(p.requirement);
   index.replace(a,'value',p.requirement);index.dispose();expect(index.inspect().subscriptions).toBe(0);
  });expect(wakes).toBe(1);
 }finally{index.dispose();life.disposeConnection(channel);tree.destroy();}
});

it('finalization work is independent of unrelated enrolled sibling count',()=>{
 const work:number[]=[];
 for(const size of [4,128]){
  const initial:Record<string,number>=Object.fromEntries(Array.from({length:size},(_,i)=>['n'+i,0]));
  const tree=signalTree(initial);const channel={};
  const index=new RecipientOccurrences(()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ },()=>life.initialRequirement());life.registerConnection(channel,{supported:true,report:()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ },wake:()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ }});
  try{
   const handles=Array.from({length:size},(_,i)=>{const node=tree.$['n'+i];if(typeof node!=='function')throw Error('Fixture leaf missing');return index.enroll(node);});
   for(const handle of handles)index.replace(handle,'value',life.initialRequirement());
   let before=0;
   life.runDeclaration(channel,{kind:'independent'},()=>{
    const p=life.prepareNativeRequirement([],false,[]);installTerminalRecord(p.record);life.finalizeNativeRequirement(p.requirement);life.deliverNativeRequirementReady(p.requirement);
    index.replace(handles[0],'value',p.requirement);before=index.inspect().propagated;
   });
   expect(index.inspect().finalized).toBe(1);work.push(index.inspect().propagated-before);
  }finally{index.dispose();life.disposeConnection(channel);tree.destroy();}
 }
 expect(work[0]).toBeGreaterThan(0);expect(work[1]).toBe(work[0]);
});

for(const equal of [false,true])it(`reverse enrolled peer has no ${equal?'equal':'full'} ingress permission`,async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number;y:number},string>()},{enhancers:[transactions()]});tree.$.rows.addOne({id:'a',x:0,y:0});await flush();
 const peerSent:unknown[]=[],sent:unknown[]=[];const peer=asLink(tree.$.rows,peerSent);let incoming!:(v:Array<{id:string;x:number;y:number}>)=>void;
 const c=link(tree.$.rows,{set:v=>{sent.push(v);},subscribe:next=>{incoming=next;return()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ };}}) as Experimental;
 try{
  const q=tree.transact(()=>tree.$.rows.updateOne('a',{x:7}));await flush();incoming([{id:'a',x:equal?7:10,y:0}]);await flush();
  c.declare({kind:'independent'},()=>tree.$.rows.updateOne('a',{y:8}));await flush();expect(sent).toEqual([[{id:'a',x:equal?7:10,y:8}]]);expect(peerSent).toEqual([]);
  q.confirm();await flush();expect(peerSent).toEqual(sent);
 }finally{c.dispose();peer.dispose();tree.destroy();}
});


it('hidden unresolved support does not block selection reduction and reappearance restores it',()=>{
 const tree=signalTree({branch:{x:0}});const channel={};let wakes=0;
 const index=new RecipientOccurrences(()=>wakes++,()=>life.initialRequirement());life.registerConnection(channel,{supported:true,report:()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ },wake:()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ }});
 try{
  const branch=index.enroll(tree.$.branch),x=index.enroll(tree.$.branch.x);
  life.runDeclaration(channel,{kind:'independent'},()=>{
   const p=life.prepareNativeRequirement([],false,[]);installTerminalRecord(p.record);life.finalizeNativeRequirement(p.requirement);life.deliverNativeRequirementReady(p.requirement);
   index.replace(x,'value',p.requirement);expect(index.unresolved()).toBe(1);
   index.setPresence(branch,false,life.initialRequirement());expect(index.unresolved()).toBe(0);
   index.setPresence(branch,true,life.initialRequirement());expect(index.unresolved()).toBe(1);
   index.setPresence(branch,false,life.initialRequirement());
  });expect(wakes).toBe(0);expect(index.unresolved()).toBe(0);
  index.setPresence(branch,true,life.initialRequirement());expect(index.unresolved()).toBe(0);
 }finally{index.dispose();life.disposeConnection(channel);tree.destroy();}
});

it('new subject lifetime at reused key cannot retain replaced old proof',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});const owner=signalTree({z:0},{enhancers:[transactions()]});
 tree.$.rows.addOne({id:'a',x:0});await flush();const old=tree.$.rows.byIdOrFail('a');const sent:unknown[]=[];const c=asLink(tree.$.rows,sent);const q=owner.transact(()=>owner.$.z(7));
 try{
  c.declare({kind:'dependent',owners:[q]},()=>old.x(7));await flush();expect(sent).toEqual([]);
  c.declare({kind:'independent'},()=>{tree.$.rows.removeOne('a');tree.$.rows.addOne({id:'a',x:11});});await flush();
  expect(tree.$.rows.byIdOrFail('a')).not.toBe(old);expect(sent).toEqual([[{id:'a',x:11}]]);
  q.confirm();await flush();expect(sent).toEqual([[{id:'a',x:11}]]);
 }finally{c.dispose();tree.destroy();owner.destroy();}
});
