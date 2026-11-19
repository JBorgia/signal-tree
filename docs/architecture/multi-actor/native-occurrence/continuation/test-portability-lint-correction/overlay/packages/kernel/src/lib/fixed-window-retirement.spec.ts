import {expect,it,vi} from 'vitest';
import { writeDiagnostic } from '../../test/optional-diagnostic';
import {entityMap,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getPathNotifier} from './path-notifier';
import {getPositionRegistry} from './internals/position-registry';
import {withWriteContext} from './write-context';
import * as life from './experimental-publication/lifecycle';
const diagnosticDirectory=process.env['ST_FIXED_WINDOW_OUTPUT'];
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
const make=()=>signalTree({rows:entityMap<{id:string;n:number},string>()});
const owner=()=>signalTree({x:0},{enhancers:[transactions()]});
const setup=async()=>{const tree=make();tree.$.rows.addOne({id:'a',n:1});await flush();const row=tree.$.rows.byIdOrFail('a');const b=getEntityPublicationBinding(row)!;return {tree,row,source:b.source,id:b.subject!};};
for(const outcome of ['confirm','rollback'] as const)it(`own-W terminal retirement preserves issued fact and all eight map drain: ${outcome}`,async()=>{
 const {tree,row,source,id}=await setup(),o=owner();const q=o.transact(()=>o.$.x(7));tree.$.rows.removeOne('a');await flush();
 const fact=source.evidence()!.member(id,'ordinary') as life.NativeRequirement;const proof=life.nativeProof(fact);
 try{expect(fact.retirementOwnWindowOnly).toBe(true);expect(source.inspect().negativePresence).toBe(1);expect(source.inspect().retirementRequests).toBe(1);expect(proof.possible?.[0].outcome).toBe('pending');q[outcome]();expect(source.inspect().negativePresence).toBe(1);await flush();
 for(const key of ['rows','fields','presence','visible','placements','viewRows','viewFields','placementViews','mappings','mappingViews','retirementRequests'])expect(source.inspect()[key],key).toBe(0);
 expect(source.inspect().retireCalls).toBe(1);expect(source.evidence()!.member(id,'ordinary')).not.toBe(fact);expect(life.nativeProof(fact)).toBe(proof);expect(proof.unknown).toBe(true);expect(proof.possible).toHaveLength(1);expect(row()).toBeUndefined();
 }finally{tree.destroy();o.destroy();}
});
it('two captured cells wait separately; later owner and dormant recipients do not extend the window',async()=>{
 const {tree,source}=await setup(),a=owner(),b=owner(),late=owner();const p=a.transact(()=>a.$.x(1)),q=b.transact(()=>b.$.x(2));
 try{tree.$.rows.removeOne('a');await flush();expect(source.inspect().retirementRequests).toBe(1);const r=late.transact(()=>late.$.x(3));p.confirm();await flush();expect(source.inspect().negativePresence).toBe(1);q.rollback();await flush();expect(source.inspect().negativePresence).toBe(0);expect(late.$.x()).toBe(3);r.confirm();}finally{tree.destroy();a.destroy();b.destroy();late.destroy();}
});
for(const cause of ['external','foreign-callback'] as const)it(`non-window source cause remains after terminality: ${cause}`,async()=>{
 const {tree,source,id}=await setup(),o=owner();let q:ReturnType<typeof o.transact>;
 if(cause==='external'){q=o.transact(()=>o.$.x(7));withWriteContext({origin:'external'},()=>tree.$.rows.removeOne('a'));}else q=o.transact(()=>tree.$.rows.removeOne('a'));
 const fact=source.evidence()!.member(id,'ordinary') as life.NativeRequirement;
 try{await flush();expect(fact.retirementOwnWindowOnly).toBe(false);q.confirm();await flush();expect(source.evidence()!.member(id,'ordinary')).toBe(fact);expect(source.inspect().negativePresence).toBe(1);expect(source.inspect().retirementRequests).toBe(0);
 writeDiagnostic(diagnosticDirectory ? `${diagnosticDirectory}/provenance-${cause}.json` : undefined,JSON.stringify({rawUnknown:fact.unknown,ownWindowOnly:fact.retirementOwnWindowOnly,captureWindow:fact.captureWindow,proof:{...life.nativeProof(fact),possible:life.nativeProof(fact).possible?.map(c=>({owner:c.owner,id:c.id,outcome:c.outcome}))}},(_key,value)=>value instanceof Set?[...value]:value,2)+'\n');
 }finally{tree.destroy();o.destroy();}
});
it('owner disappearance retains exact unresolved proof but drops unavailable subscription',async()=>{
 const {tree,source,id}=await setup(),o=owner();o.transact(()=>o.$.x(7));tree.$.rows.removeOne('a');await flush();const fact=source.evidence()!.member(id,'ordinary') as life.NativeRequirement;
 try{expect(source.inspect().retirementRequests).toBe(1);o.destroy();await flush();expect(source.inspect().retirementRequests).toBe(0);expect(source.evidence()!.member(id,'ordinary')).toBe(fact);expect(life.nativeProof(fact).possible?.[0].outcome).toBe('pending');expect(source.inspect().negativePresence).toBe(1);}finally{tree.destroy();o.destroy();}
});
for(const stop of ['destroy','replace'] as const)it(`cancels exact transition subscription on ${stop}`,async()=>{
 const {tree,source,id}=await setup(),o=owner();const q=o.transact(()=>o.$.x(7));let live=0,cancelled=0;
 const original=life.onOwnerCellTransition;const spy=vi.spyOn(life,'onOwnerCellTransition').mockImplementation((cell,cb)=>{live++;const off=original(cell,cb);let active=true;return()=>{off();if(active){active=false;live--;cancelled++;}};});
 try{tree.$.rows.removeOne('a');await flush();expect(live).toBe(1);if(stop==='destroy')tree.destroy();else source.requestRetirement(id,()=>false);await flush();expect(live).toBe(0);expect(cancelled).toBe(1);q.confirm();await flush();expect(source.inspect().retireCalls).toBe(0);}finally{spy.mockRestore();tree.destroy();o.destroy();}
});
it('queued settlement cannot delete a new lifetime at the same key',async()=>{
 const {tree,source,row}=await setup(),o=owner();const q=o.transact(()=>o.$.x(7));
 try{tree.$.rows.removeOne('a');await flush();q.confirm();tree.$.rows.addOne({id:'a',n:99});await flush();expect(row()).toBeUndefined();expect(tree.$.rows.byIdOrFail('a')).not.toBe(row);expect(tree.$.rows.byIdOrFail('a').n()).toBe(99);expect(source.inspect().presence).toBe(1);expect(source.inspect().negativePresence).toBe(0);}finally{tree.destroy();o.destroy();}
});
it('installed completion throw retains settlement request; stale prepared reader refuses after release',async()=>{
 const {tree,source}=await setup(),o=owner();const q=o.transact(()=>o.$.x(7));const error=Object.freeze({sentinel:'complete'});
 const off=source.subscribe({prepare:p=>p.physical.some(e=>e.structural?.kind==='remove')?{record:{writes:[],adds:[]},completion:{}}:undefined,complete(){throw error;}});
 try{let caught:unknown;try{tree.$.rows.removeOne('a');}catch(e){caught=e;}expect(caught).toBe(error);off();await flush();expect(source.inspect().retirementRequests).toBe(1);const unit=source.prepare({owner:0,id:{},meta:undefined,physical:[],ordinary:[]})!;q.confirm();await flush();expect(source.inspect().presence).toBe(0);expect(()=>unit.finalize?.()).toThrow('changed before installation');}finally{off();tree.destroy();o.destroy();}
});
it('transition listener is queued, exact, race-safe and cancellable',async()=>{
 const o=owner(),other=owner();const q=o.transact(()=>o.$.x(7)),r=other.transact(()=>other.$.x(8));const cells=life.pendingOwners();const cell=cells.find(c=>c.owner===getPositionRegistry(o.$)!.id)!;let count=0;
 const off=life.onOwnerCellTransition(cell,()=>{count++;});
 try{r.confirm();await flush();expect(count).toBe(0);q.confirm();expect(count).toBe(0);await flush();expect(count).toBe(1);let late=0;const cancel=life.onOwnerCellTransition(cell,()=>{late++;});cancel();await flush();expect(late).toBe(0);}finally{off();o.destroy();other.destroy();}
});
it('local pending removal keeps recovery authority and restores its exact lifetime',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;n:number},string>()},{enhancers:[transactions()]});tree.$.rows.addOne({id:'a',n:1});await flush();const row=tree.$.rows.byIdOrFail('a'),b=getEntityPublicationBinding(row)!,s=b.source;
 try{const q=tree.transact(()=>tree.$.rows.removeOne('a'));await flush();const fact=s.evidence()!.member(b.subject!,'ordinary') as life.NativeRequirement;expect(fact.retirementOwnWindowOnly).toBe(false);expect(life.nativeProof(fact).owners.some(c=>c.outcome==='pending')).toBe(true);expect(s.inspect().retireCalls).toBe(0);q.rollback();await flush();expect(tree.$.rows.byIdOrFail('a')).toBe(row);expect(row.n()).toBe(1);expect(s.inspect().presence).toBe(1);expect(s.inspect().retireCalls).toBe(0);}finally{tree.destroy();}
});
it('inherited unknown input is not reclassified as an own window',async()=>{
 const {tree,source,id}=await setup(),o=owner(),input=signalTree({x:0});withWriteContext({origin:'external'},()=>input.$.x(4));const q=o.transact(()=>o.$.x(7));
 try{input.updateAndReport(value=>{expect(value.x).toBe(4);tree.$.rows.removeOne('a');return {};});await flush();const fact=source.evidence()!.member(id,'ordinary') as life.NativeRequirement;expect(fact.retirementOwnWindowOnly).toBe(false);q.confirm();await flush();expect(source.evidence()!.member(id,'ordinary')).toBe(fact);expect(source.inspect().negativePresence).toBe(1);expect(source.inspect().retirementRequests).toBe(0);}finally{tree.destroy();o.destroy();input.destroy();}
});
it('actual rejected input is retained rather than discharged like possible W',async()=>{
 const {tree,source,id}=await setup(),input=owner();const q=input.transact(()=>input.$.x(7));
 try{input.updateAndReport(value=>{expect(value.x).toBe(7);tree.$.rows.removeOne('a');return {};});await flush();const fact=source.evidence()!.member(id,'ordinary') as life.NativeRequirement;const proof=life.nativeProof(fact);expect(fact.retirementOwnWindowOnly).toBe(false);expect(proof.input?.some(cell=>cell.outcome==='pending')).toBe(true);q.rollback();await flush();expect(proof.input?.some(cell=>cell.outcome==='rolled-back')).toBe(true);expect(source.evidence()!.member(id,'ordinary')).toBe(fact);expect(source.inspect().negativePresence).toBe(1);expect(source.inspect().retireCalls).toBe(0);}finally{tree.destroy();input.destroy();}
});
