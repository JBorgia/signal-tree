import {expect,it} from 'vitest';
import {link,signalTree,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
type Receipt={read():Readonly<{state:string;basis?:string;reason?:string}>};
type Declared=ReturnType<typeof link>&{declare(d:{kind:'independent'},body:()=>unknown):Receipt};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<80;i++)await Promise.resolve();};
const owner=()=>signalTree({z:0},{enhancers:[transactions()]});
for(const mode of ['branch','root'] as const)for(const outcome of ['confirm','rollback'] as const)
it(`recipient window ${mode} ${outcome}: useful terminal wake excludes later owner`,async()=>{
 const o=owner(),late=owner(),tree=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const sent:unknown[]=[],other:unknown[]=[];
 const source=mode==='branch'?tree.$.pair:tree.$;const a=link(source,{set:v=>{sent.push(v);}}) as Declared,b=link(source,{set:v=>{other.push(v);}});
 const p=o.transact(()=>o.$.z(7));
 const shape=mode==='branch'?{x:1,y:0}:{pair:{x:1,y:0}};
 try{
  const receipt=a.declare({kind:'independent'},()=>{if(mode==='branch')tree.$.pair(v=>({...v,x:1}));else tree.$(v=>({...v,pair:{...v.pair,x:1}}));});
  const q=late.transact(()=>late.$.z(9));const inspection=q.inspect();let settled=false;const wait=b.settled().then(()=>{settled=true;});
  await flush();expect(sent).toEqual([shape]);expect(receipt.read()).toMatchObject({state:'started',basis:'declared'});expect(other).toEqual([]);expect(settled).toBe(false);
  p[outcome]();await flush();expect(other).toEqual([shape]);expect(settled).toBe(true);expect(q.inspect()).toEqual(inspection);expect(late.$.z()).toBe(9);await wait;
 }finally{a.dispose();b.dispose();tree.destroy();o.destroy();late.destroy();}
});
for(const outcome of ['confirm','rollback'] as const)
it(`recipient window ${outcome}: remaining captured owner still holds`,async()=>{
 const first=owner(),second=owner(),tree=signalTree({pair:{x:0,y:0}});const sent:unknown[]=[];
 const a=link(tree.$.pair,{set:()=>{}}) as Declared,b=link(tree.$.pair,{set:v=>{sent.push(v);}});
 const p=first.transact(()=>first.$.z(7)),q=second.transact(()=>second.$.z(9));
 try{a.declare({kind:'independent'},()=>tree.$.pair(v=>({...v,x:1})));await flush();expect(sent).toEqual([]);p[outcome]();await flush();expect(sent).toEqual([]);q[outcome]();await flush();expect(sent).toEqual([{x:1,y:0}]);await b.settled();}finally{a.dispose();b.dispose();tree.destroy();first.destroy();second.destroy();}
});
it('recipient window disposal releases waiter without changing qualified receipt or later sending',async()=>{
 const o=owner(),tree=signalTree({pair:{x:0,y:0}});const sent:unknown[]=[],other:unknown[]=[];
 const a=link(tree.$.pair,{set:v=>{sent.push(v);}}) as Declared,b=link(tree.$.pair,{set:v=>{other.push(v);}});const p=o.transact(()=>o.$.z(7));
 try{const receipt=a.declare({kind:'independent'},()=>tree.$.pair(v=>({...v,x:1})));await flush();expect(sent).toEqual([{x:1,y:0}]);expect(other).toEqual([]);const terminal=receipt.read();let done=false;const wait=b.settled().then(()=>{done=true;});b.dispose();await flush();expect(done).toBe(true);p.confirm();await flush();expect(other).toEqual([]);expect(receipt.read()).toBe(terminal);await wait;}finally{a.dispose();b.dispose();tree.destroy();o.destroy();}
});
it('recipient window explicit nested complete declarations both progress while foreign owner remains pending',async()=>{
 const o=owner(),tree=signalTree({pair:{x:0,y:0}});const one:unknown[]=[],two:unknown[]=[];
 const a=link(tree.$.pair,{set:v=>{one.push(v);}}) as Declared,b=link(tree.$.pair,{set:v=>{two.push(v);}}) as Declared;const p=o.transact(()=>o.$.z(7));
 try{let inner:Receipt|undefined;const receipt=a.declare({kind:'independent'},()=>{inner=b.declare({kind:'independent'},()=>tree.$.pair(v=>({...v,x:1})));expect(inner.read()).toMatchObject({state:'validating'});expect(two).toEqual([]);});await flush();expect(one).toEqual([{x:1,y:0}]);expect(two).toEqual(one);expect(receipt.read()).toMatchObject({state:'started',basis:'declared'});expect(inner?.read()).toMatchObject({state:'started',basis:'declared'});expect(o.$.z()).toBe(7);expect(p.inspect().changes.length).toBeGreaterThan(0);}finally{a.dispose();b.dispose();tree.destroy();o.destroy();}
});

it('recipient window includes owner opened by a later callback-capable preparer',async()=>{
 const {preparePublicationMutations}=await import('./internals/intrinsic-mutation');
 const o=owner(),tree=signalTree({pair:{x:0,y:0}});const one:unknown[]=[],two:unknown[]=[];
 const a=link(tree.$.pair,{set:v=>{one.push(v);}}) as Declared,b=link(tree.$.pair,{set:v=>{two.push(v);}});
 let pending:ReturnType<typeof o.transact>|undefined;let calls=0;
 const release=preparePublicationMutations(tree.$.pair.x,()=>{calls++;pending=o.transact(()=>o.$.z(7));return undefined;},()=>{});
 try{a.declare({kind:'independent'},()=>tree.$.pair(v=>({...v,x:1})));expect(calls).toBe(1);if(!pending)throw Error('preparer did not open owner');await flush();expect(one).toEqual([{x:1,y:0}]);expect(two).toEqual([]);pending.confirm();await flush();expect(two).toEqual([{x:1,y:0}]);await b.settled();}finally{release?.();a.dispose();b.dispose();tree.destroy();o.destroy();}
});
