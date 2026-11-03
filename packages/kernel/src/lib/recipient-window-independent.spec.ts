import {expect,it,vi} from 'vitest';
import {link,signalTree,transactions} from '../index';
import * as life from './experimental-publication/lifecycle';
import {getPathNotifier} from './path-notifier';
import {preparePublicationMutations} from './internals/intrinsic-mutation';
type Receipt={read():Readonly<{state:string;basis?:string;reason?:string}>};
type Declared=ReturnType<typeof link>&{declare(d:{kind:'independent'|'unknown'},body:()=>unknown):Receipt};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<100;i++)await Promise.resolve();};
const owner=()=>signalTree({z:0},{enhancers:[transactions()]});
for(const mode of ['branch','root'] as const)for(const outcome of ['confirm','rollback'] as const)
it(`native possible counterpart ${mode} ${outcome}: exact terminal wake excludes later owner`,async()=>{
 const o=owner(),late=owner(),tree=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const sent:unknown[]=[],other:unknown[]=[];
 const source=mode==='branch'?tree.$.pair:tree.$;const a=link(source,{set:v=>{sent.push(v);}}) as Declared,b=link(source,{set:v=>{other.push(v);}});
 const p=o.transact(()=>o.$.z(7));tree.$.pair.x(7);await flush();expect(sent).toEqual([]);expect(other).toEqual([]);
 const shape=mode==='branch'?{x:8,y:0}:{pair:{x:8,y:0}};
 try{const receipt=a.declare({kind:'independent'},()=>{if(mode==='branch')tree.$.pair(v=>({...v,x:v.x+1}));else tree.$(v=>({...v,pair:{...v.pair,x:v.pair.x+1}}));});
 const q=late.transact(()=>late.$.z(9));const inspection=q.inspect();let settled=false;const wait=b.settled().then(()=>{settled=true;});await flush();expect(sent).toEqual([]);expect(other).toEqual([]);expect(settled).toBe(false);
 p[outcome]();await flush();expect(sent).toEqual([shape]);expect(other).toEqual([shape]);expect(settled).toBe(true);expect(receipt.read()).toMatchObject({state:'started',basis:'surviving'});expect(q.inspect()).toEqual(inspection);expect(late.$.z()).toBe(9);await wait;
 }finally{a.dispose();b.dispose();tree.destroy();o.destroy();late.destroy();}
});
for(const outcome of ['confirm','rollback'] as const)
it(`native possible counterpart ${outcome}: remaining captured owner still holds`,async()=>{
 const first=owner(),second=owner(),tree=signalTree({pair:{x:0,y:0}});const sent:unknown[]=[];const a=link(tree.$.pair,{set:()=>{/* This relationship is not the observed endpoint. */}}) as Declared,b=link(tree.$.pair,{set:v=>{sent.push(v);}});
 const p=first.transact(()=>first.$.z(7)),q=second.transact(()=>second.$.z(9));tree.$.pair.x(7);
 try{a.declare({kind:'independent'},()=>tree.$.pair(v=>({...v,x:v.x+1})));await flush();expect(sent).toEqual([]);p[outcome]();await flush();expect(sent).toEqual([]);q[outcome]();await flush();expect(sent).toEqual([{x:8,y:0}]);await b.settled();}finally{a.dispose();b.dispose();tree.destroy();first.destroy();second.destroy();}
});
it('native possible counterpart disposal releases waiter without changing other receipt or later sending',async()=>{
 const o=owner(),tree=signalTree({pair:{x:0,y:0}});const sent:unknown[]=[],other:unknown[]=[];const a=link(tree.$.pair,{set:v=>{sent.push(v);}}) as Declared,b=link(tree.$.pair,{set:v=>{other.push(v);}});const p=o.transact(()=>o.$.z(7));tree.$.pair.x(7);
 try{const receipt=a.declare({kind:'independent'},()=>tree.$.pair(v=>({...v,x:v.x+1})));await flush();expect(sent).toEqual([]);expect(other).toEqual([]);const prior=receipt.read();let done=false;const wait=b.settled().then(()=>{done=true;});b.dispose();await flush();expect(done).toBe(true);expect(receipt.read()).toBe(prior);p.confirm();await flush();expect(other).toEqual([]);expect(sent).toEqual([{x:8,y:0}]);expect(receipt.read()).toMatchObject({state:'started',basis:'surviving'});await wait;}finally{a.dispose();b.dispose();tree.destroy();o.destroy();}
});
it('private unknown-native window includes owner opened by later callback-capable preparer',async()=>{
 const o=owner(),tree=signalTree({pair:{x:0,y:0}});const one:unknown[]=[],two:unknown[]=[];const a=link(tree.$.pair,{set:v=>{one.push(v);}}) as Declared,b=link(tree.$.pair,{set:v=>{two.push(v);}});let pending:ReturnType<typeof o.transact>|undefined;let calls=0;
 const spy=vi.spyOn(life,'prepareNativeRequirement');const release=preparePublicationMutations(tree.$.pair.x,()=>{calls++;pending=o.transact(()=>o.$.z(7));return undefined;},()=>{ /* Intentional completion sink: this probe only opens an owner during preparation. */ });
 try{a.declare({kind:'unknown'},()=>tree.$.pair(v=>({...v,x:1})));expect(calls).toBe(1);if(!pending)throw Error('preparer did not open owner');expect(spy.mock.results.some(r=>r.type==='return'&&life.nativeProof(r.value.requirement).possible?.some(c=>c.outcome==='pending'))).toBe(true);await flush();expect(one).toEqual([]);expect(two).toEqual([]);pending.confirm();await flush();expect(one).toEqual([{x:1,y:0}]);expect(two).toEqual(one);await b.settled();}finally{release?.();spy.mockRestore();a.dispose();b.dispose();tree.destroy();o.destroy();}
});

// Retain the original positive matching-declaration control unchanged.
it('recipient window explicit nested complete declarations both progress while foreign owner remains pending',async()=>{
 const o=owner(),tree=signalTree({pair:{x:0,y:0}});const one:unknown[]=[],two:unknown[]=[];
 const a=link(tree.$.pair,{set:v=>{one.push(v);}}) as Declared,b=link(tree.$.pair,{set:v=>{two.push(v);}}) as Declared;const p=o.transact(()=>o.$.z(7));
 try{let inner:Receipt|undefined;const receipt=a.declare({kind:'independent'},()=>{inner=b.declare({kind:'independent'},()=>tree.$.pair(v=>({...v,x:1})));expect(inner.read()).toMatchObject({state:'validating'});expect(two).toEqual([]);});await flush();expect(one).toEqual([{x:1,y:0}]);expect(two).toEqual(one);expect(receipt.read()).toMatchObject({state:'started',basis:'declared'});expect(inner?.read()).toMatchObject({state:'started',basis:'declared'});expect(o.$.z()).toBe(7);expect(p.inspect().changes.length).toBeGreaterThan(0);}finally{a.dispose();b.dispose();tree.destroy();o.destroy();}
});

