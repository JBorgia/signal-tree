import {expect,it} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import * as life from './experimental-publication/lifecycle';
import {getPathNotifier} from './path-notifier';
import {bindFieldEndpoints,fieldEndpoints,composeFieldEndpoints,type NativeFieldEndpoint} from './internals/native-field-selection';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
const endpoint=(present:boolean,value:unknown):NativeFieldEndpoint=>({present,value,requirement:life.initialRequirement()});
it('composition never borrows missing earlier baseline or retains obsolete later endpoint',()=>{
 const pair={before:endpoint(true,7),after:endpoint(true,11)};
 const first={},last=bindFieldEndpoints({},pair);composeFieldEndpoints(first,last,false);expect(fieldEndpoints(first)).toBeUndefined();
 const earlier=bindFieldEndpoints({},pair);composeFieldEndpoints(earlier,{},false);expect(fieldEndpoints(earlier)).toBeUndefined();
 const replaced={};composeFieldEndpoints(replaced,last,true);expect(fieldEndpoints(replaced)).toEqual(pair);
});
for(const present of [false,true])it(`native inverse preserves ${present?'present undefined':'certified absence'} and sibling selection`,async()=>{
 const initial:{id:string;x?:number;y:number}=present?{id:'a',x:undefined,y:4}:{id:'a',y:4};
 const tree=signalTree({rows:entityMap<typeof initial,string>()},{enhancers:[transactions()]});const rows=tree.$.rows;rows.addOne(initial);await flush();
 const binding=getEntityPublicationBinding(rows.byIdOrFail('a'))!,source=binding.source,subject=binding.subject!;
 const sibling=source.evidence()!.field(subject,'y','ordinary');
 try{const q=tree.transact(()=>rows.updateOne('a',{x:11}));q.rollback();await flush();
  expect(Object.prototype.hasOwnProperty.call(rows.byIdOrFail('a')()!,'x')).toBe(present);expect(rows.byIdOrFail('a')()!.x).toBeUndefined();
  expect(source.evidence()!.field(subject,'y','ordinary')).toBe(sibling);
  expect(life.nativeProof(source.evidence()!.field(subject,'x','ordinary') as life.NativeRequirement).destination??[]).toEqual([]);
 }finally{tree.destroy();}
});
it('native same-field interceptor reentry cannot borrow outer inverse selection',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});const rows=tree.$.rows;rows.addOne({id:'a',x:0});await flush();
 const binding=getEntityPublicationBinding(rows.byIdOrFail('a'))!,subject=binding.subject!,source=binding.source;
 const baseline=source.evidence()!.field(subject,'x','ordinary');const q=tree.transact(()=>rows.updateOne('a',{x:7}));await flush();
 let entered=false,nested:object|undefined;
 const off=rows.intercept({onUpdate(){if(!entered){entered=true;rows.updateOne('a',{x:99});nested=source.evidence()!.field(subject,'x','ordinary');}}});
 try{let failure:unknown;try{q.rollback();}catch(error){failure=error;}expect(failure).toMatchObject({code:'SIGNALTREE_ROLLBACK_FAILED',cause:{kind:'effect-validation-failed',cause:expect.any(Error)}});await flush();expect(entered).toBe(true);expect(nested).not.toBe(baseline);expect(rows.byIdOrFail('a').x()).toBe(99);expect(source.evidence()!.field(subject,'x','ordinary')).toBe(nested);expect(()=>q.confirm()).not.toThrow();}
 finally{off();tree.destroy();}
});
it('throwing native interceptor does not leave inverse selection available to later write',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});const rows=tree.$.rows;rows.addOne({id:'a',x:0});await flush();
 const binding=getEntityPublicationBinding(rows.byIdOrFail('a'))!,source=binding.source,subject=binding.subject!;
 const baseline=source.evidence()!.field(subject,'x','ordinary');const q=tree.transact(()=>rows.updateOne('a',{x:7}));await flush();
 const off=rows.intercept({onUpdate(){throw new Error('controlled-inverse');}});
 try{expect(()=>q.rollback()).toThrow();off();rows.updateOne('a',{x:13});await flush();expect(rows.byIdOrFail('a').x()).toBe(13);expect(source.evidence()!.field(subject,'x','ordinary')).not.toBe(baseline);}finally{off();tree.destroy();}
});
