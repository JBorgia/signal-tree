import {expect,it} from 'vitest';
import {entityMap,signalTree} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getPathNotifier} from './path-notifier';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
it('independent: later completions and membership delivery run after exact first thrown value',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;n:number},string>()});const rows=tree.$.rows;
 rows.addOne({id:'a',n:1});await flush();const source=getEntityPublicationBinding(rows)!.source;
 const calls:string[]=[];const primary=Object.freeze({primary:true});
 const prepare=(p:Parameters<typeof source.prepare>[0])=>p.physical.some(e=>e.structural?.kind==='remove')?{record:{writes:[],adds:[]},completion:{}}:undefined;
 const off1=source.subscribe({prepare,complete(){calls.push('first');throw primary;}});
 const off2=source.subscribe({prepare,complete(){calls.push('second');throw new Error('secondary');}});
 const off3=rows.tap({onRemove(){calls.push('tap');throw new Error('tap');}});
 try{let caught:unknown;try{rows.removeOne('a');}catch(e){caught=e;}expect(caught).toBe(primary);expect(calls).toEqual(['first','second','tap']);await flush();expect(source.inspect().presence).toBe(0);expect(source.inspect().mappings).toBe(0);expect(source.inspect().mappingViews).toBe(0);expect(source.inspect().retirementRequests).toBe(0);}finally{off1();off2();off3();tree.destroy();}
});
it('independent: captured requirement objects survive deletion unchanged',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;n:number},string>()});const rows=tree.$.rows;rows.addOne({id:'a',n:1});await flush();
 const b=getEntityPublicationBinding(rows.byIdOrFail('a'))!,source=b.source,subject=b.subject!;const e=source.evidence()!;
 const held=['ordinary','physical'].flatMap(view=>{const v=view as 'ordinary'|'physical';return [e.member(subject,v),e.field(subject,'n',v),e.placement(subject,v),e.keyMapping(subject,v)];});
 const snapshots=held.map(value=>Object.getOwnPropertyDescriptors(value));
 try{rows.removeOne('a');await flush();expect(source.inspect().retireCalls).toBe(1);expect(held.map(value=>Object.getOwnPropertyDescriptors(value))).toEqual(snapshots);expect(source.inspect().presence).toBe(0);}finally{tree.destroy();}
});
