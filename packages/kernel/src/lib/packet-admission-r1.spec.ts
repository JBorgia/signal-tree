import {expect,it} from 'vitest';
import '../index';
import {EntityPublicationSource,type EntityPublicationEdit as Edit,type EntityPublicationPacket as Packet} from './internals/entity-publication';
import {installTerminalRecord} from './internals/intrinsic-mutation';
const edit=(x:number):Edit=>({subject:1,before:undefined,after:{x},fields:['x']});
const packet=(a:Edit):Packet=>({owner:1,id:{},meta:undefined,ordinary:[a],physical:[a]});
const install=(s:EntityPublicationSource,p:Packet)=>{const u=s.prepare(p)!;u.finalize?.();installTerminalRecord(u.record);s.complete(u.completion);};
for(const phase of ['prepare','finalize'] as const)it(`admitted arrays refuse escaping mutation during ${phase}`,()=>{
 const s=new EntityPublicationSource();const installed=new Map();let invoked=0;
 const off=s.subscribe({prepare(p){const mutate=()=>{invoked++;(p.ordinary as Edit[]).push(edit(99));};if(phase==='prepare')mutate();return {record:{writes:[],adds:[]},completion:{},finalize:phase==='finalize'?mutate:undefined};},complete(){ /* This participant has no completion side effect. */ }});
 try{expect(()=>install(s,{...packet(edit(7)),prepareResponsibility:()=>({writes:[{map:installed,key:1,value:7}],adds:[]})})).toThrow(TypeError);expect(invoked).toBe(1);expect(installed.size).toBe(0);expect(s.inspect().rows).toBe(0);}finally{off();s.dispose();}
});
it('temporary mutation cannot create different recipient and native admission',()=>{
 const s=new EntityPublicationSource();const a=edit(7);let first:Packet|undefined,second:Packet|undefined;let proposed:unknown;
 const off1=s.subscribe({prepare(p){first=p;expect(Reflect.set(p.ordinary,'0',edit(99))).toBe(false);expect(Reflect.set(a,'subject',99)).toBe(false);return {record:{writes:[],adds:[]},completion:{},finalize(){expect(Reflect.set(p.ordinary,'0',a)).toBe(false);}};},complete(){ /* This participant has no completion side effect. */ }});
 const off2=s.subscribe({prepare(p){second=p;expect(p.ordinary).toEqual([a]);return undefined;},complete(){ /* This participant has no completion side effect. */ }});
 try{install(s,{...packet(a),prepareResponsibility:f=>{proposed=f!.proposed(1,'x').value;return undefined;}});expect(first).toBe(second);expect(proposed).toBe(7);expect(s.inspect().rows).toBe(1);}finally{off1();off2();s.dispose();}
});
it('preserves edit identity and mutable row payloads without freezing shared input metadata',()=>{
 const s=new EntityPublicationSource();const row={x:7};const fields=['x'];const structural={kind:'add' as const,subject:1};const a:Edit={subject:1,before:undefined,after:row,fields,structural};let received:Packet|undefined;
 const off=s.subscribe({prepare(p){received=p;return undefined;},complete(){ /* This participant has no completion side effect. */ }});
 try{install(s,packet(a));expect(received!.ordinary[0]).toBe(a);expect(a.after).toBe(row);expect(Object.isFrozen(row)).toBe(false);row.x=8;expect(row.x).toBe(8);expect(Object.isFrozen(fields)).toBe(false);expect(Object.isFrozen(structural)).toBe(false);fields.push('y');expect(a.fields).toEqual(['x']);expect(Reflect.set(a.structural!,'kind','remove')).toBe(false);}finally{off();s.dispose();}
});
it('external alias to transferred private membership is also stable',()=>{
 const s=new EntityPublicationSource();const a=edit(7),edits=[a];let seen:Packet|undefined;
 const off=s.subscribe({prepare(p){seen=p;return {record:{writes:[],adds:[]},completion:{},finalize(){expect(()=>edits.push(edit(99))).toThrow(TypeError);}};},complete(){ /* This participant has no completion side effect. */ }});
 try{install(s,{...packet(a),ordinary:edits});expect(edits.length).toBe(1);expect(seen!.ordinary).toEqual([a]);expect(s.inspect().rows).toBe(1);}finally{off();s.dispose();}
});
it('caught metadata mutation keeps exact structural and step admission',()=>{
 const s=new EntityPublicationSource();const a:Edit={...edit(7),structural:{kind:'add',subject:1}};let reached=false;
 const off=s.subscribe({prepare(p){expect(Reflect.set(p.steps!,'0',{ordinal:99,ordinary:[]})).toBe(false);expect(Reflect.set(p.steps![0],'ordinal',99)).toBe(false);expect(Reflect.set(a.structural!,'kind','remove')).toBe(false);reached=true;return undefined;},complete(){ /* This participant has no completion side effect. */ }});
 try{install(s,{...packet(a),steps:[{ordinal:0,ordinary:[a],physical:[a]}]});expect(reached).toBe(true);expect(s.inspect().presence).toBe(1);}finally{off();s.dispose();}
});
it('public caller rows and nested payload arrays remain mutable after publication',async()=>{
 const {signalTree,entityMap}=await import('../index');
 const t=signalTree({rows:entityMap<{id:string;x:number;tags:string[]},string>()});
 const tags=['a'],row={id:'a',x:1,tags},rows=[row];
 try{t.$.rows.setAll(rows);expect(t.$.rows.byIdOrFail('a').x()).toBe(1);expect(Object.isFrozen(rows)).toBe(false);expect(Object.isFrozen(row)).toBe(false);expect(Object.isFrozen(tags)).toBe(false);row.x=9;tags.push('b');rows.push({id:'b',x:2,tags:[]});expect(tags).toEqual(['a','b']);expect(rows.length).toBe(2);}finally{t.destroy();}
});
it('held support remains unknown after retirement and refused membership mutation',async()=>{
 const {initialRequirement,nativeProof}=await import('./experimental-publication/lifecycle');
 const s=new EntityPublicationSource();const requirement=initialRequirement();requirement.proof={owners:[],unknown:true,invalid:false};
 const a:Edit={...edit(7),restoredFields:new Map([['x',{present:true,value:7,requirement}]])};const edits=[a];let support:(()=>object)|undefined;
 const off=s.subscribe({prepare(_p,native){support=(native as {support:()=>object}).support;return undefined;},complete(){ /* This participant has no completion side effect. */ }});
 try{install(s,{...packet(a),ordinary:edits});s.retire(1);expect(Reflect.set(edits,'length',0)).toBe(false);expect(nativeProof(support!() as typeof requirement).unknown).toBe(true);expect(Object.isFrozen(requirement)).toBe(false);}finally{off();s.dispose();}
});
