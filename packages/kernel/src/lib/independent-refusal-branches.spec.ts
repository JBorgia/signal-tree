import {expect,it} from 'vitest';
import '../index';
import {EntityPublicationSource,withEntityPointPublicationPreparation,type EntityPublicationEdit as Edit,type EntityPublicationPacket as Packet} from './internals/entity-publication';
const message='Frozen entity publication edit contains mutable admission metadata';
const bad=()=>{const fields=['x'];const edit:Edit=Object.freeze({subject:1,before:undefined,after:{x:7},fields});const packet:Packet={owner:1,id:{},meta:undefined,ordinary:[edit],physical:[edit]};return {fields,edit,packet};};
it('caught refused first point fragment does not register phantom preparation callbacks',()=>{
 const s=new EntityPublicationSource();const {fields,packet}=bad();let calls=0;let caught:unknown;
 const off=s.subscribe({prepare(){calls++;return undefined;},complete(){calls++;}});
 try{withEntityPointPublicationPreparation(()=>{try{s.preparePoint(packet);}catch(error){caught=error;}});expect(caught).toBeInstanceOf(Error);expect((caught as Error).message).toBe(message);expect(calls).toBe(0);expect(s.inspect().rows).toBe(0);expect(Object.isFrozen(fields)).toBe(false);}finally{off();s.dispose();}
});
it('uncaught refused deferred fragment leaves borrowed aliases and source facts unchanged',()=>{
 const s=new EntityPublicationSource();const {fields,packet}=bad();const before=Object.getOwnPropertyDescriptors(fields);let calls=0;
 const off=s.subscribe({prepare(){calls++;return undefined;},complete(){calls++;}});
 try{expect(()=>withEntityPointPublicationPreparation(()=>s.preparePoint(packet))).toThrow(message);expect(calls).toBe(0);expect(Object.getOwnPropertyDescriptors(fields)).toEqual(before);expect(s.inspect().rows).toBe(0);}finally{off();s.dispose();}
});
it('caught rejection followed by a valid same-source fragment prepares only the valid packet',()=>{
 const s=new EntityPublicationSource();const {packet}=bad();const valid:Edit={subject:2,before:undefined,after:{x:9},fields:['x']};let calls=0;let accepted:Packet|undefined;
 const off=s.subscribe({prepare(p){calls++;accepted=p;return undefined;},complete(){}});
 try{withEntityPointPublicationPreparation(()=>{expect(()=>s.preparePoint(packet)).toThrow(message);s.preparePoint({owner:1,id:{},meta:undefined,ordinary:[valid],physical:[valid]});});expect(calls).toBe(1);expect(accepted!.ordinary).toEqual([valid]);expect(accepted!.owner).toBe(1);expect(s.inspect().rows).toBe(0);}finally{off();s.dispose();}
});
