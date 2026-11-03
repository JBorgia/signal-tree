import {expect,it} from 'vitest';
import {signalTree,link,transactions} from '../index';
import {materializeMember,ordinaryBranch,registerMarkerProcessor} from './internals/materialize-markers';
import {registerMembershipPublication} from './internals/intrinsic-mutation';
import {getTreeScalarSlotRuntime} from './internals/tree-scalar-slot-port';
import {getMutationCaptureRuntime} from './internals/mutation-capture-runtime';
import {getOwnedPositionIds} from './internals/owned-metadata';
import {getPositionRegistry} from './internals/position-registry';
const DYN=Symbol('keyed-cleanup-fixture');
type Marker={[DYN]:true;seed:Record<string,unknown>};
registerMarkerProcessor((v:unknown):v is Marker=>typeof v==='object'&&v!==null&&DYN in v,(m:Marker)=>ordinaryBranch(m.seed,{keyedLookup:true}));
type Cell={():number;(v:number):void};type Child={():unknown;n:Cell;more:Cell};type Branch={():Record<string,unknown>;[key:string]:unknown};
function setup(){const t=signalTree({rows:{[DYN]:true,seed:{}} as Marker},{enhancers:[transactions()]});const rows=t.$.rows as unknown as Branch;const sent:unknown[]=[];const l=link(rows,{set:v=>{sent.push(v);}});return{t,rows,l,sent,rt:getTreeScalarSlotRuntime(t.$)!};}
const flush=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};

for(const sameKey of [false,true])it(`keyed constructor refusal protects ${sameKey?'same':'other'}-key nested installed identity and releases recursive cells`,async()=>{
 const {t,rows,l,sent,rt}=setup();const before=rt.slotCount();const fail=Error('keyed refused');let nested:Child|undefined;let escaped:Child|undefined;let busy=false;let ids:readonly number[]=[];const registry=getPositionRegistry(rows)!;
 const off=registerMembershipPublication(edit=>{if(edit.key!=='a'||busy)return;busy=true;escaped=edit.child as Child;ids=getOwnedPositionIds(escaped.n)??[];nested=materializeMember(rows,sameKey?'a':'kept',{n:7,more:8}) as Child;throw fail;},()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ });
 try{expect(()=>materializeMember(rows,'a',{n:1,more:2})).toThrow(fail);off();const key=sameKey?'a':'kept';expect(rows[key]).toBe(nested);expect(rows()).toEqual({[key]:{n:7,more:8}});nested!.n(9);await flush();const count=sent.length;escaped!.n(99);(escaped as unknown as (v:unknown)=>void)({n:99,more:100,newChild:{x:12}});await flush();expect(sent.length).toBe(count);expect(rows()).toEqual({[key]:{n:9,more:8}});expect(rt.slotCount()).toBe(before+2);for(const id of ids){expect(registry.addressFor(id)).toBeUndefined();expect(rt.resolveScalarSlot(id)).toBeUndefined();expect(rt.resolveScalarLeaf(id)).toBeUndefined();}}
 finally{off();l.dispose();t.destroy();}
});

it('keyed first appearance prepares rollback responsibility and rejects responsibility refusal without acquisition',()=>{
 const {t,rows,l,rt}=setup();const capture=getMutationCaptureRuntime(t.$)!;const original=capture.prepareMemberResponsibility;const before=rt.slotCount();let calls=0;const fail=Error('keyed responsibility');capture.prepareMemberResponsibility=(branch,key,child,presence)=>{if(branch===rows&&key==='a'){calls++;throw fail;}return original?.(branch,key,child,presence);};
 try{expect(()=>materializeMember(rows,'a',{n:1,more:2})).toThrow(fail);expect(calls).toBe(1);expect(rows()).toEqual({});expect(rt.slotCount()).toBe(before);}
 finally{capture.prepareMemberResponsibility=original;l.dispose();t.destroy();}
});

it('keyed creation rollback and dormant reuse preserve source identity without fresh allocation',()=>{
 const {t,rows,l,rt}=setup();try{let held:Child|undefined;const q=t.transact(()=>{held=materializeMember(rows,'a',{n:7,more:8}) as Child;});expect(rows()).toEqual({a:{n:7,more:8}});const count=rt.slotCount();q.rollback();expect(rows()).toEqual({});const reused=materializeMember(rows,'a',{n:9,more:10});expect(reused).toBe(held);expect(rt.slotCount()).toBe(count);expect(rows()).toEqual({a:{n:9,more:10}});}finally{l.dispose();t.destroy();}
});

it('keyed recursive construction failure after first leaf releases only its own provisional resources',()=>{
 const {t,rows,l,rt}=setup();const before=rt.slotCount();const fail=Error('later recursive getter');
 try{expect(()=>materializeMember(rows,'a',{n:1,deep:{get bad():number{throw fail;}}})).toThrow(fail);expect(rt.slotCount()).toBe(before);expect(rows()).toEqual({});const retry=materializeMember(rows,'a',{n:7,more:8}) as Child;expect(retry.n()).toBe(7);expect(rt.slotCount()).toBe(before+2);}
 finally{l.dispose();t.destroy();}
});
