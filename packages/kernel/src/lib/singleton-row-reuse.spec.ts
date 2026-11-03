import {expect,it} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';
import {EntityPublicationSource,entityPublicationOrdinary,getEntityPublicationBinding,type EntityPublicationEdit as Edit,type EntityPublicationPacket as Packet,type EntityPublicationEvidence as Evidence} from './internals/entity-publication';
import {installTerminalRecord,type PreparedPublicationUnit} from './internals/intrinsic-mutation';
import {initialRequirement,type NativeRequirement} from './experimental-publication/lifecycle';
import {getPathNotifier} from './path-notifier';
const edit=(x:unknown,fields:readonly string[]=['x']):Edit=>({subject:1,before:undefined,after:{x},fields});
const packet=(edits:readonly Edit[],extra:Partial<Packet>={}):Packet=>({owner:1,id:{},meta:undefined,ordinary:edits,physical:edits,...extra});
const finish=(s:EntityPublicationSource,u:PreparedPublicationUnit)=>{u.finalize?.();installTerminalRecord(u.record);s.complete(u.completion);};
const install=(s:EntityPublicationSource,p:Packet)=>{const u=s.prepare(p)!;finish(s,u);};
const endpoint=(s:EntityPublicationSource,key='x')=>{let value:import('./internals/native-field-selection').NativeFieldEndpoint|undefined;s.prepare(packet([],{prepareResponsibility:f=>{value=f!.before(1,key);return undefined;}}));return value!;};
const capture=(s:EntityPublicationSource)=>{const held=new Map<Edit,Evidence>();const off=s.subscribe({prepare(p,native){const facts=(native as {facts?:Evidence})?.facts;if(facts)for(const e of entityPublicationOrdinary(p))held.set(e,facts.forEdit!(e));return undefined;},complete(){}});return {held,off};};
it('held singleton evidence survives installation, later writes, inspection, retirement and restoration',()=>{
 const s=new EntityPublicationSource(),{held,off}=capture(s);const a=edit(7),b=edit(11);
 try{const u=s.prepare(packet([a]))!;const facts=held.get(a)!;const original=facts.field(1,'x','ordinary');expect(s.inspect().rows).toBe(0);finish(s,u);expect(endpoint(s).value).toBe(7);expect(endpoint(s).requirement).toBe(original);
 install(s,packet([b]));expect(endpoint(s).value).toBe(11);expect(endpoint(s).requirement).not.toBe(original);expect(facts.field(1,'x','ordinary')).toBe(original);
 const ordinary=s.evidence()!.field(1,'x','ordinary');install(s,packet([],{physical:[edit(99)],meta:{participation:'inspection'}}));expect(s.evidence()!.field(1,'x','ordinary')).toBe(ordinary);expect(s.evidence()!.field(1,'x','physical')).not.toBe(ordinary);expect(facts.field(1,'x','ordinary')).toBe(original);
 s.retire(1);expect(s.inspect().rows).toBe(0);expect(facts.field(1,'x','ordinary')).toBe(original);
 const restored={present:true,value:5,requirement:initialRequirement()};install(s,packet([{...edit(11),restoredFields:new Map([['x',restored]])}],{prepareResponsibility:f=>{f!.choose(1,'x',{present:true,value:8,requirement:initialRequirement()});return undefined;}}));expect(endpoint(s)).toBe(restored);expect(facts.field(1,'x','ordinary')).toBe(original);
 }finally{off();s.dispose();}
});
it('held absent and present undefined endpoints remain distinct through later writes',()=>{
 const s=new EntityPublicationSource(),{held,off}=capture(s);const a=edit(undefined);
 try{install(s,packet([a]));const old=endpoint(s);expect(old.present).toBe(true);expect(old.value).toBeUndefined();const facts=held.get(a)!;const req=facts.field(1,'x','ordinary');install(s,packet([{subject:1,before:{x:undefined},after:{},fields:['x']}]));expect(endpoint(s).present).toBe(false);expect(old.present).toBe(true);expect(facts.field(1,'x','ordinary')).toBe(req);}finally{off();s.dispose();}
});
for(const repeat of [false,true])it(`multi-edit same-subject snapshots retain per-edit endpoints; repeated alias=${repeat}`,()=>{
 const s=new EntityPublicationSource(),{held,off}=capture(s),ra=initialRequirement(),rb=initialRequirement();
 const a:Edit={...edit(7),restoredFields:new Map([['x',{present:true,value:7,requirement:ra}]])},b:Edit={...edit(11),restoredFields:new Map([['x',{present:true,value:11,requirement:rb}]])};
 try{const list=repeat?[a,a,b]:[a,b];install(s,packet(list,{steps:list.map(e=>({ordinal:0,ordinary:[e],physical:[e]}))}));expect(held.get(a)!.field(1,'x','ordinary')).toBe(ra);expect(held.get(b)!.field(1,'x','ordinary')).toBe(rb);expect(endpoint(s).requirement).toBe(rb);install(s,packet([edit(99)]));expect(held.get(a)!.field(1,'x','ordinary')).toBe(ra);expect(held.get(b)!.field(1,'x','ordinary')).toBe(rb);}finally{off();s.dispose();}
});
it('recipient finalizer reentry preserves escaped outer facts and refuses outer install',()=>{
 const s=new EntityPublicationSource(),{held,off}=capture(s),a=edit(7);let entered=false;const staged=new Map<string,number>();
 const release=s.subscribe({prepare(){return{record:{writes:[],adds:[]},completion:{},finalize(){if(!entered){entered=true;install(s,packet([edit(99)]));}}};},complete(){}});
 try{const u=s.prepare(packet([a],{prepareResponsibility:()=>({writes:[{map:staged,key:'outer',value:7}],adds:[]})}))!;const facts=held.get(a)!,req=facts.field(1,'x','ordinary');expect(()=>finish(s,u)).toThrow('Entity publication source changed before installation');expect(staged.size).toBe(0);expect(endpoint(s).value).toBe(99);expect(facts.field(1,'x','ordinary')).toBe(req);}finally{release();off();s.dispose();}
});
it('recipient preparation throw leaves captured singleton evidence detached from later installations',()=>{
 const s=new EntityPublicationSource(),{held,off}=capture(s),a=edit(7),failure=Error('later recipient refusal');const staged=new Map<string,number>();
 const release=s.subscribe({prepare(){throw failure;},complete(){throw Error('unexpected completion');}});
 try{expect(()=>s.prepare(packet([a],{prepareResponsibility:()=>({writes:[{map:staged,key:'outer',value:7}],adds:[]})}))).toThrow(failure);const facts=held.get(a)!,req=facts.field(1,'x','ordinary');expect(staged.size).toBe(0);expect(s.inspect().rows).toBe(0);release();install(s,packet([edit(99)]));expect(facts.field(1,'x','ordinary')).toBe(req);expect(endpoint(s).value).toBe(99);}finally{release();off();s.dispose();}
});
for(const outcome of ['confirm','rollback'] as const)it(`real owner ${outcome} keeps held per-edit evidence identity while source progresses`,async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});t.$.rows.addOne({id:'a',x:0});const row=t.$.rows.byIdOrFail('a'),binding=getEntityPublicationBinding(row)!;const s=binding.source;let facts:Evidence|undefined;
 const off=s.subscribe({prepare(p,native){const e=entityPublicationOrdinary(p).find(e=>e.subject===binding.subject);if(e&&!facts)facts=(native as {facts:Evidence}).facts.forEdit!(e);return undefined;},complete(){}});
 try{const q=t.transact(()=>t.$.rows.updateOne('a',{x:7}));expect(facts).toBeDefined();const req=facts!.field(binding.subject!,'x','ordinary') as NativeRequirement;expect(s.evidence()!.field(binding.subject!,'x','ordinary')).toBe(req);q[outcome]();getPathNotifier().flushSync();for(let i=0;i<20;i++)await Promise.resolve();expect(row.x()).toBe(outcome==='confirm'?7:0);expect(facts!.field(binding.subject!,'x','ordinary')).toBe(req);t.$.rows.updateOne('a',{x:11});expect(row.x()).toBe(11);expect(facts!.field(binding.subject!,'x','ordinary')).toBe(req);}finally{off();t.destroy();}
});
