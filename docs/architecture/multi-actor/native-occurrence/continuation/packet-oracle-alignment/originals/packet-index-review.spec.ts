import {expect,it} from 'vitest';
import '../index';
import {EntityPublicationSource,entityPublicationOrdinary,type EntityPublicationEdit as Edit,type EntityPublicationPacket as Packet} from './internals/entity-publication';
import {installTerminalRecord} from './internals/intrinsic-mutation';
const edit=(x:number):Edit=>({subject:1,before:undefined,after:{x},fields:['x']});
it('recipient finalizer admission mutation must refuse before installation',()=>{
 const source=new EntityPublicationSource();const a=edit(7),edits=[a];const installed=new Map<string,number>();
 const packet:Packet={owner:1,id:{},meta:undefined,ordinary:edits,physical:[a],prepareResponsibility:()=>({writes:[{map:installed,key:'accepted',value:7}],adds:[]})};
 const off=source.subscribe({prepare(){return {record:{writes:[],adds:[]},completion:{},finalize(){edits.push(edit(99));}};},complete(){}});
 try{const unit=source.prepare(packet)!;expect(()=>{unit.finalize?.();installTerminalRecord(unit.record);source.complete(unit.completion);}).toThrow('admission structure changed');expect(installed.size).toBe(0);}finally{off();source.dispose();}
});
it('recipient finalizer mutation diagnostic proves accepted stale native endpoint',()=>{
 const source=new EntityPublicationSource();const a=edit(7),edits=[a];const installed=new Map<string,number>();
 const off=source.subscribe({prepare(){return {record:{writes:[],adds:[]},completion:{},finalize(){edits.push(edit(99));}};},complete(){}});
 try{const unit=source.prepare({owner:1,id:{},meta:undefined,ordinary:edits,physical:[a],prepareResponsibility:()=>({writes:[{map:installed,key:'accepted',value:7}],adds:[]})})!;unit.finalize?.();installTerminalRecord(unit.record);source.complete(unit.completion);expect(edits.map(e=>e.after)).toEqual([{x:7},{x:99}]);expect(installed.get('accepted')).toBe(7);off();let observed:unknown;source.prepare({owner:1,id:{},meta:undefined,ordinary:[],physical:[],prepareResponsibility:s=>{observed=s!.before(1,'x').value;return undefined;}});expect(observed).toBe(7);}finally{off();source.dispose();}
});

it('duplicate step and edit identities preserve reverse-find oracle and restored endpoint priority',()=>{
 const source=new EntityPublicationSource();const restored={present:true,value:23,requirement:source.evidence()!.field(1,'x','ordinary')};
 const a=edit(7);const b:Edit={...edit(11),restoredFields:new Map([['x',restored]])};const step={ordinal:0,ordinary:[a,b,a],physical:[a,b,a]};
 const packet:Packet={owner:1,id:{},meta:undefined,ordinary:[],physical:[a,b,a,b],steps:[step,step,{ordinal:0,ordinary:[b],physical:[b]}],prepareResponsibility:selection=>{
  const reference=[...entityPublicationOrdinary(packet)].reverse().find(e=>e.subject===1)!;
  expect(selection!.proposed(1,'x').value).toBe((reference.after as {x:number}).x);expect(reference).toBe(b);return undefined;
 }};
 try{const unit=source.prepare(packet)!;unit.finalize?.();installTerminalRecord(unit.record);source.complete(unit.completion);let observed:unknown;source.prepare({owner:1,id:{},meta:undefined,ordinary:[],physical:[],prepareResponsibility:s=>{observed=s!.before(1,'x');return undefined;}});expect(observed).toBe(restored);}finally{source.dispose();}
});
it('later recipient finalizer source reentry refuses outer installation and retains newer facts',()=>{
 const source=new EntityPublicationSource();let entered=false;const install=(value:number)=>{const unit=source.prepare({owner:1,id:{},meta:undefined,ordinary:[edit(value)],physical:[]})!;unit.finalize?.();installTerminalRecord(unit.record);source.complete(unit.completion);};
 const off=source.subscribe({prepare(){return {record:{writes:[],adds:[]},completion:{},finalize(){if(!entered){entered=true;install(99);}}};},complete(){}});
 try{expect(()=>install(7)).toThrow('source changed during finalization');off();let value:unknown;source.prepare({owner:1,id:{},meta:undefined,ordinary:[],physical:[],prepareResponsibility:s=>{value=s!.before(1,'x').value;return undefined;}});expect(value).toBe(99);}finally{off();source.dispose();}
});
