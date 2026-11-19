import {it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {entityMap,signalTree,transactions} from '../index';
import {withWriteContext} from './write-context';
import {getEntityPublicationBinding,type EntityPublicationPacket} from './internals/entity-publication';
import {getPathNotifier} from './path-notifier';
const own=(v:unknown,k:string)=>v!==null&&typeof v==='object'&&Object.prototype.hasOwnProperty.call(v,k);
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
const save=(n:string,v:unknown)=>writeFileSync(process.env['ST_PREPARED_REVIEW_OUTPUT']+'/'+n+'.json',JSON.stringify(v,null,2));
for(const mode of ['untouched','omit','undefined'] as const)it(`ordinary-only own undefined through synthetic removal: ${mode}`,async()=>{
 const t=signalTree({rows:entityMap<{id:string;x?:number;y?:number|undefined;z:number},string>()},{enhancers:[transactions()]});const r=t.$.rows;
 r.addOne({id:'a',y:undefined,z:7});await flush();const row=r.byIdOrFail('a');const b=getEntityPublicationBinding(row)!;const req=()=>b.source.evidence()!.field(b.subject!,'y','ordinary');const base=req();
 withWriteContext({participation:'inspection'},()=>row({id:'a',z:99}));const q=t.transact(()=>r.updateOne('a',{x:7}));await flush();let calls=0;
 const off=r.intercept({onUpdate(_id,_p,ctx){calls++;if(mode==='omit')ctx.transform({id:'a',z:99});if(mode==='undefined')ctx.transform({id:'a',y:undefined,z:99});}});
 const packets:EntityPublicationPacket[]=[];const unsub=b.source.subscribe({prepare(p){packets.push(p);return undefined;},complete(){}});
 try{
  q.rollback();off();unsub();const support=req();const after={x:own(row(),'x'),y:own(row(),'y'),undefinedY:row().y===undefined};
  const step=packets[0]?.steps?.[0];const ordinary=step?.ordinary[0],physical=step?.physical?.[0];
  const images={ordinaryBeforeY:own(ordinary?.before,'y'),ordinaryAfterY:own(ordinary?.after,'y'),physicalBeforeY:own(physical?.before,'y'),physicalAfterY:own(physical?.after,'y')};
  const a=t.transact(()=>r.updateOne('a',{y:9}));await flush();a.rollback();await flush();
  const final={y:own(row(),'y'),undefinedY:row().y===undefined,supportRestored:req()===support};
  save('presence-'+mode,{calls,packetCount:packets.length,after,images,ordinarySupportRetained:support===base,final});
  expect(calls).toBe(1);expect(packets).toHaveLength(1);expect(step?.ordinary).toHaveLength(1);expect(step?.physical).toHaveLength(1);
  expect(after).toEqual({x:false,y:mode==='undefined',undefinedY:true});
  expect(images).toEqual({ordinaryBeforeY:true,ordinaryAfterY:mode!=='omit',physicalBeforeY:false,physicalAfterY:mode==='undefined'});
  expect(support===base).toBe(mode==='untouched');expect(final).toEqual({y:mode!=='omit',undefinedY:true,supportRestored:true});
 }finally{off();unsub();t.destroy();}
});
it('certified own undefined remains present and restores its exact support',async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number|undefined},string>()},{enhancers:[transactions()]});const r=t.$.rows;r.addOne({id:'a',x:undefined});await flush();const row=r.byIdOrFail('a');const b=getEntityPublicationBinding(row)!;const req=()=>b.source.evidence()!.field(b.subject!,'x','ordinary');const baseline=req();
 try{const q=t.transact(()=>r.updateOne('a',{x:7}));await flush();q.rollback();const state={present:own(row(),'x'),undefinedValue:row().x===undefined,sameSupport:req()===baseline};save('selected-undefined',state);expect(state).toEqual({present:true,undefinedValue:true,sameSupport:true});}finally{t.destroy();}
});
