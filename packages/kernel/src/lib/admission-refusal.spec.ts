import {expect,it} from 'vitest';
import '../index';
import {EntityPublicationSource,type EntityPublicationEdit as Edit,type EntityPublicationPacket as Packet} from './internals/entity-publication';
import {installTerminalRecord} from './internals/intrinsic-mutation';
import {initialRequirement} from './experimental-publication/lifecycle';
const message='Frozen entity publication edit contains mutable admission metadata';
const packet=(ordinary:readonly Edit[],extra:Partial<Packet>={}):Packet=>({owner:1,id:{},meta:undefined,ordinary,physical:ordinary,...extra});
const install=(s:EntityPublicationSource,p:Packet)=>{const u=s.prepare(p)!;u.finalize?.();installTerminalRecord(u.record);s.complete(u.completion);};
const before=(s:EntityPublicationSource)=>{let value:unknown;s.prepare(packet([],{prepareResponsibility:f=>{value=f!.before(1,'x');return undefined;}}));return value;};
for(const mutable of ['fields','structural','both'] as const)it(`refuses frozen shell with mutable ${mutable} before callbacks without altering borrowed metadata`,()=>{
 const s=new EntityPublicationSource();const fields=['x'];const structural={kind:'add' as const,subject:1};const payload={x:7,tags:['a']};
 if(mutable==='fields')Object.freeze(structural);if(mutable==='structural')Object.freeze(fields);
 const a:Edit=Object.freeze({subject:1,before:undefined,after:payload,fields,structural});const history={structuralRecord:structural};
 const savedFields=Object.getOwnPropertyDescriptors(fields),savedStructural=Object.getOwnPropertyDescriptors(structural);let callbacks=0;const record=new Map();
 const off=s.subscribe({prepare(){callbacks++;return undefined;},complete(){callbacks++;}});
 try{expect(()=>install(s,packet([a],{prepareResponsibility:()=>{callbacks++;return {writes:[{map:record,key:1,value:7}],adds:[]};}}))).toThrow(message);expect(callbacks).toBe(0);expect(record.size).toBe(0);expect(s.inspect().rows).toBe(0);expect(history.structuralRecord).toBe(structural);expect(Object.getOwnPropertyDescriptors(fields)).toEqual(savedFields);expect(Object.getOwnPropertyDescriptors(structural)).toEqual(savedStructural);expect(Object.isFrozen(payload)).toBe(false);payload.tags.push('b');expect(payload.tags).toEqual(['a','b']);}finally{off();s.dispose();}
});
for(const fields of [null,Object.freeze(['x'])] as const)it(`safe frozen metadata accepts mutable payload and proof references, fields=${String(fields)}`,()=>{
 const s=new EntityPublicationSource();const payload={x:7,tags:['a']};const proof=initialRequirement();const endpoint={present:true,value:7,requirement:proof};const restored=new Map([['x',endpoint]]);
 const a:Edit=Object.freeze({subject:1,before:undefined,after:payload,fields,structural:Object.freeze({kind:'add' as const,subject:1,value:payload}),restoredFields:restored});let seen:Edit|undefined;
 const off=s.subscribe({prepare(p){seen=p.ordinary[0];return undefined;},complete(){}});
 try{install(s,packet([a]));expect(seen).toBe(a);expect(before(s)).toBe(endpoint);expect(Object.isFrozen(payload)).toBe(false);expect(Object.isFrozen(payload.tags)).toBe(false);expect(Object.isFrozen(proof)).toBe(false);expect(Object.isFrozen(endpoint)).toBe(false);expect(a.restoredFields).toBe(restored);payload.tags.push('b');expect(payload.tags.length).toBe(2);}finally{off();s.dispose();}
});
it('supported precedence companion: safe frozen removal/add retains restored over selected over proposed endpoint',()=>{
 const s=new EntityPublicationSource();const restored=Object.freeze({present:true,value:5,requirement:initialRequirement()});const selected=Object.freeze({present:true,value:8,requirement:initialRequirement()});
 const r:Edit=Object.freeze({subject:1,before:undefined,after:undefined,fields:Object.freeze(['x']),structural:Object.freeze({kind:'remove' as const,subject:1})});
 const add:Edit=Object.freeze({subject:1,before:undefined,after:{x:11},fields:Object.freeze(['x']),structural:Object.freeze({kind:'add' as const,subject:1}),restoredFields:new Map([['x',restored]])});let calls=0;
 try{install(s,packet([r,add],{steps:[{ordinal:0,ordinary:[r],physical:[r]},{ordinal:1,ordinary:[add],physical:[add]}],prepareResponsibility:f=>{calls++;expect(f!.proposed(1,'x').value).toBe(11);f!.choose(1,'x',selected);return undefined;}}));expect(calls).toBe(1);expect(before(s)).toBe(restored);expect(s.inspect().negativePresence).toBe(0);}finally{s.dispose();}
});
it('mutable source shell still copies a shared upstream descriptor before sealing',()=>{
 const s=new EntityPublicationSource();const structural={kind:'add' as const,subject:1};const fields=['x'];const a:Edit={subject:1,before:undefined,after:{x:7},fields,structural};
 try{install(s,packet([a]));expect(a.structural).not.toBe(structural);expect(Object.isFrozen(structural)).toBe(false);expect(Object.isFrozen(fields)).toBe(false);expect(Object.isFrozen(a.structural)).toBe(true);expect(Object.isFrozen(a.fields)).toBe(true);expect(before(s)).toMatchObject({present:true,value:7});}finally{s.dispose();}
});
