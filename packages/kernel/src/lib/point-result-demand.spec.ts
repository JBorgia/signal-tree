import {expect,it} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';
import {getEntityPublicationBinding,entityPublicationOrdinary,type EntityPublicationPacket} from './internals/entity-publication';
import {withWriteContext} from './write-context';
it('point adoption still completes synthetic ordinary add and source support',()=>{
 const t=signalTree({rows:entityMap<{id:string;n:number},string>()});const r=t.$.rows;r.addOne({id:'a',n:1});withWriteContext({participation:'inspection'},()=>r.addOne({id:'hidden',n:99}));const b=getEntityPublicationBinding(r.byIdOrFail('hidden'))!;let seen:EntityPublicationPacket|undefined;
 const off=b.source.subscribe({prepare(p){seen=p;return undefined;},complete(){ /* This participant has no completion side effect. */ }});
 try{r.updateOne('hidden',{n:7});expect(r.byIdOrFail('hidden').n()).toBe(7);expect(seen).toBeDefined();const edits=entityPublicationOrdinary(seen!);expect(edits.some(e=>e.subject===b.subject&&e.structural?.kind==='add')).toBe(true);expect(b.source.evidence()!.field(b.subject!,'n','ordinary')).toBeDefined();expect(r.byIdOrFail('a').n()).toBe(1);}finally{off();t.destroy();}
});
it('rich inverse frame retains repeated-subject facts and original handle through rollback',()=>{
 const t=signalTree({rows:entityMap<{id:string;n:number},string>()},{enhancers:[transactions()]});const r=t.$.rows;r.setAll([{id:'a',n:1},{id:'b',n:2}]);const a=r.byIdOrFail('a'),b=r.byIdOrFail('b');const source=getEntityPublicationBinding(a)!.source;const packets:EntityPublicationPacket[]=[];const off=source.subscribe({prepare(p){packets.push(p);return undefined;},complete(){ /* This participant has no completion side effect. */ }});
 try{const q=t.transact(()=>{r.updateOne('a',{n:7});r.updateOne('a',{n:11});r.updateOne('b',{n:8});});expect([a.n(),b.n()]).toEqual([11,8]);packets.length=0;q.rollback();expect([a.n(),b.n()]).toEqual([1,2]);expect(r.byIdOrFail('a')).toBe(a);expect(packets.length).toBeGreaterThan(0);expect(packets.flatMap(p=>entityPublicationOrdinary(p))).not.toHaveLength(0);r.updateOne('a',{n:12});expect(a.n()).toBe(12);}finally{off();t.destroy();}
});
it('recipient preparation reentry refuses stale point installation and keeps nested source facts',()=>{
 const t=signalTree({rows:entityMap<{id:string;n:number},string>()});const r=t.$.rows;r.addOne({id:'a',n:1});const row=r.byIdOrFail('a'),s=getEntityPublicationBinding(row)!.source;let entered=false;
 const off=s.subscribe({prepare(){if(!entered){entered=true;r.updateOne('a',{n:99});}return undefined;},complete(){ /* This participant has no completion side effect. */ }});
 try{expect(()=>r.updateOne('a',{n:7})).toThrow('Entity publication source changed during preparation');expect(entered).toBe(true);expect(row.n()).toBe(99);off();r.updateOne('a',{n:11});expect(row.n()).toBe(11);}finally{off();t.destroy();}
});
