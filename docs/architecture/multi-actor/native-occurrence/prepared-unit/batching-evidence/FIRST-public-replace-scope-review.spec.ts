import {expect,it} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';
import {withWriteContext} from './write-context';
import {getEntityPublicationBinding} from './internals/entity-publication';
const flush=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
it('public literal replacement interceptor adopts equal displayed sibling and removes omitted own field',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x?:number;z:number},string>()},{enhancers:[transactions()]});const rows=tree.$.rows;rows.addOne({id:'a',x:1,z:7});await flush();const row=rows.byIdOrFail('a');const b=getEntityPublicationBinding(row)!;const req=()=>b.source.evidence()!.field(b.subject!,'z','ordinary');const baseline=req();withWriteContext({participation:'inspection'},()=>rows.updateOne('a',{z:99}));await flush();let calls=0;
 const off=rows.intercept({onUpdate(_id,_changes,ctx){calls++;ctx.transform({id:'a',z:99});}});
 try{row({id:'a',x:2,z:99});expect(calls).toBe(1);off();expect(Object.prototype.hasOwnProperty.call(row(),'x')).toBe(false);expect(row.z()).toBe(99);expect(req()).not.toBe(baseline);const q=tree.transact(()=>rows.updateOne('a',{z:100}));q.rollback();expect(row.z()).toBe(99);}finally{off();tree.destroy();}
});
