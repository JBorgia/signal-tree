import {writeFileSync} from 'node:fs';
import {afterAll,expect,it,vi} from 'vitest';
import {entityMap,link,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import * as life from './experimental-publication/lifecycle';
import {getPathNotifier} from './path-notifier';
type Declared=ReturnType<typeof link>&{declare(d:{kind:'independent'},work:()=>void):unknown};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
const traces:unknown[]=[];afterAll(()=>writeFileSync(process.env.TMPDIR+'/whole-qualification.json',JSON.stringify(traces,null,2)));
function evidence(row:object,key:string){const b=getEntityPublicationBinding(row)!;return b.source.evidence()!.field(b.subject!,key,'ordinary') as life.NativeRequirement;}
for(const route of ['setAll','replaceOne','row'] as const)for(const pending of [false,true])it(`post-install whole error ${route} pending=${pending}`,async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]}),foreign=signalTree({z:0},{enhancers:[transactions()]});const rows=t.$.rows;rows.addOne({id:'a',x:7});await flush();const row=rows.byIdOrFail('a'),before=evidence(row,'x');const sent:unknown[]=[];const c=link(rows,{set:v=>{sent.push(v);}}) as Declared;const off=row.x.subscribe(()=>{/* Keep the field subscribed without observing its value here. */}),starts=vi.spyOn(life,'started');const q=pending?foreign.transact(()=>foreign.$.z(9)):undefined;const inspection=q?.inspect();let calls=0,atThrow:life.NativeRequirement|undefined,caught:unknown;const sentinel=Error('post-install getter');const supplied={id:'a',get x(){if(++calls===7){atThrow=evidence(row,'x');throw sentinel;}return 7;}};
 try{try{c.declare({kind:'independent'},()=>{if(route==='setAll')rows.setAll([supplied]);else if(route==='replaceOne')rows.replaceOne('a',supplied);else row(supplied);});}catch(e){caught=e;}
  expect(caught).toBe(sentinel);expect(atThrow).toBeDefined();expect(atThrow).not.toBe(before);expect(evidence(row,'x')).toBe(atThrow);expect(life.nativeRequirementReady(atThrow!)).toBe(true);expect(life.nativeProof(atThrow!).invalid).toBe(true);expect(sent).toEqual([]);
  await flush();expect(sent).toEqual(pending?[]:[[{id:'a',x:7}]]);if(q){expect(q.inspect()).toEqual(inspection);expect(life.nativeProof(atThrow!).possible?.some(o=>o.outcome==='pending')).toBe(true);q.confirm();await flush();expect(sent).toEqual([[{id:'a',x:7}]]);}
  expect(starts.mock.calls).toHaveLength(1);expect(starts.mock.calls[0][2]).toBe('surviving');expect(row.x()).toBe(7);
 }finally{starts.mockRestore();off();c.dispose();t.destroy();foreign.destroy();}
});
for(const supplied of [true,false])it(`whole own undefined versus deletion supplied=${supplied}`,async()=>{
 const t=signalTree({rows:entityMap<{id:string;u?:number},string>()}),foreign=signalTree({z:0},{enhancers:[transactions()]});const rows=t.$.rows;rows.addOne({id:'a',u:1});await flush();const row=rows.byIdOrFail('a'),sent:unknown[]=[];const c=link(rows,{set:v=>{sent.push(v);}}) as Declared;const q=foreign.transact(()=>foreign.$.z(9));
 try{rows.updateOne('a',{u:undefined});await flush();expect(sent).toEqual([]);const old=evidence(row,'u');c.declare({kind:'independent'},()=>rows.replaceOne('a',supplied?{id:'a',u:undefined}:{id:'a'}));await flush();expect(Object.prototype.hasOwnProperty.call(row(),'u')).toBe(supplied);expect(evidence(row,'u')).not.toBe(old);expect(sent).toHaveLength(1);expect(Object.prototype.hasOwnProperty.call((sent[0] as object[])[0],'u')).toBe(supplied);q.rollback();await flush();expect(Object.prototype.hasOwnProperty.call(row(),'u')).toBe(supplied);
 }finally{c.dispose();t.destroy();foreign.destroy();}
});
it('real remove and readd at same key selects the fresh lifetime and support',async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number},string>()}),foreign=signalTree({z:0},{enhancers:[transactions()]});const rows=t.$.rows;rows.addOne({id:'a',x:0});await flush();const old=rows.byIdOrFail('a'),oldId=getEntityPublicationBinding(old)!.subject;const sent:unknown[]=[];const c=link(rows,{set:v=>{sent.push(v);}}) as Declared;const q=foreign.transact(()=>foreign.$.z(9));
 try{rows.updateOne('a',{x:7});await flush();expect(sent).toEqual([]);c.declare({kind:'independent'},()=>{rows.removeOne('a');rows.addOne({id:'a',x:7});});await flush();const fresh=rows.byIdOrFail('a');expect(getEntityPublicationBinding(fresh)!.subject).not.toBe(oldId);expect(fresh).not.toBe(old);expect(life.nativeProof(evidence(fresh,'x')).unknown).toBe(false);expect(sent.at(-1)).toEqual([{id:'a',x:7}]);q.rollback();await flush();expect(fresh.x()).toBe(7);expect(rows.byIdOrFail('a')).toBe(fresh);
 }finally{c.dispose();t.destroy();foreign.destroy();}
});
it('whole authorship without a collection recipient refreshes native evidence before late enrollment',async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number;y:number},string>(),bridge:0}),foreign=signalTree({z:0},{enhancers:[transactions()]});const rows=t.$.rows;rows.addOne({id:'a',x:0,y:0});await flush();const row=rows.byIdOrFail('a');const bridge=link(t.$.bridge,{set:()=>{/* This fixture intentionally discards destination values. */}}) as Declared;const q=foreign.transact(()=>foreign.$.z(9));let late:ReturnType<typeof link>|undefined;
 try{rows.updateOne('a',{x:7});const previous=evidence(row,'x');expect(life.nativeProof(previous).unknown).toBe(true);bridge.declare({kind:'independent'},()=>rows.replaceOne('a',{id:'a',x:7,y:0}));expect(evidence(row,'x')).not.toBe(previous);expect(life.nativeProof(evidence(row,'x')).unknown).toBe(false);const sent:unknown[]=[];late=link(rows,{set:v=>{sent.push(v);}});bridge.declare({kind:'independent'},()=>rows.updateOne('a',{y:1}));await flush();expect(sent).toEqual([[{id:'a',x:7,y:1}]]);expect(foreign.$.z()).toBe(9);
 }finally{late?.dispose();bridge.dispose();q.rollback();t.destroy();foreign.destroy();}
});
for(const otherPending of [false,true])it(`terminal owner characterization otherPending=${otherPending}`,async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number;y:number},string>()},{enhancers:[transactions()]});const rows=t.$.rows;rows.addOne({id:'a',x:0,y:0});await flush();const row=rows.byIdOrFail('a'),c=link(rows,{set:()=>{/* This fixture intentionally discards destination values. */}}) as Declared;const q=t.transact(()=>rows.updateOne('a',{x:7}));q.confirm();await flush();const before=evidence(row,'x');const r=otherPending?t.transact(()=>rows.updateOne('a',{y:1})):undefined;const y=evidence(row,'y');
 try{c.declare({kind:'independent'},()=>rows.replaceOne('a',{id:'a',x:7,y:otherPending?1:0}));await flush();traces.push({case:'terminal',otherPending,sameEndpoint:evidence(row,'x')===before,beforeDestination:life.nativeProof(before).destination?.map(o=>o.outcome)??[],afterDestination:life.nativeProof(evidence(row,'x')).destination?.map(o=>o.outcome)??[]});if(r){expect(evidence(row,'y')).toBe(y);r.rollback();await flush();}expect(row()).toEqual({id:'a',x:7,y:0});
 }finally{c.dispose();t.destroy();}
});
