import {expect,it,vi} from 'vitest';
import {writeFileSync} from 'node:fs';import {join} from 'node:path';
import {signalTree,transactions} from '../index';
import {getTreeScalarSlotRuntime} from './internals/tree-scalar-slot-port';
import {getOwnedPositionIds} from './internals/owned-metadata';
import {completeScalarFrame} from './internals/tree-scalar-slot-runtime';
import {bindLocationRuntime,getLocationRuntime,replaceLocation,deriveLocation} from './internals/location-runtime';
import {observeIntrinsicMutations,preparePublicationMutations,registerMembershipPublication} from './internals/intrinsic-mutation';
import {markTreeStore} from './internals/snapshot-authority';
import {materializeNode} from './utils';

function write(leaf:unknown,value:number){if(typeof leaf!=='function')throw Error('missing leaf');(leaf as (v:number)=>void)(value);}
function save(name:string,data:unknown){const out=process.env.ST_PREPARED_REVIEW_OUTPUT;if(out)writeFileSync(join(out,name+'.json'),JSON.stringify(data,null,2));}
it('prepared slot completion discriminates current snapshot from undelivered native mirror and derived',()=>{
 const t=signalTree({box:{n:1},sibling:{n:8}},{enhancers:[transactions()]});const rt=getTreeScalarSlotRuntime(t.$)!;const lr=getLocationRuntime(t.$)!;
 let runs=0;const observed=lr.createDerived(()=>{runs++;return t.$.box();});const before=observed();const sibling=t.$.sibling();let delivered=0;let during:unknown;let mirror:unknown;let cached:unknown;let direct:unknown;let root:unknown;
 const off=preparePublicationMutations(t.$.box.n,()=>({record:{writes:[],adds:[]},completion:{}}),()=>{delivered++;during=t.$.box();mirror=t.$.box.n();cached=observed();direct=t.$.box();root=t.$();});expect(off).toBeTypeOf('function');
 try{const id=getOwnedPositionIds(t.$.box.n)![0]!;const slot=rt.resolveScalarSlot(id)!;const frame=rt.beginFrame();frame.set(slot,2);const install=frame.prepareCommit!({publish:false});const installed=install();completeScalarFrame(installed);
 save('terminal-window',{delivered,during,mirror,cached,direct,root,runs});expect(delivered).toBe(1);expect(during).toEqual({n:2});expect(direct).toBe(during);expect(root).toEqual({box:{n:2},sibling:{n:8}});expect(t.$.sibling()).toBe(sibling);expect(mirror).toBe(2);
 rt.publishPrepared(installed);expect(observed()).toEqual({n:2});expect(t.$.box()).toBe(during);expect(runs).toBeGreaterThan(1);
 write(t.$.box.n,3);expect(observed()).toEqual({n:3});write(t.$.box.n, t.$.box.n()+1);expect(observed()).toEqual({n:4});
 }finally{off!();t.destroy();}
});
it('new child dependencies survive early current read then normal delivery',()=>{
 const t=signalTree({rows:{} as Record<string,{n:number}>,other:{n:1}},{enhancers:[transactions()]});const lr=getLocationRuntime(t.$)!;let runs=0;const held=lr.createDerived(()=>{runs++;return t.$();});held();let early:unknown;let calls=0;
 const off=registerMembershipPublication(e=>e.branch===t.$.rows&&e.key==='a'?{record:{writes:[],adds:[]},completion:{}}:undefined,()=>{calls++;early=t.$();});
 try{t.$.rows({a:{n:1}});expect(calls).toBe(1);expect(held()).toBe(early);const n=runs;write((t.$.rows.a as unknown as {n: unknown}).n,2);expect(held().rows).toEqual({a:{n:2}});expect(runs).toBeGreaterThan(n);const m=runs;write(t.$.other.n,3);expect(held().other).toEqual({n:3});expect(runs).toBeGreaterThan(m);}finally{off();t.destroy();}
});
it('held dormant descendants recover on equal-value reactivation without sibling invalidation',()=>{
 const t=signalTree({rows:{a:{deep:{n:1}},b:{deep:{n:2}}}},{enhancers:[transactions()]});const lr=getLocationRuntime(t.$)!;const a=t.$.rows.a;const deep=a.deep;deep();const held=lr.createDerived(()=>t.$.rows());held();
 try{t.$.rows({b:{deep:{n:2}}} as {a:{deep:{n:number}};b:{deep:{n:number}}});expect(held()).toEqual({b:{deep:{n:2}}});expect(deep()).toBeUndefined();write(deep.n,1);expect(held()).toEqual({a:{deep:{n:1}},b:{deep:{n:2}}});expect(deep()).toEqual({n:1});write(deep.n,3);expect(held().a.deep.n).toBe(3);}finally{t.destroy();}
});
it('supported symbol store child shares ancestry before grouped slot delivery',()=>{
 const key=Symbol('child');const t=signalTree({box:{n:1}},{enhancers:[transactions()]});const lr=getLocationRuntime(t.$)!;
 // Existing supported unwrap/materialize plain-store form; no symbol write API invented.
 const store:{[key]:typeof t.$.box}={[key]:t.$.box};markTreeStore(store);bindLocationRuntime(store,lr);const read=()=>materializeNode<{[key]:{n:number}}>(store);const old=read();
 try{const rt=getTreeScalarSlotRuntime(t.$)!;const slot=rt.resolveScalarSlot(getOwnedPositionIds(t.$.box.n)![0]!)!;const frame=rt.beginFrame();frame.set(slot,2);const result=frame.commit({publish:false});expect(read()[key]).toEqual({n:2});expect(read()).not.toBe(old);const now=read();rt.publishPrepared(result);expect(read()).toBe(now);write(t.$.box.n,3);expect(read()[key].n).toBe(3);}finally{t.destroy();}
});
it('no-op and discarded preparation preserve output; temporary delivery builds are measured',()=>{
 const t=signalTree({box:{n:1}},{enhancers:[transactions()]});const lr=getLocationRuntime(t.$)!;let builds=0;const create=lr.createDerived.bind(lr);const spy=vi.spyOn(lr,'createDerived').mockImplementation(<T>(fn:()=>T)=>create(()=>{builds++;return fn();}));
 try{const before=t.$.box();const count=builds;write(t.$.box.n,1);expect(t.$.box()).toBe(before);const rt=getTreeScalarSlotRuntime(t.$)!;const slot=rt.resolveScalarSlot(getOwnedPositionIds(t.$.box.n)![0]!)!;const canceled=rt.beginFrame();canceled.set(slot,2);canceled.discard();expect(t.$.box()).toBe(before);expect(builds).toBe(count);
 const frame=rt.beginFrame();frame.set(slot,3);const result=frame.commit({publish:false});const current=t.$.box();expect(current).toEqual({n:3});const earlyBuilds=builds;for(let i=0;i<20;i++)expect(t.$.box()).toBe(current);expect(builds).toBe(earlyBuilds);rt.publishPrepared(result);expect(t.$.box()).toBe(current);save('builder-work',{initialTrackedBuilds:count,beforeDelivery:earlyBuilds,afterDelivery:builds,limit:'tracked derived callback executions only; direct fallback builds not counted'});expect(builds).toBeGreaterThan(count);
 }finally{spy.mockRestore();t.destroy();}
});

