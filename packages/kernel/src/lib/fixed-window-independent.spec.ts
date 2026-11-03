import {expect,it} from 'vitest';
import {entityMap,link,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getPositionRegistry} from './internals/position-registry';
import {getPathNotifier} from './path-notifier';
import * as life from './experimental-publication/lifecycle';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
const owner=()=>signalTree({x:0},{enhancers:[transactions()]});
const setup=async()=>{const tree=signalTree({rows:entityMap<{id:string;n:number},string>()});tree.$.rows.addOne({id:'a',n:1});await flush();const row=tree.$.rows.byIdOrFail('a'),b=getEntityPublicationBinding(row)!;return {tree,row,s:b.source,id:b.subject!};};
type Receipt={read():Readonly<{state:string;reason?:string;basis?:string}>};
type Declared=ReturnType<typeof link>&{declare(input:{kind:'independent'},body:()=>unknown):Receipt};
const consume=(tree:ReturnType<typeof signalTree<{rows:ReturnType<typeof entityMap<{id:string;n:number},string>>}>>,target:ReturnType<typeof owner>)=>tree.updateAndReport(input=>{const rows=(input as unknown as {rows:{all:unknown[]}}).rows.all;expect(rows).toEqual([]);target.$.x(rows.length+1);return {};});
// Runtime-backed cancellation falsifier: no synthetic owner cells.
it('repeated cancellation of an old exact-cell observer cannot detach a newer observer',async()=>{
 const o=owner(),q=o.transact(()=>o.$.x(7));let calls=0;
 // Find exact cell without assuming the public handle exposes its native id.
 const actual=life.pendingOwners().find(c=>c.owner===getPositionRegistry(o.$)!.id)!;
 const old=life.onOwnerCellTransition(actual,()=>{});old();const next=life.onOwnerCellTransition(actual,()=>{calls++;});
 try{old();q.confirm();expect(calls).toBe(0);await flush();expect(calls).toBe(1);}finally{next();o.destroy();}
});
for(const first of ['confirm','rollback'] as const)it(`late enrollment retains two captured owners and excludes later window: ${first}`,async()=>{
 const {tree,s,id}=await setup(),a=owner(),b=owner(),later=owner(),target=owner();const p=a.transact(()=>a.$.x(7)),q=b.transact(()=>b.$.x(9));let c:Declared|undefined;
 try{tree.$.rows.removeOne('a');await flush();const fact=s.evidence()!.member(id,'ordinary') as life.NativeRequirement;expect(fact.retirementOwnWindowOnly).toBe(true);expect(life.nativeProof(fact).possible).toHaveLength(2);const r=later.transact(()=>later.$.x(11)),rBefore=r.inspect();const sent:number[]=[];c=link(target.$.x,{set:v=>{sent.push(v);}}) as Declared;const receipt=c.declare({kind:'independent'},()=>consume(tree,target));await flush();expect(sent).toEqual([]);p[first]();await flush();expect(sent).toEqual([]);expect(s.inspect().negativePresence).toBe(1);q.confirm();await flush();expect(sent).toEqual([1]);expect(s.inspect().negativePresence).toBe(0);expect(r.inspect()).toEqual(rBefore);const saved=receipt.read();expect(saved).toMatchObject({state:'started',basis:'surviving'});tree.destroy();await flush();expect(receipt.read()).toBe(saved);expect(life.nativeProof(fact).unknown).toBe(true);expect(life.nativeProof(fact).possible).toHaveLength(2);r.confirm();}finally{c?.dispose();tree.destroy();a.destroy();b.destroy();later.destroy();target.destroy();}
});
it('disappeared pending owner retains negative evidence for a newly enrolled reader',async()=>{
 const {tree,s,id}=await setup(),o=owner(),target=owner();o.transact(()=>o.$.x(7));let c:Declared|undefined;
 try{tree.$.rows.removeOne('a');await flush();const fact=s.evidence()!.member(id,'ordinary') as life.NativeRequirement;const cell=life.nativeProof(fact).possible![0];o.destroy();await flush();expect(cell.outcome).toBe('pending');expect(life.ownerCellCanTransition(cell)).toBe(false);expect(s.inspect().retirementRequests).toBe(0);const sent:number[]=[];c=link(target.$.x,{set:v=>{sent.push(v);}}) as Declared;const receipt=c.declare({kind:'independent'},()=>consume(tree,target));await flush();expect(sent).toEqual([]);expect(receipt.read()).toMatchObject({state:'conservative',reason:'unknown'});expect(s.evidence()!.member(id,'ordinary')).toBe(fact);expect(s.inspect().negativePresence).toBe(1);tree.destroy();await flush();expect(s.inspect().retireCalls).toBe(0);expect(life.nativeProof(fact).possible![0]).toBe(cell);}finally{c?.dispose();tree.destroy();o.destroy();target.destroy();}
});
it('native abandoned outcome is not treated as confirmed or rejected-window discharge',async()=>{
 const {tree,s,id}=await setup(),o=owner();o.transact(()=>o.$.x(7));
 try{tree.$.rows.removeOne('a');await flush();const fact=s.evidence()!.member(id,'ordinary') as life.NativeRequirement;const cell=life.nativeProof(fact).possible![0];life.ownerTransition(cell.owner,{kind:'abandoned',transactionId:cell.id});await flush();expect(cell.outcome).toBe('abandoned');expect(s.evidence()!.member(id,'ordinary')).toBe(fact);expect(s.inspect().negativePresence).toBe(1);expect(s.inspect().retirementRequests).toBe(0);expect(s.inspect().retireCalls).toBe(0);}finally{tree.destroy();o.destroy();}
});
it('queued earlier transition observer reentry cannot retire a fresh same-key lifetime',async()=>{
 const {tree,row,s}=await setup(),o=owner();const q=o.transact(()=>o.$.x(7)),cell=life.pendingOwners().find(c=>c.owner===getPositionRegistry(o.$)!.id)!;let calls=0;
 const cancel=life.onOwnerCellTransition(cell,()=>{calls++;tree.$.rows.addOne({id:'a',n:99});});
 try{tree.$.rows.removeOne('a');await flush();q.confirm();expect(calls).toBe(0);await flush();expect(calls).toBe(1);expect(tree.$.rows.byIdOrFail('a')).not.toBe(row);expect(row()).toBeUndefined();expect(tree.$.rows.byIdOrFail('a').n()).toBe(99);expect(s.inspect().presence).toBe(1);expect(s.inspect().negativePresence).toBe(0);}finally{cancel();tree.destroy();o.destroy();}
});
it('destroy cancels already queued retirement notification without rewriting issued metadata',async()=>{
 const {tree,s,id}=await setup(),o=owner();const q=o.transact(()=>o.$.x(7));
 try{tree.$.rows.removeOne('a');await flush();const fact=s.evidence()!.member(id,'ordinary') as life.NativeRequirement,proof=life.nativeProof(fact);q.confirm();tree.destroy();await flush();expect(s.inspect().retirementRequests).toBe(0);expect(s.inspect().retireCalls).toBe(0);expect(life.nativeProof(fact)).toBe(proof);expect(proof.unknown).toBe(true);expect(proof.possible![0].outcome).toBe('confirmed');}finally{tree.destroy();o.destroy();}
});
it('stale cancellation cannot strand a real source retirement registered later for the same cell',async()=>{
 const {tree,s}=await setup(),o=owner(),q=o.transact(()=>o.$.x(7));const cell=life.pendingOwners().find(c=>c.owner===getPositionRegistry(o.$)!.id)!;
 const cancelOld=life.onOwnerCellTransition(cell,()=>{});cancelOld();
 try{tree.$.rows.removeOne('a');await flush();expect(s.inspect().retirementRequests).toBe(1);expect(s.inspect().negativePresence).toBe(1);cancelOld();q.confirm();await flush();expect(cell.outcome).toBe('confirmed');expect(s.inspect().negativePresence).toBe(0);expect(s.inspect().retirementRequests).toBe(0);}finally{tree.destroy();o.destroy();}
});
for(const role of ['input','validation'] as const)it(`confirmed actual ${role} is not released through the own-window class`,async()=>{
 const {tree,s,id}=await setup(),o=owner(),q=o.transact(()=>o.$.x(7));let c:(ReturnType<typeof link>&{declare(input:{kind:'dependent';owners:readonly object[]},body:()=>unknown):Receipt})|undefined;
 try{if(role==='input')o.updateAndReport(value=>{expect(value.x).toBe(7);tree.$.rows.removeOne('a');return {};});else{c=link(tree.$.rows,{set:()=>{}}) as typeof c;c!.declare({kind:'dependent',owners:[q]},()=>tree.$.rows.removeOne('a'));}await flush();const fact=s.evidence()!.member(id,'ordinary') as life.NativeRequirement,proof=life.nativeProof(fact);expect(fact.retirementOwnWindowOnly).toBe(false);expect(proof[role]?.some(cell=>cell.outcome==='pending')).toBe(true);q.confirm();await flush();expect(proof[role]?.some(cell=>cell.outcome==='confirmed')).toBe(true);expect(s.evidence()!.member(id,'ordinary')).toBe(fact);expect(s.inspect().negativePresence).toBe(1);expect(s.inspect().retireCalls).toBe(0);}finally{c?.dispose();tree.destroy();o.destroy();}
});
