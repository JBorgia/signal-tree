import {expect,it} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getPathNotifier} from './path-notifier';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
it('lifetime replacement in onUpdate refuses old baseline authority',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});const rows=tree.$.rows;rows.addOne({id:'a',x:0});await flush();
 const old=getEntityPublicationBinding(rows.byIdOrFail('a'))!;const baseline=old.source.evidence()!.field(old.subject!,'x','ordinary');
 const q=tree.transact(()=>rows.updateOne('a',{x:7}));await flush();let entered=false;
 const off=rows.intercept({onUpdate(){if(!entered){entered=true;rows.removeOne('a');rows.addOne({id:'a',x:99});}}});
 try{expect(()=>q.rollback()).toThrow();expect(entered).toBe(true);const fresh=getEntityPublicationBinding(rows.byIdOrFail('a'))!;expect(fresh.subject).not.toBe(old.subject);expect(rows.byIdOrFail('a').x()).toBe(99);expect(fresh.source.evidence()!.field(fresh.subject!,'x','ordinary')).not.toBe(baseline);}finally{off();tree.destroy();}
});
it('equality reentry after claim cannot install old lifetime baseline',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:{v:number}},string>()},{enhancers:[transactions()]});const rows=tree.$.rows;rows.addOne({id:'a',x:{v:0}});await flush();
 const old=getEntityPublicationBinding(rows.byIdOrFail('a'))!;const baseline=old.source.evidence()!.field(old.subject!,'x','ordinary');
 const q=tree.transact(()=>rows.updateOne('a',{x:{v:7}}));await flush();let entered=false;
 const off=rows.intercept({onUpdate(_id,_changes,ctx){ctx.transform({x:{get v(){if(!entered){entered=true;rows.removeOne('a');rows.addOne({id:'a',x:{v:99}});}return 0;}}});}});
 try{let failure:unknown;try{q.rollback();}catch(e){failure=e;}console.log('EQUALITY-LIFETIME', {entered,failure:String(failure),value:rows.byIdOrFail('a').x(),old:old.subject,new:getEntityPublicationBinding(rows.byIdOrFail('a'))!.subject,oldBaseline:old.source.evidence()!.field(old.subject!,'x','ordinary')===baseline});expect(entered).toBe(true);expect(failure).toBeDefined();const fresh=getEntityPublicationBinding(rows.byIdOrFail('a'))!;expect(fresh.subject).not.toBe(old.subject);expect(fresh.source.evidence()!.field(fresh.subject!,'x','ordinary')).not.toBe(baseline);}finally{off();tree.destroy();}
});

import {observeIntrinsicMutations} from './internals/intrinsic-mutation';

it('preclaim projection getter cannot lend inverse authority to a nested setter',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});const rows=tree.$.rows;rows.addOne({id:'a',x:0});await flush();
 const binding=getEntityPublicationBinding(rows.byIdOrFail('a'))!;const source=binding.source,subject=binding.subject!;const baseline=source.evidence()!.field(subject,'x','ordinary');
 let armed=false,entered=false,nested:object|undefined;
 // First getter read after rollback is armed; no private metadata selects timing.
 const row={id:'a',get x(){if(armed&&!entered){entered=true;rows.updateOne('a',{x:0});nested=source.evidence()!.field(subject,'x','ordinary');}return 7;}};
 const q=tree.transact(()=>rows.replaceOne('a',row));await flush();
 const off=observeIntrinsicMutations(rows.byIdOrFail('a').x as object,()=>{});armed=true;
 try{let error:unknown;try{q.rollback();}catch(e){error=e;}expect(entered).toBe(true);expect(nested).not.toBe(baseline);expect(error).toBeDefined();expect(rows.byIdOrFail('a').x()).toBe(0);expect(()=>q.confirm()).not.toThrow();}finally{off?.();tree.destroy();}
});
