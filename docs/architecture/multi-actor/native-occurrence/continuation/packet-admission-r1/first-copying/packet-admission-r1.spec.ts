import {expect,it} from 'vitest';
import '../index';
import {EntityPublicationSource,type EntityPublicationEdit as Edit,type EntityPublicationPacket as Packet} from './internals/entity-publication';
import {installTerminalRecord} from './internals/intrinsic-mutation';
const edit=(x:number):Edit=>({subject:1,before:undefined,after:{x},fields:['x']});
const packet=(a:Edit):Packet=>({owner:1,id:{},meta:undefined,ordinary:[a],physical:[a]});
const install=(s:EntityPublicationSource,p:Packet)=>{const u=s.prepare(p)!;u.finalize?.();installTerminalRecord(u.record);s.complete(u.completion);};
for(const phase of ['prepare','finalize'] as const)it(`admitted arrays refuse escaping mutation during ${phase}`,()=>{
 const s=new EntityPublicationSource();const installed=new Map();let invoked=0;
 const off=s.subscribe({prepare(p){const mutate=()=>{invoked++;(p.ordinary as Edit[]).push(edit(99));};if(phase==='prepare')mutate();return {record:{writes:[],adds:[]},completion:{},finalize:phase==='finalize'?mutate:undefined};},complete(){}});
 try{expect(()=>install(s,{...packet(edit(7)),prepareResponsibility:()=>({writes:[{map:installed,key:1,value:7}],adds:[]})})).toThrow(TypeError);expect(invoked).toBe(1);expect(installed.size).toBe(0);expect(s.inspect().rows).toBe(0);}finally{off();s.dispose();}
});
it('temporary mutation cannot create different recipient and native admission',()=>{
 const s=new EntityPublicationSource();const a=edit(7);let first:Packet|undefined,second:Packet|undefined;let proposed:unknown;
 const off1=s.subscribe({prepare(p){first=p;expect(Reflect.set(p.ordinary,'0',edit(99))).toBe(false);expect(Reflect.set(a,'subject',99)).toBe(false);return {record:{writes:[],adds:[]},completion:{},finalize(){expect(Reflect.set(p.ordinary,'0',a)).toBe(false);}};},complete(){}});
 const off2=s.subscribe({prepare(p){second=p;expect(p.ordinary).toEqual([a]);return undefined;},complete(){}});
 try{install(s,{...packet(a),prepareResponsibility:f=>{proposed=f!.proposed(1,'x').value;return undefined;}});expect(first).toBe(second);expect(proposed).toBe(7);expect(s.inspect().rows).toBe(1);}finally{off1();off2();s.dispose();}
});
it('preserves edit identity and mutable row payloads without freezing shared input metadata',()=>{
 const s=new EntityPublicationSource();const row={x:7};const fields=['x'];const structural={kind:'add' as const,subject:1};const a:Edit={subject:1,before:undefined,after:row,fields,structural};let received:Packet|undefined;
 const off=s.subscribe({prepare(p){received=p;return undefined;},complete(){}});
 try{install(s,packet(a));expect(received!.ordinary[0]).toBe(a);expect(a.after).toBe(row);expect(Object.isFrozen(row)).toBe(false);row.x=8;expect(row.x).toBe(8);expect(Object.isFrozen(fields)).toBe(false);expect(Object.isFrozen(structural)).toBe(false);fields.push('y');expect(a.fields).toEqual(['x']);expect(Reflect.set(a.structural!,'kind','remove')).toBe(false);}finally{off();s.dispose();}
});
it('obsolete external array mutation is detached, not an admission refusal',()=>{
 const s=new EntityPublicationSource();const a=edit(7),edits=[a];let seen:Packet|undefined;
 const off=s.subscribe({prepare(p){seen=p;return {record:{writes:[],adds:[]},completion:{},finalize(){edits.push(edit(99));}};},complete(){}});
 try{install(s,{...packet(a),ordinary:edits});expect(edits.length).toBe(2);expect(seen!.ordinary).toEqual([a]);expect(s.inspect().rows).toBe(1);}finally{off();s.dispose();}
});
it('caught metadata mutation keeps exact structural and step admission',()=>{
 const s=new EntityPublicationSource();const a:Edit={...edit(7),structural:{kind:'add',subject:1}};let reached=false;
 const off=s.subscribe({prepare(p){expect(Reflect.set(p.steps!,'0',{ordinal:99,ordinary:[]})).toBe(false);expect(Reflect.set(p.steps![0],'ordinal',99)).toBe(false);expect(Reflect.set(a.structural!,'kind','remove')).toBe(false);reached=true;return undefined;},complete(){}});
 try{install(s,{...packet(a),steps:[{ordinal:0,ordinary:[a],physical:[a]}]});expect(reached).toBe(true);expect(s.inspect().presence).toBe(1);}finally{off();s.dispose();}
});
