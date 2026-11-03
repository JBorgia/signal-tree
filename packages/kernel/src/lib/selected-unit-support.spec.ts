import {it,expect} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
const flush=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
for(const overlap of [0,99])it(`ordered transformed sibling gets its own support even when equal (${overlap})`,async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number;y:number;z:number},string>()},{enhancers:[transactions()]});const rows=t.$.rows;rows.addOne({id:'a',x:0,y:0,z:4});await flush();
 const row=rows.byIdOrFail('a'),b=getEntityPublicationBinding(row)!;const req=(k:string)=>b.source.evidence()!.field(b.subject!,k,'ordinary');const base={x:req('x'),y:req('y'),z:req('z')};
 const q=t.transact(()=>{rows.updateOne('a',{x:7});rows.updateOne('a',{y:11});});await flush();let calls=0;
 const off=rows.intercept({onUpdate(_id,patch,ctx){calls++;if(Object.prototype.hasOwnProperty.call(patch,'x'))ctx.transform({x:0,y:overlap});}});
 try{q.rollback();expect(calls).toBe(2);expect(row()).toEqual({id:'a',x:0,y:overlap,z:4});expect(req('x')).toBe(base.x);expect(req('y')).not.toBe(base.y);expect(req('z')).toBe(base.z);}finally{off();t.destroy();}
});
it('later selected y supersedes earlier transformed sibling y support',async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number;y:number},string>()},{enhancers:[transactions()]});const r=t.$.rows;r.addOne({id:'a',x:0,y:0});await flush();const row=r.byIdOrFail('a'),b=getEntityPublicationBinding(row)!;const before=b.source.evidence()!.field(b.subject!,'y','ordinary');
 const q=t.transact(()=>{r.updateOne('a',{y:11});r.updateOne('a',{x:7});});await flush();const off=r.intercept({onUpdate(_id,p,ctx){if('x'in p)ctx.transform({x:0,y:99});}});
 try{q.rollback();expect(row()).toEqual({id:'a',x:0,y:0});expect(b.source.evidence()!.field(b.subject!,'y','ordinary')).toBe(before);}finally{off();t.destroy();}
});
it('mixed scalar/entity public block refuses before either selected contribution installs',async()=>{
 const t=signalTree({plain:0,rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});const r=t.$.rows;r.addOne({id:'a',x:0});await flush();const q=t.transact(()=>{t.$.plain(3);r.updateOne('a',{x:7});});await flush();let called=0;const off=r.intercept({onUpdate(_id,_p,ctx){called++;ctx.block('mixed blocked');}});
 try{expect(()=>q.rollback()).toThrow();expect(called).toBe(1);expect(t.$.plain()).toBe(3);expect(r.byIdOrFail('a').x()).toBe(7);off();q.rollback();expect(t.$.plain()).toBe(0);expect(r.byIdOrFail('a').x()).toBe(0);}finally{off();t.destroy();}
});
