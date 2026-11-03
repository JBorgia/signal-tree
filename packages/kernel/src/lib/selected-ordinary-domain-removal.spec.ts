import {expect,it} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';
import {withWriteContext} from './write-context';
import {getEntityPublicationBinding} from './internals/entity-publication';
const flush=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
it('transformed certified removal removes ordinary-only sibling and owns equal displayed sibling',async()=>{
 const t=signalTree({rows:entityMap<{id:string;x?:number;y?:number;z:number},string>()},{enhancers:[transactions()]});const r=t.$.rows;r.addOne({id:'a',y:4,z:7});await flush();const row=r.byIdOrFail('a');const b=getEntityPublicationBinding(row)!;const req=(key:string)=>b.source.evidence()!.field(b.subject!,key,'ordinary');const yBefore=req('y'),zBefore=req('z');
 withWriteContext({participation:'inspection'},()=>row({id:'a',z:99}));await flush();const q=t.transact(()=>r.updateOne('a',{x:7}));await flush();let calls=0;const off=r.intercept({onUpdate(_id,_patch,ctx){calls++;ctx.transform({id:'a',z:99});}});
 try{q.rollback();expect(calls).toBe(1);off();expect(row()).toEqual({id:'a',z:99});expect(req('y')).not.toBe(yBefore);expect(req('z')).not.toBe(zBefore);const next=t.transact(()=>r.updateOne('a',{y:8,z:100}));next.rollback();expect(row()).toEqual({id:'a',z:99});expect(Object.prototype.hasOwnProperty.call(row(),'y')).toBe(false);}finally{off();t.destroy();}
});