it('refused prepared slot leaves physical value and snapshot identity unchanged',()=>{
 const t=signalTree({box:{n:1}},{enhancers:[transactions()]});const before=t.$();const sentinel=Error('prepare refused');const rt=getTreeScalarSlotRuntime(t.$)!;
 const off=preparePublicationMutations(t.$.box.n,()=>{throw sentinel;},()=>{throw Error('must not complete');});expect(off).toBeTypeOf('function');
 try{const slot=rt.resolveScalarSlot(getOwnedPositionIds(t.$.box.n)![0]!)!;const frame=rt.beginFrame();frame.set(slot,2);expect(()=>frame.prepareCommit!({publish:false})).toThrow(sentinel);expect(t.$()).toBe(before);expect(t.$.box.n()).toBe(1);}finally{off!();t.destroy();}
});
it('direct replace and derive capture read installed backing before native publication',()=>{
 const t=signalTree({box:{n:1}},{enhancers:[transactions()]});t.$.box();const seen:unknown[]=[];
 const off=observeIntrinsicMutations(t.$.box.n,()=>{seen.push({parent:t.$.box(),mirror:t.$.box.n()});},false);expect(off).toBeTypeOf('function');
 try{t.$.box.n(2);t.$.box.n(n=>n+1);save('direct-capture',seen);expect(seen).toEqual([{parent:{n:2},mirror:2},{parent:{n:3},mirror:3}]);expect(t.$.box()).toEqual({n:3});}finally{off!();t.destroy();}
});
