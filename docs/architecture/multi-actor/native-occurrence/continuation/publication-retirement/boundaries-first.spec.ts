import {expect,it,vi} from 'vitest';
import {entityMap,link,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getPathNotifier} from './path-notifier';
import * as lifecycle from './experimental-publication/lifecycle';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
const make=()=>signalTree({rows:entityMap<{id:string;n:number},string>()});
const sourceOf=(node:object)=>getEntityPublicationBinding(node)!.source;
type Declared=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):{read():{state:string}}};

it('retirement releases both key requirements, not just their reported counts',async()=>{
 const tree=make(),rows=tree.$.rows;rows.addOne({id:'a',n:1});await flush();const b=getEntityPublicationBinding(rows.byIdOrFail('a'))!,s=b.source;
 const ordinary=s.evidence()!.keyMapping(b.subject!,'ordinary'),physical=s.evidence()!.keyMapping(b.subject!,'physical');
 try{rows.removeOne('a');await flush();expect(s.inspect().mappings).toBe(0);expect(s.inspect().mappingViews).toBe(0);expect(s.evidence()!.keyMapping(b.subject!,'ordinary')).not.toBe(ordinary);expect(s.evidence()!.keyMapping(b.subject!,'physical')).not.toBe(physical);}finally{tree.destroy();}
});
it('closed clean horizon drains only after completion, preserving a caught completion error',async()=>{
 const tree=make(),rows=tree.$.rows;rows.addOne({id:'a',n:1});await flush();const s=sourceOf(rows);const c=link(rows,{set:()=>{}}) as Declared;const primary=new Error('completion');let calls=0;
 const off=s.subscribe({prepare:p=>p.physical.some(e=>e.structural?.kind==='remove')?{record:{writes:[],adds:[]},completion:{}}:undefined,complete(){calls++;throw primary;}});
 try{c.declare({kind:'independent'},()=>{let caught:unknown;try{rows.removeOne('a');}catch(e){caught=e;}expect(caught).toBe(primary);expect(calls).toBe(1);expect(s.inspect().presence).toBe(1);expect(s.inspect().retireCalls).toBe(0);});await flush();expect(s.inspect().presence).toBe(0);expect(s.inspect().retirementRequests).toBe(0);}finally{off();c.dispose();tree.destroy();}
});
it('retirement invalidates a prepared source reader at pre-install finalization',async()=>{
 const tree=make(),rows=tree.$.rows;rows.addOne({id:'a',n:1});await flush();const s=sourceOf(rows);
 try{rows.removeOne('a');const revision=s.revision();const unit=s.prepare({owner:0,id:{},meta:undefined,physical:[],ordinary:[]})!;await flush();expect(s.inspect().presence).toBe(0);expect(s.revision()).not.toBe(revision);expect(()=>unit.finalize?.()).toThrow('changed before installation');}finally{tree.destroy();}
});
it('destruction cancels a queued exact-subject retirement request',async()=>{
 const tree=make(),rows=tree.$.rows;rows.addOne({id:'a',n:1});await flush();const s=sourceOf(rows);rows.removeOne('a');expect(s.inspect().retirementRequests).toBe(1);tree.destroy();expect(s.inspect().retirementRequests).toBe(0);await flush();expect(s.inspect().retireCalls).toBe(0);
});
for(const outcome of ['confirm','rollback'] as const)it(`foreign absence is not discharged by owner ${outcome}`,async()=>{
 const owner=signalTree({n:0},{enhancers:[transactions()]});const tree=make(),rows=tree.$.rows;rows.setAll([{id:'a',n:1},{id:'b',n:1}]);await flush();const q=owner.transact(()=>rows.removeOne('a'));q[outcome]();await flush();const sent:unknown[]=[];const c=link(rows,{set:v=>{sent.push(v);}}) as Declared;
 try{const receipt=c.declare({kind:'independent'},()=>rows.updateOne('b',{n:2}));await flush();expect(rows.byIdOrFail('b').n()).toBe(2);expect(sent).toEqual([]);expect(receipt.read().state).toBe('conservative');expect(sourceOf(rows).inspect().negativePresence).toBe(1);}finally{c.dispose();tree.destroy();owner.destroy();}
});

// Mechanical scheduler control: hold the existing readiness seam pending, then
// explicitly deliver/cancel it. This is not an owner-settlement simulation.
for(const disposition of ['ready','dispose','replace'] as const)it(`exact readiness subscription releases on ${disposition}`,async()=>{
 const tree=make(),rows=tree.$.rows;rows.addOne({id:'a',n:1});await flush();const b=getEntityPublicationBinding(rows.byIdOrFail('a'))!,s=b.source;rows.removeOne('a');
 let ready=false;const callbacks=new Set<()=>void>();let cancellations=0;
 const readySpy=vi.spyOn(lifecycle,'nativeRequirementReady').mockImplementation(()=>ready);
 const subscribeSpy=vi.spyOn(lifecycle,'onNativeRequirementReady').mockImplementation((_r,callback)=>{callbacks.add(callback);return()=>{if(callbacks.delete(callback))cancellations++;};});
 try{await flush();expect(callbacks.size).toBeGreaterThan(0);const acquired=callbacks.size;expect(s.inspect().retirementRequests).toBe(1);
  if(disposition==='dispose')tree.destroy();
  else if(disposition==='replace')s.requestRetirement(b.subject!,()=>false);
  else {ready=true;for(const callback of [...callbacks])callback();}
  await flush();expect(callbacks.size).toBe(0);expect(cancellations).toBe(acquired);expect(s.inspect().retirementRequests).toBe(0);expect(s.inspect().retireCalls).toBe(disposition==='ready'?1:0);
 }finally{readySpy.mockRestore();subscribeSpy.mockRestore();tree.destroy();}
});
