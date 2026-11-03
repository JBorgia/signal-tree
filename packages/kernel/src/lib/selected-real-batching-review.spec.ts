import {expect,it} from 'vitest';
import {batching,entityMap,signalTree,transactions} from '../index';
import {interceptLocationWrites} from './internals/location-runtime';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getPathNotifier} from './path-notifier';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
for(const reverse of [false,true])it(`real enhancer synchronous selected coalesce completes both fields (${reverse})`,async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number;y:number},string>()},{enhancers:reverse?[batching(),transactions()]:[transactions(),batching()]});
 const rows=tree.$.rows;rows.addOne({id:'a',x:0,y:0});await flush();const row=rows.byIdOrFail('a');const b=getEntityPublicationBinding(row)!;const req=(k:string)=>b.source.evidence()!.field(b.subject!,k,'ordinary');const baseline=[req('x'),req('y')];
 const q=tree.transact(()=>{rows.updateOne('a',{x:7});rows.updateOne('a',{y:11});});await flush();let calls=0;
 const offs=[row.x,row.y].map(leaf=>interceptLocationWrites(leaf,(_op,proceed)=>{calls++;tree.coalesce(proceed);}));const seen:Array<[number,number]>=[];const offTap=rows.tap({onUpdate(){seen.push([row.x(),row.y()]);}});
 try{q.rollback();expect(calls).toBe(2);expect(row()).toEqual({id:'a',x:0,y:0});expect(req('x')).toBe(baseline[0]);expect(req('y')).toBe(baseline[1]);expect(seen.length).toBeGreaterThan(0);expect(seen.every(v=>v[0]===0&&v[1]===0)).toBe(true);expect(()=>q.confirm()).toThrow();}finally{offTap();offs.forEach(off=>off());tree.destroy();}
});
for(const reverse of [false,true])it(`real enhancer outer coalesce refuses pending inverse and permits fresh retry (${reverse})`,async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:reverse?[batching(),transactions()]:[transactions(),batching()]});const rows=tree.$.rows;rows.addOne({id:'a',x:0});await flush();const row=rows.byIdOrFail('a');const b=getEntityPublicationBinding(row)!;const req=()=>b.source.evidence()!.field(b.subject!,'x','ordinary');const baseline=req();const q=tree.transact(()=>rows.updateOne('a',{x:7}));await flush();const pending=req();
 try{expect(()=>tree.coalesce(()=>q.rollback())).toThrow();expect(row.x()).toBe(7);expect(req()).toBe(pending);q.rollback();expect(row.x()).toBe(0);expect(req()).toBe(baseline);tree.coalesce(()=>{row.x(12);row.x(13);});expect(row.x()).toBe(13);await flush();expect(row.x()).toBe(13);}finally{tree.destroy();}
});
