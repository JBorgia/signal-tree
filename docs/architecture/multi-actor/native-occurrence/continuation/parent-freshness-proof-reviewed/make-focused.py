from pathlib import Path
p=Path(__file__).parent
common=r'''import {expect,it,vi} from 'vitest';
import {writeFileSync} from 'node:fs';import {join} from 'node:path';
import {signalTree,transactions} from '../index';
import {getTreeScalarSlotRuntime} from 'INTERNAL/tree-scalar-slot-port';
import {getOwnedPositionIds} from 'INTERNAL/owned-metadata';
import {completeScalarFrame} from 'INTERNAL/tree-scalar-slot-runtime';
import {getLocationRuntime,replaceLocation,deriveLocation} from 'INTERNAL/location-runtime';
import {preparePublicationMutations,registerMembershipPublication} from 'INTERNAL/intrinsic-mutation';
import {markTreeStore} from 'INTERNAL/snapshot-authority';
import {materializeNode} from 'UTILS';
EXTRA
function save(name:string,data:unknown){writeFileSync(join(process.env.ST_PREPARED_REVIEW_OUTPUT!,name+'.json'),JSON.stringify(data,null,2));}
it('prepared slot completion discriminates current snapshot from undelivered native mirror and derived',()=>{
 const t=signalTree({box:{n:1},sibling:{n:8}},{enhancers:[transactions()]});const rt=getTreeScalarSlotRuntime(t.$)!;const lr=getLocationRuntime(t.$)!;
 let runs=0;const observed=DERIVED(()=>{runs++;return t.$.box();});const before=observed();const sibling=t.$.sibling();let delivered=0;let during:unknown;let mirror:unknown;let cached:unknown;let direct:unknown;let root:unknown;
 const off=preparePublicationMutations(t.$.box.n,()=>({record:{writes:[],adds:[]},completion:{}}),()=>{delivered++;during=t.$.box();mirror=t.$.box.n();cached=observed();direct=t.$.box();root=t.$();});expect(off).toBeTypeOf('function');
 try{const id=getOwnedPositionIds(t.$.box.n)![0]!;const slot=rt.resolveScalarSlot(id)!;const frame=rt.beginFrame();frame.set(slot,2);const install=frame.prepareCommit!({publish:false});const installed=install();completeScalarFrame(installed);
 save('terminal-window',{delivered,during,mirror,cached,direct,root,runs});expect(delivered).toBe(1);expect(during).toEqual({n:2});expect(direct).toBe(during);expect(root).toEqual({box:{n:2},sibling:{n:8}});expect(t.$.sibling()).toBe(sibling);EXPECT_MIRROR
 rt.publishPrepared(installed);expect(observed()).toEqual({n:2});expect(t.$.box()).toBe(during);expect(runs).toBeGreaterThan(1);
 replaceLocation(t.$.box.n,3);expect(observed()).toEqual({n:3});deriveLocation(t.$.box.n,n=>n+1);expect(observed()).toEqual({n:4});
 }finally{off!();t.destroy();}
});
it('new child dependencies survive early current read then normal delivery',()=>{
 const t=signalTree({rows:{} as Record<string,{n:number}>,other:{n:1}},{enhancers:[transactions()]});const lr=getLocationRuntime(t.$)!;let runs=0;const held=DERIVED(()=>{runs++;return t.$();});held();let early:unknown;let calls=0;
 const off=registerMembershipPublication(e=>e.branch===t.$.rows&&e.key==='a'?{record:{writes:[],adds:[]},completion:{}}:undefined,()=>{calls++;early=t.$();});
 try{t.$.rows({a:{n:1}});expect(calls).toBe(1);expect(held()).toBe(early);const n=runs;replaceLocation(t.$.rows.a!.n,2);expect(held().rows).toEqual({a:{n:2}});expect(runs).toBeGreaterThan(n);const m=runs;replaceLocation(t.$.other.n,3);expect(held().other).toEqual({n:3});expect(runs).toBeGreaterThan(m);}finally{off();t.destroy();}
});
it('held dormant descendants recover on equal-value reactivation without sibling invalidation',()=>{
 const t=signalTree({rows:{a:{deep:{n:1}},b:{deep:{n:2}}}},{enhancers:[transactions()]});const lr=getLocationRuntime(t.$)!;const a=t.$.rows.a;const deep=a.deep;deep();const held=DERIVED(()=>t.$.rows());held();
 try{t.$.rows({b:{deep:{n:2}}} as {a:{deep:{n:number}};b:{deep:{n:number}}});expect(held()).toEqual({b:{deep:{n:2}}});expect(deep()).toBeUndefined();replaceLocation(deep.n,1);expect(held()).toEqual({a:{deep:{n:1}},b:{deep:{n:2}}});expect(deep()).toEqual({n:1});replaceLocation(deep.n,3);expect(held().a.deep.n).toBe(3);}finally{t.destroy();}
});
it('supported symbol store child shares ancestry before grouped slot delivery',()=>{
 const key=Symbol('child');const t=signalTree({box:{n:1}},{enhancers:[transactions()]});const lr=getLocationRuntime(t.$)!;
 // Existing supported unwrap/materialize plain-store form; no symbol write API invented.
 const store:{[key]:typeof t.$.box}={[key]:t.$.box};markTreeStore(store);const read=()=>materializeNode<{[key]:{n:number}}>(store);const old=read();
 try{const rt=getTreeScalarSlotRuntime(t.$)!;const slot=rt.resolveScalarSlot(getOwnedPositionIds(t.$.box.n)![0]!)!;const frame=rt.beginFrame();frame.set(slot,2);const result=frame.commit({publish:false});expect(read()[key]).toEqual({n:2});expect(read()).not.toBe(old);const now=read();rt.publishPrepared(result);expect(read()).toBe(now);replaceLocation(t.$.box.n,3);expect(read()[key].n).toBe(3);}finally{t.destroy();}
});
it('no-op and discarded preparation preserve output; temporary delivery builds are measured',()=>{
 const t=signalTree({box:{n:1}},{enhancers:[transactions()]});const lr=getLocationRuntime(t.$)!;let builds=0;const create=lr.createDerived.bind(lr);const spy=vi.spyOn(lr,'createDerived').mockImplementation(<T>(fn:()=>T)=>create(()=>{builds++;return fn();}));
 try{const before=t.$.box();const count=builds;replaceLocation(t.$.box.n,1);expect(t.$.box()).toBe(before);const rt=getTreeScalarSlotRuntime(t.$)!;const slot=rt.resolveScalarSlot(getOwnedPositionIds(t.$.box.n)![0]!)!;const canceled=rt.beginFrame();canceled.set(slot,2);canceled.discard();expect(t.$.box()).toBe(before);expect(builds).toBe(count);
 const frame=rt.beginFrame();frame.set(slot,3);const result=frame.commit({publish:false});const current=t.$.box();expect(current).toEqual({n:3});const earlyBuilds=builds;for(let i=0;i<20;i++)expect(t.$.box()).toBe(current);expect(builds).toBe(earlyBuilds);rt.publishPrepared(result);expect(t.$.box()).toBe(current);save('builder-work',{initialTrackedBuilds:count,beforeDelivery:earlyBuilds,afterDelivery:builds,limit:'tracked derived callback executions only; direct fallback builds not counted'});expect(builds).toBeGreaterThan(count);
 }finally{spy.mockRestore();t.destroy();}
});
'''
for facade in ['kernel','angular']:
 internal='./internals' if facade=='kernel' else '../../../kernel/src/lib/internals';utils='./utils' if facade=='kernel' else '../../../kernel/src/lib/utils'
 s=common.replace('INTERNAL',internal).replace('UTILS',utils).replace('EXTRA',"import {computed} from '@angular/core';" if facade=='angular' else '').replace('DERIVED','computed' if facade=='angular' else 'lr.createDerived').replace('EXPECT_MIRROR',"expect(mirror).toBe(1);expect(cached).toBe(before);" if facade=='angular' else 'expect(mirror).toBe(2);')
 (p/'candidate'/f'packages/{facade}/src/lib/parent-freshness-focused.spec.ts').write_text(s)
