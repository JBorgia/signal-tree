import {it,expect} from 'vitest';
import { writeDiagnostic } from '../../test/optional-diagnostic';
import {entityMap,signalTree,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
it('selected field plus surviving-row order restores the complete transaction',async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});
 const rows=t.$.rows;rows.setAll([{id:'a',x:0},{id:'b',x:0}]);await flush();
 const q=t.transact(()=>{rows.updateOne('a',{x:7});rows.setAll([{id:'b',x:0},{id:'a',x:7}]);});await flush();
 try{
  const pending=rows.all();let error:unknown;try{q.rollback();}catch(e){error=e;}await flush();const after=rows.all();
  let confirmError:unknown;try{q.confirm();}catch(e){confirmError=e;}
  writeDiagnostic(process.env['ST_PREPARED_REVIEW_OUTPUT'] ? process.env['ST_PREPARED_REVIEW_OUTPUT']+'/field-order.json' : undefined,JSON.stringify({pending,after,error:String(error),confirmError:String(confirmError)},null,2));
  expect(pending).toEqual([{id:'b',x:0},{id:'a',x:7}]);expect(error).toBeUndefined();expect(after).toEqual([{id:'a',x:0},{id:'b',x:0}]);
 }finally{t.destroy();}
});

import {withWriteContext} from './write-context';
import {getEntityPublicationBinding,type EntityPublicationPacket} from './internals/entity-publication';
for(const order of ['xy','yx'] as const)it(`producer ordinary images exclude untouched inspection sibling ${order}`,async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number;y:number;z:number},string>()},{enhancers:[transactions()]});const r=t.$.rows;r.addOne({id:'a',x:0,y:0,z:7});await flush();
 const row=r.byIdOrFail('a');withWriteContext({participation:'inspection'},()=>r.updateOne('a',{z:99}));
 const q=t.transact(()=>{for(const k of order)r.updateOne('a',k==='x'?{x:7}:{y:11});});await flush();
 const packets:EntityPublicationPacket[]=[];const off=getEntityPublicationBinding(row)!.source.subscribe({prepare(p){packets.push(p);return undefined;},complete(){ /* Packet capture happens during preparation only. */ }});
 try{q.rollback();const data=packets.map(p=>({physical:p.physical,ordinary:p.ordinary,steps:p.steps}));writeDiagnostic(process.env['ST_PREPARED_REVIEW_OUTPUT'] ? process.env['ST_PREPARED_REVIEW_OUTPUT']+`/packet-${order}.json` : undefined,JSON.stringify(data,null,2));
 expect(packets).toHaveLength(1);const p=packets[0]!;expect(p.steps).toHaveLength(2);
 for(const edit of p.steps!.flatMap(s=>s.ordinary)){expect((edit.before as {z:number}).z).toBe(7);expect((edit.after as {z:number}).z).toBe(7);}
 for(const edit of p.physical){expect((edit.before as {z:number}).z).toBe(99);expect((edit.after as {z:number}).z).toBe(99);}
 }finally{off();t.destroy();}
});
for(const mode of ['untouched','equal','changed'] as const)it(`certified absence row transport preserves actual replacement scope ${mode}`,async()=>{
 const t=signalTree({rows:entityMap<{id:string;x?:number;z:number},string>()},{enhancers:[transactions()]});const r=t.$.rows;r.addOne({id:'a',z:7});await flush();const row=r.byIdOrFail('a');const b=getEntityPublicationBinding(row)!;const req=()=>b.source.evidence()!.field(b.subject!,'z','ordinary');const base=req();
 withWriteContext({participation:'inspection'},()=>r.updateOne('a',{z:99}));const q=t.transact(()=>r.updateOne('a',{x:7}));await flush();let calls=0;
 const off=r.intercept({onUpdate(_id,p,ctx){calls++;if(mode!=='untouched')ctx.transform({...p,z:mode==='equal'?99:55});}});
 try{q.rollback();off();await flush();const after=row(),sameSupport=req()===base;const adopted=mode==='changed'?55:99;const a=t.transact(()=>r.updateOne('a',{z:adopted}));await flush();a.rollback();await flush();
 const data={calls,after,sameSupport,afterAdoptionReject:row()};writeDiagnostic(process.env['ST_PREPARED_REVIEW_OUTPUT'] ? process.env['ST_PREPARED_REVIEW_OUTPUT']+`/absence-${mode}.json` : undefined,JSON.stringify(data,null,2));
 expect(calls).toBe(1);expect(Object.prototype.hasOwnProperty.call(after,'x')).toBe(false);expect(after.z).toBe(adopted);expect(sameSupport).toBe(mode==='untouched');expect(row().z).toBe(mode==='untouched'?7:adopted);
 }finally{off();t.destroy();}
});
